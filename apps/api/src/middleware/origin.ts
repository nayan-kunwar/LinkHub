import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { fail } from "../lib/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Global Origin check for every state-changing request except the click beacon. */
export function originCheck(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.header("origin");
  if (!origin || origin !== env.appOrigin) {
    next(fail.csrf("Request origin could not be verified."));
    return;
  }

  next();
}
