"use client";

import { SESSION_COOKIE, SESSION_DURATION_SECONDS } from "./session";

export { SESSION_COOKIE };

const SESSION_STORAGE_KEY = "linkhub-demo-session";

export interface DemoSession {
  email: string;
  displayName: string;
  startedAt: string;
}

/**
 * Demo-only session: a client-readable cookie so the proxy can gate dashboard
 * routes before the real API exists. The API milestone replaces this with an
 * httpOnly cookie issued by the server.
 */
export function startDemoSession(email: string, displayName: string): DemoSession {
  const session: DemoSession = {
    email,
    displayName,
    startedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  document.cookie = `${SESSION_COOKIE}=demo-preview; path=/; max-age=${SESSION_DURATION_SECONDS}; samesite=lax`;
  return session;
}

export function endDemoSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function readDemoSession(): DemoSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemoSession) : null;
  } catch {
    return null;
  }
}
