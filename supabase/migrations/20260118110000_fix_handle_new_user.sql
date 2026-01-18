CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_public_user_id UUID;
    v_tenant_id UUID;
    v_full_name TEXT;
    v_role TEXT;
BEGIN
    -- Extract Metadata safely
    v_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;
    v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'New User');
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'driver');

    -- 1. Insert/Link Public User
    -- We try to find a public user by EMAIL. 
    -- If found, we UPDATE the auth_id to link them.
    -- If not found, we INSERT a new one.
    INSERT INTO public.users (
        email, 
        name, 
        role, 
        tenant_id, 
        auth_id,
        phone_number -- Sync phone if available
    )
    VALUES (
        new.email,
        v_full_name,
        v_role, -- Assuming specific cast not needed if column is text, else ::user_role
        v_tenant_id,
        new.id,
        new.raw_user_meta_data->>'phone_number'
    )
    ON CONFLICT (email) DO UPDATE SET 
        auth_id = new.id,          -- CRITICAL: Repair the link
        updated_at = NOW()
    RETURNING id INTO v_public_user_id;

    -- 2. Create Profile
    -- Uses the v_public_user_id (which satisfies the FK to public.users)
    INSERT INTO public.profiles (id, full_name, role, tenant_id, phone_number)
    VALUES (
        v_public_user_id,
        v_full_name,
        v_role,
        v_tenant_id,
        new.raw_user_meta_data->>'phone_number'
    )
    ON CONFLICT (id) DO NOTHING; 
    -- If profile exists, we assume it's fine.

    -- 3. Create Wallet
    -- Also uses v_public_user_id
    INSERT INTO public.employee_wallets (user_id, balance, tenant_id)
    VALUES (
        v_public_user_id,
        0,
        v_tenant_id
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
