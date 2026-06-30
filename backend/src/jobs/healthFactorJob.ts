import cron, { ScheduledTask } from "node-cron";
import { listActiveLoans, getCollateral, updateLoan } from "../db/store";
import logger from "../utils/logger";
import { fireAlert } from "../utils/alerting";
import { config } from "../config";

const LIQUIDATION_THRESHOLD_BPS = 8_000;
const SCALE = 10_000;
/** One hour in milliseconds — cooldown between repeated alerts for the same loan. */
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Threshold (×SCALE) below which a warning alert fires.
 * Reads HEALTH_FACTOR_WARN from config (default 13000 → 1.3).
 */
const WARN_THRESHOLD = parseInt(config.HEALTH_FACTOR_WARN, 10);

/**
 * Threshold (×SCALE) below which a critical alert fires.
 * Reads HEALTH_FACTOR_CRIT from config (default 10000 → 1.0).
 */
const CRIT_THRESHOLD = parseInt(config.HEALTH_FACTOR_CRIT, 10);

// Per-loan cooldown map keyed by `${loanId}:${level}`.
const alertCooldowns = new Map<string, number>();

/**
 * Returns true if a cooldown entry for this key is still active.
 * @param key - `${loanId}:warning` or `${loanId}:critical`
 */
function isOnCooldown(key: string): boolean {
  const last = alertCooldowns.get(key);
  return last !== undefined && Date.now() - last < ALERT_COOLDOWN_MS;
}

/**
 * Fire a per-loan health factor alert if not within the cooldown window.
 * @param loanId - ID of the loan that triggered the alert.
 * @param level - Alert severity: "warning" or "critical".
 * @param hf - Current health factor value (×SCALE).
 */
async function maybeAlert(loanId: string, level: "warning" | "critical", hf: number): Promise<void> {
  const key = `${loanId}:${level}`;
  if (isOnCooldown(key)) return;
  alertCooldowns.set(key, Date.now());

  const rule = {
    id: `health_factor_${level}_${loanId}`,
    name: `Health Factor ${level.charAt(0).toUpperCase() + level.slice(1)}`,
    severity: level as "warning" | "critical",
    cooldownMs: ALERT_COOLDOWN_MS,
    runbook: "liquidation-failure.md",
    pagerduty: level === "critical",
  };

  await fireAlert(rule, `Loan ${loanId} health factor ${hf} dropped below ${level} threshold`, {
    loanId,
    healthFactor: hf,
    warnThreshold: WARN_THRESHOLD,
    critThreshold: CRIT_THRESHOLD,
  });
}

/**
 * Compute health factor (scaled by 10_000) for a loan.
 * HF = (collateral_value × liq_threshold_bps) / (outstanding × 10_000) × 10_000
 * Returns null when collateral is missing or outstanding is zero.
 * @param collateralValue - Current appraised value of the collateral.
 * @param outstanding - Outstanding loan amount.
 * @returns The health factor scaled by 10,000, or null if inputs are invalid.
 */
export function computeHealthFactor(collateralValue: number, outstanding: number): number | null {
  if (outstanding <= 0 || collateralValue <= 0) return null;
  return (collateralValue * LIQUIDATION_THRESHOLD_BPS) / (outstanding * SCALE) * SCALE;
}

/**
 * Recalculate health factors for all active/at_risk loans, flag those below CRIT
 * threshold, and fire configurable warning/critical alerts with per-loan cooldown.
 * @returns The number of loan records updated.
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

    // Fire alerts based on configurable thresholds
    if (hf !== null) {
      if (hf < CRIT_THRESHOLD) {
        await maybeAlert(loan.id, "critical", hf);
      } else if (hf < WARN_THRESHOLD) {
        await maybeAlert(loan.id, "warning", hf);
      }
    }
  }

  const duration = Date.now() - start;
  logger.info("healthFactorJob: completed", { duration_ms: duration, updated });
  return updated;
}

/**
 * Schedule the health factor job to run every hour.
 * Returns the scheduled task so the caller can stop it on shutdown.
 * @returns The scheduled cron task instance.
 */
export function scheduleHealthFactorJob(): ScheduledTask {
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

/** Exported for testing only — clears the per-loan alert cooldown map. */
export function _resetAlertCooldowns(): void {
  alertCooldowns.clear();
}
