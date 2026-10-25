import type { Plan, Role, UserStatus } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  plan: Plan;
  emailVerifiedAt: Date | null;
  deletionScheduledFor: Date | null;
  profile: {
    id: string;
    username: string;
    displayName: string;
    isPublished: boolean;
  } | null;
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userAgent?: string;
    createdAt?: string;
    lastSeenAt?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: SessionUser;
    }
  }
}

export {};
