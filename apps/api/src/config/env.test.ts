import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const productionEnv = {
  NODE_ENV: "production",
  APP_URL: "https://link.example.com",
  DATABASE_URL: "postgresql://linkhub:linkhub@db.example.com/linkhub",
  SESSION_SECRET: "a".repeat(40),
  REVALIDATE_SECRET: "b".repeat(40),
  INTERNAL_FETCH_TOKEN: "c".repeat(40),
  WEB_PROXY_SECRET: "d".repeat(40),
  ANALYTICS_HASH_SECRET: "e".repeat(40),
  TRUST_PROXY: "1",
  EMAIL_PROVIDER: "brevo",
  EMAIL_FROM: "Link Hub <no-reply@example.com>",
  EMAIL_BREVO_API_KEY: "xkeysib-test",
} as NodeJS.ProcessEnv;

describe("environment validation", () => {
  it("accepts a production configuration with distinct long secrets", () => {
    const env = loadEnv(productionEnv);
    expect(env.isProd).toBe(true);
    expect(env.sessionCookieName).toBe("__Host-lh.sid");
    expect(env.csrfCookieName).toBe("__Host-lh.csrf");
    expect(env.sessionMaxAgeMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("rejects short production secrets", () => {
    expect(() =>
      loadEnv({ ...productionEnv, SESSION_SECRET: "too-short" }),
    ).toThrow(/SESSION_SECRET/);
  });

  it("rejects reused production secrets", () => {
    expect(() =>
      loadEnv({ ...productionEnv, REVALIDATE_SECRET: productionEnv.SESSION_SECRET }),
    ).toThrow(/must be different/);
  });

  it("rejects development placeholders in production", () => {
    expect(() =>
      loadEnv({
        ...productionEnv,
        WEB_PROXY_SECRET: "dev-web-proxy-secret-0123456789abcdef012",
      }),
    ).toThrow(/placeholder/);
  });

  it("rejects TRUST_PROXY=true and accepts an explicit hop count", () => {
    expect(() =>
      loadEnv({ ...productionEnv, TRUST_PROXY: "true" }),
    ).toThrow(/hop count/);

    const env = loadEnv({
      ...productionEnv,
      NODE_ENV: "development",
      TRUST_PROXY: "2",
    });
    expect(env.TRUST_PROXY).toBe(2);
    expect(env.sessionCookieName).toBe("lh.sid");
  });

  it("requires a Brevo API key in production when selected", () => {
    expect(() =>
      loadEnv({ ...productionEnv, EMAIL_BREVO_API_KEY: undefined }),
    ).toThrow(/EMAIL_BREVO_API_KEY/);

    const env = loadEnv({
      ...productionEnv,
      EMAIL_PROVIDER: "brevo",
      EMAIL_BREVO_API_KEY: "xkeysib-test",
    });
    expect(env.EMAIL_PROVIDER).toBe("brevo");
  });

  it("rejects non-HTTPS and local production origins", () => {
    expect(() =>
      loadEnv({ ...productionEnv, APP_URL: "http://link.example.com" }),
    ).toThrow(/https/);

    expect(() =>
      loadEnv({ ...productionEnv, APP_URL: "https://localhost:3000" }),
    ).toThrow(/localhost/);

    expect(() =>
      loadEnv({ ...productionEnv, APP_URL: "https://192.168.1.10" }),
    ).toThrow(/private/);
  });

  it("rejects the console mailer and local senders in production", () => {
    expect(() =>
      loadEnv({ ...productionEnv, EMAIL_PROVIDER: "console" }),
    ).toThrow(/console/);

    const allowed = loadEnv({
      ...productionEnv,
      EMAIL_PROVIDER: "console",
      ALLOW_CONSOLE_MAIL_IN_PRODUCTION: "true",
    });
    expect(allowed.EMAIL_PROVIDER).toBe("console");

    expect(() =>
      loadEnv({ ...productionEnv, EMAIL_FROM: "Link Hub <no-reply@localhost>" }),
    ).toThrow(/EMAIL_FROM/);
  });

  it("requires a positive proxy hop count in production", () => {
    expect(() =>
      loadEnv({ ...productionEnv, TRUST_PROXY: "false" }),
    ).toThrow(/TRUST_PROXY/);
  });

  it("parses boolean flags", () => {
    const enabled = loadEnv({
      ...productionEnv,
      NODE_ENV: "development",
      ALLOW_SIGNUP: "true",
      DEBUG_IP_ENDPOINT: "1",
    });
    expect(enabled.ALLOW_SIGNUP).toBe(true);
    expect(enabled.DEBUG_IP_ENDPOINT).toBe(true);

    const disabled = loadEnv({
      ...productionEnv,
      NODE_ENV: "development",
      ALLOW_SIGNUP: "false",
      DEBUG_IP_ENDPOINT: "0",
    });
    expect(disabled.ALLOW_SIGNUP).toBe(false);
    expect(disabled.DEBUG_IP_ENDPOINT).toBe(false);
  });
});
