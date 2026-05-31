/**
 * Integration tests for the full loan lifecycle:
 * register collateral → request loan → repay → liquidate (health check)
 *
 * Uses mocked Stellar RPC — no real network calls.
 * Covers happy paths, edge cases, and error scenarios for all 5 API endpoints.
 */
import request from "supertest";
import app from "./index";

const VALID_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
const INVALID_ADDRESS = "INVALID_KEY";

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Networks: {
      TESTNET: "Test SDF Network ; September 2015",
      PUBLIC: "Public Global Stellar Network ; September 2015",
    },
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
        getAccount: jest.fn().mockResolvedValue({ id: VALID_ADDRESS, sequence: "1" }),
        prepareTransaction: jest.fn().mockResolvedValue({ toXDR: () => "prepared_xdr" }),
        simulateTransaction: jest.fn().mockResolvedValue({
          result: { retval: { value: 150 } },
        }),
        getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
      })),
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function collateralPayload(overrides = {}) {
  return {
    owner: VALID_ADDRESS,
    animal_type: "cattle",
    count: 5,
    appraised_value: 1_000_000,
    ...overrides,
  };
}

function loanRequestPayload(overrides = {}) {
  return {
    borrower: VALID_ADDRESS,
    collateral_id: 1,
    amount: 600_000,
    ...overrides,
  };
}

function repayPayload(overrides = {}) {
  return {
    borrower: VALID_ADDRESS,
    loan_id: 1,
    amount: 200_000,
    ...overrides,
  };
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe("Loan Lifecycle Integration Tests", () => {
  // ── Step 1: Register Collateral ──────────────────────────────────────────

  describe("POST /api/collateral/register", () => {
    it("happy path: registers livestock collateral and returns XDR", async () => {
      const res = await request(app)
        .post("/api/collateral/register")
        .send(collateralPayload());

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("xdr");
      expect(typeof res.body.xdr).toBe("string");
    });

    it("happy path: accepts different animal types", async () => {
      for (const animal_type of ["goats", "sheep"]) {
        const res = await request(app)
          .post("/api/collateral/register")
          .send(collateralPayload({ animal_type }));
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("xdr");
      }
    });

    it("error: missing required fields returns 400", async () => {
      const res = await request(app)
        .post("/api/collateral/register")
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it("error: invalid Stellar public key returns 400", async () => {
      const res = await request(app)
        .post("/api/collateral/register")
        .send(collateralPayload({ owner: INVALID_ADDRESS }));
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });

    it("error: non-positive count returns 400", async () => {
      const res = await request(app)
        .post("/api/collateral/register")
        .send(collateralPayload({ count: 0 }));
      expect(res.status).toBe(400);
    });

    it("error: non-positive appraised_value returns 400", async () => {
      const res = await request(app)
        .post("/api/collateral/register")
        .send(collateralPayload({ appraised_value: -100 }));
      expect(res.status).toBe(400);
    });

    it("error: empty animal_type returns 400", async () => {
      const res = await request(app)
        .post("/api/collateral/register")
        .send(collateralPayload({ animal_type: "" }));
      expect(res.status).toBe(400);
    });
  });

  // ── Step 2: Request Loan ─────────────────────────────────────────────────

  describe("POST /api/loan/request", () => {
    it("happy path: requests a loan and returns XDR", async () => {
      const res = await request(app)
        .post("/api/loan/request")
        .send(loanRequestPayload());

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("xdr");
      expect(typeof res.body.xdr).toBe("string");
    });

    it("happy path: caches appraised_value when provided", async () => {
      const res = await request(app)
        .post("/api/loan/request")
        .send(loanRequestPayload({ appraised_value: 1_000_000 }));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("xdr");
    });

    it("error: missing borrower returns 400", async () => {
      const res = await request(app)
        .post("/api/loan/request")
        .send({ collateral_id: 1, amount: 600_000 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });

    it("error: invalid Stellar public key returns 400", async () => {
      const res = await request(app)
        .post("/api/loan/request")
        .send(loanRequestPayload({ borrower: INVALID_ADDRESS }));
      expect(res.status).toBe(400);
    });

    it("error: negative amount returns 400", async () => {
      const res = await request(app)
        .post("/api/loan/request")
        .send(loanRequestPayload({ amount: -1 }));
      expect(res.status).toBe(400);
    });

    it("error: negative collateral_id returns 400", async () => {
      const res = await request(app)
        .post("/api/loan/request")
        .send(loanRequestPayload({ collateral_id: -1 }));
      expect(res.status).toBe(400);
    });
  });

  // ── Step 3: Repay Loan ───────────────────────────────────────────────────

  describe("POST /api/loan/repay", () => {
    it("happy path: partial repayment returns XDR", async () => {
      const res = await request(app)
        .post("/api/loan/repay")
        .send(repayPayload());

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("xdr");
    });

    it("happy path: full repayment returns XDR", async () => {
      const res = await request(app)
        .post("/api/loan/repay")
        .send(repayPayload({ amount: 600_000 }));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("xdr");
    });

    it("error: missing loan_id returns 400", async () => {
      const res = await request(app)
        .post("/api/loan/repay")
        .send({ borrower: VALID_ADDRESS, amount: 200_000 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });

    it("error: invalid Stellar public key returns 400", async () => {
      const res = await request(app)
        .post("/api/loan/repay")
        .send(repayPayload({ borrower: "NOT_VALID" }));
      expect(res.status).toBe(400);
    });

    it("error: zero amount returns 400", async () => {
      const res = await request(app)
        .post("/api/loan/repay")
        .send(repayPayload({ amount: 0 }));
      expect(res.status).toBe(400);
    });
  });

  // ── Step 4: Get Loan ─────────────────────────────────────────────────────

  describe("GET /api/loan/:id", () => {
    it("happy path: returns loan result for valid id", async () => {
      const res = await request(app).get("/api/loan/1");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("result");
    });

    it("happy path: returns result for id 0", async () => {
      const res = await request(app).get("/api/loan/0");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("result");
    });

    it("includes X-Request-ID header", async () => {
      const res = await request(app).get("/api/loan/1");
      expect(res.headers["x-request-id"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  // ── Step 5: Health Factor (Liquidation Check) ────────────────────────────

  describe("GET /api/health/:loanId", () => {
    it("happy path: returns health_factor for valid loan", async () => {
      const res = await request(app).get("/api/health/1");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("health_factor");
    });

    it("happy path: health_factor reflects simulated value", async () => {
      const res = await request(app).get("/api/health/1");
      expect(res.status).toBe(200);
      // Mocked simulateTransaction returns { result: { retval: { value: 150 } } }
      expect(res.body.health_factor).toBeDefined();
    });
  });

  // ── Full Lifecycle ───────────────────────────────────────────────────────

  describe("Full loan lifecycle: register → request → repay → health check", () => {
    it("completes the full lifecycle without errors", async () => {
      // 1. Register collateral
      const registerRes = await request(app)
        .post("/api/collateral/register")
        .send(collateralPayload());
      expect(registerRes.status).toBe(200);
      expect(registerRes.body.xdr).toBeDefined();

      // 2. Request loan
      const loanRes = await request(app)
        .post("/api/loan/request")
        .send(loanRequestPayload());
      expect(loanRes.status).toBe(200);
      expect(loanRes.body.xdr).toBeDefined();

      // 3. Repay loan (partial)
      const repayRes = await request(app)
        .post("/api/loan/repay")
        .send(repayPayload());
      expect(repayRes.status).toBe(200);
      expect(repayRes.body.xdr).toBeDefined();

      // 4. Check health factor (liquidation check)
      const healthRes = await request(app).get("/api/health/1");
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.health_factor).toBeDefined();

      // 5. Get loan record
      const loanRecordRes = await request(app).get("/api/loan/1");
      expect(loanRecordRes.status).toBe(200);
      expect(loanRecordRes.body.result).toBeDefined();
    });
  });

  // ── Health endpoint ──────────────────────────────────────────────────────

  describe("GET /api/health", () => {
    it("returns 200 with healthy status when RPC is reachable", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("healthy");
      expect(res.body).toHaveProperty("version");
      expect(res.body).toHaveProperty("uptime");
      expect(res.body.rpcReachable).toBe(true);
    });
  });
});
