import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";
import { logger } from "./logger";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface ResendResponse {
  id?: string;
  message?: string;
}

interface BrevoResponse {
  messageId?: string;
  message?: string;
}

interface MailSender {
  name?: string;
  email: string;
}

/**
 * Parse a From value such as `Link Hub <no-reply@example.com>` or a bare
 * address into the object shape Brevo expects. Display names may be quoted.
 */
export function parseSenderAddress(value: string): MailSender {
  const trimmed = value.trim();
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(trimmed);
  if (!match) return { email: trimmed };

  const name = match[1].trim().replace(/^"(.*)"$/, "$1").trim();
  const email = match[2].trim();
  return name ? { name, email } : { email };
}

export function buildBrevoPayload(message: MailMessage): Record<string, unknown> {
  return {
    sender: parseSenderAddress(env.EMAIL_FROM),
    to: [{ email: message.to }],
    subject: message.subject,
    textContent: message.text,
    ...(message.html ? { htmlContent: message.html } : {}),
  };
}

async function sendWithBrevo(message: MailMessage): Promise<void> {
  if (!env.EMAIL_BREVO_API_KEY) {
    throw new Error("EMAIL_BREVO_API_KEY is not configured.");
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env.EMAIL_BREVO_API_KEY,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildBrevoPayload(message)),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as BrevoResponse;
        throw new Error(`Brevo responded ${response.status}: ${body.message ?? "unknown error"}`);
      }
      return;
    } catch (error) {
      if (attempt === 1) throw error;
      logger.warn({ err: error }, "brevo delivery failed; retrying once");
    }
  }
}

async function sendWithResend(message: MailMessage): Promise<void> {
  if (!env.EMAIL_RESEND_API_KEY) {
    throw new Error("EMAIL_RESEND_API_KEY is not configured.");
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.EMAIL_RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ResendResponse;
        throw new Error(`Resend responded ${response.status}: ${body.message ?? "unknown error"}`);
      }
      return;
    } catch (error) {
      if (attempt === 1) throw error;
      logger.warn({ err: error }, "resend delivery failed; retrying once");
    }
  }
}

/**
 * Development/test transport. The message body (which contains single-use
 * tokens) is written to a gitignored local outbox instead of the log, so
 * tokens never appear in structured logs.
 */
async function sendToConsoleOutbox(message: MailMessage): Promise<void> {
  if (env.isTest) return;

  const outbox = path.join(process.cwd(), ".mail-outbox");
  await mkdir(outbox, { recursive: true });
  const safeRecipient = message.to.replace(/[^a-z0-9@._-]/gi, "_");
  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeRecipient}.txt`;
  const body = [
    `To: ${message.to}`,
    `From: ${env.EMAIL_FROM}`,
    `Subject: ${message.subject}`,
    "",
    message.text,
    "",
  ].join("\n");
  await writeFile(path.join(outbox, filename), body, "utf8");
  logger.info({ to: message.to, subject: message.subject, outboxFile: filename }, "email queued (console)");
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (env.EMAIL_PROVIDER === "resend") {
    await sendWithResend(message);
    return;
  }
  if (env.EMAIL_PROVIDER === "brevo") {
    await sendWithBrevo(message);
    return;
  }
  await sendToConsoleOutbox(message);
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${env.APP_URL.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: "Verify your Link Hub email",
    text: [
      "Welcome to Link Hub.",
      "",
      "Confirm your email address to activate your account:",
      link,
      "",
      `This link expires in ${env.EMAIL_VERIFICATION_TTL_HOURS} hours and can be used once.`,
      "If you did not create an account, you can ignore this email.",
    ].join("\n"),
  });
}

export async function sendEmailChangeVerification(to: string, token: string): Promise<void> {
  const link = `${env.APP_URL.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}&change=email`;
  await sendMail({
    to,
    subject: "Confirm your new Link Hub email",
    text: [
      "Confirm this address as the new email for your Link Hub account:",
      link,
      "",
      `This link expires in ${env.EMAIL_VERIFICATION_TTL_HOURS} hours and can be used once.`,
      "Your current email stays active until you confirm this change.",
      "If you did not request this, ignore this email.",
    ].join("\n"),
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${env.APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: "Reset your Link Hub password",
    text: [
      "Use this link to choose a new Link Hub password:",
      link,
      "",
      `This link expires in ${env.PASSWORD_RESET_TTL_MINUTES} minutes and can be used once.`,
      "If you did not request a reset, ignore this email; your password has not changed.",
    ].join("\n"),
  });
}

export async function sendAccountRestoreEmail(to: string, token: string): Promise<void> {
  const link = `${env.APP_URL.replace(/\/$/, "")}/restore-account?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: "Restore your Link Hub account",
    text: [
      "Your Link Hub account is scheduled for deletion.",
      "",
      "Changed your mind? Restore it here:",
      link,
      "",
      `This link is valid for ${env.ACCOUNT_DELETION_GRACE_DAYS} days and can be used once.`,
      "Signing in during the grace period also cancels the deletion.",
      "Restoring does not republish your public profile.",
    ].join("\n"),
  });
}
