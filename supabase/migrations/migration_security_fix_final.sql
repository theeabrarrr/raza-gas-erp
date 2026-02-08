-- SECURITY FIX V2: Apply Strict Tenant Isolation and RLS Policies
-- Fully Idempotent & Qualified Names
-- Executed Successfully on 2026-02-07

SET search_path = public;

-- ---------------------------------------------------------
-- 1. Users Table RLS
-- ---------------------------------------------------------

-- Drop old policies
DROP POLICY IF EXISTS "Users can view same tenant" ON public.users;
DROP POLICY IF EXISTS "Public Read Users" ON public.users;
DROP POLICY IF EXISTS "Authenticated can view all profiles" ON public.users;

-- Drop NEW policies (if partially applied)
DROP POLICY IF EXISTS "users_select_same_tenant" ON public.users;
DROP POLICY IF EXISTS "users_insert_same_tenant" ON public.users;
DROP POLICY IF EXISTS "users_update_same_tenant" ON public.users;
DROP POLICY IF EXISTS "users_delete_same_tenant" ON public.users;

-- Create strict policies
CREATE POLICY "users_select_same_tenant" ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users AS u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
    OR
    (
      tenant_id IN (
        SELECT u.tenant_id FROM public.users AS u WHERE u.id = auth.uid()
      )
    )
  );

CREATE POLICY "users_insert_same_tenant" ON public.users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
    AND
    (
      tenant_id IN (SELECT u.tenant_id FROM public.users AS u WHERE u.id = auth.uid())
      OR
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
    )
  );

CREATE POLICY "users_update_same_tenant" ON public.users
  FOR UPDATE
  USING (
    id = auth.uid()
    OR
    (
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
      )
      AND
      tenant_id IN (
        SELECT u.tenant_id FROM public.users AS u WHERE u.id = auth.uid()
      )
    )
  );

CREATE POLICY "users_delete_same_tenant" ON public.users
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
    AND
    tenant_id IN (
      SELECT u.tenant_id FROM public.users AS u WHERE u.id = auth.uid()
    )
  );

-- ---------------------------------------------------------
-- 2. Employee Wallets RLS
-- ---------------------------------------------------------

-- Drop insecure policies
DROP POLICY IF EXISTS "Public Read Wallets" ON public.employee_wallets;
DROP POLICY IF EXISTS "Public Update Wallets" ON public.employee_wallets;
DROP POLICY IF EXISTS "Public Insert Wallets" ON public.employee_wallets;
DROP POLICY IF EXISTS "Users can view own wallet" ON public.employee_wallets;
DROP POLICY IF EXISTS "Admins can view all wallets" ON public.employee_wallets;

-- Drop NEW policies
DROP POLICY IF EXISTS "wallet_select_own_or_admin" ON public.employee_wallets;
DROP POLICY IF EXISTS "wallet_update_system_only" ON public.employee_wallets;
DROP POLICY IF EXISTS "wallet_insert_system_only" ON public.employee_wallets;

-- Secure wallet access policies
CREATE POLICY "wallet_select_own_or_admin" ON public.employee_wallets
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.users AS u1
      JOIN public.users AS u2 ON u1.tenant_id = u2.tenant_id
      WHERE u1.id = auth.uid() 
      AND u1.role IN ('admin', 'super_admin')
      AND u2.id = public.employee_wallets.user_id
    )
  );

CREATE POLICY "wallet_update_system_only" ON public.employee_wallets
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "wallet_insert_system_only" ON public.employee_wallets
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.users WHERE role IN ('admin', 'super_admin')
    )
  );

-- ---------------------------------------------------------
-- 3. Handover Logs RLS
-- ---------------------------------------------------------

-- Drop insecure policies
DROP POLICY IF EXISTS "Public Read Handovers" ON public.handover_logs;
DROP POLICY IF EXISTS "Public Insert Handovers" ON public.handover_logs;
DROP POLICY IF EXISTS "Public Update Handovers" ON public.handover_logs;

-- Drop NEW policies
DROP POLICY IF EXISTS "handover_select_involved_or_admin" ON public.handover_logs;
DROP POLICY IF EXISTS "handover_insert_sender" ON public.handover_logs;
DROP POLICY IF EXISTS "handover_update_admin_verify" ON public.handover_logs;

-- Secure handover access policies
CREATE POLICY "handover_select_involved_or_admin" ON public.handover_logs
  FOR SELECT
  USING (
    sender_id = auth.uid()
    OR
    receiver_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.users AS u1
      JOIN public.users AS u2 ON u1.tenant_id = u2.tenant_id
      WHERE u1.id = auth.uid() 
      AND u1.role IN ('admin', 'super_admin')
      AND u2.id = public.handover_logs.sender_id
    )
  );

CREATE POLICY "handover_insert_sender" ON public.handover_logs
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
  );

CREATE POLICY "handover_update_admin_verify" ON public.handover_logs
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT u1.id FROM public.users AS u1
      JOIN public.users AS u2 ON u1.tenant_id = u2.tenant_id
      WHERE u1.role IN ('admin', 'super_admin')
      AND u2.id = public.handover_logs.sender_id
    )
  );
