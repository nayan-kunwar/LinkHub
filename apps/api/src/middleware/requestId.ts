import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { requestContext } from "../lib/request-context";

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,128}$/;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  req.requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  requestContext.run({ requestId: req.requestId }, () => {
    next();
  });
}
