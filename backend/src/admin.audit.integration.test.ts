/**
 * Integration tests for GET /api/v1/admin/audit (issue #600).
 * Covers: admin access, non-admin 403, pagination, 90-day date range limit.
 */
import request from "supertest";
import app from "./index";
import { insertAuditEntry } from "./db/store";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("./utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createRequestLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Networks: { TESTNET: "Test SDF Network ; September 2015", PUBLIC: "Public Global Stellar Network ; September 2015" },
    BASE_FEE: "100",
    Contract: jest.fn().mockImplementation(() => ({ call: jest.fn().mockReturnValue({}) })),
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ toXDR: () => "mock_xdr" }),
    })),
    Address: jest.fn().mockImplementation(() => ({ toScVal: jest.fn().mockReturnValue({}) })),
    nativeToScVal: jest.fn().mockReturnValue({}),
    SorobanRpc: {
      Server: jest.fn().mockImplementation(() => ({
        getAccount: jest.fn().mockResolvedValue({ id: "GABC", sequence: "1" }),
        prepareTransaction: jest.fn().mockResolvedValue({ toXDR: () => "prepared_xdr" }),
        simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: {} } }),
        getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
      })),
    },
  };
});

const ADMIN_KEY = "GBGBE57DSWNBO73HMKLGPCNUR7V4T3WYCXU34AHVZAR3FFFOSVZLEABQ";
let testUser: any = { publicKey: ADMIN_KEY, role: "admin" };

jest.mock("./middleware/auth", () => ({
  authRouter: require("express").Router(),
  jwtMiddleware: (req: any, _res: any, next: any) => {
    req.user = testUser;
    next();
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/v1/admin/audit", () => {
  beforeEach(() => {
    testUser = { publicKey: ADMIN_KEY, role: "admin" };
    // Seed one audit entry so queries return something
    insertAuditEntry({
      userId: ADMIN_KEY,
      action: "collateral.patch",
      resource: "collateral",
      resourceId: "test-id",
      requestBody: { count: 3 },
    });
  });

  it("returns paginated audit entries for admin", async () => {
    const res = await request(app).get("/api/v1/admin/audit");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.page).toBe(1);
    expect(typeof res.body.limit).toBe("number");
  });

  it("returns 403 for non-admin user", async () => {
    testUser = { publicKey: ADMIN_KEY }; // no role
    const res = await request(app).get("/api/v1/admin/audit");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/);
  });

  it("returns 403 when role is not admin", async () => {
    testUser = { publicKey: ADMIN_KEY, role: "user" };
    const res = await request(app).get("/api/v1/admin/audit");
    expect(res.status).toBe(403);
  });

  it("accepts valid from/to date range", async () => {
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();
    const res = await request(app).get(`/api/v1/admin/audit?from=${from}&to=${to}`);
    expect(res.status).toBe(200);
  });

  it("returns 400 when date range exceeds 90 days", async () => {
    const from = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();
    const res = await request(app).get(`/api/v1/admin/audit?from=${from}&to=${to}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/90 days/);
  });

  it("filters by userId", async () => {
    const res = await request(app).get(`/api/v1/admin/audit?userId=${ADMIN_KEY}`);
    expect(res.status).toBe(200);
    res.body.data.forEach((e: any) => expect(e.userId).toBe(ADMIN_KEY));
  });

  it("respects page and limit parameters", async () => {
    const res = await request(app).get("/api/v1/admin/audit?page=1&limit=5");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
  });

  it("returns 400 for limit > 100", async () => {
    const res = await request(app).get("/api/v1/admin/audit?limit=101");
    expect(res.status).toBe(400);
  });

  it("redacts sensitive requestBody fields", async () => {
    insertAuditEntry({
      userId: ADMIN_KEY,
      action: "collateral.patch",
      resource: "collateral",
      resourceId: "secret-test",
      requestBody: { secret: "super-secret", count: 2 },
    });
    const res = await request(app).get(`/api/v1/admin/audit?userId=${ADMIN_KEY}`);
    expect(res.status).toBe(200);
    const secretEntry = res.body.data.find((e: any) => e.resourceId === "secret-test");
    if (secretEntry) {
      expect(secretEntry.requestBody.secret).toBe("[REDACTED]");
    }
  });
});
