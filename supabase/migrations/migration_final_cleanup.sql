-- FINAL CLEANUP: Add Shifts, Clean Names, Sync Logins
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Schema Migration: Add Shift Column
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS shift text CHECK (shift IN ('Day', 'Night', 'Any')) DEFAULT 'Any';

DO $$
DECLARE
  r RECORD;
  clean_name text;
  new_email text;
  user_shift text;
  raw_name text;
BEGIN
  -- Loop through ALL users in public.users to clean/sync them
  FOR r IN SELECT * FROM public.users LOOP
    raw_name := r.name;
    user_shift := 'Any';
    
    -- 2. Logic: Extract Shift
    IF raw_name ILIKE '%(Day)%' THEN
      user_shift := 'Day';
    ELSIF raw_name ILIKE '%(Night)%' THEN
      user_shift := 'Night';
    END IF;

    -- 3. Logic: Clean Name (Remove brackets and roles)
    -- Remove content in parenthesis
    clean_name := regexp_replace(raw_name, '\s*\(.*?\)', '', 'g'); 
    -- Remove specific roles if they are part of the name string (heuristic)
    clean_name := replace(clean_name, ' Driver', '');
    clean_name := replace(clean_name, ' Recovery', '');
    clean_name := replace(clean_name, ' Bhai', ''); -- Optional based on "Jabbar Bhai"
    clean_name := trim(clean_name);

    -- Special Case: "Supervisor (You)" -> "Abrar"
    IF raw_name ILIKE '%Supervisor%' THEN
      clean_name := 'Abrar';
    END IF;
     -- Special Case: "Raza Owner" -> "Raza"
    IF raw_name ILIKE '%Raza Owner%' THEN
      clean_name := 'Raza';
    END IF;

    -- 4. Logic: Standardize Email to @razagas.com
    -- Use the first word of the clean name or existing known mapping
    -- sanitize: lowercase, remove spaces
    new_email := lower(split_part(clean_name, ' ', 1)) || '@razagas.com';

    -- UPDATE public.users
    UPDATE public.users 
    SET 
      name = clean_name,
      shift = user_shift,
      email = new_email,
      -- Set status to 'idle' if null/unknown, ensuring safe default
      status = COALESCE(status, 'idle')
    WHERE id = r.id;

    -- 5. Logic: Sync to Auth (Create or Update)
    -- Check if auth user exists by ID
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = r.id) THEN
      -- UPDATE existing auth user
      UPDATE auth.users
      SET 
        email = new_email,
        encrypted_password = crypt('123456', gen_salt('bf')),
        raw_user_meta_data = jsonb_build_object('name', clean_name, 'role', r.role),
        updated_at = now()
      WHERE id = r.id;
    ELSE
      -- INSERT new auth user (using existing public ID)
      INSERT INTO auth.users (
        id, 
        instance_id, 
        aud, 
        role, 
        email, 
        encrypted_password, 
        email_confirmed_at, 
        raw_app_meta_data, 
        raw_user_meta_data, 
        created_at, 
        updated_at
      )
      VALUES (
        r.id, 
        '00000000-0000-0000-0000-000000000000', 
        'authenticated', 
        'authenticated', 
        new_email, 
        crypt('123456', gen_salt('bf')), 
        now(), 
        '{"provider":"email","providers":["email"]}', 
        jsonb_build_object('name', clean_name, 'role', r.role), 
        now(), 
        now()
      );
    END IF;

  END LOOP;
END $$;

-- Validation Query
SELECT name as "Clean Name", role as "Role", shift as "Shift", email as "Email" FROM public.users ORDER BY role, name;
