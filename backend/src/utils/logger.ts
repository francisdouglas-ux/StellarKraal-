import winston from "winston";

const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const NODE_ENV = process.env.NODE_ENV || "development";

/**
 * Winston logger configuration
 * - JSON format in production for log aggregation
 * - Pretty-print format in development for readability
 * - Includes timestamp, log level, and message
 * - Request ID can be added via child logger
 */
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format:
    NODE_ENV === "production"
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      : winston.format.combine(
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          winston.format.errors({ stack: true }),
          winston.format.colorize(),
          winston.format.printf(
            ({ timestamp, level, message, ...meta }) =>
              `${timestamp} [${level}]: ${message} ${
                Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
              }`
          )
        ),
  transports: [new winston.transports.Console()],
});

/**
 * Create a child logger with additional context (e.g., request ID)
 */
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}

export default logger;
