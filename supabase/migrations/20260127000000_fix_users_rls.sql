-- Migration: Fix Invisible Staff Issue (RLS Recursion)
-- Date: 2026-01-27
-- Description: 
-- 1. Drops conflicting/permissive policies on public.users.
-- 2. Creates a strict "Tenant Isolation" policy that breaks RLS recursion by explicitly allowing self-access.

-- 1. Cleanup Conflicting Policies
DROP POLICY IF EXISTS "Allow auth select all" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.users;
DROP POLICY IF EXISTS "Enable read for all users" ON public.users;
DROP POLICY IF EXISTS "Tenant Isolation" ON public.users;

-- 2. Create Corrected Policy
-- Logic: 
-- A. User can ALWAYS see their own record (id = auth.uid()) -> Resolves recursion
-- B. User can see other users in their tenant -> (tenant_id = public.get_my_tenant_id())
CREATE POLICY "Tenant Isolation" ON public.users 
FOR ALL USING (
    id = auth.uid() 
    OR 
    tenant_id = public.get_my_tenant_id()
);
