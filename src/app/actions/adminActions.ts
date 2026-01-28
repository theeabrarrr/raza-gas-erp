"use server";

import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from "next/cache";

const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

export async function getAdminStats() {
    const supabase = await createClient();

    // 1. Get Tenant Context
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;

    if (!tenantId) {
        console.error("Critical: No Tenant ID found for stats.");
        return { totalCylinders: 0, activeDrivers: 0, emptyCylinders: 0, distributedStock: 0 };
    }

    // 2. Fetch with Explicit Filter (Double Lock)
    const [cylResult, driverResult, emptyResult, activityResult, distributedResult] = await Promise.allSettled([
        supabase.from("cylinders").select("*", { count: 'exact', head: true }).eq("current_location_type", "warehouse").eq("tenant_id", tenantId),
        supabase.from("users").select("*", { count: 'exact', head: true }).eq("role", "driver").eq("tenant_id", tenantId),
        supabase.from("cylinders").select("*", { count: 'exact', head: true }).eq("status", "empty").eq("tenant_id", tenantId),
        // Recent Activity (Orders)
        supabase.from('orders')
            .select('id, friendly_id, status, total_amount, created_at, customers(name)')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(5),
        // Active Assets (Distributed / Not in Godown)
        supabase.from("cylinders").select("*", { count: 'exact', head: true }).neq("current_location_type", "warehouse").eq("tenant_id", tenantId)
    ]);

    // Helpers to extract data or log error
    const processResult = (result: PromiseSettledResult<any>, label: string) => {
        if (result.status === 'rejected') {
            console.error(`Error fetching ${label}:`, result.reason);
            return 0;
        }
        if (result.value.error) {
            console.error(`Error fetching ${label}:`, result.value.error.message);
            return 0;
        }
        return result.value.count || 0;
    };

    const getActivity = (result: PromiseSettledResult<any>) => {
        if (result.status === 'fulfilled' && result.value.data) return result.value.data;
        return [];
    };

    return {
        totalCylinders: processResult(cylResult, "Total Cylinders"),
        activeDrivers: processResult(driverResult, "Active Drivers"),
        emptyCylinders: processResult(emptyResult, "Empty Cylinders"),
        distributedStock: processResult(distributedResult, "Distributed Stock"),
        recentActivity: getActivity(activityResult)
    };
}

export async function getTenantInfo() {
    const supabase = await createClient();

    // 1. Get User to identify Tenant
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;

    if (!user || !tenantId) return { name: "Tenant Information" };

    // 2. Fetch Tenant Name via Users Join (or metadata if reliable, but DB join is safer for fresh name)
    // Assuming 'users' has 'tenant_id' and we join 'tenants'.
    const { data: profile } = await supabase
        .from("users")
        .select("tenant_id, tenants(name)")
        .eq("id", user.id)
        .eq("tenant_id", tenantId)
        .single();

    // Type assertion or check
    const tenantName = (profile as any)?.tenants?.name || "My Organization";
    return { name: tenantName };
}

export async function getTenantUsers() {
    const supabase = await createClient();

    // 1. Get Current User (Auth Check)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("Auth error:", authError);
        return [];
    }

    // 2. Verified Query using RLS
    // We rely on the "Tenant Isolation" policy on 'profiles' to filter data automatically.
    // If the policy is working, this returns only the profiles for the user's tenant.
    const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*");

    if (error) {
        console.error("Error fetching available profiles:", error);
        return [];
    }

    // Map profiles to Employee shape
    const mappedUsers = profiles?.map((p: any) => ({
        id: p.id,
        name: p.full_name || 'Unknown',
        email: 'N/A', // Email is not in profiles usually
        role: p.role || 'staff',
        phone_number: p.phone_number,
        shift: 'Day', // Default as shift is not in profiles
        created_at: p.updated_at || new Date().toISOString(),
        profiles: {
            vehicle_number: p.vehicle_number,
            phone_number: p.phone_number
        }
    })) || [];

    return mappedUsers;
}

export async function getDrivers() {
    const supabase = await createClient();

    // 1. Session & Metadata
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;

    if (!user || !tenantId) return [];

    // 2. Verified Query
    const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'driver')
        .eq('tenant_id', tenantId) // Double Lock
        .order('name');

    if (error) {
        console.error("Error fetching drivers:", error);
        return [];
    }

    return data || [];
}

// 4. GET PENDING HANDOVERS (Approvals)
export async function getPendingHandovers() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id;

    // 1. Get raw handovers from view
    const { data: handovers } = await supabase
        .from('view_admin_approvals')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

    if (!handovers || handovers.length === 0) return [];

    // 2. Fetch Roles manually (since view doesn't have it and join is tricky with permissions)
    const userIds = Array.from(new Set(handovers.map(h => h.user_id).filter(Boolean)));

    const { data: users } = await supabase
        .from('users')
        .select('id, role')
        .in('id', userIds);

    // 3. Merge Role into result as 'users' object to match frontend expectation
    const enrichedData = handovers.map(h => {
        const u = users?.find(u => u.id === h.user_id);
        return {
            ...h,
            users: { role: u?.role || 'driver' } // Default to driver if checking fails
        };
    });

    return enrichedData;
}

// 4.5 HELPER: Get Pending Cylinder Details (For UI)
export async function getPendingCylinderDetails() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id;

    const { data } = await supabase
        .from('cylinders')
        .select('id, serial_number, current_holder_id, status')
        .eq('status', 'handover_pending')
        .eq('tenant_id', tenantId);

    return data || [];
}

// 5. APPROVE HANDOVER
// 5. APPROVE HANDOVER (With Reconciliation Logic)
// 5. APPROVE HANDOVER (With Reconciliation Logic)
// 5. APPROVE HANDOVER (RPC-Based)
export async function approveHandover(transactionId: string, _confirmedQty?: number) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "Unauthorized" };
    if (!transactionId) return { error: "Transaction ID is missing" };

    // 1. Call Secure RPC
    // This handles Transaction Status Update + Asset Move + Wallet Deduction atomically on the DB side.
    const { data: rpcData, error: rpcError } = await supabase.rpc('approve_driver_handover', {
        p_transaction_id: transactionId,
        p_admin_user_id: user.id
    });

    if (rpcError) {
        console.error("Approval RPC Error:", rpcError);
        return { error: rpcError.message || "Admin Approval Failed (RPC Error)" };
    }

    // RPC returns JSON object { success: boolean, message: string }
    // We check success flag
    const result = rpcData as any;

    if (!result || !result.success) {
        console.error("Approval RPC returned failure:", result);
        return { error: result?.message || "Admin Approval Failed (Logic Error)" };
    }

    revalidatePath('/admin/approvals');
    revalidatePath('/admin/inventory');
    return { success: true, message: "Handover Approved Successfully" };
}

// 5.1 GET PENDING PAYMENTS
export async function getPendingPayments() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id;

    // Fetch transactions waiting for verificaion
    const { data, error } = await supabase
        .from('transactions')
        .select(`
            *,
            customers (name)
        `)
        .eq('tenant_id', tenantId)
        .eq('type', 'payment')
        .eq('status', 'pending_verification') // Explicit status for Bank/Cheque
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching pending payments:", error);
        return [];
    }

    return data || [];
}

// 5.2 VERIFY PAYMENT (Bank/Cheque)
export async function verifyPayment(transactionId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };
    const tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id;

    if (!transactionId) return { error: "Transaction ID missing" };

    // 1. Get Transaction Details
    const { data: txn, error: txnError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('tenant_id', tenantId)
        .single();

    if (txnError || !txn) return { error: "Transaction not found" };
    if (txn.status !== 'pending_verification') return { error: "Transaction already processed" };

    // 2. Perform Atomic Updates (Ideally RPC, but doing manual for now as per plan/speed)
    // A. Update Transaction Status
    const { error: updateError } = await supabase
        .from('transactions')
        .update({ status: 'verified', updated_at: new Date().toISOString() })
        .eq('id', transactionId);

    if (updateError) return { error: "Failed to update transaction status" };

    // B. Credit Customer Balance (Reduce Debt)
    // Fetch current first
    const { data: customer } = await supabase.from('customers').select('current_balance').eq('id', txn.user_id).single();
    if (customer) {
        const newBalance = (customer.current_balance || 0) - Math.abs(txn.amount); // Reduce debt
        await supabase.from('customers').update({ current_balance: newBalance }).eq('id', txn.user_id);
    }

    // C. Update Company Ledger (Real Money In)
    await supabase.from('company_ledger').insert({
        tenant_id: tenantId,
        amount: Math.abs(txn.amount), // Positive Income
        transaction_type: 'credit',
        category: 'customer_payment_verified',
        description: `Verified ${txn.payment_method} from Customer (Txn #${txn.id.slice(0, 8)})`,
        admin_id: user.id
    });

    revalidatePath('/admin/approvals');
    revalidatePath('/admin/finance');
    revalidatePath('/admin/customers');

    return { success: true, message: "Payment Verified Successfully" };
}

// 5.3 REJECT PAYMENT
export async function rejectPayment(transactionId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Just mark as rejected. No financial rollback needed as it was never applied.
    const { error } = await supabase
        .from('transactions')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', transactionId);

    if (error) return { error: "Failed to reject payment" };

    revalidatePath('/admin/approvals');
    return { success: true, message: "Payment Rejected" };
}

// 6. REJECT HANDOVER
export async function rejectHandover(transactionId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.user_metadata?.tenant_id || user?.app_metadata?.tenant_id;

    if (!user || !tenantId) return { error: "Unauthorized" };

    const { data: txn } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('receiver_id', user.id)
        .single();

    if (!txn) return { error: "Transaction not found" };

    // 1. Revert Cylinder Status (handover_pending -> full/empty?)
    // This is tricky. We don't know previous status.
    // We will set them to 'empty' (safe bet for returns) or keeps them with driver?
    // If rejected, they stay with Driver. Status should probably revert to 'empty' (as they were likely empty returns)
    // OR 'full' if they were full returns?
    // Safe bet: Revert to 'empty' as most returns are empty. Or just 'empty'.
    // Actually, let's set them to 'empty' but keep with driver.

    await supabase.from('cylinders').update({
        status: 'empty', // Revert to empty
        updated_at: new Date().toISOString()
    })
        .eq('current_holder_id', txn.user_id)
        .eq('status', 'handover_pending')
        .eq('tenant_id', tenantId);

    // 2. Mark Transaction Rejected
    await supabase.from('transactions').update({
        status: 'rejected'
    }).eq('id', transactionId);

    revalidatePath('/admin/approvals');
    return { success: true };
}

// 7. DASHBOARD STATS (Consolidated)
export async function getDashboardStats() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;

    if (!tenantId) {
        return {
            totalCash: 0,
            activeDrivers: 0,
            totalAssets: 0,
            emptyCylinders: 0,
            chartData: [],
            recentActivity: []
        };
    }

    // Parallel Fetching
    const [cashResult, driversResult, assetsResult, emptyResult, ordersResult, recentResult] = await Promise.allSettled([
        // 1. Total Cash (Sum of Ledger)
        supabase.from('company_ledger').select('amount').eq('tenant_id', tenantId),

        // 2. Active Drivers
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'driver').eq('tenant_id', tenantId),

        // 3. Total Assets
        supabase.from('cylinders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),

        // 4. Empty Cylinders
        supabase.from('cylinders').select('*', { count: 'exact', head: true }).eq('status', 'empty').eq('tenant_id', tenantId),

        // 5. Chart Data (Last 7 Days)
        supabase.from('orders')
            .select('created_at, total_amount')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: true }),

        // 6. Recent Activity
        supabase.from('orders')
            .select('id, friendly_id, status, total_amount, created_at, customers(name)')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(5)
    ]);

    // Process Cash
    let totalCash = 0;
    if (cashResult.status === 'fulfilled' && cashResult.value.data) {
        totalCash = cashResult.value.data.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    }

    // Process Counts
    const activeDrivers = driversResult.status === 'fulfilled' ? (driversResult.value.count || 0) : 0;
    const totalAssets = assetsResult.status === 'fulfilled' ? (assetsResult.value.count || 0) : 0;
    const emptyCylinders = emptyResult.status === 'fulfilled' ? (emptyResult.value.count || 0) : 0;
    const recentActivity = recentResult.status === 'fulfilled' && recentResult.value.data ? recentResult.value.data : [];

    // Process Chart Data (Group by Day)
    const chartMap = new Map<string, number>();

    // Initialize last 7 days with 0
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue
        chartMap.set(dateStr, 0);
    }

    if (ordersResult.status === 'fulfilled' && ordersResult.value.data) {
        ordersResult.value.data.forEach((order) => {
            const dateStr = new Date(order.created_at).toLocaleDateString('en-US', { weekday: 'short' });
            if (chartMap.has(dateStr)) {
                chartMap.set(dateStr, (chartMap.get(dateStr) || 0) + 1);
            }
        });
    }

    const chartData = Array.from(chartMap.entries()).map(([name, value]) => ({ name, value }));

    return {
        totalCash,
        activeDrivers,
        totalAssets,
        emptyCylinders,
        chartData,
        recentActivity
    };
}
