import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// Load the repository-root .env for local development. Platform deployments
// provide real environment variables, so missing files are fine. dotenv does
// not override variables that are already set.
for (const candidate of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../.env"),
]) {
  if (existsSync(candidate)) {
    loadDotenv({ path: candidate });
    break;
  }
}

const booleanString = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0", ""])])
  .transform((value) => value === true || value === "true" || value === "1");

const trustProxyValue = z
  .string()
  .default("false")
  .transform((value, ctx) => {
    if (!value || value === "false" || value === "0") return false;
    if (value === "true") {
      ctx.addIssue({
        code: "custom",
        message: "TRUST_PROXY must be a verified hop count, not true.",
      });
      return z.NEVER;
    }
    const hops = Number(value);
    if (!Number.isInteger(hops) || hops < 0) {
      ctx.addIssue({
        code: "custom",
        message: "TRUST_PROXY must be false or a non-negative integer hop count.",
      });
      return z.NEVER;
    }
    return hops;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  DIRECT_URL: z.string().min(1).optional(),

  PORT: z.coerce.number().int().positive().default(4000),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters."),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().max(30).default(7),
  TRUST_PROXY: trustProxyValue,
  DEBUG_IP_ENDPOINT: booleanString.default(false),
  WEB_INTERNAL_URL: z.string().url().optional(),

  REVALIDATE_SECRET: z.string().min(32, "REVALIDATE_SECRET must be at least 32 characters."),
  INTERNAL_FETCH_TOKEN: z.string().min(32, "INTERNAL_FETCH_TOKEN must be at least 32 characters."),
  WEB_PROXY_SECRET: z.string().min(32, "WEB_PROXY_SECRET must be at least 32 characters."),

  DEFAULT_USERNAME: z.string().default("nayan"),
  ROOT_MODE: z.enum(["profile", "landing"]).default("profile"),
  ALLOW_SIGNUP: booleanString.default(false),
  ACCOUNT_DELETION_GRACE_DAYS: z.coerce.number().int().positive().max(365).default(30),

  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  EMAIL_FROM: z.string().default("Link Hub <no-reply@localhost>"),
  EMAIL_RESEND_API_KEY: z.string().optional(),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(60),

  CLICK_DEDUPE_SECONDS: z.coerce.number().int().positive().default(30),
  ANALYTICS_HASH_SECRET: z.string().min(32, "ANALYTICS_HASH_SECRET must be at least 32 characters."),

  SEED_OWNER_EMAIL: z.string().email().optional(),
  SEED_OWNER_PASSWORD: z.string().min(12).optional(),
  SEED_OWNER_NAME: z.string().trim().min(1).max(60).default("Nayan Kunwar"),
});

export type Env = z.infer<typeof envSchema> & {
  isProd: boolean;
  isTest: boolean;
  appOrigin: string;
  sessionCookieName: string;
  csrfCookieName: string;
  sessionMaxAgeMs: number;
  webInternalUrl: string;
  directUrl: string;
};

function assertProductionSecrets(env: z.infer<typeof envSchema>): void {
  if (env.NODE_ENV !== "production") return;

  const secrets: Array<[string, string]> = [
    ["SESSION_SECRET", env.SESSION_SECRET],
    ["REVALIDATE_SECRET", env.REVALIDATE_SECRET],
    ["INTERNAL_FETCH_TOKEN", env.INTERNAL_FETCH_TOKEN],
    ["WEB_PROXY_SECRET", env.WEB_PROXY_SECRET],
    ["ANALYTICS_HASH_SECRET", env.ANALYTICS_HASH_SECRET],
  ];

  for (const [name, value] of secrets) {
    if (value.length < 32) {
      throw new Error(`${name} must be at least 32 bytes in production.`);
    }
    if (/change-me|replace-with|dev-/i.test(value)) {
      throw new Error(`${name} still contains a development placeholder.`);
    }
  }

  for (let index = 0; index < secrets.length; index += 1) {
    for (let other = index + 1; other < secrets.length; other += 1) {
      if (secrets[index][1] === secrets[other][1]) {
        throw new Error(`${secrets[index][0]} and ${secrets[other][0]} must be different.`);
      }
    }
  }

  if (env.EMAIL_PROVIDER === "resend" && !env.EMAIL_RESEND_API_KEY) {
    throw new Error("EMAIL_RESEND_API_KEY is required when EMAIL_PROVIDER=resend.");
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  assertProductionSecrets(parsed.data);
  const isProd = parsed.data.NODE_ENV === "production";
  const isTest = parsed.data.NODE_ENV === "test";
  const appUrl = new URL(parsed.data.APP_URL);

  // Prisma reads DIRECT_URL for migrations. In local development the same
  // database can serve both roles; production supplies a non-pooled Neon URL.
  const directUrl = parsed.data.DIRECT_URL ?? parsed.data.DATABASE_URL;
  process.env.DIRECT_URL ??= directUrl;

  return Object.freeze({
    ...parsed.data,
    isProd,
    isTest,
    appOrigin: appUrl.origin,
    sessionCookieName: isProd ? "__Host-lh.sid" : "lh.sid",
    csrfCookieName: "lh.csrf",
    sessionMaxAgeMs: parsed.data.SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    webInternalUrl: (parsed.data.WEB_INTERNAL_URL ?? parsed.data.APP_URL).replace(/\/$/, ""),
    directUrl,
  });
}

export const env = loadEnv();
