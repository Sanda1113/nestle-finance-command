-- Fix NOT NULL constraint violations on legacy columns

DO $$
BEGIN
    BEGIN
        ALTER TABLE payout_schedules ALTER COLUMN payout_amount DROP NOT NULL;
    EXCEPTION
        WHEN undefined_column THEN null;
    END;
    
    BEGIN
        ALTER TABLE payout_schedules ALTER COLUMN amount DROP NOT NULL;
    EXCEPTION
        WHEN undefined_column THEN null;
    END;
END $$;
