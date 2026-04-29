-- 1. Safely add the new "Golden Thread" and financial columns to your existing table
ALTER TABLE payout_schedules 
    ADD COLUMN IF NOT EXISTS po_ref UUID,
    ADD COLUMN IF NOT EXISTS boq_ref UUID,
    ADD COLUMN IF NOT EXISTS base_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS final_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending Finance',
    ADD COLUMN IF NOT EXISTS proof_document_url TEXT;

-- (Optional) If you want to clean up the old 'amount' column now that you have base/final:
-- ALTER TABLE payout_schedules DROP COLUMN IF EXISTS amount;

-- 2. Clear out the old policies to prevent the 42710 "already exists" error
DROP POLICY IF EXISTS "Suppliers can view their own payouts" ON payout_schedules;
DROP POLICY IF EXISTS "Finance can view all payouts" ON payout_schedules;
DROP POLICY IF EXISTS "Finance can manage all payouts" ON payout_schedules;
DROP POLICY IF EXISTS "Suppliers can update their own payouts" ON payout_schedules;

-- 3. Apply the updated RLS Policies

-- Suppliers can view their own
CREATE POLICY "Suppliers can view their own payouts"
ON payout_schedules
FOR SELECT
USING (
    supplier_email = auth.jwt()->>'email'
);

-- Suppliers can update their own (for MVP 7 Dynamic Discounting)
CREATE POLICY "Suppliers can update their own payouts"
ON payout_schedules
FOR UPDATE
USING (
    supplier_email = auth.jwt()->>'email'
)
WITH CHECK (
    supplier_email = auth.jwt()->>'email'
);

-- Finance has full CRUD access
CREATE POLICY "Finance can manage all payouts"
ON payout_schedules
FOR ALL
USING (
    auth.jwt()->>'role' = 'finance'
);