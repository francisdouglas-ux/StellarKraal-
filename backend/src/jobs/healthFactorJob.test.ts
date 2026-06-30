import { computeHealthFactor, runHealthFactorJob, _resetAlertCooldowns } from "./healthFactorJob";
import * as store from "../db/store";
import * as alerting from "../utils/alerting";

// ── computeHealthFactor ───────────────────────────────────────────────────────

describe("computeHealthFactor", () => {
  it("returns null when outstanding is zero", () => {
    expect(computeHealthFactor(1_000_000, 0)).toBeNull();
  });

  it("returns null when collateral value is zero", () => {
    expect(computeHealthFactor(0, 600_000)).toBeNull();
  });

  it("returns >= 10_000 for a safe loan (HF = 13_333)", () => {
    const hf = computeHealthFactor(1_000, 600);
    expect(hf).not.toBeNull();
    expect(hf!).toBeGreaterThanOrEqual(10_000);
  });

  it("returns < 10_000 for an at-risk loan (HF = 9_333)", () => {
    const hf = computeHealthFactor(700, 600);
    expect(hf).not.toBeNull();
    expect(hf!).toBeLessThan(10_000);
  });

  it("returns exactly 10_000 at the liquidation boundary", () => {
    const hf = computeHealthFactor(750, 600);
    expect(hf).toBe(10_000);
  });
});

// ── Threshold alert tests ─────────────────────────────────────────────────────

describe("runHealthFactorJob — threshold alerts", () => {
  let fireSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    _resetAlertCooldowns();
    fireSpy = jest.spyOn(alerting, "fireAlert").mockResolvedValue(undefined);
  });

  function makeLoan(id: string, amount: number): store.LoanRecord {
    return {
      id,
      borrower: "G1",
      collateral_id: `col-${id}`,
      amount,
      status: "active",
      health_factor: null,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
  }

  function makeCollateral(id: string, appraisedValue: number): store.CollateralRecord {
    return {
      id: `col-${id}`,
      owner: "G1",
      animal_type: "cattle",
      count: 5,
      appraised_value: appraisedValue,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
  }

  it("fires warning when HF is between CRIT (10000) and WARN (13000)", async () => {
    // HF = (900 * 8000) / (600 * 10000) * 10000 = 12000 → between 10000 and 13000
    const loan = makeLoan("loan-w", 600);
    const col = makeCollateral("loan-w", 900);
    jest.spyOn(store, "listActiveLoans").mockReturnValue([loan]);
    jest.spyOn(store, "getCollateral").mockReturnValue(col);
    jest.spyOn(store, "updateLoan").mockReturnValue({ ...loan, health_factor: 12000, status: "active" });

    await runHealthFactorJob();

    expect(fireSpy).toHaveBeenCalledTimes(1);
    expect(fireSpy.mock.calls[0][0].severity).toBe("warning");
  });

  it("fires critical when HF is below CRIT (10000)", async () => {
    // HF = (700 * 8000) / (600 * 10000) * 10000 = 9333 → below 10000
    const loan = makeLoan("loan-c", 600);
    const col = makeCollateral("loan-c", 700);
    jest.spyOn(store, "listActiveLoans").mockReturnValue([loan]);
    jest.spyOn(store, "getCollateral").mockReturnValue(col);
    jest.spyOn(store, "updateLoan").mockReturnValue({ ...loan, health_factor: 9333, status: "at_risk" });

    await runHealthFactorJob();

    expect(fireSpy).toHaveBeenCalledTimes(1);
    expect(fireSpy.mock.calls[0][0].severity).toBe("critical");
  });

  it("does not fire alert when HF is above WARN (13000)", async () => {
    // HF = (1000 * 8000) / (600 * 10000) * 10000 = 13333 → above 13000
    const loan = makeLoan("loan-safe", 600);
    const col = makeCollateral("loan-safe", 1000);
    jest.spyOn(store, "listActiveLoans").mockReturnValue([loan]);
    jest.spyOn(store, "getCollateral").mockReturnValue(col);
    jest.spyOn(store, "updateLoan").mockReturnValue({ ...loan, health_factor: 13333, status: "active" });

    await runHealthFactorJob();

    expect(fireSpy).not.toHaveBeenCalled();
  });

  it("cooldown suppresses a second alert within 1 hour for the same loan", async () => {
    const loan = makeLoan("loan-cd", 600);
    const col = makeCollateral("loan-cd", 700);
    jest.spyOn(store, "listActiveLoans").mockReturnValue([loan]);
    jest.spyOn(store, "getCollateral").mockReturnValue(col);
    jest.spyOn(store, "updateLoan").mockReturnValue({ ...loan });

    await runHealthFactorJob();
    await runHealthFactorJob(); // second run within the same process — cooldown active

    // fireAlert is called but internally isCoolingDown suppresses the second; however
    // maybeAlert itself gates before calling fireAlert, so it should only be called once.
    expect(fireSpy).toHaveBeenCalledTimes(1);
  });
});

// ── runHealthFactorJob — job logic ────────────────────────────────────────────

describe("runHealthFactorJob", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    _resetAlertCooldowns();
    jest.spyOn(alerting, "fireAlert").mockResolvedValue(undefined);
  });

  it("flags at_risk loans below threshold and returns updated count", async () => {
    const loans: store.LoanRecord[] = [
      {
        id: "loan-1",
        borrower: "G1",
        collateral_id: "col-1",
        amount: 600,
        status: "active",
        health_factor: null,
        createdAt: new Date().toISOString(),
        deletedAt: null,
      },
    ];
    const collateral: store.CollateralRecord = {
      id: "col-1",
      owner: "G1",
      animal_type: "cattle",
      count: 5,
      appraised_value: 700,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };

    jest.spyOn(store, "listActiveLoans").mockReturnValue(loans);
    jest.spyOn(store, "getCollateral").mockReturnValue(collateral);
    const updateSpy = jest.spyOn(store, "updateLoan").mockReturnValue({ ...loans[0], status: "at_risk", health_factor: 9333.33 });

    const count = await runHealthFactorJob();

    expect(updateSpy).toHaveBeenCalledWith("loan-1", expect.objectContaining({ status: "at_risk" }));
    expect(count).toBe(1);
  });

  it("keeps active status for safe loans", async () => {
    const loans: store.LoanRecord[] = [
      {
        id: "loan-2",
        borrower: "G2",
        collateral_id: "col-2",
        amount: 600,
        status: "active",
        health_factor: null,
        createdAt: new Date().toISOString(),
        deletedAt: null,
      },
    ];
    const collateral: store.CollateralRecord = {
      id: "col-2",
      owner: "G2",
      animal_type: "cattle",
      count: 5,
      appraised_value: 1_000,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };

    jest.spyOn(store, "listActiveLoans").mockReturnValue(loans);
    jest.spyOn(store, "getCollateral").mockReturnValue(collateral);
    const updateSpy = jest.spyOn(store, "updateLoan").mockReturnValue({ ...loans[0], status: "active", health_factor: 13333.33 });

    const count = await runHealthFactorJob();

    expect(updateSpy).toHaveBeenCalledWith("loan-2", expect.objectContaining({ status: "active" }));
    expect(count).toBe(1);
  });

  it("skips update when health_factor and status are unchanged", async () => {
    const hf = (700 * 8_000) / (600 * 10_000) * 10_000;
    const loans: store.LoanRecord[] = [
      {
        id: "loan-3",
        borrower: "G3",
        collateral_id: "col-3",
        amount: 600,
        status: "at_risk",
        health_factor: hf,
        createdAt: new Date().toISOString(),
        deletedAt: null,
      },
    ];
    const collateral: store.CollateralRecord = {
      id: "col-3",
      owner: "G3",
      animal_type: "cattle",
      count: 5,
      appraised_value: 700,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };

    jest.spyOn(store, "listActiveLoans").mockReturnValue(loans);
    jest.spyOn(store, "getCollateral").mockReturnValue(collateral);
    const updateSpy = jest.spyOn(store, "updateLoan");

    const count = await runHealthFactorJob();

    expect(updateSpy).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });

  it("returns 0 when there are no active loans", async () => {
    jest.spyOn(store, "listActiveLoans").mockReturnValue([]);
    const count = await runHealthFactorJob();
    expect(count).toBe(0);
  });

  it("treats missing collateral as zero value (null HF, keeps active)", async () => {
    const loans: store.LoanRecord[] = [
      {
        id: "loan-4",
        borrower: "G4",
        collateral_id: "col-missing",
        amount: 600,
        status: "active",
        health_factor: null,
        createdAt: new Date().toISOString(),
        deletedAt: null,
      },
    ];

    jest.spyOn(store, "listActiveLoans").mockReturnValue(loans);
    jest.spyOn(store, "getCollateral").mockReturnValue(undefined);
    const updateSpy = jest.spyOn(store, "updateLoan").mockReturnValue({ ...loans[0] });

    await runHealthFactorJob();

    expect(updateSpy).not.toHaveBeenCalled();
  });
});
