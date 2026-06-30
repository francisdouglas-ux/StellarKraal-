# StellarKraal Soroban Contract Interface

This document describes the public interface for the `StellarKraal` Soroban smart contract in `contracts/stellarkraal/src/lib.rs`.
It covers contract functions, parameters, return values, error codes, on-chain state changes, and invocation examples using `stellar-cli`.

## Contract Overview

The contract manages livestock-backed loans with the following responsibilities:

- Register livestock as collateral.
- Accept loan requests against collateral value.
- Process loan repayments and liquidations.
- Enforce admin-controlled protocol parameters (fees, pause state, oracle configuration).
- Validate recipient-price updates from an external oracle and maintain TWAP pricing data.

## Public Functions

### `initialize(env, admin, oracle, token, treasury, ltv_bps, liquidation_threshold_bps)`
- Description: Set initial protocol parameters and default fee, treasury, loan, and price state.
- Parameters:
  - `admin` — admin address with permission to update protocol settings. Must not be the all-zeros Stellar account.
  - `oracle` — authorized oracle address for price submissions.
  - `token` — token address used for SAC disbursements and repayments.
  - `treasury` — fee recipient address.
  - `ltv_bps` — loan-to-value ratio in basis points (e.g. `6000` = 60%). Must be in the range 1–9000 inclusive.
  - `liquidation_threshold_bps` — liquidation health threshold in basis points. Must be ≥ `ltv_bps`.
- Returns: `Result<(), Error>`.
- State changes: stores admin, oracle, token, treasury, LTV, liquidation threshold, fee rates, close factor, interest rate model, liquidity tracking, TWAP defaults, and oracle validation parameters.
- Errors:
  - `AlreadyInitialized` (#2) if called more than once.
  - `Unauthorized` (#3) if `admin` is the all-zeros account (`GAAA…WHF`).
  - `InvalidAmount` (#8) if `ltv_bps` is 0 or > 9000, or if `liquidation_threshold_bps` < `ltv_bps`.

### `is_paused(env)`
- Description: Query whether the contract is currently paused.
- Parameters: none.
- Returns: `bool`.
- State changes: none.

### `pause(env, admin)`
- Description: Pause contract write operations until expiry.
- Parameters: `admin` — must match the stored admin address.
- Returns: `Result<(), Error>`.
- State changes: sets pause flag and expiry timestamp, emits a pause event.

### `unpause(env, admin)`
- Description: Resume contract operations.
- Parameters: `admin` — must match the stored admin address.
- Returns: `Result<(), Error>`.
- State changes: clears pause state and expiry timestamp, emits an unpause event.

### `set_pause_duration(env, admin, duration)`
- Description: Update the default pause duration used by `pause()`.
- Parameters:
  - `admin` — admin address.
  - `duration` — duration in seconds.
- Returns: `Result<(), Error>`.
- State changes: updates `PAUSE_DUR`.

### `update_oracle(env, admin, new_oracle)`
- Description: Update the authorized oracle address.
- Parameters:
  - `admin` — admin address.
  - `new_oracle` — new oracle address.
- Returns: `Result<(), Error>`.
- State changes: updates `ORACLE`, emits an oracle update event.

### `set_liquidation_threshold(env, admin, threshold_bps)`
- Description: Update the liquidation threshold.
- Parameters:
  - `admin` — admin address.
  - `threshold_bps` — new threshold in basis points.
- Returns: `Result<(), Error>`.
- State changes: updates `LIQ_THR`, emits a threshold update event.

### `propose_new_admin(env, admin, new_admin)`
- Description: Start admin transfer by proposing a new admin address.
- Parameters:
  - `admin` — current admin address.
  - `new_admin` — proposed admin address.
- Returns: `Result<(), Error>`.
- State changes: stores `PENDING_ADMIN`, emits a proposal event.

### `accept_admin_role(env, new_admin)`
- Description: Accept admin role after it has been proposed.
- Parameters: `new_admin` — address that must match the pending admin.
- Returns: `Result<(), Error>`.
- State changes: replaces `ADMIN` with `PENDING_ADMIN`, clears `PENDING_ADMIN`, emits an admin update event.

### `register_livestock(env, owner, animal_type, count, appraised_value)`
- Description: Register a new collateral record for livestock.
- Parameters:
  - `owner` — collateral owner address.
  - `animal_type` — short symbol for livestock type.
  - `count` — number of animals.
  - `appraised_value` — oracle-appraised collateral value in base units.
- Returns: `Result<u64, Error>` — newly assigned collateral ID.
- State changes: creates `CollateralRecord` and stores it as unlocked collateral, emits a livestock registration event.

### `request_loan(env, borrower, collateral_ids, amount)`
- Description: Request a new loan secured by one or more collateral records.
- Parameters:
  - `borrower` — borrower address.
  - `collateral_ids` — list of collateral record IDs.
  - `amount` — requested gross loan amount in token base units.
- Returns: `Result<u64, Error>` — newly assigned loan ID.
- State changes: validates collateral ownership, locks collaterals, stores `LoanRecord`, transfers origination fee to treasury, disburses net amount to borrower, emits loan requested event.

### `repay_loan(env, borrower, loan_id, amount)`
- Description: Repay part or all of an active loan.
- Parameters:
  - `borrower` — loan borrower address.
  - `loan_id` — loan identifier.
  - `amount` — repayment amount.
- Returns: `Result<(), Error>`.
- State changes: transfers repayment into contract, deducts interest fee to treasury, reduces outstanding balance, updates status to `Repaid` when completed, emits `loan_repaid` event.

### `liquidate(env, liquidator, loan_id, repay_amount)`
- Description: Liquidate a loan whose health factor is below 1.
- Parameters:
  - `liquidator` — liquidator address.
  - `loan_id` — loan identifier.
  - `repay_amount` — amount to repay subject to close-factor cap.
- Returns: `Result<(), Error>`.
- State changes: transfers repayment into contract, reduces outstanding balance, updates loan status to `Liquidated` if fully repaid, emits loan liquidated event.
- Whitelist behaviour: when the liquidator whitelist is **empty** any address may call this function (backward-compatible open mode). When at least one address has been added via `add_liquidator`, only whitelisted addresses are permitted; others receive `LiquidatorNotWhitelisted`.

### `add_liquidator(env, admin, liquidator)`
- Description: Add an address to the approved liquidator whitelist. Idempotent — adding the same address twice has no effect.
- Parameters:
  - `admin` — must match the stored admin address.
  - `liquidator` — address to approve as a liquidator.
- Returns: `Result<(), Error>`.
- State changes: stores a `WhitelistEntry` in persistent storage, increments the whitelist count, emits a `whitelist/added` event.

### `remove_liquidator(env, admin, liquidator)`
- Description: Remove an address from the approved liquidator whitelist. Idempotent — removing an address that is not on the list is a no-op.
- Parameters:
  - `admin` — must match the stored admin address.
  - `liquidator` — address to remove from the whitelist.
- Returns: `Result<(), Error>`.
- State changes: removes the `WhitelistEntry` from persistent storage, decrements the whitelist count, emits a `whitelist/removed` event.

### `is_whitelisted(env, liquidator)`
- Description: Query whether an address is permitted to liquidate. Returns `true` when the whitelist is empty (open mode) or when the address has been added via `add_liquidator`.
- Parameters:
  - `liquidator` — address to check.
- Returns: `bool`.
- State changes: none.

### `set_close_factor(env, admin, close_factor_bps)`
- Description: Update the maximum liquidation repayment percentage.
- Parameters:
  - `admin` — admin address.
  - `close_factor_bps` — close factor in basis points.
- Returns: `Result<(), Error>`.
- State changes: updates `CLOSE_FACTOR`.

### `get_close_factor(env)`
- Description: Read the current close factor.
- Parameters: none.
- Returns: `Result<u32, Error>`.
- State changes: none.

### `health_factor(env, loan_id)`
- Description: Compute the health factor scaled by 10,000 for a loan.
- Parameters:
  - `loan_id` — loan identifier.
- Returns: `Result<i128, Error>`.
- State changes: none.

### `get_loan(env, loan_id)`
- Description: Read a loan record.
- Parameters:
  - `loan_id` — loan identifier.
- Returns: `Result<LoanRecord, Error>`.
- State changes: none.

### `get_collateral(env, collateral_id)`
- Description: Read a collateral record.
- Parameters:
  - `collateral_id` — collateral record identifier.
- Returns: `Result<CollateralRecord, Error>`.
- State changes: none.

### `get_loan_collaterals(env, loan_id)`
- Description: Return all collateral records backing a loan.
- Parameters:
  - `loan_id` — loan identifier.
- Returns: `Result<Vec<CollateralRecord>, Error>`.
- State changes: none.

### `get_collateral_count(env, owner)`
- Description: Get the number of non-liquidated collaterals registered by an owner.
- Parameters:
  - `owner` — owner address.
- Returns: `u32` — count of non-liquidated collaterals. Returns 0 if none.
- State changes: none.

### `update_fee_config(env, admin, origination_fee_bps, interest_fee_bps)`
- Description: Update origination and interest fee rates.
- Parameters:
  - `admin` — admin address.
  - `origination_fee_bps` — origination fee in basis points.
  - `interest_fee_bps` — interest fee in basis points.
- Returns: `Result<(), Error>`.
- State changes: updates `ORIG_FEE` and `INT_FEE`.

### `get_fee_config(env)`
- Description: Read the current fee configuration.
- Parameters: none.
- Returns: `Result<FeeConfig, Error>`.
- State changes: none.

### `set_interest_rate_model(env, admin, base_rate_bps, slope1_bps, slope2_bps, kink_bps)`
- Description: Update the jump-rate interest model.
- Parameters:
  - `admin` — admin address.
  - `base_rate_bps` — base interest rate in basis points.
  - `slope1_bps` — slope below the kink.
  - `slope2_bps` — slope above the kink.
  - `kink_bps` — utilization kink point in basis points.
- Returns: `Result<(), Error>`.
- State changes: updates `BASE_RATE`, `SLOPE1`, `SLOPE2`, and `KINK`.

### `get_interest_rate_model(env)`
- Description: Read the current interest rate model.
- Parameters: none.
- Returns: `Result<InterestRateModel, Error>`.
- State changes: none.

### `get_current_interest_rate(env)`
- Description: Compute the current interest rate from utilization.
- Parameters: none.
- Returns: `Result<u32, Error>`.
- State changes: none.

> **Oracle design:** The protocol supports multiple registered oracles with on-chain median aggregation and a configurable quorum (`add_oracle`, `remove_oracle`, `get_oracles`, `submit_oracle_prices`), in addition to the single-oracle `submit_price` + TWAP path documented below. For the trust model, dispute handling, the relationship to the off-chain appraisal cache (`backend/src/utils/appraisalCache.ts`), and rationale, see [ADR-006: Oracle design](../adr/ADR-006-oracle-design.md).

### `get_oracles(env)`
- Description: Return the current list of registered oracle addresses. If the multi-oracle `ORACLES` store has not been written yet (i.e. only the legacy single `ORACLE` key exists), it falls back to returning a one-element Vec containing that address.
- Parameters: none.
- Returns: `Vec<Address>` — ordered list of registered oracle addresses (0–5 entries).
- State changes: none.
- Example:
  ```bash
  stellar contract invoke \
    --id "$CONTRACT_ID" \
    --fn get_oracles \
    --network "$NETWORK" \
    --rpc-url "$RPC_URL"
  ```

### `add_oracle(env, admin, oracle)`
- Description: Register an additional oracle address. Maximum of 5 oracles allowed.
- Parameters:
  - `admin` — must match the stored admin address.
  - `oracle` — oracle address to add.
- Returns: `Result<(), Error>`.
- State changes: appends address to `ORACLES`, emits no event.
- Errors: `Unauthorized` (non-admin), `OracleAlreadyRegistered` (#16), `OracleLimitReached` (#17 when count ≥ 5).

### `remove_oracle(env, admin, oracle)`
- Description: Deregister an existing oracle address.
- Parameters:
  - `admin` — must match the stored admin address.
  - `oracle` — oracle address to remove.
- Returns: `Result<(), Error>`.
- State changes: removes address from `ORACLES`.
- Errors: `Unauthorized` (non-admin), `OracleNotFound` (#16 when address not present).

### `submit_oracle_prices(env, submitter, prices)`
- Description: Submit a price vector (one price per registered oracle) and compute the on-chain median. Prices equal to zero are treated as non-responses. A minimum quorum of 3 responses is required when 3 or more oracles are registered; otherwise the quorum equals the oracle count.
- Parameters:
  - `submitter` — any authenticated address.
  - `prices` — `Vec<i128>` whose length must equal the number of registered oracles. A zero entry indicates that oracle did not respond.
- Returns: `Result<OracleReport, Error>` where `OracleReport` contains:
  - `median: i128` — median of non-zero prices after sorting.
  - `responses: u32` — count of non-zero prices.
  - `flagged_count: u32` — count of prices deviating >50% from the median.
- State changes: none (read-only aggregation; the caller decides how to use the result).
- Errors: `InvalidPrice` (#18) if `prices.len() != oracles.len()`, `InsufficientOracleQuorum` (#17) if non-zero responses < quorum.

### `set_oracle_config(env, admin, price_min, price_max, staleness_threshold, max_deviation_bps)`
- Description: Configure price bounds and freshness validation.
- Parameters:
  - `admin` — admin address.
  - `price_min` — minimum accepted price (0 disables lower bound).
  - `price_max` — maximum accepted price (0 disables upper bound).
  - `staleness_threshold` — maximum age of a price update in seconds.
  - `max_deviation_bps` — maximum allowable deviation from the last price.
- Returns: `Result<(), Error>`.
- State changes: updates oracle validation settings.

### `get_oracle_config(env)`
- Description: Read the current oracle validation settings.
- Parameters: none.
- Returns: `Result<OracleConfig, Error>`.
- State changes: none.

### `submit_price(env, oracle, price, price_timestamp)`
- Description: Submit a new oracle price with validation and TWAP tracking.
- Parameters:
  - `oracle` — authorized oracle address.
  - `price` — new price in base units.
  - `price_timestamp` — timestamp associated with the price.
- Returns: `Result<(), Error>`.
- State changes: updates latest price, TWAP accumulators, and publish price state.

### `get_twap_data(env)`
- Description: Read current TWAP pricing state.
- Parameters: none.
- Returns: `Result<TWAPData, Error>`.
- State changes: none.

### `set_twap_window(env, admin, window_seconds)`
- Description: Update the TWAP averaging window.
- Parameters:
  - `admin` — admin address.
  - `window_seconds` — window length in seconds.
- Returns: `Result<(), Error>`.
- State changes: updates `TWAP_WINDOW`.

## Error Codes

| Code | Error | Meaning |
|---|---|---|
| 1 | `NotInitialized` | Contract has not been initialized. |
| 2 | `AlreadyInitialized` | `initialize()` already executed. |
| 3 | `Unauthorized` | Caller is not authorized for the operation. |
| 4 | `InsufficientCollateral` | Requested loan exceeds LTV-backed collateral. |
| 5 | `LoanNotFound` | Loan ID does not exist. |
| 6 | `CollateralNotFound` | Collateral ID does not exist. |
| 7 | `HealthFactorSafe` | Loan health factor is healthy; liquidation not allowed. |
| 8 | `InvalidAmount` | Numeric argument is zero, negative, or overflows. |
| 9 | `LoanAlreadyClosed` | Loan is already repaid or liquidated. |
| 10 | `InvalidFeeRate` | Fee rate exceeds protocol maximum. |
| 11 | `ExceedsCloseFactor` | Liquidation repayment exceeds close factor cap. |
| 12 | `InvalidCloseFactor` | Close factor is out of bounds. |
| 13 | `ContractPaused` | Contract is paused and write operations are blocked. |
| 14 | `AlreadyInProgress` | Reentrancy guard prevented nested execution. |
| 15 | `NotPaused` | Attempted unpause while contract is not paused. |
| 16 | `AlreadyPaused` | Attempted pause while contract is already paused. |
| 17 | `PriceBelowMin` | Oracle price below configured minimum. |
| 18 | `PriceAboveMax` | Oracle price above configured maximum. |
| 19 | `PriceStale` | Submitted price is too old. |
| 20 | `PriceDeviationExceeded` | Price change exceeds allowed deviation. |
| 20 | `LiquidatorNotWhitelisted` | Caller is not on the approved liquidator whitelist. |

## On-Chain State

Key contract storage state used by the interface:

- `ADMIN`, `PENDING_ADMIN` — admin authority and pending admin transfer.
- `ORACLE` — authorized oracle address.
- `TOKEN`, `TREASURY` — token and treasury addresses.
- `LTV`, `LIQ_THR`, `ORIG_FEE`, `INT_FEE`, `CLOSE_FACTOR` — protocol parameters.
- `PAUSED`, `PAUSE_EXP`, `PAUSE_DUR` — pause control state.
- `CollateralRecord` and `LoanRecord` persistent storage keyed by IDs.
- `BASE_RATE`, `SLOPE1`, `SLOPE2`, `KINK` — interest rate model parameters.
- `TOTAL_BORROWED`, `TOTAL_LIQUIDITY` — liquidity tracking state.
- `LAST_PRICE`, `LAST_PRICE_TIME`, `TWAP_PRICE`, `TWAP_SUM`, `TWAP_COUNT`, `TWAP_WINDOW` — oracle price and TWAP state.
- `PRICE_MIN`, `PRICE_MAX`, `STALE_THR`, `DEV_BPS` — oracle validation configuration.
- `WL_COUNT` — instance storage count of whitelisted liquidators (0 = open mode).
- `WhitelistEntry(Address)` — persistent storage flag per approved liquidator address.

## Invoking the Contract with `stellar-cli`

Examples assume a deployed contract ID and Soroban testnet environment.

```bash
export CONTRACT_ID=G...YOUR_CONTRACT_ID...
export RPC_URL=https://soroban-testnet.stellar.org
export NETWORK=testnet
```

### Initialize the contract

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --fn initialize \
  --arg address:$ADMIN_ADDRESS \
  --arg address:$ORACLE_ADDRESS \
  --arg address:$TOKEN_ADDRESS \
  --arg address:$TREASURY_ADDRESS \
  --arg u32:6000 \
  --arg u32:8000 \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --source "$ADMIN_ADDRESS"
```

### Register livestock collateral

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --fn register_livestock \
  --arg address:$OWNER_ADDRESS \
  --arg symbol:cattle \
  --arg u32:5 \
  --arg i128:1000000 \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --source "$OWNER_ADDRESS"
```

### Request a loan

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --fn request_loan \
  --arg address:$BORROWER_ADDRESS \
  --arg vec:u64:$COLLATERAL_ID1,$COLLATERAL_ID2 \
  --arg i128:500000 \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --source "$BORROWER_ADDRESS"
```

### Submit a new oracle price

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --fn submit_price \
  --arg address:$ORACLE_ADDRESS \
  --arg i128:125000 \
  --arg u64:$(date +%s) \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --source "$ORACLE_ADDRESS"
```

### Query a loan record

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --fn get_loan \
  --arg u64:$LOAN_ID \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL"
```

### Transfer collateral ownership

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --fn transfer_collateral \
  --arg address:$CURRENT_OWNER \
  --arg u64:$COLLATERAL_ID \
  --arg address:$NEW_OWNER \
  --network "$NETWORK" \
  --rpc-url "$RPC_URL" \
  --source "$CURRENT_OWNER"
```

## Notes

- The contract uses `submit_price` to validate oracle updates before they affect TWAP state.
- Repayments are allowed even when the contract is paused, while new loans and liquidations are blocked.
- Liquidations are only permitted when `health_factor` is below 10,000 and the repay amount does not exceed `CLOSE_FACTOR`.

## Storage TTL Strategy

Soroban persistent storage entries expire after a configurable number of ledgers. Loan and collateral records are long-lived (active for the duration of a loan, potentially months), so every write to a `Loan` or `Collateral` entry is followed by an `extend_ttl` call.

| Constant | Value | Approximate duration |
|---|---|---|
| `PERSISTENT_TTL_THRESHOLD` | 100,000 ledgers | ~5.7 days |
| `PERSISTENT_TTL_LEDGERS` | 518,400 ledgers | ~30 days |

**Behaviour:** On each write the entry's TTL is extended to `PERSISTENT_TTL_LEDGERS` only when its current TTL has fallen below `PERSISTENT_TTL_THRESHOLD`. This means:

- A freshly created or recently updated entry will not incur a redundant extend ledger write.
- An entry that hasn't been touched for ~24 days will be extended back to 30 days on the next interaction.
- Both constants are compile-time values (`pub const`) in `lib.rs` and can be adjusted for different network configurations without changing contract logic.

**Off-chain responsibility:** The TTL extension inside the contract only fires on writes triggered by contract invocations. Callers (backend or keeper bots) should additionally invoke `ExtendFootprintTTLOp` for dormant entries (loans where no repayment has occurred for an extended period) to prevent archival. See [Stellar docs — state archival](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival).
