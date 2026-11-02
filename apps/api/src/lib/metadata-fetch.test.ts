import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LinkMetadata } from "@linkhub/shared";
import { AppError } from "./errors";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock("./metadata-fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./metadata-fetcher")>();
  return {
    ...actual,
    fetchLinkMetadata: (...args: unknown[]) => fetchMock(...args),
  };
});

import {
  fetchMetadataForUser,
  isSkippedMetadataHost,
  metadataFetchBudgetUsersForTests,
  metadataFetchFailure,
  resetMetadataFetchStateForTests,
} from "./metadata-fetch";
import { MetadataFetchError } from "./metadata-fetcher";

function metadata(url: string): LinkMetadata {
  return {
    sourceUrl: url,
    finalUrl: url,
    title: "Example",
    description: "",
    imageUrl: "https://example.com/image.png",
    siteName: "Example",
    fetchedAt: "2026-11-01T12:00:00.000Z",
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => Promise.resolve(metadata(url)));
  resetMetadataFetchStateForTests();
});

describe("fetchMetadataForUser", () => {
  it("caches per user and URL for repeated previews", async () => {
    const first = await fetchMetadataForUser(
      "user-1",
      "https://example.com/article",
    );
    const second = await fetchMetadataForUser(
      "user-1",
      "https://example.com/article",
    );

    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await fetchMetadataForUser("user-2", "https://example.com/article");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bypasses the cache when refreshing", async () => {
    await fetchMetadataForUser("user-1", "https://example.com/article");
    await fetchMetadataForUser("user-1", "https://example.com/article", {
      force: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates in-flight fetches for the same user and URL", async () => {
    let resolve!: (value: LinkMetadata) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<LinkMetadata>((done) => {
          resolve = done;
        }),
    );

    const first = fetchMetadataForUser("user-1", "https://example.com/a");
    const second = fetchMetadataForUser("user-1", "https://example.com/a");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolve(metadata("https://example.com/a"));
    await expect(first).resolves.toEqual(metadata("https://example.com/a"));
    await expect(second).resolves.toEqual(metadata("https://example.com/a"));
  });

  it("does not join an in-flight fetch in save-time mode", async () => {
    let resolveFirst!: (value: LinkMetadata) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<LinkMetadata>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const preview = fetchMetadataForUser("user-1", "https://example.com/a");
    const save = await fetchMetadataForUser("user-1", "https://example.com/a", {
      saveTime: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(save).toEqual(metadata("https://example.com/a"));

    resolveFirst(metadata("https://example.com/a"));
    await expect(preview).resolves.toEqual(metadata("https://example.com/a"));
  });

  it("enforces the shared 20 fetches per minute budget", async () => {
    for (let index = 0; index < 20; index += 1) {
      await fetchMetadataForUser(
        "user-1",
        `https://example.com/article-${index}`,
      );
    }

    await expect(
      fetchMetadataForUser("user-1", "https://example.com/article-21"),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });

    // Another user still has their own budget.
    await expect(
      fetchMetadataForUser("user-2", "https://example.com/article-21"),
    ).resolves.toMatchObject({ title: "Example" });
  });

  it("skips Instagram and every Amazon and amzn host without spending a fetch", async () => {
    const instagram = await fetchMetadataForUser(
      "user-1",
      "https://www.instagram.com/p/example/",
    );
    const amazon = await fetchMetadataForUser(
      "user-1",
      "https://www.amazon.com/dp/B000000000",
    );
    const amazonUk = await fetchMetadataForUser(
      "user-1",
      "https://www.amazon.co.uk/dp/B000000000",
    );
    const amzn = await fetchMetadataForUser(
      "user-1",
      "https://amzn.eu/d/example",
    );

    expect(instagram.imageUrl).toBe("");
    expect(instagram.fetchedAt).toBeNull();
    for (const skipped of [amazon, amazonUk, amzn]) {
      expect(skipped.imageUrl).toBe("");
      expect(skipped.fetchedAt).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects private destinations before fetching", async () => {
    await expect(
      fetchMetadataForUser("user-1", "http://127.0.0.1/"),
    ).rejects.toBeInstanceOf(AppError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not treat lookalike domains as Amazon", () => {
    expect(isSkippedMetadataHost("https://notamazon.com/")).toBe(false);
    expect(isSkippedMetadataHost("https://amazon.com.evil.com/")).toBe(false);
    expect(isSkippedMetadataHost("https://amazon.co.uk/dp/B0")).toBe(true);
    expect(isSkippedMetadataHost("https://smile.amazon.de/dp/B0")).toBe(true);
    expect(isSkippedMetadataHost("https://amzn.to/example")).toBe(true);
  });
});

describe("metadataFetchFailure", () => {
  it("uses 502 for an upstream failure rather than a 422", () => {
    for (const kind of ["upstream", "timeout"] as const) {
      try {
        metadataFetchFailure(new MetadataFetchError("unavailable", kind));
        throw new Error("expected metadataFetchFailure to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error).toMatchObject({
          status: 502,
          code: "METADATA_UNAVAILABLE",
        });
      }
    }
  });

  it("uses 400 for a blocked or invalid destination", () => {
    try {
      metadataFetchFailure(new MetadataFetchError("blocked", "blocked"));
      throw new Error("expected metadataFetchFailure to throw");
    } catch (error) {
      expect(error).toMatchObject({
        status: 400,
        code: "VALIDATION_ERROR",
      });
    }
  });
});

describe("metadata budget cleanup", () => {
  it("drops users whose whole one-minute window has expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T12:00:00.000Z"));
    try {
      await fetchMetadataForUser("user-1", "https://example.com/one");
      expect(metadataFetchBudgetUsersForTests()).toBe(1);

      vi.setSystemTime(new Date("2026-11-01T12:01:01.000Z"));
      await fetchMetadataForUser("user-2", "https://example.com/two");

      expect(metadataFetchBudgetUsersForTests()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
