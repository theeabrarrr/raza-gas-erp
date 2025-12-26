-- DATA CLEANUP: Standardize Emails to @razagas.com and Reset Passwords
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  -- Helper function to avoid repeating logic? 
  -- We'll just use direct updates for clarity and safety.
BEGIN

  -- 1. Raza Owner
  UPDATE auth.users 
  SET email = 'raza@razagas.com', encrypted_password = crypt('123456', gen_salt('bf')) 
  WHERE email = 'raza@admin.com';
  
  UPDATE public.users 
  SET email = 'raza@razagas.com' 
  WHERE email = 'raza@admin.com';

  -- 2. Supervisor
  UPDATE auth.users 
  SET email = 'supervisor@razagas.com', encrypted_password = crypt('123456', gen_salt('bf')) 
  WHERE email = 'supervisor@admin.com';
  
  UPDATE public.users 
  SET email = 'supervisor@razagas.com' 
  WHERE email = 'supervisor@admin.com';

  -- 3. Faiz (Shop 1)
  UPDATE auth.users 
  SET email = 'faiz@razagas.com', encrypted_password = crypt('123456', gen_salt('bf')) 
  WHERE email = 'faiz@shop1.com';
  
  UPDATE public.users 
  SET email = 'faiz@razagas.com' 
  WHERE email = 'faiz@shop1.com';

  -- 4. Sawab (Shop 1)
  UPDATE auth.users 
  SET email = 'sawab@razagas.com', encrypted_password = crypt('123456', gen_salt('bf')) 
  WHERE email = 'sawab@shop1.com';
  
  UPDATE public.users 
  SET email = 'sawab@razagas.com' 
  WHERE email = 'sawab@shop1.com';

  -- 5. Raaj (Shop 2)
  UPDATE auth.users 
  SET email = 'raaj@razagas.com', encrypted_password = crypt('123456', gen_salt('bf')) 
  WHERE email = 'raaj@shop2.com';
  
  UPDATE public.users 
  SET email = 'raaj@razagas.com' 
  WHERE email = 'raaj@shop2.com';

  -- 6. Kaleem (Shop 2)
  UPDATE auth.users 
  SET email = 'kaleem@razagas.com', encrypted_password = crypt('123456', gen_salt('bf')) 
  WHERE email = 'kaleem@shop2.com';
  
  UPDATE public.users 
  SET email = 'kaleem@razagas.com' 
  WHERE email = 'kaleem@shop2.com';

  -- 7. Osama (Recovery)
  UPDATE auth.users 
  SET email = 'osama@razagas.com', encrypted_password = crypt('123456', gen_salt('bf')) 
  WHERE email = 'osama@recovery.com';
  
  UPDATE public.users 
  SET email = 'osama@razagas.com' 
  WHERE email = 'osama@recovery.com';

  -- 8. Jabbar (Cashier)
  UPDATE auth.users 
  SET email = 'jabbar@razagas.com', encrypted_password = crypt('123456', gen_salt('bf')) 
  WHERE email = 'jabbar@cash.com';
  
  UPDATE public.users 
  SET email = 'jabbar@razagas.com' 
  WHERE email = 'jabbar@cash.com';

  -- 9. Ahmed (Staff)
  UPDATE auth.users 
  SET email = 'ahmed@razagas.com', encrypted_password = crypt('123456', gen_salt('bf')) 
  WHERE email = 'ahmed@staff.com';
  
  UPDATE public.users 
  SET email = 'ahmed@razagas.com' 
  WHERE email = 'ahmed@staff.com';

  -- 10. Arif (Staff)
  UPDATE auth.users 
  SET email = 'arif@razagas.com', encrypted_password = crypt('123456', gen_salt('bf')) 
  WHERE email = 'arif@staff.com';
  
  UPDATE public.users 
  SET email = 'arif@razagas.com' 
  WHERE email = 'arif@staff.com';

  -- 11. Rehmat (Staff)
  UPDATE auth.users 
  SET email = 'rehmat@razagas.com', encrypted_password = crypt('123456', gen_salt('bf')) 
  WHERE email = 'rehmat@staff.com';
  
  UPDATE public.users 
  SET email = 'rehmat@razagas.com' 
  WHERE email = 'rehmat@staff.com';

  -- 12. Habib (Driver)
  UPDATE auth.users 
  SET email = 'habib@razagas.com', encrypted_password = crypt('123456', gen_salt('bf')) 
  WHERE email = 'habib@driver.com';
  
  UPDATE public.users 
  SET email = 'habib@razagas.com' 
  WHERE email = 'habib@driver.com';

  -- 13. Ibaad (Driver)
  UPDATE auth.users 
  SET email = 'ibaad@razagas.com', encrypted_password = crypt('123456', gen_salt('bf')) 
  WHERE email = 'ibaad@driver.com';
  
  UPDATE public.users 
  SET email = 'ibaad@razagas.com' 
  WHERE email = 'ibaad@driver.com';

END $$;

-- Verify results
SELECT name, email, role FROM public.users ORDER BY name;
