#![no_main]
//! Fuzz target: `request_loan` amount/fee arithmetic invariants.
//!
//! Mirrors the amount-validation and origination-fee logic of
//! `StellarKraal::request_loan` in `contracts/stellarkraal/src/lib.rs`. It feeds
//! arbitrary loan amounts, collateral values, LTV ratios, and origination fees
//! into the same arithmetic the contract uses and asserts the financial
//! invariants the protocol relies on:
//!
//! * an approved loan never exceeds the LTV-capped maximum;
//! * the origination fee is non-negative and never exceeds the principal;
//! * the disbursement is non-negative and never exceeds the principal;
//! * fee + disbursement reconstructs the principal exactly (no value leak).

use arbitrary::Arbitrary;
use libfuzzer_sys::fuzz_target;

/// Basis-points denominator (100% == 10_000 bps), matching the contract.
const BPS_DENOMINATOR: i128 = 10_000;

/// Contract maximum for the origination fee (5%), enforced by `update_fee_config`.
const MAX_ORIG_FEE_BPS: u32 = 500;

#[derive(Arbitrary, Debug)]
struct Input {
    total_collateral_value: i128,
    amount: i128,
    ltv_bps: u32,
    orig_fee_bps: u32,
}

#[derive(Debug, PartialEq)]
enum LoanOutcome {
    InvalidAmount,
    InsufficientCollateral,
    Approved {
        principal: i128,
        disbursement: i128,
        fee: i128,
    },
}

/// Pure re-implementation of `request_loan`'s amount/fee arithmetic. Returns
/// `None` for inputs outside the contract's valid domain (negative collateral)
/// or that would overflow — mirroring the contract's `checked_*` arithmetic and
/// `Error::InvalidAmount` handling.
fn request_loan(
    total_collateral_value: i128,
    amount: i128,
    ltv_bps: u32,
    orig_fee_bps: u32,
) -> Option<LoanOutcome> {
    if total_collateral_value < 0 {
        return None;
    }
    if amount <= 0 {
        return Some(LoanOutcome::InvalidAmount);
    }
    let max_loan = total_collateral_value.checked_mul(ltv_bps as i128)? / BPS_DENOMINATOR;
    if amount > max_loan {
        return Some(LoanOutcome::InsufficientCollateral);
    }
    let fee = amount.checked_mul(orig_fee_bps as i128)? / BPS_DENOMINATOR;
    let disbursement = amount.checked_sub(fee)?;
    Some(LoanOutcome::Approved {
        principal: amount,
        disbursement,
        fee,
    })
}

fuzz_target!(|input: Input| {
    let Input {
        total_collateral_value,
        amount,
        ltv_bps,
        orig_fee_bps,
    } = input;

    // Constrain rates to the contract's valid ranges: LTV is 0..=10_000 bps and
    // the origination fee is capped at 500 bps by `update_fee_config`.
    let ltv_bps = ltv_bps % (BPS_DENOMINATOR as u32 + 1);
    let orig_fee_bps = orig_fee_bps % (MAX_ORIG_FEE_BPS + 1);

    if let Some(outcome) = request_loan(total_collateral_value, amount, ltv_bps, orig_fee_bps) {
        match outcome {
            LoanOutcome::Approved {
                principal,
                disbursement,
                fee,
            } => {
                // Invariant: principal equals the requested amount and is positive.
                assert_eq!(principal, amount);
                assert!(principal > 0, "approved loan must have positive principal");

                // Invariant: fee is non-negative and never exceeds the principal.
                assert!(
                    fee >= 0 && fee <= principal,
                    "origination fee {fee} out of range for principal {principal}"
                );

                // Invariant: disbursement is non-negative and never exceeds the principal.
                assert!(disbursement >= 0, "disbursement went negative: {disbursement}");
                assert!(
                    disbursement <= principal,
                    "disbursed more than borrowed: {disbursement} > {principal}"
                );

                // Invariant: no value is created or lost — fee + disbursement == principal.
                assert_eq!(
                    fee + disbursement,
                    principal,
                    "fee + disbursement must reconstruct the principal"
                );

                // Invariant: an approved loan never exceeds the LTV-capped maximum.
                if let Some(max_loan) = total_collateral_value
                    .checked_mul(ltv_bps as i128)
                    .map(|v| v / BPS_DENOMINATOR)
                {
                    assert!(
                        principal <= max_loan,
                        "approved loan {principal} exceeds LTV cap {max_loan}"
                    );
                }
            }
            LoanOutcome::InvalidAmount => assert!(amount <= 0),
            // The requested amount exceeded the LTV cap — an expected rejection.
            LoanOutcome::InsufficientCollateral => {}
        }
    }
});
