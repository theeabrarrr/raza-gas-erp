-- Migration: Critical Fixes (Security & Logic)
-- Date: 2026-01-26
-- Description:
-- 1. FIX: Redefines get_my_tenant_id to avoid search_path permission errors.
-- 2. Reverts 'cylinders' RLS to strict Iron Dome policy.
-- 3. Updates 'process_trip_returns' to handle explicit return items.
-- 4. Adds 'verification_status' to 'company_ledger'.

-- 0. HOTFIX: Redefine helper to avoid "permission denied for schema auth"
-- We remove "SET search_path = public, auth" because auth.uid() is already fully qualified.
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
-- Removed SET search_path to prevent permissions error on Transaction Poolers
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$;

-- 1. SECURITY: Revert Cylinders RLS to Iron Dome
-- Drop permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON cylinders;
DROP POLICY IF EXISTS "Enable insert access for all users" ON cylinders;
DROP POLICY IF EXISTS "Enable update access for all users" ON cylinders;

-- Re-apply strict tenant isolation
DROP POLICY IF EXISTS "Tenant Isolation" ON cylinders;
CREATE POLICY "Tenant Isolation" ON cylinders
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id());

-- Helper to get specific cylinders for a trip (for UI reconciliation)
CREATE OR REPLACE FUNCTION get_trip_cylinders(p_trip_id UUID)
RETURNS TABLE (
    cylinder_id UUID,
    serial_number TEXT,
    size TEXT,
    current_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.serial_number,
        c.size,
        c.status
    FROM cylinders c
    JOIN orders o ON c.last_order_id = o.id
    JOIN trips t ON t.id = p_trip_id
    WHERE o.driver_id = t.driver_id
      AND o.status = 'completed'
      AND o.trip_started_at >= t.start_time
      AND o.trip_completed_at <= coalesce(t.end_time, now())
      AND c.tenant_id = public.get_my_tenant_id();
END;
$$;

-- 2. LOGIC: Update process_trip_returns
DROP FUNCTION IF EXISTS process_trip_returns(uuid);

CREATE OR REPLACE FUNCTION process_trip_returns(
    p_trip_id UUID,
    p_returned_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_cylinder_id UUID;
    v_new_status TEXT;
    v_count INT := 0;
BEGIN
    -- Loop through the returned items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_returned_items)
    LOOP
        v_cylinder_id := (v_item->>'id')::UUID;
        v_new_status := v_item->>'status';
        
        -- Validate Status
        IF v_new_status NOT IN ('empty', 'full', 'defective') THEN
            v_new_status := 'empty'; -- Default fallback
        END IF;

        -- Update Cylinder
        UPDATE cylinders
        SET 
            current_location_type = 'godown',
            status = v_new_status,
            updated_at = NOW()
        WHERE id = v_cylinder_id
          AND tenant_id = public.get_my_tenant_id(); -- Security Check
        
        IF FOUND THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- Mark Trip as Verified
    UPDATE trips 
    SET returns_verified = true 
    WHERE id = p_trip_id
      AND tenant_id = public.get_my_tenant_id();

    RETURN jsonb_build_object(
        'success', true,
        'trip_id', p_trip_id,
        'cylinders_processed', v_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 3. LOGIC: Add verification_status to company_ledger
ALTER TABLE company_ledger 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' 
CHECK (verification_status IN ('pending', 'verified', 'rejected'));

-- Update existing rows to 'verified'
UPDATE company_ledger SET verification_status = 'verified' WHERE verification_status = 'pending';

-- 4. LOGIC: Update handle_new_user to capture vehicle_number
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_public_user_id UUID;
    v_tenant_id UUID;
    v_full_name TEXT;
    v_role TEXT;
    v_vehicle_number TEXT;
BEGIN
    -- Extract Metadata safely
    v_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;
    v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'New User');
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'driver');
    v_vehicle_number := new.raw_user_meta_data->>'vehicle_number';

    -- 1. Insert/Link Public User
    INSERT INTO public.users (
        email, name, role, tenant_id, auth_id, phone_number
    )
    VALUES (
        new.email, v_full_name, v_role, v_tenant_id, new.id, new.raw_user_meta_data->>'phone_number'
    )
    ON CONFLICT (email) DO UPDATE SET 
        auth_id = new.id,
        updated_at = NOW()
    RETURNING id INTO v_public_user_id;

    -- 2. Create Profile
    INSERT INTO public.profiles (id, full_name, role, tenant_id, phone_number, vehicle_number)
    VALUES (
        v_public_user_id, v_full_name, v_role, v_tenant_id, new.raw_user_meta_data->>'phone_number', v_vehicle_number
    )
    ON CONFLICT (id) DO UPDATE SET
        vehicle_number = EXCLUDED.vehicle_number;

    -- 3. Create Wallet
    INSERT INTO public.employee_wallets (user_id, balance, tenant_id)
    VALUES (
        v_public_user_id, 0, v_tenant_id
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
