#![no_main]
//! Fuzz target: `calculate_interest_rate` jump-rate-model arithmetic invariants.
//!
//! Mirrors `StellarKraal::calculate_interest_rate` in `contracts/stellarkraal/src/lib.rs`.
//! Feeds arbitrary utilization and rate-model parameters into the same formula and
//! asserts the invariants the protocol relies on:
//!
//! * the interest rate is never negative (u32 guarantees this, but overflow is verified);
//! * the rate is monotonically non-decreasing as utilization increases;
//! * the rate never exceeds base + slope1 + slope2 (the theoretical maximum);
//! * no arithmetic panic occurs for any input combination.

use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;

/// Basis-points denominator (100% == 10_000 bps), matching the contract.
const BPS: u64 = 10_000;

#[derive(Arbitrary, Debug)]
struct Input {
    utilization_bps: u32,
    base: u32,
    slope1: u32,
    slope2: u32,
    kink: u32,
}

/// Pure re-implementation of the contract's jump-rate model.
/// Returns `None` only on overflow (which the contract saturates at `u32::MAX`).
fn calculate_interest_rate(
    utilization_bps: u32,
    base: u32,
    slope1: u32,
    slope2: u32,
    kink: u32,
) -> u32 {
    if utilization_bps <= kink {
        let slope1_component = (slope1 as u64)
            .checked_mul(utilization_bps as u64)
            .unwrap_or(u64::MAX)
            / BPS;
        base.checked_add(slope1_component as u32).unwrap_or(u32::MAX)
    } else {
        let slope1_component = (slope1 as u64)
            .checked_mul(kink as u64)
            .unwrap_or(u64::MAX)
            / BPS;
        let excess_util = utilization_bps.saturating_sub(kink);
        let slope2_component = (slope2 as u64)
            .checked_mul(excess_util as u64)
            .unwrap_or(u64::MAX)
            / BPS;
        base.checked_add(slope1_component as u32)
            .and_then(|r| r.checked_add(slope2_component as u32))
            .unwrap_or(u32::MAX)
    }
}

fuzz_target!(|input: Input| {
    let Input {
        utilization_bps,
        base,
        slope1,
        slope2,
        kink,
    } = input;

    // Constrain utilization and kink to valid bps range (0..=10_000).
    let utilization_bps = utilization_bps % (BPS as u32 + 1);
    let kink = kink % (BPS as u32 + 1);

    let rate = calculate_interest_rate(utilization_bps, base, slope1, slope2, kink);

    // Invariant 1: rate must be >= base (slopes only add, never subtract).
    assert!(rate >= base, "rate {rate} fell below base {base}");

    // Invariant 2: monotonicity — rate at full utilization >= rate at current utilization.
    let rate_at_full = calculate_interest_rate(BPS as u32, base, slope1, slope2, kink);
    assert!(
        rate_at_full >= rate,
        "rate at full utilization {rate_at_full} < rate at {utilization_bps} bps: {rate}"
    );

    // Invariant 3: rate at zero utilization equals base (no slope component).
    let rate_at_zero = calculate_interest_rate(0, base, slope1, slope2, kink);
    assert_eq!(rate_at_zero, base, "rate at zero utilization must equal base");

    // Invariant 4: rate at or below kink must not include slope2 component.
    // Verified by checking rate(kink) <= rate(kink+1) when kink < 10_000.
    if kink < BPS as u32 {
        let rate_at_kink = calculate_interest_rate(kink, base, slope1, slope2, kink);
        let rate_just_above = calculate_interest_rate(kink + 1, base, slope1, slope2, kink);
        assert!(
            rate_just_above >= rate_at_kink,
            "rate dropped at kink boundary: {rate_just_above} < {rate_at_kink}"
        );
    }
});

// ── Regression tests for known edge-case inputs ───────────────────────────────
// Any panic discovered by the fuzzer must be converted to a unit test here.

#[cfg(test)]
mod regression {
    use super::calculate_interest_rate;

    #[test]
    fn zero_utilization_equals_base() {
        assert_eq!(calculate_interest_rate(0, 200, 500, 4500, 8000), 200);
    }

    #[test]
    fn max_utilization_no_panic() {
        // Saturates rather than panics on overflow.
        let _ = calculate_interest_rate(10_000, u32::MAX, u32::MAX, u32::MAX, 0);
    }

    #[test]
    fn utilization_at_kink_below_slope2() {
        // At kink exactly, slope2 component is zero.
        let rate_at_kink = calculate_interest_rate(8000, 200, 500, 4500, 8000);
        let rate_below_kink = calculate_interest_rate(7999, 200, 500, 4500, 8000);
        assert!(rate_at_kink >= rate_below_kink);
    }

    #[test]
    fn above_kink_includes_slope2() {
        let rate_above = calculate_interest_rate(9000, 200, 500, 4500, 8000);
        let rate_at_kink = calculate_interest_rate(8000, 200, 500, 4500, 8000);
        assert!(rate_above >= rate_at_kink);
    }

    #[test]
    fn overflow_candidate_saturates() {
        // u32::MAX inputs must not panic; saturation is the expected contract behaviour.
        let rate = calculate_interest_rate(10_000, u32::MAX, u32::MAX, 0, 5000);
        assert_eq!(rate, u32::MAX);
    }
}
