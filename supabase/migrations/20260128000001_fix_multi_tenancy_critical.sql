-- Migration: Fix Critical Multi-Tenancy Failure (RLS Recursion)
-- Date: 2026-01-28
-- Description: 
-- 1. Redefines public.get_my_tenant_id() with SECURITY DEFINER to strictly bypass RLS during tenant lookup.
-- 2. Resets public.users RLS policies to a single, strict "Tenant Isolation" policy.

-- 1. Fix the Function (Break Recursion)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER -- CRITICAL: Runs with owner permissions to bypass RLS
SET search_path = public, auth
STABLE
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$;

-- 2. Cleanup ANY existing confused policies
DROP POLICY IF EXISTS "Allow auth select all" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.users;
DROP POLICY IF EXISTS "Enable read for all users" ON public.users;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.users;

-- 3. Apply Strict Tenant Isolation
-- Logic:
-- A. Users must ALWAYS be able to see their own record (id = auth.uid()) to bootstrap.
-- B. Once authenticated, they can see other users in their tenant.
-- Note: get_my_tenant_id() now works safely inside this policy because it is SECURITY DEFINER.
CREATE POLICY "Tenant Isolation" ON public.users 
FOR ALL USING (
    id = auth.uid() 
    OR 
    tenant_id = public.get_my_tenant_id()
);
