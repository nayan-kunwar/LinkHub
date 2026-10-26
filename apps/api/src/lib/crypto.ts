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

const CSRF_CONTEXT = "linkhub-csrf-v2:";

/**
 * CSRF signatures are bound to the current session ID when one exists, so a
 * token minted for another session cannot satisfy the double-submit check.
 * Anonymous tokens use an empty binding because no session exists yet.
 */
function csrfSignature(token: string, sessionId: string | null | undefined): string {
  return hmacSha256(
    env.SESSION_SECRET,
    `${CSRF_CONTEXT}${sessionId ?? ""}:${token}`,
  );
}

export function signCsrfToken(
  token: string,
  sessionId?: string | null,
): string {
  return `${token}.${csrfSignature(token, sessionId)}`;
}

export function verifySignedCsrfToken(
  value: string | undefined,
  sessionId?: string | null,
): string | null {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const token = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!token || !signature) return null;
  return safeEqual(signature, csrfSignature(token, sessionId)) ? token : null;
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
