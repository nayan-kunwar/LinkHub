import { describe, expect, it } from "vitest";
import {
  matchesWebProxySecret,
  randomToken,
  safeEqual,
  signCsrfToken,
  verifySignedCsrfToken,
  visitorHash,
} from "./crypto";

describe("CSRF signing", () => {
  it("round-trips a token bound to its session", () => {
    const token = randomToken(16);
    const signed = signCsrfToken(token, "session-a");
    expect(signed.startsWith(`${token}.`)).toBe(true);
    expect(verifySignedCsrfToken(signed, "session-a")).toBe(token);
  });

  it("rejects a token bound to another session", () => {
    const token = randomToken(16);
    const signed = signCsrfToken(token, "session-a");
    expect(verifySignedCsrfToken(signed, "session-b")).toBeNull();
    expect(verifySignedCsrfToken(signed)).toBeNull();
  });

  it("keeps anonymous tokens unbound", () => {
    const token = randomToken(16);
    const signed = signCsrfToken(token);
    expect(verifySignedCsrfToken(signed)).toBe(token);
    expect(verifySignedCsrfToken(signed, "session-a")).toBeNull();
  });

  it("rejects tampered or malformed values", () => {
    const token = randomToken(16);
    const signed = signCsrfToken(token, "session-a");
    expect(verifySignedCsrfToken(`${signed}x`, "session-a")).toBeNull();
    expect(verifySignedCsrfToken("garbage", "session-a")).toBeNull();
    expect(verifySignedCsrfToken(undefined, "session-a")).toBeNull();
  });
});

describe("constant-time comparisons", () => {
  it("compares equal strings and rejects different ones", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });

  it("only accepts the configured web proxy secret", () => {
    expect(matchesWebProxySecret("test-web-proxy-secret-0123456789abcdef012")).toBe(
      true,
    );
    expect(matchesWebProxySecret("wrong")).toBe(false);
    expect(matchesWebProxySecret(undefined)).toBe(false);
  });
});

describe("visitor dedupe hashes", () => {
  const now = new Date("2026-10-26T12:00:00.000Z");

  it("is stable for the same visitor, link and UTC day", () => {
    const first = visitorHash("203.0.113.4", "Test UA", "link-1", now);
    const second = visitorHash("203.0.113.4", "Test UA", "link-1", now);
    expect(first).not.toBeNull();
    expect(first).toBe(second);
  });

  it("is scoped to the link and the UTC day", () => {
    const base = visitorHash("203.0.113.4", "Test UA", "link-1", now);
    expect(visitorHash("203.0.113.4", "Test UA", "link-2", now)).not.toBe(base);
    expect(
      visitorHash("203.0.113.4", "Test UA", "link-1", new Date("2026-10-27T00:00:01.000Z")),
    ).not.toBe(base);
  });

  it("returns null when the IP or user agent is missing", () => {
    expect(visitorHash(undefined, "Test UA", "link-1", now)).toBeNull();
    expect(visitorHash("203.0.113.4", undefined, "link-1", now)).toBeNull();
  });
});
