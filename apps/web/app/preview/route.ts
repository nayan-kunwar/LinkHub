import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_DURATION_SECONDS } from "@/lib/session";

/**
 * Demo entry point: sets the preview session cookie and opens the dashboard.
 * The real API will authenticate this route and issue a server session.
 */
export function GET(request: NextRequest) {
  const demoEnabled =
    process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_PREVIEW === "true";
  if (!demoEnabled) {
    return new NextResponse("Not found", { status: 404 });
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "demo-preview",
    httpOnly: false,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
  return response;
}
