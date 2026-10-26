import { describe, expect, it } from "vitest";
import { buildServerErrorAlert } from "./alert-format";

describe("buildServerErrorAlert", () => {
  it("includes correlation fields without request body, IP, or error text", () => {
    const message = buildServerErrorAlert({
      requestId: "req-123",
      method: "POST",
      path: "/api/v1/auth/login",
      status: 500,
      code: "INTERNAL_ERROR",
      userId: "user-123",
      error: new Error("password=super-secret token=abc 203.0.113.9"),
    });

    expect(message.subject).toBe("[Link Hub] API 500 on /api/v1/auth/login");
    expect(message.text).toContain("Request ID: req-123");
    expect(message.text).toContain("Method: POST");
    expect(message.text).toContain("Status: 500");
    expect(message.text).toContain("Code: INTERNAL_ERROR");
    expect(message.text).toContain("Error: Error");
    expect(message.text).toContain("User ID: user-123");
    expect(message.text).not.toContain("super-secret");
    expect(message.text).not.toContain("203.0.113.9");
  });

  it("uses safe fallbacks when optional fields are absent", () => {
    const message = buildServerErrorAlert({
      method: "GET",
      path: "/api/v1/health",
      status: 503,
      code: "INTERNAL_ERROR",
      error: "not an Error",
    });

    expect(message.text).toContain("Request ID: unknown");
    expect(message.text).toContain("Error: UnknownError");
    expect(message.text).not.toContain("User ID:");
  });
});
