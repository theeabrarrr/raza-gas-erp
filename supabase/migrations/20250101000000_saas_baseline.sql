-- SAAS BASELINE MIGRATION
-- Enables Multi-Tenancy, RLS, and Auth Isolation

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CREATE TENANTS TABLE
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    subscription_plan TEXT DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 3. INSERT DEFAULT TENANT (Raza Gas)
-- Uses a static UUID to ensure consistency across environments
INSERT INTO public.tenants (id, name, subscription_plan)
VALUES ('11111111-1111-1111-1111-111111111111', 'Raza Gas', 'enterprise')
ON CONFLICT (id) DO NOTHING;

-- 4. ADD tenant_id COLUMN TO ALL TABLES
DO $$ 
DECLARE
    t_name text;
BEGIN 
    -- List of tables that require multi-tenancy
    FOR t_name IN 
        SELECT unnest(ARRAY['users', 'orders', 'cylinders', 'customers', 'trips', 'employee_wallets', 'handover_logs', 'transactions'])
    LOOP
        -- Add column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t_name AND column_name = 'tenant_id') THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id UUID REFERENCES public.tenants(id)', t_name);
            
            -- Backfill existing data to Raza Gas
            EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', t_name, '11111111-1111-1111-1111-111111111111');
            
            -- Enforce NOT NULL after backfill
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t_name);
        END IF;
    END LOOP;
END $$;

-- 5. RLS BYPASS FUNCTION ("Secret Tunnel")
-- Allows Auth triggers to lookup tenant_id without recursion
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$;

-- 6. ENABLE RLS & APPLY POLICIES
DO $$ 
DECLARE
    t_name text;
BEGIN 
    FOR t_name IN 
        SELECT unnest(ARRAY['users', 'orders', 'cylinders', 'customers', 'trips', 'employee_wallets', 'handover_logs', 'transactions'])
    LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_name);
        
        -- Drop existing policies to prevent conflicts
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t_name);
        
        -- Create Standard Isolation Policy
        -- Users can only see rows where tenant_id matches their own tenant_id
        EXECUTE format('CREATE POLICY "Tenant Isolation" ON public.%I FOR ALL USING (tenant_id = public.get_my_tenant_id())', t_name);
    END LOOP;
END $$;

-- 7. SPECIAL POLICY FOR USERS TABLE (Recursion Fix)
-- Users need to read their own record to find their tenant_id
DROP POLICY IF EXISTS "Tenant Isolation" ON public.users;
CREATE POLICY "Tenant Isolation" ON public.users 
FOR ALL USING (
    id = auth.uid() OR tenant_id = public.get_my_tenant_id()
);

-- 8. TRIGGER: AUTO-ASSIGN TENANT ID ON INSERT
-- Ensures that new rows automatically inherit the user's tenant_id
CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_my_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to all tables
DO $$
DECLARE
    t_name text;
BEGIN
    FOR t_name IN 
        SELECT unnest(ARRAY['orders', 'cylinders', 'customers', 'trips', 'employee_wallets', 'handover_logs', 'transactions'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_tenant_id_trigger ON public.%I', t_name);
        EXECUTE format('CREATE TRIGGER set_tenant_id_trigger BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE PROCEDURE public.set_tenant_id()', t_name);
    END LOOP;
END $$;
