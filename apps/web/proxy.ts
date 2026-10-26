import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

const COUNTRY_PATTERN = /^[a-z]{2}$/i;

/**
 * The API trusts x-web-proxy-secret and x-vercel-ip-country only when they
 * arrive together. Strip client-supplied copies, then add the shared secret and
 * a validated country so upstream values cannot be spoofed.
 */
function forwardApiRequest(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("x-web-proxy-secret");
  headers.delete("x-internal-token");

  const country = headers.get("x-vercel-ip-country");
  headers.delete("x-vercel-ip-country");
  if (country && COUNTRY_PATTERN.test(country)) {
    headers.set("x-vercel-ip-country", country.toUpperCase());
  }

  const secret = process.env.WEB_PROXY_SECRET;
  if (secret) headers.set("x-web-proxy-secret", secret);

  return NextResponse.next({ request: { headers } });
}

/**
 * API proxy hardening plus the dashboard route guard. The API remains the
 * source of truth for sessions; the cookie check only avoids rendering a shell
 * for signed-out visitors.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return forwardApiRequest(request);
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/settings/:path*"],
};
