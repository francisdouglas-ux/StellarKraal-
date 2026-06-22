import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/**
 * Creates a request timeout middleware.
 * Returns 504 Gateway Timeout if the request exceeds the given duration.
 * @param ms - Timeout duration in milliseconds.
 * @returns Express middleware function that enforces the timeout.
 */
export function timeoutMiddleware(ms: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Skip timeout for WebSocket connections
    if (req.headers?.upgrade && req.headers.upgrade.toLowerCase() === "websocket") {
      return next();
    }

    const timer = setTimeout(() => {
      if (res.headersSent) return;

      const elapsedTime = Date.now() - startTime;
      const correlationId = req.correlationId;
      const requestId = (req as any).requestId;

      const reqLogger = (req as any).logger || logger;
      reqLogger.warn("Request timed out", {
        correlationId,
        requestId,
        method: req.method,
        path: req.path,
        elapsedTime: `${elapsedTime}ms`,
        timeoutMs: ms,
      });

      res.status(504).json({
        error: "Request timeout",
      });
    }, ms);

    // Clear the timer once the response is finished
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}
