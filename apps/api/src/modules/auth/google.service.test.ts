import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";

const {
  accountFindUniqueMock,
  accountFindManyMock,
  accountCreateMock,
  accountDeleteManyMock,
  userFindUniqueMock,
  userFindFirstMock,
  userUpdateMock,
  profileFindUniqueMock,
  transactionMock,
  txUserCreateMock,
  txProfileCreateMock,
  txAccountCreateMock,
  executeRawMock,
  verifyGoogleCredentialMock,
} = vi.hoisted(() => ({
  accountFindUniqueMock: vi.fn(),
  accountFindManyMock: vi.fn(),
  accountCreateMock: vi.fn(),
  accountDeleteManyMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userFindFirstMock: vi.fn(),
  userUpdateMock: vi.fn(),
  profileFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  txUserCreateMock: vi.fn(),
  txProfileCreateMock: vi.fn(),
  txAccountCreateMock: vi.fn(),
  executeRawMock: vi.fn(),
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
    user: {
      findUnique: userFindUniqueMock,
      findFirst: userFindFirstMock,
      update: userUpdateMock,
    },
    profile: { findUnique: profileFindUniqueMock },
    $transaction: transactionMock,
    $executeRaw: executeRawMock,
  },
}));

vi.mock("../../lib/google", () => ({
  verifyGoogleCredential: verifyGoogleCredentialMock,
}));

import {
  changePassword,
  googleLogin,
  googleSignup,
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
    userFindFirstMock.mockReset();
    userUpdateMock.mockReset();
    profileFindUniqueMock.mockReset();
    transactionMock.mockReset();
    txUserCreateMock.mockReset();
    txProfileCreateMock.mockReset();
    txAccountCreateMock.mockReset();
    executeRawMock.mockReset();
    verifyGoogleCredentialMock.mockReset();

    verifyGoogleCredentialMock.mockResolvedValue({
      sub: "google-sub-1",
      email: "owner@example.com",
      name: "Nayan Kunwar",
    });
    userFindFirstMock.mockResolvedValue(null);
    profileFindUniqueMock.mockResolvedValue(null);
    executeRawMock.mockResolvedValue(1);
    transactionMock.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          user: { create: txUserCreateMock },
          profile: { create: txProfileCreateMock },
          account: { create: txAccountCreateMock },
        }),
    );
  });

  it("signs in only when the Google subject is already linked", async () => {
    accountFindUniqueMock.mockResolvedValue({
      id: "account-1",
      userId: activeUser.id,
      provider: "google",
      providerAccountId: "google-sub-1",
      user: activeUser,
    });

    await expect(googleLogin("credential")).resolves.toEqual({
      status: "authenticated",
      user: activeUser,
    });
    expect(accountFindUniqueMock).toHaveBeenCalledWith({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: "google-sub-1",
        },
      },
      include: { user: true },
    });
    expect(userFindFirstMock).not.toHaveBeenCalled();
  });

  it("returns a claim suggestion for an unlinked Google identity", async () => {
    accountFindUniqueMock.mockResolvedValue(null);

    await expect(googleLogin("credential")).resolves.toMatchObject({
      status: "signup_required",
      email: "owner@example.com",
      displayName: "Nayan Kunwar",
      suggestedUsername: "nayan-kunwar",
    });
  });

  it("refuses to auto-link when the Google email already has an account", async () => {
    accountFindUniqueMock.mockResolvedValue(null);
    userFindFirstMock.mockResolvedValue({ id: "user-2" });

    await expect(googleLogin("credential")).rejects.toMatchObject({
      code: "GOOGLE_ACCOUNT_EXISTS",
    });
    expect(accountCreateMock).not.toHaveBeenCalled();
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

  it("creates an active, verified account with the confirmed username", async () => {
    const createdUser = {
      ...activeUser,
      passwordHash: null,
      emailVerifiedAt: new Date("2026-02-01T00:00:00.000Z"),
    };
    accountFindUniqueMock.mockResolvedValue(null);
    txUserCreateMock.mockResolvedValue(createdUser);
    txProfileCreateMock.mockResolvedValue({ id: "profile-1" });
    txAccountCreateMock.mockResolvedValue({ id: "account-1" });

    await expect(
      googleSignup({ credential: "credential", username: "nayan-kunwar" }),
    ).resolves.toEqual(createdUser);

    expect(txUserCreateMock).toHaveBeenCalledWith({
      data: {
        email: "owner@example.com",
        status: "active",
        emailVerifiedAt: expect.any(Date),
      },
    });
    expect(txProfileCreateMock).toHaveBeenCalledWith({
      data: {
        userId: createdUser.id,
        username: "nayan-kunwar",
        displayName: "Nayan Kunwar",
        theme: expect.any(Object),
        socials: {},
        isPublished: false,
      },
    });
    expect(txAccountCreateMock).toHaveBeenCalledWith({
      data: {
        userId: createdUser.id,
        provider: "google",
        providerAccountId: "google-sub-1",
      },
    });
  });

  it("does not create an account when the username is taken", async () => {
    accountFindUniqueMock.mockResolvedValue(null);
    profileFindUniqueMock.mockResolvedValue({ id: "profile-2" });

    await expect(
      googleSignup({ credential: "credential", username: "nayan-kunwar" }),
    ).rejects.toMatchObject({ code: "USERNAME_TAKEN" });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("does not create a second account for a linked Google subject", async () => {
    accountFindUniqueMock.mockResolvedValue({ id: "account-1" });

    await expect(
      googleSignup({ credential: "credential", username: "nayan-kunwar" }),
    ).rejects.toMatchObject({ code: "GOOGLE_ALREADY_LINKED" });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("sets a first password without asking for a current one", async () => {
    userUpdateMock.mockResolvedValue({});

    await expect(
      changePassword(
        { ...activeUser, passwordHash: null },
        undefined,
        "a-new-password-123",
        "session-1",
      ),
    ).resolves.toBeUndefined();

    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: activeUser.id },
      data: { passwordHash: expect.any(String) },
    });
    expect(executeRawMock).toHaveBeenCalled();
  });

  it("requires the current password when one already exists", async () => {
    await expect(
      changePassword(
        activeUser,
        undefined,
        "a-new-password-123",
        "session-1",
      ),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(userUpdateMock).not.toHaveBeenCalled();
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
