import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { prisma } from "../lib/db";
import { fail } from "../lib/errors";
import type { SessionUser } from "../types/express";

const PENDING_ALLOWED_PATHS = new Set([
  "/api/v1/auth/me",
  "/api/v1/auth/logout",
  "/api/v1/auth/csrf",
  "/api/v1/auth/login",
  "/api/v1/auth/resend-verification",
  "/api/v1/account/restore",
]);

const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1000;

function destroySession(req: Request, res: Response): Promise<void> {
  return new Promise((resolve) => {
    req.session.destroy(() => {
      res.clearCookie(env.sessionCookieName, {
        path: "/",
        secure: env.isProd,
        httpOnly: true,
        sameSite: "lax",
      });
      resolve();
    });
  });
}

export async function loadUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.session.userId;
  if (!userId) {
    next();
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      plan: true,
      emailVerifiedAt: true,
      deletionScheduledFor: true,
      deletedAt: true,
      profile: {
        select: {
          id: true,
          username: true,
          displayName: true,
          isPublished: true,
        },
      },
    },
  });

  if (!user || user.status === "deleted" || user.deletedAt) {
    await destroySession(req, res);
    next();
    return;
  }

  if (user.status === "suspended") {
    await destroySession(req, res);
    next(fail.suspended());
    return;
  }

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    plan: user.plan,
    emailVerifiedAt: user.emailVerifiedAt,
    deletionScheduledFor: user.deletionScheduledFor,
    profile: user.profile,
  };
  req.user = sessionUser;

  if (user.status === "pending_verification") {
    const path = req.originalUrl.split("?")[0];
    if (!PENDING_ALLOWED_PATHS.has(path)) {
      next(fail.emailNotVerified());
      return;
    }
  }

  const lastSeen = req.session.lastSeenAt ? Date.parse(req.session.lastSeenAt) : 0;
  if (!Number.isFinite(lastSeen) || Date.now() - lastSeen > LAST_SEEN_WRITE_INTERVAL_MS) {
    req.session.lastSeenAt = new Date().toISOString();
  }

  next();
}
