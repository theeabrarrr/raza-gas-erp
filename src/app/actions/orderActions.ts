"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * ORDER ACTIONS - DOUBLE-LOCK SECURITY
 */

export async function getOrders() {
    const supabase = await createClient();

    // 1. Session & Metadata
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return [];

    const tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) {
        console.error("CRITICAL: Tenant ID missing in getOrders");
        return [];
    }

    // 2. Double-Lock Query
    // Joins 'customers' and 'users' (driver) - ensuring tenant isolation on main table is key
    const { data, error } = await supabase
        .from("orders")
        .select(`
            *,
            customers (name, address),
            driver:users (name)
        `)
        .eq("tenant_id", tenantId) // Double Lock
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching orders:", error);
        return [];
    }

    return data || [];
}

// 3. SECURE CREATE ORDER (Full Transaction)
export async function createOrder(prevState: any, formData: FormData) {
    const supabase = await createClient();

    // 1. Session & Metadata
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;

    if (!user || !tenantId) {
        return { error: "Unauthorized: Tenant Context Missing" };
    }

    // Extract Data
    const customerId = formData.get("customer_id")?.toString();
    const driverId = formData.get("driver_id")?.toString();
    const cylindersCount = parseInt(formData.get("cylinders_count")?.toString() || "0");
    const totalAmount = parseFloat(formData.get("total_amount")?.toString() || "0");
    const productName = formData.get("product_name")?.toString() || "LPG Cylinder";
    const price = parseFloat(formData.get("price")?.toString() || "0");

    // Serials (Passed as JSON string)
    const serialsJson = formData.get("serials")?.toString();
    const explicitSerials: string[] = serialsJson ? JSON.parse(serialsJson) : [];

    // Validation
    if (!customerId || !driverId) return { error: "Customer and Driver are required" };
    if (cylindersCount < 1) return { error: "Invalid Quantity" };

    // STOCK CHECK & SELECTION
    // We need to identify WHICH cylinders to move.
    // Case A: Manual Selection (Explicit Serials)
    // Case B: Auto Dispatch (FIFO from Warehouse)

    let targetCylinderIds: string[] = [];
    let assignedSerials: string[] = [];

    if (explicitSerials.length > 0) {
        // Validate explicit serials match quantity
        if (explicitSerials.length !== cylindersCount) {
            return { error: `Serial mismatch: Expected ${cylindersCount}, got ${explicitSerials.length}` };
        }

        // Fetch these specific cylinders to ensure they are in godown
        const { data: explicitStock, error: stockError } = await supabase
            .from('cylinders')
            .select('id, serial_number, current_location_type')
            .in('serial_number', explicitSerials)
            .eq('tenant_id', tenantId);

        if (stockError || !explicitStock) return { error: "Error verifying selected cylinders" };

        // Verify all are in godown
        const invalid = explicitStock.filter(c => c.current_location_type !== 'warehouse');
        if (invalid.length > 0) {
            return { error: `Some selected cylinders are not in Warehouse: ${invalid.map(c => c.serial_number).join(', ')}` };
        }

        targetCylinderIds = explicitStock.map(c => c.id);
        assignedSerials = explicitStock.map(c => c.serial_number);

    } else {
        // Auto-Selection (FIFO)
        // 1. Check Total Available
        const { count, error: countError } = await supabase
            .from('cylinders')
            .select('*', { count: 'exact', head: true })
            .eq('current_location_type', 'warehouse')
            .eq('status', 'full')
            .eq('tenant_id', tenantId);

        if (countError) return { error: "Failed to check stock levels" };

        const available = count || 0;
        if (available < cylindersCount) {
            return { error: `Cannot Dispatch ${cylindersCount}. Only ${available} Available in Warehouse.` };
        }

        // 2. Lock/Select N Cylinders
        // We select ID to lock them for update
        const { data: autoStock, error: autoError } = await supabase
            .from('cylinders')
            .select('id, serial_number')
            .eq('current_location_type', 'warehouse')
            .eq('status', 'full')
            .eq('tenant_id', tenantId)
            .limit(cylindersCount);

        if (autoError || !autoStock || autoStock.length < cylindersCount) {
            return { error: "Race Condition: Stock changed during checkout. Please try again." };
        }

        targetCylinderIds = autoStock.map(c => c.id);
        assignedSerials = autoStock.map(c => c.serial_number);
    }


    // 2. Perform Updates (Pseudo-Transaction via Server Action)

    // A. Create Order
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            tenant_id: tenantId, // <--- FORCE OVERRIDE
            customer_id: customerId,
            driver_id: driverId, // Assign to driver
            cylinders_count: cylindersCount,
            total_amount: totalAmount,
            status: 'assigned', // Visible to driver immediately
            payment_method: 'pending',
            created_by: user.id
        })
        .select()
        .single();

    if (orderError) {
        console.error("Create Order Error:", orderError);
        return {
            error: `Failed to create order: ${orderError.message}`,
            details: orderError.details,
            hint: orderError.hint
        };
    }

    // B. Create Order Items
    const { error: itemError } = await supabase.from('order_items').insert({
        order_id: order.id,
        product_name: productName,
        quantity: cylindersCount,
        price: price
    });

    if (itemError) {
        console.error("Create Item Error:", itemError);
        // Note: In a real DB transaction, we would rollback here. 
    }

    // C. Update Cylinders (Assign to Driver)
    // CRITICAL: We move the PRE-VALIDATED ids
    const { error: cylinderError } = await supabase
        .from('cylinders')
        .update({
            // status: 'full', // Already full
            current_location_type: 'driver',
            current_holder_id: driverId,
            last_order_id: order.id,
            updated_at: new Date().toISOString()
        })
        .in('id', targetCylinderIds)
        .eq('tenant_id', tenantId); // Double Lock

    if (cylinderError) {
        console.error("Cylinder Update Error:", cylinderError);
        return { error: "Order created but asset assignment failed. Please check system logs." };
    }

    revalidatePath("/admin/orders");
    return { success: true, orderId: order.id, assignedSerials };
}
