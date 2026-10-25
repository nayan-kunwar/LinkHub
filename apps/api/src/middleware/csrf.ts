import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { getCookie } from "../lib/http";
import { fail } from "../lib/errors";
import {
  randomToken,
  safeEqual,
  signCsrfToken,
  verifySignedCsrfToken,
} from "../lib/crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function issueCsrfToken(res: Response): string {
  const token = randomToken(32);
  const signed = signCsrfToken(token);
  res.cookie(env.csrfCookieName, signed, {
    httpOnly: false,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: env.sessionMaxAgeMs,
  });
  return token;
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieValue = getCookie(req, env.csrfCookieName);
  const cookieToken = verifySignedCsrfToken(cookieValue);
  const headerToken = req.header("x-csrf-token");

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    next(fail.csrf());
    return;
  }

  next();
}
