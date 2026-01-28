-- Migration: Secure Profiles & Sync Tenant Data
-- Date: 2026-01-28
-- Description: 
-- 1. Syncs tenant_id from users to profiles to ensure data integrity.
-- 2. Enables RLS on public.profiles.
-- 3. Applies strict "Tenant Isolation" policy to profiles using the secure get_my_tenant_id() function.

-- 1. Sync Data (Fix broken relationships)
UPDATE public.profiles p
SET tenant_id = u.tenant_id
FROM public.users u
WHERE p.id = u.id
AND (p.tenant_id IS DISTINCT FROM u.tenant_id);

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Cleanup Old Policies (Safety Measure)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.profiles;

-- 4. Create Strict Tenant Policy
-- Logic:
-- A. User can see their own profile.
-- B. User can see profiles of other users in the SAME tenant.
CREATE POLICY "Tenant Isolation" ON public.profiles
FOR ALL USING (
  id = auth.uid()
  OR
  tenant_id = public.get_my_tenant_id()
);

-- 5. Grant Access (Ensure roles have permission)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO service_role;
