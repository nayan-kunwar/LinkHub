import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      APP_URL: "http://localhost:3100",
      DATABASE_URL:
        "postgresql://linkhub:linkhub@localhost:5432/linkhub_test?schema=public",
      DIRECT_URL:
        "postgresql://linkhub:linkhub@localhost:5432/linkhub_test?schema=public",
      SESSION_SECRET: "test-session-secret-0123456789abcdef0123456789",
      SESSION_MAX_AGE_DAYS: "7",
      TRUST_PROXY: "false",
      DEBUG_IP_ENDPOINT: "false",
      REVALIDATE_SECRET: "test-revalidate-secret-0123456789abcdef0123",
      INTERNAL_FETCH_TOKEN: "test-internal-fetch-token-0123456789abcd",
      WEB_PROXY_SECRET: "test-web-proxy-secret-0123456789abcdef012",
      ANALYTICS_HASH_SECRET: "test-analytics-hash-secret-0123456789abcdef",
      ALLOW_SIGNUP: "true",
      EMAIL_PROVIDER: "console",
      EMAIL_FROM: "Link Hub <no-reply@test.local>",
      DEFAULT_USERNAME: "nayan",
      SEED_OWNER_NAME: "Nayan Kunwar",
    },
  },
});
