import { Router } from "express";
import { sendCreated, sendData, sendNoContent, setPrivateNoStore } from "../../lib/http";
import { parseUuidParam } from "../../lib/validation";
import { validateBody } from "../../middleware/validate";
import { requireActiveUser } from "../../middleware/requireAuth";
import { authenticatedApiLimiter } from "../../middleware/rateLimit";
import {
  createCategoryApiSchema,
  reorderCategoriesApiSchema,
  updateCategoryApiSchema,
} from "./categories.schema";
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  reorderCategories,
  updateCategory,
} from "./categories.service";

export const categoriesRouter = Router();

categoriesRouter.use(authenticatedApiLimiter, (_req, res, next) => {
  setPrivateNoStore(res);
  next();
});

categoriesRouter.get("/", requireActiveUser, async (req, res) => {
  sendData(res, await listCategories(req.user!.id));
});

categoriesRouter.post(
  "/",
  requireActiveUser,
  validateBody(createCategoryApiSchema),
  async (req, res) => {
    sendCreated(
      res,
      await createCategory(req.user!.id, req.user!.plan, req.body),
    );
  },
);

categoriesRouter.put(
  "/reorder",
  requireActiveUser,
  validateBody(reorderCategoriesApiSchema),
  async (req, res) => {
    await reorderCategories(req.user!.id, req.body.ids);
    sendNoContent(res);
  },
);

categoriesRouter.get("/:id", requireActiveUser, async (req, res) => {
  const id = parseUuidParam(req.params.id);
  sendData(res, await getCategory(req.user!.id, id));
});

categoriesRouter.patch(
  "/:id",
  requireActiveUser,
  validateBody(updateCategoryApiSchema),
  async (req, res) => {
    const id = parseUuidParam(req.params.id);
    sendData(res, await updateCategory(req.user!.id, id, req.body));
  },
);

categoriesRouter.delete("/:id", requireActiveUser, async (req, res) => {
  const id = parseUuidParam(req.params.id);
  await deleteCategory(req.user!.id, id);
  sendNoContent(res);
});
