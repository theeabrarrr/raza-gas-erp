'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// 1. Get Totals (Live Calculation)
export async function getCompanyStats() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { totalBalance: 0 };
    const tenantId = user.app_metadata?.tenant_id;

    // Sum of all amounts
    const { data, error } = await supabase
        .from('company_ledger')
        .select('amount')
        .eq('tenant_id', tenantId);

    if (error) {
        console.error("Finance Stats Error:", error);
        return { totalBalance: 0 };
    }

    const total = data.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    return { totalBalance: total };
}

// 2. Get Ledger History
export async function getLedgerHistory() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const tenantId = user.app_metadata?.tenant_id;

    const { data, error } = await supabase
        .from('company_ledger')
        .select(`
            id,
            amount,
            transaction_type,
            description,
            created_at,
            admin_id,
            users (name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Finance History Error:", error);
        return [];
    }

    return data || [];
}

// 3. GET ALL CUSTOMERS (Lite Version for Dropdown)
export async function getAllCustomersClient() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [] };
    const tenantId = user.app_metadata?.tenant_id;

    const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(100); // Reasonable limit for dropdown

    return { data: data || [] };
}

// 4. CREATE TRANSACTION (Smart Action)
export async function createTransaction(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };
    const tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) return { error: "Tenant context missing" };

    // Parse Data
    const type = formData.get('type')?.toString(); // 'income' | 'expense'
    const category = formData.get('category')?.toString();
    const amountStr = formData.get('amount')?.toString();
    const description = formData.get('description')?.toString();
    const dateStr = formData.get('date')?.toString();
    const customerId = formData.get('customer_id')?.toString();

    let amount = parseFloat(amountStr || '0');
    if (isNaN(amount) || amount <= 0) return { error: "Invalid amount" };

    // If Expense, make negative
    if (type === 'expense') {
        amount = -amount;
    }

    // Map to DB Allowed Types (credit/debit)
    const dbTransactionType = type === 'income' ? 'credit' : 'debit';

    try {
        // A. Create Company Ledger Entry (The visible cash change)
        const { error: ledgerError } = await supabase.from('company_ledger').insert({
            tenant_id: tenantId,
            amount: amount,
            transaction_type: dbTransactionType, // 'credit' or 'debit'
            category: category,                  // Specific category (e.g. 'Customer Payment')
            description: description,
            admin_id: user.id,
            created_at: dateStr || new Date().toISOString()
        });

        if (ledgerError) throw new Error(`Ledger Error: ${ledgerError.message}`);

        // B. Handle Customer Linkage (If Payment)
        if (category === 'customer_payment' && customerId) {

            // 1. Credit the Customer (Decrease Debt)
            // Fetch current balance first to be safe (or use RPC increment if available, but simple update is fine for low concurrency)
            const { data: customer } = await supabase.from('customers').select('current_balance').eq('id', customerId).single();
            const currentBalance = customer?.current_balance || 0;

            // Payment reduces the balance (Debt - Payment)
            // Amount here is POSITIVE because we parsed it as such, but wait...
            // In the "Type" check above, income remains Positive.
            // So if Customer Pays 5000:
            // Ledger: +5000 (Income)
            // Customer Balance: Old - 5000

            // We need the absolute value for the customer calculation
            const absAmount = Math.abs(amount);
            const newBalance = currentBalance - absAmount;

            await supabase.from('customers')
                .update({ current_balance: newBalance })
                .eq('id', customerId)
                .eq('tenant_id', tenantId);

            // 2. Add to Customer History (Transactions Table)
            // This is crucial for the customer to see "Payment Received"
            await supabase.from('transactions').insert({
                tenant_id: tenantId,
                customer_id: customerId,
                amount: -absAmount, // Credit is Negative in Transactions table usually (reduces debt)
                type: 'payment',
                payment_method: 'cash', // Assumed cash since it's "Manual Finance Entry"
                description: description || 'Direct Payment at Office',
                created_at: dateStr || new Date().toISOString()
            });
        }

        revalidatePath('/admin/finance');
        if (customerId) revalidatePath('/admin/customers');
        return { success: true };

    } catch (err: any) {
        console.error("Transaction Error:", err);
        return { error: err.message };
    }
}
