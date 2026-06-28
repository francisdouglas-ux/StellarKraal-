/**
 * Shared Soroban transaction builder used by loan and collateral services.
 */
import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  xdr,
} from "@stellar/stellar-sdk";
import { config } from "../config";
import rpcClient from "../utils/rpcClient";

const CONTRACT_ID = process.env.CONTRACT_ID || "";
const NETWORK_PASSPHRASE =
  config.NEXT_PUBLIC_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

/**
 * Builds an unsigned Soroban contract transaction XDR for client signing.
 * @param sourceAddress - Stellar account that will sign the transaction.
 * @param method - Soroban contract method name.
 * @param args - Encoded contract arguments.
 * @returns Base64-encoded unsigned transaction XDR.
 */
export async function buildContractTx(
  sourceAddress: string,
  method: string,
  args: xdr.ScVal[]
): Promise<string> {
  const account = (await rpcClient.getAccount(sourceAddress)) as any;
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
  const prepared = (await rpcClient.prepareTransaction(tx)) as any;
  return prepared.toXDR();
}

export { CONTRACT_ID, NETWORK_PASSPHRASE };
