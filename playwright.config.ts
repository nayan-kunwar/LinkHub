import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";

// Load the local .env the same way the API/web apps do. CI provides real
// environment variables, which loadEnvFile does not override.
const envFile = path.resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // Server startup will report any malformed configuration.
  }
}

const useBuiltServers = process.env.E2E_USE_BUILT_SERVERS === "true";

const apiCommand = useBuiltServers
  ? "pnpm api:start"
  : "pnpm --filter @linkhub/api exec tsx src/index.ts";

const webCommand = useBuiltServers
  ? "pnpm --filter @linkhub/web exec next start -p 3100"
  : "pnpm --filter @linkhub/web exec next dev -p 3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHANNEL }
          : {}),
      },
    },
  ],
  webServer: [
    {
      command: apiCommand,
      url: "http://localhost:4000/api/v1/health/live",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: "test",
        APP_URL: "http://localhost:3100",
        PORT: "4000",
        LOG_LEVEL: "warn",
        METADATA_FETCH_ENABLED: "false",
        SESSION_COOKIE_NAME: "lh.sid",
      },
    },
    {
      command: webCommand,
      url: "http://localhost:3100/login",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: useBuiltServers ? "production" : "development",
        API_BASE_URL: "http://localhost:4000",
        NEXT_PUBLIC_APP_URL: "http://localhost:3100",
        NEXT_PUBLIC_ALLOW_SIGNUP: "true",
        ALLOW_DEMO_PREVIEW: "false",
        ROOT_MODE: "profile",
        SESSION_COOKIE_NAME: "lh.sid",
      },
    },
  ],
});
