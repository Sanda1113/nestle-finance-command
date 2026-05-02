-- SQL Migration: Add 'procurement' to all role-based check constraints

DO $$
BEGIN
    -- 1. app_users table
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_users_role_check') THEN
        ALTER TABLE app_users DROP CONSTRAINT app_users_role_check;
    END IF;
    ALTER TABLE app_users ADD CONSTRAINT app_users_role_check 
    CHECK (role IN ('supplier', 'finance', 'warehouse', 'admin', 'procurement'));

    -- 2. notifications table
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_role_check') THEN
        ALTER TABLE notifications DROP CONSTRAINT notifications_user_role_check;
    END IF;
    -- Note: Many systems use lowercase for backend constraints, adding both for safety
    ALTER TABLE notifications ADD CONSTRAINT notifications_user_role_check 
    CHECK (user_role IN ('Supplier', 'Finance', 'Warehouse', 'Admin', 'Procurement', 'supplier', 'finance', 'warehouse', 'admin', 'procurement'));

    -- 3. disputes table (sender_role)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disputes_sender_role_check') THEN
        ALTER TABLE disputes DROP CONSTRAINT disputes_sender_role_check;
    END IF;
    ALTER TABLE disputes ADD CONSTRAINT disputes_sender_role_check 
    CHECK (sender_role IN ('Supplier', 'Finance', 'Warehouse', 'Admin', 'Procurement', 'supplier', 'finance', 'warehouse', 'admin', 'procurement'));

    RAISE NOTICE '✅ Role-based check constraints updated successfully to include procurement role.';
END $$;
