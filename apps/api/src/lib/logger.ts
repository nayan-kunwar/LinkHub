import pino from "pino";
import { env } from "../config/env";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: "linkhub-api",
    env: env.NODE_ENV,
  },
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "req.headers['x-csrf-token']",
      "req.headers['x-forwarded-for']",
      "req.headers['x-vercel-ip-country']",
      "req.headers['x-web-proxy-secret']",
      "req.headers['x-internal-token']",
      "req.headers['x-revalidate-signature']",
      "res.headers['set-cookie']",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.csrfToken",
      "*.secret",
      "*.signature",
    ],
    censor: "[redacted]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
