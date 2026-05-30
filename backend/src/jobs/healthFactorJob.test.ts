import {
  calculateHealthFactor,
  runHealthFactorJob,
  LIQUIDATION_THRESHOLD,
} from "./healthFactorJob";
import { insertLoan, insertCollateral, getLoan, updateLoan } from "../db/store";

// Reset store state between tests
beforeEach(() => {
  // Clear by re-importing a fresh module is not straightforward with jest;
  // instead we rely on unique IDs per test.
});

function makeCollateral(id: string, appraisedValue: number) {
  return insertCollateral({
    id,
    owner: "GABC",
    animal_type: "cattle",
    count: 1,
    appraised_value: appraisedValue,
  });
}

function makeLoan(
  id: string,
  collateralId: string,
  amount: number,
  status: "active" | "at_risk" | "pending" | "repaid" | "liquidated" = "active"
) {
  return insertLoan({
    id,
    borrower: "GABC",
    collateral_id: collateralId,
    amount,
    status,
    health_factor: null,
  });
}

describe("calculateHealthFactor", () => {
  it("returns collateral / amount", () => {
    expect(calculateHealthFactor(1_000_000, 600_000)).toBeCloseTo(1.6667, 4);
  });

  it("returns Infinity when amount is 0", () => {
    expect(calculateHealthFactor(1_000_000, 0)).toBe(Infinity);
  });

  it("returns value below threshold when undercollateralised", () => {
    const hf = calculateHealthFactor(500_000, 600_000);
    expect(hf).toBeLessThan(LIQUIDATION_THRESHOLD);
  });
});

describe("runHealthFactorJob", () => {
  it("marks healthy active loan and updates health_factor", async () => {
    makeCollateral("c-hf-1", 1_000_000);
    makeLoan("l-hf-1", "c-hf-1", 600_000, "active");

    await runHealthFactorJob();

    const loan = getLoan("l-hf-1")!;
    expect(loan.status).toBe("active");
    expect(loan.health_factor).toBeCloseTo(1.6667, 4);
  });

  it("flags undercollateralised loan as at_risk", async () => {
    makeCollateral("c-hf-2", 500_000);
    makeLoan("l-hf-2", "c-hf-2", 600_000, "active");

    await runHealthFactorJob();

    const loan = getLoan("l-hf-2")!;
    expect(loan.status).toBe("at_risk");
    expect(loan.health_factor).toBeLessThan(LIQUIDATION_THRESHOLD);
  });

  it("recovers at_risk loan to active when health factor improves", async () => {
    makeCollateral("c-hf-3", 500_000);
    makeLoan("l-hf-3", "c-hf-3", 600_000, "at_risk");

    // Improve collateral value
    updateLoan("l-hf-3", {}); // keep loan, just update collateral externally
    insertCollateral({
      id: "c-hf-3",
      owner: "GABC",
      animal_type: "cattle",
      count: 1,
      appraised_value: 2_000_000,
    });

    await runHealthFactorJob();

    const loan = getLoan("l-hf-3")!;
    expect(loan.status).toBe("active");
  });

  it("skips loans with status repaid or liquidated", async () => {
    makeCollateral("c-hf-4", 100_000);
    makeLoan("l-hf-4r", "c-hf-4", 600_000, "repaid");
    makeLoan("l-hf-4l", "c-hf-4", 600_000, "liquidated");

    await runHealthFactorJob();

    // repaid/liquidated loans should not be touched
    expect(getLoan("l-hf-4r")!.health_factor).toBeNull();
    expect(getLoan("l-hf-4l")!.health_factor).toBeNull();
  });

  it("skips loan when collateral is missing", async () => {
    makeLoan("l-hf-5", "c-missing", 600_000, "active");

    await expect(runHealthFactorJob()).resolves.not.toThrow();
    // health_factor stays null since collateral not found
    expect(getLoan("l-hf-5")!.health_factor).toBeNull();
  });

  it("returns count of updated records", async () => {
    makeCollateral("c-hf-6", 1_000_000);
    makeLoan("l-hf-6a", "c-hf-6", 600_000, "active");
    makeLoan("l-hf-6b", "c-hf-6", 600_000, "active");

    const { updated } = await runHealthFactorJob();
    expect(updated).toBeGreaterThanOrEqual(2);
  });
});
