/**
 * Shared session cookie name. Kept free of "use client" so the proxy and route
 * handlers can import it; the real API will use the same cookie name.
 */
export const SESSION_COOKIE = "lh.sid";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
