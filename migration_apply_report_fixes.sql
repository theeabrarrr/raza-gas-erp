-- CRITICAL FIXES FOR RAZA GAS ERP
-- Run this script in the Supabase SQL Editor to apply the "Resolution Report" fixes.

-- SECTION 1: DATABASE INTEGRITY (Stop Duplicate Users)
-- We use a DO block to safely add constraints only if they don't exist.
DO $$
BEGIN
    -- 1. Unique Email Constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;

    -- 2. Unique Phone Constraint (Best Practice for this ERP)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_key') THEN
        -- Only if phone column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone') THEN
            ALTER TABLE public.users ADD CONSTRAINT users_phone_key UNIQUE (phone);
        END IF;
    END IF;
END $$;

-- SECTION 2: ACCESS PERMISSIONS (Fix "Database error querying schema")
-- This explicitly configures the 'authenticated' role (logged-in users) to see the 'public' schema.

-- A. Reset Search Path
ALTER ROLE authenticated SET search_path = "$user", public, auth;
ALTER ROLE service_role SET search_path = "$user", public, auth;

-- B. Grant Broad Config Permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- C. Specific fixes for common tables (just in case)
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, UPDATE ON public.employee_wallets TO authenticated;

-- SECTION 3: RELOAD CONFIG
-- This forces the API to pick up the new Search Path immediately.
NOTIFY pgrst, 'reload config';
