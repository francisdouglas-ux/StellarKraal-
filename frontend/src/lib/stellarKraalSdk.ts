/**
 * Typed SDK for the StellarKraal smart contract.
 *
 * Generated from the contract ABI using stellar-sdk's contract client pattern.
 * Replace CONTRACT_ID with the deployed contract address before use.
 */

import {
  Address,
  Contract,
  Networks,
  TransactionBuilder,
  xdr,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

// ── Types ────────────────────────────────────────────────────────────────────

export type LoanStatus = "Active" | "Repaid" | "Liquidated";

export interface CollateralRecord {
  owner: string;
  animal_type: string;
  count: number;
  appraised_value: bigint;
  loan_id: bigint;
  appraisal_history: bigint[];
}

export interface LoanRecord {
  id: bigint;
  borrower: string;
  collateral_ids: bigint[];
  total_collateral_value: bigint;
  principal: bigint;
  outstanding: bigint;
  status: LoanStatus;
}

export interface FeeConfig {
  origination_fee_bps: number;
  interest_fee_bps: number;
}

export interface OracleReport {
  median: bigint;
  responses: number;
  flagged_count: number;
}

/** Map of contract error codes to human-readable messages. */
export const ERROR_MESSAGES: Record<number, string> = {
  1: "Contract not initialized",
  2: "Contract already initialized",
  3: "Unauthorized",
  4: "Insufficient collateral for requested loan",
  5: "Loan not found",
  6: "Collateral not found",
  7: "Health factor is safe — liquidation not permitted",
  8: "Invalid amount",
  9: "Loan is already closed",
  10: "Invalid fee rate (max 500 bps)",
  11: "Repay amount exceeds close factor cap",
  12: "Invalid close factor",
  13: "Contract is paused",
  14: "Oracle already registered",
  15: "Oracle limit reached (max 5)",
  16: "Oracle not found",
  17: "Insufficient oracle quorum",
  18: "Invalid price",
  19: "Contract is not paused",
  20: "Arithmetic overflow",
  21: "Reentrancy detected",
};

// ── Client options ────────────────────────────────────────────────────────────

export interface StellarKraalClientOptions {
  contractId: string;
  networkPassphrase?: string;
  rpcUrl?: string;
  publicKey?: string;
}

// ── xdr helpers ───────────────────────────────────────────────────────────────

function addressVal(addr: string): xdr.ScVal {
  return new Address(addr).toScVal();
}

function u32Val(n: number): xdr.ScVal {
  return nativeToScVal(n, { type: "u32" });
}

function u64Val(n: bigint): xdr.ScVal {
  return nativeToScVal(n, { type: "u64" });
}

function i128Val(n: bigint): xdr.ScVal {
  return nativeToScVal(n, { type: "i128" });
}

function symbolVal(s: string): xdr.ScVal {
  return xdr.ScVal.scvSymbol(s);
}

function vecVal(items: xdr.ScVal[]): xdr.ScVal {
  return xdr.ScVal.scvVec(items);
}

// ── StellarKraalClient ────────────────────────────────────────────────────────

export class StellarKraalClient {
  private readonly contract: Contract;
  private readonly server: Server;
  private readonly networkPassphrase: string;
  private readonly rpcUrl: string;
  readonly publicKey: string | undefined;

  constructor(opts: StellarKraalClientOptions) {
    this.rpcUrl =
      opts.rpcUrl ??
      process.env.NEXT_PUBLIC_RPC_URL ??
      "https://soroban-testnet.stellar.org";
    this.networkPassphrase =
      opts.networkPassphrase ??
      (process.env.NEXT_PUBLIC_NETWORK === "mainnet"
        ? Networks.PUBLIC
        : Networks.TESTNET);
    this.contract = new Contract(opts.contractId);
    this.server = new Server(this.rpcUrl);
    this.publicKey = opts.publicKey;
  }

  // ── Transaction builder helpers ──────────────────────────────────────────

  private async buildTx(
    sourceAddress: string,
    method: string,
    args: xdr.ScVal[]
  ): Promise<TransactionBuilder> {
    const account = await this.server.getAccount(sourceAddress);
    return new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: this.networkPassphrase,
    }).addOperation(this.contract.call(method, ...args));
  }

  private async simulate(tx: TransactionBuilder) {
    const built = tx.setTimeout(30).build();
    const sim = await this.server.simulateTransaction(built);
    if ("error" in sim) {
      throw new Error(`Simulation failed: ${sim.error}`);
    }
    return sim;
  }

  // ── initialize ────────────────────────────────────────────────────────────

  async buildInitialize(
    source: string,
    admin: string,
    oracle: string,
    token: string,
    treasury: string,
    ltv_bps: number,
    liquidation_threshold_bps: number
  ) {
    const tx = await this.buildTx(source, "initialize", [
      addressVal(admin),
      addressVal(oracle),
      addressVal(token),
      addressVal(treasury),
      u32Val(ltv_bps),
      u32Val(liquidation_threshold_bps),
    ]);
    return tx.setTimeout(30).build().toXDR();
  }

  // ── register_livestock ────────────────────────────────────────────────────

  async buildRegisterLivestock(
    source: string,
    owner: string,
    animal_type: string,
    count: number,
    appraised_value: bigint
  ) {
    const tx = await this.buildTx(source, "register_livestock", [
      addressVal(owner),
      symbolVal(animal_type),
      u32Val(count),
      i128Val(appraised_value),
    ]);
    return tx.setTimeout(30).build().toXDR();
  }

  // ── request_loan ──────────────────────────────────────────────────────────

  async buildRequestLoan(
    source: string,
    borrower: string,
    collateral_ids: bigint[],
    amount: bigint
  ) {
    const tx = await this.buildTx(source, "request_loan", [
      addressVal(borrower),
      vecVal(collateral_ids.map(u64Val)),
      i128Val(amount),
    ]);
    return tx.setTimeout(30).build().toXDR();
  }

  // ── repay_loan ────────────────────────────────────────────────────────────

  async buildRepayLoan(
    source: string,
    borrower: string,
    loan_id: bigint,
    amount: bigint
  ) {
    const tx = await this.buildTx(source, "repay_loan", [
      addressVal(borrower),
      u64Val(loan_id),
      i128Val(amount),
    ]);
    return tx.setTimeout(30).build().toXDR();
  }

  // ── liquidate ─────────────────────────────────────────────────────────────

  async buildLiquidate(
    source: string,
    liquidator: string,
    loan_id: bigint,
    repay_amount: bigint
  ) {
    const tx = await this.buildTx(source, "liquidate", [
      addressVal(liquidator),
      u64Val(loan_id),
      i128Val(repay_amount),
    ]);
    return tx.setTimeout(30).build().toXDR();
  }

  // ── update_appraisal ──────────────────────────────────────────────────────

  async buildUpdateAppraisal(
    source: string,
    owner: string,
    collateral_id: bigint,
    new_value: bigint
  ) {
    const tx = await this.buildTx(source, "update_appraisal", [
      addressVal(owner),
      u64Val(collateral_id),
      i128Val(new_value),
    ]);
    return tx.setTimeout(30).build().toXDR();
  }

  // ── read-only calls ───────────────────────────────────────────────────────

  async getHealthFactor(loan_id: bigint): Promise<bigint> {
    const tx = await this.buildTx(
      // health_factor is read-only; use zero-account simulation
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      "health_factor",
      [u64Val(loan_id)]
    );
    const sim = await this.simulate(tx);
    return scValToNative((sim as { result: { retval: xdr.ScVal } }).result.retval) as bigint;
  }

  async getLoan(loan_id: bigint): Promise<LoanRecord> {
    const tx = await this.buildTx(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      "get_loan",
      [u64Val(loan_id)]
    );
    const sim = await this.simulate(tx);
    return scValToNative((sim as { result: { retval: xdr.ScVal } }).result.retval) as LoanRecord;
  }

  async getCollateral(collateral_id: bigint): Promise<CollateralRecord> {
    const tx = await this.buildTx(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      "get_collateral",
      [u64Val(collateral_id)]
    );
    const sim = await this.simulate(tx);
    return scValToNative((sim as { result: { retval: xdr.ScVal } }).result.retval) as CollateralRecord;
  }

  async getAppraisalHistory(collateral_id: bigint): Promise<bigint[]> {
    const tx = await this.buildTx(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      "get_appraisal_history",
      [u64Val(collateral_id)]
    );
    const sim = await this.simulate(tx);
    return scValToNative((sim as { result: { retval: xdr.ScVal } }).result.retval) as bigint[];
  }

  async getFeeConfig(): Promise<FeeConfig> {
    const tx = await this.buildTx(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      "get_fee_config",
      []
    );
    const sim = await this.simulate(tx);
    return scValToNative((sim as { result: { retval: xdr.ScVal } }).result.retval) as FeeConfig;
  }

  async getOracles(): Promise<string[]> {
    const tx = await this.buildTx(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      "get_oracles",
      []
    );
    const sim = await this.simulate(tx);
    return scValToNative((sim as { result: { retval: xdr.ScVal } }).result.retval) as string[];
  }

  async isPaused(): Promise<boolean> {
    const tx = await this.buildTx(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
      "is_paused",
      []
    );
    const sim = await this.simulate(tx);
    return scValToNative((sim as { result: { retval: xdr.ScVal } }).result.retval) as boolean;
  }

  // ── admin calls ───────────────────────────────────────────────────────────

  async buildPause(source: string, admin: string) {
    const tx = await this.buildTx(source, "pause", [addressVal(admin)]);
    return tx.setTimeout(30).build().toXDR();
  }

  async buildUnpause(source: string, admin: string) {
    const tx = await this.buildTx(source, "unpause", [addressVal(admin)]);
    return tx.setTimeout(30).build().toXDR();
  }

  async buildUpdateFeeConfig(
    source: string,
    admin: string,
    origination_fee_bps: number,
    interest_fee_bps: number
  ) {
    const tx = await this.buildTx(source, "update_fee_config", [
      addressVal(admin),
      u32Val(origination_fee_bps),
      u32Val(interest_fee_bps),
    ]);
    return tx.setTimeout(30).build().toXDR();
  }

  async buildSetCloseFactor(
    source: string,
    admin: string,
    close_factor_bps: number
  ) {
    const tx = await this.buildTx(source, "set_close_factor", [
      addressVal(admin),
      u32Val(close_factor_bps),
    ]);
    return tx.setTimeout(30).build().toXDR();
  }
}

// ── Default singleton factory ─────────────────────────────────────────────────

let _defaultClient: StellarKraalClient | null = null;

export function getStellarKraalClient(
  publicKey?: string
): StellarKraalClient {
  const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";
  if (!_defaultClient || publicKey) {
    _defaultClient = new StellarKraalClient({ contractId, publicKey });
  }
  return _defaultClient;
}
