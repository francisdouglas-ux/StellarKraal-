import { z } from "zod";
import {
  startEventListener,
  stopEventListener,
  createEventLogEntry,
} from "./contractEventListener";

jest.mock("@stellar/stellar-sdk", () => ({
  rpc: {
    Server: jest.fn().mockImplementation(() => ({
      getEvents: jest.fn().mockResolvedValue({ events: [] }),
    })),
  },
  xdr: {
    ScVal: {
      fromXDR: jest.fn().mockReturnValue({ vec: () => [] }),
    },
  },
}));

jest.mock("./utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("./db/store", () => ({
  insertCollateral: jest.fn(),
  insertLoan: jest.fn(),
  updateTransaction: jest.fn(),
}));

describe("contractEventListener", () => {
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
});
