import type { NextFunction, Request, Response } from "express";
import { fail } from "../lib/errors";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(fail.unauthenticated());
    return;
  }
  next();
}

export function requireActiveUser(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(fail.unauthenticated());
    return;
  }
  if (req.user.status !== "active") {
    next(fail.emailNotVerified());
    return;
  }
  next();
}

export function requireOwner(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(fail.unauthenticated());
    return;
  }
  if (req.user.role !== "owner" && req.user.role !== "admin") {
    next(fail.notFound());
    return;
  }
  next();
}
