import path from "node:path";
import type { NextConfig } from "next";

// The API, web app and Prisma share one .env at the repository root. Next only
// loads env files from apps/web by default, so load the root file first.
try {
  process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
} catch {
  // Root .env is optional; production and CI provide real environment variables.
}

const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, "");

const tokenPageHeaders = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@linkhub/shared"],
  async rewrites() {
    if (!apiBaseUrl) return [];
    return [{ source: "/api/:path*", destination: `${apiBaseUrl}/api/:path*` }];
  },
  async headers() {
    return [
      { source: "/verify-email", headers: tokenPageHeaders },
      { source: "/reset-password", headers: tokenPageHeaders },
      { source: "/restore-account", headers: tokenPageHeaders },
      { source: "/check-inbox", headers: tokenPageHeaders },
    ];
  },
};

export default nextConfig;
