-- Migration: Add business_name and business_address to clients
-- Run this in the Supabase SQL Editor

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS business_address TEXT;

-- business_name: Legal/public business name used in email footers.
--   Defaults to the existing `name` field if not set (handled in application logic).
-- business_address: Full postal address for legal email compliance.
--   Required for CAN-SPAM / GDPR email footer compliance.

COMMENT ON COLUMN clients.business_name IS 'Public business name shown in email footers. Falls back to name if null.';
COMMENT ON COLUMN clients.business_address IS 'Postal address for legal email footer compliance (CAN-SPAM / GDPR).';
