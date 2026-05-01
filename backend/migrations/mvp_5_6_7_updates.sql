-- Migration Script for MVP 5, 6, and 7 Extensions

-- 1. Extend tolerance_rules with category
ALTER TABLE tolerance_rules 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General',
ADD COLUMN IF NOT EXISTS vendor_tier_multiplier DECIMAL DEFAULT 1.0;

-- 2. Create vendor_trust_profiles
CREATE TABLE IF NOT EXISTS vendor_trust_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_email TEXT UNIQUE NOT NULL,
    accuracy_score DECIMAL DEFAULT 1.0, -- 0.0 to 1.0
    trust_tier INTEGER DEFAULT 2, -- 1 (Strategic), 2 (Standard), 3 (High Risk)
    rolling_6mo_variance_total DECIMAL DEFAULT 0,
    rolling_6mo_invoice_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update payout_schedules to match the user's "Stage & Disburse" engine requirements
ALTER TABLE payout_schedules 
ADD COLUMN IF NOT EXISTS scheduled_date DATE,
ADD COLUMN IF NOT EXISTS bank_batch_id TEXT,
ADD COLUMN IF NOT EXISTS discount_applied DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS early_payout_requested BOOLEAN DEFAULT FALSE;

-- 4. Create treasury_settings for Capital Deployment Caps
CREATE TABLE IF NOT EXISTS treasury_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value_numeric DECIMAL,
    value_text TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO treasury_settings (key, value_numeric) 
VALUES ('monthly_early_payout_cap', 5000000.00)
ON CONFLICT (key) DO UPDATE SET value_numeric = EXCLUDED.value_numeric;
