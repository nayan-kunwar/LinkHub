import { createServer } from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { disconnectDatabase } from "./lib/db";
import { logger } from "./lib/logger";
import { closeSessionStore } from "./lib/session-store";

const app = createApp();
const server = createServer(app);

server.on("error", (error) => {
  logger.fatal({ err: error }, "http server failed");
  process.exit(1);
});

server.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, appOrigin: env.appOrigin },
    "LinkHub API listening",
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  const forceExit = setTimeout(() => {
    logger.error("graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeIdleConnections();
  });

  try {
    await closeSessionStore();
  } catch (error) {
    logger.error({ err: error }, "failed to close the session store");
  }

  try {
    await disconnectDatabase();
  } catch (error) {
    logger.error({ err: error }, "failed to disconnect Prisma");
  }

  clearTimeout(forceExit);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandled rejection");
});
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "uncaught exception");
  void shutdown("uncaughtException");
});
