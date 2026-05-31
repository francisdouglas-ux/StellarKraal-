-- Migration: 001-initial-schema (down)
DROP INDEX IF EXISTS idx_collaterals_owner;
DROP INDEX IF EXISTS idx_loans_borrower;
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS collaterals;
