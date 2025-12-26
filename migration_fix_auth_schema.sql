-- CRITICAL FIX: Auth Schema & Permissions
-- Run this in Supabase SQL Editor

-- 1. Force Schema Cache Reload (Often the culprit)
NOTIFY pgrst, 'reload config';

-- 2. Grant Permissions to System Roles (Ensures Auth can access Public if needed via Triggers)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

-- 3. Fix Search Paths (Ensures 'public' is found)
ALTER ROLE authenticated SET search_path = "$user", public;
ALTER ROLE service_role SET search_path = "$user", public;

-- 4. Enable crypto (Just in case Auth relies on it and it was dropped)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 5. Basic RLS for Users (Ensure it exists and is open for reading self)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.users FOR SELECT 
USING ( true );

-- 6. Trigger Safety Check (Optional - disabling this common trouble-maker if it exists and is broken)
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 7. Grant to Auth System (Sometimes needed for triggers)
GRANT ALL ON public.users TO postgres;
