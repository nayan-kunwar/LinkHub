import path from "node:path";
import type { NextConfig } from "next";

// The API, web app and Prisma share one .env at the repository root. Next only
// loads env files from apps/web by default, so load the root file first.
try {
  process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
} catch {
  // Root .env is optional; production and CI provide real environment variables.
}

const isDev = process.env.NODE_ENV === "development";
const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, "");

if (process.env.NODE_ENV === "production") {
  if (process.env.ALLOW_DEMO_PREVIEW === "true") {
    throw new Error("ALLOW_DEMO_PREVIEW must be false in production.");
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production.");
  }
}

// Static CSP without a per-request nonce. This keeps ISR/CDN caching intact for
// public profiles while still restricting script, frame and form origins.
// Next.js injects inline bootstrap scripts, so 'unsafe-inline' is required
// unless the app is migrated to nonce-based dynamic rendering.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://accounts.google.com/gsi/",
  "frame-src https://accounts.google.com/gsi/ https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const globalHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Google Identity Services opens a popup and posts the credential back to
  // the opener. same-origin-allow-popups keeps the opener isolated from other
  // origins while permitting that flow.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const tokenPageHeaders = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@linkhub/shared"],
  poweredByHeader: false,
  async rewrites() {
    if (!apiBaseUrl) return [];
    return [{ source: "/api/:path*", destination: `${apiBaseUrl}/api/:path*` }];
  },
  async headers() {
    return [
      { source: "/(.*)", headers: globalHeaders },
      { source: "/verify-email", headers: tokenPageHeaders },
      { source: "/reset-password", headers: tokenPageHeaders },
      { source: "/restore-account", headers: tokenPageHeaders },
      { source: "/check-inbox", headers: tokenPageHeaders },
    ];
  },
};

export default nextConfig;
