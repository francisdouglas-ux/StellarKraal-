import request from "supertest";
import app from "./index";
import {
  insertCollateral,
  insertLoan,
} from "./db/store";

// Valid 56-char Stellar public key for use in tests
const TEST_PUBLIC_KEY = "GDVXGGW5LDCKNPGP2QNOUTNAITBJOUEKSXDTYMTEJE2SHYDIBLTXZ3GO";

// Mock auth middleware to bypass JWT in tests
jest.mock("./middleware/auth", () => ({
  authRouter: (() => {
    const { Router } = require("express");
    return Router();
  })(),
  jwtMiddleware: (_req: any, _res: any, next: any) => next(),
}));

// Mock rpcClient to avoid real network calls
jest.mock("./utils/rpcClient", () => ({
  __esModule: true,
  default: {
    getAccount: jest.fn().mockResolvedValue({ id: "GABC", sequence: "1" }),
    prepareTransaction: jest.fn().mockResolvedValue({ toXDR: () => "prepared_xdr" }),
    simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: { value: 42 } } }),
    getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
  },
}));

// Mock the logger
jest.mock("./utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  createRequestLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock stellar-sdk to avoid real network calls
jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Networks: { TESTNET: "Test SDF Network ; September 2015", PUBLIC: "Public Global Stellar Network ; September 2015" },
    BASE_FEE: "100",
    Contract: jest.fn().mockImplementation(() => ({
      call: jest.fn().mockReturnValue({ type: "invokeHostFunction" }),
    })),
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ toXDR: () => "mock_xdr_base64" }),
    })),
    Address: jest.fn().mockImplementation(() => ({
      toScVal: jest.fn().mockReturnValue({}),
    })),
    nativeToScVal: jest.fn().mockReturnValue({}),
    SorobanRpc: {
      Server: jest.fn().mockImplementation(() => ({
        getAccount: jest.fn().mockResolvedValue({ id: "GABC", sequence: "1" }),
        prepareTransaction: jest.fn().mockResolvedValue({ toXDR: () => "prepared_xdr" }),
        simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: { value: 42 } } }),
        getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
      })),
    },
  };
});

describe("StellarKraal API", () => {
  describe("GET /api/health", () => {
    it("returns 200 with health status", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status");
      expect(res.body).toHaveProperty("version");
      expect(res.body).toHaveProperty("uptime");
      expect(res.body).toHaveProperty("rpcReachable");
    });

    it("includes correct health data structure", async () => {
      const res = await request(app).get("/api/health");
      expect(res.body.status).toBe("healthy");
      expect(typeof res.body.version).toBe("string");
      expect(typeof res.body.uptime).toBe("number");
      expect(typeof res.body.rpcReachable).toBe("boolean");
    });
  });

  describe("POST /api/collateral/register", () => {
    it("returns xdr for valid payload", async () => {
      const res = await request(app).post("/api/collateral/register").send({
        owner: TEST_PUBLIC_KEY,
        animal_type: "cattle",
        count: 5,
        appraised_value: 1000000,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("xdr");
    });

    it("returns 400 for missing fields", async () => {
      const res = await request(app).post("/api/collateral/register").send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Validation failed");
    });

    it("returns 400 for invalid Stellar public key", async () => {
      const res = await request(app).post("/api/collateral/register").send({
        owner: "INVALID_KEY",
        animal_type: "cattle",
        count: 5,
        appraised_value: 1000000,
      });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Validation failed");
      expect(res.body.details[0].message).toContain("Stellar public key");
    });
  });

  describe("POST /api/loan/request", () => {
    it("returns xdr for valid payload", async () => {
      const res = await request(app).post("/api/loan/request").send({
        borrower: TEST_PUBLIC_KEY,
        collateral_id: 1,
        amount: 600000,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("xdr");
    });

    it("returns 400 for invalid Stellar public key", async () => {
      const res = await request(app).post("/api/loan/request").send({
        borrower: "SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
        collateral_id: 1,
        amount: 600000,
      });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Validation failed");
    });
  });

  describe("POST /api/loan/repay", () => {
    it("returns xdr for valid payload with idempotency key", async () => {
      const res = await request(app)
        .post("/api/loan/repay")
        .set("Idempotency-Key", "test-key-001")
        .send({
          borrower: TEST_PUBLIC_KEY,
          loan_id: 1,
          amount: 200000,
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("xdr");
    });

    it("returns 400 when Idempotency-Key header is missing", async () => {
      const res = await request(app).post("/api/loan/repay").send({
        borrower: TEST_PUBLIC_KEY,
        loan_id: 1,
        amount: 200000,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Idempotency-Key/);
    });

    it("returns cached response for duplicate idempotency key", async () => {
      const key = `idem-dup-${Date.now()}`;
      const payload = {
        borrower: TEST_PUBLIC_KEY,
        loan_id: 2,
        amount: 100000,
      };
      const first = await request(app).post("/api/loan/repay").set("Idempotency-Key", key).send(payload);
      const second = await request(app).post("/api/loan/repay").set("Idempotency-Key", key).send(payload);
      expect(second.status).toBe(first.status);
      expect(second.body).toEqual(first.body);
      expect(second.headers["x-idempotent-replayed"]).toBe("true");
    });

    it("returns 400 for invalid Stellar public key", async () => {
      const res = await request(app)
        .post("/api/loan/repay")
        .set("Idempotency-Key", "test-key-invalid")
        .send({
          borrower: "NOT_A_VALID_KEY",
          loan_id: 1,
          amount: 200000,
        });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Validation failed");
    });
  });

  describe("GET /api/loans (pagination)", () => {
    it("returns paginated envelope with defaults", async () => {
      const res = await request(app).get("/api/loans");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("page", 1);
      expect(res.body).toHaveProperty("pageSize", 20);
    });

    it("respects ?page and ?pageSize params", async () => {
      const res = await request(app).get("/api/loans?page=2&pageSize=10");
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.pageSize).toBe(10);
    });

    it("returns 400 for invalid page param", async () => {
      const res = await request(app).get("/api/loans?page=0");
      expect(res.status).toBe(400);
    });

    it("returns 400 for pageSize > 100", async () => {
      const res = await request(app).get("/api/loans?pageSize=101");
      expect(res.status).toBe(400);
    });

    it("adds deprecation warning header when no pagination params", async () => {
      const res = await request(app).get("/api/loans");
      expect(res.headers["deprecation"]).toBe("true");
    });
  });

  describe("GET /api/loan/:id", () => {
    it("returns result for valid id", async () => {
      const res = await request(app).get("/api/loan/1");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("result");
    });
  });

  describe("GET /api/health/:loanId", () => {
    it("returns health_factor for valid id", async () => {
      const res = await request(app).get("/api/health/1");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("health_factor");
    });
  });

  describe("Request ID middleware", () => {
    it("adds X-Request-ID header to response", async () => {
      const res = await request(app).get("/api/loan/1");
      expect(res.headers["x-request-id"]).toBeDefined();
      expect(res.headers["x-request-id"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe("Soft-delete: collateral", () => {
    let collateralId: string;

    beforeEach(() => {
      const record = insertCollateral({
        id: `col-${Date.now()}`,
        owner: TEST_PUBLIC_KEY,
        animal_type: "cattle",
        count: 3,
        appraised_value: 500000,
      });
      collateralId = record.id;
    });

    it("DELETE /api/collateral/:id soft-deletes the record", async () => {
      const res = await request(app).delete(`/api/collateral/${collateralId}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: true, id: collateralId });
    });

    it("DELETE /api/collateral/:id returns 404 for unknown id", async () => {
      const res = await request(app).delete("/api/collateral/nonexistent");
      expect(res.status).toBe(404);
    });

    it("GET /api/admin/deleted/collateral lists soft-deleted records", async () => {
      await request(app).delete(`/api/collateral/${collateralId}`);
      const res = await request(app).get("/api/admin/deleted/collateral");
      expect(res.status).toBe(200);
      const ids = res.body.map((r: any) => r.id);
      expect(ids).toContain(collateralId);
      res.body.forEach((r: any) => expect(r.deletedAt).not.toBeNull());
    });

    it("POST /api/admin/restore/collateral/:id restores the record", async () => {
      await request(app).delete(`/api/collateral/${collateralId}`);
      const res = await request(app).post(`/api/admin/restore/collateral/${collateralId}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ restored: true, id: collateralId });
    });

    it("POST /api/admin/restore/collateral/:id returns 404 for non-deleted record", async () => {
      const res = await request(app).post(`/api/admin/restore/collateral/${collateralId}`);
      expect(res.status).toBe(404);
    });
  });

  describe("Soft-delete: loans", () => {
    let loanId: string;

    beforeEach(() => {
      const record = insertLoan({
        id: `loan-${Date.now()}`,
        borrower: TEST_PUBLIC_KEY,
        collateral_id: "col-1",
        amount: 300000,
      });
      loanId = record.id;
    });

    it("DELETE /api/loan/:id soft-deletes the record", async () => {
      const res = await request(app).delete(`/api/loan/${loanId}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: true, id: loanId });
    });

    it("DELETE /api/loan/:id returns 404 for unknown id", async () => {
      const res = await request(app).delete("/api/loan/nonexistent-loan");
      expect(res.status).toBe(404);
    });

    it("GET /api/admin/deleted/loans lists soft-deleted records", async () => {
      await request(app).delete(`/api/loan/${loanId}`);
      const res = await request(app).get("/api/admin/deleted/loans");
      expect(res.status).toBe(200);
      const ids = res.body.map((r: any) => r.id);
      expect(ids).toContain(loanId);
      res.body.forEach((r: any) => expect(r.deletedAt).not.toBeNull());
    });

    it("POST /api/admin/restore/loans/:id restores the record", async () => {
      await request(app).delete(`/api/loan/${loanId}`);
      const res = await request(app).post(`/api/admin/restore/loans/${loanId}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ restored: true, id: loanId });
    });

    it("POST /api/admin/restore/loans/:id returns 404 for non-deleted record", async () => {
      const res = await request(app).post(`/api/admin/restore/loans/${loanId}`);
      expect(res.status).toBe(404);
    });
  });
});
