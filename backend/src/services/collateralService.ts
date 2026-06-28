/**
 * Collateral business logic — decoupled from HTTP layer for v1/v2 reuse.
 */
import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import { z } from "zod";
import { stellarPublicKeySchema } from "../validators/stellar";
import { getCollateral } from "../db/store";
import { buildContractTx } from "./contractTx";

export const registerCollateralSchema = z.object({
  owner: stellarPublicKeySchema,
  animal_type: z.string().min(1),
  count: z.number().int().positive(),
  appraised_value: z.number().int().positive(),
});

export type RegisterCollateralInput = z.infer<typeof registerCollateralSchema>;

/**
 * Builds a register_livestock contract transaction.
 * @param input - Validated collateral registration payload.
 * @returns Unsigned XDR transaction for client signing.
 */
export async function registerCollateral(input: RegisterCollateralInput): Promise<{ xdr: string }> {
  const { owner, animal_type, count, appraised_value } = input;
  const xdrTx = await buildContractTx(owner, "register_livestock", [
    new Address(owner).toScVal(),
    nativeToScVal(animal_type, { type: "symbol" }),
    nativeToScVal(count, { type: "u32" }),
    nativeToScVal(BigInt(appraised_value), { type: "i128" }),
  ]);
  return { xdr: xdrTx };
}

/**
 * Fetches a collateral record by ID.
 * @param id - Collateral record identifier.
 * @returns Collateral record or undefined when not found.
 */
export function getCollateralById(id: string) {
  return getCollateral(id);
}
