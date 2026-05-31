# ADR-005: Use Off-Chain Appraisal Values for Collateral Valuation

**Date:** 2026-05-30  
**Status:** Accepted

## Context

StellarKraal requires reliable collateral valuation to permit loans against livestock assets.
The smart contract must enforce collateral-backed loan limits without incurring excessive on-chain complexity or dependence on a fully decentralized price oracle.

The contract currently supports an external oracle address and validation rules for submitted prices, but the underlying appraisal model can be implemented in multiple ways:

- on-chain oracle feeds with decentralized aggregation,
- off-chain appraisal values submitted by a trusted service,
- fixed or synthetic price references baked into the contract.

Constraints:

- Soroban on-chain oracle infrastructure is still evolving and can be expensive to maintain.
- Livestock appraisal requires specialized off-chain data that is easiest to produce outside the contract.
- The backend must be able to prevent unsafe loan issuance and preserve recoverability in the face of stale or incorrect price submissions.

## Decision

We decided to use off-chain appraisal values and a trusted oracle submission flow rather than fully on-chain oracles.

The contract accepts price submissions from an authorized `oracle` address and validates them using configurable bounds, staleness thresholds, and deviation limits.
It also maintains a TWAP window for smoother pricing state.

This approach keeps the smart contract logic simpler and more auditable while still enforcing meaningful on-chain constraints.

## Alternatives Considered

| Option | Reason not chosen |
|--------|-------------------|
| Fully on-chain decentralized oracle feed | Requires more complex contract logic and on-chain infrastructure that is not yet stable for livestock pricing. It also increases gas costs and attack surface. |
| Fixed on-chain valuations / static price table | Too inflexible for real-world livestock markets and would not support dynamic loan pricing as collateral values change. |
| Hybrid fallback to multiple off-chain oracles | Adds operational complexity and still requires off-chain coordination; the initial MVP should favor a simpler single trusted oracle with validations. |
| No oracle / fixed LTV value only | Does not reflect actual collateral risk and may cause under-collateralization or overly conservative lending limits. |

## Consequences

**Positive:**

- Minimizes smart contract complexity and audit surface.
- Reduces Soroban execution cost by avoiding on-chain aggregation logic.
- Enables real-world livestock appraisals to be produced by external services.
- Retains on-chain validation for submitted prices via `submit_price`, `set_oracle_config`, and TWAP state.

**Negative / Trade-offs:**

- Introduces reliance on an off-chain oracle service and operator trust.
- Requires operational monitoring of price submission freshness and deviation thresholds.
- Off-chain data availability becomes a critical dependency for loan origination.

## Notes

- Implementation reference: `contracts/stellarkraal/src/lib.rs`.
- The contract uses `Error::PriceStale`, `Error::PriceDeviationExceeded`, `Error::PriceBelowMin`, and `Error::PriceAboveMax` to guard oracle updates.
- The chosen model enables the backend to continue supporting loan operations while preserving on-chain enforcement of price validity.
