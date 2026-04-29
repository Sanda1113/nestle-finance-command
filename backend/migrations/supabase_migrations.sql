-- Migration Script for MVP 5, 6, and 7

-- 1. Modify reconciliations table
ALTER TABLE reconciliations 
ADD COLUMN IF NOT EXISTS auto_approval_reason TEXT,
ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT FALSE;

-- 2. Create tolerance_rules table
CREATE TABLE IF NOT EXISTS tolerance_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL, -- 'absolute' or 'percentage'
    threshold_value DECIMAL NOT NULL,
    applies_to TEXT DEFAULT 'ALL', -- 'ALL', supplier_email, or category
    auto_approve BOOLEAN DEFAULT TRUE,
    requires_note BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert some default tolerance rules
INSERT INTO tolerance_rules (rule_name, rule_type, threshold_value, applies_to, auto_approve, requires_note)
VALUES 
('Global Tax Rounding', 'absolute', 1.00, 'ALL', TRUE, TRUE),
('Currency Decimal Mismatch', 'absolute', 0.10, 'ALL', TRUE, TRUE),
('Minor Price Variance', 'percentage', 0.005, 'ALL', TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- 3. Create payout_schedule table
CREATE TABLE IF NOT EXISTS payout_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_id BIGINT REFERENCES reconciliations(id),
    po_number TEXT,
    invoice_number TEXT,
    supplier_email TEXT,
    vendor_name TEXT,
    payout_amount DECIMAL NOT NULL,
    invoice_date DATE,
    due_date DATE,
    payment_terms TEXT,
    status TEXT DEFAULT 'Scheduled', -- Scheduled, Reminder Sent, Paid, Overdue, Early Payment Requested
    reminder_3day_sent BOOLEAN DEFAULT FALSE,
    reminder_1day_sent BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    paid_by TEXT,
    notes TEXT,
    early_payment_eligible BOOLEAN DEFAULT FALSE,
    early_payment_offer_expires_at TIMESTAMP WITH TIME ZONE,
    early_payment_accepted_at TIMESTAMP WITH TIME ZONE,
    early_payment_amount DECIMAL,
    early_payment_discount DECIMAL,
    early_payment_discount_rate DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MVP 8: Bank Mock and Hold Dates
ALTER TABLE payout_schedules 
  ADD COLUMN IF NOT EXISTS hold_until_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bank_transaction_ref TEXT;

CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_ref UUID REFERENCES payout_schedules(id),
    nestle_account_number TEXT DEFAULT 'NESTLE-CORP-9988',
    supplier_account_number TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    transfer_date TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'Success'
);