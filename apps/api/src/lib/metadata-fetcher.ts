import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import * as cheerio from "cheerio";
import { Agent, fetch as undiciFetch, type Response } from "undici";
import {
  normalizeUrl,
  parseLinkMetadata,
  type LinkMetadata,
} from "@linkhub/shared";
import {
  fetchableUrlError,
  isBlockedIp,
  previewImageUrlError,
} from "./url-safety";

const MAX_BODY_BYTES = 512 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 500;
const MAX_SITE_NAME = 100;

const USER_AGENT =
  "LinkHubBot/2.1 (+https://link.nayankunwar.com; link previews)";

export type MetadataFetchErrorKind =
  | "blocked"
  | "invalid"
  | "timeout"
  | "upstream";

export class MetadataFetchError extends Error {
  readonly kind: MetadataFetchErrorKind;

  constructor(message: string, kind: MetadataFetchErrorKind) {
    super(message);
    this.name = "MetadataFetchError";
    this.kind = kind;
  }
}

export function emptyMetadataFor(
  sourceUrl: string,
  finalUrl = sourceUrl,
): LinkMetadata {
  return {
    sourceUrl: normalizeUrl(sourceUrl) ?? "",
    finalUrl: normalizeUrl(finalUrl) ?? normalizeUrl(sourceUrl) ?? "",
    title: "",
    description: "",
    imageUrl: "",
    siteName: "",
    fetchedAt: null,
  };
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const characters = Array.from(trimmed);
  return characters.length > max
    ? characters.slice(0, max).join("").trimEnd()
    : trimmed;
}

function metaMap($: cheerio.CheerioAPI): Map<string, string> {
  const values = new Map<string, string>();
  $("meta").each((_index, element) => {
    const node = $(element);
    const key = (node.attr("property") ?? node.attr("name") ?? "")
      .trim()
      .toLowerCase();
    const content = node.attr("content")?.trim();
    if (key && content && !values.has(key)) values.set(key, content);
  });
  return values;
}

function firstMeta(meta: Map<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = meta.get(key);
    if (value) return value;
  }
  return "";
}

function resolveImage(raw: string, baseUrl: string): string {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(value, baseUrl);
    if (!url.hostname) return "";
    if (previewImageUrlError(url)) return "";
    url.hash = "";
    const normalized = url.toString();
    return normalized.length <= 2048 ? normalized : "";
  } catch {
    return "";
  }
}

/**
 * Extracts Open Graph/Twitter metadata from an HTML document. Pure so the
 * parser can be tested without network access.
 */
export function parseMetadataHtml(
  html: string,
  sourceUrl: string,
  finalUrl: string,
  fetchedAt = new Date().toISOString(),
): LinkMetadata {
  const $ = cheerio.load(html);
  const meta = metaMap($);

  const title =
    firstMeta(meta, ["og:title", "twitter:title"]) ||
    $("title").first().text() ||
    "";

  const description = firstMeta(meta, [
    "og:description",
    "twitter:description",
    "description",
  ]);

  const image = firstMeta(meta, [
    "og:image:secure_url",
    "og:image",
    "og:image:url",
    "twitter:image",
    "twitter:image:src",
  ]);

  const siteName =
    firstMeta(meta, ["og:site_name", "application-name"]) ||
    (() => {
      try {
        return new URL(finalUrl).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })();

  const metadata: LinkMetadata = {
    sourceUrl: normalizeUrl(sourceUrl) ?? "",
    finalUrl: normalizeUrl(finalUrl) ?? normalizeUrl(sourceUrl) ?? "",
    title: truncate(title, MAX_TITLE),
    description: truncate(description, MAX_DESCRIPTION),
    imageUrl: resolveImage(image, finalUrl),
    siteName: truncate(siteName, MAX_SITE_NAME),
    fetchedAt,
  };

  return parseLinkMetadata(metadata);
}

function decodeHtml(bytes: Uint8Array, contentType: string): string {
  let charset = /charset\s*=\s*"?([^";\s]+)/i.exec(contentType)?.[1];
  if (!charset) {
    const head = new TextDecoder("utf-8").decode(bytes.subarray(0, 2048));
    charset =
      /<meta[^>]+charset\s*=\s*["']?([^"'\s/>]+)/i.exec(head)?.[1] ??
      "utf-8";
  }

  try {
    return new TextDecoder(charset, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

async function readBody(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;

      const remaining = MAX_BODY_BYTES - total;
      if (value.byteLength >= remaining) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * A DNS lookup that refuses to hand undici a private or reserved address.
 * Node's lookup supports both the legacy single-address callback and the
 * `all: true` array form; both are handled so the agent cannot bypass checks.
 */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(
    hostname,
    { ...options, all: true, verbatim: true },
    (error, addresses) => {
      if (error) {
        callback(error, "");
        return;
      }

      const list = Array.isArray(addresses)
        ? (addresses as LookupAddress[])
        : [];
      const safe = list.filter((entry) => !isBlockedIp(entry.address));
      if (safe.length === 0) {
        const blocked = Object.assign(
          new Error("The destination resolves to a private or reserved address."),
          { code: "EBLOCKEDADDRESS" },
        );
        callback(blocked, "");
        return;
      }

      if (options.all) {
        callback(null, safe);
        return;
      }
      callback(null, safe[0].address, safe[0].family);
    },
  );
};

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function asFetchError(error: unknown, signal: AbortSignal): MetadataFetchError {
  if (error instanceof MetadataFetchError) return error;

  if (signal.aborted) {
    return new MetadataFetchError(
      "The preview request timed out.",
      "timeout",
    );
  }

  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  if (code === "EBLOCKEDADDRESS") {
    return new MetadataFetchError(
      "The destination resolves to a private or reserved address.",
      "blocked",
    );
  }

  return new MetadataFetchError(
    "The destination did not return a readable preview.",
    "upstream",
  );
}

/**
 * Fetches a public HTML page and returns its Open Graph/Twitter metadata.
 *
 * - every hop is validated before the request
 * - the checked address is pinned through the agent's lookup
 * - Content-Type is checked before the body is read
 * - at most 512 KiB and 5 seconds are spent on the whole chain
 */
export async function fetchLinkMetadata(
  rawUrl: string,
  options: { signal?: AbortSignal } = {},
): Promise<LinkMetadata> {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    throw new MetadataFetchError("Enter a valid http(s) URL.", "invalid");
  }

  const sourceUrl = normalized;
  let current = new URL(normalized);
  const initialError = fetchableUrlError(current);
  if (initialError) {
    throw new MetadataFetchError(initialError, "blocked");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const signal = options.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;

  const agent = new Agent({
    connect: { lookup: safeLookup, timeout: REQUEST_TIMEOUT_MS },
    headersTimeout: REQUEST_TIMEOUT_MS,
    bodyTimeout: REQUEST_TIMEOUT_MS,
    keepAliveTimeout: 1,
    keepAliveMaxTimeout: 1,
    connections: 1,
  });

  try {
    const visited = new Set<string>();

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const hopError = fetchableUrlError(current);
      if (hopError) throw new MetadataFetchError(hopError, "blocked");

      const hopUrl = normalizeUrl(current.toString()) ?? current.toString();
      if (visited.has(hopUrl)) {
        throw new MetadataFetchError(
          "The destination redirected in a loop.",
          "upstream",
        );
      }
      visited.add(hopUrl);

      const response = await undiciFetch(current, {
        method: "GET",
        redirect: "manual",
        dispatcher: agent,
        signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml;q=0.9",
          "accept-language": "en;q=0.9",
        },
      });

      if (isRedirect(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => undefined);
        if (!location) {
          throw new MetadataFetchError(
            "The destination redirected without a location.",
            "upstream",
          );
        }
        if (hop === MAX_REDIRECTS) {
          throw new MetadataFetchError(
            "The destination redirected too many times.",
            "upstream",
          );
        }
        try {
          current = new URL(location, current);
        } catch {
          throw new MetadataFetchError(
            "The destination redirected to an invalid URL.",
            "upstream",
          );
        }
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new MetadataFetchError(
          `The destination returned HTTP ${response.status}.`,
          "upstream",
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      const mime = contentType.split(";")[0].trim().toLowerCase();
      if (mime !== "text/html" && mime !== "application/xhtml+xml") {
        await response.body?.cancel().catch(() => undefined);
        return emptyMetadataFor(sourceUrl, current.toString());
      }

      const bytes = await readBody(response);
      const html = decodeHtml(bytes, contentType);
      return parseMetadataHtml(
        html,
        sourceUrl,
        current.toString(),
        new Date().toISOString(),
      );
    }

    throw new MetadataFetchError(
      "The destination redirected too many times.",
      "upstream",
    );
  } catch (error) {
    throw asFetchError(error, signal);
  } finally {
    clearTimeout(timer);
    // A graceful close can wait for an in-flight socket. On the abort path the
    // save-time cap must hold, so tear the agent down immediately instead.
    if (signal.aborted) {
      await agent.destroy().catch(() => undefined);
    } else {
      await agent.close().catch(() => agent.destroy());
    }
  }
}
