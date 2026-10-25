import { Router } from "express";
import { sendCreated, sendData, sendNoContent, setPrivateNoStore } from "../../lib/http";
import { parseUuidParam } from "../../lib/validation";
import { parseQuery, validateBody } from "../../middleware/validate";
import { requireActiveUser } from "../../middleware/requireAuth";
import { authenticatedApiLimiter } from "../../middleware/rateLimit";
import {
  createLinkApiSchema,
  linkStatusApiSchema,
  listLinksQuerySchema,
  reorderLinksApiSchema,
  updateLinkApiSchema,
} from "./links.schema";
import {
  createLink,
  deleteLink,
  getLink,
  listLinks,
  reorderLinks,
  setLinkStatus,
  updateLink,
} from "./links.service";

export const linksRouter = Router();

linksRouter.use(authenticatedApiLimiter, (_req, res, next) => {
  setPrivateNoStore(res);
  next();
});

linksRouter.get("/", requireActiveUser, async (req, res) => {
  const query = parseQuery(listLinksQuerySchema, req);
  sendData(res, await listLinks(req.user!.id, query));
});

linksRouter.post(
  "/",
  requireActiveUser,
  validateBody(createLinkApiSchema),
  async (req, res) => {
    sendCreated(res, await createLink(req.user!.id, req.user!.plan, req.body));
  },
);

linksRouter.put(
  "/reorder",
  requireActiveUser,
  validateBody(reorderLinksApiSchema),
  async (req, res) => {
    await reorderLinks(req.user!.id, req.body.ids, req.body.categoryId);
    sendNoContent(res);
  },
);

linksRouter.get("/:id", requireActiveUser, async (req, res) => {
  const id = parseUuidParam(req.params.id);
  sendData(res, await getLink(req.user!.id, id));
});

linksRouter.patch(
  "/:id",
  requireActiveUser,
  validateBody(updateLinkApiSchema),
  async (req, res) => {
    const id = parseUuidParam(req.params.id);
    sendData(res, await updateLink(req.user!.id, id, req.body));
  },
);

linksRouter.patch(
  "/:id/status",
  requireActiveUser,
  validateBody(linkStatusApiSchema),
  async (req, res) => {
    const id = parseUuidParam(req.params.id);
    sendData(res, await setLinkStatus(req.user!.id, id, req.body.isActive));
  },
);

linksRouter.delete("/:id", requireActiveUser, async (req, res) => {
  const id = parseUuidParam(req.params.id);
  await deleteLink(req.user!.id, id);
  sendNoContent(res);
});
