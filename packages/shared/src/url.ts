import { z } from "zod";
import type { LinkMetadata } from "./types";

const MAX_URL_LENGTH = 2048;
const MAX_METADATA_TITLE = 200;
const MAX_METADATA_DESCRIPTION = 500;
const MAX_METADATA_SITE_NAME = 100;

const httpUrl = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        !url.username &&
        !url.password &&
        url.hostname.length > 0
      );
    } catch {
      return false;
    }
  }, "Enter a valid http(s) URL.");

const httpsUrl = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        url.hostname.includes(".")
      );
    } catch {
      return false;
    }
  }, "Enter a valid https:// URL.");

/**
 * Server-owned preview metadata. Stored in `Link.metadata` and parsed
 * defensively so malformed rows fall back to an empty payload.
 */
export const linkMetadataSchema = z.object({
  sourceUrl: z.union([z.literal(""), httpUrl]),
  finalUrl: z.union([z.literal(""), httpUrl]),
  title: z.string().trim().max(MAX_METADATA_TITLE),
  description: z.string().trim().max(MAX_METADATA_DESCRIPTION),
  imageUrl: z.union([z.literal(""), httpsUrl]),
  siteName: z.string().trim().max(MAX_METADATA_SITE_NAME),
  fetchedAt: z.string().datetime().nullable(),
});

export const EMPTY_LINK_METADATA: LinkMetadata = Object.freeze({
  sourceUrl: "",
  finalUrl: "",
  title: "",
  description: "",
  imageUrl: "",
  siteName: "",
  fetchedAt: null,
});

export function parseLinkMetadata(value: unknown): LinkMetadata {
  const parsed = linkMetadataSchema.safeParse(value);
  return parsed.success ? parsed.data : { ...EMPTY_LINK_METADATA };
}

/**
 * The single normalisation used for stored source URLs, cache keys, URL-change
 * checks and the editor's stale-preview check.
 *
 * - http/https only
 * - no credentials
 * - no hash
 * - lower-case host and default ports removed by WHATWG URL
 * - path and query preserved
 */
export function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > MAX_URL_LENGTH) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** Case-insensitive so `MAILTO:` and `MailTo:` are handled consistently. */
export function isMailtoUrl(value: string): boolean {
  return /^mailto:/i.test(value.trim());
}
