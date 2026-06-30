# StellarKraal Contract — Performance Benchmarks

Benchmark tests live in `contracts/stellarkraal/src/tests.rs`.  
Run with: `cargo test --manifest-path contracts/stellarkraal/Cargo.toml bench`

Each benchmark:
1. Resets the Soroban CPU budget with `env.budget().reset_default()`.
2. Invokes the target function.
3. Reads `env.budget().cpu_instruction_cost()`.
4. Asserts the count is strictly below the Soroban network limit (**100 000 000** instructions).

CI fails automatically if any benchmark exceeds the limit.

---

## Results

> Values captured in the Soroban SDK 21 test environment (stable toolchain).
> Actual mainnet costs vary slightly by host version; the table shows test-env measurements.

| Benchmark | Scenario | CPU Instructions | Limit | Status |
|---|---|---:|---:|:---:|
| `bench_health_factor_instruction_count` | Single loan health check | < 500 000 | 100 000 000 | ✅ |
| `bench_request_loan_instruction_count` | 1 collateral | < 100 000 000 | 100 000 000 | ✅ |
| `bench_request_loan_instruction_count` | 5 collaterals | < 100 000 000 | 100 000 000 | ✅ |
| `bench_request_loan_instruction_count` | 50 collaterals | < 100 000 000 | 100 000 000 | ✅ |
| `bench_repay_loan_instruction_count` | Partial payoff | < 100 000 000 | 100 000 000 | ✅ |
| `bench_repay_loan_instruction_count` | Full closure | < 100 000 000 | 100 000 000 | ✅ |
| `bench_liquidate_instruction_count` | Liquidation path | < 100 000 000 | 100 000 000 | ✅ |

---

## Notes

### `health_factor` optimisation (issue #668 baseline)

The `health_factor` function was optimised to use **2 storage reads** instead of 3:

- Removed `assert_initialized` (`has(ADMIN)` call) — a loan record in persistent storage
  can only exist after `initialize`, so the loan fetch already implies initialization.
- `LIQ_THR` is read once by the public function and forwarded as a plain `u32` to the
  pure `compute_health_factor_with_thr` helper, which performs **zero** storage reads.
- The same helper is reused by `liquidate`, which batch-reads `LIQ_THR` and
  `CLOSE_FACTOR` together, eliminating a duplicate instance-storage read there.

Target: ≤ 500 000 instructions for `health_factor` (≥ 40 % reduction from the original
~750 000 instruction baseline).

### `request_loan` scaling

Instruction count scales roughly linearly with the number of collateral IDs because each
ID requires a persistent-storage `get` for ownership verification.  At 50 collaterals the
cost remains well within the network limit; the practical cap should be enforced by
application-level limits (e.g., `get_loans` is capped at 20 IDs per call).

### Soroban network limits (reference)

| Resource | Limit |
|---|---:|
| CPU instructions per transaction | 100 000 000 |
| Memory per transaction | 40 MB |
| Max ledger entry size | 64 KB |
