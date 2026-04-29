const fs = require('fs');
let content = fs.readFileSync('backend/migrations/supabase_migrations.sql', 'utf8');
content += `

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
);`;
fs.writeFileSync('backend/migrations/supabase_migrations.sql', content);
