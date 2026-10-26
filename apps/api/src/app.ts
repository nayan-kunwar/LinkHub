import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { checkDatabase } from "./lib/db";
import { fail } from "./lib/errors";
import { noStore, sendData } from "./lib/http";
import { cors } from "./middleware/cors";
import { csrfProtection } from "./middleware/csrf";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { httpLogger } from "./middleware/httpLogger";
import { loadUser } from "./middleware/loadUser";
import { originCheck } from "./middleware/origin";
import { requestId } from "./middleware/requestId";
import { requireAuth, requireOwner } from "./middleware/requireAuth";
import { sessionMiddleware } from "./middleware/session";
import { accountRouter } from "./modules/account/account.routes";
import { analyticsRouter } from "./modules/analytics/analytics.routes";
import { clickRouter } from "./modules/analytics/click.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { categoriesRouter } from "./modules/categories/categories.routes";
import { exportRouter } from "./modules/export/export.routes";
import { linksRouter } from "./modules/links/links.routes";
import { profileRouter } from "./modules/profile/profile.routes";
import { publicRouter } from "./modules/public/public.routes";

export const API_VERSION = "2.4.0";

function healthPayload() {
  return {
    status: "ok",
    version: API_VERSION,
    uptime: Math.round(process.uptime()),
  };
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  // 1. Request identity and structured logging.
  app.use(requestId);
  app.use(httpLogger);

  // 2. Security headers. The API serves JSON/downloads, not HTML, so CSP is off.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 3. Same-origin CORS (browsers normally go through the Next.js rewrite).
  app.use(cors);

  // 4. Liveness/readiness never touch sessions or cookies.
  app.get("/api/v1/health/live", (_req, res) => {
    noStore(res);
    sendData(res, healthPayload());
  });

  app.get("/api/v1/health", async (_req, res) => {
    noStore(res);
    const dbReady = await checkDatabase();
    if (!dbReady) {
      res.status(503).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "The database is not ready.",
        },
      });
      return;
    }
    sendData(res, { ...healthPayload(), db: "up" });
  });

  // 5. Cacheable/public and beacon routes run before JSON parsing and sessions
  //    so they can never carry Set-Cookie.
  app.use("/api/v1/analytics/clicks", clickRouter);
  app.use("/api/v1", publicRouter);

  // 6. Body parsing for everything else.
  app.use(express.json({ limit: "100kb" }));

  // 7. Sessions and account status.
  app.use(sessionMiddleware);
  app.use(loadUser);

  // 8. Origin + signed double-submit CSRF for every non-GET request. The click
  //    route is already handled above.
  app.use(originCheck);
  app.use(csrfProtection);

  // 9. Routers.
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/account", accountRouter);
  app.use("/api/v1/profile", profileRouter);
  app.use("/api/v1/links", linksRouter);
  app.use("/api/v1/categories", categoriesRouter);
  app.use("/api/v1/analytics", analyticsRouter);
  app.use("/api/v1/export", exportRouter);

  app.get(
    "/api/v1/debug/ip",
    requireAuth,
    requireOwner,
    (req, res) => {
      if (!env.DEBUG_IP_ENDPOINT) throw fail.notFound();
      noStore(res);
      sendData(res, {
        ip: req.ip ?? null,
        ips: req.ips,
        xForwardedFor: req.header("x-forwarded-for") ?? null,
        remoteAddress: req.socket.remoteAddress ?? null,
      });
    },
  );

  // 10. 404 and the single error envelope.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
