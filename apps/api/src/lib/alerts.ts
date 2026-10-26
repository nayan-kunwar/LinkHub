import { env } from "../config/env";
import { prisma } from "./db";
import { logger } from "./logger";
import { sendMail } from "./mailer";

const ALERT_THROTTLE_MS = 15 * 60 * 1000;
const OWNER_CACHE_MS = 5 * 60 * 1000;

let lastAlertAt = 0;
let ownerCache: { emails: string[]; expiresAt: number } | null = null;

async function ownerEmails(): Promise<string[]> {
  if (ownerCache && ownerCache.expiresAt > Date.now()) {
    return ownerCache.emails;
  }

  const owners = await prisma.user.findMany({
    where: { role: "owner", status: "active", deletedAt: null },
    select: { email: true },
  });
  const emails = owners.map((owner) => owner.email);
  ownerCache = { emails, expiresAt: Date.now() + OWNER_CACHE_MS };
  return emails;
}

export interface ServerErrorAlert {
  requestId?: string;
  method: string;
  path: string;
  status: number;
  code: string;
  userId?: string;
  error: unknown;
}

/**
 * Send a throttled email when an API request fails with 5xx. The message
 * intentionally excludes the error text, stack, request body, and IP address;
 * the owner can look up the request ID in Render logs for the redacted stack.
 *
 * Delivery is fire-and-forget so an alert can never delay or break the error
 * response. Failures are logged and the next alert is still limited by the
 * process-wide throttle.
 */
export function notifyServerError(input: ServerErrorAlert): void {
  if (env.isTest) return;

  const now = Date.now();
  if (now - lastAlertAt < ALERT_THROTTLE_MS) return;
  lastAlertAt = now;

  void (async () => {
    try {
      const recipients = await ownerEmails();
      if (recipients.length === 0) return;

      const errorName = input.error instanceof Error ? input.error.name : "UnknownError";
      const subject = `[Link Hub] API ${input.status} on ${input.path}`;
      const text = [
        `An API request failed at ${new Date().toISOString()}.`,
        "",
        `Request ID: ${input.requestId ?? "unknown"}`,
        `Method: ${input.method}`,
        `Path: ${input.path}`,
        `Status: ${input.status}`,
        `Code: ${input.code}`,
        `Error: ${errorName}`,
        ...(input.userId ? [`User ID: ${input.userId}`] : []),
        "",
        "Search the Render service logs for the request ID to see the stack trace.",
        "Alerts are throttled to one per 15 minutes per API instance.",
      ].join("\n");

      const results = await Promise.allSettled(
        recipients.map((to) => sendMail({ to, subject, text })),
      );
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length === results.length) {
        logger.error(
          { failureCount: failures.length },
          "server error alert delivery failed",
        );
      }
    } catch (error) {
      logger.error({ err: error }, "failed to send server error alert");
    }
  })();
}
