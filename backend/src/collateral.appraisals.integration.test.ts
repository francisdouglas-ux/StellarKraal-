/**
 * Integration tests for GET /api/v1/collateral/:id/appraisals
 * Covers: multi-appraisal history, empty history, pagination, 404 for unknown/unowned collateral.
 */
import request from "supertest";
import app from "./index";

jest.mock("./utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createRequestLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

jest.mock("@stellar/stellar-sdk", () => {
  const isValidEd25519PublicKey = (v: string) =>
    typeof v === "string" && v.length === 56 && v.startsWith("G");
  return {
    StrKey: { isValidEd25519PublicKey },
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
      build: jest.fn().mockReturnValue({ toXDR: () => "mock_xdr" }),
    })),
    Address: jest.fn().mockImplementation(() => ({ toScVal: jest.fn().mockReturnValue({}) })),
    nativeToScVal: jest.fn().mockReturnValue({}),
    SorobanRpc: {
      Server: jest.fn().mockImplementation(() => ({
        getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
      })),
    },
    rpc: {
      Server: jest.fn().mockImplementation(() => ({
        getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
      })),
    },
  };
});

const VALID_OWNER = "GBGBE57DSWNBO73HMKLGPCNUR7V4T3WYCXU34AHVZAR3FFFOSVZLEABQ";
const OTHER_USER = "GASPH4OCYOERATXIKLPNURXUP7ISAQU2KWFB5XLUJ3LQHKHOCN3CEGD6";

let testUser: { publicKey: string; role?: string } = { publicKey: VALID_OWNER };

jest.mock("./middleware/auth", () => ({
  authRouter: require("express").Router(),
  jwtMiddleware: (req: any, _res: any, next: any) => {
    req.user = testUser;
    next();
  },
}));

async function createCollateral() {
  return request(app)
    .post("/api/v1/collateral")
    .send({ animal_type: "cattle", count: 3, appraised_value: 1_000_000 });
}

describe("GET /api/v1/collateral/:id/appraisals", () => {
  beforeEach(() => {
    testUser = { publicKey: VALID_OWNER };
  });

  it("returns initial appraisal entry after creation", async () => {
    const { body: c } = await createCollateral();
    const res = await request(app).get(`/api/v1/collateral/${c.id}/appraisals`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toMatchObject({ value: 1_000_000 });
  });

  it("returns multiple appraisals ordered by date descending", async () => {
    const { body: c } = await createCollateral();

    await request(app)
      .put(`/api/v1/collateral/${c.id}/appraise`)
      .send({ appraised_value: 1_200_000 });
    await request(app)
      .put(`/api/v1/collateral/${c.id}/appraise`)
      .send({ appraised_value: 1_500_000 });

    const res = await request(app).get(`/api/v1/collateral/${c.id}/appraisals`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    // newest first
    expect(res.body.data[0].value).toBe(1_500_000);
    expect(res.body.data[1].value).toBe(1_200_000);
  });

  it("includes appraiser address on entries added via PUT appraise", async () => {
    const { body: c } = await createCollateral();
    await request(app)
      .put(`/api/v1/collateral/${c.id}/appraise`)
      .send({ appraised_value: 900_000 });

    const res = await request(app).get(`/api/v1/collateral/${c.id}/appraisals`);
    expect(res.status).toBe(200);
    const withAppraiser = res.body.data.find((e: any) => e.appraiser === VALID_OWNER);
    expect(withAppraiser).toBeDefined();
  });

  it("returns 404 for unknown collateral id", async () => {
    const res = await request(app).get("/api/v1/collateral/nonexistent-id/appraisals");
    expect(res.status).toBe(404);
  });

  it("returns 404 when caller is not the owner", async () => {
    const { body: c } = await createCollateral();
    testUser = { publicKey: OTHER_USER };
    const res = await request(app).get(`/api/v1/collateral/${c.id}/appraisals`);
    expect(res.status).toBe(404);
  });

  it("allows admin to retrieve appraisals for any collateral", async () => {
    const { body: c } = await createCollateral();
    testUser = { publicKey: OTHER_USER, role: "admin" };
    const res = await request(app).get(`/api/v1/collateral/${c.id}/appraisals`);
    expect(res.status).toBe(200);
  });

  it("paginates results correctly", async () => {
    const { body: c } = await createCollateral();
    // Add 2 more appraisals (total 3 including the initial one)
    await request(app).put(`/api/v1/collateral/${c.id}/appraise`).send({ appraised_value: 1_100_000 });
    await request(app).put(`/api/v1/collateral/${c.id}/appraise`).send({ appraised_value: 1_200_000 });

    const res = await request(app).get(`/api/v1/collateral/${c.id}/appraisals?page=1&limit=2`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
  });
});
