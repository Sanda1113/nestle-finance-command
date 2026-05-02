-- SQL Migration: Add 'procurement' to all role-based check constraints (Revised with 'System' role)

DO $$
BEGIN
    -- 1. app_users table (Authentication Roles)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_users_role_check') THEN
        ALTER TABLE app_users DROP CONSTRAINT app_users_role_check;
    END IF;
    ALTER TABLE app_users ADD CONSTRAINT app_users_role_check 
    CHECK (role IN ('supplier', 'finance', 'warehouse', 'admin', 'procurement'));

    -- 2. notifications table (UI Alerts)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_role_check') THEN
        ALTER TABLE notifications DROP CONSTRAINT notifications_user_role_check;
    END IF;
    ALTER TABLE notifications ADD CONSTRAINT notifications_user_role_check 
    CHECK (user_role IN ('Supplier', 'Finance', 'Warehouse', 'Admin', 'Procurement', 'System', 'supplier', 'finance', 'warehouse', 'admin', 'procurement', 'system'));

    -- 3. disputes table (Audit Log / Chat)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disputes_sender_role_check') THEN
        ALTER TABLE disputes DROP CONSTRAINT disputes_sender_role_check;
    END IF;
    ALTER TABLE disputes ADD CONSTRAINT disputes_sender_role_check 
    CHECK (sender_role IN ('Supplier', 'Finance', 'Warehouse', 'Admin', 'Procurement', 'System', 'supplier', 'finance', 'warehouse', 'admin', 'procurement', 'system'));

    RAISE NOTICE '✅ Role-based check constraints updated successfully to include procurement and system roles.';
END $$;
