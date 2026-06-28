/**
 * Integration tests for webhook event types: loan.activated, loan.repaid, loan.liquidated
 * Closes #602
 */
import { fireWebhooks, registerWebhook, __resetForTests } from "./webhooks";

const WEBHOOK_URL = "https://example.com/hook";

beforeEach(() => {
  __resetForTests();
  process.env.WEBHOOK_SECRET = "test-secret-value-16";
  registerWebhook(WEBHOOK_URL);
});

afterEach(() => {
  delete process.env.WEBHOOK_SECRET;
});

function makeFetch(status = 200) {
  return jest.fn().mockResolvedValue({ ok: status < 400, status });
}

describe("Webhook event types — Issue #602", () => {
  it("fires loan.activated with loanId, borrower, amount, timestamp", async () => {
    const fetchMock = makeFetch();
    global.fetch = fetchMock as any;

    const payload = { loanId: "loan-1", borrower: "GABC", amount: 1000, timestamp: Date.now() };
    await fireWebhooks("loan.activated", payload);
    await new Promise((r) => setImmediate(r));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.event).toBe("loan.activated");
    expect(body.payload.loanId).toBe("loan-1");
    expect(body.payload.borrower).toBe("GABC");
    expect(body.payload.amount).toBe(1000);
    expect(typeof body.payload.timestamp).toBe("number");
  });

  it("fires loan.repaid with loanId, borrower, amount, timestamp", async () => {
    const fetchMock = makeFetch();
    global.fetch = fetchMock as any;

    const payload = { loanId: "loan-2", borrower: "GXYZ", amount: 500, timestamp: Date.now() };
    await fireWebhooks("loan.repaid", payload);
    await new Promise((r) => setImmediate(r));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.event).toBe("loan.repaid");
    expect(body.payload.loanId).toBe("loan-2");
    expect(body.payload.amount).toBe(500);
    expect(typeof body.payload.timestamp).toBe("number");
  });

  it("fires loan.liquidated with loanId, borrower, amount, timestamp", async () => {
    const fetchMock = makeFetch();
    global.fetch = fetchMock as any;

    const payload = { loanId: "loan-3", borrower: "GDEF", amount: 800, timestamp: Date.now() };
    await fireWebhooks("loan.liquidated", payload);
    await new Promise((r) => setImmediate(r));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.event).toBe("loan.liquidated");
    expect(body.payload.loanId).toBe("loan-3");
    expect(body.payload.borrower).toBe("GDEF");
    expect(body.payload.amount).toBe(800);
    expect(typeof body.payload.timestamp).toBe("number");
  });

  it("fires to all registered webhooks on loan.activated", async () => {
    const fetchMock = makeFetch();
    global.fetch = fetchMock as any;

    registerWebhook("https://second.example.com/hook");
    await fireWebhooks("loan.activated", { loanId: "x", borrower: "G", amount: 1, timestamp: Date.now() });
    await new Promise((r) => setImmediate(r));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
