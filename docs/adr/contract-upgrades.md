# ADR: Two-Step Contract Upgrade Mechanism

**Status:** Accepted  
**Date:** 2026-06-30  
**Issue:** #669

---

## Context

The StellarKraal contract holds user funds and collateral. Deploying a new WASM binary
replaces all contract logic atomically. Without a governance delay an admin key compromise
could silently drain the protocol in a single transaction.

---

## Decision

Implement a **two-step, time-locked upgrade** using Soroban's
`env.deployer().update_current_contract_wasm(hash)` API.

### Functions

| Function | Auth | Description |
|---|---|---|
| `propose_upgrade(admin, new_wasm_hash)` | Admin | Stores hash + timestamp; emits `upgrade / proposed` event. |
| `execute_upgrade()` | Anyone after timelock | Checks timelock has elapsed, removes pending proposal, calls wasm update. |
| `cancel_upgrade(admin)` | Admin | Clears proposal; emits `upgrade / canceled` event. |

### Timelock

`UPGRADE_TIMELOCK_SECS = 86_400` (24 hours).  The proposal timestamp is written using
`env.ledger().timestamp()` and the elapsed check is `now >= proposal_time + 86_400`.

### Storage

Proposal state is stored in **persistent** storage so it survives ledger archiving:

- `DataKey::PendingWasm` → `BytesN<32>` hash
- `DataKey::UpgradeTime` → `u64` proposal timestamp

Both keys are removed atomically on execute or cancel, leaving no stale state.

---

## Security Properties

1. **Admin-only proposal.** `propose_upgrade` and `cancel_upgrade` require `assert_admin`
   plus `admin.require_auth()`, preventing any non-admin account from initiating or blocking
   an upgrade.

2. **24-hour veto window.** Between proposal and execution, any observer can detect the
   `upgrade / proposed` event on-chain and alert stakeholders.  The admin may call
   `cancel_upgrade` to abort.

3. **No re-entrancy during upgrade.** `execute_upgrade` is not guarded by
   `ReentrancyGuard` (the wasm replacement terminates the current invocation), but it
   clears persistent storage _before_ calling `update_current_contract_wasm` so that a
   failed wasm install cannot leave a zombie pending proposal.

4. **Event audit trail.** All three state transitions emit named events (`proposed`,
   `executed`, `canceled`) with the hash and timestamp, enabling off-chain monitoring.

5. **No admin-key single-point-of-failure for execution.** After the timelock elapses,
   _anyone_ may call `execute_upgrade`.  This prevents a lost admin key from permanently
   blocking an approved upgrade.

---

## Alternatives Considered

| Option | Rejected because |
|---|---|
| Single-step upgrade | Admin key compromise = instant irreversible drain. |
| Multisig off-chain | Relies on off-chain coordination; on-chain timelock is trustless. |
| DAO vote | Adds significant complexity and external dependency not yet in scope. |

---

## Consequences

- Upgrades require at minimum 24 hours notice — planned for the roadmap, acceptable given
  the security benefit.
- The pending hash stored in persistent storage incurs a small ledger-entry fee.
- Future ADRs may extend the timelock or add a multisig quorum check before `execute_upgrade`.
