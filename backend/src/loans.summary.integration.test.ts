import request from "supertest";

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

let testUser: any = { publicKey: "GUSER_SUMMARY_1" };

jest.mock("./middleware/auth", () => ({
  authRouter: require("express").Router(),
  jwtMiddleware: (req: any, _res: any, next: any) => {
    if (testUser) req.user = testUser;
    next();
  },
}));

import app from "./index";
import { insertCollateral, insertLoan } from "./db/store";

describe("GET /api/v1/loans/summary", () => {
  it("returns borrower-scoped aggregate metrics", async () => {
    const borrower = `G-SUM-${Date.now()}`;
    const otherBorrower = `G-SUM-OTHER-${Date.now()}`;

    const c1 = insertCollateral({
      id: `sum-col-1-${Date.now()}`,
      owner: borrower,
      animal_type: "cattle",
      count: 2,
      appraised_value: 1000,
    });
    const c2 = insertCollateral({
      id: `sum-col-2-${Date.now()}`,
      owner: borrower,
      animal_type: "goat",
      count: 5,
      appraised_value: 500,
    });

    insertLoan({
      id: `sum-loan-1-${Date.now()}`,
      borrower,
      collateral_id: c1.id,
      amount: 400,
      status: "active",
      health_factor: 1.1,
    });
    insertLoan({
      id: `sum-loan-2-${Date.now()}`,
      borrower,
      collateral_id: c2.id,
      amount: 200,
      status: "at_risk",
      health_factor: 1.3,
    });

    insertLoan({
      id: `sum-loan-3-${Date.now()}`,
      borrower: otherBorrower,
      collateral_id: c1.id,
      amount: 999,
      status: "active",
      health_factor: 0.9,
    });

    testUser = { publicKey: borrower };
    const res = await request(app).get("/api/v1/loans/summary");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      activeLoans: 2,
      totalCollateralValue: 1500,
      averageHealthFactor: 1.2,
      atRiskCount: 1,
    });
  });

  it("uses response cache with 30-second middleware wiring", async () => {
    const borrower = `G-CACHE-${Date.now()}`;
    testUser = { publicKey: borrower };

    const first = await request(app).get("/api/v1/loans/summary");
    const second = await request(app).get("/api/v1/loans/summary");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers["x-cache"]).toBe("MISS");
    expect(second.headers["x-cache"]).toBe("HIT");
  });
});
