import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

declare module "express-serve-static-core" {
  interface Request {
    correlationId: string;
  }
}

/**
 * Express middleware that attaches a correlation ID to every request.
 * Uses the incoming `x-correlation-id` header if present, otherwise generates a new UUID.
 * @param req - Incoming Express request.
 * @param res - Express response object.
 * @param next - Next middleware callback.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers["x-correlation-id"] as string) || randomUUID();
  req.correlationId = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);
  next();
}
