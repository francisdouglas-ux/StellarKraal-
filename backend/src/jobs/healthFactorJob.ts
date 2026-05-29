import cron from "node-cron";
import { listActiveLoans, getCollateral, updateLoan } from "../db/store";
import logger from "../utils/logger";

const LIQUIDATION_THRESHOLD_BPS = 8_000;
const SCALE = 10_000;

/**
 * Compute health factor (scaled by 10_000) for a loan.
 * HF = (collateral_value × liq_threshold_bps) / (outstanding × 10_000) × 10_000
 * Returns null when collateral is missing or outstanding is zero.
 */
export function computeHealthFactor(collateralValue: number, outstanding: number): number | null {
  if (outstanding <= 0 || collateralValue <= 0) return null;
  return (collateralValue * LIQUIDATION_THRESHOLD_BPS) / (outstanding * SCALE) * SCALE;
}

/**
 * Recalculate health factors for all active/at_risk loans and flag those below 1.0.
 * Returns the count of records updated.
 */
export async function runHealthFactorJob(): Promise<number> {
  const start = Date.now();
  logger.info("healthFactorJob: starting");

  const loans = listActiveLoans();
  let updated = 0;

  for (const loan of loans) {
    const collateral = getCollateral(loan.collateral_id);
    const collateralValue = collateral?.appraised_value ?? 0;
    const hf = computeHealthFactor(collateralValue, loan.amount);
    const newStatus = hf !== null && hf < SCALE ? "at_risk" : "active";

    if (loan.health_factor !== hf || loan.status !== newStatus) {
      updateLoan(loan.id, { health_factor: hf, status: newStatus });
      updated++;
    }
  }

  const duration = Date.now() - start;
  logger.info("healthFactorJob: completed", { duration_ms: duration, updated });
  return updated;
}

/**
 * Schedule the health factor job to run every hour.
 * Returns the scheduled task so the caller can stop it on shutdown.
 */
export function scheduleHealthFactorJob(): cron.ScheduledTask {
  return cron.schedule("0 * * * *", async () => {
    try {
      await runHealthFactorJob();
    } catch (err) {
      logger.error("healthFactorJob: unhandled error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
