/**
 * API key authentication for machine-to-machine calls.
 *
 * Keys are prefixed with `sk_` and stored hashed (SHA-256) in memory.
 * Clients pass them as: Authorization: Bearer sk_...
 *
 * Threat model: API keys are long-lived credentials intended for server-to-server
 * use. They are hashed before storage so a memory dump does not expose raw keys.
 * Keys can be revoked immediately via DELETE endpoint. Each key carries the
 * public key of the issuing user so downstream handlers can enforce ownership.
 */
import { Request, Response, NextFunction, Router } from 'express';
import { createHash, randomBytes } from 'crypto';

export interface ApiKeyRecord {
  id: string;
  ownerPublicKey: string;
  keyHash: string;
  createdAt: number;
  revokedAt?: number;
}

// In-memory store: id → ApiKeyRecord
const apiKeys = new Map<string, ApiKeyRecord>();

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export const apiKeyRouter = Router();

/**
 * POST /api/v1/admin/api-keys
 * Creates a new API key for the authenticated user.
 * Returns the raw key once — it cannot be retrieved again.
 */
apiKeyRouter.post('/', (req: Request, res: Response) => {
  const user = (req as Request & { user?: { publicKey: string } }).user;
  if (!user?.publicKey) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const raw = 'sk_' + randomBytes(32).toString('hex');
  const id = randomBytes(8).toString('hex');
  apiKeys.set(id, {
    id,
    ownerPublicKey: user.publicKey,
    keyHash: hashKey(raw),
    createdAt: Date.now(),
  });

  return res.status(201).json({ id, key: raw, message: 'Store this key — it will not be shown again.' });
});

/**
 * DELETE /api/v1/admin/api-keys/:id
 * Revokes an API key by ID. Only the owning user may revoke their own keys.
 */
apiKeyRouter.delete('/:id', (req: Request, res: Response) => {
  const user = (req as Request & { user?: { publicKey: string } }).user;
  if (!user?.publicKey) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const record = apiKeys.get(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'API key not found' });
  }
  if (record.ownerPublicKey !== user.publicKey) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  record.revokedAt = Date.now();
  return res.json({ message: 'API key revoked' });
});

/**
 * Attempt to authenticate a request using an API key.
 * Returns the ownerPublicKey if valid, null otherwise.
 */
export function authenticateApiKey(authHeader: string): string | null {
  if (!authHeader.startsWith('Bearer sk_')) return null;
  const raw = authHeader.slice(7); // strip "Bearer "
  const hashed = hashKey(raw);

  for (const record of apiKeys.values()) {
    if (record.keyHash === hashed) {
      if (record.revokedAt) return null; // revoked
      return record.ownerPublicKey;
    }
  }
  return null;
}
