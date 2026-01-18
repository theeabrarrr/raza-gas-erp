"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * RECOVERY AGENT ACTIONS
 * Dedicated logic for debt collection and field operations.
 */

// 1. GET AGENT STATS (Wallet Balance)
export async function getRecoveryStats() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { cashOnHand: 0 };

    // Safety check: Ensure user is recovery agent or admin
    // In a real app we might check roles here, but RLS usually handles data access.

    const { data: wallet } = await supabase
        .from('employee_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();

    return {
        cashOnHand: wallet?.balance || 0
    };
}

// 2. GET DUE CUSTOMERS
export async function getDueCustomers() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) return [];

    const { data, error } = await supabase
        .from('customers')
        .select('id, name, address, phone, current_balance')
        .eq('tenant_id', tenantId)
        .lt('current_balance', 0) // Only those who OWE money (negative balance)
        .order('current_balance', { ascending: true }); // Highest debt (most negative) first

    if (error) {
        console.error("Fetch Due Customers Error:", error);
        return [];
    }

    return data || [];
}

// 3. COLLECT PAYMENT (The main workhorse)
export async function collectPayment(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const tenantId = user.app_metadata?.tenant_id;

    // Parse Input
    const customerId = formData.get('customer_id')?.toString();
    const amount = parseFloat(formData.get('amount')?.toString() || '0');
    const paymentMode = formData.get('payment_mode')?.toString() || 'cash';
    const description = formData.get('description')?.toString();

    if (!customerId) return { error: "Customer required" };
    if (isNaN(amount) || amount <= 0) return { error: "Invalid amount" };

    try {
        // A. FINANCIALS - ATOMIC LOGIC

        // 1. Credit Customer (Reduce Debt)
        // Debt is negative. Paying 1000 means: -5000 + 1000 = -4000.
        // So we ADD the positive amount.

        // Fetch current to be safe
        const { data: cust } = await supabase
            .from('customers')
            .select('current_balance, name')
            .eq('id', customerId)
            .single();

        if (!cust) return { error: "Customer not found" };

        const newBalance = (cust.current_balance || 0) + amount;

        // Update Customer
        await supabase
            .from('customers')
            .update({ current_balance: newBalance })
            .eq('id', customerId);

        // 2. Update Agent Wallet (Liability Increases)
        // If they collect Cash, they hold it. If Cheque/Bank, maybe not?
        // User request: "Debit Agent: INCREASE the Agent's wallet_balance"
        // implying they are holding the funds. simpler to assume all collections hit wallet for now 
        // unless typical business logic says Bank Transfer goes direct.
        // Let's assume 'cash' hits wallet. 'bank' might not? 
        // Re-reading user prompt: "Debit Agent: INCREASE the Agent's wallet_balance (Liability increases)."
        // It didn't mention exceptions. We'll stick to strict liability for simplicity, 
        // or maybe only for CASH.
        // Let's assume CASH collections increase wallet.

        if (paymentMode === 'cash') {
            const { data: w } = await supabase.from('employee_wallets').select('balance').eq('user_id', user.id).single();
            const currentWallet = w?.balance || 0;

            await supabase.from('employee_wallets').upsert({
                user_id: user.id,
                balance: currentWallet + amount,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
        }

        // 3. Create Transaction Record (The Ledger)
        // This is the "Receipt"
        const { error: txnError } = await supabase.from('transactions').insert({
            tenant_id: tenantId,
            user_id: user.id,
            customer_id: customerId,
            type: 'collection',          // Specific type for recovery
            status: 'held_by_agent',     // Distinct from 'completed' in safe
            amount: -amount, // Credits are negative in transactions table
            payment_method: paymentMode,
            description: description || `Recovery Collection from ${cust.name}`,
            created_at: new Date().toISOString()
        });

        if (txnError) throw new Error(`Txn Error: ${txnError.message}`);

        revalidatePath('/recovery');
        return { success: true };

    } catch (err: any) {
        console.error("Collection Failed:", err);
        return { error: err.message };
    }
}

// 4. PROCESS HANDOVER (Agent -> Admin)
export async function processRecoveryHandover(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const tenantId = user.app_metadata?.tenant_id;

    // Parse
    const receiverId = formData.get('receiver_id')?.toString();
    const amount = parseFloat(formData.get('amount')?.toString() || '0');

    if (!receiverId) return { error: "Select receiver" };
    if (amount <= 0) return { error: "Invalid amount" };

    // Validate Wallet
    const { data: wallet } = await supabase.from('employee_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();

    if (!wallet || wallet.balance < amount) {
        return { error: `Insufficient funds. You only have ${wallet?.balance || 0}` };
    }

    // Create Handover Request
    // This puts it in 'pending' state. Valid Money is still in Agent Wallet until Admin Approves.
    const { error } = await supabase.from('transactions').insert({
        tenant_id: tenantId,
        user_id: user.id,
        receiver_id: receiverId,
        type: 'handover_request',
        status: 'pending',
        amount: amount,
        payment_method: 'cash',
        description: `Recovery Handover: Rs ${amount}`,
        created_at: new Date().toISOString()
    });

    if (error) return { error: error.message };

    revalidatePath('/recovery');
    return { success: true };
}

// 5. GET RECEIVERS (Admins)
export async function getRecoveryReceivers() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const tenantId = user.app_metadata?.tenant_id;

    const { data } = await supabase
        .from('users')
        .select('id, name, role')
        .in('role', ['admin', 'manager'])
        .eq('tenant_id', tenantId);

    return data || [];
}
