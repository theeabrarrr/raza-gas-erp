'use server';

import { createClient } from "@/utils/supabase/server";
import { getCurrentUserTenantId } from "@/lib/utils/tenantHelper";
import { revalidatePath } from "next/cache";

/**
 * Get expenses with optional status filter
 * SECURITY: Tenant scoped
 */
export async function getExpenses(statusFilter: 'pending' | 'approved' | 'rejected' = 'pending') {
    const supabase = await createClient();

    let tenantId: string;
    try {
        const id = await getCurrentUserTenantId();
        if (!id) return [];
        tenantId = id;
    } catch (error) {
        return [];
    }

    const { data, error } = await supabase
        .from('expenses')
        .select('*, profiles!expenses_user_id_fkey(full_name)')
        .eq('status', statusFilter)
        .eq('tenant_id', tenantId) // ✅ ADDED
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching expenses:", error);
        return [];
    }

    return data;
}

/**
 * Get all expenses for current tenant (Plan implementation)
 * SECURITY: Filters by tenant_id
 */
export async function getAllExpenses() {
    const supabase = await createClient()

    let tenantId: string
    try {
        const id = await getCurrentUserTenantId()
        if (!id) return { success: false, error: 'Authentication required' }
        tenantId = id
    } catch (error) {
        return { success: false, error: 'Authentication required' }
    }

    const { data, error } = await supabase
        .from('expenses')
        .select('*, user:users(name, role)') // Note: Join might need adjustment depending on schema, strict aliasing used
        .eq('tenant_id', tenantId)  // ✅ ADDED
        .order('created_at', { ascending: false })

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, data }
}

/**
 * Get pending expenses for approval (Plan implementation)
 */
export async function getPendingExpenses() {
    const supabase = await createClient()

    let tenantId: string
    try {
        const id = await getCurrentUserTenantId()
        if (!id) return { success: false, error: 'Authentication required' }
        tenantId = id
    } catch (error) {
        return { success: false, error: 'Authentication required' }
    }

    const { data, error } = await supabase
        .from('expenses')
        .select('*, user:users(name, role)')
        .eq('status', 'pending')
        .eq('tenant_id', tenantId)  // ✅ ADDED
        .order('created_at', { ascending: false })

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, data }
}


export async function getExpenseStats() {
    const supabase = await createClient();

    let tenantId: string;
    try {
        const id = await getCurrentUserTenantId();
        if (!id) return {
            monthSpend: 0,
            pendingLiability: 0,
            topCategory: { name: 'N/A', amount: 0, percentage: 0 },
            weeklyTrend: []
        };
        tenantId = id;
    } catch (error) {
        return {
            monthSpend: 0,
            pendingLiability: 0,
            topCategory: { name: 'N/A', amount: 0, percentage: 0 },
            weeklyTrend: []
        };
    }

    // Dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Last 7 Days logic:
    // We want today + 6 previous days.
    const dates = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d);
    }
    // Set start date to beginning of "Day 1"
    const startOf7Days = new Date(dates[0]);
    startOf7Days.setHours(0, 0, 0, 0);

    // A. Month's Spend
    const { data: monthData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('status', 'approved')
        .eq('tenant_id', tenantId) // ✅ ADDED
        .gte('created_at', startOfMonth);

    const monthSpend = monthData?.reduce((sum, item) => sum + item.amount, 0) || 0;

    // B. Pending Liability
    const { data: pendingData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('status', 'pending')
        .eq('tenant_id', tenantId); // ✅ ADDED

    const pendingLiability = pendingData?.reduce((sum, item) => sum + item.amount, 0) || 0;

    // C. Top Category
    const { data: catData } = await supabase
        .from('expenses')
        .select('category, amount')
        .eq('status', 'approved')
        .eq('tenant_id', tenantId); // ✅ ADDED

    const catMap: Record<string, number> = {};
    let totalApproved = 0;
    catData?.forEach(item => {
        catMap[item.category] = (catMap[item.category] || 0) + item.amount;
        totalApproved += item.amount;
    });

    let topCategory = { name: 'N/A', amount: 0, percentage: 0 };
    Object.entries(catMap).forEach(([name, amount]) => {
        if (amount > topCategory.amount) {
            topCategory = { name, amount, percentage: 0 };
        }
    });
    if (totalApproved > 0) {
        topCategory.percentage = Math.round((topCategory.amount / totalApproved) * 100);
    }

    // D. Last 7 Days Trend
    const { data: trendData } = await supabase
        .from('expenses')
        .select('created_at, amount')
        .eq('status', 'approved')
        .eq('tenant_id', tenantId) // ✅ ADDED
        .gte('created_at', startOf7Days.toISOString());

    // Initialize buckets
    const daysMap = new Map<string, number>();
    dates.forEach(d => {
        // Use YYYY-MM-DD for grouping
        const key = d.toISOString().split('T')[0];
        daysMap.set(key, 0);
    });

    trendData?.forEach(item => {
        // Convert DB time (ISO String) to YYYY-MM-DD key.
        const dateObj = new Date(item.created_at);
        const key = dateObj.toISOString().split('T')[0];

        if (daysMap.has(key)) {
            daysMap.set(key, (daysMap.get(key) || 0) + item.amount);
        }
    });

    const weeklyTrend = Array.from(daysMap.entries()).map(([dateStr, amount]) => {
        const d = new Date(dateStr);
        return {
            date: d.toLocaleDateString('en-US', { weekday: 'short' }), // Mon
            amount: Number(amount) // Ensure number
        };
    });

    return {
        monthSpend,
        pendingLiability,
        topCategory,
        weeklyTrend
    };
}

export async function approveExpense(expenseId: string) {
    const supabase = await createClient();

    // 🔒 SECURITY FIX: Verify tenant
    let tenantId: string;
    try {
        const id = await getCurrentUserTenantId();
        if (!id) return { error: "Unauthorized" };
        tenantId = id;
    } catch (error) {
        return { error: "Unauthorized" };
    }

    // Verify Expense Logic (Fetch first to confirm tenant)
    const { data: expense, error: fetchError } = await supabase
        .from('expenses')
        .select('tenant_id')
        .eq('id', expenseId)
        .single();

    if (fetchError || !expense) {
        return { error: 'Expense not found' };
    }

    if (expense.tenant_id !== tenantId) {
        console.error(`SECURITY: Cross-tenant expense access attempt`);
        return { error: 'Access denied' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };


    const { data, error } = await supabase.rpc('approve_expense', {
        p_expense_id: expenseId,
        p_admin_id: user.id
    });

    if (error) {
        console.error("Error approving expense:", error);
        return { error: error.message };
    }

    if (data && !data.success) {
        return { error: data.message || "Approval failed" };
    }

    revalidatePath('/admin/expenses');
    return { success: true };
}

export async function rejectExpense(expenseId: string) {
    const supabase = await createClient();

    // 🔒 SECURITY FIX: Verify tenant
    let tenantId: string;
    try {
        const id = await getCurrentUserTenantId();
        if (!id) return { error: "Unauthorized" };
        tenantId = id;
    } catch (error) {
        return { error: "Unauthorized" };
    }

    // Verify Expense Logic
    const { data: expense, error: fetchError } = await supabase
        .from('expenses')
        .select('tenant_id')
        .eq('id', expenseId)
        .single();

    if (fetchError || !expense) {
        return { error: 'Expense not found' };
    }

    if (expense.tenant_id !== tenantId) {
        console.error(`SECURITY: Cross-tenant expense access attempt`);
        return { error: 'Access denied' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };


    const { data, error } = await supabase.rpc('reject_expense', {
        p_expense_id: expenseId,
        p_admin_id: user.id
    });

    if (error) {
        console.error("Error rejecting expense:", error);
        return { error: error.message };
    }

    if (data && !data.success) {
        return { error: data.message || "Rejection failed" };
    }

    revalidatePath('/admin/expenses');
    return { success: true };
}
