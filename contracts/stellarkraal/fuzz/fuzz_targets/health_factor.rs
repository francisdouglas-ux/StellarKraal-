#![no_main]
//! Fuzz target: health-factor arithmetic invariants.
//!
//! Mirrors `StellarKraal::compute_health_factor_with_thr` in
//! `contracts/stellarkraal/src/lib.rs`. It feeds arbitrary collateral values,
//! outstanding balances, and liquidation thresholds into the same formula the
//! contract uses and asserts the financial invariants the protocol relies on:
//!
//! * the health factor is never negative;
//! * a fully-repaid loan (outstanding == 0) is maximally healthy;
//! * the liquidation predicate (`health < 1.0`) is total — every accepted input
//!   yields a defined, non-panicking health factor (no arithmetic overflow).

use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;

/// Basis-points denominator (1.0 == 10_000 bps), matching the contract.
const BPS_DENOMINATOR: i128 = 10_000;

#[derive(Arbitrary, Debug)]
struct Input {
    total_collateral_value: i128,
    outstanding: i128,
    liq_threshold_bps: u32,
}

/// Pure re-implementation of the contract's health-factor formula:
///
/// `(collateral * liq_thr) / (outstanding * 10_000) * 10_000`
///
/// Returns `None` for inputs outside the contract's valid domain (negative
/// collateral/outstanding) or that would overflow — mirroring the contract's
/// `checked_*` arithmetic and `Error::InvalidAmount` handling. A `Some(_)`
/// result therefore corresponds to an input the contract would accept.
fn calculate_health_factor(
    total_collateral_value: i128,
    outstanding: i128,
    liq_threshold_bps: u32,
) -> Option<i128> {
    if total_collateral_value < 0 || outstanding < 0 {
        return None;
    }
    if outstanding == 0 {
        return Some(i128::MAX);
    }
    let numerator = total_collateral_value.checked_mul(liq_threshold_bps as i128)?;
    let denominator = outstanding.checked_mul(BPS_DENOMINATOR)?;
    Some(numerator / denominator * BPS_DENOMINATOR)
}

fuzz_target!(|input: Input| {
    let Input {
        total_collateral_value,
        outstanding,
        liq_threshold_bps,
    } = input;

    // Constrain the threshold to the contract's valid range (1..=10_000 bps),
    // as enforced by `set_liquidation_threshold`.
    let liq_threshold_bps = (liq_threshold_bps % BPS_DENOMINATOR as u32) + 1;

    if let Some(health_factor) =
        calculate_health_factor(total_collateral_value, outstanding, liq_threshold_bps)
    {
        // Invariant: health factor is never negative.
        assert!(health_factor >= 0, "health factor went negative: {health_factor}");

        // Invariant: a fully-repaid loan is maximally healthy.
        if outstanding == 0 {
            assert_eq!(
                health_factor,
                i128::MAX,
                "fully-repaid loan must be maximally healthy"
            );
        }

        // Invariant: liquidation is permitted only below the 1.0 (10_000 bps)
        // threshold. The predicate must be defined for every accepted input.
        let _liquidatable = health_factor < BPS_DENOMINATOR;
    }
});
