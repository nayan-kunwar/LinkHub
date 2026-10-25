import express, { Router } from "express";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { clickLimiter } from "../../middleware/rateLimit";
import { clickSchema } from "./click.schema";
import { recordClick } from "./click.service";

function originAllowed(origin: string | undefined, referer: string | undefined): boolean {
  if (origin) return origin === env.appOrigin;
  if (!referer) return false;
  try {
    return new URL(referer).origin === env.appOrigin;
  } catch {
    return false;
  }
}

export const clickRouter = Router();

clickRouter.use((req, res, next) => {
  if (!originAllowed(req.header("origin"), req.header("referer"))) {
    res.status(204).end();
    return;
  }
  next();
});

clickRouter.use(clickLimiter);
clickRouter.use(express.text({ type: "text/plain", limit: "1kb" }));

clickRouter.post("/", async (req, res) => {
  try {
    const raw = typeof req.body === "string" ? req.body : "";
    const payload = JSON.parse(raw) as unknown;
    const parsed = clickSchema.safeParse(payload);
    if (!parsed.success) {
      res.status(204).end();
      return;
    }

    await recordClick({
      linkId: parsed.data.linkId,
      referrer: parsed.data.referrer,
      ip: req.ip,
      userAgent: req.header("user-agent"),
      countryHeader: req.header("x-vercel-ip-country"),
      proxySecret: req.header("x-web-proxy-secret"),
    });
  } catch (error) {
    logger.warn({ err: error }, "click ingest failed");
  }

  res.status(204).end();
});

// Parser errors (malformed or oversized bodies) are always 204 for this route.
clickRouter.use(
  (
    _error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(204).end();
  },
);
