-- MIGRATION: Organization Settings
-- Purpose: Centralized configuration for branding, rates, and alerts.

-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.organization_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) UNIQUE, -- One settings row per tenant
    company_name TEXT DEFAULT 'Ali Gas  ',
    company_address TEXT,
    company_phone TEXT,
    invoice_footer TEXT DEFAULT 'Thank you for your business!',
    default_gas_rate NUMERIC DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 2. Enable RLS
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Policy: View Own Settings
CREATE POLICY "View Own Settings" ON public.organization_settings
    FOR SELECT
    USING (tenant_id = public.get_my_tenant_id());

-- Policy: Update Own Settings
CREATE POLICY "Update Own Settings" ON public.organization_settings
    FOR UPDATE
    USING (tenant_id = public.get_my_tenant_id());

-- Policy: Insert Own Settings (Usually handled by trigger, but allow if needed for initialization)
CREATE POLICY "Insert Own Settings" ON public.organization_settings
    FOR INSERT
    WITH CHECK (tenant_id = public.get_my_tenant_id());


-- 4. Auto-Seed Trigger (When a new Tenant is created)
CREATE OR REPLACE FUNCTION public.seed_org_settings()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.organization_settings (tenant_id, company_name)
  VALUES (NEW.id, 'My Organization')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on Tenants table
DROP TRIGGER IF EXISTS seed_org_settings_trigger ON public.tenants;
CREATE TRIGGER seed_org_settings_trigger
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE PROCEDURE public.seed_org_settings();

-- 5. Backfill Existing Tenants
INSERT INTO public.organization_settings (tenant_id, company_name)
SELECT id, name FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;
