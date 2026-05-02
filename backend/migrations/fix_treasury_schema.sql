-- SQL Migration: Add missing columns and tables for Treasury Dashboard

DO $$
BEGIN
    -- 1. Add early_payout_requested to payout_schedules if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payout_schedules' AND column_name = 'early_payout_requested') THEN
        ALTER TABLE payout_schedules ADD COLUMN early_payout_requested BOOLEAN DEFAULT FALSE;
    END IF;

    -- Also check payout_schedule (singular) just in case
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_schedule') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payout_schedule' AND column_name = 'early_payout_requested') THEN
            ALTER TABLE payout_schedule ADD COLUMN early_payout_requested BOOLEAN DEFAULT FALSE;
        END IF;
    END IF;

    -- 2. Create treasury_settings table
    CREATE TABLE IF NOT EXISTS treasury_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT UNIQUE NOT NULL,
        value_numeric DECIMAL,
        value_text TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 3. Insert default monthly_early_payout_cap
    INSERT INTO treasury_settings (key, value_numeric)
    VALUES ('monthly_early_payout_cap', 5000000)
    ON CONFLICT (key) DO NOTHING;

    RAISE NOTICE '✅ Treasury Dashboard schema updated successfully.';
END $$;
