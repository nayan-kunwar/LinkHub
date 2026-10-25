import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, fail } from "../lib/errors";
import { logger } from "../lib/logger";
import type { ErrorEnvelope } from "../lib/http";

interface PrismaLikeError {
  name?: string;
  code?: string;
  meta?: Record<string, unknown>;
}

function isPrismaKnownError(error: unknown): error is PrismaLikeError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as PrismaLikeError).code === "string" &&
    (error as PrismaLikeError).name === "PrismaClientKnownRequestError"
  );
}

function zodDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

function mapError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    return fail.validation("Please check the highlighted fields.", zodDetails(error));
  }

  if (isPrismaKnownError(error)) {
    if (error.code === "P2002") {
      return fail.conflict("That value is already in use.");
    }
    if (error.code === "P2025") {
      return fail.notFound();
    }
    if (error.code === "P2003" || error.code === "P2014") {
      return fail.conflict("That change conflicts with another record.");
    }
  }

  const maybeBodyError = error as { type?: string; status?: number } | null;
  if (maybeBodyError?.type === "entity.parse.failed") {
    return fail.validation("Malformed JSON body.");
  }
  if (maybeBodyError?.type === "entity.too.large") {
    return fail.validation("Request body is too large.");
  }

  return fail.internal();
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(fail.notFound());
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const appError = mapError(error);
  const logContext = {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl.split("?")[0],
    status: appError.status,
    code: appError.code,
    userId: req.user?.id,
  };

  if (appError.status >= 500) {
    logger.error({ ...logContext, err: error }, "request failed");
  } else if (appError.status !== 404) {
    logger.warn(logContext, "request rejected");
  }

  const body: ErrorEnvelope = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
    },
  };

  res.status(appError.status).json(body);
}
