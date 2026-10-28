import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";

const {
  accountFindUniqueMock,
  accountFindManyMock,
  accountCreateMock,
  accountDeleteManyMock,
  userFindUniqueMock,
  verifyGoogleCredentialMock,
} = vi.hoisted(() => ({
  accountFindUniqueMock: vi.fn(),
  accountFindManyMock: vi.fn(),
  accountCreateMock: vi.fn(),
  accountDeleteManyMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  verifyGoogleCredentialMock: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    account: {
      findUnique: accountFindUniqueMock,
      findMany: accountFindManyMock,
      create: accountCreateMock,
      deleteMany: accountDeleteManyMock,
    },
    user: { findUnique: userFindUniqueMock },
  },
}));

vi.mock("../../lib/google", () => ({
  verifyGoogleCredential: verifyGoogleCredentialMock,
}));

import {
  googleLogin,
  linkGoogleAccount,
  unlinkGoogleAccount,
} from "./auth.service";
import { getAccount } from "../account/account.service";

const activeUser = {
  id: "user-1",
  email: "owner@example.com",
  pendingEmail: null,
  passwordHash: "argon2-hash",
  role: "user",
  status: "active",
  plan: "free",
  emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletionScheduledFor: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
} satisfies User;

describe("Google account service", () => {
  beforeEach(() => {
    accountFindUniqueMock.mockReset();
    accountFindManyMock.mockReset();
    accountCreateMock.mockReset();
    accountDeleteManyMock.mockReset();
    userFindUniqueMock.mockReset();
    verifyGoogleCredentialMock.mockReset();
    verifyGoogleCredentialMock.mockResolvedValue({
      sub: "google-sub-1",
      email: "owner@example.com",
    });
  });

  it("signs in only when the Google subject is already linked", async () => {
    accountFindUniqueMock.mockResolvedValue({
      id: "account-1",
      userId: activeUser.id,
      provider: "google",
      providerAccountId: "google-sub-1",
      user: activeUser,
    });

    await expect(googleLogin("credential")).resolves.toEqual(activeUser);
    expect(accountFindUniqueMock).toHaveBeenCalledWith({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: "google-sub-1",
        },
      },
      include: { user: true },
    });
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects an unlinked Google account without looking up a user by email", async () => {
    accountFindUniqueMock.mockResolvedValue(null);

    await expect(googleLogin("credential")).rejects.toMatchObject({
      code: "GOOGLE_NOT_LINKED",
    });
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects a suspended linked user", async () => {
    accountFindUniqueMock.mockResolvedValue({
      id: "account-1",
      userId: activeUser.id,
      provider: "google",
      providerAccountId: "google-sub-1",
      user: { ...activeUser, status: "suspended" },
    });

    await expect(googleLogin("credential")).rejects.toMatchObject({
      code: "ACCOUNT_SUSPENDED",
    });
  });

  it("links Google once for an active, verified account", async () => {
    userFindUniqueMock.mockResolvedValue({
      status: "active",
      emailVerifiedAt: activeUser.emailVerifiedAt,
      deletedAt: null,
    });
    accountFindUniqueMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    accountCreateMock.mockResolvedValue({ id: "account-1" });
    accountFindManyMock.mockResolvedValue([{ provider: "google" }]);

    await expect(linkGoogleAccount(activeUser.id, "credential")).resolves.toEqual([
      "google",
    ]);
    expect(accountCreateMock).toHaveBeenCalledWith({
      data: {
        userId: activeUser.id,
        provider: "google",
        providerAccountId: "google-sub-1",
      },
    });
  });

  it("does not link a second Google account to the same user", async () => {
    userFindUniqueMock.mockResolvedValue({
      status: "active",
      emailVerifiedAt: activeUser.emailVerifiedAt,
      deletedAt: null,
    });
    accountFindUniqueMock.mockResolvedValueOnce({ id: "account-1" }).mockResolvedValueOnce(null);

    await expect(linkGoogleAccount(activeUser.id, "credential")).rejects.toMatchObject({
      code: "GOOGLE_ALREADY_LINKED",
    });
    expect(accountCreateMock).not.toHaveBeenCalled();
  });

  it("does not move a Google subject that belongs to another user", async () => {
    userFindUniqueMock.mockResolvedValue({
      status: "active",
      emailVerifiedAt: activeUser.emailVerifiedAt,
      deletedAt: null,
    });
    accountFindUniqueMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "account-2" });

    await expect(linkGoogleAccount(activeUser.id, "credential")).rejects.toMatchObject({
      code: "GOOGLE_ALREADY_LINKED",
    });
    expect(accountCreateMock).not.toHaveBeenCalled();
  });

  it("requires a verified active account before linking", async () => {
    userFindUniqueMock.mockResolvedValue({
      status: "pending_verification",
      emailVerifiedAt: null,
      deletedAt: null,
    });

    await expect(linkGoogleAccount(activeUser.id, "credential")).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
    expect(verifyGoogleCredentialMock).not.toHaveBeenCalled();
  });

  it("unlinks Google when a password remains available", async () => {
    userFindUniqueMock.mockResolvedValue({
      passwordHash: activeUser.passwordHash,
      status: "active",
      deletedAt: null,
      accounts: [{ id: "account-1" }],
    });
    accountDeleteManyMock.mockResolvedValue({ count: 1 });

    await expect(unlinkGoogleAccount(activeUser.id)).resolves.toBeUndefined();
    expect(accountDeleteManyMock).toHaveBeenCalledWith({
      where: { userId: activeUser.id, provider: "google" },
    });
  });

  it("refuses to remove the only sign-in method", async () => {
    userFindUniqueMock.mockResolvedValue({
      passwordHash: null,
      status: "active",
      deletedAt: null,
      accounts: [{ id: "account-1" }],
    });

    await expect(unlinkGoogleAccount(activeUser.id)).rejects.toMatchObject({
      code: "LAST_SIGN_IN_METHOD",
    });
    expect(accountDeleteManyMock).not.toHaveBeenCalled();
  });

  it("returns connected providers and password state on the account DTO", async () => {
    userFindUniqueMock.mockResolvedValue({
      ...activeUser,
      accounts: [{ provider: "google" }],
    });

    await expect(getAccount(activeUser.id)).resolves.toMatchObject({
      email: activeUser.email,
      connectedProviders: ["google"],
      hasPassword: true,
    });
  });
});
