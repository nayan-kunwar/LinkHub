import { Prisma, type Profile } from "@prisma/client";
import { audit } from "../../lib/audit";
import { prisma } from "../../lib/db";
import { profileDto, type ProfileDto } from "../../lib/dto";
import { fail } from "../../lib/errors";
import { revalidateProfile, revalidateProfileRename } from "../../lib/revalidate";
import {
  apiUsernameSchema,
  isReservedUsername,
} from "../../lib/validation";
import type { updateProfileApiSchema } from "./profile.schema";
import type { z } from "zod";

export type UpdateProfileInput = z.infer<typeof updateProfileApiSchema>;

export async function assertUsernameAvailable(
  username: string,
  currentUserId?: string,
): Promise<void> {
  if (isReservedUsername(username)) throw fail.usernameReserved();
  const owner = await prisma.profile.findUnique({
    where: { username },
    select: { userId: true },
  });
  if (owner && owner.userId !== currentUserId) throw fail.usernameTaken();
}

export async function getOwnProfile(userId: string): Promise<ProfileDto> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) throw fail.notFound();
  return profileDto(profile);
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<ProfileDto> {
  const current = await prisma.profile.findUnique({ where: { userId } });
  if (!current) throw fail.notFound();

  const usernameChanged =
    input.username !== undefined && input.username !== current.username;
  if (input.username !== undefined && usernameChanged) {
    await assertUsernameAvailable(input.username, userId);
  }

  const data: Prisma.ProfileUpdateInput = {};
  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.headline !== undefined) data.headline = input.headline;
  if (input.bio !== undefined) data.bio = input.bio;
  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;
  if (input.socials !== undefined) data.socials = input.socials as Prisma.InputJsonValue;
  if (input.appearance !== undefined) data.theme = input.appearance as Prisma.InputJsonValue;
  if (input.username !== undefined) data.username = input.username;

  let updated: Profile;
  try {
    updated = await prisma.profile.update({ where: { userId }, data });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw fail.usernameTaken();
    }
    throw error;
  }

  if (usernameChanged) {
    await revalidateProfileRename(current.username, updated.username);
    audit({
      action: "profile.username_changed",
      actorUserId: userId,
      metadata: { from: current.username, to: updated.username },
    });
  } else {
    await revalidateProfile(updated.username);
  }

  return profileDto(updated);
}

export async function setPublished(
  userId: string,
  isPublished: boolean,
): Promise<ProfileDto> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: { user: { select: { deletionScheduledFor: true } } },
  });
  if (!profile) throw fail.notFound();
  if (isPublished && profile.user.deletionScheduledFor) {
    throw fail.conflict(
      "This account is scheduled for deletion. Restore it before publishing your profile.",
    );
  }
  const updated = await prisma.profile.update({
    where: { userId },
    data: { isPublished },
  });
  await revalidateProfile(updated.username);
  audit({
    action: isPublished ? "profile.published" : "profile.unpublished",
    actorUserId: userId,
  });
  return profileDto(updated);
}

export interface AvailabilityResult {
  available: boolean;
  reason?: "reserved" | "taken" | "invalid";
}

export async function checkUsernameAvailability(
  input: string,
): Promise<AvailabilityResult> {
  const parsed = apiUsernameSchema.safeParse(input);
  if (!parsed.success) return { available: false, reason: "invalid" };
  const username = parsed.data;
  if (isReservedUsername(username)) return { available: false, reason: "reserved" };

  const owner = await prisma.profile.findUnique({
    where: { username },
    select: { id: true },
  });
  if (owner) return { available: false, reason: "taken" };
  return { available: true };
}
