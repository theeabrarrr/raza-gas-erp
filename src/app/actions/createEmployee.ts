'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Admin client for bypassing RLS during user creation
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

export async function createEmployee(prevState: any, formData: FormData) {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const shift = formData.get('shift') as string;
    const phone = formData.get('phone') as string;
    const vehicleNumber = formData.get('vehicle_number') as string;
    const phoneNumber = formData.get('phone_number') as string;

    if (!name || !email || !password || !role || !shift) {
        return { error: 'Please fill in all required fields (Name, Email, Password, Role, Shift)' };
    }

    try {
        // 1. Get current Authenticated Admin
        const supabase = await createClient();
        const { data: { user: adminAuth }, error: adminAuthError } = await supabase.auth.getUser();

        if (adminAuthError || !adminAuth) {
            return { error: 'Unauthorized: You must be logged in to create employees.' };
        }

        // 2. Get Admin's Tenant ID from public.users
        const { data: adminUser, error: adminDbError } = await supabase
            .from('users')
            .select('tenant_id')
            .eq('id', adminAuth.id)
            .single();

        if (adminDbError || !adminUser || !adminUser.tenant_id) {
            console.error('Tenant Context Missing:', adminDbError);
            return { error: 'Critical Security Error: Tenant Context Missing. Cannot proceed.' };
        }

        const adminTenantId = adminUser.tenant_id;

        // 3. Create User in Supabase Auth with Tenant ID
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                name: name,
                role: role,
                shift: shift,
                phone_number: phoneNumber || phone || '', // Fallback to 'phone' if passed
                vehicle_number: vehicleNumber || '',
                tenant_id: adminTenantId
            },
        });

        if (authError) throw authError;
        if (!authUser.user) throw new Error('User creation failed');

        // 4. SYNC TO PROFILES (Crucial Step for Driver App)
        // trigger usually handles 'users' table, but we ensure 'profiles' has the extra data
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: authUser.user.id,
                full_name: name,
                role: role,
                phone_number: phoneNumber || phone || '',
                vehicle_number: vehicleNumber || '',
                updated_at: new Date().toISOString()
            });

        if (profileError) {
            console.error("Profile Sync Warning:", profileError);
            // We don't block success, but we log the error
        }

        return { success: true, message: `Employee ${name} created successfully!` };
    } catch (error: any) {
        console.error('Create Employee Error:', error);
        return { error: error.message };
    }
}
