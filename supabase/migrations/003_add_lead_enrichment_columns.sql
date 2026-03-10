-- Migration 003: Add optional lead enrichment columns
-- Run this in the Supabase SQL Editor.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS last_contact_date TEXT,
  ADD COLUMN IF NOT EXISTS service_type      TEXT,
  ADD COLUMN IF NOT EXISTS purchase_value    TEXT,
  ADD COLUMN IF NOT EXISTS notes             TEXT;

COMMENT ON COLUMN leads.last_contact_date IS 'Date of last contact with this lead (from CSV, free-form text)';
COMMENT ON COLUMN leads.service_type      IS 'Type of service the lead previously purchased';
COMMENT ON COLUMN leads.purchase_value    IS 'Value of previous purchase / job (free-form text)';
COMMENT ON COLUMN leads.notes             IS 'Additional notes about this lead from the CSV';
