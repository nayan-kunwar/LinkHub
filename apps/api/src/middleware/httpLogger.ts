import pinoHttp from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { env } from "../config/env";
import { logger } from "../lib/logger";

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as IncomingMessage & { requestId?: string }).requestId ?? "unknown",
  autoLogging: {
    ignore: (req) => {
      const url = req.url?.split("?")[0];
      return url === "/api/v1/health" || url === "/api/v1/health/live";
    },
  },
  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req(req) {
      const request = req as unknown as IncomingMessage & { requestId?: string };
      return {
        id: request.requestId,
        method: request.method,
        url: request.url?.split("?")[0],
        userAgent: request.headers["user-agent"],
      };
    },
    res(res) {
      return {
        statusCode: (res as unknown as ServerResponse).statusCode,
      };
    },
    err(error) {
      return {
        type: error.type,
        message: error.message,
        stack: env.isProd ? undefined : error.stack,
      };
    },
  },
});
