/**
 * JWT authentication middleware and auth routes.
 *
 * Flow:
 *   1. GET  /api/auth/challenge  — returns a one-time challenge nonce
 *   2. POST /api/auth/login      — client submits { walletAddress, signedChallenge: { nonce, signature } }
 *                                  backend verifies Stellar ed25519 signature, issues JWT + refresh token
 *   3. POST /api/v1/auth/refresh — exchanges a valid httpOnly refresh token cookie for a new JWT
 *                                  and a rotated refresh token cookie; old token is invalidated
 *
 * Access tokens expire in ACCESS_TTL_MS (default 15 min).
 * Refresh tokens expire in REFRESH_TTL_MS (default 7 days) and are stored as SHA-256 hashes.
 * All POST/PUT/DELETE routes (except auth endpoints) require a valid JWT.
 */
import { Request, Response, NextFunction, Router } from 'express';
import { createHmac, createHash, randomBytes } from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { config } from '../config';

// ── Config ────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production-min-32-chars!!';
/** Access token TTL in ms. Reads ACCESS_TTL_MS from config (default 15 min). */
const ACCESS_TTL_MS = parseInt(config.ACCESS_TTL_MS, 10);
/** Refresh token TTL in ms. Reads REFRESH_TTL_MS from config (default 7 days). */
const REFRESH_TTL_MS = parseInt(config.REFRESH_TTL_MS, 10);
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const REFRESH_COOKIE = 'refreshToken';

// ── Minimal JWT (HS256, no external dep) ─────────────────────────────────────

function b64url(buf: Buffer | string): string {
  const s = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return s.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function signJwt(payload: object): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed');
  const [header, body, sig] = parts;
  const expected = b64url(createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest());
  if (sig !== expected) throw new Error('invalid signature');
  const payload = JSON.parse(Buffer.from(body, 'base64').toString()) as Record<string, unknown>;
  if (typeof payload.exp === 'number' && Math.floor(Date.now() / 1000) > payload.exp) throw new Error('expired');
  return payload;
}

// ── In-memory stores ──────────────────────────────────────────────────────────

// challenge → expiry
const challenges = new Map<string, number>();
// tokenHash → { publicKey, expiry }
const refreshTokens = new Map<string, { publicKey: string; exp: number }>();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** SHA-256 hash of a raw token string (stored in DB, never the raw token). */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Issue a new access token and rotate the refresh token.
 * Stores only the hash of the refresh token.
 * @param publicKey - Stellar wallet public key for the user.
 * @returns Access token string and raw refresh token (to be set as cookie).
 */
function issueTokens(publicKey: string): { accessToken: string; rawRefresh: string; expiresIn: number } {
  const now = Date.now();
  const accessToken = signJwt({ sub: publicKey, iat: Math.floor(now / 1000), exp: Math.floor((now + ACCESS_TTL_MS) / 1000) });
  const rawRefresh = randomBytes(32).toString('hex');
  refreshTokens.set(hashToken(rawRefresh), { publicKey, exp: now + REFRESH_TTL_MS });
  return { accessToken, rawRefresh, expiresIn: ACCESS_TTL_MS / 1000 };
}

/**
 * Set the refresh token as an httpOnly, Secure, SameSite=Strict cookie.
 * @param res - Express response object.
 * @param rawToken - Raw (unhashed) refresh token string.
 */
function setRefreshCookie(res: Response, rawToken: string): void {
  res.cookie(REFRESH_COOKIE, rawToken, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_TTL_MS,
    path: '/api/v1/auth/refresh',
  });
}

// ── Router ────────────────────────────────────────────────────────────────────

export const authRouter = Router();

// GET /api/auth/challenge — issue a one-time challenge
authRouter.get('/challenge', (_req: Request, res: Response) => {
  const challenge = randomBytes(32).toString('hex');
  challenges.set(challenge, Date.now() + CHALLENGE_TTL_MS);
  res.json({ challenge });
});

// POST /api/auth/login — verify Stellar wallet signature, issue JWT
// Accepts { walletAddress, signedChallenge: { nonce, signature } }
authRouter.post('/login', (req: Request, res: Response) => {
  const { walletAddress, signedChallenge } = req.body as {
    walletAddress?: string;
    signedChallenge?: { nonce?: string; signature?: string };
  };

  if (!walletAddress || !signedChallenge?.nonce || !signedChallenge?.signature) {
    return res.status(400).json({
      error: 'walletAddress and signedChallenge (with nonce and signature) are required',
    });
  }

  const { nonce, signature } = signedChallenge;

  // Validate nonce was issued by this server and hasn't expired
  const expiry = challenges.get(nonce);
  if (!expiry || Date.now() > expiry) {
    return res.status(401).json({ error: 'Invalid or expired challenge' });
  }
  challenges.delete(nonce); // one-time use

  // Verify Stellar ed25519 signature
  try {
    const kp = Keypair.fromPublicKey(walletAddress);
    const valid = kp.verify(Buffer.from(nonce, 'hex'), Buffer.from(signature, 'hex'));
    if (!valid) return res.status(401).json({ error: 'Signature verification failed' });
  } catch {
    return res.status(401).json({ error: 'Invalid wallet address or signature' });
  }

  const { accessToken, rawRefresh, expiresIn } = issueTokens(walletAddress);
  setRefreshCookie(res, rawRefresh);
  res.json({ accessToken, expiresIn });
});

/**
 * POST /api/v1/auth/refresh — rotate refresh token using httpOnly cookie.
 *
 * Reads the refresh token from the `refreshToken` httpOnly cookie.
 * Validates the hash against the stored entry, invalidates the old token,
 * and issues a new access token + rotated refresh token cookie.
 *
 * @returns { accessToken, expiresIn } on success.
 * @returns 400 if the cookie is missing.
 * @returns 401 if the token is invalid, revoked, or expired.
 */
authRouter.post('/refresh', (req: Request, res: Response) => {
  const cookieHeader = req.headers.cookie ?? '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE}=([^;]+)`));
  const rawToken = match?.[1];

  if (!rawToken) {
    return res.status(400).json({ error: 'MISSING_TOKEN', message: 'Refresh token cookie is required' });
  }

  const tokenHash = hashToken(rawToken);
  const entry = refreshTokens.get(tokenHash);

  if (!entry || Date.now() > entry.exp) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Refresh token is invalid or expired' });
  }

  // Rotate: invalidate old token hash, issue new pair
  refreshTokens.delete(tokenHash);
  const { accessToken, rawRefresh, expiresIn } = issueTokens(entry.publicKey);
  setRefreshCookie(res, rawRefresh);
  res.json({ accessToken, expiresIn });
});

// ── JWT middleware ────────────────────────────────────────────────────────────

// Protected GET routes (in addition to all mutating methods)
const PROTECTED_GET_PATTERNS = [
  /^\/api\/loans\/[^/]+$/,
  /^\/api\/collateral$/,
  /^\/api\/v1\/loans\/summary$/,
];

/**
 * Protects all POST/PUT/DELETE/PATCH routes and specific GET routes.
 * Public routes: /api/auth/*, /api/health, GET /api/v1/health.
 * Attach as app-level middleware after auth router is mounted.
 * @param req - Incoming Express request.
 * @param res - Express response object.
 * @param next - Next middleware callback.
 * @returns void
 */
export function jwtMiddleware(req: Request, res: Response, next: NextFunction): void {
  const mutating = ['POST', 'PUT', 'DELETE', 'PATCH'];
  const isProtectedGet =
    req.method === 'GET' && PROTECTED_GET_PATTERNS.some((p) => p.test(req.path));

  if (!mutating.includes(req.method) && !isProtectedGet) return next();
  if (req.path.startsWith('/api/auth/')) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  try {
    const payload = verifyJwt(authHeader.slice(7));
    (req as Request & { user: { publicKey: unknown } }).user = { publicKey: payload.sub };
    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    res.status(401).json({ error: message === 'expired' ? 'Token expired' : 'Invalid token' });
  }
}

/** Exported for testing only — clears in-memory refresh token store. */
export function _resetRefreshTokens(): void {
  refreshTokens.clear();
}
