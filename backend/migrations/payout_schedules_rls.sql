-- 1. Create the payout_schedules table
CREATE TABLE IF NOT EXISTS payout_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_ref UUID,
    supplier_email TEXT NOT NULL,
    title TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (RLS) on the table
ALTER TABLE payout_schedules ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policy for Suppliers
-- This policy ensures suppliers can only view their own payout schedule events.
CREATE POLICY "Suppliers can view their own payouts"
ON payout_schedules
FOR SELECT
USING (
    supplier_email = auth.jwt()->>'email'
);

-- 4. Create RLS Policy for Finance (Service Role Bypass)
-- If your backend uses the service_role key to query data, RLS is automatically bypassed.
-- However, if users access it directly via supabase client with a 'finance' role claim:
CREATE POLICY "Finance can view all payouts"
ON payout_schedules
FOR ALL
USING (
    auth.jwt()->>'role' = 'finance'
);
