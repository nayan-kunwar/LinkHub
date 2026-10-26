import { Router } from "express";
import { sendData, sendNoContent, setPrivateNoStore } from "../../lib/http";
import { fail } from "../../lib/errors";
import { paramString } from "../../lib/validation";
import { validateBody } from "../../middleware/validate";
import { requireActiveUser, requireAuth } from "../../middleware/requireAuth";
import {
  accountDeleteLimiter,
  accountRestoreLimiter,
  emailChangeLimiter,
  passwordChangeLimiter,
} from "../../middleware/rateLimit";
import {
  cancelAccountDeletion,
  cancelPendingEmailChange,
  changePassword,
  deleteSession,
  listSessions,
  requestEmailChange,
  restoreAccount,
  revokeAllSessions,
  scheduleAccountDeletion,
} from "../auth/auth.service";
import { getAccount, getFullUser } from "./account.service";
import {
  changeEmailApiSchema,
  changePasswordApiSchema,
  deleteAccountApiSchema,
  restoreAccountApiSchema,
} from "./account.schema";

export const accountRouter = Router();

// Account responses contain PII and session metadata. Apply no-store to every
// account endpoint, including the public restore handler.
accountRouter.use((_req, res, next) => {
  setPrivateNoStore(res);
  next();
});

accountRouter.post(
  "/restore",
  accountRestoreLimiter,
  validateBody(restoreAccountApiSchema),
  async (req, res) => {
    await restoreAccount(req.body.token);
    sendData(res, { message: "Your account has been restored." });
  },
);

accountRouter.get("/", requireAuth, async (req, res) => {
  sendData(res, await getAccount(req.user!.id));
});

accountRouter.post(
  "/cancel-deletion",
  requireActiveUser,
  accountRestoreLimiter,
  async (req, res) => {
    await cancelAccountDeletion(req.user!.id);
    sendData(res, { deletionScheduledFor: null });
  },
);

accountRouter.patch(
  "/email",
  requireActiveUser,
  emailChangeLimiter,
  validateBody(changeEmailApiSchema),
  async (req, res) => {
    const result = await requestEmailChange(
      req.user!.id,
      req.body.email,
      req.body.currentPassword,
    );
    sendData(res, result);
  },
);

accountRouter.delete("/email", requireActiveUser, async (req, res) => {
  await cancelPendingEmailChange(req.user!.id);
  sendNoContent(res);
});

accountRouter.patch(
  "/password",
  requireActiveUser,
  passwordChangeLimiter,
  validateBody(changePasswordApiSchema),
  async (req, res) => {
    const user = await getFullUser(req.user!.id);
    await changePassword(
      user,
      req.body.currentPassword,
      req.body.newPassword,
      req.sessionID,
    );
    sendNoContent(res);
  },
);

accountRouter.get("/sessions", requireActiveUser, async (req, res) => {
  sendData(res, await listSessions(req.user!.id, req.sessionID));
});

accountRouter.delete("/sessions/:sid", requireActiveUser, async (req, res) => {
  const sid = paramString(req.params.sid);
  if (!sid) throw fail.notFound();
  if (sid === req.sessionID) {
    throw fail.validation("Use sign out to end the current session.");
  }
  await deleteSession(req.user!.id, sid);
  sendNoContent(res);
});

accountRouter.delete("/sessions", requireActiveUser, async (req, res) => {
  await revokeAllSessions(req.user!.id, req.sessionID);
  sendNoContent(res);
});

accountRouter.delete(
  "/",
  requireActiveUser,
  accountDeleteLimiter,
  validateBody(deleteAccountApiSchema),
  async (req, res) => {
    const user = await getFullUser(req.user!.id);
    const deletionScheduledFor = await scheduleAccountDeletion(
      user,
      req.body.password,
      req.body.confirmUsername,
      req.sessionID,
    );
    sendData(res, { deletionScheduledFor: deletionScheduledFor.toISOString() });
  },
);
