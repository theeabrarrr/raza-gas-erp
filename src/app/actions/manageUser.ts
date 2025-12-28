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

export async function updateUser(prevState: any, formData: FormData) {
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as string;
    const shift = formData.get('shift') as string;
    const phone = formData.get('phone') as string;

    if (!id || !name || !role) {
        return { error: 'Missing required fields' };
    }

    try {
        // 1. Update Auth Metadata
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
            user_metadata: {
                full_name: name,
                role: role,
                shift: shift,
                phone: phone
            }
        });
        if (authError) throw authError;

        // 2. Update Public Table (Manual Sync to be safe)
        // We explicitly update 'shift' and 'phone' as well globally to ensure public.users is in sync.
        const { error: dbError } = await supabaseAdmin
            .from('users')
            .update({
                full_name: name,
                role: role,
                shift: shift, // Now explicitly updating shift
                phone: phone
            })
            .eq('id', id);

        if (dbError) {
            console.error('Error syncing to public.users:', dbError);
            // We don't throw here to avoid failing the whole request if Auth succeeded, 
            // but for this user's strict requirement, we perhaps should or at least return a warning?
            // User asked: "Check karo ke agar metadata update success ho jaye par database update fail ho, toh error show hona chahiye."
            // So we MUST return an error or at least a warning.
            throw new Error(`Auth updated but DB sync failed: ${dbError.message}`);
        }

        revalidatePath('/admin/users');
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
