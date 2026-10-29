import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const {
  accountFindUniqueMock,
  userFindUniqueMock,
  userFindFirstMock,
  userUpdateManyMock,
  profileFindUniqueMock,
  transactionMock,
  txUserCreateMock,
  txProfileCreateMock,
  txAccountCreateMock,
  verifyGoogleCredentialMock,
} = vi.hoisted(() => ({
  accountFindUniqueMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userFindFirstMock: vi.fn(),
  userUpdateManyMock: vi.fn(),
  profileFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  txUserCreateMock: vi.fn(),
  txProfileCreateMock: vi.fn(),
  txAccountCreateMock: vi.fn(),
  verifyGoogleCredentialMock: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    account: { findUnique: accountFindUniqueMock },
    user: {
      findUnique: userFindUniqueMock,
      findFirst: userFindFirstMock,
      updateMany: userUpdateManyMock,
    },
    profile: { findUnique: profileFindUniqueMock },
    $transaction: transactionMock,
  },
  checkDatabase: vi.fn(),
}));

vi.mock("../../lib/google", () => ({
  verifyGoogleCredential: verifyGoogleCredentialMock,
}));

// The route test exercises session creation, but the real store is Postgres.
// An in-memory store keeps this test hermetic while preserving cookie behavior.
vi.mock("../../middleware/session", async () => {
  const session = (await import("express-session")).default;
  const { env } = await import("../../config/env");
  return {
    sessionMiddleware: session({
      name: env.sessionCookieName,
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
      },
    }),
  };
});

import { createApp } from "../../app";
import { env } from "../../config/env";
import { closeSessionStore } from "../../lib/session-store";

const app = createApp();

afterAll(async () => {
  await closeSessionStore();
});

async function csrf(agent: ReturnType<typeof request.agent>) {
  const response = await agent.get("/api/v1/auth/csrf");
  expect(response.status).toBe(200);
  return response.body.data.csrfToken as string;
}

const createdAt = new Date("2026-02-01T00:00:00.000Z");
const createdUser = {
  id: "user-new",
  email: "owner@example.com",
  pendingEmail: null,
  passwordHash: null,
  role: "user",
  status: "active",
  plan: "free",
  emailVerifiedAt: createdAt,
  deletionScheduledFor: null,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
};

const createdProfile = {
  id: "profile-new",
  userId: createdUser.id,
  username: "nayan-kunwar",
  displayName: "Nayan Kunwar",
  headline: "",
  bio: "",
  avatarUrl: null,
  socials: {},
  theme: {},
  isPublished: false,
  createdAt,
  updatedAt: createdAt,
};

describe("Google auth routes", () => {
  beforeEach(() => {
    accountFindUniqueMock.mockReset();
    userFindUniqueMock.mockReset();
    userFindFirstMock.mockReset();
    userUpdateManyMock.mockReset();
    profileFindUniqueMock.mockReset();
    transactionMock.mockReset();
    txUserCreateMock.mockReset();
    txProfileCreateMock.mockReset();
    txAccountCreateMock.mockReset();
    verifyGoogleCredentialMock.mockReset();

    verifyGoogleCredentialMock.mockResolvedValue({
      sub: "google-sub-1",
      email: "owner@example.com",
      name: "Nayan Kunwar",
    });
    userFindFirstMock.mockResolvedValue(null);
    profileFindUniqueMock.mockResolvedValue(null);
    userUpdateManyMock.mockResolvedValue({ count: 0 });
    transactionMock.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          user: { create: txUserCreateMock },
          profile: { create: txProfileCreateMock },
          account: { create: txAccountCreateMock },
        }),
    );
  });

  it("requires CSRF and Origin on Google sign-in", async () => {
    const response = await request(app)
      .post("/api/v1/auth/google")
      .set("Origin", env.appOrigin)
      .send({ credential: "a".repeat(40) });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_INVALID");
    expect(verifyGoogleCredentialMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed credential before verification", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);

    const response = await agent
      .post("/api/v1/auth/google")
      .set("Origin", env.appOrigin)
      .set("X-CSRF-Token", token)
      .send({ credential: "short" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(verifyGoogleCredentialMock).not.toHaveBeenCalled();
  });

  it("returns claim data instead of a session for an unlinked Google identity", async () => {
    accountFindUniqueMock.mockResolvedValue(null);
    const agent = request.agent(app);
    const token = await csrf(agent);

    const response = await agent
      .post("/api/v1/auth/google")
      .set("Origin", env.appOrigin)
      .set("X-CSRF-Token", token)
      .send({ credential: "a".repeat(40), remember: true });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      signupRequired: true,
      email: "owner@example.com",
      displayName: "Nayan Kunwar",
      suggestedUsername: "nayan-kunwar",
    });
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(verifyGoogleCredentialMock).toHaveBeenCalledWith("a".repeat(40));
  });

  it("refuses to auto-link a Google email that already has an account", async () => {
    accountFindUniqueMock.mockResolvedValue(null);
    userFindFirstMock.mockResolvedValue({ id: "user-existing" });
    const agent = request.agent(app);
    const token = await csrf(agent);

    const response = await agent
      .post("/api/v1/auth/google")
      .set("Origin", env.appOrigin)
      .set("X-CSRF-Token", token)
      .send({ credential: "a".repeat(40) });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("GOOGLE_ACCOUNT_EXISTS");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("requires CSRF and a valid username on Google sign-up", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);

    const noCsrf = await agent
      .post("/api/v1/auth/google/signup")
      .set("Origin", env.appOrigin)
      .send({ credential: "a".repeat(40), username: "nayan-kunwar" });

    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toBe("CSRF_INVALID");

    const invalid = await agent
      .post("/api/v1/auth/google/signup")
      .set("Origin", env.appOrigin)
      .set("X-CSRF-Token", token)
      .send({ credential: "a".repeat(40), username: "a" });

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects a username that is already claimed", async () => {
    accountFindUniqueMock.mockResolvedValue(null);
    profileFindUniqueMock.mockResolvedValue({ id: "profile-taken" });
    const agent = request.agent(app);
    const token = await csrf(agent);

    const response = await agent
      .post("/api/v1/auth/google/signup")
      .set("Origin", env.appOrigin)
      .set("X-CSRF-Token", token)
      .send({ credential: "a".repeat(40), username: "nayan-kunwar" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("USERNAME_TAKEN");
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("creates the account, links Google, and starts a session", async () => {
    accountFindUniqueMock.mockResolvedValue(null);
    txUserCreateMock.mockResolvedValue(createdUser);
    txProfileCreateMock.mockResolvedValue(createdProfile);
    txAccountCreateMock.mockResolvedValue({ id: "account-new" });
    userFindUniqueMock.mockResolvedValue({
      ...createdUser,
      profile: createdProfile,
    });
    const agent = request.agent(app);
    const token = await csrf(agent);

    const response = await agent
      .post("/api/v1/auth/google/signup")
      .set("Origin", env.appOrigin)
      .set("X-CSRF-Token", token)
      .send({
        credential: "a".repeat(40),
        username: "nayan-kunwar",
        remember: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      id: createdUser.id,
      email: createdUser.email,
      emailVerified: true,
    });
    expect(response.body.data.profile).toMatchObject({
      username: "nayan-kunwar",
      displayName: "Nayan Kunwar",
    });
    expect(response.body.data.csrfToken).toEqual(expect.any(String));
    expect(txUserCreateMock).toHaveBeenCalledWith({
      data: {
        email: createdUser.email,
        status: "active",
        emailVerifiedAt: expect.any(Date),
      },
    });
    expect(txAccountCreateMock).toHaveBeenCalledWith({
      data: {
        userId: createdUser.id,
        provider: "google",
        providerAccountId: "google-sub-1",
      },
    });
    const cookies = String(response.headers["set-cookie"] ?? "");
    expect(cookies).toContain(`${env.sessionCookieName}=`);
    expect(cookies).toContain(
      `Max-Age=${Math.floor(env.sessionMaxAgeMs / 1000)}`,
    );
  });

  it("requires authentication before linking or unlinking Google", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);

    const link = await agent
      .post("/api/v1/auth/google/link")
      .set("Origin", env.appOrigin)
      .set("X-CSRF-Token", token)
      .send({ credential: "a".repeat(40) });

    expect(link.status).toBe(401);
    expect(link.body.error.code).toBe("UNAUTHENTICATED");

    const unlink = await agent
      .delete("/api/v1/auth/google")
      .set("Origin", env.appOrigin)
      .set("X-CSRF-Token", token);

    expect(unlink.status).toBe(401);
    expect(unlink.body.error.code).toBe("UNAUTHENTICATED");
  });
});
