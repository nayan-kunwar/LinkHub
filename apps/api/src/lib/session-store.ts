import connectPgSimple from "connect-pg-simple";
import session from "express-session";
import pg from "pg";
import { env } from "../config/env";
import { logger } from "./logger";

const PgSession = connectPgSimple(session);

export const sessionPool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: "linkhub-api-sessions",
});

sessionPool.on("error", (error) => {
  logger.error({ err: error }, "session pool error");
});

export const sessionStore = new PgSession({
  pool: sessionPool,
  tableName: "sessions",
  createTableIfMissing: false,
  ttl: Math.floor(env.sessionMaxAgeMs / 1000),
  pruneSessionInterval: 15 * 60,
  errorLog: (...args: unknown[]) => {
    logger.error({ args }, "session store error");
  },
});

export const sessionMiddleware = session({
  name: env.sessionCookieName,
  secret: env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  proxy: env.isProd || env.TRUST_PROXY !== false,
  cookie: {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: env.sessionMaxAgeMs,
  },
});

export async function closeSessionStore(): Promise<void> {
  await new Promise<void>((resolve) => {
    sessionStore.close();
    resolve();
  });
  await sessionPool.end();
}
