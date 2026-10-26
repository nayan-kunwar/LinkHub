import { Prisma, type TokenType, type User } from "@prisma/client";
import type { Request } from "express";
import { env } from "../../config/env";
import { prisma } from "../../lib/db";
import { DEFAULT_APPEARANCE, meDto, type MeDto } from "../../lib/dto";
import { fail } from "../../lib/errors";
import { logger } from "../../lib/logger";
import {
  sendAccountRestoreEmail,
  sendEmailChangeVerification,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../../lib/mailer";
import { dummyVerify, hashPassword, verifyPassword } from "../../lib/password";
import { revalidateProfile } from "../../lib/revalidate";
import { isReservedUsername } from "../../lib/validation";
import { randomToken, sha256 } from "../../lib/crypto";
import type { LoginInput, SignupInput } from "./auth.schema";

const GENERIC_REGISTER_RESPONSE = {
  message: "Check your inbox for a verification link.",
};
const GENERIC_RESET_RESPONSE = {
  message: "If that address belongs to an account, a reset link is on its way.",
};
const GENERIC_EMAIL_CHANGE_RESPONSE = {
  message: "If that address is available, a verification link is on its way.",
};

function tokenTtl(type: TokenType): number {
  switch (type) {
    case "email_verification":
    case "email_change":
      return env.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000;
    case "password_reset":
      return env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000;
    case "account_restore":
      return env.ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;
  }
}

async function issueToken(
  tx: Prisma.TransactionClient,
  userId: string,
  type: TokenType,
): Promise<string> {
  const raw = randomToken(32);
  const tokenHash = sha256(raw);
  await tx.verificationToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
  await tx.verificationToken.create({
    data: {
      userId,
      type,
      tokenHash,
      expiresAt: new Date(Date.now() + tokenTtl(type)),
    },
  });
  return raw;
}

async function consumeToken(raw: string, type: TokenType) {
  const tokenHash = sha256(raw);
  const token = await prisma.verificationToken.findUnique({ where: { tokenHash } });
  if (!token || token.type !== type) throw fail.tokenInvalid();
  if (token.usedAt) throw fail.tokenInvalid();
  if (token.expiresAt.getTime() <= Date.now()) throw fail.tokenExpired();

  const consumed = await prisma.verificationToken.updateMany({
    where: {
      id: token.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });

  if (consumed.count !== 1) throw fail.tokenInvalid();
  return token;
}

function isUniqueError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export async function register(input: SignupInput) {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  if (isReservedUsername(username)) throw fail.usernameReserved();

  const usernameOwner = await prisma.profile.findUnique({ where: { username } });
  if (usernameOwner) throw fail.usernameTaken();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return GENERIC_REGISTER_RESPONSE;

  let rawToken: string;
  try {
    rawToken = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          status: "pending_verification",
        },
      });
      await tx.profile.create({
        data: {
          userId: user.id,
          username,
          displayName: input.displayName.trim(),
          theme: DEFAULT_APPEARANCE as unknown as Prisma.InputJsonValue,
          socials: {},
          isPublished: false,
        },
      });
      return issueToken(tx, user.id, "email_verification");
    });
  } catch (error) {
    if (isUniqueError(error)) {
      const target = String(error.meta?.target ?? "");
      if (target.includes("username")) throw fail.usernameTaken();
      return GENERIC_REGISTER_RESPONSE;
    }
    throw error;
  }

  try {
    await sendVerificationEmail(email, rawToken);
  } catch (error) {
    logger.error({ err: error, userId: undefined }, "verification email failed");
  }

  return GENERIC_REGISTER_RESPONSE;
}

export async function login(input: LoginInput): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    await dummyVerify(input.password);
    throw fail.invalidCredentials();
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) throw fail.invalidCredentials();

  if (user.status === "deleted" || user.deletedAt) {
    throw fail.invalidCredentials();
  }
  if (user.status === "suspended") {
    throw fail.suspended();
  }

  if (user.deletionScheduledFor) {
    return prisma.user.update({
      where: { id: user.id },
      data: { deletionScheduledFor: null },
    });
  }

  return user;
}

export async function getMe(userId: string): Promise<MeDto> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || user.status === "deleted" || user.deletedAt) {
    throw fail.unauthenticated();
  }
  return meDto(user, user.profile);
}

export async function verifyEmail(rawToken: string): Promise<void> {
  const token = await consumeToken(rawToken, "email_verification");
  const user = await prisma.user.findUnique({ where: { id: token.userId } });
  if (!user || user.status === "deleted" || user.deletedAt) throw fail.tokenInvalid();
  if (user.status === "suspended") throw fail.suspended();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      status: "active",
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });
}

export async function verifyEmailChange(rawToken: string): Promise<void> {
  const token = await consumeToken(rawToken, "email_change");
  const user = await prisma.user.findUnique({ where: { id: token.userId } });
  if (!user || !user.pendingEmail) throw fail.tokenInvalid();

  const target = user.pendingEmail;
  const conflict = await prisma.user.findFirst({
    where: {
      id: { not: user.id },
      OR: [{ email: target }, { pendingEmail: target }],
    },
    select: { id: true },
  });
  if (conflict) throw fail.conflict("That email address is no longer available.");

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: target,
        pendingEmail: null,
        emailVerifiedAt: new Date(),
      },
    });
  } catch (error) {
    if (isUniqueError(error)) {
      throw fail.conflict("That email address is no longer available.");
    }
    throw error;
  }
}

export async function resendVerification(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "pending_verification") return;

  const rawToken = await prisma.$transaction((tx) =>
    issueToken(tx, user.id, "email_verification"),
  );
  try {
    await sendVerificationEmail(user.email, rawToken);
  } catch (error) {
    logger.error({ err: error, userId: user.id }, "resend verification email failed");
  }
}

export async function forgotPassword(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "active" || user.deletedAt) {
    return GENERIC_RESET_RESPONSE;
  }

  const rawToken = await prisma.$transaction((tx) =>
    issueToken(tx, user.id, "password_reset"),
  );
  try {
    await sendPasswordResetEmail(user.email, rawToken);
  } catch (error) {
    logger.error({ err: error, userId: user.id }, "password reset email failed");
  }
  return GENERIC_RESET_RESPONSE;
}

export async function resetPassword(rawToken: string, password: string): Promise<void> {
  const token = await consumeToken(rawToken, "password_reset");
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.findUnique({
    where: { id: token.userId },
    select: { status: true },
  });
  if (!user) throw fail.tokenInvalid();

  await prisma.user.update({
    where: { id: token.userId },
    data: {
      passwordHash,
      ...(user.status === "pending_verification"
        ? { status: "active", emailVerifiedAt: new Date() }
        : {}),
    },
  });

  await revokeAllSessions(token.userId);
}

export async function createSessionForUser(
  req: Request,
  userId: string,
  userAgent: string | undefined,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
  const now = new Date().toISOString();
  req.session.userId = userId;
  req.session.userAgent = (userAgent ?? "Unknown device").slice(0, 512);
  req.session.createdAt = now;
  req.session.lastSeenAt = now;
  await new Promise<void>((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

export async function destroySession(req: Request): Promise<void> {
  await new Promise<void>((resolve) => {
    req.session.destroy(() => resolve());
  });
}

export async function revokeAllSessions(userId: string, exceptSid?: string): Promise<void> {
  if (exceptSid) {
    await prisma.$executeRaw`DELETE FROM sessions WHERE sess->>'userId' = ${userId} AND sid <> ${exceptSid}`;
    return;
  }
  await prisma.$executeRaw`DELETE FROM sessions WHERE sess->>'userId' = ${userId}`;
}

export interface SessionSummaryDto {
  id: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

interface SessionRow {
  sid: string;
  sess: unknown;
  expire: Date;
}

export async function listSessions(
  userId: string,
  currentSid: string,
): Promise<SessionSummaryDto[]> {
  const rows = await prisma.$queryRaw<SessionRow[]>`
    SELECT sid, sess, expire
    FROM sessions
    WHERE sess->>'userId' = ${userId}
      AND expire > now()
    ORDER BY COALESCE((sess->>'lastSeenAt')::timestamptz, (sess->>'createdAt')::timestamptz) DESC NULLS LAST
  `;

  return rows.map((row) => {
    const sess = (
      typeof row.sess === "string" ? JSON.parse(row.sess) : row.sess
    ) as Record<string, unknown>;
    const createdAt =
      typeof sess.createdAt === "string" ? sess.createdAt : new Date(0).toISOString();
    return {
      id: row.sid,
      userAgent:
        typeof sess.userAgent === "string" && sess.userAgent
          ? sess.userAgent
          : "Unknown device",
      createdAt,
      lastSeenAt:
        typeof sess.lastSeenAt === "string" ? sess.lastSeenAt : createdAt,
      current: row.sid === currentSid,
    };
  });
}

export async function deleteSession(userId: string, sid: string): Promise<void> {
  const count = await prisma.$executeRaw`
    DELETE FROM sessions
    WHERE sid = ${sid} AND sess->>'userId' = ${userId}
  `;
  if (count === 0) throw fail.notFound();
}

export async function scheduleAccountDeletion(
  user: User,
  password: string,
  confirmUsername: string,
  currentSid: string,
): Promise<Date> {
  if (user.deletionScheduledFor) return user.deletionScheduledFor;

  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    throw fail.invalidCredentials("Password is incorrect.");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { username: true },
  });
  if (!profile) throw fail.conflict("Your profile is missing.");
  if (confirmUsername.trim().toLowerCase() !== profile.username.toLowerCase()) {
    throw fail.validation("Type your username exactly to confirm deletion.");
  }

  const scheduledFor = new Date(
    Date.now() + env.ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
  );

  const rawToken = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { deletionScheduledFor: scheduledFor },
    });
    await tx.profile.update({
      where: { userId: user.id },
      data: { isPublished: false },
    });
    await tx.$executeRaw`DELETE FROM sessions WHERE sess->>'userId' = ${user.id} AND sid <> ${currentSid}`;
    return issueToken(tx, user.id, "account_restore");
  });

  try {
    await sendAccountRestoreEmail(user.email, rawToken);
  } catch (error) {
    logger.error({ err: error, userId: user.id }, "account restore email failed");
  }

  // Unpublishing the profile changes the public page immediately.
  await revalidateProfile(profile.username);

  return scheduledFor;
}

export async function restoreAccount(rawToken: string): Promise<void> {
  const token = await consumeToken(rawToken, "account_restore");
  await prisma.user.update({
    where: { id: token.userId },
    data: { deletionScheduledFor: null },
  });
}

/**
 * Authenticated restore for owners who are already signed in. Signing in also
 * clears the deletion flag, but the settings/profile screens let an active
 * session cancel it without a round-trip through email.
 */
export async function cancelAccountDeletion(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deletionScheduledFor: true },
  });
  if (!user) throw fail.unauthenticated();
  if (!user.deletionScheduledFor) return;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { deletionScheduledFor: null },
    });
    await tx.verificationToken.updateMany({
      where: { userId, type: "account_restore", usedAt: null },
      data: { usedAt: new Date() },
    });
  });
}

export async function requestEmailChange(
  userId: string,
  emailInput: string,
  currentPassword: string,
): Promise<typeof GENERIC_EMAIL_CHANGE_RESPONSE> {
  const email = emailInput.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw fail.unauthenticated();
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
    throw fail.invalidCredentials("Current password is incorrect.");
  }

  if (email === user.email.toLowerCase()) return GENERIC_EMAIL_CHANGE_RESPONSE;

  const conflict = await prisma.user.findFirst({
    where: {
      id: { not: userId },
      OR: [{ email }, { pendingEmail: email }],
    },
    select: { id: true },
  });
  if (conflict) return GENERIC_EMAIL_CHANGE_RESPONSE;

  let rawToken: string;
  try {
    rawToken = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { pendingEmail: email },
      });
      return issueToken(tx, userId, "email_change");
    });
  } catch (error) {
    if (isUniqueError(error)) return GENERIC_EMAIL_CHANGE_RESPONSE;
    throw error;
  }

  try {
    await sendEmailChangeVerification(email, rawToken);
  } catch (error) {
    logger.error({ err: error, userId }, "email change verification failed");
  }
  return GENERIC_EMAIL_CHANGE_RESPONSE;
}

export async function cancelPendingEmailChange(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { pendingEmail: null },
    });
    await tx.verificationToken.updateMany({
      where: { userId, type: "email_change", usedAt: null },
      data: { usedAt: new Date() },
    });
  });
}

export async function changePassword(
  user: User,
  currentPassword: string,
  newPassword: string,
  currentSid: string,
): Promise<void> {
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
    throw fail.invalidCredentials("Current password is incorrect.");
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  await revokeAllSessions(user.id, currentSid);
}
