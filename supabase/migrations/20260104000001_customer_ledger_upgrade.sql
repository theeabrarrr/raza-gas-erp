-- MIGRATION: Customer Ledger Upgrade
-- 1. Add Credit Limit
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS credit_limit INTEGER DEFAULT 50000;

-- 2. Self-Healing Script: Create 'Opening Balance' for customers with disconnected balances
DO $$
DECLARE
    cust RECORD;
    tx_count INTEGER;
BEGIN
    FOR cust IN 
        SELECT id, tenant_id, current_balance, name 
        FROM public.customers 
        WHERE current_balance != 0
    LOOP
        -- Check if transaction history exists
        SELECT COUNT(*) INTO tx_count 
        FROM public.transactions 
        WHERE customer_id = cust.id;

        -- If history is empty but balance exists, this is a disconnected state.
        IF tx_count = 0 THEN
            INSERT INTO public.transactions (
                tenant_id,
                customer_id,
                amount,
                type,
                description,
                created_at
            ) VALUES (
                cust.tenant_id,
                cust.id,
                cust.current_balance, -- Preserves sign (Positive = Debt, Negative = Advance)
                'opening_balance',
                'System Correction / Opening Balance',
                NOW()
            );
            RAISE NOTICE 'Fixed disconnected ledger for customer: % (Balance: %)', cust.name, cust.current_balance;
        END IF;
    END LOOP;
END $$;
