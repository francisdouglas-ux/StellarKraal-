/**
 * Loan business logic — decoupled from HTTP layer for v1/v2 reuse.
 */
import {
  Address,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { z } from "zod";
import { stellarPublicKeySchema } from "../validators/stellar";
import {
  getCollateral,
  listLoans,
  getLoan,
  updateLoan,
  updateCollateral,
  insertTransaction,
  insertLiquidationEvent,
} from "../db/store";
import { fireWebhooks } from "../webhooks";
import { buildContractTx, CONTRACT_ID, NETWORK_PASSPHRASE } from "./contractTx";
import rpcClient from "../utils/rpcClient";

const SCALE = 10_000;
const SIMULATION_ACCOUNT = "GASPH4OCYOERATXIKLPNURXUP7ISAQU2KWFB5XLUJ3LQHKHOCN3CEGD6";

export const loanRequestSchema = z.object({
  borrower: stellarPublicKeySchema,
  collateral_ids: z.array(z.number().int().nonnegative()).min(1),
  amount: z.number().int().positive(),
  min_disbursement: z.number().int().positive().optional(),
});

export const loanRepaySchema = z.object({
  borrower: stellarPublicKeySchema,
  loan_id: z.number().int().nonnegative(),
  amount: z.number().int().positive(),
});

export const loanLiquidateSchema = z.object({
  liquidator: stellarPublicKeySchema,
  loan_id: z.number().int().nonnegative(),
  repay_amount: z.number().int().positive(),
});

export type LoanRequestInput = z.infer<typeof loanRequestSchema>;
export type LoanRepayInput = z.infer<typeof loanRepaySchema>;
export type LoanLiquidateInput = z.infer<typeof loanLiquidateSchema>;

export interface ListLoansQuery {
  page?: string;
  pageSize?: string;
  limit?: string;
  status?: string;
  borrowerAddress?: string;
  from?: string;
  to?: string;
}

export interface ListLoansResult {
  data: ReturnType<typeof listLoans>["data"];
  total: number;
  page: number;
  limit: number;
  pageSize: number;
}

export class LoanNotFoundError extends Error {
  constructor(loanId: number | string) {
    super(`Loan ${loanId} not found`);
    this.name = "LoanNotFoundError";
  }
}

export class LoanNotLiquidatableError extends Error {
  healthFactor: number | null;

  constructor(healthFactor: number | null) {
    super("Loan health factor is above liquidation threshold");
    this.name = "LoanNotLiquidatableError";
    this.healthFactor = healthFactor;
  }
}

export class InvalidPaginationError extends Error {
  constructor(message = "Invalid pagination parameters") {
    super(message);
    this.name = "InvalidPaginationError";
  }
}

/**
 * Builds a request_loan contract transaction and fires approval webhooks.
 * @param input - Validated loan request payload.
 * @returns Unsigned XDR transaction for client signing.
 */
export async function requestLoan(input: LoanRequestInput): Promise<{ xdr: string }> {
  const { borrower, collateral_ids, amount, min_disbursement } = input;
  const idsScVal = xdr.ScVal.scvVec(
    collateral_ids.map((id) => nativeToScVal(BigInt(id), { type: "u64" }))
  );
  const minDisbursementScVal =
    min_disbursement !== undefined
      ? nativeToScVal(BigInt(min_disbursement), { type: "i128" })
      : xdr.ScVal.scvVoid();
  const xdrTx = await buildContractTx(borrower, "request_loan", [
    new Address(borrower).toScVal(),
    idsScVal,
    nativeToScVal(BigInt(amount), { type: "i128" }),
    minDisbursementScVal,
  ]);
  fireWebhooks("loan.approved", { borrower, collateral_ids, amount });
  return { xdr: xdrTx };
}

/**
 * Builds a repay_loan contract transaction and fires repayment webhooks.
 * @param input - Validated loan repayment payload.
 * @returns Unsigned XDR transaction for client signing.
 */
export async function repayLoan(input: LoanRepayInput): Promise<{ xdr: string }> {
  const { borrower, loan_id, amount } = input;
  const xdrTx = await buildContractTx(borrower, "repay_loan", [
    new Address(borrower).toScVal(),
    nativeToScVal(BigInt(loan_id), { type: "u64" }),
    nativeToScVal(BigInt(amount), { type: "i128" }),
  ]);
  fireWebhooks("loan.repaid", { borrower, loan_id, amount });
  return { xdr: xdrTx };
}

/**
 * Validates liquidation eligibility, builds contract tx, and updates local state.
 * @param input - Validated liquidation payload.
 * @returns Unsigned XDR and updated loan record.
 * @throws LoanNotFoundError when the loan does not exist.
 * @throws LoanNotLiquidatableError when health factor is above threshold.
 */
export async function liquidateLoan(input: LoanLiquidateInput) {
  const { liquidator, loan_id, repay_amount } = input;

  const loan = getLoan(String(loan_id));
  if (!loan) {
    throw new LoanNotFoundError(loan_id);
  }

  const collateral = getCollateral(loan.collateral_id);
  const collateralValue = collateral?.appraised_value ?? 0;
  const hf =
    loan.amount > 0 && collateralValue > 0
      ? ((collateralValue * 8_000) / (loan.amount * SCALE)) * SCALE
      : null;

  if (hf === null || hf >= SCALE) {
    throw new LoanNotLiquidatableError(hf);
  }

  const xdrTx = await buildContractTx(liquidator, "liquidate", [
    new Address(liquidator).toScVal(),
    nativeToScVal(BigInt(loan_id), { type: "u64" }),
    nativeToScVal(BigInt(repay_amount), { type: "i128" }),
  ]);

  const updatedLoan = updateLoan(loan.id, { status: "liquidated" });
  if (collateral) {
    updateCollateral(collateral.id, { status: "liquidated" });
  }

  insertLiquidationEvent({ loan_id: loan.id, liquidator, repay_amount });
  insertTransaction({
    borrower: loan.borrower,
    type: "liquidation",
    status: "completed",
    amount: repay_amount,
    loanId: loan.id,
    collateralId: loan.collateral_id,
  });

  fireWebhooks("loan.liquidated", { liquidator, loan_id, repay_amount });
  return { xdr: xdrTx, loan: updatedLoan };
}

/**
 * Simulates get_loan on the Soroban contract.
 * @param loanId - On-chain loan identifier.
 * @returns Simulated contract return value.
 */
export async function getLoanOnChain(loanId: string) {
  const contract = new Contract(CONTRACT_ID);
  const account = (await rpcClient.getAccount(SIMULATION_ACCOUNT)) as any;
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call("get_loan", nativeToScVal(BigInt(loanId), { type: "u64" }))
    )
    .setTimeout(30)
    .build();
  const result = await rpcClient.simulateTransaction(tx);
  return { result: (result as { result?: { retval: unknown } }).result?.retval };
}

/**
 * Simulates health_factor on the Soroban contract.
 * @param loanId - On-chain loan identifier.
 * @returns Simulated health factor value.
 */
export async function getHealthFactor(loanId: string) {
  const contract = new Contract(CONTRACT_ID);
  const account = (await rpcClient.getAccount(SIMULATION_ACCOUNT)) as any;
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call("health_factor", nativeToScVal(BigInt(loanId), { type: "u64" }))
    )
    .setTimeout(30)
    .build();
  const result = await rpcClient.simulateTransaction(tx);
  return { health_factor: (result as { result?: { retval: unknown } }).result?.retval };
}

/**
 * Lists loans with pagination and optional filters.
 * @param query - Query string parameters from the HTTP request.
 * @returns Paginated loan list.
 * @throws InvalidPaginationError when pagination or filter params are invalid.
 */
export function listLoansPaginated(query: ListLoansQuery): ListLoansResult {
  const pageRaw = query.page !== undefined ? Number(query.page) : 1;
  let limitRaw = 20;
  let isPageSize = false;

  if (query.pageSize !== undefined) {
    limitRaw = Number(query.pageSize);
    isPageSize = true;
  } else if (query.limit !== undefined) {
    limitRaw = Number(query.limit);
  }

  if (!Number.isInteger(pageRaw) || pageRaw < 1 || !Number.isInteger(limitRaw) || limitRaw < 1) {
    throw new InvalidPaginationError();
  }

  if (!isPageSize && limitRaw > 100) {
    throw new InvalidPaginationError();
  }

  const maxLimit = Math.min(limitRaw, 100);
  const { status, borrowerAddress, from, to } = query;

  const validStatuses = ["active", "repaid", "liquidated"];
  if (status && !validStatuses.includes(status)) {
    throw new InvalidPaginationError(`status must be one of: ${validStatuses.join(", ")}`);
  }
  if (from && isNaN(new Date(from).getTime())) {
    throw new InvalidPaginationError("from must be a valid ISO date");
  }
  if (to && isNaN(new Date(to).getTime())) {
    throw new InvalidPaginationError("to must be a valid ISO date");
  }

  const result = listLoans({ status, borrowerAddress, from, to, page: pageRaw, limit: maxLimit });
  return {
    data: result.data,
    total: result.total,
    page: result.page,
    limit: result.limit,
    pageSize: result.limit,
  };
}
