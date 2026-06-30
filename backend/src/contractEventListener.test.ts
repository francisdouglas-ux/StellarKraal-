import { z } from "zod";
import {
  startEventListener,
  stopEventListener,
  createEventLogEntry,
} from "./contractEventListener";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal mock ScVal that returns a u64 string */
function mockU64(value: string) {
  return { u64: () => ({ toString: () => value }) };
}

/** Build a minimal mock ScVal that returns an i128 lo value */
function mockI128(lo: number) {
  return { i128: () => ({ lo }) };
}

/** Build a minimal mock ScVal for an Address */
function mockAddress(str: string) {
  return { _address: str };
}

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockGetEvents = jest.fn().mockResolvedValue({ events: [] });

jest.mock("@stellar/stellar-sdk", () => ({
  rpc: {
    Server: jest.fn().mockImplementation(() => ({
      getEvents: mockGetEvents,
    })),
  },
  xdr: {
    ScVal: {
      fromXDR: jest.fn(),
    },
  },
  Address: {
    fromScVal: jest.fn(),
  },
}));

jest.mock("./utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Use jest.fn() directly inside the factory to avoid TDZ issues
jest.mock("./db/store", () => ({
  insertCollateral: jest.fn(),
  insertLoan: jest.fn(),
  updateTransaction: jest.fn(),
  updateLoan: jest.fn(),
  insertLiquidationEvent: jest.fn(),
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe("contractEventListener", () => {
  // Grab references to the mocked store functions after module initialisation
  const store = require("./db/store");

  const runtimeLogSchema = z
    .object({
      timestamp: z.string().datetime(),
      eventType: z.string().min(1),
      contractId: z.string().min(1),
      ledger: z.number().int().nonnegative(),
      correlationId: z.string().min(1),
      context: z.record(z.string(), z.unknown()).optional(),
      error: z
        .object({
          message: z.string().min(1),
          stack: z.string().optional(),
        })
        .optional(),
    })
    .strict();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetEvents.mockResolvedValue({ events: [] });
    process.env.CONTRACT_ID = "CTEST123";
    process.env.EVENT_LISTENER_LOG_LEVEL = "debug";
  });

  afterEach(() => {
    stopEventListener();
    jest.useRealTimers();
    delete process.env.CONTRACT_ID;
    delete process.env.EVENT_LISTENER_LOG_LEVEL;
  });

  it("starts and stops without error", () => {
    expect(() => startEventListener(1000)).not.toThrow();
    expect(() => stopEventListener()).not.toThrow();
  });

  it("does not start when CONTRACT_ID is missing", () => {
    delete process.env.CONTRACT_ID;
    const logger = require("./utils/logger").default;
    startEventListener(1000);
    expect(logger.warn).toHaveBeenCalledWith("event_listener_disabled", expect.any(Object));
  });

  it("calling stopEventListener twice is safe", () => {
    startEventListener(1000);
    stopEventListener();
    expect(() => stopEventListener()).not.toThrow();
  });

  it("creates structured logs within runtime schema boundaries", () => {
    const event = {
      ledger: 25,
      id: "evt-123",
    } as any;

    const log = createEventLogEntry("contract.event.received", event, {
      key: "loan/requested",
    });

    expect(() => runtimeLogSchema.parse(log)).not.toThrow();
    expect(log.eventType).toBe("contract.event.received");
    expect(log.contractId).toBe("CTEST123");
    expect(log.ledger).toBe(25);
    expect(log.correlationId).toBe("evt-123");
  });

  it("logs errors with stack nested in isolated error object", () => {
    const event = { ledger: 33 } as any;
    const error = new Error("parse failed");
    error.stack = "stack-trace-line";

    const log = createEventLogEntry("contract.event.parse_error", event, undefined, error);

    expect(() => runtimeLogSchema.parse(log)).not.toThrow();
    expect(log).toHaveProperty("error");
    expect(log.error).toMatchObject({
      message: "parse failed",
      stack: "stack-trace-line",
    });
    expect((log as any).stack).toBeUndefined();
  });

  describe("loan_liquidated event processing", () => {
    /**
     * Drives a simulated loan_liquidated event through the poll loop by
     * overriding getEvents to return a synthetic contract event, then
     * advancing the fake timer to trigger the first poll tick.
     *
     * The event structure mirrors the new on-chain format:
     *   topics: [loan_liquidated, borrower, liquidator]
     *   data:   (loan_id, repay_amount, collateral_seized)
     */
    it("updates loan status to liquidated, records transaction and liquidation event", async () => {
      const { xdr, Address } = require("@stellar/stellar-sdk");

      const BORROWER = "GBORROWER123";
      const LIQUIDATOR = "GLIQUIDATOR456";
      const LOAN_ID = "42";
      const REPAY_AMOUNT = 450_000;
      const COLLATERAL_SEIZED = 500_000;

      // topics: [loan_liquidated_b64, borrower_b64, liquidator_b64]
      const topicBase64 = ["loan_liquidated_b64", "borrower_b64", "liquidator_b64"];
      const dataBase64 = "data_b64";

      xdr.ScVal.fromXDR.mockImplementation((b64: string) => {
        if (b64 === "loan_liquidated_b64") {
          return { sym: () => ({ toString: () => "loan_liquidated" }) };
        }
        if (b64 === "borrower_b64") return mockAddress(BORROWER);
        if (b64 === "liquidator_b64") return mockAddress(LIQUIDATOR);
        if (b64 === dataBase64) {
          return {
            vec: () => [
              mockU64(LOAN_ID),
              mockI128(REPAY_AMOUNT),
              mockI128(COLLATERAL_SEIZED),
            ],
          };
        }
        return { vec: () => [] };
      });

      Address.fromScVal.mockImplementation((scVal: any) => {
        if (scVal._address === BORROWER) return { toString: () => BORROWER };
        if (scVal._address === LIQUIDATOR) return { toString: () => LIQUIDATOR };
        throw new Error("unknown address");
      });

      const syntheticEvent = {
        type: "contract",
        topic: topicBase64,
        value: dataBase64,
        ledger: 100,
        id: "evt-liq-42",
      };

      mockGetEvents.mockResolvedValueOnce({ events: [syntheticEvent] });

      startEventListener(500);
      // Run only the first pending timer tick (avoids infinite recursive setTimeout loop)
      await jest.runOnlyPendingTimersAsync();

      expect(store.updateLoan).toHaveBeenCalledWith(LOAN_ID, { status: "liquidated" });
      expect(store.updateTransaction).toHaveBeenCalledWith(LOAN_ID, {
        status: "completed",
        type: "liquidation",
      });
      expect(store.insertLiquidationEvent).toHaveBeenCalledWith({
        loan_id: LOAN_ID,
        liquidator: LIQUIDATOR,
        repay_amount: REPAY_AMOUNT,
      });
    });

    it("does not call updateLoan or insertLiquidationEvent for unrelated events", async () => {
      const { xdr } = require("@stellar/stellar-sdk");

      // loan/repaid event (two-symbol topics, not loan_liquidated)
      xdr.ScVal.fromXDR.mockImplementation((b64: string) => {
        if (b64 === "t0") return { sym: () => ({ toString: () => "loan" }) };
        if (b64 === "t1") return { sym: () => ({ toString: () => "repaid" }) };
        return {
          vec: () => [
            mockU64("7"),
            mockAddress("GBORROWER"),
            mockI128(100_000),
          ],
        };
      });

      const repaidEvent = {
        type: "contract",
        topic: ["t0", "t1"],
        value: "data_repaid",
        ledger: 50,
        id: "evt-repaid-7",
      };

      mockGetEvents.mockResolvedValueOnce({ events: [repaidEvent] });

      startEventListener(500);
      await jest.runOnlyPendingTimersAsync();

      expect(store.updateLoan).not.toHaveBeenCalled();
      expect(store.insertLiquidationEvent).not.toHaveBeenCalled();
    });
  });
});
