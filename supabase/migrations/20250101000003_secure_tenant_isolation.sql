-- Secure Helper Function to get Tenant ID without Recursion
-- This function runs with "SECURITY DEFINER" privileges, meaning it bypasses RLS.
-- This allows us to look up the user's tenant_id safely inside an RLS policy.

CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cylinders ENABLE ROW LEVEL SECURITY;

-- Reset Policies
DROP POLICY IF EXISTS "Tenant Isolation" ON public.users;
DROP POLICY IF EXISTS "Cylinder Isolation" ON public.cylinders;

-- USERS POLICY
CREATE POLICY "Tenant Isolation" ON public.users
FOR ALL
TO authenticated
USING (
    -- 1. My Tenant matches the row's Tenant
    tenant_id = public.get_auth_tenant_id()
    OR
    -- 2. I am the System Owner
    public.get_auth_tenant_id() = '00000000-0000-0000-0000-000000000000'
);

-- CYLINDERS POLICY
CREATE POLICY "Cylinder Isolation" ON public.cylinders
FOR ALL
TO authenticated
USING (
    tenant_id = public.get_auth_tenant_id()
    OR
    public.get_auth_tenant_id() = '00000000-0000-0000-0000-000000000000'
);
