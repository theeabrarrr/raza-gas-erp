-- FIX: RLS Policies for Employee Wallets and Users
-- Run this in Supabase SQL Editor

-- 1. Enable RLS on Wallets
ALTER TABLE public.employee_wallets ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Users can view their OWN wallet
DROP POLICY IF EXISTS "Users can view own wallet" ON public.employee_wallets;
CREATE POLICY "Users can view own wallet"
ON public.employee_wallets
FOR SELECT
USING (auth.uid() = user_id);

-- 3. Policy: Admin/Managers can view ALL wallets
DROP POLICY IF EXISTS "Admins can view all wallets" ON public.employee_wallets;
CREATE POLICY "Admins can view all wallets"
ON public.employee_wallets
FOR ALL
USING (
  exists (
    select 1 from public.users 
    where id = auth.uid() 
    and role in ('admin', 'manager', 'owner', 'cashier')
  )
);

-- 4. Ensure public.users columns are accessible (Usually fine, but strict RLS might block updates)
-- Allow users to update their own 'is_online' status
DROP POLICY IF EXISTS "Users can update own status" ON public.users;
CREATE POLICY "Users can update own status"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. Grant permissions to service roles (just in case)
GRANT ALL ON public.employee_wallets TO postgres;
GRANT ALL ON public.employee_wallets TO service_role;
GRANT ALL ON public.employee_wallets TO authenticated;
