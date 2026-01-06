-- Function to handle Handover Requests Atomically
-- Prevents "Zombie Cylinders" where cylinders update but transaction fails.

CREATE OR REPLACE FUNCTION submit_handover_request(
    p_driver_id UUID,
    p_receiver_id UUID,
    p_tenant_id UUID,
    p_amount NUMERIC,
    p_serial_numbers TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of creator (admin) to ensure writes happen
AS $$
DECLARE
    v_txn_id UUID;
    v_updated_count INT;
BEGIN
    -- 1. Validate Receiver
    IF p_receiver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Receiver is required');
    END IF;

    -- 2. Update Cylinder Status (Lock Assets)
    IF array_length(p_serial_numbers, 1) > 0 THEN
        UPDATE public.cylinders
        SET 
            status = 'handover_pending',
            updated_at = NOW()
        WHERE 
            serial_number = ANY(p_serial_numbers) 
            AND tenant_id = p_tenant_id 
            AND current_holder_id = p_driver_id;
            
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    END IF;

    -- 3. Create Transaction Record
    INSERT INTO public.transactions (
        tenant_id, 
        user_id, 
        receiver_id, 
        type, 
        status, 
        amount, 
        description, 
        payment_method, 
        created_at
    )
    VALUES (
        p_tenant_id,
        p_driver_id,
        p_receiver_id,
        'handover_request',
        'pending',
        p_amount,
        'Handover Request: Rs ' || p_amount || ' + ' || COALESCE(array_length(p_serial_numbers, 1), 0) || ' Cylinders',
        'cash',
        NOW()
    )
    RETURNING id INTO v_txn_id;

    -- 4. Return Success
    RETURN jsonb_build_object(
        'success', true, 
        'transaction_id', v_txn_id, 
        'cylinders_updated', v_updated_count
    );

EXCEPTION WHEN OTHERS THEN
    -- Rollback is automatic in PL/PGSQL functions on error, but we return explicit error
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
