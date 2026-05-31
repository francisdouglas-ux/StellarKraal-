#!/usr/bin/env ts-node
/**
 * scripts/verify-deployment.ts
 *
 * Post-deploy verification script for StellarKraal contract.
 * Exits with code 1 if any check fails.
 *
 * Usage:
 *   RPC_URL=... CONTRACT_ID=... ADMIN_ADDRESS=... ts-node scripts/verify-deployment.ts
 *   NEXT_PUBLIC_NETWORK=mainnet ... ts-node scripts/verify-deployment.ts
 */

import {
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  nativeToScVal,
  SorobanRpc,
} from "@stellar/stellar-sdk";

const { Server } = SorobanRpc;

// ── Config ────────────────────────────────────────────────────────────────────
const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.CONTRACT_ID || "";
const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || "";
const NETWORK =
  process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet";
const NETWORK_PASSPHRASE =
  NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

// Fee-less read-only account (well-known testnet/mainnet horizon account)
const READ_ACCOUNT =
  NETWORK === "mainnet"
    ? "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
    : "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

// ── Helpers ───────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label: string, reason?: string) {
  console.error(`  ❌ ${label}${reason ? `: ${reason}` : ""}`);
  failed++;
}

async function simulateRead(
  server: SorobanRpc.Server,
  method: string,
  args: ReturnType<typeof nativeToScVal>[]
): Promise<unknown> {
  const account = await server.getAccount(READ_ACCOUNT);
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new Error(result.error);
  }
  return (result as SorobanRpc.Api.SimulateTransactionSuccessResponse).result
    ?.retval;
}

// ── Checks ────────────────────────────────────────────────────────────────────
async function checkConfig() {
  console.log("\n[1] Configuration");
  if (!CONTRACT_ID || CONTRACT_ID === "your_deployed_contract_id") {
    fail("CONTRACT_ID is set", "missing or placeholder value");
  } else {
    ok(`CONTRACT_ID = ${CONTRACT_ID}`);
  }
  if (!ADMIN_ADDRESS) {
    fail("ADMIN_ADDRESS is set", "set ADMIN_ADDRESS env var");
  } else {
    ok(`ADMIN_ADDRESS = ${ADMIN_ADDRESS}`);
  }
  ok(`Network = ${NETWORK} (${NETWORK_PASSPHRASE.slice(0, 30)}...)`);
}

async function checkRpcConnectivity(server: SorobanRpc.Server) {
  console.log("\n[2] RPC connectivity");
  try {
    const health = await server.getHealth();
    if (health.status === "healthy") {
      ok(`RPC healthy at ${RPC_URL}`);
    } else {
      fail("RPC health", `status = ${health.status}`);
    }
  } catch (e) {
    fail("RPC reachable", (e as Error).message);
  }
}

async function checkContractResponds(server: SorobanRpc.Server) {
  console.log("\n[3] Contract responds");
  try {
    // get_loan with id=0 should return LoanNotFound — that means the contract is alive
    await simulateRead(server, "get_loan", [
      nativeToScVal(BigInt(0), { type: "u64" }),
    ]);
    // If it returns without error, that's unexpected but not fatal
    ok("Contract responds to get_loan simulation");
  } catch (e) {
    const msg = (e as Error).message;
    // LoanNotFound (error code 5) means the contract is initialized and responding
    if (msg.includes("LoanNotFound") || msg.includes("5")) {
      ok("Contract responds (LoanNotFound as expected for id=0)");
    } else {
      fail("Contract responds", msg);
    }
  }
}

async function checkHealthFactor(server: SorobanRpc.Server) {
  console.log("\n[4] health_factor read");
  try {
    await simulateRead(server, "health_factor", [
      nativeToScVal(BigInt(1), { type: "u64" }),
    ]);
    ok("health_factor simulation succeeded");
  } catch (e) {
    const msg = (e as Error).message;
    // LoanNotFound is expected on a fresh deployment — contract is responding correctly
    if (msg.includes("LoanNotFound") || msg.includes("5")) {
      ok("health_factor responds (LoanNotFound expected on fresh deploy)");
    } else {
      fail("health_factor simulation", msg);
    }
  }
}

async function checkInitializedState(server: SorobanRpc.Server) {
  console.log("\n[5] Initialized state");
  try {
    // Calling get_collateral with id=0 — if NotInitialized we know the contract isn't set up
    await simulateRead(server, "get_collateral", [
      nativeToScVal(BigInt(0), { type: "u64" }),
    ]);
    ok("Contract is initialized (get_collateral responded)");
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("NotInitialized") || msg.includes("1")) {
      fail("Contract initialized", "contract not yet initialized — run initialize()");
    } else if (msg.includes("CollateralNotFound") || msg.includes("6")) {
      ok("Contract is initialized (CollateralNotFound expected on fresh deploy)");
    } else {
      fail("Contract initialized check", msg);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  StellarKraal Deployment Verification");
  console.log(`  Network : ${NETWORK}`);
  console.log(`  RPC     : ${RPC_URL}`);
  console.log("═══════════════════════════════════════════════");

  const server = new Server(RPC_URL);

  await checkConfig();
  await checkRpcConnectivity(server);
  await checkContractResponds(server);
  await checkHealthFactor(server);
  await checkInitializedState(server);

  console.log("\n═══════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Verification script crashed:", e.message);
  process.exit(1);
});
