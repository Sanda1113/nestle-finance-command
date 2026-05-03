-- Fix for missing columns and tables

-- 1. Create vendor_trust_profiles if missing
CREATE TABLE IF NOT EXISTS vendor_trust_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_email TEXT UNIQUE NOT NULL,
    accuracy_score DECIMAL DEFAULT 1.0, 
    trust_tier INTEGER DEFAULT 2, 
    rolling_6mo_variance_total DECIMAL DEFAULT 0,
    rolling_6mo_invoice_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure RLS is configured for vendor_trust_profiles
ALTER TABLE vendor_trust_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all" ON vendor_trust_profiles;
CREATE POLICY "Enable read access for all" ON vendor_trust_profiles FOR SELECT USING (true);

-- 2. Ensure payout_schedules (plural) has all required columns
-- We use a series of ALTER TABLE commands to ensure each column exists
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS po_number TEXT;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS invoice_ref UUID;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS po_ref UUID;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS base_amount NUMERIC;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS final_amount NUMERIC;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Scheduled';
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS proof_document_url TEXT;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS hold_until_date TIMESTAMPTZ;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS bank_transaction_ref TEXT;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS supplier_email TEXT;
ALTER TABLE payout_schedules ADD COLUMN IF NOT EXISTS payment_terms TEXT;

-- 3. Migrate data from payout_schedule (singular) if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payout_schedule') THEN
        INSERT INTO payout_schedules (
            po_number, 
            invoice_number, 
            supplier_email, 
            status, 
            base_amount, 
            final_amount, 
            amount,
            start_date, 
            end_date,
            payment_terms
        )
        SELECT 
            po_number, 
            invoice_number, 
            supplier_email, 
            status, 
            payout_amount, 
            payout_amount, 
            payout_amount,
            due_date::timestamptz, 
            due_date::timestamptz,
            payment_terms
        FROM payout_schedule
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
