import { logger } from "./logger";

type MailTask = () => Promise<void>;

const pending = new Set<Promise<void>>();

/**
 * Deliver email outside the request path. Auth endpoints must return in
 * comparable time whether or not an account exists; waiting on Brevo or the
 * filesystem outbox creates a measurable enumeration signal.
 *
 * The API runs as a long-lived process on Render, so in-process delivery is
 * sufficient. Failures are logged with the usual redaction rules.
 */
export function enqueueMail(task: MailTask): void {
  const promise = task().catch((error: unknown) => {
    logger.error({ err: error }, "background email delivery failed");
  });
  pending.add(promise);
  void promise.finally(() => {
    pending.delete(promise);
  });
}

/**
 * Test/helper hook that waits for all in-flight deliveries. Production code
 * does not need to call this; requests return without waiting.
 */
export async function flushMailQueue(): Promise<void> {
  while (pending.size > 0) {
    await Promise.allSettled([...pending]);
  }
}
