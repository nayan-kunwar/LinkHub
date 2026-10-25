import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";
import { logger } from "./logger";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "event", level: "warn" },
            { emit: "event", level: "error" },
          ]
        : [
            { emit: "event", level: "warn" },
            { emit: "event", level: "error" },
          ],
  });

if (env.NODE_ENV === "development") {
  const onPrismaEvent = prisma.$on.bind(prisma) as unknown as (
    event: "query" | "warn" | "error",
    callback: (event: { duration?: number; target?: string }) => void,
  ) => void;

  onPrismaEvent("query", (event) => {
    if ((event.duration ?? 0) > 250) {
      logger.warn(
        { durationMs: event.duration, target: event.target },
        "slow prisma query",
      );
    }
  });
}

const onPrismaEvent = prisma.$on.bind(prisma) as unknown as (
  event: "warn" | "error",
  callback: (event: unknown) => void,
) => void;

onPrismaEvent("warn", (event) => logger.warn({ prisma: event }, "prisma warning"));
onPrismaEvent("error", (event) => logger.error({ prisma: event }, "prisma error"));

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ err: error }, "database readiness check failed");
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
