import { Router } from "express";
import { setPrivateNoStore } from "../../lib/http";
import { parseQuery } from "../../middleware/validate";
import { requireActiveUser } from "../../middleware/requireAuth";
import { exportLimiter } from "../../middleware/rateLimit";
import { buildExport } from "./export.service";
import { exportQuerySchema, parseExportOptions } from "./export.schema";

export const exportRouter = Router();

exportRouter.get(
  "/",
  requireActiveUser,
  exportLimiter,
  async (req, res) => {
    const query = parseQuery(exportQuerySchema, req);
    const options = parseExportOptions(query);
    const artifact = await buildExport(req.user!.id, req.user!.plan, options);

    setPrivateNoStore(res);
    res.setHeader("Content-Type", artifact.contentType);
    res.setHeader("Content-Length", String(artifact.body.byteLength));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${artifact.filename}"`,
    );
    res.send(artifact.body);
  },
);
