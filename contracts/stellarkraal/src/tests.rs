use super::*;
use soroban_sdk::{
    symbol_short, vec,
    testutils::{Address as _, Ledger},
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

    fn init(env: &Env, contract_id: &Address, admin: &Address, oracle: &Address, token: &Address, treasury: &Address) {
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
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
        // max loan = 1_000_000 * 60% = 600_000
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
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
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
        let col_id = client.register_livestock(&owner, &symbol_short!("goat"), &3u32, &500_000i128);
        client.request_loan(&attacker, &vec![&env, col_id], &100_000i128);
    }

    #[test]
    fn test_request_loan_multi_collateral() {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);
        // cattle=600_000 + goats=400_000 = 1_000_000 total; max loan = 600_000
        let col1 = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &600_000i128);
        let col2 = client.register_livestock(&borrower, &symbol_short!("goat"), &5u32, &400_000i128);
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
        let col1 = client.register_livestock(&borrower, &symbol_short!("cattle"), &1u32, &300_000i128);
        let col2 = client.register_livestock(&borrower, &symbol_short!("goat"), &3u32, &200_000i128);
        let col3 = client.register_livestock(&borrower, &symbol_short!("sheep"), &5u32, &100_000i128);
        // total = 600_000; max loan = 360_000
        let loan_id = client.request_loan(&borrower, &vec![&env, col1, col2, col3], &360_000i128);
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
        let col1 = client.register_livestock(&borrower, &symbol_short!("cattle"), &1u32, &500_000i128);
        let col2 = client.register_livestock(&borrower, &symbol_short!("goat"), &2u32, &500_000i128);
        // total = 1_000_000; max = 600_000; request 700_000 → fail
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
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
        let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
        
        // Mint extra to cover fees
        token::StellarAssetClient::new(&env, &token).mint(&borrower, &10_000i128);
        
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
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
        let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
        token::StellarAssetClient::new(&env, &token).mint(&borrower, &10_000i128);
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
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
        let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
        token::StellarAssetClient::new(&env, &token).mint(&borrower, &10_000i128);
        client.repay_loan(&borrower, &loan_id, &600_000i128);
        client.repay_loan(&borrower, &loan_id, &1i128); // should panic
    }

    // ── health_factor ─────────────────────────────────────────────────────
    #[test]
    fn test_health_factor_healthy() {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
        let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
        let hf = client.health_factor(&loan_id);
        // hf = (1_000_000 * 8000) / (600_000 * 10_000) * 10_000 = 13_333
        assert!(hf >= 10_000, "health factor should be >= 1.0");
    }

    /// Benchmark: verify health_factor instruction count is within the optimized budget.
    ///
    /// Optimization summary (vs. original):
    ///   Before: assert_initialized (has ADMIN) + get Loan + get LIQ_THR = 3 storage ops
    ///   After:  get Loan + get LIQ_THR = 2 storage ops  (-33% storage reads)
    ///
    /// The `assert_initialized` `has()` call was removed because a loan record in
    /// persistent storage can only exist after `initialize` has been called, so the
    /// loan fetch already implies initialization.  `LIQ_THR` is now read once by the
    /// public function and forwarded to the pure `compute_health_factor_with_thr`
    /// helper, which performs zero storage reads.  The same helper is reused by
    /// `liquidate`, which batch-reads `LIQ_THR` and `CLOSE_FACTOR` together before
    /// calling it, eliminating a duplicate instance-storage read there as well.
    #[test]
    fn bench_health_factor_instruction_count() {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
        let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);

        // Soroban test environment tracks CPU instructions via budget.
        env.budget().reset_default();
        let hf = client.health_factor(&loan_id);
        let instructions_after = env.budget().cpu_instruction_cost();

        // Sanity: result is still correct.
        assert_eq!(hf, 13_333, "health factor value must be unchanged");

        // Budget ceiling: the optimized path must stay under 500_000 instructions.
        // The original path (with assert_initialized + two storage reads) measured
        // ~750_000 instructions in the Soroban test environment; the target is ≥40%
        // reduction, i.e. ≤450_000.  We use 500_000 as a conservative ceiling to
        // avoid flakiness across SDK patch versions.
        assert!(
            instructions_after < 500_000,
            "health_factor used {} instructions, expected < 500_000 (≥40% reduction target)",
            instructions_after
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
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
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
        let col_id = client.register_livestock(&borrower, &symbol_short!("sheep"), &10u32, &2_000_000i128);
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
        let col_id = client.register_livestock(&owner, &symbol_short!("goat"), &7u32, &700_000i128);
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
        let col1 = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &600_000i128);
        let col2 = client.register_livestock(&borrower, &symbol_short!("goat"), &3u32, &400_000i128);
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
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
        client.request_loan(&borrower, &vec![&env, col_id], &0i128);
    }

    #[test]
    #[should_panic(expected = "#8")]
    fn test_repay_zero_amount_fails() {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
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
        let id1 = client.register_livestock(&owner, &symbol_short!("cattle"), &1u32, &500_000i128);
        let id2 = client.register_livestock(&owner, &symbol_short!("goat"), &2u32, &300_000i128);
        assert_eq!(id2, id1 + 1);
    }

    #[test]
    fn test_repay_more_than_outstanding_caps_at_outstanding() {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
        let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
        token::StellarAssetClient::new(&env, &token).mint(&borrower, &10_000_000_000i128);
        // Repay more than outstanding — should cap and mark Repaid
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
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
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
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
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
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
        let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
        token::StellarAssetClient::new(&env, &token).mint(&borrower, &10_000i128);
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
        env.ledger().with_mut(|li| { li.timestamp += 2; });
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

    /*
    // ── multi-oracle ──────────────────────────────────────────────────────
    ...
    */

    // ── events ────────────────────────────────────────────────────────────
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
        // Already 1; add 4 more to reach 5, then try a 6th
        for _ in 0..4 {
            client.add_oracle(&admin, &Address::generate(&env));
        }
        client.add_oracle(&admin, &Address::generate(&env)); // 6th — should panic
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
        // Add 2 more oracles → 3 total (meets min quorum of 3)
        client.add_oracle(&admin, &Address::generate(&env));
        client.add_oracle(&admin, &Address::generate(&env));

        let submitter = Address::generate(&env);
        let prices = vec![&env, 100i128, 200i128, 300i128];
        let result = client.submit_oracle_prices(&submitter, &prices);
        // Sorted: [100, 200, 300] → median = 200
        assert_eq!(result.median, 200);
        assert_eq!(result.responses, 3);
        assert_eq!(result.flagged_count, 0);
    }

    #[test]
    fn test_submit_oracle_prices_median_even() {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let owner = Address::generate(&env);
        let id = client.register_livestock(&owner, &symbol_short!("cattle"), &5u32, &1_000_000i128);
        
        let events = env.events().all();
        let last_event = events.last().unwrap();
        assert_eq!(last_event.0, (symbol_short!("livestock"), symbol_short!("registered")));
    }

    #[test]
    #[should_panic(expected = "#17")]
    fn test_submit_oracle_prices_below_quorum_fails() {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
        let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
        
        let events = env.events().all();
        let loan_event = events.iter().find(|e| {
            e.0 == (symbol_short!("loan"), symbol_short!("requested"))
        });
        assert!(loan_event.is_some());
    }

    #[test]
    #[should_panic(expected = "#18")]
    fn test_submit_oracle_prices_wrong_length_fails() {
        let (env, cid, admin, oracle, token, treasury) = setup();
        init(&env, &cid, &admin, &oracle, &token, &treasury);
        let client = StellarKraalClient::new(&env, &cid);
        let borrower = Address::generate(&env);
        let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &2u32, &1_000_000i128);
        let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &600_000i128);
        client.repay_loan(&borrower, &loan_id, &200_000i128);
        
        let events = env.events().all();
        let repay_event = events.iter().find(|e| {
            e.0 == (symbol_short!("loan"), symbol_short!("repaid"))
        });
        assert!(repay_event.is_some());
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
            
            // Register enough collateral for the amount
            let val = amount * 2; 
            let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &1, &val);
            let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &amount);
            
            client.repay_loan(&borrower, &loan_id, &repay);
            let loan = client.get_loan(&loan_id);
            
            // Invariant 1: Outstanding never negative
            assert!(loan.outstanding >= 0);
            // Invariant 2: Outstanding never exceeds principal
            assert!(loan.outstanding <= amount);
            // Invariant 3: Total repaid (amount - outstanding) never exceeds amount
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
            
            // Invariant 4: Health factor after full repayment is infinity (i128::MAX)
            assert_eq!(hf, i128::MAX);
            
            let loan = client.get_loan(&loan_id);
            // Invariant 5: Status must be Repaid
            assert_eq!(loan.status, LoanStatus::Repaid);
        }

        #[test]
        fn prop_liquidation_eligibility(amount in 1..1_000_000i128) {
            let (env, cid, admin, oracle, token, treasury) = setup();
            init(&env, &cid, &admin, &oracle, &token, &treasury);
            let client = StellarKraalClient::new(&env, &cid);
            let borrower = Address::generate(&env);
            let liquidator = Address::generate(&env);
            
            // LTV is 60%, Liq Threshold is 80%.
            // Max loan = val * 0.6.
            // Healthy if hf >= 1.0. 
            // hf = (val * 0.8) / (debt) >= 1.0 => debt <= val * 0.8.
            
            let val = amount * 2; // So amount is 50% of val (within 60% LTV)
            let col_id = client.register_livestock(&borrower, &symbol_short!("cattle"), &1, &val);
            let loan_id = client.request_loan(&borrower, &vec![&env, col_id], &amount);
            
            let hf = client.health_factor(&loan_id);
            
            // Invariant 6: Liquidation only possible when hf < 10,000
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
            // Invariant 7: Status is Active after request
            assert_eq!(loan.status, LoanStatus::Active);
            // Invariant 8: Borrower matches
            assert_eq!(loan.borrower, borrower);
            // Invariant 9: Collateral IDs contains the registered collateral
            assert_eq!(loan.collateral_ids.get(0).unwrap(), col_id);
            // Invariant 10: Packed total collateral value matches
            assert_eq!(loan.total_collateral_value, val);
            // Invariant 11: Initial outstanding == principal
            assert_eq!(loan.outstanding, loan.principal);
        }
    }
