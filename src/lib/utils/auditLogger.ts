'use server'

import { createClient } from '@/utils/supabase/server'

export async function logSecurityEvent(
    eventType: 'cross_tenant_attempt' | 'unauthorized_access' | 'permission_denied',
    details: {
        userId?: string
        targetResource?: string
        tenantId?: string
        attemptedTenantId?: string
        action?: string
    }
) {
    const supabase = await createClient()

    try {
        const { error } = await supabase.from('security_audit_logs').insert({
            event_type: eventType,
            user_id: details.userId || null,
            target_resource: details.targetResource,
            tenant_id: details.tenantId,
            attempted_tenant_id: details.attemptedTenantId,
            action: details.action,
            timestamp: new Date().toISOString(),
            // IP and User Agent extraction would typically require headers() from next/headers
            // but for server actions called from client, we might rely on middleware or context if available.
            // For now, we'll leave them null or add if critical later.
            ip_address: null,
            user_agent: null
        })

        if (error) {
            console.error('Failed to write security log:', error)
        }
    } catch (err) {
        console.error('Exception writing security log:', err)
    }
}
