"use client";

export const SESSION_COOKIE = "lh.sid";
const SESSION_STORAGE_KEY = "linkhub-demo-session";

export interface DemoSession {
  email: string;
  displayName: string;
  startedAt: string;
}

export function startDemoSession(email: string, displayName: string): DemoSession {
  const session: DemoSession = {
    email,
    displayName,
    startedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  document.cookie = `${SESSION_COOKIE}=demo-preview; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
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
