-- Migration: Audit Performance Fixes
-- Date: 2026-01-28
-- Description: 
-- 1. Adds missing indexes to tenant_id columns (CRITICAL for RLS performance).
-- 2. Adds missing indexes to Foreign Keys (orders.created_by, etc.).
-- 3. Marks RLS helper functions as STABLE to reduce function call overhead.

-- 1. INDEX tenant_id ON ALL TABLES
-- These are used in every RLS policy, so they must be indexed.
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON public.orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cylinders_tenant_id ON public.cylinders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trips_tenant_id ON public.trips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_wallets_tenant_id ON public.employee_wallets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_handover_logs_tenant_id ON public.handover_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON public.transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_ledger_tenant_id ON public.company_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON public.expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);

-- 2. INDEX OTHER FOREIGN KEYS
-- Postgres does not index FKs automatically.
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders(created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver_id ON public.transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_company_ledger_admin_id ON public.company_ledger(admin_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);

-- 3. OPTIMIZE RLS HELPER FUNCTIONS
-- Mark them as STABLE so Postgres knows they don't change within a statement.
-- This allows the optimizer to call them once per query instead of once per row!

-- Re-declaring get_my_tenant_id with STABLE
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT tenant_id FROM public.users WHERE id = (current_setting('request.jwt.claim.sub', true)::uuid);
$$;

-- Re-declaring get_auth_tenant_id with STABLE
-- (Used in some older policies, keeping it consistent)
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;
