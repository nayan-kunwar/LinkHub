import { NextResponse, type NextRequest } from "next/server";

interface CsrfEnvelope {
  success: true;
  data: { csrfToken: string };
}

function cookiePairs(setCookies: string[]): string {
  return setCookies
    .map((cookie) => cookie.split(";", 1)[0]?.trim())
    .filter((pair): pair is string => Boolean(pair))
    .join("; ");
}

/**
 * Demo entry point. Authenticates server-side against the API, then forwards
 * the API's own session and CSRF cookies so the browser is genuinely signed in.
 */
export async function GET(request: NextRequest) {
  // Never allow a real demo login to exist in production, even if the flag is
  // set by mistake. The route is for local development only.
  if (
    (process.env.NODE_ENV as string) === "production" ||
    process.env.ALLOW_DEMO_PREVIEW !== "true"
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  const apiBase = process.env.API_BASE_URL?.replace(/\/$/, "");
  const isProduction = process.env.NODE_ENV === "production";
  const email =
    process.env.DEMO_EMAIL ?? (isProduction ? undefined : process.env.SEED_OWNER_EMAIL);
  const password =
    process.env.DEMO_PASSWORD ?? (isProduction ? undefined : process.env.SEED_OWNER_PASSWORD);
  const origin = process.env.APP_URL?.replace(/\/$/, "") ?? request.nextUrl.origin;

  if (!apiBase || !email || !password) {
    return NextResponse.redirect(new URL("/login?error=preview", request.url));
  }

  try {
    const csrfResponse = await fetch(`${apiBase}/api/v1/auth/csrf`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!csrfResponse.ok) throw new Error("CSRF request failed");

    const csrfPayload = (await csrfResponse.json()) as CsrfEnvelope;
    const csrfToken = csrfPayload.data?.csrfToken;
    if (!csrfToken) throw new Error("CSRF token missing");

    const loginResponse = await fetch(`${apiBase}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: origin,
        "X-CSRF-Token": csrfToken,
        Cookie: cookiePairs(csrfResponse.headers.getSetCookie()),
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    if (!loginResponse.ok) throw new Error("Login failed");

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    for (const cookie of loginResponse.headers.getSetCookie()) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=preview", request.url));
  }
}
