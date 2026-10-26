import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { Request, Response } from "express";
import { matchesInternalFetchToken } from "../lib/crypto";
import { fail } from "../lib/errors";

function ipKey(req: Request): string {
  return ipKeyGenerator(req.ip ?? "0.0.0.0");
}

function userKey(req: Request): string {
  return req.user ? `user:${req.user.id}` : ipKey(req);
}

function emailKey(req: Request): string {
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  return `${ipKey(req)}:${email}`;
}

function envelopeHandler(message = "Too many requests. Try again later.") {
  return (_req: Request, res: Response) => {
    const error = fail.rateLimited(message);
    res.status(error.status).json({
      success: false,
      error: { code: error.code, message: error.message },
    });
  };
}

const base = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  handler: envelopeHandler(),
};

export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: emailKey,
  skipSuccessfulRequests: true,
  handler: envelopeHandler("Too many sign-in attempts. Try again in 15 minutes."),
});

export const registerLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: ipKey,
});

export const forgotPasswordLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: emailKey,
  handler: envelopeHandler("Too many reset requests. Try again later."),
});

export const resendVerificationLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: userKey,
});

export const verifyEmailLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: ipKey,
});

export const emailChangeLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: userKey,
});

export const passwordChangeLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: userKey,
});

export const accountDeleteLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: userKey,
});

export const accountRestoreLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: ipKey,
});

export const availabilityLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: ipKey,
});

export const publicProfileLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: ipKey,
  skip: (req) => matchesInternalFetchToken(req.header("x-internal-token")),
});

export const clickLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: ipKey,
  handler: (_req, res) => {
    res.status(204).end();
  },
});

export const authenticatedApiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 300,
  keyGenerator: userKey,
});

export const contactLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: ipKey,
  handler: envelopeHandler("Too many messages. Try again later."),
});

export const exportLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: userKey,
  handler: envelopeHandler("You can export up to 5 times per hour."),
});
