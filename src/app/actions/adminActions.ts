"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

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

    // 1. Get Current User & Tenant ID from Session
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("Auth error:", authError);
        return [];
    }

    // 2. CRITICAL: Get ID from metadata (The JWT Payload)
    const tenantId = user.app_metadata?.tenant_id;

    if (!tenantId) {
        console.error("CRITICAL: Tenant ID missing from user metadata. Security Context Invalid.");
        return [];
    }

    // 3. The Query with DOUBLE LOCK (RLS + Explicit Filter)
    const { data: users, error } = await supabase
        .from("users")
        .select("*")
        .eq("tenant_id", tenantId) // <--- FORCE FILTER
        .neq("role", "super_admin") // <--- EXCLUDE SUPER ADMIN
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching users:", error);
        return [];
    }

    // ... previous code

    return users || [];
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

    console.log("Admin Action: Fetching Handovers for User:", user?.id);
    console.log("Admin Action: Derived Tenant ID:", tenantId);

    const { data } = await supabase
        .from('view_admin_approvals')
        .select('*') // Driver/User ID is now explicitly part of the view
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

    if (data && data.length > 0) {
        console.log("DEBUG: Admin View Sample:", data[0]);
    } else {
        console.log("DEBUG: Admin View Returned Empty");
    }

    return data || [];
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

    console.log("DEBUG: Pending Cylinders Found:", data?.length, "Sample:", data?.[0]);

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
