import { Request, Response, NextFunction } from "express";
import logger from "../config/logger";

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on("finish", () => {
    logger.info("request completed", {
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    });
  });

  next();
}
