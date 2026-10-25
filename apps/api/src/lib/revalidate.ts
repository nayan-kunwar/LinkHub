import { env } from "../config/env";
import { hmacSha256 } from "./crypto";
import { logger } from "./logger";

const PROFILE_TAG = /^profile:[a-z0-9-]{3,30}$/;

export function profileTag(username: string): string {
  return `profile:${username.toLowerCase()}`;
}

export function validProfileTags(tags: string[]): string[] {
  return Array.from(new Set(tags.filter((tag) => PROFILE_TAG.test(tag)))).slice(0, 10);
}

/**
 * Awaited with a 3 s budget so a frozen web instance cannot silently drop the
 * request. The public page's 300 s ISR fallback heals any failure.
 */
export async function revalidateTags(tags: string[]): Promise<void> {
  const safeTags = validProfileTags(tags);
  if (safeTags.length === 0) return;

  const body = JSON.stringify({ tags: safeTags });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = hmacSha256(env.REVALIDATE_SECRET, `${timestamp}.${body}`);

  try {
    const response = await fetch(`${env.webInternalUrl}/internal/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Revalidate-Timestamp": timestamp,
        "X-Revalidate-Signature": signature,
      },
      body,
      signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok && response.status !== 204) {
      logger.warn(
        { status: response.status, tags: safeTags },
        "revalidation request was rejected",
      );
    }
  } catch (error) {
    logger.warn({ err: error, tags: safeTags }, "revalidation request failed");
  }
}

export function revalidateProfile(username: string): Promise<void> {
  return revalidateTags([profileTag(username)]);
}

export function revalidateProfileRename(previous: string, next: string): Promise<void> {
  return revalidateTags([profileTag(previous), profileTag(next)]);
}
