-- Migration: Expand Company Ledger
-- Date: 2026-01-17 22:00
-- Description: Adds category column and expands transaction_type constraint to allow generic credit/debit.

-- 1. Add Category Column (for granular description/grouping)
ALTER TABLE public.company_ledger 
ADD COLUMN IF NOT EXISTS category TEXT;

-- 2. Drop Strict Constraint
ALTER TABLE public.company_ledger 
DROP CONSTRAINT IF EXISTS company_ledger_transaction_type_check;

-- 3. Add New Flexible Constraint
-- We keep legacy types to avoid breaking existing data, but add 'credit' and 'debit' for manual entries.
ALTER TABLE public.company_ledger 
ADD CONSTRAINT company_ledger_transaction_type_check 
CHECK (transaction_type IN (
    'credit',             -- Generic Money In
    'debit',              -- Generic Money Out
    'driver_deposit',     -- Legacy / Specific
    'vendor_payment',     -- Legacy / Specific
    'owner_withdrawal',   -- Legacy / Specific
    'adjustment'          -- Legacy / Specific
));
