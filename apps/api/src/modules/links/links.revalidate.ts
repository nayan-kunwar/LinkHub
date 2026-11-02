import { prisma } from "../../lib/db";
import { logger } from "../../lib/logger";
import { revalidateProfile } from "../../lib/revalidate";

export async function revalidateLinkOwner(userId: string): Promise<void> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { username: true },
  });
  if (profile) await revalidateProfile(profile.username);
}

/**
 * Link saves must never wait for the web app. Start revalidation in the
 * background, swallow failures, and let the 300 s ISR fallback heal the page.
 */
export function revalidateLinkOwnerInBackground(userId: string): void {
  void revalidateLinkOwner(userId).catch((error) => {
    logger.warn({ err: error, userId }, "link revalidation failed");
  });
}
