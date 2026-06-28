# ADR-006: Multi-Oracle Median Aggregation for Livestock Price Feeds

**Date:** 2026-06-23  
**Status:** Accepted

## Context

StellarKraal lends against livestock collateral. Unlike fungible crypto assets, livestock has **no liquid on-chain market and no public price feed**. A cow's value depends on breed, weight, age, health, and regional market conditions — data that only exists off-chain and is produced by professional appraisers and market data services.

This creates a structural problem the protocol must solve at the architecture level:

- The contract needs a trustworthy collateral price to enforce LTV limits, compute health factors, and authorize liquidations.
- There is no DEX, AMM, or established price oracle (e.g. Chainlink, Pyth) that quotes livestock prices, so the protocol cannot consume an existing decentralized feed.
- A naive single trusted oracle is a single point of failure: if its key is compromised or it submits a wrong value (deliberately or by bug), the protocol can be drained via under-collateralized loans or unjust liquidations.

[ADR-005](ADR-005-collateral-appraisal-model.md) already established **that** valuation is produced off-chain and submitted on-chain rather than computed by a fully decentralized on-chain feed. ADR-005 left open the question this ADR answers: **how many oracles, what is the trust model between them, how is the on-chain price aggregated, and how does the off-chain appraisal pipeline relate to the on-chain price.**

The contract has since grown beyond the single-oracle MVP described in ADR-005. It now supports:

- a legacy single `ORACLE` address (kept for backward compatibility), and
- a registered set of up to 5 oracles (`ORACLES`) with median aggregation and a configurable quorum.

This decision needs to be captured so contributors and forks understand the oracle trust model without reverse-engineering `contracts/stellarkraal/src/lib.rs`.

## Decision

We adopt a **multi-oracle design with on-chain median aggregation and a minimum quorum**, layered on top of the off-chain appraisal model from ADR-005.

### On-chain oracle aggregation

- The admin registers up to **5 oracle addresses** via `add_oracle` / `remove_oracle` (`get_oracles` reads the set). The cap bounds gas cost and keeps the trust set small and auditable.
- `submit_oracle_prices(submitter, prices)` accepts one price per registered oracle. Non-positive (`<= 0`) prices are treated as **non-responses** (the oracle abstained / had no data).
- A **quorum** is enforced: `min_quorum = min(3, oracle_count)`. With 3 or more registered oracles, at least 3 must respond with a positive price; otherwise the call fails with `InsufficientOracleQuorum`. Fewer than 3 registered oracles require all of them to respond.
- The on-chain **median** of the responding prices is computed and returned in an `OracleReport { median, responses, flagged_count }`. The median is chosen over the mean because it is robust to a single outlier/manipulated submission — corrupting the aggregate requires controlling a majority of responders, not just one.
- Each submitted price that deviates more than **50% from the median** is counted in `flagged_count`. This surfaces likely-bad submissions for off-chain monitoring and dispute handling without rejecting the whole report.

### Per-oracle price validation and TWAP

- The single-oracle `submit_price(oracle, price, price_timestamp)` path validates each submission against the configurable `OracleConfig` (`set_oracle_config`): `price_min` / `price_max` bounds, `staleness_threshold`, and `max_deviation_bps`. Violations return `PriceBelowMin`, `PriceAboveMax`, `PriceStale`, or `PriceDeviationExceeded`.
- Accepted prices feed a Time-Weighted Average Price window (default 1 hour, `set_twap_window`). Liquidations use the TWAP; loan requests may use the spot price with a TWAP sanity check. See [docs/protocol/twap-mechanism.md](../protocol/twap-mechanism.md) for the full mechanism.

### Relationship between off-chain appraisal and on-chain price

These are two distinct layers, and the distinction is the core of the trust model:

| Layer | Where | Source of truth for | Trust assumption |
|-------|-------|---------------------|------------------|
| **Off-chain appraisal** (`backend/src/utils/appraisalCache.ts`) | Backend (in-memory cache, default 5 min TTL) | Fast reads for UI, loan pre-checks, and origination flows | Convenience/performance layer; **never authoritative for on-chain enforcement** |
| **On-chain oracle price** (`submit_price` / `submit_oracle_prices` + TWAP) | Soroban contract | LTV enforcement, health factor, liquidation eligibility | Authoritative; protected by quorum, median, bounds, staleness, deviation, and TWAP |

The off-chain `appraisalCache` does **not** decide collateral safety. It caches appraisal values keyed by `collateralId` so the backend can serve appraisals without recomputing them, marking entries `stale` past the TTL. When an oracle price update is observed on-chain, the backend invalidates the affected entry (`invalidateAppraisal`) or the whole cache (`invalidateAll`) so off-chain reads converge back toward the authoritative on-chain price. In other words: **off-chain appraisals are an input proposed to oracles and a cached projection of price for UX; the contract's median/TWAP price is the only value that gates funds.**

## Alternatives Considered

| Option | Reason not chosen |
|--------|-------------------|
| **Single trusted oracle** (ADR-005 MVP) | A single key is a single point of failure: one compromised or buggy submitter can under-collateralize loans or trigger unjust liquidations. Acceptable for an MVP, but not for protecting real collateral at scale. Retained only as a backward-compatible fallback. |
| **Chainlink / Pyth / existing price oracle** | No established decentralized oracle quotes livestock prices — the asset has no liquid on-chain market to derive a feed from. Integrating one would still require an off-chain appraisal pipeline feeding it, adding a dependency and cost without removing the core problem. Revisit if a livestock data feed emerges. |
| **Mean (average) of all oracle prices** | The mean is dragged by a single extreme value, so one manipulated submission shifts the aggregate. The median requires a *majority* of responders to be corrupted to move the result, giving a stronger trust model for the same gas. |
| **Fully on-chain decentralized aggregation / staking + slashing** | Soroban oracle infrastructure for this is immature and the contract complexity, gas cost, and attack surface are not justified for the current scale. The flagging mechanism (`flagged_count`) plus off-chain monitoring covers dispute detection at far lower cost. |
| **Off-chain aggregation, submit only the final price** | Moves the trust boundary entirely off-chain and removes the contract's ability to enforce quorum and outlier resistance. On-chain median keeps aggregation verifiable and tamper-evident. |

## Consequences

**Positive:**

- No single oracle can move the authoritative price: corrupting the median requires a majority of the quorum.
- Quorum (`min(3, n)`) tolerates individual oracle downtime — abstentions (`price <= 0`) don't block reporting as long as enough oracles respond.
- `flagged_count` gives operators an on-chain signal of suspicious submissions to drive disputes and oracle removal, without rejecting otherwise-valid reports.
- Median + bounds + staleness + deviation + TWAP compose into defense in depth against both flash manipulation and stale/erroneous data.
- The off-chain/on-chain split is explicit: the cache can fail or be stale without ever endangering funds, because on-chain enforcement is independent of it.

**Negative / Trade-offs:**

- The admin still controls the oracle set (`add_oracle` / `remove_oracle`), so admin-key compromise remains a governance risk. Mitigated operationally (multisig/timelock recommended) rather than in-contract.
- Median resists a minority of bad oracles but **not collusion by a majority** of the quorum — same limitation TWAP notes for sustained attacks.
- The 5-oracle cap and bubble-sort aggregation bound complexity but also cap decentralization; scaling the oracle set requires a contract upgrade.
- Two price representations (off-chain cache vs. on-chain price) require disciplined cache invalidation; a missed invalidation surfaces only as stale UX, never as unsafe lending, but is still confusing if undocumented.

## Security Considerations

- **Manipulation resistance:** Median aggregation means an attacker must control more than half the responding oracles to move the price; combined with the 50%-from-median flagging, anomalous single submissions are detectable.
- **Quorum / liveness:** `InsufficientOracleQuorum` blocks aggregation when too few oracles respond, preventing a thin/uncontested price from gating liquidations.
- **Outlier flagging & disputes:** `flagged_count` is the primary dispute-detection primitive — operators monitor it, investigate flagged submissions off-chain, and remove misbehaving oracles via `remove_oracle`. There is no on-chain slashing; disputes are resolved by admin governance.
- **Staleness & deviation:** Per-submission `staleness_threshold` and `max_deviation_bps` (`set_oracle_config`) reject old or sharply jumping prices on the single-oracle path.
- **Flash-loan / spot manipulation:** TWAP (see [twap-mechanism.md](../protocol/twap-mechanism.md)) ensures liquidations price collateral over a window, so a single-block price move cannot trigger profitable liquidation.
- **Off-chain cache is non-authoritative:** Because `appraisalCache.ts` never gates funds, poisoning or staleness in the cache degrades UX only. The authoritative path remains the on-chain median/TWAP.
- **Residual trust:** Admin authority over the oracle set and a majority-collusion scenario are the residual risks; both are addressed by governance controls (key management, multisig) outside the contract.

## Notes

- Implementation reference: `contracts/stellarkraal/src/lib.rs` — `add_oracle`, `remove_oracle`, `get_oracles`, `submit_oracle_prices`, `submit_price`, `set_oracle_config`, and the `OracleReport` / `OracleConfig` / `TWAPData` types.
- Off-chain reference: `backend/src/utils/appraisalCache.ts`.
- Related: [ADR-005](ADR-005-collateral-appraisal-model.md) (off-chain appraisal model), [docs/protocol/twap-mechanism.md](../protocol/twap-mechanism.md), [docs/contracts/stellarkraal-interface.md](../contracts/stellarkraal-interface.md).
- **Migration path:** if the oracle model must change (more oracles, weighted median, external decentralized feed, or on-chain slashing), it requires a contract upgrade. The single `ORACLE` address is retained for backward compatibility and can be deprecated once all integrations use the registered oracle set.
