import { logger } from "./logger";
import { currentRequestId } from "./request-context";

export interface AuditEvent {
  /** Stable action name, for example `account.password_changed`. */
  action: string;
  /** The signed-in user who performed the action, when there is one. */
  actorUserId?: string;
  /** The user affected by the action, when it differs from the actor. */
  targetUserId?: string;
  /** A non-secret identifier such as a session ID or username. */
  target?: string;
  /** Non-secret context. Never pass passwords, tokens, or email addresses. */
  metadata?: Record<string, unknown>;
}

/**
 * Security-relevant event log. Entries use the same Pino redaction rules as
 * request logs, so cookies, tokens, passwords, signatures, and proxy headers
 * are censored even if a caller accidentally includes them.
 *
 * Render retains service logs for the plan's retention window; forward the
 * stream to a log sink if a longer audit trail is required.
 */
export function audit(event: AuditEvent): void {
  logger.info(
    {
      audit: true,
      requestId: currentRequestId(),
      ...event,
    },
    "audit event",
  );
}
