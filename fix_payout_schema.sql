-- Fix the payout_schedules table to use BIGINT for references instead of UUID
-- This resolves the "invalid input syntax for type uuid" error when staging payouts.

ALTER TABLE payout_schedules 
  ALTER COLUMN invoice_ref TYPE BIGINT USING NULL,
  ALTER COLUMN po_ref TYPE BIGINT USING NULL;
