import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export function cors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.header("origin");

  if (origin && origin === env.appOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-CSRF-Token, X-Request-Id",
    );
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Disposition, X-Request-Id",
    );
    res.setHeader("Access-Control-Max-Age", "600");
  }

  if (req.method === "OPTIONS") {
    if (origin === env.appOrigin) {
      res.status(204).end();
      return;
    }
    res.status(403).end();
    return;
  }

  next();
}
