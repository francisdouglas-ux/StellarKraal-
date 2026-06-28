import winston from "winston";
import { config } from "../config";

const isProd = config.NODE_ENV === "production";

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: isProd
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
          const id = requestId ? ` [${requestId}]` : "";
          const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
          return `${timestamp} [${level}]${id}: ${message}${rest}`;
        })
      ),
  defaultMeta: { service: "stellarkraal-api" },
  transports: [new winston.transports.Console()],
});

/**
 * Create a child logger bound to a specific request ID.
 * @param requestId - The unique request identifier to attach to all log entries.
 * @returns A Winston child logger with the requestId field pre-set.
 */
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}

export default logger;
