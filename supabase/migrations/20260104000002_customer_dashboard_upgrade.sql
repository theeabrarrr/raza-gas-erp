-- Upgrade: Customer Dashboard Features
-- Adds is_active and last_order_at columns
-- Safe migration: IDEMPOTENT

-- 1. Add is_active column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'is_active') THEN
        ALTER TABLE customers ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- 2. Add last_order_at column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'last_order_at') THEN
        ALTER TABLE customers ADD COLUMN last_order_at TIMESTAMPTZ;
    END IF;
END $$;
