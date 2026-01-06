-- IRON DOME SECURITY MIGRATION
-- Switches RLS from DB-lookup to stateless JWT Metadata check for critical tables.

-- 1. Customers
DROP POLICY IF EXISTS "Tenant Isolation" ON public.customers;

CREATE POLICY "Tenant Isolation" ON public.customers
FOR ALL
USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
)
WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
);

-- 2. Orders
DROP POLICY IF EXISTS "Tenant Isolation" ON public.orders;

CREATE POLICY "Tenant Isolation" ON public.orders
FOR ALL
USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
)
WITH CHECK (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
);

-- Note: This ensures that even if the Application Code fails to filter (Lock 1),
-- the Database (Lock 2) rejects access if the JWT doesn't match.
-- Code explicitly overrides tenant_id, so the WITH CHECK should pass valid writes.
