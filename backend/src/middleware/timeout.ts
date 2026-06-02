import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/**
 * Creates a request timeout middleware.
 * Returns 504 Gateway Timeout if the request exceeds the given duration.
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

      res.status(503).json({
        error: "Service Unavailable",
        message: "Request exceeded the maximum allowed time of 10 seconds",
      });
    }, ms);

    // Clear the timer once the response is finished
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}
