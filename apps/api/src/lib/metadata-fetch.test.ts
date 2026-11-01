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
  resetMetadataFetchStateForTests,
} from "./metadata-fetch";

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

  it("skips Instagram and Amazon without spending a fetch", async () => {
    const instagram = await fetchMetadataForUser(
      "user-1",
      "https://www.instagram.com/p/example/",
    );
    const amazon = await fetchMetadataForUser(
      "user-1",
      "https://www.amazon.com/dp/B000000000",
    );

    expect(instagram.imageUrl).toBe("");
    expect(instagram.fetchedAt).toBeNull();
    expect(amazon.imageUrl).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects private destinations before fetching", async () => {
    await expect(
      fetchMetadataForUser("user-1", "http://127.0.0.1/"),
    ).rejects.toBeInstanceOf(AppError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
