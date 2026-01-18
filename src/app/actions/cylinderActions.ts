"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * DOUBLE-LOCK SECURITY PATTERN
 * 1. Metadata Extration: tenant_id from user.app_metadata
 * 2. Explicit Filtering: .eq('tenant_id', tenantId) on ALL reads
 * 3. Write Override: Force tenant_id on ALL writes
 */

export async function getAvailableStock() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;

    if (!tenantId) return [];

    const { data, error } = await supabase
        .from('cylinders')
        .select('id, serial_number, type')
        // Strict Filters
        .eq('type', '45.4KG')
        .eq('status', 'full')
        .eq('current_location_type', 'warehouse')
        .eq('tenant_id', tenantId)
        .order('serial_number');

    if (error) {
        console.error("Error fetching stock:", error);
        return [];
    }

    return data || [];
}

export async function getCylinders() {
    const supabase = await createClient();

    // 1. Session & Metadata Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return [];

    const tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) {
        console.error("CRITICAL: Tenant ID missing in getCylinders");
        return [];
    }

    // 2. Fetch All Cylinders (Double-Lock)
    const { data: cylinders, error } = await supabase
        .from("cylinders")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching cylinders:", error);
        return [];
    }

    if (!cylinders || cylinders.length === 0) return [];

    // 3. Extract IDs for polymorphic join
    const driverIds = new Set<string>();
    const customerIds = new Set<string>();

    cylinders.forEach((cyl: any) => {
        if (cyl.current_location_type === 'driver' && cyl.current_holder_id) {
            driverIds.add(cyl.current_holder_id);
        } else if (cyl.current_location_type === 'customer' && cyl.current_holder_id) {
            customerIds.add(cyl.current_holder_id);
        }
    });

    // 4. Fetch Names in Parallel
    const [driversResult, customersResult] = await Promise.all([
        driverIds.size > 0 ? supabase.from("users").select("id, name").in("id", Array.from(driverIds)) : Promise.resolve({ data: [] }),
        customerIds.size > 0 ? supabase.from("customers").select("id, name").in("id", Array.from(customerIds)) : Promise.resolve({ data: [] })
    ]);

    const driverMap = new Map<string, string>();
    driversResult.data?.forEach((d: any) => driverMap.set(d.id, d.name));

    const customerMap = new Map<string, string>();
    customersResult.data?.forEach((c: any) => customerMap.set(c.id, c.name));

    // 5. Map Names to Cylinders
    const enhancedCylinders = cylinders.map((cyl: any) => {
        let holderName = "Unknown";
        if (cyl.current_location_type === 'warehouse') {
            holderName = "Warehouse";
        } else if (cyl.current_location_type === 'driver') {
            holderName = driverMap.get(cyl.current_holder_id) || `Unknown Driver (${cyl.current_holder_id?.slice(0, 4) || '?'})`;
        } else if (cyl.current_location_type === 'customer') {
            holderName = customerMap.get(cyl.current_holder_id) || `Unknown Customer (${cyl.current_holder_id?.slice(0, 4) || '?'})`;
        }

        return {
            ...cyl,
            holder_name: holderName
        };
    });

    return enhancedCylinders;
}

export async function createCylinder(prevState: any, formData: FormData) {
    const supabase = await createClient();

    // 1. Session & Metadata Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;

    if (authError || !user || !tenantId) {
        return { error: "Unauthorized: Tenant Context Missing" };
    }

    // Extract Data
    const serialNumber = formData.get("serial_number")?.toString();
    const type = formData.get("type")?.toString();
    const status = formData.get("status")?.toString() || "empty";

    if (!serialNumber || !type) {
        return { error: "Missing required fields" };
    }

    // 2. Force Tenant ID on Write
    const { error } = await supabase.from("cylinders").insert({
        tenant_id: tenantId, // <--- FORCE OVERRIDE
        serial_number: serialNumber,
        type: type,
        status: status,
        current_location_type: 'warehouse', // Default new cylinders to Warehouse
        current_holder_id: null
    });

    if (error) {
        console.error("Create Cylinder Error:", error);
        return { error: error.message };
    }

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/cylinders");
    return { success: true };
}

export async function updateCylinderStatus(id: string, newStatus: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;

    if (!tenantId) throw new Error("Unauthorized");

    // Double-Lock Update
    const { error } = await supabase
        .from("cylinders")
        .update({ status: newStatus })
        .eq("id", id)
        .eq("tenant_id", tenantId); // <--- FORCE FILTER

    if (error) {
        console.error("Update Status Error:", error);
        throw new Error(error.message);
    }

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/cylinders");
}

export async function bulkCreateCylinders(prevState: any, formData: FormData) {
    const supabase = await createClient();

    // 1. Session & Metadata Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;

    if (authError || !user || !tenantId) {
        return { error: "Unauthorized: Tenant Context Missing" };
    }

    // 2. Parse Payload
    const rawPayload = formData.get("payload")?.toString();
    if (!rawPayload) return { error: "No data provided" };

    let items: any[] = [];
    try {
        items = JSON.parse(rawPayload);
    } catch (e) {
        return { error: "Invalid JSON data" };
    }

    if (!Array.isArray(items) || items.length === 0) {
        return { error: "Empty or invalid list" };
    }

    // 3. Prepare Data with Forced Tenant ID
    const validItems = items.map(item => ({
        tenant_id: tenantId, // <--- FORCE OVERRIDE
        serial_number: item.serial_number,
        type: item.type || '45.4KG',
        status: item.status || 'full',
        current_location_type: 'warehouse',
        current_holder_id: null,
        condition: 'good'
    }));

    // 4. Bulk Insert
    const { error } = await supabase.from("cylinders").insert(validItems);

    if (error) {
        console.error("Bulk Create Error:", error);
        // User friendly overlap error
        if (error.code === '23505') return { error: "Some serial numbers already exist. Please check your file." };
        return { error: error.message };
    }

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/cylinders");
    return { success: true, count: validItems.length };
}

export async function sendToPlant(quantity: number) {
    const supabase = await createClient();

    // 1. Session & Metadata Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;

    if (authError || !user || !tenantId) return { error: "Unauthorized" };

    // 2. Fetch oldest 'empty' cylinders (Double-Lock + Warehouse Check)
    const { data: cylinders, error: fetchError } = await supabase
        .from("cylinders")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("status", "empty")
        .eq("current_location_type", "warehouse") // <--- STRICT SECURITY
        .order("created_at", { ascending: true }) // Oldest first
        .limit(quantity);

    if (fetchError) return { error: fetchError.message };
    if (!cylinders || cylinders.length === 0) return { error: "No empty cylinders found in Warehouse to send." };

    const ids2Update = cylinders.map(c => c.id);

    // 3. Update Status (Double-Lock)
    const { error: updateError } = await supabase
        .from("cylinders")
        .update({ status: "maintenance" }) // Using 'maintenance' to represent 'at plant/refilling'
        .in("id", ids2Update)
        .eq("tenant_id", tenantId);

    if (updateError) return { error: updateError.message };

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/cylinders");
    return { success: true, count: ids2Update.length };
}

export async function receiveFromPlant(quantity: number) {
    const supabase = await createClient();

    // 1. Session & Metadata Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;

    if (authError || !user || !tenantId) return { error: "Unauthorized" };

    // 2. Fetch 'maintenance' cylinders
    const { data: cylinders, error: fetchError } = await supabase
        .from("cylinders")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("status", "maintenance")
        .limit(quantity);

    if (fetchError) return { error: fetchError.message };
    if (!cylinders || cylinders.length === 0) return { error: "No cylinders at plant found." };

    const ids2Update = cylinders.map(c => c.id);

    // 3. Update Status (Reset Location to Warehouse)
    const { error: updateError } = await supabase
        .from("cylinders")
        .update({
            status: "full",
            current_location_type: 'warehouse', // <--- STRICT RESET
            current_holder_id: null
        })
        .in("id", ids2Update)
        .eq("tenant_id", tenantId);

    if (updateError) return { error: updateError.message };

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/cylinders");
    return { success: true, count: ids2Update.length };
}


// 6. UPDATE CYLINDER (Rename / Edit)
export async function updateCylinder(id: string, newSerial: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;

    if (!tenantId) return { error: "Unauthorized" };

    const { error } = await supabase
        .from('cylinders')
        .update({ serial_number: newSerial })
        .eq('id', id)
        .eq('tenant_id', tenantId);

    if (error) {
        console.error("Update Serial Error:", error);
        return { error: error.message };
    }

    revalidatePath("/admin/cylinders");
    return { success: true };
}

// 7. DELETE CYLINDER
export async function deleteCylinder(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;

    if (!tenantId) return { error: "Unauthorized" };

    const { error } = await supabase
        .from('cylinders')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

    if (error) {
        console.error("Delete Cylinder Error:", error);
        return { error: error.message };
    }

    revalidatePath("/admin/cylinders");
    return { success: true };
}
