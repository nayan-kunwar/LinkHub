/**
 * Shared session cookie name. Kept free of "use client" so the proxy and route
 * handlers can import it. The API uses __Host-lh.sid in production, which
 * requires Secure, Path=/ and no Domain attribute.
 */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-lh.sid" : "lh.sid";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
