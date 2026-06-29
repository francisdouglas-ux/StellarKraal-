import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/**
 * Creates a request timeout middleware.
 *
 * Applies a per-route timeout that overrides the global setting when placed
 * after the global `app.use(timeoutMiddleware(...))` call on a specific route.
 * Contract submission routes should use a higher value (e.g. 30 000 ms) because
 * Soroban RPC simulation and transaction preparation can be slow under load.
 * Standard CRUD routes inherit the global default (10 000 ms).
 *
 * @param ms - Timeout duration in milliseconds.
 * @returns Express middleware function that enforces the timeout and responds
 *   with 504 Gateway Timeout including a descriptive error message on expiry.
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
        error: "Gateway Timeout",
        message: `Request exceeded the ${ms} ms timeout for ${req.method} ${req.path}`,
      });
    }, ms);

    // Clear the timer once the response is finished
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}
