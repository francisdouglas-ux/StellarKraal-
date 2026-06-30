# Contract Deployment Guide

This guide provides step-by-step instructions for deploying the smart contract to Stellar Testnet and Mainnet.

## Prerequisites

Ensure you have the following installed:

- Rust (latest stable)
- Cargo
- Soroban CLI
- A funded Stellar account

Install Soroban CLI:
```bash
cargo install --locked soroban-cli
```

## Build the Contract (WASM)
Compile the contract to WASM:
```bash
cargo build --target wasm32-unknown-unknown --release
```

Optimize the WASM:
```bash
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/*.wasm
```

## Fund Deployer Account (Testnet)
Generate a keypair if needed:
```bash
soroban keys generate deployer
```

Fund the account using Friendbot:
```bash
curl "https://friendbot.stellar.org?addr=$(soroban keys address deployer)"
```

## Deploy to Testnet
```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/*.wasm \
  --source deployer \
  --network testnet
```

Save the returned `CONTRACT_ID`.

## Initialize Contract
Replace placeholders with actual values:

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- \
  init \
  --admin <ADMIN_ADDRESS>
```

>Ensure the correct initialization parameters are used based on the contract implementation.

## Verify Deployment
Check contract is working:

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- \
  version
```
Or call any read function available.

## Mainnet Deployment - Warnings & Checklist

## Important War
- Never use test keys on mainnet  
- Double-check contract code before deployment  
- Ensure contract is audited  
- Secure admin private keys  
- Validate all environment variables  


## Mainnet Checklist
- [ ] Contract audited  
- [ ] Tests passing  
- [ ] Gas usage optimized  
- [ ] Admin keys secured  
- [ ] Environment variables updated  
- [ ] Backup of keys created  

## Deploy to Mainnet

Use the guarded deployment script for mainnet. It refuses to run unless
`NETWORK=mainnet` is set and all pre-deployment checks pass.

Pre-deployment checks:
- Verify the optimized WASM hash against `EXPECTED_WASM_HASH`.
- Confirm `ADMIN_ADDRESS` by requiring `CONFIRM_ADMIN_ADDRESS` to match exactly.
- Verify required Stellar addresses are present and that `TOKEN_ADDRESS` is a Soroban contract address.

```bash
export NETWORK=mainnet
export RPC_URL=https://mainnet.sorobanrpc.com
export WASM_PATH=contracts/stellarkraal/target/wasm32-unknown-unknown/release/stellarkraal.wasm
export EXPECTED_WASM_HASH=<sha256-of-reviewed-wasm>
export DEPLOYER=deployer
export ADMIN_ADDRESS=<MAINNET_ADMIN_ADDRESS>
export CONFIRM_ADMIN_ADDRESS=<MAINNET_ADMIN_ADDRESS>
export TOKEN_ADDRESS=<MAINNET_TOKEN_CONTRACT_ADDRESS>
export ORACLE_ADDRESS=<MAINNET_ORACLE_ADDRESS>
export TREASURY_ADDRESS=<MAINNET_TREASURY_ADDRESS>
export LTV_BPS=6000
export LIQ_THRESHOLD_BPS=8000

./scripts/deploy-mainnet.sh
```

The script deploys the WASM, initializes the contract, runs
`scripts/verify-deployment.ts` with `NEXT_PUBLIC_NETWORK=mainnet`, and prints:

```bash
CONTRACT_ID=<deployed-contract-id>
DEPLOY_TX_HASH=<deployment-transaction-hash>
```

## Post-Deployment Verification
- Confirm the script completed `verify-deployment.ts` successfully on mainnet.
- Store `CONTRACT_ID` and `DEPLOY_TX_HASH` in the release notes and operations vault.
- Verify initialization parameters against the deployment ticket.
- Run small test transactions only after admin approval.
- Monitor logs and events.

## Rollback Procedure
If something goes wrong:
- Stop interactions with the contract
- Identify issue
- Deploy a fixed version
- Re-initialize with correct parameters
- Update frontend/backend with new contract ID


## Troubleshooting
❌ Insufficient Funds

- Fund deployer account again

❌ WASM Not Found

- Ensure correct build path

❌ Unauthorized Error

- Check correct key is used

❌ Init Fails

- Verify parameters match contract requirements

## Notes
- Always test on testnet first
- Keep contract IDs documented
- Never expose private keys
  
