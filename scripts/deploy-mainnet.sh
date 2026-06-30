#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

NETWORK="${NETWORK:-}"
RPC_URL="${RPC_URL:-https://mainnet.sorobanrpc.com}"
WASM_PATH="${WASM_PATH:-$ROOT_DIR/contracts/stellarkraal/target/wasm32-unknown-unknown/release/stellarkraal.wasm}"
EXPECTED_WASM_HASH="${EXPECTED_WASM_HASH:-}"
DEPLOYER="${DEPLOYER:-deployer}"
ADMIN_ADDRESS="${ADMIN_ADDRESS:-}"
CONFIRM_ADMIN_ADDRESS="${CONFIRM_ADMIN_ADDRESS:-}"
TOKEN_ADDRESS="${TOKEN_ADDRESS:-}"
ORACLE_ADDRESS="${ORACLE_ADDRESS:-}"
TREASURY_ADDRESS="${TREASURY_ADDRESS:-}"
LTV_BPS="${LTV_BPS:-6000}"
LIQ_THRESHOLD_BPS="${LIQ_THRESHOLD_BPS:-8000}"
STELLAR_CLI="${STELLAR_CLI:-stellar}"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

require_address() {
  local name="$1"
  local value="$2"
  [[ -n "$value" ]] || fail "$name is required"
  [[ "$value" =~ ^[A-Z0-9]{56}$ ]] || fail "$name must be a 56-character Stellar address"
}

extract_json_field() {
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); const keys=process.argv.slice(1); for (const key of keys) { if (data[key]) { console.log(data[key]); process.exit(0); } } process.exit(1);" "$@"
}

[[ "$NETWORK" == "mainnet" ]] || fail "set NETWORK=mainnet to deploy to public network"
[[ -f "$WASM_PATH" ]] || fail "WASM_PATH does not exist: $WASM_PATH"
[[ -n "$EXPECTED_WASM_HASH" ]] || fail "EXPECTED_WASM_HASH is required"

require_cmd sha256sum
require_cmd node
require_cmd npm
require_cmd "$STELLAR_CLI"

require_address ADMIN_ADDRESS "$ADMIN_ADDRESS"
require_address CONFIRM_ADMIN_ADDRESS "$CONFIRM_ADMIN_ADDRESS"
require_address TOKEN_ADDRESS "$TOKEN_ADDRESS"
require_address ORACLE_ADDRESS "$ORACLE_ADDRESS"
require_address TREASURY_ADDRESS "$TREASURY_ADDRESS"

[[ "$ADMIN_ADDRESS" == "$CONFIRM_ADMIN_ADDRESS" ]] || fail "CONFIRM_ADMIN_ADDRESS must match ADMIN_ADDRESS"
[[ "$TOKEN_ADDRESS" == C* ]] || fail "TOKEN_ADDRESS must be a Soroban contract address"

ACTUAL_WASM_HASH="$(sha256sum "$WASM_PATH" | awk '{print $1}')"
[[ "$ACTUAL_WASM_HASH" == "$EXPECTED_WASM_HASH" ]] || fail "WASM hash mismatch: expected $EXPECTED_WASM_HASH, got $ACTUAL_WASM_HASH"

printf 'Mainnet deployment checks passed\n'
printf '  WASM hash: %s\n' "$ACTUAL_WASM_HASH"
printf '  Admin:     %s\n' "$ADMIN_ADDRESS"
printf '  Token:     %s\n' "$TOKEN_ADDRESS"
printf '  RPC URL:   %s\n' "$RPC_URL"

DEPLOY_JSON="$("$STELLAR_CLI" contract deploy \
  --wasm "$WASM_PATH" \
  --source "$DEPLOYER" \
  --network mainnet \
  --rpc-url "$RPC_URL" \
  --output json)"

CONTRACT_ID="$(printf '%s' "$DEPLOY_JSON" | extract_json_field contractId contract_id id)"
DEPLOY_TX_HASH="$(printf '%s' "$DEPLOY_JSON" | extract_json_field hash txHash transactionHash transaction_hash)"

[[ -n "$CONTRACT_ID" ]] || fail "deployment did not return a contract ID"
[[ -n "$DEPLOY_TX_HASH" ]] || fail "deployment did not return a transaction hash"

"$STELLAR_CLI" contract invoke \
  --id "$CONTRACT_ID" \
  --source "$DEPLOYER" \
  --network mainnet \
  --rpc-url "$RPC_URL" \
  -- initialize \
  --admin "$ADMIN_ADDRESS" \
  --oracle "$ORACLE_ADDRESS" \
  --token "$TOKEN_ADDRESS" \
  --treasury "$TREASURY_ADDRESS" \
  --ltv_bps "$LTV_BPS" \
  --liquidation_threshold_bps "$LIQ_THRESHOLD_BPS"

NETWORK=mainnet \
NEXT_PUBLIC_NETWORK=mainnet \
RPC_URL="$RPC_URL" \
CONTRACT_ID="$CONTRACT_ID" \
ADMIN_ADDRESS="$ADMIN_ADDRESS" \
npm run verify:deployment

printf '\nMainnet deployment complete\n'
printf 'CONTRACT_ID=%s\n' "$CONTRACT_ID"
printf 'DEPLOY_TX_HASH=%s\n' "$DEPLOY_TX_HASH"
