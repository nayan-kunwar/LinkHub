import { Router } from "express";
import { env } from "../../config/env";
import { sendData, sendNoContent, noStore } from "../../lib/http";
import { fail } from "../../lib/errors";
import { issueCsrfToken } from "../../middleware/csrf";
import { validateBody } from "../../middleware/validate";
import { requireAuth } from "../../middleware/requireAuth";
import {
  forgotPasswordLimiter,
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
  login,
  register,
  resendVerification,
  resetPassword,
  restoreScheduledDeletion,
  verifyEmail,
  verifyEmailChange,
} from "./auth.service";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordApiSchema,
  signupApiSchema,
  tokenSchema,
} from "./auth.schema";

export const authRouter = Router();

authRouter.get("/csrf", (_req, res) => {
  noStore(res);
  const csrfToken = issueCsrfToken(res);
  sendData(res, { csrfToken });
});

authRouter.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  async (req, res) => {
    const { remember, ...credentials } = req.body;
    const user = await login(credentials);
    await createSessionForUser(req, user.id, req.header("user-agent"), {
      remember,
    });
    // Only clear a scheduled deletion after the session is safely persisted.
    await restoreScheduledDeletion(user.id);
    const me = await getMe(user.id);
    const csrfToken = issueCsrfToken(res);
    noStore(res);
    sendData(res, { ...me, csrfToken });
  },
);

authRouter.post("/logout", async (req, res) => {
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
