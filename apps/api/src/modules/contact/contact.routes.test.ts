import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { findManyMock, sendContactEmailMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  sendContactEmailMock: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  prisma: { user: { findMany: findManyMock } },
  checkDatabase: vi.fn(),
}));

vi.mock("../../lib/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/mailer")>();
  return { ...actual, sendContactEmail: sendContactEmailMock };
});

import { createApp } from "../../app";
import { env } from "../../config/env";

const app = createApp();

async function csrf(agent: ReturnType<typeof request.agent>) {
  const response = await agent.get("/api/v1/auth/csrf");
  expect(response.status).toBe(200);
  return response.body.data.csrfToken as string;
}

describe("contact route", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    sendContactEmailMock.mockReset();
    findManyMock.mockResolvedValue([{ email: "owner@example.com" }]);
    sendContactEmailMock.mockResolvedValue(undefined);
  });

  it("requires a CSRF token", async () => {
    const response = await request(app)
      .post("/api/v1/contact")
      .set("Origin", env.appOrigin)
      .send({ topic: "support", message: "This should not be delivered." });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_INVALID");
    expect(sendContactEmailMock).not.toHaveBeenCalled();
  });

  it("forwards a report to every owner with the reporter reply-to", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);

    const response = await agent
      .post("/api/v1/contact")
      .set("Origin", env.appOrigin)
      .set("X-CSRF-Token", token)
      .send({
        topic: "abuse",
        username: "nayankunwar",
        email: "reporter@example.com",
        message: "This profile is impersonating someone.",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.message).toMatch(/received/i);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { role: "owner", deletedAt: null },
      select: { email: true },
    });
    expect(sendContactEmailMock).toHaveBeenCalledWith({
      to: "owner@example.com",
      topic: "abuse",
      username: "nayankunwar",
      reporterEmail: "reporter@example.com",
      message: "This profile is impersonating someone.",
    });
  });

  it("silently accepts honeypot submissions without sending mail", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);

    const response = await agent
      .post("/api/v1/contact")
      .set("Origin", env.appOrigin)
      .set("X-CSRF-Token", token)
      .send({
        topic: "support",
        message: "Buy cheap followers now.",
        website: "https://spam.example",
      });

    expect(response.status).toBe(200);
    expect(sendContactEmailMock).not.toHaveBeenCalled();
  });

  it("rejects a message that is too short", async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);

    const response = await agent
      .post("/api/v1/contact")
      .set("Origin", env.appOrigin)
      .set("X-CSRF-Token", token)
      .send({ topic: "support", message: "Help" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(sendContactEmailMock).not.toHaveBeenCalled();
  });
});
