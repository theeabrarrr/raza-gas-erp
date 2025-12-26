-- MIGRATION: Init Wallets & Shift Status

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Add Shift Tracking to Users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;

-- 2. Create/Update Employee Wallets Table
CREATE TABLE IF NOT EXISTS public.employee_wallets (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL,
    balance numeric DEFAULT 0 CHECK (balance >= 0), -- Prevent negative wallet balance? Or allow simplified math?
    -- Actually, allow negative? No, cash in hand is usually >= 0. But allow flexibility.
    last_updated timestamptz DEFAULT now(),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id),
    CONSTRAINT uniq_user_wallet UNIQUE (user_id)
);

-- 3. Initialize Wallets for All Users (Safe Upsert)
INSERT INTO public.employee_wallets (user_id, balance)
SELECT id, 0
FROM public.users
WHERE id NOT IN (SELECT user_id FROM public.employee_wallets);

-- 4. Audit/Verify
SELECT u.name, u.role, u.shift, w.balance, u.is_online
FROM public.users u
JOIN public.employee_wallets w ON u.id = w.user_id;
