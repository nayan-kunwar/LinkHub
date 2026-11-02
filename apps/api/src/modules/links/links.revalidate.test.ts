import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, revalidateProfileMock, warnMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  revalidateProfileMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  prisma: { profile: { findUnique: findUniqueMock } },
}));

vi.mock("../../lib/revalidate", () => ({
  revalidateProfile: revalidateProfileMock,
}));

vi.mock("../../lib/logger", () => ({
  logger: { warn: warnMock },
}));

import { revalidateLinkOwnerInBackground } from "./links.revalidate";

beforeEach(() => {
  findUniqueMock.mockReset();
  revalidateProfileMock.mockReset();
  warnMock.mockReset();
  findUniqueMock.mockResolvedValue({ username: "owner" });
});

describe("revalidateLinkOwnerInBackground", () => {
  it("does not wait for the profile lookup or revalidation", () => {
    findUniqueMock.mockImplementation(() => new Promise(() => undefined));

    expect(() => revalidateLinkOwnerInBackground("user-1")).not.toThrow();
    expect(revalidateProfileMock).not.toHaveBeenCalled();
  });

  it("logs and swallows a failed revalidation", async () => {
    revalidateProfileMock.mockRejectedValue(new Error("web app unavailable"));

    revalidateLinkOwnerInBackground("user-1");
    await new Promise((resolve) => setImmediate(resolve));

    expect(revalidateProfileMock).toHaveBeenCalledWith("owner");
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
      "link revalidation failed",
    );
  });
});
