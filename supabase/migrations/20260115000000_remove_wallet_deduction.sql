-- Migration: Remove Wallet Deduction from Expense Approval (CORRECTED)
-- Objective: Approve expenses for record-keeping ONLY. Do NOT deduct from Driver Wallet.
-- Fixes: Removes reference to non-existent 'updated_at', uses 'approved_at' and 'approved_by'.

CREATE OR REPLACE FUNCTION public.approve_expense(p_expense_id UUID, p_admin_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expense public.expenses%ROWTYPE;
BEGIN
    -- 1. Verify Expense Exists
    SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Expense not found');
    END IF;

    -- 2. Verify Status (Idempotency)
    IF v_expense.status = 'approved' THEN
        RETURN json_build_object('success', false, 'message', 'Expense already approved');
    END IF;

    -- 3. Update Status and Audit Fields
    -- Using 'approved_at' and 'approved_by' as confirmed by schema diagnosis.
    UPDATE public.expenses
    SET status = 'approved',
        approved_at = NOW(),
        approved_by = p_admin_id
    WHERE id = p_expense_id;

    -- 4. LOGIC REMOVED:
    -- UPDATE public.employee_wallets ... SET balance = balance - amount ... 
    -- ^ The above logic is intentionally OMITTED to fulfill the requirement.

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;
