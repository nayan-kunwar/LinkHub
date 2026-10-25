import type { Response } from "express";

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function sendData<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data } satisfies SuccessEnvelope<T>);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendData(res, data, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}

export function noStore(res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

export function setPrivateNoStore(res: Response): void {
  noStore(res);
  res.setHeader("Vary", "Cookie");
}

export function getCookie(req: { headers: { cookie?: string } }, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

export function parseCookies(req: { headers: { cookie?: string } }): Record<string, string> {
  const result: Record<string, string> = {};
  const header = req.headers.cookie;
  if (!header) return result;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (!name) continue;
    try {
      result[name] = decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      result[name] = part.slice(separator + 1).trim();
    }
  }
  return result;
}
