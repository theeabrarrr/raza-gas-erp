'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function getExpenses(statusFilter: 'pending' | 'approved' | 'rejected' = 'pending') {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('expenses')
        .select('*, profiles!expenses_user_id_fkey(full_name)')
        .eq('status', statusFilter)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching expenses:", error);
        return [];
    }

    return data;
}

export async function getExpenseStats() {
    const supabase = await createClient();

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
        .gte('created_at', startOfMonth);

    const monthSpend = monthData?.reduce((sum, item) => sum + item.amount, 0) || 0;

    // B. Pending Liability
    const { data: pendingData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('status', 'pending');

    const pendingLiability = pendingData?.reduce((sum, item) => sum + item.amount, 0) || 0;

    // C. Top Category
    const { data: catData } = await supabase
        .from('expenses')
        .select('category, amount')
        .eq('status', 'approved');

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
