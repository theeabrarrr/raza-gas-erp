'use server'

import { createClient } from '@/utils/supabase/server'

/**
 * Get the tenant_id of the currently authenticated user
 * @returns tenant_id UUID or null if not found
 * @throws Error if user is not authenticated
 */
export async function getCurrentUserTenantId(): Promise<string | null> {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        throw new Error('User not authenticated')
    }

    // Fetch user's tenant_id from users table
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single()

    if (userError) {
        console.error('Error fetching user tenant:', userError)
        throw new Error('Failed to fetch user tenant')
    }

    if (!userData?.tenant_id) {
        throw new Error('User has no tenant assigned')
    }

    return userData.tenant_id
}

/**
 * Verify that a given tenant_id matches the current user's tenant
 * @param tenantId - Tenant ID to verify
 * @returns true if match, false otherwise
 */
export async function verifyTenantAccess(tenantId: string): Promise<boolean> {
    try {
        const userTenantId = await getCurrentUserTenantId()
        return userTenantId === tenantId
    } catch (error) {
        console.error('Tenant verification failed:', error)
        return false
    }
}

/**
 * Get current user's full profile including role
 * @returns User object with tenant_id and role
 */
export async function getCurrentUser() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        throw new Error('User not authenticated')
    }

    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

    if (userError || !userData) {
        throw new Error('Failed to fetch user profile')
    }

    return userData
}
