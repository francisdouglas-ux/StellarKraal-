import cors from "cors";
import { RequestHandler, Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Parse ALLOWED_ORIGINS env var into a set of allowed origins.
 * Throws at startup if a wildcard is present in production or a pattern is invalid.
 */
export function parseAllowedOrigins(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const origins = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const prod = process.env.NODE_ENV === "production";

  for (const o of origins) {
    if (o === "*") {
      if (prod) {
        throw new Error(
          'ALLOWED_ORIGINS: wildcard "*" is not permitted in production (NODE_ENV=production)',
        );
      }
      continue;
    }
    if (!/^https?:\/\/.+/.test(o)) {
      throw new Error(`ALLOWED_ORIGINS: invalid origin pattern "${o}" — must be an HTTP(S) URL or "*"`);
    }
  }

  return origins;
}

// Parse and validate at module load time (startup validation).
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

if (!allowedOrigins && isProduction && !process.env.FRONTEND_URL) {
  logger.warn(
    "CORS misconfiguration: neither ALLOWED_ORIGINS nor FRONTEND_URL is set in production. " +
      "Requests from the frontend will be blocked.",
  );
}

function isAuthRoute(path: string): boolean {
  return path.startsWith("/api") && path !== "/api/health";
}

function resolveOrigin(
  req: Request,
): cors.CorsOptions["origin"] {
  const authRoute = isAuthRoute(req.path);

  // ALLOWED_ORIGINS takes precedence over FRONTEND_URL
  if (allowedOrigins) {
    if (allowedOrigins.includes("*")) {
      return authRoute ? true : "*";
    }
    return (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    };
  }

  const frontendUrl = process.env.FRONTEND_URL;
  return isProduction
    ? frontendUrl || false
    : frontendUrl || (authRoute ? true : "*");
}

/**
 * Express middleware that applies CORS policy.
 * Reads allowed origins from ALLOWED_ORIGINS (comma-separated) or falls back to FRONTEND_URL.
 * Wildcard "*" is rejected in production.
 */
export const corsMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authRoute = isAuthRoute(req.path);
  cors({
    origin: resolveOrigin(req),
    credentials: authRoute,
    maxAge: 600,
  })(req, res, next);
};
