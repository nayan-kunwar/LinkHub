import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";

export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function parseQuery<T>(schema: z.ZodType<T>, req: Request): T {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}
