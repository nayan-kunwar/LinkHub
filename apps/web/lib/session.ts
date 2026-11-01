/**
 * Shared session cookie name. Kept free of "use client" so the proxy and route
 * handlers can import it. The API uses __Host-lh.sid in production, which
 * requires Secure, Path=/ and no Domain attribute. SESSION_COOKIE_NAME lets a
 * non-production web build (for example the built-server Playwright suite)
 * match the API's test-mode cookie.
 */
export const SESSION_COOKIE =
  process.env.SESSION_COOKIE_NAME ||
  (process.env.NODE_ENV === "production" ? "__Host-lh.sid" : "lh.sid");
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
