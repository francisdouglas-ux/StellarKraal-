import { computeHealthFactor, runHealthFactorJob } from "./healthFactorJob";
import * as store from "../db/store";

// ── computeHealthFactor ───────────────────────────────────────────────────────

describe("computeHealthFactor", () => {
  it("returns null when outstanding is zero", () => {
    expect(computeHealthFactor(1_000_000, 0)).toBeNull();
  });

  it("returns null when collateral value is zero", () => {
    expect(computeHealthFactor(0, 600_000)).toBeNull();
  });

  it("returns >= 10_000 for a safe loan (HF = 13_333)", () => {
    // collateral=1000, outstanding=600, liq_thr=8000
    // HF = (1000 * 8000) / (600 * 10000) * 10000 = 13333.33
    const hf = computeHealthFactor(1_000, 600);
    expect(hf).not.toBeNull();
    expect(hf!).toBeGreaterThanOrEqual(10_000);
  });

  it("returns < 10_000 for an at-risk loan (HF = 9_333)", () => {
    // collateral=700, outstanding=600
    // HF = (700 * 8000) / (600 * 10000) * 10000 = 9333.33
    const hf = computeHealthFactor(700, 600);
    expect(hf).not.toBeNull();
    expect(hf!).toBeLessThan(10_000);
  });

  it("returns exactly 10_000 at the liquidation boundary", () => {
    // collateral=750, outstanding=600
    // HF = (750 * 8000) / (600 * 10000) * 10000 = 10000
    const hf = computeHealthFactor(750, 600);
    expect(hf).toBe(10_000);
  });
});

// ── runHealthFactorJob ────────────────────────────────────────────────────────

describe("runHealthFactorJob", () => {
  beforeEach(() => {
    // Reset store state between tests
    jest.restoreAllMocks();
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
      appraised_value: 700, // HF < 10_000 → at_risk
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
      appraised_value: 1_000, // HF >= 10_000 → active
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

    // null HF → newStatus = "active"; health_factor unchanged (null === null) but status same → no update
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
