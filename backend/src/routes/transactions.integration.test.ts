/**
 * Integration tests for GET /api/v1/transactions/:hash/status (issue #632).
 * Mocks Soroban RPC responses for pending, success, and failed states.
 */
import request from "supertest";
import app from "../index";

const VALID_HASH = "a".repeat(64); // 64-char hex string

jest.mock("../middleware/auth", () => {
  const Router = require("express").Router;
  return {
    jwtMiddleware: (req: any, _res: any, next: any) => {
      req.user = { publicKey: "GASPH4OCYOERATXIKLPNURXUP7ISAQU2KWFB5XLUJ3LQHKHOCN3CEGD6" };
      next();
    },
    authRouter: Router(),
  };
});

jest.mock("../utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createRequestLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
}));

// Mock rpcClient so we can control getTransaction responses
const mockGetTransaction = jest.fn();
jest.mock("../utils/rpcClient", () => ({
  __esModule: true,
  default: {
    getAccount: jest.fn().mockResolvedValue({ id: "GASPH4OCYOERATXIKLPNURXUP7ISAQU2KWFB5XLUJ3LQHKHOCN3CEGD6", sequence: "1" }),
    prepareTransaction: jest.fn().mockResolvedValue({ toXDR: () => "prepared_xdr" }),
    simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: { value: 150 } } }),
    getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
    getTransaction: (...args: any[]) => mockGetTransaction(...args),
  },
}));

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    Networks: { TESTNET: "Test SDF Network ; September 2015", PUBLIC: "Public Global Stellar Network ; September 2015" },
    BASE_FEE: "100",
    Contract: jest.fn().mockImplementation(() => ({ call: jest.fn().mockReturnValue({ type: "invokeHostFunction" }) })),
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ toXDR: () => "mock_xdr" }),
    })),
    Address: jest.fn().mockImplementation(() => ({ toScVal: jest.fn().mockReturnValue({}) })),
    nativeToScVal: jest.fn().mockReturnValue({}),
    SorobanRpc: {
      Server: jest.fn().mockImplementation(() => ({
        getAccount: jest.fn().mockResolvedValue({ id: "GASPH4OCYOERATXIKLPNURXUP7ISAQU2KWFB5XLUJ3LQHKHOCN3CEGD6", sequence: "1" }),
        prepareTransaction: jest.fn().mockResolvedValue({ toXDR: () => "prepared_xdr" }),
        simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: { value: 150 } } }),
        getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
        getTransaction: mockGetTransaction,
      })),
    },
  };
});

describe("GET /api/v1/transactions/:hash/status", () => {
  it("returns status=pending when RPC returns NOT_FOUND", async () => {
    mockGetTransaction.mockResolvedValueOnce({ status: "NOT_FOUND" });

    const res = await request(app).get(`/api/v1/transactions/${VALID_HASH}/status`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");
  });

  it("returns status=success with ledger when RPC returns SUCCESS", async () => {
    mockGetTransaction.mockResolvedValueOnce({ status: "SUCCESS", ledger: 12345 });

    const res = await request(app).get(`/api/v1/transactions/${VALID_HASH}/status`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.ledger).toBe(12345);
  });

  it("returns status=failed with errorCode when RPC returns FAILED", async () => {
    mockGetTransaction.mockResolvedValueOnce({ status: "FAILED", resultXdr: "AAAAAAAAAMgAAAAB" });

    const res = await request(app).get(`/api/v1/transactions/${VALID_HASH}/status`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("failed");
    expect(res.body.errorCode).toBe("AAAAAAAAAMgAAAAB");
  });

  it("returns 400 for invalid hash format", async () => {
    const res = await request(app).get("/api/v1/transactions/not-a-hash/status");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("returns 502 when RPC throws", async () => {
    mockGetTransaction.mockRejectedValueOnce(new Error("RPC unavailable"));

    const res = await request(app).get(`/api/v1/transactions/${VALID_HASH}/status`);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("RPC error");
  });
});
