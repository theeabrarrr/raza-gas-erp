-- Migration: Company Treasury & Ledger
-- Date: 2026-01-17
-- Description: Adds company_ledger table and updates handover approval to track cash.

-- 1. Create Company Ledger Table
CREATE TABLE IF NOT EXISTS public.company_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    amount NUMERIC NOT NULL, -- Positive = Inflow, Negative = Outflow
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('driver_deposit', 'vendor_payment', 'owner_withdrawal', 'adjustment')),
    description TEXT,
    reference_id UUID, -- Link to transactions.id (e.g. the handover transaction)
    admin_id UUID REFERENCES public.users(id), -- Who performed the action
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 2. Enable RLS
ALTER TABLE public.company_ledger ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policy: Tenant Isolation
DROP POLICY IF EXISTS "Tenant Isolation" ON public.company_ledger;
CREATE POLICY "Tenant Isolation" ON public.company_ledger
    FOR ALL USING (tenant_id = public.get_my_tenant_id());

-- 4. Trigger: Auto-assign Tenant ID
DROP TRIGGER IF EXISTS set_tenant_id_trigger ON public.company_ledger;
CREATE TRIGGER set_tenant_id_trigger
    BEFORE INSERT ON public.company_ledger
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_tenant_id();


-- 5. UPGRADE: Approve Driver Handover RPC
-- This function now includes Step 4: Ledger Entry
CREATE OR REPLACE FUNCTION public.approve_driver_handover(
    p_transaction_id UUID,
    p_admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_txn RECORD;
    v_driver_name TEXT;
    v_cylinders_count INT;
BEGIN
    -- 1. Fetch Transaction & Verify
    SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Transaction not found');
    END IF;

    IF v_txn.status = 'completed' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Transaction already completed');
    END IF;

    IF v_txn.type != 'handover_request' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid transaction type');
    END IF;

    -- Fetch Driver Name for Description
    SELECT name INTO v_driver_name FROM public.users WHERE id = v_txn.user_id;

    -- 2. ASSET HANDOVER: Move Cylinders (Handover Pending -> Warehouse)
    -- We assume these are EMPTIES being returned.
    WITH moved_cylinders AS (
        UPDATE public.cylinders
        SET 
            status = 'empty',
            current_location_type = 'warehouse',
            current_holder_id = NULL, -- Returned to stock
            updated_at = NOW()
        WHERE 
            status = 'handover_pending' 
            AND current_holder_id = v_txn.user_id
            AND tenant_id = v_txn.tenant_id
        RETURNING id
    )
    SELECT count(*) INTO v_cylinders_count FROM moved_cylinders;

    -- 3. FINANCIAL: Deduct from Driver Wallet
    IF v_txn.amount > 0 THEN
        UPDATE public.employee_wallets
        SET 
            balance = balance - v_txn.amount,
            updated_at = NOW()
        WHERE user_id = v_txn.user_id;
    END IF;

    -- 4. [NEW] TREASURY: Add to Company Ledger
    IF v_txn.amount > 0 THEN
        INSERT INTO public.company_ledger (
            tenant_id,
            amount,
            transaction_type,
            description,
            reference_id,
            admin_id
        ) VALUES (
            v_txn.tenant_id,
            v_txn.amount,
            'driver_deposit',
            'Handover from ' || COALESCE(v_driver_name, 'Driver'),
            v_txn.id,
            p_admin_user_id
        );
    END IF;

    -- 5. COMPLETE TRANSACTION
    UPDATE public.transactions
    SET 
        status = 'completed',
        receiver_id = p_admin_user_id -- Stamp the approver
    WHERE id = p_transaction_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Handover Approved. Cash: ' || v_txn.amount || ', Cylinders: ' || v_cylinders_count
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
