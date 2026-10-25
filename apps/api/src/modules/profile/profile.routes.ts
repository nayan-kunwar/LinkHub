import { Router } from "express";
import { sendData, setPrivateNoStore } from "../../lib/http";
import { validateBody } from "../../middleware/validate";
import { requireActiveUser } from "../../middleware/requireAuth";
import { authenticatedApiLimiter } from "../../middleware/rateLimit";
import { updateProfileApiSchema } from "./profile.schema";
import {
  getOwnProfile,
  setPublished,
  updateProfile,
} from "./profile.service";

export const profileRouter = Router();

profileRouter.use(authenticatedApiLimiter, (_req, res, next) => {
  setPrivateNoStore(res);
  next();
});

profileRouter.get("/", requireActiveUser, async (req, res) => {
  sendData(res, await getOwnProfile(req.user!.id));
});

profileRouter.patch(
  "/",
  requireActiveUser,
  validateBody(updateProfileApiSchema),
  async (req, res) => {
    sendData(res, await updateProfile(req.user!.id, req.body));
  },
);

profileRouter.post("/publish", requireActiveUser, async (req, res) => {
  sendData(res, await setPublished(req.user!.id, true));
});

profileRouter.post("/unpublish", requireActiveUser, async (req, res) => {
  sendData(res, await setPublished(req.user!.id, false));
});
