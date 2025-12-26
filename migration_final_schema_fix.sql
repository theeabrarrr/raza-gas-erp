-- FINAL FIX: Zero-Ambiguity Schema Resolution
-- Run this in Supabase SQL Editor

-- 1. RESET SEARCH PATHS (The Core Fix)
-- Ensure 'public' is explicitly in the path, but "$user" is first (standard).
-- We remove ambiguity by ensuring the role knows exactly where to look.
ALTER ROLE authenticated SET search_path = "$user", public, auth;
ALTER ROLE service_role SET search_path = "$user", public, auth;

-- 2. GRANT PERMISSIONS (The Access Fix)
-- Ensure explicit access to the 'public' schema and key tables.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant access to 'public.users' specifically (resolves the public vs auth confusion)
GRANT SELECT ON TABLE public.users TO authenticated;
GRANT SELECT ON TABLE public.employee_wallets TO authenticated;

-- 3. ENSURE TRIGGERS ARE GONE (The Transaction Fix)
-- Double-check that no broken triggers are interrupting the login.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- 4. RELOAD CONFIGURATION (The Application Fix)
-- Force PostgREST to pick up these new search paths permissions.
NOTIFY pgrst, 'reload config';
