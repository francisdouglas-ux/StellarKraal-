/**
 * JWT authentication middleware and auth routes.
 *
 * Flow:
 *   1. GET  /api/auth/challenge  — returns a one-time challenge string
 *   2. POST /api/auth/login      — client submits { publicKey, signature, challenge }
 *                                  backend verifies Stellar signature, issues JWT + refresh token
 *   3. POST /api/auth/refresh    — exchanges a valid refresh token for a new JWT
 *
 * JWT expires in 15 minutes; refresh tokens expire in 7 days.
 * All POST/PUT/DELETE routes (except auth endpoints) require a valid JWT.
 */
import { Request, Response, NextFunction, Router } from "express";
import { createHmac, randomBytes } from "crypto";
import { Keypair } from "@stellar/stellar-sdk";

// ── Config ────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production-min-32-chars!!";
const ACCESS_TTL_MS = 15 * 60 * 1000;       // 15 minutes
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CHALLENGE_TTL_MS = 5 * 60 * 1000;     // 5 minutes

// ── Minimal JWT (HS256, no external dep) ─────────────────────────────────────

function b64url(buf: Buffer | string): string {
  const s = typeof buf === "string" ? Buffer.from(buf) : buf;
  return s.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function signJwt(payload: object): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(
    createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed");
  const [header, body, sig] = parts;
  const expected = b64url(
    createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest()
  );
  if (sig !== expected) throw new Error("invalid signature");
  const payload = JSON.parse(Buffer.from(body, "base64").toString()) as Record<string, unknown>;
  if (typeof payload.exp === "number" && Date.now() > payload.exp) throw new Error("expired");
  return payload;
}

// ── In-memory stores ──────────────────────────────────────────────────────────

// challenge → expiry
const challenges = new Map<string, number>();
// refreshToken → { publicKey, expiry }
const refreshTokens = new Map<string, { publicKey: string; exp: number }>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function issueTokens(publicKey: string) {
  const now = Date.now();
  const accessToken = signJwt({ sub: publicKey, exp: now + ACCESS_TTL_MS, iat: now });
  const refreshToken = randomBytes(32).toString("hex");
  refreshTokens.set(refreshToken, { publicKey, exp: now + REFRESH_TTL_MS });
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_MS / 1000 };
}

// ── Router ────────────────────────────────────────────────────────────────────

export const authRouter = Router();

// GET /api/auth/challenge — issue a one-time challenge
authRouter.get("/challenge", (_req: Request, res: Response) => {
  const challenge = randomBytes(32).toString("hex");
  challenges.set(challenge, Date.now() + CHALLENGE_TTL_MS);
  res.json({ challenge });
});

// POST /api/auth/login — verify Stellar signature, issue JWT
authRouter.post("/login", (req: Request, res: Response) => {
  const { publicKey, signature, challenge } = req.body as {
    publicKey?: string;
    signature?: string;
    challenge?: string;
  };

  if (!publicKey || !signature || !challenge) {
    return res.status(400).json({ error: "publicKey, signature, and challenge are required" });
  }

  // Validate challenge exists and hasn't expired
  const expiry = challenges.get(challenge);
  if (!expiry || Date.now() > expiry) {
    return res.status(401).json({ error: "Invalid or expired challenge" });
  }
  challenges.delete(challenge); // one-time use

  // Verify Stellar ed25519 signature
  try {
    const kp = Keypair.fromPublicKey(publicKey);
    const valid = kp.verify(Buffer.from(challenge, "hex"), Buffer.from(signature, "hex"));
    if (!valid) return res.status(401).json({ error: "Signature verification failed" });
  } catch {
    return res.status(401).json({ error: "Invalid public key or signature" });
  }

  res.json(issueTokens(publicKey));
});

// POST /api/auth/refresh — rotate refresh token
authRouter.post("/refresh", (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(400).json({ error: "refreshToken is required" });

  const entry = refreshTokens.get(refreshToken);
  if (!entry || Date.now() > entry.exp) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  // Rotate: invalidate old token, issue new pair
  refreshTokens.delete(refreshToken);
  res.json(issueTokens(entry.publicKey));
});

// ── JWT middleware ────────────────────────────────────────────────────────────

/**
 * Protects all POST/PUT/DELETE routes except /api/auth/*.
 * Attach as app-level middleware after auth router is mounted.
 */
export function jwtMiddleware(req: Request, res: Response, next: NextFunction): void {
  const mutating = ["POST", "PUT", "DELETE", "PATCH"];
  if (!mutating.includes(req.method)) return next();
  if (req.path.startsWith("/api/auth/")) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization header required" });
    return;
  }

  try {
    const payload = verifyJwt(authHeader.slice(7));
    (req as any).user = { publicKey: payload.sub };
    next();
  } catch (err: any) {
    res.status(401).json({ error: err.message === "expired" ? "Token expired" : "Invalid token" });
  }
}
