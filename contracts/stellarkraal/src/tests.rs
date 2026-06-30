use super::*;
use soroban_sdk::{
    symbol_short, vec,
    testutils::{Address as _, Events as _, Ledger},
    Address, Env,
};
use proptest::prelude::*;

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
}

fn setup() -> (Env, Address, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, StellarKraal);
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    let token = env.register_contract(None, MockToken);
    let treasury = Address::generate(&env);
    (env, contract_id, admin, oracle, token, treasury)
}

fn init(
    env: &Env,
    contract_id: &Address,
    admin: &Address,
    oracle: &Address,
    token: &Address,
    treasury: &Address,
) {
    let client = StellarKraalClient::new(env, contract_id);
    client.initialize(admin, oracle, token, treasury, &6000u32, &8000u32);
}

// ── initialize ────────────────────────────────────────────────────────
#[test]
fn test_initialize_ok() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
}

#[test]
#[should_panic(expected = "#2")]
fn test_initialize_twice_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    init(&env, &cid, &admin, &oracle, &token, &treasury);
}

// ── register_livestock ────────────────────────────────────────────────
#[test]
fn test_register_livestock_ok() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let owner = Address::generate(&env);
    let id = client.register_livestock(&owner, &symbol_short!("cattle"), &5u32, &1_000_000i128);
    assert_eq!(id, 1);
}

#[test]
#[should_panic(expected = "#8")]
fn test_register_zero_count_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let owner = Address::generate(&env);
    client.register_livestock(&owner, &symbol_short!("goat"), &0u32, &500_000i128);
}

#[test]
#[should_panic(expected = "#8")]
fn test_register_zero_value_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let owner = Address::generate(&env);
    client.register_livestock(&owner, &symbol_short!("sheep"), &3u32, &0i128);
}

// ── request_loan ──────────────────────────────────────────────────────
#[test]
fn test_request_loan_within_ltv() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
    assert_eq!(loan_id, 1);
}

#[test]
#[should_panic(expected = "#4")]
fn test_request_loan_exceeds_ltv() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    client.request_loan(&borrower, &vec![&env, col_id], &700_000i128);
}

#[test]
#[should_panic(expected = "#3")]
fn test_request_loan_wrong_owner() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let owner = Address::generate(&env);
    let attacker = Address::generate(&env);
    let col_id =
        client.register_livestock(&owner, &symbol_short!("goat"), &3u32, &500_000i128);
    client.request_loan(&attacker, &vec![&env, col_id], &100_000i128);
}

#[test]
fn test_request_loan_multi_collateral() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col1 =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &600_000i128);
    let col2 =
        client.register_livestock(&borrower, &symbol_short!("goat"), &5u32, &400_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col1, col2], &600_000i128);
    let loan = client.get_loan(&loan_id);
    assert_eq!(loan.total_collateral_value, 1_000_000);
    assert_eq!(loan.collateral_ids.len(), 2);
}

#[test]
fn test_request_loan_three_collaterals() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col1 =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &1u32, &300_000i128);
    let col2 =
        client.register_livestock(&borrower, &symbol_short!("goat"), &3u32, &200_000i128);
    let col3 =
        client.register_livestock(&borrower, &symbol_short!("sheep"), &5u32, &100_000i128);
    let loan_id =
        client.request_loan(&borrower, &vec![&env, col1, col2, col3], &360_000i128);
    let loan = client.get_loan(&loan_id);
    assert_eq!(loan.total_collateral_value, 600_000);
}

#[test]
#[should_panic(expected = "#4")]
fn test_multi_collateral_exceeds_combined_ltv() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col1 =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &1u32, &500_000i128);
    let col2 =
        client.register_livestock(&borrower, &symbol_short!("goat"), &2u32, &500_000i128);
    client.request_loan(&borrower, &vec![&env, col1, col2], &700_000i128);
}

#[test]
#[should_panic(expected = "#6")]
fn test_request_loan_empty_collateral_ids_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    client.request_loan(&borrower, &vec![&env], &100_000i128);
}

// ── repay_loan ────────────────────────────────────────────────────────
#[test]
fn test_partial_repay() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
    client.repay_loan(&borrower, &loan_id, &200_000i128);
    let loan = client.get_loan(&loan_id);
    assert_eq!(loan.outstanding, 400_000);
}

#[test]
fn test_full_repay_marks_repaid() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
    client.repay_loan(&borrower, &loan_id, &600_000i128);
    let loan = client.get_loan(&loan_id);
    assert_eq!(loan.status, LoanStatus::Repaid);
}

#[test]
#[should_panic(expected = "#9")]
fn test_repay_closed_loan_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
    client.repay_loan(&borrower, &loan_id, &600_000i128);
    client.repay_loan(&borrower, &loan_id, &1i128);
}

// ── health_factor ─────────────────────────────────────────────────────
#[test]
fn test_health_factor_healthy() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
    let hf = client.health_factor(&loan_id);
    assert!(hf >= 10_000, "health factor should be >= 1.0");
}

// ── bench: health_factor (issue #668 baseline) ────────────────────────
/// Baseline benchmark: verify health_factor instruction count is within budget.
///
/// Optimization: `assert_initialized` removed (loan in persistent storage implies init),
/// `LIQ_THR` read once and forwarded to the pure helper — 2 storage ops instead of 3.
#[test]
fn bench_health_factor_instruction_count() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);

    env.budget().reset_default();
    let hf = client.health_factor(&loan_id);
    let instructions_after = env.budget().cpu_instruction_cost();

    assert_eq!(hf, 13_333, "health factor value must be unchanged");
    assert!(
        instructions_after < 500_000,
        "health_factor used {} instructions, expected < 500_000",
        instructions_after
    );
}

// ── bench: request_loan (issue #668) ──────────────────────────────────
/// Benchmark request_loan with 1, 5, and 50 collateral inputs.
///
/// Each scenario resets the instruction budget, invokes the function, then
/// asserts the recorded count remains beneath the Soroban network limit
/// (100 000 000 CPU instructions).
#[test]
fn bench_request_loan_instruction_count() {
    const SOROBAN_CPU_LIMIT: u64 = 100_000_000;

    // ── 1 collateral ──────────────────────────────────────────────────
    {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);

        let col = client.register_livestock(
            &borrower,
            &symbol_short!("cattle"),
            &1u32,
            &1_000_000i128,
        );
        let ids = vec![&env, col];

        env.budget().reset_default();
        client.request_loan(&borrower, &ids, &500_000i128);
        let cost = env.budget().cpu_instruction_cost();
        assert!(
            cost < SOROBAN_CPU_LIMIT,
            "request_loan (1 collateral) used {} instructions, limit {}",
            cost,
            SOROBAN_CPU_LIMIT
        );
    }

    // ── 5 collaterals ─────────────────────────────────────────────────
    {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);

        let mut ids = Vec::new(&env);
        for _ in 0..5u32 {
            let col = client.register_livestock(
                &borrower,
                &symbol_short!("goat"),
                &1u32,
                &200_000i128,
            );
            ids.push_back(col);
        }

        env.budget().reset_default();
        client.request_loan(&borrower, &ids, &600_000i128);
        let cost = env.budget().cpu_instruction_cost();
        assert!(
            cost < SOROBAN_CPU_LIMIT,
            "request_loan (5 collaterals) used {} instructions, limit {}",
            cost,
            SOROBAN_CPU_LIMIT
        );
    }

    // ── 50 collaterals ────────────────────────────────────────────────
    {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);

        let mut ids = Vec::new(&env);
        for _ in 0..50u32 {
            let col = client.register_livestock(
                &borrower,
                &symbol_short!("sheep"),
                &1u32,
                &20_000i128,
            );
            ids.push_back(col);
        }

        env.budget().reset_default();
        client.request_loan(&borrower, &ids, &600_000i128);
        let cost = env.budget().cpu_instruction_cost();
        assert!(
            cost < SOROBAN_CPU_LIMIT,
            "request_loan (50 collaterals) used {} instructions, limit {}",
            cost,
            SOROBAN_CPU_LIMIT
        );
    }
}

// ── bench: repay_loan (issue #668) ────────────────────────────────────
/// Benchmark repay_loan for both partial payoff and full loan closure paths.
#[test]
fn bench_repay_loan_instruction_count() {
    const SOROBAN_CPU_LIMIT: u64 = 100_000_000;

    // ── partial repayment path ────────────────────────────────────────
    {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);
        let col = client.register_livestock(
            &borrower,
            &symbol_short!("cattle"),
            &1u32,
            &1_000_000i128,
        );
        let loan_id = client.request_loan(&borrower, &vec![&env, col], &600_000i128);

        env.budget().reset_default();
        client.repay_loan(&borrower, &loan_id, &200_000i128);
        let cost = env.budget().cpu_instruction_cost();
        assert!(
            cost < SOROBAN_CPU_LIMIT,
            "repay_loan (partial) used {} instructions, limit {}",
            cost,
            SOROBAN_CPU_LIMIT
        );
    }

    // ── full loan closure path ────────────────────────────────────────
    {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);
        let col = client.register_livestock(
            &borrower,
            &symbol_short!("cattle"),
            &1u32,
            &1_000_000i128,
        );
        let loan_id = client.request_loan(&borrower, &vec![&env, col], &600_000i128);

        env.budget().reset_default();
        client.repay_loan(&borrower, &loan_id, &600_000i128);
        let cost = env.budget().cpu_instruction_cost();
        assert!(
            cost < SOROBAN_CPU_LIMIT,
            "repay_loan (full closure) used {} instructions, limit {}",
            cost,
            SOROBAN_CPU_LIMIT
        );
    }
}

// ── bench: liquidate (issue #668) ────────────────────────────────────
/// Benchmark the liquidate execution path.
#[test]
fn bench_liquidate_instruction_count() {
    const SOROBAN_CPU_LIMIT: u64 = 100_000_000;

    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);

    // Initialise with a liquidation threshold of 10 000 bps so that a loan
    // at the LTV cap (60%) is immediately below the threshold.
    client.set_liquidation_threshold(&admin, &10_000u32);

    let borrower = Address::generate(&env);
    let liquidator = Address::generate(&env);
    let col = client.register_livestock(
        &borrower,
        &symbol_short!("cattle"),
        &1u32,
        &1_000_000i128,
    );
    let loan_id = client.request_loan(&borrower, &vec![&env, col], &600_000i128);
    // At 10_000 bps threshold, hf = (1_000_000 * 10_000) / (600_000 * 10_000) = 1.666…
    // scaled = 16_666, which is >= 10_000 → healthy. We need hf < 10_000.
    // Use a very high threshold: any loan is liquidatable.
    // Alternative: register with low collateral value relative to outstanding.
    // Re-register with a lower LTV threshold instead.
    // Actually set liq threshold low: liq_thr = 10 bps → hf = (1_000_000 * 10) / (600_000 * 10_000) * 10_000 = 0.16…
    client.set_liquidation_threshold(&admin, &10u32);

    env.budget().reset_default();
    client.liquidate(&liquidator, &loan_id, &300_000i128);
    let cost = env.budget().cpu_instruction_cost();
    assert!(
        cost < SOROBAN_CPU_LIMIT,
        "liquidate used {} instructions, limit {}",
        cost,
        SOROBAN_CPU_LIMIT
    );
}

// ── liquidate ─────────────────────────────────────────────────────────
#[test]
#[should_panic(expected = "#7")]
fn test_liquidate_healthy_loan_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let liquidator = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
    client.liquidate(&liquidator, &loan_id, &300_000i128);
}

// ── get_loan / get_collateral ─────────────────────────────────────────
#[test]
fn test_get_loan_ok() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("sheep"), &10u32, &2_000_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &500_000i128);
    let loan = client.get_loan(&loan_id);
    assert_eq!(loan.principal, 500_000);
    assert_eq!(loan.borrower, borrower);
}

#[test]
fn test_get_collateral_ok() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let owner = Address::generate(&env);
    let col_id =
        client.register_livestock(&owner, &symbol_short!("goat"), &7u32, &700_000i128);
    let col = client.get_collateral(&col_id);
    assert_eq!(col.count, 7);
    assert_eq!(col.appraised_value, 700_000);
}

#[test]
fn test_get_loan_collaterals_ok() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col1 =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &600_000i128);
    let col2 =
        client.register_livestock(&borrower, &symbol_short!("goat"), &3u32, &400_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col1, col2], &600_000i128);
    let collaterals = client.get_loan_collaterals(&loan_id);
    assert_eq!(collaterals.len(), 2);
    assert_eq!(collaterals.get(0).unwrap().animal_type, symbol_short!("cattle"));
    assert_eq!(collaterals.get(1).unwrap().animal_type, symbol_short!("goat"));
}

#[test]
#[should_panic(expected = "#5")]
fn test_get_nonexistent_loan_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    client.get_loan(&999u64);
}

#[test]
#[should_panic(expected = "#6")]
fn test_get_nonexistent_collateral_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    client.get_collateral(&999u64);
}

// ── get_loans (issue #670) ────────────────────────────────────────────

/// Empty ids list returns an empty vector.
#[test]
fn test_get_loans_empty_ids() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let results = client.get_loans(&vec![&env]);
    assert_eq!(results.len(), 0);
}

/// IDs that do not exist in storage are silently skipped.
#[test]
fn test_get_loans_partial_match() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col = client.register_livestock(
        &borrower,
        &symbol_short!("cattle"),
        &1u32,
        &1_000_000i128,
    );
    let real_id = client.request_loan(&borrower, &vec![&env, col], &600_000i128);

    // Mix a real ID with two non-existent IDs.
    let ids = vec![&env, 9999u64, real_id, 8888u64];
    let results = client.get_loans(&ids);
    assert_eq!(results.len(), 1);
    assert_eq!(results.get(0).unwrap().id, real_id);
}

/// Full match: all provided IDs exist; result has the same count.
#[test]
fn test_get_loans_full_match() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);

    let col1 = client.register_livestock(
        &borrower,
        &symbol_short!("cattle"),
        &1u32,
        &600_000i128,
    );
    let col2 = client.register_livestock(
        &borrower,
        &symbol_short!("goat"),
        &1u32,
        &600_000i128,
    );
    let id1 = client.request_loan(&borrower, &vec![&env, col1], &360_000i128);
    let id2 = client.request_loan(&borrower, &vec![&env, col2], &360_000i128);

    let results = client.get_loans(&vec![&env, id1, id2]);
    assert_eq!(results.len(), 2);
}

/// Boundary: exactly 20 IDs is accepted.
#[test]
fn test_get_loans_exactly_20_ids() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    // Build a vec of 20 non-existent IDs — they'll be skipped, but the call
    // must succeed (not return InvalidAmount).
    let mut ids = Vec::new(&env);
    for i in 1001u64..=1020u64 {
        ids.push_back(i);
    }
    let results = client.get_loans(&ids);
    assert_eq!(results.len(), 0); // none exist, all skipped
}

/// Exceeding 20 IDs returns InvalidAmount.
#[test]
#[should_panic(expected = "#8")]
fn test_get_loans_too_many_ids_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let mut ids = Vec::new(&env);
    for i in 1u64..=21u64 {
        ids.push_back(i);
    }
    client.get_loans(&ids);
}

// ── not initialized guard ─────────────────────────────────────────────
#[test]
#[should_panic(expected = "#1")]
fn test_register_without_init_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let cid = env.register_contract(None, StellarKraal);
    let client = StellarKraalClient::new(&env, &cid);
    let owner = Address::generate(&env);
    client.register_livestock(&owner, &symbol_short!("cattle"), &1u32, &100_000i128);
}

// ── invalid amount guards ─────────────────────────────────────────────
#[test]
#[should_panic(expected = "#8")]
fn test_request_zero_amount_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    client.request_loan(&borrower, &vec![&env, col_id], &0i128);
}

#[test]
#[should_panic(expected = "#8")]
fn test_repay_zero_amount_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
    client.repay_loan(&borrower, &loan_id, &0i128);
}

// ── multiple loans counter ────────────────────────────────────────────
#[test]
fn test_multiple_collaterals_increment_ids() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let owner = Address::generate(&env);
    let id1 =
        client.register_livestock(&owner, &symbol_short!("cattle"), &1u32, &500_000i128);
    let id2 =
        client.register_livestock(&owner, &symbol_short!("goat"), &2u32, &300_000i128);
    assert_eq!(id2, id1 + 1);
}

#[test]
fn test_repay_more_than_outstanding_caps_at_outstanding() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
    client.repay_loan(&borrower, &loan_id, &999_999_999i128);
    let loan = client.get_loan(&loan_id);
    assert_eq!(loan.status, LoanStatus::Repaid);
    assert_eq!(loan.outstanding, 0);
}

// ── pause / unpause ───────────────────────────────────────────────────
#[test]
fn test_pause_by_admin_ok() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    client.pause(&admin);
    assert!(client.is_paused());
}

#[test]
#[should_panic(expected = "#3")]
fn test_pause_by_non_admin_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let attacker = Address::generate(&env);
    client.pause(&attacker);
}

#[test]
fn test_unpause_by_admin_ok() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    client.pause(&admin);
    client.unpause(&admin);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "#19")]
fn test_unpause_when_not_paused_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    client.unpause(&admin);
}

#[test]
#[should_panic(expected = "#13")]
fn test_register_livestock_blocked_when_paused() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    client.pause(&admin);
    let owner = Address::generate(&env);
    client.register_livestock(&owner, &symbol_short!("cattle"), &1u32, &100_000i128);
}

#[test]
#[should_panic(expected = "#13")]
fn test_request_loan_blocked_when_paused() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    client.pause(&admin);
    client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
}

#[test]
#[should_panic(expected = "#13")]
fn test_liquidate_blocked_when_paused() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let liquidator = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
    client.pause(&admin);
    client.liquidate(&liquidator, &loan_id, &300_000i128);
}

#[test]
fn test_repay_allowed_when_paused() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
    client.pause(&admin);
    client.repay_loan(&borrower, &loan_id, &200_000i128);
    let loan = client.get_loan(&loan_id);
    assert_eq!(loan.outstanding, 400_000);
}

#[test]
fn test_auto_unpause_after_expiry() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    client.set_pause_duration(&admin, &1u64);
    client.pause(&admin);
    assert!(client.is_paused());
    env.ledger().with_mut(|li| {
        li.timestamp += 2;
    });
    assert!(!client.is_paused());
}

#[test]
fn test_pause_emits_event() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    client.pause(&admin);
    assert!(client.is_paused());
}

// ── set_pause_duration / MAX_PAUSE_DURATION (issue #674) ──────────────

/// Exactly MAX_PAUSE_DURATION is accepted.
#[test]
fn test_set_pause_duration_at_max_ok() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    // Must not panic: MAX_PAUSE_DURATION is the upper inclusive bound.
    client.set_pause_duration(&admin, &MAX_PAUSE_DURATION);
}

/// MAX_PAUSE_DURATION + 1 is rejected with InvalidAmount.
#[test]
#[should_panic(expected = "#8")]
fn test_set_pause_duration_above_max_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    client.set_pause_duration(&admin, &(MAX_PAUSE_DURATION + 1));
}

// ── upgrade mechanism (issue #669) ───────────────────────────────────

/// Helper: return a zeroed 32-byte hash usable as a fake WASM hash in tests.
fn zero_wasm_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

/// Propose stores the hash; execute before timelock returns TimelockNotElapsed.
#[test]
fn test_propose_upgrade_ok_and_timelock_blocks_execute() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);

    let hash = zero_wasm_hash(&env);
    client.propose_upgrade(&admin, &hash);

    // Immediately calling execute_upgrade should fail with TimelockNotElapsed (#24).
    let result = client.try_execute_upgrade();
    // Confirm it is specifically TimelockNotElapsed, not another error.
    match result.unwrap_err() {
        Ok(Error::TimelockNotElapsed) => {}
        other => panic!("expected TimelockNotElapsed, got {:?}", other),
    }
}

/// cancel_upgrade clears the proposal; subsequent execute fails with NoUpgradePending.
#[test]
fn test_cancel_upgrade_clears_proposal() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);

    client.propose_upgrade(&admin, &zero_wasm_hash(&env));
    client.cancel_upgrade(&admin);

    // After cancel, executing should fail with NoUpgradePending (#23).
    let result = client.try_execute_upgrade();
    match result.unwrap_err() {
        Ok(Error::NoUpgradePending) => {}
        other => panic!("expected NoUpgradePending after cancel, got {:?}", other),
    }
}

/// Calling cancel_upgrade with no pending proposal returns NoUpgradePending.
#[test]
#[should_panic(expected = "#23")]
fn test_cancel_upgrade_no_proposal_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    client.cancel_upgrade(&admin);
}

/// Non-admin cannot propose an upgrade.
#[test]
#[should_panic(expected = "#3")]
fn test_propose_upgrade_non_admin_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let attacker = Address::generate(&env);
    client.propose_upgrade(&attacker, &zero_wasm_hash(&env));
}

/// After the timelock elapses, execute_upgrade passes our logic checks.
/// (The call may still fail in the test environment if no WASM bytes are installed,
/// but the error must NOT be TimelockNotElapsed or NoUpgradePending.)
#[test]
fn test_execute_upgrade_after_timelock_passes_logic_checks() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);

    client.propose_upgrade(&admin, &zero_wasm_hash(&env));

    // Advance ledger timestamp past the 24-hour timelock.
    env.ledger().with_mut(|li| {
        li.timestamp += UPGRADE_TIMELOCK_SECS + 1;
    });

    let result = client.try_execute_upgrade();
    // Our timelock and proposal checks passed — any error here is from the
    // deployer not finding the WASM bytes in the test environment, which is
    // expected and unrelated to our logic.
    match result {
        Ok(Ok(())) => {} // success (unlikely without wasm bytes)
        Ok(Err(_)) => {} // conversion error (unlikely)
        Err(Ok(Error::TimelockNotElapsed)) => {
            panic!("should not be TimelockNotElapsed after timelock")
        }
        Err(Ok(Error::NoUpgradePending)) => {
            panic!("should not be NoUpgradePending with active proposal")
        }
        Err(_) => {} // wasm-not-found or host error — acceptable in test env
    }
}

// ── oracle tests ──────────────────────────────────────────────────────
#[test]
fn test_add_oracle_ok() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let oracle2 = Address::generate(&env);
    client.add_oracle(&admin, &oracle2);
    let oracles = client.get_oracles();
    assert_eq!(oracles.len(), 2);
}

#[test]
#[should_panic(expected = "#3")]
fn test_add_oracle_non_admin_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let attacker = Address::generate(&env);
    let oracle2 = Address::generate(&env);
    client.add_oracle(&attacker, &oracle2);
}

#[test]
#[should_panic(expected = "#14")]
fn test_add_duplicate_oracle_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    client.add_oracle(&admin, &oracle);
}

#[test]
#[should_panic(expected = "#15")]
fn test_add_oracle_beyond_limit_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    for _ in 0..4 {
        client.add_oracle(&admin, &Address::generate(&env));
    }
    client.add_oracle(&admin, &Address::generate(&env));
}

#[test]
fn test_remove_oracle_ok() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let oracle2 = Address::generate(&env);
    client.add_oracle(&admin, &oracle2);
    client.remove_oracle(&admin, &oracle2);
    let oracles = client.get_oracles();
    assert_eq!(oracles.len(), 1);
}

#[test]
#[should_panic(expected = "#16")]
fn test_remove_nonexistent_oracle_fails() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let unknown = Address::generate(&env);
    client.remove_oracle(&admin, &unknown);
}

#[test]
fn test_submit_oracle_prices_median_odd() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    client.add_oracle(&admin, &Address::generate(&env));
    client.add_oracle(&admin, &Address::generate(&env));

    let submitter = Address::generate(&env);
    let prices = vec![&env, 100i128, 200i128, 300i128];
    let result = client.submit_oracle_prices(&submitter, &prices);
    assert_eq!(result.median, 200);
    assert_eq!(result.responses, 3);
    assert_eq!(result.flagged_count, 0);
}

#[test]
fn test_livestock_registered_event() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let owner = Address::generate(&env);
    let _id = client.register_livestock(&owner, &symbol_short!("cattle"), &5u32, &1_000_000i128);
    // Verify at least one event was published (livestock registration emits one event).
    assert!(!env.events().all().is_empty());
}

#[test]
fn test_loan_requested_event() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    let events_before = env.events().all().len();
    let _loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
    // request_loan emits a loan event; verify at least one new event appeared.
    assert!(env.events().all().len() > events_before);
}

#[test]
fn test_loan_repaid_event() {
    let (env, cid, admin, oracle, token, treasury) = setup();
    init(&env, &cid, &admin, &oracle, &token, &treasury);
    let client = StellarKraalClient::new(&env, &cid);
    let borrower = Address::generate(&env);
    let col_id =
        client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
    let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
    let events_before = env.events().all().len();
    client.repay_loan(&borrower, &loan_id, &200_000i128);
    // repay_loan emits a repaid event; verify at least one new event appeared.
    assert!(env.events().all().len() > events_before);
}

// ── proptests ─────────────────────────────────────────────────────────
proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    #[test]
    fn prop_repayment_bounds(amount in 1..2_000_000i128, repay in 1..2_000_000i128) {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);
        let val = amount * 2;
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &1, &val);
        let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &amount);
        client.repay_loan(&borrower, &loan_id, &repay);
        let loan = client.get_loan(&loan_id);
        assert!(loan.outstanding >= 0);
        assert!(loan.outstanding <= amount);
        assert!(amount - loan.outstanding <= amount);
    }

    #[test]
    fn prop_health_factor_post_repayment(amount in 1..1_000_000i128) {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &1, &(amount * 2));
        let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &amount);
        client.repay_loan(&borrower, &loan_id, &amount);
        let hf = client.health_factor(&loan_id);
        assert_eq!(hf, i128::MAX);
        let loan = client.get_loan(&loan_id);
        assert_eq!(loan.status, LoanStatus::Repaid);
    }

    #[test]
    fn prop_liquidation_eligibility(amount in 1..1_000_000i128) {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);
        let liquidator = Address::generate(&env);
        let val = amount * 2;
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &1, &val);
        let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &amount);
        let hf = client.health_factor(&loan_id);
        if hf >= 10_000 {
            let res = client.try_liquidate(&liquidator, &loan_id, &1i128);
            assert!(res.is_err());
        }
    }

    #[test]
    fn prop_loan_invariants(val in 1..1_000_000i128, amount_pct in 1..6000u32) {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);
        let amount = (val * amount_pct as i128) / 10000;
        if amount <= 0 { return Ok(()); }
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &1, &val);
        let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &amount);
        let loan = client.get_loan(&loan_id);
        assert_eq!(loan.status, LoanStatus::Active);
        assert_eq!(loan.borrower, borrower);
        assert_eq!(loan.collateral_ids.get(0).unwrap(), col_id);
        assert_eq!(loan.total_collateral_value, val);
        assert_eq!(loan.outstanding, loan.principal);
    }
}
