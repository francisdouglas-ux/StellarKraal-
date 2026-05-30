# Troubleshooting Guide

Common errors encountered when developing or running StellarKraal, organised by category with cause and resolution for each.

---

## Setup

### 1. `npm ERR! code ERESOLVE` — dependency conflict on install

**Symptom:** `npm install` fails with `ERESOLVE unable to resolve dependency tree`.

**Cause:** Mismatched peer dependency versions, often triggered by running the wrong Node.js version.

**Resolution:**
1. Confirm you are on Node.js 20+: `node --version`
2. Delete cached state and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

---

### 2. `stellar: command not found`

**Symptom:** Running `stellar` or `stellar-cli` in the terminal returns `command not found`.

**Cause:** The Stellar CLI was installed via Cargo but `~/.cargo/bin` is not on `PATH`.

**Resolution:**
```bash
export PATH="$HOME/.cargo/bin:$PATH"
```
Add that line to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) to make it permanent.

---

### 3. `error: failed to run custom build command for 'soroban-env-host'`

**Symptom:** `cargo build` or `cargo test` inside `contracts/stellarkraal` fails with the above error.

**Cause:** The `wasm32-unknown-unknown` Rust target is missing.

**Resolution:**
```bash
rustup target add wasm32-unknown-unknown
```

---

### 4. `Error: Cannot find module 'sqlite3'` / `sqlite3 module not found`

**Symptom:** The backend fails to start with a missing `sqlite3` module error.

**Cause:** The native `sqlite3` addon failed to compile during `npm install` due to missing build tools.

**Resolution:**
- **Linux:** `sudo apt install build-essential libsqlite3-dev`
- **macOS:** `xcode-select --install`
- Then rebuild the addon: `npm rebuild sqlite3` inside `backend/`

---

### 5. `cp: cannot stat 'env.example': No such file or directory`

**Symptom:** `cp env.example .env` fails after cloning.

**Cause:** The file is named `.env.example` in some branches and `env.example` in others.

**Resolution:** Check which file exists and copy the correct one:
```bash
ls .env.example env.example 2>/dev/null
cp .env.example .env   # or: cp env.example .env
```

---

## Runtime

### 6. `Error: listen EADDRINUSE :::3001` — PORT already in use

**Symptom:** The backend refuses to start with `EADDRINUSE`.

**Cause:** Another process is already bound to port 3001 (or whichever port `PORT` is set to).

**Resolution:**
```bash
# Find the process
lsof -i :3001
# Kill it
kill -9 <PID>
```
Or change `PORT` in `.env` to a free port.

---

### 7. `Cannot connect to RPC_URL` / `fetch failed` calling Soroban RPC

**Symptom:** API calls that invoke the smart contract return network errors or timeouts.

**Cause:** `RPC_URL` in `.env` is wrong, the testnet endpoint is temporarily down, or there is no internet access.

**Resolution:**
1. Verify the value: `grep RPC_URL .env`
2. Test reachability: `curl -s https://soroban-testnet.stellar.org` should return JSON.
3. If the public testnet is down, check [Stellar Status](https://status.stellar.org/) or switch to a local Stellar node.

---

### 8. `CORS policy` error in browser — frontend API requests blocked

**Symptom:** Browser console shows `Access to fetch at 'http://localhost:3001' from origin 'http://localhost:3000' has been blocked by CORS policy`.

**Cause:** `FRONTEND_URL` is not set or does not match the origin the frontend is served from.

**Resolution:** Add or correct the variable in `.env`:
```
FRONTEND_URL=http://localhost:3000
```
Restart the backend after saving.

---

### 9. `JsonWebTokenError: invalid signature` / `401 Unauthorized` on API requests

**Symptom:** Authenticated API endpoints return 401 with a JWT error in the backend logs.

**Cause:** `JWT_SECRET` differs between the process that issued the token and the process validating it (e.g., after rotating the secret without re-logging in).

**Resolution:**
1. Ensure `JWT_SECRET` is identical across all backend instances and matches the value used when the token was issued.
2. Clear browser storage / cookies and log in again to obtain a fresh token.

---

### 10. Frontend stuck on loading — `backend` health check failing in Docker

**Symptom:** `docker compose up` starts but the frontend never becomes available; `docker compose ps` shows `frontend` as `starting`.

**Cause:** The frontend waits for the backend to pass its health check (`GET /api/health`). If the backend is unhealthy, the frontend never starts.

**Resolution:**
```bash
docker compose logs backend
```
Fix the underlying backend error (often a missing env variable or failed migration), then:
```bash
docker compose restart backend
```

---

## Contract

### 11. `HostError: Error(Contract, #10)` — contract invocation rejected

**Symptom:** A contract call returns a `HostError` with a contract-defined error code.

**Cause:** The contract enforced a business rule (e.g., loan-to-value exceeded, collateral already locked, unauthorised caller).

**Resolution:**
1. Check the error code against the contract source in `contracts/stellarkraal/src/lib.rs`.
2. Verify the inputs (collateral ID, loan amount, caller address) satisfy the contract's preconditions.
3. Run `cargo test` locally to reproduce the scenario in a unit test.

---

### 12. `TransactionResultCode.txBAD_SEQ` — transaction sequence number mismatch

**Symptom:** Submitting a transaction via Freighter or the backend returns `txBAD_SEQ`.

**Cause:** The account's sequence number on-chain is ahead of what the client cached, usually because another transaction was submitted concurrently.

**Resolution:**
1. Refresh the account sequence number before building the transaction.
2. In the backend, ensure no two code paths submit transactions for the same account simultaneously.
3. Retry the operation — the client will fetch the latest sequence number on the next attempt.

---

### 13. `Contract not found` / `invoke_contract` returns `MissingValue`

**Symptom:** Any contract invocation fails with a "not found" or missing value error.

**Cause:** `CONTRACT_ID` in `.env` points to a contract that has not been deployed to the current network, or the wrong network is selected.

**Resolution:**
1. Confirm the network: `grep NEXT_PUBLIC_NETWORK .env`
2. Confirm the contract is deployed: `stellar contract info --id $CONTRACT_ID --network testnet`
3. If not deployed, follow `docs/deployment/contract-deployment.md` to deploy and update `CONTRACT_ID`.

---

## Database

### 14. `SQLITE_CANTOPEN: unable to open database file`

**Symptom:** The backend logs `SQLITE_CANTOPEN` on startup.

**Cause:** The SQLite file path configured in `database.json` does not exist or the process lacks write permission.

**Resolution:**
```bash
# Check the configured path
cat backend/database.json
# Ensure the directory is writable
ls -la backend/
# Create the file if missing (migrations will populate it)
touch backend/dev.sqlite3
npm run migrate:dev --prefix backend
```

---

### 15. `Migration failed: table already exists`

**Symptom:** Running `npm run migrate:dev` fails with a "table already exists" error.

**Cause:** A previous partial migration left the database in an inconsistent state, or migrations were run twice.

**Resolution:**
1. For a development database it is safe to reset:
   ```bash
   rm backend/dev.sqlite3
   npm run migrate:dev --prefix backend
   ```
2. For a shared or staging database, inspect the `migrations` table and manually mark the failed migration as rolled back before re-running.

---

## Updating this guide

When a new common issue is identified, add an entry under the appropriate category following the format:

```
### N. `exact error message or symptom`

**Symptom:** What the developer sees.

**Cause:** Root cause.

**Resolution:** Step-by-step fix.
```
