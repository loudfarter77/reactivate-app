-- Migration 004: Tighten deny-all RLS for anon role
-- Adds WITH CHECK (FALSE) to block anon INSERT operations on all tables.
-- Previously USING (FALSE) only filtered SELECTs, not INSERTs.
-- Run this in the Supabase SQL Editor.

-- Drop existing deny policies and recreate with explicit INSERT blocking

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'clients', 'campaign_templates', 'campaigns', 'leads', 'emails',
    'sms_messages', 'bookings', 'send_failures', 'commission_disputes', 'lead_events'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Drop old policy
    EXECUTE format('DROP POLICY IF EXISTS "deny_anon_%s" ON %I', tbl, tbl);
    -- Recreate with WITH CHECK (FALSE) to also block anon INSERTs
    EXECUTE format(
      'CREATE POLICY "deny_anon_%s" ON %I FOR ALL TO anon USING (FALSE) WITH CHECK (FALSE)',
      tbl, tbl
    );
  END LOOP;
END $$;
