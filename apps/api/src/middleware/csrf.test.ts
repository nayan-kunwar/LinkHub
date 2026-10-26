import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { env } from "../config/env";
import { signCsrfToken } from "../lib/crypto";
import { csrfProtection } from "./csrf";

interface MockOptions {
  method?: string;
  sessionId?: string;
  userId?: string;
  cookieToken?: string;
  headerToken?: string;
}

function mockRequest(options: MockOptions): Request {
  const { method = "POST", sessionId = "", userId, cookieToken, headerToken } = options;
  return {
    method,
    sessionID: sessionId,
    session: userId ? { userId } : {},
    headers: {
      cookie: cookieToken ? `${env.csrfCookieName}=${cookieToken}` : undefined,
    },
    header(name: string) {
      return name.toLowerCase() === "x-csrf-token" ? headerToken : undefined;
    },
  } as unknown as Request;
}

function run(req: Request): unknown {
  let error: unknown;
  const next: NextFunction = (value?: unknown) => {
    error = value;
  };
  csrfProtection(req, {} as Response, next);
  return error;
}

describe("CSRF middleware session binding", () => {
  it("accepts a token bound to the authenticated session", () => {
    const token = "token-a";
    const error = run(
      mockRequest({
        userId: "user-1",
        sessionId: "session-a",
        cookieToken: signCsrfToken(token, "session-a"),
        headerToken: token,
      }),
    );

    expect(error).toBeUndefined();
  });

  it("rejects a token bound to another session", () => {
    const token = "token-a";
    const error = run(
      mockRequest({
        userId: "user-1",
        sessionId: "session-b",
        cookieToken: signCsrfToken(token, "session-a"),
        headerToken: token,
      }),
    );

    expect(error).toMatchObject({ code: "CSRF_INVALID" });
  });

  it("rejects a bound token once the session is gone", () => {
    const token = "token-a";
    const error = run(
      mockRequest({
        sessionId: "session-a",
        cookieToken: signCsrfToken(token, "session-a"),
        headerToken: token,
      }),
    );

    expect(error).toMatchObject({ code: "CSRF_INVALID" });
  });

  it("rejects an unbound token for an authenticated request", () => {
    const token = "token-a";
    const error = run(
      mockRequest({
        userId: "user-1",
        sessionId: "session-a",
        cookieToken: signCsrfToken(token),
        headerToken: token,
      }),
    );

    expect(error).toMatchObject({ code: "CSRF_INVALID" });
  });

  it("accepts an unbound token for an anonymous request", () => {
    const token = "token-a";
    const error = run(
      mockRequest({
        sessionId: "ephemeral-session",
        cookieToken: signCsrfToken(token),
        headerToken: token,
      }),
    );

    expect(error).toBeUndefined();
  });

  it("rejects a header that does not match the cookie token", () => {
    const error = run(
      mockRequest({
        userId: "user-1",
        sessionId: "session-a",
        cookieToken: signCsrfToken("token-a", "session-a"),
        headerToken: "token-b",
      }),
    );

    expect(error).toMatchObject({ code: "CSRF_INVALID" });
  });

  it("skips safe methods", () => {
    const error = run(mockRequest({ method: "GET" }));
    expect(error).toBeUndefined();
  });
});
