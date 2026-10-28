import pino from "pino";

// Read logging settings directly from the process environment. Importing the
// full env module here would force every consumer (including standalone jobs)
// to satisfy production-only validation for secrets it never uses.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    service: "linkhub-api",
    env: process.env.NODE_ENV ?? "development",
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
      "*.credential",
      "*.googleCredential",
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
