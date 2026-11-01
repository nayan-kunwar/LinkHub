import { prisma } from "../../lib/db";
import { revalidateProfile } from "../../lib/revalidate";

export async function revalidateLinkOwner(userId: string): Promise<void> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { username: true },
  });
  if (profile) await revalidateProfile(profile.username);
}
