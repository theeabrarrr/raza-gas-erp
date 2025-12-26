-- EMERGENCY DEBUG: Drop Auth Triggers
-- Run this in Supabase SQL Editor

-- 1. Drop common triggers that might be breaking the Login Transaction
-- (When you login, Supabase updates 'last_sign_in_at', which fires UPDATE triggers)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users; -- Some setups use this
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- 2. Drop the functions they might call (Optional, but good for cleanup if broken)
-- DROP FUNCTION IF EXISTS public.handle_new_user(); 
-- (Commented out: simpler to just drop the trigger first)

-- 3. Double-Check Permissions (Again)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;

-- 4. Reload Schema Cache (Again, mandatory after Trigger changes)
NOTIFY pgrst, 'reload config';
