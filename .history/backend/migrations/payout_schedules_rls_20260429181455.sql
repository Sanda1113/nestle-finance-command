-- 1. Create the payout_schedules table
CREATE TABLE IF NOT EXISTS payout_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- The "Golden Thread" References
    invoice_ref UUID,                  -- FK to invoices/reconciliations
    po_ref UUID,                       -- FK to purchase_orders
    boq_ref UUID,                      -- FK to boqs
    
    -- Core Data
    supplier_email TEXT NOT NULL,
    title TEXT NOT NULL,
    
    -- Calendar & Financial Data
    start_date TIMESTAMPTZ NOT NULL,   -- Represents the exact scheduled_date
    end_date TIMESTAMPTZ,              -- Used for calendar UI spanning
    base_amount NUMERIC NOT NULL,      -- The original 3-way matched amount
    final_amount NUMERIC NOT NULL,     -- The amount after dynamic discounting
    
    -- Lifecycle Tracking
    status TEXT DEFAULT 'Pending Finance', -- 'Pending Finance', 'Scheduled', 'Renegotiated', 'Paid'
    proof_document_url TEXT,           -- Link to the generated 'Promise to Pay' PDF
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (RLS) on the table
ALTER TABLE payout_schedules ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policy for Suppliers (SELECT)
-- Ensures suppliers can only view their own payout schedule events.
CREATE POLICY "Suppliers can view their own payouts"
ON payout_schedules
FOR SELECT
USING (
    supplier_email = auth.jwt()->>'email'
);

-- 4. Create RLS Policy for Suppliers (UPDATE - MVP 7 Dynamic Discounting)
-- Allows suppliers to update their own payout if they accept an early payment offer.
CREATE POLICY "Suppliers can update their own payouts"
ON payout_schedules
FOR UPDATE
USING (
    supplier_email = auth.jwt()->>'email'
)
WITH CHECK (
    supplier_email = auth.jwt()->>'email'
);

-- 5. Create RLS Policy for Finance 
-- Allows finance users full CRUD access directly via the Supabase client.
CREATE POLICY "Finance can manage all payouts"
ON payout_schedules
FOR ALL
USING (
    auth.jwt()->>'role' = 'finance'
);
