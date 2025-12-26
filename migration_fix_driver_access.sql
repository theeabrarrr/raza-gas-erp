-- CRITICAL FIX: Driver Access & Permissions
-- Run this in Supabase SQL Editor

-- 1. Grant Base Permissions to Authenticated Users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 2. Ensure RLS is Enabled (Safety)
ALTER TABLE public.employee_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Fix Wallet RLS (Broaden for reading)
DROP POLICY IF EXISTS "Users can view own wallet" ON public.employee_wallets;
CREATE POLICY "Users can view own wallet"
ON public.employee_wallets FOR SELECT
TO authenticated
USING (
  -- User can see their own wallet OR is an Admin/Manager/Cashier
  user_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'manager', 'owner', 'cashier')
  )
);

-- 4. Fix Users RLS (Allow reading basic profile info for joining)
-- Drivers often need to join 'users' for name display in dropdowns
DROP POLICY IF EXISTS "Authenticated can view all profiles" ON public.users;
CREATE POLICY "Authenticated can view all profiles"
ON public.users FOR SELECT
TO authenticated
USING (true); -- Allow all authenticated users to read names/roles (safe for internal ERP)

-- 5. Fix Trips/Orders RLS (Ensure Drivers can see their stuff)
-- (Assuming existing policies might be too strict)
DROP POLICY IF EXISTS "Drivers can view assigned trips" ON public.trips;
CREATE POLICY "Drivers can view assigned trips"
ON public.trips FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid() 
  OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager', 'owner'))
);

DROP POLICY IF EXISTS "Drivers can view assigned orders" ON public.orders;
CREATE POLICY "Drivers can view assigned orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  driver_id = auth.uid() 
  OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager', 'owner'))
);
