import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/**
 * Creates a request timeout middleware.
 * Returns 504 Gateway Timeout if the request exceeds the given duration.
 */
export function timeoutMiddleware(ms: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (res.headersSent) return;

      const reqLogger = (req as any).logger || logger;
      reqLogger.warn("Request timeout", {
        requestId: (req as any).requestId,
        method: req.method,
        path: req.path,
        timeoutMs: ms,
      });

      res.status(504).json({ error: "Request timeout" });
    }, ms);

    // Clear the timer once the response is finished
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}
