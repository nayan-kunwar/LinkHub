import { existsSync } from "node:fs";
import path from "node:path";

// Playwright does not load the repository .env automatically. CI supplies the
// same values as real environment variables, and loadEnvFile never overrides
// them.
const envFile = path.resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // A malformed local .env will surface through the API/web server startup.
  }
}

export function ownerEmail(): string {
  const email = (process.env.SEED_OWNER_EMAIL ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error("SEED_OWNER_EMAIL is required for the Playwright suite.");
  }
  return email;
}

export function ownerPassword(): string {
  const password = process.env.SEED_OWNER_PASSWORD ?? "";
  if (!password) {
    throw new Error("SEED_OWNER_PASSWORD is required for the Playwright suite.");
  }
  return password;
}
