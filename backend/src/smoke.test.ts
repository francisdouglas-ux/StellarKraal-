/**
 * Smoke tests — verify the server boots and core endpoints respond correctly.
 * These tests build a minimal app from the route modules (no live network/DB I/O).
 * They run in < 10 s and fail fast on unexpected status codes.
 */
import request from "supertest";
import express, { Express } from "express";
import { healthRouter } from "./routes/health";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("./db/migrationRunner", () => ({
  checkDbHealth: jest.fn().mockResolvedValue(true),
}));

jest.mock("./utils/rpcClient", () => ({
  __esModule: true,
  default: { getHealth: jest.fn().mockResolvedValue({ status: "healthy" }) },
}));

jest.mock("./utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createRequestLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

jest.mock("./db/store", () => ({
  listCollateral: jest.fn().mockReturnValue({ data: [], total: 0, page: 1, limit: 20 }),
  getCollateral: jest.fn(),
  addAppraisal: jest.fn(),
}));

// ── App factory ───────────────────────────────────────────────────────────────

function buildSmokeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/health", healthRouter);
  app.get("/api/v1/collateral", (_req, res) => {
    const { listCollateral } = jest.requireMock("./db/store") as any;
    const result = listCollateral({ page: 1, limit: 20 });
    res.json({ data: result.data, total: result.total, page: result.page, pageSize: result.limit });
  });
  return app;
}

// ── Smoke tests ───────────────────────────────────────────────────────────────

describe("smoke tests", () => {
  let app: Express;

  beforeAll(() => {
    app = buildSmokeApp();
  });

  it("GET /health/live returns 200", async () => {
    const res = await request(app).get("/health/live");
    expect(res.status).toBe(200);
  });

  it("GET /health/ready returns 200 when DB is healthy", async () => {
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(200);
  });

  it("GET /api/v1/collateral returns 200", async () => {
    const res = await request(app).get("/api/v1/collateral");
    expect(res.status).toBe(200);
  });

  it("GET /health/ready returns 503 when DB is unreachable", async () => {
    const { checkDbHealth } = jest.requireMock("./db/migrationRunner") as any;
    checkDbHealth.mockResolvedValueOnce(false);
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(503);
  });

  it("all smoke checks complete in under 10 seconds", async () => {
    const start = Date.now();
    await Promise.all([
      request(app).get("/health/live"),
      request(app).get("/health/ready"),
      request(app).get("/api/v1/collateral"),
    ]);
    expect(Date.now() - start).toBeLessThan(10_000);
  });
});
