import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_LINK_METADATA } from "@linkhub/shared";

const { aggregateMock, createMock, updateMock, revalidateMock, fetchMock } =
  vi.hoisted(() => ({
    aggregateMock: vi.fn(),
    createMock: vi.fn(),
    updateMock: vi.fn(),
    revalidateMock: vi.fn(),
    fetchMock: vi.fn(),
  }));

vi.mock("../../lib/db", () => {
  const tx = {
    category: { findFirst: vi.fn() },
    link: { aggregate: aggregateMock, create: createMock },
  };
  return {
    prisma: {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      link: { update: updateMock, updateMany: updateMock },
      profile: { findUnique: vi.fn() },
    },
  };
});

vi.mock("../../lib/entitlements", () => ({
  assertWithinLimit: vi.fn(),
}));

vi.mock("./links.revalidate", () => ({
  revalidateLinkOwner: vi.fn(),
  revalidateLinkOwnerInBackground: revalidateMock,
}));

vi.mock("../../lib/metadata-fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/metadata-fetcher")>();
  return {
    ...actual,
    fetchLinkMetadata: (...args: unknown[]) => fetchMock(...args),
  };
});

import { createLink } from "./links.service";
import { resetMetadataFetchStateForTests } from "../../lib/metadata-fetch";

beforeEach(() => {
  vi.clearAllMocks();
  resetMetadataFetchStateForTests();

  aggregateMock.mockResolvedValue({ _max: { sortOrder: null } });
  createMock.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
    ...data,
    id: "link-1",
    metadata: {},
    createdAt: new Date("2026-11-01T12:00:00.000Z"),
    updatedAt: new Date("2026-11-01T12:00:00.000Z"),
    deletedAt: null,
  }));
  fetchMock.mockImplementation(
    (_url: string, options: { signal?: AbortSignal } = {}) =>
      new Promise<never>((_resolve, reject) => {
        const signal = options.signal;
        if (!signal) return;
        const abort = () => reject(new Error("aborted"));
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
      }),
  );
});

describe("createLink", () => {
  it(
    "caps a slow save-time metadata fetch at about three seconds",
    async () => {
      const started = performance.now();
      const result = await createLink("user-1", "free", {
        type: "link",
        title: "Slow site",
        url: "https://slow.example.org/article",
        description: "",
        categoryId: null,
        icon: "auto",
        isActive: true,
        config: { layout: "rich" },
      });
      const elapsed = performance.now() - started;

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(updateMock).not.toHaveBeenCalled();
      expect(elapsed).toBeGreaterThanOrEqual(2_700);
      expect(elapsed).toBeLessThan(6_000);
      expect(result.metadata).toEqual(EMPTY_LINK_METADATA);
      expect(result.previewImageUrl).toBe("");
      expect(revalidateMock).toHaveBeenCalledWith("user-1");
    },
    10_000,
  );
});
