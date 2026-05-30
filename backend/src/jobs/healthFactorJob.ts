import cron from "node-cron";
import logger from "../utils/logger";
import { listLoans, getCollateral, updateLoan } from "../db/store";

export const LIQUIDATION_THRESHOLD = 1.0;

/**
 * Calculate health factor for a loan.
 * health_factor = collateral_appraised_value / loan_amount
 */
export function calculateHealthFactor(appraisedValue: number, loanAmount: number): number {
  if (loanAmount <= 0) return Infinity;
  return appraisedValue / loanAmount;
}

/**
 * Run a single health factor recalculation pass over all active loans.
 * Exported for testing and manual invocation.
 */
export async function runHealthFactorJob(): Promise<{ updated: number }> {
  const start = Date.now();
  logger.info("health_factor_job: started");

  let updated = 0;

  try {
    // Fetch all active / at_risk loans across all pages
    const PAGE_SIZE = 100;
    let page = 1;
    let fetched = 0;
    let total = Infinity;
    const activeLoans = [];

    while (fetched < total) {
      const result = listLoans({ page, pageSize: PAGE_SIZE });
      total = result.total;
      fetched += result.data.length;
      for (const l of result.data) {
        if (l.status === "active" || l.status === "at_risk") activeLoans.push(l);
      }
      if (result.data.length < PAGE_SIZE) break;
      page++;
    }

    for (const loan of activeLoans) {
      const collateral = getCollateral(loan.collateral_id);
      if (!collateral) continue;

      const hf = calculateHealthFactor(collateral.appraised_value, loan.amount);
      const newStatus = hf < LIQUIDATION_THRESHOLD ? "at_risk" : "active";

      if (loan.health_factor !== hf || loan.status !== newStatus) {
        updateLoan(loan.id, { health_factor: hf, status: newStatus });
        updated++;
      }
    }

    const duration = Date.now() - start;
    logger.info("health_factor_job: completed", { durationMs: duration, updated });
  } catch (err) {
    const duration = Date.now() - start;
    logger.error("health_factor_job: failed", {
      error: (err as Error).message,
      durationMs: duration,
    });
  }

  return { updated };
}

let task: cron.ScheduledTask | null = null;

/** Start the hourly health factor recalculation cron job. */
export function startHealthFactorJob(): void {
  if (task) return;
  // Run every hour at minute 0
  task = cron.schedule("0 * * * *", () => {
    runHealthFactorJob();
  });
  logger.info("health_factor_job: scheduled (every hour)");
}

/** Stop the cron job (used during graceful shutdown). */
export function stopHealthFactorJob(): void {
  if (task) {
    task.stop();
    task = null;
    logger.info("health_factor_job: stopped");
  }
}
