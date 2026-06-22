# Fuzz Testing Guide - StellarKraal Smart Contract

## Overview

Fuzz testing feeds random or semi-random inputs into a program to discover edge
cases and arithmetic bugs that hand-written tests miss. The StellarKraal smart
contract is fuzzed with [`cargo-fuzz`](https://github.com/rust-fuzz/cargo-fuzz)
(libFuzzer) to machine-verify the protocol's critical financial invariants.

The fuzz harness lives in [`contracts/stellarkraal/fuzz/`](../../contracts/stellarkraal/fuzz)
and is a standalone Cargo workspace so it can link the libFuzzer host runtime
independently of the `#![no_std]` contract crate.

> **Complementary property tests:** `contracts/stellarkraal/src/tests.rs` also
> contains `proptest`-based property tests (`prop_*`) that exercise the live
> contract through its client. The `cargo-fuzz` targets documented here focus on
> the pure arithmetic invariants and run under a dedicated time-limited CI job.

## Why Fuzz Testing?

The contract's arithmetic (health factor, LTV cap, origination/interest fees) is
hard to test exhaustively by hand. libFuzzer generates millions of inputs per
run and shrinks any failing case to a minimal reproducer, so invariants are
verified across the whole input space rather than at a handful of chosen points.

## Setup

### Prerequisites

- A **nightly** Rust toolchain (libFuzzer requires nightly).
- `cargo-fuzz`:

  ```bash
  cargo install cargo-fuzz --locked
  ```

`cargo-fuzz` is a CLI tool, not a crate dependency. The harness itself depends
only on `libfuzzer-sys` and `arbitrary` (declared in
`contracts/stellarkraal/fuzz/Cargo.toml`).

### Running the fuzz targets

All commands run from `contracts/stellarkraal/` (the directory that contains the
`fuzz/` sub-crate):

```bash
# List available targets
cargo +nightly fuzz list

# Run a target until you stop it (Ctrl-C)
cargo +nightly fuzz run health_factor
cargo +nightly fuzz run loan_request

# Run a target for a bounded time (matches CI: 60 seconds)
cargo +nightly fuzz run health_factor -- -max_total_time=60
```

## Fuzz Targets

### 1. `health_factor`

**File:** `fuzz/fuzz_targets/health_factor.rs`
**Mirrors:** `StellarKraal::compute_health_factor_with_thr` in `src/lib.rs`
**Formula:** `(collateral * liq_threshold_bps) / (outstanding * 10_000) * 10_000`

**Inputs (arbitrary):**

- `total_collateral_value`: any `i128`
- `outstanding`: any `i128`
- `liq_threshold_bps`: constrained to the contract's valid `1..=10_000` range

**Invariants asserted:**

- The health factor is never negative.
- A fully-repaid loan (`outstanding == 0`) is maximally healthy (`i128::MAX`).
- The liquidation predicate (`health < 1.0`, i.e. `< 10_000`) is total — every
  input the contract would accept yields a defined, non-panicking result.
- No arithmetic overflow occurs (overflowing inputs are rejected via
  `checked_*`, exactly as the contract does).

### 2. `loan_request`

**File:** `fuzz/fuzz_targets/loan_request.rs`
**Mirrors:** the amount/fee logic of `StellarKraal::request_loan` in `src/lib.rs`

**Inputs (arbitrary):**

- `total_collateral_value`: any `i128`
- `amount`: any `i128`
- `ltv_bps`: constrained to `0..=10_000`
- `orig_fee_bps`: constrained to `0..=500` (the contract's fee cap)

**Invariants asserted (for approved loans):**

- The principal equals the requested amount and is positive.
- The origination fee is non-negative and never exceeds the principal.
- The disbursement is non-negative and never exceeds the principal.
- `fee + disbursement == principal` (no value is created or lost).
- The approved loan never exceeds the LTV-capped maximum.

Rejected inputs map to the contract's `InvalidAmount` (non-positive amount) and
`InsufficientCollateral` (amount above the LTV cap) outcomes.

## CI Integration

The [`fuzz.yml`](../../.github/workflows/fuzz.yml) workflow runs on every pull
request that touches `contracts/**`. It installs `cargo-fuzz`, then runs each
target for a time-limited 60-second session:

```yaml
on:
  pull_request:
    paths:
      - "contracts/**"

# ...
      - run: cargo +nightly fuzz run health_factor -- -max_total_time=60
      - run: cargo +nightly fuzz run loan_request -- -max_total_time=60
```

If a target crashes, the failing input is uploaded as a build artifact for
reproduction.

## Corpus and Artifacts

libFuzzer stores interesting inputs under `fuzz/corpus/<target>/` and crash
reproducers under `fuzz/artifacts/<target>/`. These directories are
git-ignored. To reproduce a saved crash locally:

```bash
cargo +nightly fuzz run health_factor fuzz/artifacts/health_factor/<crash-file>
```

## Interpreting Results

### Passing

A run that finishes its time budget (or that you stop manually) without printing
a crash means every generated input satisfied the asserted invariants.

### Failing

On a failed assertion or panic, libFuzzer prints the failing input and writes a
reproducer to `fuzz/artifacts/<target>/`. Re-run the target with that file path
(see above) to reproduce deterministically, then narrow it down with:

```bash
cargo +nightly fuzz tmin <target> fuzz/artifacts/<target>/<crash-file>
```

## Best Practices

1. **Run before contract changes** that touch arithmetic.
2. **Extend coverage**: add a new fuzz target when adding a financial calculation.
3. **Keep targets in sync** with the contract logic they mirror, and update this
   guide when targets change.
4. **Commit useful corpus seeds** if a particular input class is worth retaining.

## References

- [cargo-fuzz documentation](https://rust-fuzz.github.io/book/cargo-fuzz.html)
- [libFuzzer documentation](https://llvm.org/docs/LibFuzzer.html)
- [StellarKraal Protocol Docs](../protocol/)
