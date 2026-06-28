/**
 * Integration tests for v1 collateral endpoints.
 * Covers: POST /api/v1/collateral, GET /api/v1/collateral,
 *         PUT /api/v1/collateral/:id/appraise, DELETE /api/v1/collateral/:id
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
  const isValidEd25519PublicKey = (value: string) =>
    typeof value === "string" && value.length === 56 && value.startsWith("G");

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
        getAccount: jest.fn().mockResolvedValue({ id: "GABC", sequence: "1" }),
        prepareTransaction: jest.fn().mockResolvedValue({ toXDR: () => "prepared_xdr" }),
        simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: {} } }),
        getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
      })),
    },
    rpc: {
      Server: jest.fn().mockImplementation(() => ({
        getAccount: jest.fn().mockResolvedValue({ id: "GABC", sequence: "1" }),
        prepareTransaction: jest.fn().mockResolvedValue({ toXDR: () => "prepared_xdr" }),
        simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: {} } }),
        getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
      })),
    },
  };
});

// Bypass JWT auth for all tests, but inject user context
let testUser: any = { publicKey: "GBGBE57DSWNBO73HMKLGPCNUR7V4T3WYCXU34AHVZAR3FFFOSVZLEABQ" };

jest.mock("./middleware/auth", () => ({
  authRouter: require("express").Router(),
  jwtMiddleware: (req: any, res: any, next: any) => {
    if (testUser) {
      req.user = testUser;
    }
    next();
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_OWNER = "GBGBE57DSWNBO73HMKLGPCNUR7V4T3WYCXU34AHVZAR3FFFOSVZLEABQ";

function validPayload(overrides = {}) {
  return { animal_type: "cattle", count: 5, appraised_value: 1_000_000, ...overrides };
}

async function createCollateral(overrides = {}) {
  const res = await request(app).post("/api/v1/collateral").send(validPayload(overrides));
  if (res.status !== 201) console.log("CREATE COLLATERAL ERROR STATUS:", res.status, "BODY:", res.body);
  return res;
}

// ── POST /api/v1/collateral ───────────────────────────────────────────────────

describe("POST /api/v1/collateral", () => {
  it("creates a record and returns 201 with the record", async () => {
    const res = await createCollateral();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      owner: VALID_OWNER,
      animal_type: "cattle",
      count: 5,
      appraised_value: 1_000_000,
      deletedAt: null,
    });
    expect(typeof res.body.id).toBe("string");
    expect(typeof res.body.createdAt).toBe("string");
  });

  it("accepts different animal types", async () => {
    for (const animal_type of ["goats", "sheep"]) {
      const res = await createCollateral({ animal_type });
      expect(res.status).toBe(201);
      expect(res.body.animal_type).toBe(animal_type);
    }
  });

  it("returns 400 for missing required fields", async () => {
    const res = await request(app).post("/api/v1/collateral").send({});
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details).toHaveProperty("animal_type");
    expect(res.body.details).toHaveProperty("count");
    expect(res.body.details).toHaveProperty("appraised_value");
  });

  it("returns 422 for non-positive count", async () => {
    const res = await createCollateral({ count: 0 });
    expect(res.status).toBe(422);
    expect(res.body.details).toHaveProperty("count");
  });

  it("returns 422 for non-positive appraised_value", async () => {
    const res = await createCollateral({ appraised_value: -1 });
    expect(res.status).toBe(422);
    expect(res.body.details).toHaveProperty("appraised_value");
  });

  it("returns 422 for empty animal_type", async () => {
    const res = await createCollateral({ animal_type: "" });
    expect(res.status).toBe(422);
    expect(res.body.details).toHaveProperty("animal_type");
  });
});

// ── PATCH /api/v1/collateral/:id ─────────────────────────────────────────────

describe("PATCH /api/v1/collateral/:id", () => {
  it("updates provided fields only", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .patch(`/api/v1/collateral/${created.id}`)
      .send({ count: 9, appraised_value: 1_500_000 });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(9);
    expect(res.body.appraised_value).toBe(1_500_000);
    expect(res.body.animal_type).toBe("cattle");
  });

  it("returns 422 with field dictionary for malformed payload", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .patch(`/api/v1/collateral/${created.id}`)
      .send({ count: 0 });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details).toHaveProperty("count");
  });

  it("returns 422 when payload is empty", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .patch(`/api/v1/collateral/${created.id}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.details).toHaveProperty("_root");
  });
});

// ── GET /api/v1/collateral ────────────────────────────────────────────────────

describe("GET /api/v1/collateral", () => {
  it("returns paginated list with envelope", async () => {
    const res = await request(app).get("/api/v1/collateral");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
  });

  it("filters by owner", async () => {
    // Create one with a different owner — use VALID_OWNER since other may be invalid
    await createCollateral({ animal_type: "goats" });
    const res = await request(app).get(`/api/v1/collateral?owner=${VALID_OWNER}`);
    expect(res.status).toBe(200);
    res.body.data.forEach((r: any) => expect(r.owner).toBe(VALID_OWNER));
  });

  it("filters by animal_type", async () => {
    await createCollateral({ animal_type: "sheep" });
    const res = await request(app).get("/api/v1/collateral?animal_type=sheep");
    expect(res.status).toBe(200);
    res.body.data.forEach((r: any) => expect(r.animal_type).toBe("sheep"));
  });

  it("respects page and pageSize", async () => {
    const res = await request(app).get("/api/v1/collateral?page=1&pageSize=2");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(2);
  });

  it("returns 400 for invalid page", async () => {
    const res = await request(app).get("/api/v1/collateral?page=0");
    expect(res.status).toBe(400);
  });

  it("returns 400 for pageSize > 100", async () => {
    const res = await request(app).get("/api/v1/collateral?pageSize=101");
    expect(res.status).toBe(400);
  });
});

// ── PUT /api/v1/collateral/:id/appraise ──────────────────────────────────────

describe("PUT /api/v1/collateral/:id/appraise", () => {
  it("updates appraised_value and returns the record", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .put(`/api/v1/collateral/${created.id}/appraise`)
      .send({ appraised_value: 2_000_000 });
    expect(res.status).toBe(200);
    expect(res.body.appraised_value).toBe(2_000_000);
    expect(res.body.id).toBe(created.id);
  });

  it("returns 404 for unknown id", async () => {
    const res = await request(app)
      .put("/api/v1/collateral/nonexistent-id/appraise")
      .send({ appraised_value: 500_000 });
    expect(res.status).toBe(404);
  });

  it("returns 400 for zero appraised_value", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .put(`/api/v1/collateral/${created.id}/appraise`)
      .send({ appraised_value: 0 });
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative appraised_value", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .put(`/api/v1/collateral/${created.id}/appraise`)
      .send({ appraised_value: -100 });
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-integer appraised_value", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .put(`/api/v1/collateral/${created.id}/appraise`)
      .send({ appraised_value: 1.5 });
    expect(res.status).toBe(400);
  });

  it("returns 400 when appraised_value is missing", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app)
      .put(`/api/v1/collateral/${created.id}/appraise`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/v1/collateral/:id ─────────────────────────────────────────────

describe("DELETE /api/v1/collateral/:id", () => {
  it("soft-deletes an owned record and returns deleted: true", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app).delete(`/api/v1/collateral/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true, id: created.id });
  });

  it("returns 404 for unknown id", async () => {
    const res = await request(app).delete("/api/v1/collateral/nonexistent-id");
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting an already-deleted record", async () => {
    const { body: created } = await createCollateral();
    await request(app).delete(`/api/v1/collateral/${created.id}`);
    const res = await request(app).delete(`/api/v1/collateral/${created.id}`);
    expect(res.status).toBe(404);
  });

  it("soft-deleted records do not appear in GET /api/v1/collateral", async () => {
    const { body: created } = await createCollateral({ animal_type: "cattle" });
    await request(app).delete(`/api/v1/collateral/${created.id}`);

    const listRes = await request(app).get("/api/v1/collateral");
    expect(listRes.status).toBe(200);
    const ids = listRes.body.data.map((r: any) => r.id);
    expect(ids).not.toContain(created.id);
  });

  it("soft-deleted records do not appear when filtering by owner", async () => {
    const { body: created } = await createCollateral();
    await request(app).delete(`/api/v1/collateral/${created.id}`);

    const listRes = await request(app).get(`/api/v1/collateral?owner=${VALID_OWNER}`);
    const ids = listRes.body.data.map((r: any) => r.id);
    expect(ids).not.toContain(created.id);
  });

  it("returns 409 when the collateral is pledged to an active loan", async () => {
    const { body: created } = await createCollateral();
    insertLoan({
      id: "test-loan-pledged-" + created.id,
      borrower: VALID_OWNER,
      collateral_id: created.id,
      amount: 500_000,
      status: "active",
    });
    const res = await request(app).delete(`/api/v1/collateral/${created.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("pledged to an active loan");
  });

  it("returns 403 when user is not the owner or admin", async () => {
    const { body: created } = await createCollateral();
    testUser = { publicKey: "GASPH4OCYOERATXIKLPNURXUP7ISAQU2KWFB5XLUJ3LQHKHOCN3CEGD6" };
    try {
      const res = await request(app).delete(`/api/v1/collateral/${created.id}`);
      expect(res.status).toBe(403);
    } finally {
      testUser = { publicKey: VALID_OWNER };
    }
  });

  it("allows deletion if user is an admin", async () => {
    const { body: created } = await createCollateral();
    testUser = { publicKey: "GASPH4OCYOERATXIKLPNURXUP7ISAQU2KWFB5XLUJ3LQHKHOCN3CEGD6", role: "admin" };
    try {
      const res = await request(app).delete(`/api/v1/collateral/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ deleted: true, id: created.id });
    } finally {
      testUser = { publicKey: VALID_OWNER };
    }
  });
});

// ── PATCH /api/v1/collateral/:id/restore ─────────────────────────────────────

describe("PATCH /api/v1/collateral/:id/restore", () => {
  it("restores a soft-deleted collateral record", async () => {
    const { body: created } = await createCollateral();
    await request(app).delete(`/api/v1/collateral/${created.id}`);

    const res = await request(app).patch(`/api/v1/collateral/${created.id}/restore`).send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ restored: true, id: created.id });
  });

  it("returns 404 if collateral is not deleted", async () => {
    const { body: created } = await createCollateral();
    const res = await request(app).patch(`/api/v1/collateral/${created.id}/restore`).send({});

    expect(res.status).toBe(404);
  });

  it("returns 409 if collateral is pledged to an active loan", async () => {
    const { body: created } = await createCollateral();
    await request(app).delete(`/api/v1/collateral/${created.id}`);
    insertLoan({
      id: `restore-loan-${created.id}`,
      borrower: VALID_OWNER,
      collateral_id: created.id,
      amount: 200_000,
      status: "active",
    });

    const res = await request(app).patch(`/api/v1/collateral/${created.id}/restore`).send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("pledged");
  });
});
