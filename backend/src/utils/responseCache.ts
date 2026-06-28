import { Request, Response, NextFunction } from "express";
import logger from "./logger";

const DEFAULT_CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry {
  body: unknown;
  cachedAt: number;
}

const store = new Map<string, CacheEntry>();

function cacheKey(req: Request): string {
  const userKey = (req as Request & { user?: { publicKey?: string } }).user?.publicKey ?? "anonymous";
  return `${req.path}?${new URLSearchParams(req.query as Record<string, string>).toString()}::${userKey}`;
}

function isExpired(entry: CacheEntry, ttlMs: number): boolean {
  return Date.now() - entry.cachedAt > ttlMs;
}

/** Middleware that caches GET responses for 30 s and respects Cache-Control: no-cache.
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Next middleware callback.
 */
/**
 * Create a response-cache middleware with a configurable TTL.
 * @param ttlMs - Cache time-to-live in milliseconds.
 * @returns Express middleware that caches successful JSON responses.
 */
export function createResponseCacheMiddleware(ttlMs: number = DEFAULT_CACHE_TTL_MS) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const noCache =
      req.headers["cache-control"] === "no-cache" ||
      req.headers["pragma"] === "no-cache";

    const key = cacheKey(req);

    if (!noCache) {
      const entry = store.get(key);
      if (entry && !isExpired(entry, ttlMs)) {
        logger.debug("response_cache_hit", { path: req.path, key, ttlMs });
        res.setHeader("X-Cache", "HIT");
        res.json(entry.body);
        return;
      }
      logger.debug("response_cache_miss", { path: req.path, key, ttlMs });
    }

    // Intercept res.json to capture the response body for caching
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode === 200 && !noCache) {
        store.set(key, { body, cachedAt: Date.now() });
      }
      res.setHeader("X-Cache", "MISS");
      return originalJson(body);
    };

    next();
  };
}

export const responseCacheMiddleware = createResponseCacheMiddleware();

/** Invalidate all cache entries whose path matches the given prefix.
 * @param pathPrefix - The URL path prefix to match for invalidation.
 */
export function invalidateCache(pathPrefix: string): void {
  let count = 0;
  for (const key of store.keys()) {
    if (key.startsWith(pathPrefix)) {
      store.delete(key);
      count++;
    }
  }
  if (count > 0) {
    logger.debug("response_cache_invalidated", { pathPrefix, count });
  }
}
