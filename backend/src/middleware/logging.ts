import { Request, Response, NextFunction } from "express";
import logger, { createRequestLogger } from "../utils/logger";

/**
 * Logs each completed HTTP request with method, path, status code, and duration.
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Express next function.
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const reqLogger = req.requestId ? createRequestLogger(req.requestId) : logger;

  res.on("finish", () => {
    reqLogger.info("request completed", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startTime,
    });
  });

  next();
}
