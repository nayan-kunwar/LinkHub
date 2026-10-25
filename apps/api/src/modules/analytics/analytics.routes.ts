import { Router } from "express";
import { sendData, setPrivateNoStore } from "../../lib/http";
import { parseUuidParam } from "../../lib/validation";
import { parseQuery } from "../../middleware/validate";
import { requireActiveUser } from "../../middleware/requireAuth";
import { authenticatedApiLimiter } from "../../middleware/rateLimit";
import {
  breakdownQuerySchema,
  overviewQuerySchema,
  timeseriesQuerySchema,
} from "./analytics.schema";
import {
  getBreakdown,
  getLinkAnalytics,
  getOverview,
  getTimeseries,
} from "./analytics.service";

export const analyticsRouter = Router();

analyticsRouter.use(authenticatedApiLimiter, (_req, res, next) => {
  setPrivateNoStore(res);
  next();
});

analyticsRouter.get("/overview", requireActiveUser, async (req, res) => {
  const query = parseQuery(overviewQuerySchema, req);
  sendData(
    res,
    await getOverview(req.user!.id, req.user!.plan, query.range, query.linkId),
  );
});

analyticsRouter.get("/links/:id", requireActiveUser, async (req, res) => {
  const id = parseUuidParam(req.params.id);
  const query = parseQuery(overviewQuerySchema, req);
  sendData(
    res,
    await getLinkAnalytics(req.user!.id, req.user!.plan, id, query.range),
  );
});

analyticsRouter.get("/timeseries", requireActiveUser, async (req, res) => {
  const query = parseQuery(timeseriesQuerySchema, req);
  sendData(
    res,
    await getTimeseries(req.user!.id, req.user!.plan, query.range, query.linkId),
  );
});

analyticsRouter.get("/breakdowns", requireActiveUser, async (req, res) => {
  const query = parseQuery(breakdownQuerySchema, req);
  sendData(
    res,
    await getBreakdown(
      req.user!.id,
      req.user!.plan,
      query.range,
      query.dimension,
      query.linkId,
    ),
  );
});
