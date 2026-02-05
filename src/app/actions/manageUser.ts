'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

import { Database } from '@/types/database.types';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { getCurrentUserTenantId } from '@/lib/utils/tenantHelper';
import { logSecurityEvent } from '@/lib/utils/auditLogger';

/**
 * Get all staff users for the current tenant
 * SECURITY: Filters by authenticated user's tenant_id
 */
export async function getStaffUsers() {
    const supabase = await createServerClient()

    // 🔒 SECURITY FIX: Get current user's tenant_id
    let tenantId: string
    try {
        tenantId = await getCurrentUserTenantId() as string
    } catch (error) {
        return {
            success: false,
            error: 'Authentication required or tenant not assigned'
        }
    }

    // 🔒 SECURITY FIX: Filter by both role AND tenant_id
    // We join with profiles to get vehicle_number and phone_number if needed
    const { data, error } = await supabase
        .from('users')
        .select('*, profiles(vehicle_number, phone_number)')
        .eq('role', 'staff')
        .eq('tenant_id', tenantId)  // ✅ FIXED: Added tenant filter
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching staff:', error)
        return { success: false, error: error.message }
    }

    return { success: true, data }
}

/**
 * Get all drivers for the current tenant
 * SECURITY: Filters by authenticated user's tenant_id
 */
export async function getDriverUsers() {
    const supabase = await createServerClient()

    let tenantId: string
    try {
        tenantId = await getCurrentUserTenantId() as string
    } catch (error) {
        return {
            success: false,
            error: 'Authentication required'
        }
    }

    const { data, error } = await supabase
        .from('users')
        .select('*, profiles(vehicle_number, phone_number)')
        .eq('role', 'driver')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true, data }
}

/**
 * Get staff user by ID (with tenant verification)
 * SECURITY: Verifies the staff belongs to current user's tenant
 */
export async function getStaffUserById(userId: string) {
    const supabase = await createServerClient()

    let tenantId: string
    try {
        tenantId = await getCurrentUserTenantId() as string
    } catch (error) {
        return { success: false, error: 'Authentication required' }
    }

    const { data, error } = await supabase
        .from('users')
        .select('*, profiles(*)')
        .eq('id', userId)
        .eq('tenant_id', tenantId)
        .single()

    if (error) {
        return { success: false, error: 'Staff not found or access denied' }
    }

    return { success: true, data }
}

/**
 * Update staff user (with tenant verification)
 * SECURITY: Prevents cross-tenant updates
 */
export async function updateStaffUser(
    userId: string,
    updates: { name?: string; phone?: string; status?: string }
) {
    const supabase = await createServerClient()

    let tenantId: string
    try {
        tenantId = await getCurrentUserTenantId() as string
    } catch (error) {
        return { success: false, error: 'Authentication required' }
    }

    // 🔒 SECURITY: First verify the user belongs to current tenant
    const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, tenant_id')
        .eq('id', userId)
        .single()

    if (fetchError || !existingUser) {
        return { success: false, error: 'User not found' }
    }

    if (existingUser.tenant_id !== tenantId) {
        // 🚨 SECURITY: Attempted cross-tenant access
        await logSecurityEvent('cross_tenant_attempt', {
            userId: userId,
            targetResource: 'users',
            tenantId: tenantId, // The attacker's tenant (or current user's)
            attemptedTenantId: existingUser.tenant_id, // The target resource's tenant
            action: 'update_staff_user'
        });
        return { success: false, error: 'Access denied' }
    }

    // ✅ Safe to update now
    const { error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)

    if (updateError) {
        return { success: false, error: updateError.message }
    }

    return { success: true }
}

export async function updateUser(prevState: any, formData: FormData) {
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as string;
    const shift = formData.get('shift') as string;
    const phone = formData.get('phone') as string;
    const vehicleNumber = formData.get('vehicle_number') as string;

    if (!id || !name || !role) {
        return { error: 'Missing required fields' };
    }

    try {
        // 0. Fetch User to get Tenant ID (Critical for Profile Upsert)
        const { data: existingUser, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(id);
        if (fetchError || !existingUser?.user) throw new Error("User not found for update");

        const tenantId = existingUser.user.user_metadata?.tenant_id || existingUser.user.app_metadata?.tenant_id;

        // 1. Update Auth Metadata
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
            user_metadata: {
                name: name,
                role: role,
                shift: shift,
                phone_number: phone,
                vehicle_number: vehicleNumber,
                tenant_id: tenantId // Ensure persistence
            }
        });
        if (authError) throw authError;

        // 2. Update Public Table (Manual Sync to be safe)
        const { error: dbError } = await supabaseAdmin
            .from('users')
            .update({
                name: name,
                role: role,
                shift: shift,
                phone_number: phone
            })
            .eq('id', id);

        if (dbError) {
            throw new Error(`Auth updated but DB sync failed: ${dbError.message}`);
        }

        // 3. Update Profiles Table (Vehicle & Phone) WITH Tenant ID
        const profileData: Database['public']['Tables']['profiles']['Insert'] = {
            id: id,
            full_name: name,
            role: role as Database['public']['Enums']['user_role'], // Cast if role is enum
            phone_number: phone,
            vehicle_number: vehicleNumber,
            updated_at: new Date().toISOString()
        };

        // Only add tenant_id if found, otherwise rely on existing or default
        if (tenantId) profileData.tenant_id = tenantId;

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert(profileData);

        if (profileError) {
            console.error("Profile Update Error:", profileError);
            throw new Error(`Profile update failed: ${profileError.message}`);
        }

        revalidatePath('/admin/users');
        revalidatePath('/driver/profile'); // Ensure driver sees it too
        return { success: true, message: 'User updated successfully' };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function resetPassword(prevState: any, formData: FormData) {
    const id = formData.get('id') as string;
    const password = formData.get('password') as string;

    if (!id || !password) return { error: 'Password required' };

    try {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
            password: password
        });
        if (error) throw error;
        return { success: true, message: 'Password reset successfully' };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function toggleUserStatus(prevState: any, formData: FormData) {
    const id = formData.get('id') as string;
    const action = formData.get('action') as string; // 'activate' | 'deactivate'

    try {
        const banDuration = action === 'deactivate' ? '876000h' : 'none'; // 100 years or none
        const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
            ban_duration: banDuration
        });
        if (error) throw error;
        return { success: true, message: `User ${action}d successfully` };
    } catch (error: any) {
        return { error: error.message };
    }
}
