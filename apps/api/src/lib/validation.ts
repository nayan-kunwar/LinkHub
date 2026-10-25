import { z } from "zod";
import { RESERVED_USERNAMES, USERNAME_REGEX } from "@linkhub/shared";

export function paramString(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseUuidParam(value: string | string[] | undefined): string {
  return z.uuid().parse(paramString(value) ?? "");
}

export const apiUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Usernames need at least 3 characters.")
  .max(30, "Usernames can be at most 30 characters.")
  .regex(
    USERNAME_REGEX,
    "Use lowercase letters, numbers and hyphens; start and end with a letter or number.",
  );

/**
 * Reserved names are rejected by the service layer so callers receive a
 * specific 409 USERNAME_RESERVED instead of a generic field validation error.
 */
export function isReservedUsername(username: string): boolean {
  return (RESERVED_USERNAMES as readonly string[]).includes(
    username.trim().toLowerCase(),
  );
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/i,
  /^\[?::\]?$/i,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /^\[?fe[89ab][0-9a-f]:/i,
  /^\[?::ffff:127\./i,
  /^metadata\.google\.internal$/i,
];

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (!url.hostname.includes(".")) return false;
    if (isPrivateHost(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function isSafeLinkUrl(value: string): boolean {
  if (/^mailto:/i.test(value)) {
    return /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
  }
  return isSafeHttpUrl(value);
}

export const safeLinkUrlSchema = z
  .string()
  .trim()
  .min(1, "Add a destination URL.")
  .max(2048, "Keep the URL under 2048 characters.")
  .refine(isSafeLinkUrl, "Use a public http://, https:// or mailto: link.");

export const optionalSafeHttpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value === "" || (value.startsWith("https://") && isSafeHttpUrl(value)),
    "Enter a public https:// URL.",
  );

export const safeSocialsSchema = z.object({
  website: optionalSafeHttpsUrlSchema,
  github: optionalSafeHttpsUrlSchema,
  linkedin: optionalSafeHttpsUrlSchema,
  x: optionalSafeHttpsUrlSchema,
  medium: optionalSafeHttpsUrlSchema,
  email: z
    .string()
    .trim()
    .max(254)
    .refine(
      (value) => value === "" || /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
      "Use a mailto: link, for example mailto:you@example.com.",
    ),
});
