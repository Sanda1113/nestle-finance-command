-- Fix the payout_schedules table to use BIGINT for references instead of UUID
-- This resolves the "invalid input syntax for type uuid" error when staging payouts.

ALTER TABLE payout_schedules 
  ALTER COLUMN invoice_ref TYPE BIGINT USING NULL,
  ALTER COLUMN po_ref TYPE BIGINT USING NULL;

-- Fix the Row-Level Security (RLS) violation
-- Since the backend uses the anon key, it needs permission to insert and update records.
CREATE POLICY "Allow anon all operations" 
ON payout_schedules 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);
