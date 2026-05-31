import winston from "winston";
import { AsyncLocalStorage } from "async_hooks";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export const asyncLocalStorage = new AsyncLocalStorage<string>();

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format((info) => {
    const reqId = asyncLocalStorage.getStore();
    if (reqId) {
      info.requestId = reqId;
    }
    return info;
  })(),
  process.env.NODE_ENV === "production"
    ? winston.format.json()
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, requestId, stack }) => {
          return `[${timestamp}] ${level}${requestId ? ` [${requestId}]` : ""}: ${message}${stack ? `\n${stack}` : ""}`;
        })
      )
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  transports: [new winston.transports.Console()],
});

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const reqId = crypto.randomUUID();
  asyncLocalStorage.run(reqId, () => {
    next();
  });
};
