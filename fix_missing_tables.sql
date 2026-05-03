-- Fix for missing vendor_trust_profiles table and payout_schedules unification

-- 1. Create vendor_trust_profiles if missing
CREATE TABLE IF NOT EXISTS vendor_trust_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_email TEXT UNIQUE NOT NULL,
    accuracy_score DECIMAL DEFAULT 1.0, -- 0.0 to 1.0
    trust_tier INTEGER DEFAULT 2, -- 1 (Strategic), 2 (Standard), 3 (High Risk)
    rolling_6mo_variance_total DECIMAL DEFAULT 0,
    rolling_6mo_invoice_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure RLS is configured for vendor_trust_profiles
ALTER TABLE vendor_trust_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all" ON vendor_trust_profiles FOR SELECT USING (true);

-- 2. Ensure payout_schedules (plural) has all required columns for Sprint 2
-- Based on the schema expected by sprint2.js and DigitalCalendar
ALTER TABLE payout_schedules 
ADD COLUMN IF NOT EXISTS invoice_ref UUID, -- or BIGINT depending on your reconciliations.id
ADD COLUMN IF NOT EXISTS po_ref UUID,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS base_amount NUMERIC,
ADD COLUMN IF NOT EXISTS final_amount NUMERIC,
ADD COLUMN IF NOT EXISTS proof_document_url TEXT;

-- 3. Migrate data from payout_schedule (singular) if it exists and has data
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
            start_date, 
            end_date
        )
        SELECT 
            po_number, 
            invoice_number, 
            supplier_email, 
            status, 
            payout_amount, 
            payout_amount, 
            due_date::timestamptz, 
            due_date::timestamptz
        FROM payout_schedule
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
