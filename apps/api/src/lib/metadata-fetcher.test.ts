import { afterEach, describe, expect, it } from "vitest";
import type { LookupAddress, LookupOptions } from "node:dns";
import { lookup as dnsLookup } from "node:dns";
import type { LookupFunction } from "node:net";
import { MockAgent } from "undici";
import {
  createSafeLookup,
  fetchLinkMetadata,
  MetadataFetchError,
} from "./metadata-fetcher";

const ORIGIN = "https://example.com";
const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" };

const agents: MockAgent[] = [];

function createMockAgent(): MockAgent {
  const agent = new MockAgent();
  agent.disableNetConnect();
  agents.push(agent);
  return agent;
}

afterEach(async () => {
  await Promise.all(agents.splice(0).map((agent) => agent.close()));
});

function replyHtml(
  agent: MockAgent,
  path: string,
  html: string,
  headers: Record<string, string> = HTML_HEADERS,
): void {
  agent
    .get(ORIGIN)
    .intercept({ path, method: "GET" })
    .reply(200, html, { headers });
}

function replyRedirect(
  agent: MockAgent,
  path: string,
  location: string,
): void {
  agent
    .get(ORIGIN)
    .intercept({ path, method: "GET" })
    .reply(302, "", { headers: { location } });
}

describe("fetchLinkMetadata", () => {
  it("follows a validated relative redirect and parses the final page", async () => {
    const agent = createMockAgent();
    replyRedirect(agent, "/start", "/final");
    replyHtml(
      agent,
      "/final",
      `<meta property="og:title" content="Final title">
       <meta property="og:image" content="https://cdn.example.com/card.png">`,
    );

    const metadata = await fetchLinkMetadata(`${ORIGIN}/start`, {
      dispatcher: agent,
    });

    expect(metadata.sourceUrl).toBe(`${ORIGIN}/start`);
    expect(metadata.finalUrl).toBe(`${ORIGIN}/final`);
    expect(metadata.title).toBe("Final title");
    expect(metadata.imageUrl).toBe("https://cdn.example.com/card.png");
  });

  it("rejects a redirect to a private address", async () => {
    const agent = createMockAgent();
    replyRedirect(agent, "/start", "http://127.0.0.1/admin");

    await expect(
      fetchLinkMetadata(`${ORIGIN}/start`, { dispatcher: agent }),
    ).rejects.toMatchObject({ kind: "blocked" });
  });

  it("rejects a redirect to a non-standard port", async () => {
    const agent = createMockAgent();
    replyRedirect(agent, "/start", "https://example.com:8443/admin");

    await expect(
      fetchLinkMetadata(`${ORIGIN}/start`, { dispatcher: agent }),
    ).rejects.toMatchObject({ kind: "blocked" });
  });

  it("allows three redirects and rejects a fourth", async () => {
    const agent = createMockAgent();
    replyRedirect(agent, "/r0", "/r1");
    replyRedirect(agent, "/r1", "/r2");
    replyRedirect(agent, "/r2", "/r3");
    replyRedirect(agent, "/r3", "/r4");

    await expect(
      fetchLinkMetadata(`${ORIGIN}/r0`, { dispatcher: agent }),
    ).rejects.toMatchObject({
      kind: "upstream",
      message: "The destination redirected too many times.",
    });
  });

  it("detects redirect loops", async () => {
    const agent = createMockAgent();
    replyRedirect(agent, "/a", "/b");
    replyRedirect(agent, "/b", "/a");

    await expect(
      fetchLinkMetadata(`${ORIGIN}/a`, { dispatcher: agent }),
    ).rejects.toMatchObject({
      kind: "upstream",
      message: "The destination redirected in a loop.",
    });
  });

  it("reads at most 512 KiB of HTML", async () => {
    const agent = createMockAgent();
    const html =
      `<html><head><title>Early title</title><!--${"x".repeat(600 * 1024)}-->` +
      `<meta property="og:title" content="Late title"></head></html>`;
    replyHtml(agent, "/huge", html);

    const metadata = await fetchLinkMetadata(`${ORIGIN}/huge`, {
      dispatcher: agent,
    });

    expect(metadata.title).toBe("Early title");
  });

  it("times out a slow response", async () => {
    const agent = createMockAgent();
    agent
      .get(ORIGIN)
      .intercept({ path: "/slow", method: "GET" })
      .reply(200, `<title>Slow</title>`, { headers: HTML_HEADERS })
      .delay(500);

    await expect(
      fetchLinkMetadata(`${ORIGIN}/slow`, {
        dispatcher: agent,
        timeoutMs: 40,
      }),
    ).rejects.toMatchObject({ kind: "timeout" });
  });

  it("skips non-HTML responses and records that the fetch completed", async () => {
    const agent = createMockAgent();
    agent
      .get(ORIGIN)
      .intercept({ path: "/file.pdf", method: "GET" })
      .reply(200, "%PDF-1.7", {
        headers: { "content-type": "application/pdf" },
      });

    const metadata = await fetchLinkMetadata(`${ORIGIN}/file.pdf`, {
      dispatcher: agent,
    });

    expect(metadata).toMatchObject({
      sourceUrl: `${ORIGIN}/file.pdf`,
      finalUrl: `${ORIGIN}/file.pdf`,
      title: "",
      imageUrl: "",
    });
    expect(metadata.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("decodes a legacy charset from the Content-Type header", async () => {
    const agent = createMockAgent();
    agent
      .get(ORIGIN)
      .intercept({ path: "/latin1", method: "GET" })
      .reply(
        200,
        Buffer.from(
          `<meta property="og:title" content="Caf\xe9">`,
          "latin1",
        ),
        { headers: { "content-type": "text/html; charset=iso-8859-1" } },
      );

    const metadata = await fetchLinkMetadata(`${ORIGIN}/latin1`, {
      dispatcher: agent,
    });

    expect(metadata.title).toBe("Café");
  });

  it("maps a non-OK response to an upstream error", async () => {
    const agent = createMockAgent();
    agent
      .get(ORIGIN)
      .intercept({ path: "/down", method: "GET" })
      .reply(503, "unavailable", { headers: HTML_HEADERS });

    await expect(
      fetchLinkMetadata(`${ORIGIN}/down`, { dispatcher: agent }),
    ).rejects.toMatchObject({
      kind: "upstream",
      message: "The destination returned HTTP 503.",
    });
  });

  it("rejects a private URL before it reaches the dispatcher", async () => {
    const agent = createMockAgent();

    await expect(
      fetchLinkMetadata("http://127.0.0.1/", { dispatcher: agent }),
    ).rejects.toBeInstanceOf(MetadataFetchError);
    expect(agent.pendingInterceptors()).toHaveLength(0);
  });
});

type LookupResult = {
  error: NodeJS.ErrnoException | null;
  address: string | LookupAddress[];
  family?: number;
};

function fakeResolver(
  result: LookupAddress[] | NodeJS.ErrnoException,
): typeof dnsLookup {
  return ((
    _hostname: string,
    _options: LookupOptions,
    callback: (
      error: NodeJS.ErrnoException | null,
      addresses: LookupAddress[],
    ) => void,
  ) => {
    if (Array.isArray(result)) {
      callback(null, result);
    } else {
      callback(result, []);
    }
  }) as unknown as typeof dnsLookup;
}

function lookupWith(
  lookup: LookupFunction,
  hostname: string,
  options: LookupOptions,
): Promise<LookupResult> {
  return new Promise((resolve) => {
    lookup(hostname, options, (error, address, family) => {
      resolve({ error, address, family });
    });
  });
}

describe("createSafeLookup", () => {
  it("returns only public addresses in the all-address form", async () => {
    const lookup = createSafeLookup(
      fakeResolver([
        { address: "10.0.0.7", family: 4 },
        { address: "93.184.216.34", family: 4 },
        { address: "::1", family: 6 },
      ]),
    );

    const result = await lookupWith(lookup, "example.com", { all: true });

    expect(result.error).toBeNull();
    expect(result.address).toEqual([
      { address: "93.184.216.34", family: 4 },
    ]);
  });

  it("returns the first public address in the legacy single form", async () => {
    const lookup = createSafeLookup(
      fakeResolver([
        { address: "127.0.0.1", family: 4 },
        { address: "93.184.216.34", family: 4 },
      ]),
    );

    const result = await lookupWith(lookup, "example.com", {});

    expect(result.error).toBeNull();
    expect(result.address).toBe("93.184.216.34");
    expect(result.family).toBe(4);
  });

  it("refuses a host that resolves only to private addresses", async () => {
    const lookup = createSafeLookup(
      fakeResolver([
        { address: "127.0.0.1", family: 4 },
        { address: "fc00::1", family: 6 },
      ]),
    );

    const result = await lookupWith(lookup, "internal.example.com", {
      all: true,
    });

    expect(result.error).toMatchObject({ code: "EBLOCKEDADDRESS" });
  });

  it("passes resolver failures through unchanged", async () => {
    const lookup = createSafeLookup(
      fakeResolver(
        Object.assign(new Error("not found"), { code: "ENOTFOUND" }),
      ),
    );

    const result = await lookupWith(lookup, "missing.example.com", {
      all: true,
    });

    expect(result.error).toMatchObject({ code: "ENOTFOUND" });
  });
});
