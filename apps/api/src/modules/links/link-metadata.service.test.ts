import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_LINK_METADATA, normalizeUrl } from "@linkhub/shared";

const {
  findFirstMock,
  updateManyMock,
  fetchMock,
  revalidateMock,
  warnMock,
} = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  updateManyMock: vi.fn(),
  fetchMock: vi.fn(),
  revalidateMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    link: {
      findFirst: findFirstMock,
      updateMany: updateManyMock,
    },
    category: { findFirst: vi.fn() },
    profile: { findUnique: vi.fn() },
  },
}));

vi.mock("../../lib/metadata-fetcher", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/metadata-fetcher")>();
  return {
    ...actual,
    fetchLinkMetadata: (...args: unknown[]) => fetchMock(...args),
  };
});

vi.mock("./links.revalidate", () => ({
  revalidateLinkOwner: vi.fn(),
  revalidateLinkOwnerInBackground: revalidateMock,
}));

vi.mock("../../lib/logger", () => ({
  logger: { warn: warnMock },
}));

import { MetadataFetchError } from "../../lib/metadata-fetcher";
import { resetMetadataFetchStateForTests } from "../../lib/metadata-fetch";
import {
  maybeFetchLinkMetadata,
  refreshLinkMetadata,
} from "./link-metadata.service";
import { updateLink } from "./links.service";

const OLD_URL = "https://example.com/old";
const NEW_URL = "https://example.com/new";
const FETCHED_AT = "2026-11-01T12:00:00.000Z";

function metadata(url: string, title = "Example") {
  return {
    sourceUrl: url,
    finalUrl: url,
    title,
    description: "",
    imageUrl: "https://cdn.example.com/card.png",
    siteName: "Example",
    fetchedAt: FETCHED_AT,
  };
}

function makeLink(
  overrides: Partial<ReturnType<typeof baseLink>> = {},
): ReturnType<typeof baseLink> {
  return { ...baseLink(), ...overrides };
}

function baseLink() {
  return {
    id: "link-1",
    userId: "user-1",
    title: "Example",
    url: OLD_URL,
    type: "link",
    config: { layout: "rich" },
    metadata: metadata(OLD_URL) as unknown,
    description: "",
    categoryId: null,
    icon: "auto",
    isActive: true,
    sortOrder: 0,
    createdAt: new Date("2026-11-01T12:00:00.000Z"),
    updatedAt: new Date("2026-11-01T12:00:00.000Z"),
    deletedAt: null,
  };
}

let current: ReturnType<typeof baseLink>;

beforeEach(() => {
  vi.clearAllMocks();
  resetMetadataFetchStateForTests();

  current = baseLink();

  findFirstMock.mockImplementation(
    (args: { where?: { id?: string; userId?: string } } = {}) => {
      const where = args.where ?? {};
      if (
        where.id === current.id &&
        where.userId === current.userId
      ) {
        return Promise.resolve(current);
      }
      return Promise.resolve(null);
    },
  );

  updateManyMock.mockImplementation(
    (args: {
      where?: { id?: string; userId?: string; url?: string; deletedAt?: null };
      data?: Record<string, unknown>;
    } = {}) => {
      const where = args.where ?? {};
      if (
        where.id !== current.id ||
        where.userId !== current.userId ||
        where.deletedAt !== null ||
        (where.url !== undefined && where.url !== current.url)
      ) {
        return Promise.resolve({ count: 0 });
      }
      current = { ...current, ...(args.data ?? {}) } as typeof current;
      return Promise.resolve({ count: 1 });
    },
  );

  fetchMock.mockResolvedValue(metadata(OLD_URL));
});

describe("updateLink metadata lifecycle", () => {
  it("keeps stored metadata across rich to classic and back to rich", async () => {
    await updateLink("user-1", "link-1", { config: { layout: "classic" } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(current.config).toMatchObject({ layout: "classic" });
    expect(current.metadata).toEqual(metadata(OLD_URL));

    await updateLink("user-1", "link-1", { config: { layout: "rich" } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(current.config).toMatchObject({ layout: "rich" });
    expect(current.metadata).toEqual(metadata(OLD_URL));
  });

  it("fetches when a classic link is switched to rich", async () => {
    current = makeLink({
      config: { layout: "classic" },
      metadata: {},
    });

    const result = await updateLink("user-1", "link-1", {
      config: { layout: "rich" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.metadata.sourceUrl).toBe(OLD_URL);
    expect(current.metadata).toEqual(metadata(OLD_URL));
  });

  it("resets metadata on a URL change and fetches for the new URL", async () => {
    fetchMock.mockResolvedValue(metadata(NEW_URL, "New title"));

    const result = await updateLink("user-1", "link-1", {
      url: NEW_URL,
      config: { layout: "rich" },
    });

    expect(updateManyMock.mock.calls[0][0].data.metadata).toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(NEW_URL);
    expect(updateManyMock.mock.calls[1][0].where).toMatchObject({
      id: "link-1",
      userId: "user-1",
      url: NEW_URL,
      deletedAt: null,
    });
    expect(current.metadata).toMatchObject({
      sourceUrl: NEW_URL,
      title: "New title",
    });
    expect(result.metadata.sourceUrl).toBe(NEW_URL);
  });

  it("does not write metadata if the URL changed during the fetch", async () => {
    const link = makeLink({ url: OLD_URL, metadata: {} });
    fetchMock.mockResolvedValue(metadata(OLD_URL));
    updateManyMock.mockResolvedValue({ count: 0 });

    const result = await maybeFetchLinkMetadata("user-1", link as never);

    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "link-1",
        userId: "user-1",
        url: OLD_URL,
        deletedAt: null,
      },
      data: { metadata: metadata(OLD_URL) },
    });
    expect(result.metadata).toEqual({});
  });
});

describe("refreshLinkMetadata", () => {
  it("persists refreshed metadata and revalidates the public profile", async () => {
    fetchMock.mockResolvedValue(metadata(OLD_URL, "Refreshed"));

    const result = await refreshLinkMetadata("user-1", "link-1");

    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "link-1",
        userId: "user-1",
        url: OLD_URL,
        deletedAt: null,
      },
      data: { metadata: metadata(OLD_URL, "Refreshed") },
    });
    expect(result.metadata.title).toBe("Refreshed");
    expect(revalidateMock).toHaveBeenCalledWith("user-1");
  });

  it("keeps the previous metadata when the fetch fails", async () => {
    fetchMock.mockRejectedValue(
      new MetadataFetchError("The destination returned HTTP 500.", "upstream"),
    );

    await expect(
      refreshLinkMetadata("user-1", "link-1"),
    ).rejects.toMatchObject({
      status: 502,
      code: "METADATA_UNAVAILABLE",
    });

    expect(updateManyMock).not.toHaveBeenCalled();
    expect(current.metadata).toEqual(metadata(OLD_URL));
    expect(revalidateMock).not.toHaveBeenCalled();
  });

  it("returns a conflict if the URL changed while refreshing", async () => {
    fetchMock.mockImplementation(async () => {
      current = { ...current, url: "https://example.com/changed" };
      return metadata(OLD_URL);
    });

    await expect(
      refreshLinkMetadata("user-1", "link-1"),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
    expect(current.metadata).toEqual(metadata(OLD_URL));
  });

  it("does not fetch a skipped Amazon host", async () => {
    const amazonUrl = "https://www.amazon.co.uk/dp/B000000000";
    current = makeLink({
      url: amazonUrl,
      config: { layout: "rich" },
      metadata: metadata(amazonUrl),
    });

    const result = await refreshLinkMetadata("user-1", "link-1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.previewImageUrl).toBe(
      "https://cdn.example.com/card.png",
    );
  });
});

describe("maybeFetchLinkMetadata", () => {
  it("persists a completed non-HTML fetch and does not retry it", async () => {
    const empty = {
      ...EMPTY_LINK_METADATA,
      sourceUrl: OLD_URL,
      finalUrl: OLD_URL,
      fetchedAt: FETCHED_AT,
    };
    fetchMock.mockResolvedValue(empty);

    const first = await maybeFetchLinkMetadata(
      "user-1",
      makeLink({ metadata: {} }) as never,
    );
    expect(first.metadata).toEqual(empty);

    resetMetadataFetchStateForTests();
    const second = await maybeFetchLinkMetadata("user-1", first as never);

    expect(second.metadata).toEqual(empty);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("logs a failed save-time fetch and keeps the link", async () => {
    const link = makeLink({ metadata: {} });
    fetchMock.mockRejectedValue(
      new MetadataFetchError("The destination took too long.", "timeout"),
    );

    const result = await maybeFetchLinkMetadata("user-1", link as never);

    expect(result).toBe(link);
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({ linkId: "link-1" }),
      "link metadata fetch failed during save",
    );
  });

  it("skips links that already have metadata for the current URL", async () => {
    const link = makeLink();
    const result = await maybeFetchLinkMetadata("user-1", link as never);

    expect(result).toBe(link);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(normalizeUrl(link.url)).toBe(OLD_URL);
  });
});
