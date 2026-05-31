import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

const windowMs = 60 * 1000; // 1 minute

const handler = (_req: Request, res: Response) => {
  res.setHeader("Retry-After", "60");
  res.status(429).json({ error: "Too many requests", retryAfter: 60 });
};

export const authLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_AUTH ?? "10", 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const readLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_READ ?? "100", 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const globalLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_GLOBAL ?? "60", 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const writeLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_WRITE ?? "10", 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
