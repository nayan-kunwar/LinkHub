import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app";
import { env } from "./config/env";
import { disconnectDatabase } from "./lib/db";
import { closeSessionStore } from "./lib/session-store";

const app = createApp();

afterAll(async () => {
  await closeSessionStore();
  await disconnectDatabase();
});

describe("app assembly", () => {
  it("serves liveness without a database or session", async () => {
    const response = await request(app).get("/api/v1/health/live");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.version).toBe("2.4.0");
    expect(response.headers["x-request-id"]).toBeTruthy();
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("issues a signed, readable CSRF cookie without creating a session", async () => {
    const response = await request(app).get("/api/v1/auth/csrf");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.csrfToken).toMatch(/^[A-Za-z0-9_-]+$/);

    const cookies = response.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((cookie) => cookie.startsWith("lh.csrf="))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith("lh.sid="))).toBe(false);
  });

  it("rejects a non-GET request without a CSRF token", async () => {
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", env.appOrigin);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("CSRF_INVALID");
  });

  it("rejects a non-GET request from an untrusted origin", async () => {
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", "https://evil.example")
      .set("X-CSRF-Token", "anything");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_INVALID");
  });

  it("returns the envelope for unknown routes", async () => {
    const response = await request(app).get("/api/v1/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Not found." },
    });
  });

  it("always returns 204 for click beacons, including malformed bodies", async () => {
    const malformed = await request(app)
      .post("/api/v1/analytics/clicks")
      .set("Origin", env.appOrigin)
      .set("Content-Type", "text/plain")
      .send("not-json");

    expect(malformed.status).toBe(204);
    expect(malformed.text).toBe("");
    expect(malformed.headers["set-cookie"]).toBeUndefined();

    const invalid = await request(app)
      .post("/api/v1/analytics/clicks")
      .set("Origin", env.appOrigin)
      .set("Content-Type", "text/plain")
      .send(JSON.stringify({ linkId: "not-a-uuid" }));

    expect(invalid.status).toBe(204);
  });

  it("ignores click beacons from another origin", async () => {
    const response = await request(app)
      .post("/api/v1/analytics/clicks")
      .set("Origin", "https://evil.example")
      .set("Content-Type", "text/plain")
      .send(JSON.stringify({ linkId: "00000000-0000-4000-8000-000000000000" }));

    expect(response.status).toBe(204);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});
