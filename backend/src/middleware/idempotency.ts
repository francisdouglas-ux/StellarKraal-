interface IdempotencyEntry {
  status: number;
  body: unknown;
  createdAt: number;
}

const cache = new Map<string, IdempotencyEntry>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Retrieve a cached idempotency entry, evicting it if expired.
 * @param key - The idempotency key supplied by the client.
 * @returns The cached entry, or undefined if absent or expired.
 */
export function getIdempotencyEntry(key: string): IdempotencyEntry | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

/**
 * Store a response in the idempotency cache.
 * @param key - The idempotency key supplied by the client.
 * @param status - HTTP status code of the response.
 * @param body - Response body to cache.
 */
export function setIdempotencyEntry(key: string, status: number, body: unknown): void {
  cache.set(key, { status, body, createdAt: Date.now() });
}
