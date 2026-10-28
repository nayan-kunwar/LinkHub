import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { accountFindUniqueMock, userFindUniqueMock, verifyGoogleCredentialMock } =
  vi.hoisted(() => ({
    accountFindUniqueMock: vi.fn(),
    userFindUniqueMock: vi.fn(),
    verifyGoogleCredentialMock: vi.fn(),
  }));

vi.mock("../../lib/db", () => ({
  prisma: {
    account: { findUnique: accountFindUniqueMock },
    user: { findUnique: userFindUniqueMock },
  },
  checkDatabase: vi.fn(),
}));

vi.mock("../../lib/google", () => ({
  verifyGoogleCredential: verifyGoogleCredentialMock,
}));

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

describe("Google auth routes", () => {
  beforeEach(() => {
    accountFindUniqueMock.mockReset();
    userFindUniqueMock.mockReset();
    verifyGoogleCredentialMock.mockReset();
    verifyGoogleCredentialMock.mockResolvedValue({
      sub: "google-sub-1",
      email: "owner@example.com",
    });
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

  it("returns GOOGLE_NOT_LINKED for an unlinked Google account", async () => {
    accountFindUniqueMock.mockResolvedValue(null);
    const agent = request.agent(app);
    const token = await csrf(agent);

    const response = await agent
      .post("/api/v1/auth/google")
      .set("Origin", env.appOrigin)
      .set("X-CSRF-Token", token)
      .send({ credential: "a".repeat(40), remember: true });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("GOOGLE_NOT_LINKED");
    expect(verifyGoogleCredentialMock).toHaveBeenCalledWith("a".repeat(40));
    expect(response.headers["set-cookie"]).toBeUndefined();
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
