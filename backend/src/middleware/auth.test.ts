import { createHmac } from "crypto";
import request from "supertest";
import { Keypair } from "@stellar/stellar-sdk";
import app from "../index";
import { jwtMiddleware, _resetRefreshTokens } from "./auth";

jest.mock("../utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createRequestLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

// Avoid jest.requireActual("@stellar/stellar-sdk") — some transitive deps use
// ESM import statements that ts-jest cannot transform. Define a self-contained
// mock with a crypto-based Keypair stand-in instead.
jest.mock("@stellar/stellar-sdk", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHmac: hmac } = require("crypto") as typeof import("crypto");
  // Registry: publicKey → seed, so fromPublicKey can verify signatures produced by random()
  const registry = new Map<string, Buffer>();
  class KP {
    constructor(private pub: string, private seed: Buffer) {}
    static random() {
      const seed = Buffer.from(String(Math.random()));
      const pub = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV2";
      registry.set(pub, seed);
      return new KP(pub, seed);
    }
    static fromPublicKey(pub: string) {
      const seed = registry.get(pub) ?? Buffer.alloc(32, pub);
      return new KP(pub, seed);
    }
    publicKey() { return this.pub; }
    sign(data: Buffer) { return hmac("sha512", this.seed).update(data).digest(); }
    verify(data: Buffer, sig: Buffer) { return hmac("sha512", this.seed).update(data).digest().equals(sig); }
  }
  return {
    Keypair: KP,
    StrKey: { isValidEd25519PublicKey: () => true },
    Networks: { TESTNET: "Test SDF Network ; September 2015", PUBLIC: "Public Global Stellar Network ; September 2015" },
    BASE_FEE: "100",
    Contract: jest.fn(() => ({ call: jest.fn().mockReturnValue({}) })),
    TransactionBuilder: jest.fn(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ toXDR: () => "mock_xdr" }),
    })),
    Address: jest.fn(() => ({ toScVal: jest.fn().mockReturnValue({}) })),
    nativeToScVal: jest.fn().mockReturnValue({}),
    SorobanRpc: {
      Server: jest.fn(() => ({
        getAccount: jest.fn().mockResolvedValue({ id: "GABC", sequence: "1" }),
        prepareTransaction: jest.fn().mockResolvedValue({ toXDR: () => "prepared_xdr" }),
        simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: {} } }),
        getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
      })),
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getChallenge(): Promise<string> {
  const res = await request(app).get("/api/auth/challenge");
  expect(res.status).toBe(200);
  return res.body.challenge as string;
}

async function login(kp: any): Promise<{ accessToken: string; expiresIn: number; refreshCookie: string }> {
  const challenge = await getChallenge();
  const res = await request(app).post("/api/auth/login").send({
    walletAddress: kp.publicKey(),
    signedChallenge: { nonce: challenge, signature: kp.sign(Buffer.from(challenge, "hex")).toString("hex") },
  });
  expect(res.status).toBe(200);
  const cookieHeader: string = (res.headers["set-cookie"] as unknown as string[])?.[0] ?? "";
  return { ...res.body, refreshCookie: cookieHeader };
}

const JWT_SECRET = "change-me-in-production-min-32-chars!!";
function b64url(buf: Buffer | string): string {
  const s = typeof buf === "string" ? Buffer.from(buf) : buf;
  return s.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function makeToken(payload: object, secret = JWT_SECRET): string {
  const h = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const b = b64url(JSON.stringify(payload));
  return `${h}.${b}.${b64url(createHmac("sha256", secret).update(`${h}.${b}`).digest())}`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("JWT Authentication", () => {
  const kp = (Keypair as any).random();

  beforeEach(() => { _resetRefreshTokens(); });

  app.post("/__test/user", jwtMiddleware, (req, res) => {
    res.json({ user: (req as any).user ?? null });
  });

  describe("GET /api/auth/challenge", () => {
    it("returns a 64-char hex challenge", async () => {
      const res = await request(app).get("/api/auth/challenge");
      expect(res.status).toBe(200);
      expect(res.body.challenge).toMatch(/^[0-9a-f]{64}$/);
    });

    it("each call returns a unique challenge", async () => {
      expect(await getChallenge()).not.toBe(await getChallenge());
    });
  });

  describe("POST /api/auth/login", () => {
    it("returns accessToken and sets httpOnly refreshToken cookie", async () => {
      const { accessToken, refreshCookie } = await login(kp);
      expect(typeof accessToken).toBe("string");
      expect(refreshCookie).toContain("refreshToken=");
      expect(refreshCookie).toContain("HttpOnly");
    });

    it("expiresIn is 900 (15 min)", async () => {
      expect((await login(kp)).expiresIn).toBe(900);
    });

    it("rejects missing fields with 400", async () => {
      expect((await request(app).post("/api/auth/login").send({})).status).toBe(400);
    });

    it("challenge is single-use", async () => {
      const challenge = await getChallenge();
      const body = {
        walletAddress: kp.publicKey(),
        signedChallenge: { nonce: challenge, signature: kp.sign(Buffer.from(challenge, "hex")).toString("hex") },
      };
      expect((await request(app).post("/api/auth/login").send(body)).status).toBe(200);
      expect((await request(app).post("/api/auth/login").send(body)).status).toBe(401);
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("returns new accessToken and rotated refresh cookie", async () => {
      const { refreshCookie } = await login(kp);
      const res = await request(app).post("/api/auth/refresh").set("Cookie", refreshCookie.split(";")[0]);
      expect(res.status).toBe(200);
      expect(typeof res.body.accessToken).toBe("string");
      expect((res.headers["set-cookie"] as unknown as string[])?.[0]).toContain("refreshToken=");
    });

    it("old token rejected after rotation (revocation)", async () => {
      const { refreshCookie } = await login(kp);
      const cv = refreshCookie.split(";")[0];
      await request(app).post("/api/auth/refresh").set("Cookie", cv);
      const res = await request(app).post("/api/auth/refresh").set("Cookie", cv);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("INVALID_TOKEN");
    });

    it("missing cookie returns 400", async () => {
      const res = await request(app).post("/api/auth/refresh");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("MISSING_TOKEN");
    });

    it("invalid token returns 401", async () => {
      const res = await request(app).post("/api/auth/refresh").set("Cookie", "refreshToken=bogus");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("INVALID_TOKEN");
    });
  });

  describe("JWT middleware", () => {
    it("POST without token → 401", async () => {
      expect((await request(app).post("/api/collateral/register").send({})).status).toBe(401);
    });

    it("POST with valid token → succeeds", async () => {
      const { accessToken } = await login(kp);
      const res = await request(app)
        .post("/api/collateral/register")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ owner: kp.publicKey(), animal_type: "cattle", count: 5, appraised_value: 1_000_000 });
      expect(res.status).toBe(200);
    });

    it("tampered token → 401", async () => {
      const { accessToken } = await login(kp);
      expect(
        (await request(app).post("/api/collateral/register").set("Authorization", `Bearer ${accessToken.slice(0, -4)}xxxx`).send({})).status
      ).toBe(401);
    });

    it("GET /api/health is public", async () => {
      expect((await request(app).get("/api/health")).status).toBe(200);
    });

    it("sets req.user from valid token", async () => {
      const { accessToken } = await login(kp);
      const res = await request(app).post("/__test/user").set("Authorization", `Bearer ${accessToken}`).send({});
      expect(res.body.user).toEqual({ publicKey: kp.publicKey() });
    });

    it("expired token → 401 Token expired", async () => {
      const token = makeToken({ sub: kp.publicKey(), exp: Math.floor(Date.now() / 1000) - 10, iat: 0 });
      const res = await request(app).post("/api/collateral/register").set("Authorization", `Bearer ${token}`).send({});
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Token expired");
    });

    it("malformed token → 401", async () => {
      const res = await request(app).post("/api/collateral/register").set("Authorization", "Bearer not.valid.jwt").send({});
      expect(res.status).toBe(401);
    });

    it("wrong-secret token → 401", async () => {
      const token = makeToken({ sub: kp.publicKey(), exp: Math.floor(Date.now() / 1000) + 100, iat: 0 }, "wrong");
      const res = await request(app).post("/api/collateral/register").set("Authorization", `Bearer ${token}`).send({});
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid token");
    });
  });
});
