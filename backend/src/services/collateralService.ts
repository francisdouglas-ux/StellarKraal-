/**
 * Collateral business logic — decoupled from HTTP layer for v1/v2 reuse.
 */
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { z } from 'zod';
import { stellarPublicKeySchema } from '../validators/stellar';
import { getCollateral } from '../db/store';
import { buildContractTx } from './contractTx';

export const registerCollateralSchema = z.object({
  owner: stellarPublicKeySchema,
  animal_type: z.string().min(1),
  count: z.number().int().positive(),
  appraised_value: z.number().int().positive(),
});

export type RegisterCollateralInput = z.infer<typeof registerCollateralSchema>;

export const batchRegisterCollateralSchema = z.object({
  items: z
    .array(registerCollateralSchema)
    .min(1, 'items must contain at least one entry')
    .max(50, 'items must not exceed 50 entries per batch'),
});

export type BatchRegisterCollateralInput = z.infer<typeof batchRegisterCollateralSchema>;

/**
 * Builds a register_livestock contract transaction.
 * @param input - Validated collateral registration payload.
 * @returns Unsigned XDR transaction for client signing.
 */
export async function registerCollateral(input: RegisterCollateralInput): Promise<{ xdr: string }> {
  const { owner, animal_type, count, appraised_value } = input;
  const xdrTx = await buildContractTx(owner, 'register_livestock', [
    new Address(owner).toScVal(),
    nativeToScVal(animal_type, { type: 'symbol' }),
    nativeToScVal(count, { type: 'u32' }),
    nativeToScVal(BigInt(appraised_value), { type: 'i128' }),
  ]);
  return { xdr: xdrTx };
}

/**
 * Builds register_livestock contract transactions for multiple collaterals in one call.
 * @param input - Validated batch payload with 1–50 items.
 * @returns Array of unsigned XDR transactions, one per item, in input order.
 */
export async function batchRegisterCollateral(
  input: BatchRegisterCollateralInput
): Promise<{ results: Array<{ xdr: string }> }> {
  const results = await Promise.all(input.items.map((item) => registerCollateral(item)));
  return { results };
}

/**
 * Fetches a collateral record by ID.
 * @param id - Collateral record identifier.
 * @returns Collateral record or undefined when not found.
 */
export function getCollateralById(id: string) {
  return getCollateral(id);
}
