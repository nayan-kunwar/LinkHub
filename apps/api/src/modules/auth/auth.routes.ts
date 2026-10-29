import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import type { User } from "@prisma/client";
import { env } from "../../config/env";
import { audit } from "../../lib/audit";
import { sendData, sendNoContent, noStore } from "../../lib/http";
import { fail } from "../../lib/errors";
import { issueCsrfToken } from "../../middleware/csrf";
import { validateBody } from "../../middleware/validate";
import { requireActiveUser, requireAuth } from "../../middleware/requireAuth";
import {
  forgotPasswordLimiter,
  googleLinkLimiter,
  googleLoginLimiter,
  googleSignupLimiter,
  loginLimiter,
  registerLimiter,
  resendVerificationLimiter,
  verifyEmailLimiter,
} from "../../middleware/rateLimit";
import {
  createSessionForUser,
  destroySession,
  forgotPassword,
  getMe,
  googleLogin,
  googleSignup,
  linkGoogleAccount,
  login,
  register,
  resendVerification,
  resetPassword,
  restoreScheduledDeletion,
  unlinkGoogleAccount,
  verifyEmail,
  verifyEmailChange,
} from "./auth.service";
import {
  forgotPasswordSchema,
  googleAuthSchema,
  googleLinkSchema,
  googleSignupSchema,
  loginSchema,
  resetPasswordApiSchema,
  signupApiSchema,
  tokenSchema,
} from "./auth.schema";

export const authRouter = Router();

async function completeLogin(
  req: Request,
  res: Response,
  user: User,
  remember: boolean | undefined,
  method: "password" | "google",
): Promise<void> {
  await createSessionForUser(req, user.id, req.header("user-agent"), {
    remember,
  });
  audit({ action: "auth.login", actorUserId: user.id, metadata: { method } });
  // Only clear a scheduled deletion after the session is safely persisted.
  await restoreScheduledDeletion(user.id);
  const me = await getMe(user.id);
  const csrfToken = issueCsrfToken(req, res);
  noStore(res);
  sendData(res, { ...me, csrfToken });
}

function googleConfigured(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!env.GOOGLE_CLIENT_ID) {
    next(fail.googleSignInDisabled());
    return;
  }
  next();
}

authRouter.get("/csrf", (req, res) => {
  noStore(res);
  const csrfToken = issueCsrfToken(req, res);
  sendData(res, { csrfToken });
});

authRouter.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  async (req, res) => {
    const { remember, ...credentials } = req.body;
    const user = await login(credentials);
    await completeLogin(req, res, user, remember, "password");
  },
);

authRouter.post(
  "/google",
  googleConfigured,
  googleLoginLimiter,
  validateBody(googleAuthSchema),
  async (req, res) => {
    const result = await googleLogin(req.body.credential);
    if (result.status === "signup_required") {
      noStore(res);
      sendData(res, {
        signupRequired: true,
        email: result.email,
        displayName: result.displayName,
        suggestedUsername: result.suggestedUsername,
      });
      return;
    }
    await completeLogin(req, res, result.user, req.body.remember, "google");
  },
);

authRouter.post(
  "/google/signup",
  googleConfigured,
  (_req, _res, next) => {
    if (!env.ALLOW_SIGNUP) {
      next(fail.signupDisabled());
      return;
    }
    next();
  },
  googleSignupLimiter,
  validateBody(googleSignupSchema),
  async (req, res) => {
    const user = await googleSignup(req.body);
    await completeLogin(req, res, user, req.body.remember, "google");
  },
);

authRouter.post(
  "/google/link",
  requireAuth,
  requireActiveUser,
  googleConfigured,
  googleLinkLimiter,
  validateBody(googleLinkSchema),
  async (req, res) => {
    const connectedProviders = await linkGoogleAccount(
      req.user!.id,
      req.body.credential,
    );
    sendData(res, { connectedProviders });
  },
);

authRouter.delete(
  "/google",
  requireAuth,
  requireActiveUser,
  googleLinkLimiter,
  async (req, res) => {
    await unlinkGoogleAccount(req.user!.id);
    sendNoContent(res);
  },
);

authRouter.post("/logout", async (req, res) => {
  if (req.user) audit({ action: "auth.logout", actorUserId: req.user.id });
  await destroySession(req);
  res.clearCookie(env.sessionCookieName, {
    path: "/",
    secure: env.isProd,
    httpOnly: true,
    sameSite: "lax",
  });
  res.clearCookie(env.csrfCookieName, {
    path: "/",
    secure: env.isProd,
    httpOnly: false,
    sameSite: "lax",
  });
  sendNoContent(res);
});

authRouter.get("/me", requireAuth, async (req, res) => {
  noStore(res);
  sendData(res, await getMe(req.user!.id));
});

authRouter.post(
  "/register",
  registerLimiter,
  (_req, _res, next) => {
    if (!env.ALLOW_SIGNUP) {
      next(fail.signupDisabled());
      return;
    }
    next();
  },
  validateBody(signupApiSchema),
  async (req, res) => {
    const result = await register(req.body);
    res.status(201).json({ success: true, data: result });
  },
);

authRouter.post(
  "/verify-email",
  verifyEmailLimiter,
  validateBody(tokenSchema),
  async (req, res) => {
    await verifyEmail(req.body.token);
    sendData(res, { message: "Email verified." });
  },
);

authRouter.post(
  "/verify-email-change",
  verifyEmailLimiter,
  validateBody(tokenSchema),
  async (req, res) => {
    await verifyEmailChange(req.body.token);
    sendData(res, { message: "Email address updated." });
  },
);

authRouter.post(
  "/resend-verification",
  requireAuth,
  resendVerificationLimiter,
  async (req, res) => {
    await resendVerification(req.user!.id);
    sendData(res, { message: "If your email needs verification, a new link is on its way." });
  },
);

authRouter.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validateBody(forgotPasswordSchema),
  async (req, res) => {
    const result = await forgotPassword(req.body.email);
    sendData(res, result);
  },
);

authRouter.post(
  "/reset-password",
  verifyEmailLimiter,
  validateBody(resetPasswordApiSchema),
  async (req, res) => {
    await resetPassword(req.body.token, req.body.password);
    sendData(res, { message: "Your password has been updated. Sign in again." });
  },
);
