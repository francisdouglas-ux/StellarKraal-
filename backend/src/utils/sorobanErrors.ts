/**
 * Maps Soroban contract error codes to human-readable messages.
 * Codes correspond to the `Error` enum in contracts/stellarkraal/src/lib.rs.
 */

const SOROBAN_ERROR_MESSAGES: Record<number, string> = {
  1:  "Contract is not initialized",
  2:  "Contract is already initialized",
  3:  "Unauthorized: caller does not have the required permissions",
  4:  "Insufficient collateral: loan amount exceeds the maximum allowed by the LTV ratio",
  5:  "Loan not found",
  6:  "Collateral not found",
  7:  "Health factor is safe: loan is not eligible for liquidation",
  8:  "Invalid amount: value must be positive and must not cause overflow",
  9:  "Loan is already closed",
  10: "Invalid fee rate: rate exceeds the protocol maximum of 5%",
  11: "Exceeds close factor: repay amount is above the close-factor cap",
  12: "Invalid close factor: value must be between 1 and 10 000 bps",
  13: "Contract is paused — new operations are temporarily disabled",
  14: "Oracle is already registered",
  15: "Oracle limit reached: maximum number of oracles has been registered",
  16: "Oracle not found",
  17: "Insufficient oracle quorum: not enough valid price submissions",
  18: "Invalid price: price value is out of bounds or otherwise invalid",
  19: "Contract is not paused",
};

// Matches Soroban host-error strings like: Error(Contract, #4)
const CONTRACT_ERROR_RE = /Error\(Contract,\s*#(\d+)\)/;

/**
 * Convert a raw Soroban RPC error into a human-readable Error.
 *
 * If the error message contains a contract error code, it is replaced with
 * the corresponding description from {@link SOROBAN_ERROR_MESSAGES}.
 * Unknown codes produce "Contract error code N" so callers always get a
 * meaningful string rather than a raw numeric code.
 *
 * Non-contract errors are returned unchanged.
 */
export function mapSorobanError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  const match = CONTRACT_ERROR_RE.exec(message);
  if (match) {
    const code = parseInt(match[1], 10);
    const description = SOROBAN_ERROR_MESSAGES[code] ?? `Contract error code ${code}`;
    return new Error(description);
  }
  return err instanceof Error ? err : new Error(message);
}
