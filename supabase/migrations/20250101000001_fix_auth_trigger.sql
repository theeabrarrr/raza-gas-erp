-- REPLACES the old handler to strictly enforce tenant_id from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, shift, status, tenant_id)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'New Employee'),
    COALESCE(new.raw_user_meta_data->>'role', 'driver'),
    COALESCE(new.raw_user_meta_data->>'shift', 'Day'),
    'active',
    (new.raw_user_meta_data->>'tenant_id')::uuid -- CRITICAL: Reads tenant_id passed by Admin
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
