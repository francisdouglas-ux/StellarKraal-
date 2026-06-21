# Liquidation Mechanism & Health Factor

## Overview

StellarKraal uses a **health factor** to determine whether a loan position is safe or eligible for liquidation. When collateral value drops relative to outstanding debt, the health factor falls below the safety threshold and any address can liquidate the position.

---

## Health Factor Formula

```
HF = (total_collateral_value × liquidation_threshold_bps) / (outstanding × 10_000) × 10_000
```

### Variable definitions

| Variable | Symbol | Description |
|---|---|---|
| Total collateral value | `total_collateral_value` | Sum of appraised values of all collateral assets locked to the loan, in token base units |
| Liquidation threshold | `liquidation_threshold_bps` | Protocol parameter controlling the safety margin, default **8000** (= 80%) |
| Outstanding debt | `outstanding` | Current debt owed by the borrower (principal + accrued interest), in token base units |
| Health factor | `HF` | Dimensionless safety ratio scaled by **10,000** |

**Safe condition:** `HF >= 10_000` (ratio ≥ 1.0)  
**Liquidatable:** `HF < 10_000` (ratio < 1.0)

> If `outstanding == 0` the health factor is `i128::MAX` (fully repaid, cannot be liquidated).

### Rust implementation (`contracts/stellarkraal/src/lib.rs`)

```rust
let numerator   = total_collateral_value * liq_thr as i128;   // liq_thr = 8000
let denominator = outstanding * 10_000;
HF = (numerator / denominator) * 10_000
```

---

## Protocol Parameters (defaults)

| Parameter | Symbol | Default | Rationale |
|---|---|---|---|
| Loan-to-Value | `LTV` | 6000 bps (60%) | Caps initial disbursement at 60% of collateral; provides a 20 pp buffer before the liquidation threshold is breached |
| Liquidation Threshold | `LIQ_THR` | 8000 bps (80%) | HF drops below 1.0 when outstanding debt exceeds 80% of collateral value; the 20 pp gap between LTV and this threshold acts as a safety cushion to absorb price volatility before liquidation is triggered |
| Origination Fee | `ORIG_FEE` | 50 bps (0.5%) | Deducted from disbursement at loan creation |
| Interest Fee | `INT_FEE` | 1000 bps (10%) | Applied to the interest portion on repayment |
| Close Factor | `CLOSE_FACTOR` | 5000 bps (50%) | Maximum percentage of outstanding debt a liquidator can repay in one call; limits price impact and gives the borrower a chance to self-cure |

---

## Worked Examples

### Example 1 — Healthy loan (liquidation rejected)

**Setup**

| Item | Value |
|---|---|
| Collateral (5 cattle @ 200 XLM each) | 1,000 XLM |
| Loan principal | 600 XLM (60% LTV) |
| Outstanding debt | 600 XLM |

**Health factor**

```
HF = (1000 × 8000) / (600 × 10_000) × 10_000
   = 8_000_000 / 6_000_000 × 10_000
   = 13_333   ✅ SAFE
```

Calling `liquidate` returns **`Error::HealthFactorSafe` (code 7)** — the contract rejects the call immediately.

---

### Example 2 — Partial liquidation after a 30% collateral price drop

**Setup** (same loan as above; cattle value falls to 700 XLM)

**Health factor after price drop**

```
HF = (700 × 8000) / (600 × 10_000) × 10_000
   = 5_600_000 / 6_000_000 × 10_000
   = 9_333   ⚠️ LIQUIDATABLE
```

**Close-factor cap**

```
max_repay = 600 × 5000 / 10_000 = 300 XLM
```

Liquidator calls `liquidate(liquidator, loan_id, 300)`.

**State after partial liquidation**

| Item | Before | After |
|---|---|---|
| Outstanding debt | 600 XLM | 300 XLM |
| Loan status | Active | Active |

```
HF = (700 × 8000) / (300 × 10_000) × 10_000
   = 5_600_000 / 3_000_000 × 10_000
   = 18_666   ✅ SAFE again
```

---

### Example 3 — Full liquidation (outstanding reaches zero)

**Setup** (small loan, large collateral drop)

| Item | Value |
|---|---|
| Collateral value (post-drop) | 100 XLM |
| Outstanding debt | 200 XLM |

```
HF = (100 × 8000) / (200 × 10_000) × 10_000
   = 800_000 / 2_000_000 × 10_000
   = 4_000   ⚠️ LIQUIDATABLE
```

Close-factor cap: `200 × 5000 / 10_000 = 100 XLM`.

Liquidator calls `liquidate(liquidator, loan_id, 100)`.  
Outstanding becomes `200 − 100 = 100 XLM` — loan stays `Active`.

A second liquidation call with `repay_amount = 100`:  
Outstanding becomes `100 − 100 = 0` → loan status transitions to **`Liquidated`**.

---

## On-Chain Liquidation Flow

The following describes exactly what happens inside the `liquidate` contract function.

### Pre-conditions (checked in order)

1. Contract is **initialized** — otherwise `Error::NotInitialized`.
2. Contract is **not paused** — otherwise `Error::ContractPaused`.
3. `repay_amount > 0` — otherwise `Error::InvalidAmount`.
4. `liquidator` signs the transaction (`require_auth`).
5. Loan identified by `loan_id` exists — otherwise `Error::LoanNotFound`.
6. Loan status is `Active` — otherwise `Error::LoanAlreadyClosed`.

### Execution steps

```
1. Read LIQ_THR and CLOSE_FACTOR from instance storage.

2. Compute HF using:
      HF = (total_collateral_value × LIQ_THR) / (outstanding × 10_000) × 10_000

3. If HF >= 10_000  →  revert Error::HealthFactorSafe

4. Compute max_repay = outstanding × CLOSE_FACTOR / 10_000
   If repay_amount > max_repay  →  revert Error::ExceedsCloseFactor

5. Transfer repay_amount tokens from liquidator → contract  (SAC transfer)

6. outstanding -= repay_amount

7. If outstanding == 0:
       loan.status = Liquidated
   Else:
       loan.status remains Active

8. Persist updated LoanRecord to storage.

9. Emit event:
       topic: ("loan", "liquidated")
       data:  (loan_id, liquidator, repay_amount, outstanding, status)
```

### Collateral settlement

The contract does **not** transfer collateral on-chain. Collateral release to the liquidator is handled off-chain via the oracle/settlement layer after the `loan/liquidated` event is observed. The backend event listener (`src/contractEventListener.ts`) processes this event and updates the local database.

### Invoking via `stellar-cli`

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --fn liquidate \
  --arg address:$LIQUIDATOR_ADDRESS \
  --arg u64:$LOAN_ID \
  --arg i128:$REPAY_AMOUNT \
  --network testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --source "$LIQUIDATOR_ADDRESS"
```

Query the health factor before liquidating:

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --fn health_factor \
  --arg u64:$LOAN_ID \
  --network testnet \
  --rpc-url https://soroban-testnet.stellar.org
```

---

## Partial Liquidation Mechanics

StellarKraal supports **partial liquidations** governed by the close factor:

1. A liquidator calls `liquidate(liquidator, loan_id, repay_amount)`.
2. The contract checks `HF < 10_000`; reverts with `HealthFactorSafe` otherwise.
3. `repay_amount` must satisfy `repay_amount <= outstanding × close_factor / 10_000`.
4. The liquidator transfers `repay_amount` tokens to the contract.
5. `outstanding` is reduced by `repay_amount`.
6. If `outstanding` reaches 0, loan status becomes `Liquidated`; otherwise it stays `Active`.
7. The liquidator receives collateral value proportional to the repaid debt (handled off-chain via oracle settlement in the current implementation).

> **No liquidation bonus** is applied in the current contract version. The incentive for liquidators is the discounted collateral acquisition negotiated off-chain.

---

## Error Codes

| Code | Name | Meaning |
|---|---|---|
| 7 | `HealthFactorSafe` | Loan HF >= 10_000; liquidation rejected |
| 11 | `ExceedsCloseFactor` | `repay_amount` exceeds close factor cap |
| 5 | `LoanNotFound` | Invalid `loan_id` |
| 9 | `LoanAlreadyClosed` | Loan is Repaid or already Liquidated |
| 13 | `ContractPaused` | Contract paused; liquidations blocked |

---

## Related

- [Smart Contract Interface](../contracts/stellarkraal-interface.md) — full public API, all error codes, `liquidate` and `health_factor` function signatures, and additional `stellar-cli` examples
- Smart contract source: [`contracts/stellarkraal/src/lib.rs`](../../contracts/stellarkraal/src/lib.rs)
- Frontend health gauge: [`frontend/src/components/HealthGauge.tsx`](../../frontend/src/components/HealthGauge.tsx)
- Backend health endpoint: `GET /api/health/:loanId`
- Backend event listener: [`backend/src/contractEventListener.ts`](../../backend/src/contractEventListener.ts)
