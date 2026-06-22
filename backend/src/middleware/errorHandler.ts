import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/**
 * Application-level error class with HTTP status code and error code.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Express error handler middleware. Formats and logs all unhandled errors.
 * @param err - The caught error.
 * @param req - Express request object.
 * @param res - Express response object.
 * @param _next - Unused next function (required for Express error handler signature).
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const correlationId = (req as any).requestId ?? "unknown";
  const reqLogger = (req as any).logger ?? logger;

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";

  reqLogger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    code,
    correlationId,
    method: req.method,
    path: req.path,
  });

  console.error("DEBUG ERROR HANDLER:", err);
  res.status(statusCode).json({ error: err.message, code, correlationId });
}
