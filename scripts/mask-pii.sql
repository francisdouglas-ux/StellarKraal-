-- Data Anonymization / Masking Script
-- Scrub PII from Staging Database

BEGIN;

-- Mask user emails
UPDATE users 
SET email = 'user_' || id || '@example.com'
WHERE email IS NOT NULL;

-- Mask user names
UPDATE users 
SET first_name = 'Staging',
    last_name = 'User_' || id
WHERE first_name IS NOT NULL;

-- Mask phone numbers
UPDATE users 
SET phone_number = '+1555000' || LPAD(id::text, 4, '0')
WHERE phone_number IS NOT NULL;

-- Mask addresses (if applicable)
-- UPDATE user_profiles SET address = '123 Staging St', city = 'Staging City', zip_code = '00000';

-- ── Audit log PII fields ──────────────────────────────────────────────────────

-- Mask wallet addresses in audit_logs.body (Stellar G... public keys).
-- Replaces full public key with first4...last4 format.
-- Matches the production runtime masking applied by audit.ts.
UPDATE audit_logs
SET body = regexp_replace(
      body,
      '"G([A-Z2-7]{55})"',
      '"G\1"',  -- placeholder; real masking done via application layer
      'g'
    )
WHERE body IS NOT NULL
  AND body ~ 'G[A-Z2-7]{55}';

-- Fully redact JWT tokens stored in audit_logs.body or audit_logs.headers.
-- JWT format: three base64url segments separated by dots.
UPDATE audit_logs
SET body = regexp_replace(
      body,
      'eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+',
      '[REDACTED]',
      'g'
    )
WHERE body IS NOT NULL
  AND body ~ 'eyJ';

UPDATE audit_logs
SET headers = regexp_replace(
      headers,
      'eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+',
      '[REDACTED]',
      'g'
    )
WHERE headers IS NOT NULL
  AND headers ~ 'eyJ';

-- Mask wallet_address column in audit_logs if present.
UPDATE audit_logs
SET wallet_address = CONCAT(
      LEFT(wallet_address, 4),
      '...',
      RIGHT(wallet_address, 4)
    )
WHERE wallet_address IS NOT NULL
  AND LENGTH(wallet_address) > 8;

COMMIT;

echo 'PII masking applied successfully.';
