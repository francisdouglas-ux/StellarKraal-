-- Migration 002: Add indexes on frequently filtered columns for collateral and loan queries.
-- Targets the owner, animal_type, and status filters used by the list endpoints.

CREATE INDEX IF NOT EXISTS idx_collaterals_owner       ON collaterals(owner);
CREATE INDEX IF NOT EXISTS idx_collaterals_animal_type ON collaterals(animal_type);
CREATE INDEX IF NOT EXISTS idx_collaterals_status      ON collaterals(status);

CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower);
CREATE INDEX IF NOT EXISTS idx_loans_status   ON loans(status);
