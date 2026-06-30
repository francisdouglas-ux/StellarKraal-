import { createHash } from 'crypto';
import { Request, Response, NextFunction } from 'express';

interface DedupeEntry {
  status: number;
  body: unknown;
  createdAt: number;
}

const DEDUPE_TTL_MS = 5_000;
const cache = new Map<string, DedupeEntry>();

function dedupeKey(publicKey: string, body: unknown): string {
  const hash = createHash('sha256')
    .update(JSON.stringify(body ?? {}))
    .digest('hex');
  return `${publicKey}:${hash}`;
}

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.createdAt >= DEDUPE_TTL_MS) {
      cache.delete(key);
    }
  }
}

/**
 * Deduplicates identical concurrent POST requests within a 5-second window.
 * Keyed by authenticated wallet address + SHA-256 of the request body.
 * Returns the cached response immediately for duplicates without re-processing.
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Next middleware callback.
 * @returns void
 */
export function deduplicationMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'POST') return next();

  const user = (req as any).user as { publicKey?: string } | undefined;
  if (!user?.publicKey) return next();

  evictExpired();

  const key = dedupeKey(user.publicKey, req.body);
  const cached = cache.get(key);

  if (cached) {
    res.setHeader('X-Deduplicated', 'true');
    res.status(cached.status).json(cached.body);
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      cache.set(key, { status: res.statusCode, body, createdAt: Date.now() });
    }
    return originalJson(body);
  };

  next();
}

/** Exported for testing only — clears the deduplication cache. */
export function _resetDeduplicationCache(): void {
  cache.clear();
}
