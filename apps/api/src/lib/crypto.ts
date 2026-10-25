import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256(key: string, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

export function hmacBuffer(key: string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function safeEqualBuffer(left: Buffer, right: Buffer): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

const CSRF_CONTEXT = "linkhub-csrf-v1:";

export function signCsrfToken(token: string): string {
  return `${token}.${hmacSha256(env.SESSION_SECRET, `${CSRF_CONTEXT}${token}`)}`;
}

export function verifySignedCsrfToken(value: string | undefined): string | null {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const token = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!token || !signature) return null;
  const expected = hmacSha256(env.SESSION_SECRET, `${CSRF_CONTEXT}${token}`);
  return safeEqual(signature, expected) ? token : null;
}

/** Constant-time comparison of a web-tier proxy secret. */
export function matchesWebProxySecret(value: string | undefined): boolean {
  if (!value) return false;
  return safeEqual(value, env.WEB_PROXY_SECRET);
}

/** Constant-time comparison of the internal ISR fetch token. */
export function matchesInternalFetchToken(value: string | undefined): boolean {
  if (!value) return false;
  return safeEqual(value, env.INTERNAL_FETCH_TOKEN);
}

/**
 * The dedupe hash is keyed by a per-UTC-day key derived in memory, so a stored
 * hash cannot be linked across days. The raw IP and UA are never persisted.
 */
export function visitorHash(
  ip: string | undefined,
  userAgent: string | undefined,
  linkId: string,
  now = new Date(),
): string | null {
  if (!ip || !userAgent) return null;
  const day = now.toISOString().slice(0, 10);
  const dailyKey = hmacBuffer(env.ANALYTICS_HASH_SECRET, day);
  return createHmac("sha256", dailyKey)
    .update(`${ip}|${userAgent}|${linkId}`)
    .digest("hex");
}
