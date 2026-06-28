/**
 * Integration tests for PATCH /api/v1/collateral/:id (issue #596).
 * Covers: partial update, 400 validation, 409 conflict when pledged.
 */
import request from "supertest";
import app from "./index";
import { insertLoan } from "./db/store";

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

const VALID_OWNER = "GBGBE57DSWNBO73HMKLGPCNUR7V4T3WYCXU34AHVZAR3FFFOSVZLEABQ";

jest.mock("./middleware/auth", () => ({
  authRouter: require("express").Router(),
  jwtMiddleware: (req: any, _res: any, next: any) => {
    req.user = { publicKey: VALID_OWNER };
    next();
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createCollateral(overrides = {}) {
  return request(app).post("/api/v1/collateral").send({
    owner: VALID_OWNER, animal_type: "cattle", count: 5, appraised_value: 1_000_000, ...overrides,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/v1/collateral/:id", () => {
  it("partially updates animal_type", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .patch(`/api/v1/collateral/${created.id}`)
      .send({ animal_type: "goats" });
    expect(res.status).toBe(200);
    expect(res.body.animal_type).toBe("goats");
    expect(res.body.count).toBe(5); // unchanged
  });

  it("partially updates count", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .patch(`/api/v1/collateral/${created.id}`)
      .send({ count: 10 });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(10);
  });

  it("partially updates appraised_value", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .patch(`/api/v1/collateral/${created.id}`)
      .send({ appraised_value: 2_000_000 });
    expect(res.status).toBe(200);
    expect(res.body.appraised_value).toBe(2_000_000);
  });

  it("returns 400 if appraised_value is zero", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .patch(`/api/v1/collateral/${created.id}`)
      .send({ appraised_value: 0 });
    expect(res.status).toBe(400);
  });

  it("returns 400 if appraised_value is negative", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .patch(`/api/v1/collateral/${created.id}`)
      .send({ appraised_value: -500 });
    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown fields", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .patch(`/api/v1/collateral/${created.id}`)
      .send({ owner: "GBGBE57DSWNBO73HMKLGPCNUR7V4T3WYCXU34AHVZAR3FFFOSVZLEABQ" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown id", async () => {
    const res = await request(app)
      .patch("/api/v1/collateral/does-not-exist")
      .send({ count: 3 });
    expect(res.status).toBe(404);
  });

  it("returns 409 when collateral is pledged and appraised_value is being reduced", async () => {
    const { body: created } = await createCollateral({ appraised_value: 1_000_000 });
    insertLoan({
      id: `loan-patch-test-${created.id}`,
      borrower: VALID_OWNER,
      collateral_id: created.id,
      amount: 500_000,
      status: "active",
    });
    const res = await request(app)
      .patch(`/api/v1/collateral/${created.id}`)
      .send({ appraised_value: 500_000 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/pledged/);
  });

  it("allows increasing appraised_value even when pledged", async () => {
    const { body: created } = await createCollateral({ appraised_value: 1_000_000 });
    insertLoan({
      id: `loan-patch-increase-${created.id}`,
      borrower: VALID_OWNER,
      collateral_id: created.id,
      amount: 500_000,
      status: "active",
    });
    const res = await request(app)
      .patch(`/api/v1/collateral/${created.id}`)
      .send({ appraised_value: 2_000_000 });
    expect(res.status).toBe(200);
    expect(res.body.appraised_value).toBe(2_000_000);
  });
});
