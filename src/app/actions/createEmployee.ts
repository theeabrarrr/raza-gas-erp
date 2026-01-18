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

    const finalPhone = phoneNumber || phone || '';

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

        // 2. Resolve Tenant ID (Robustly)
        let tenantId = adminAuth.app_metadata?.tenant_id || adminAuth.user_metadata?.tenant_id;

        if (!tenantId) {
            // Fallback: Check DB via auth_id
            const { data: dbAdmin } = await supabaseAdmin
                .from('users')
                .select('tenant_id')
                .eq('auth_id', adminAuth.id)
                .single();
            if (dbAdmin) tenantId = dbAdmin.tenant_id;
        }

        if (!tenantId) {
            // Fallback 2: Check DB via ID (Legacy)
            const { data: dbAdminLegacy } = await supabaseAdmin
                .from('users')
                .select('tenant_id')
                .eq('id', adminAuth.id)
                .single();
            if (dbAdminLegacy) tenantId = dbAdminLegacy.tenant_id;
        }

        if (!tenantId) {
            return { error: 'Critical Security Error: Tenant Context Missing. Cannot proceed.' };
        }

        // 3. Create User in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                name: name,
                role: role,
                shift: shift,
                phone_number: finalPhone,
                vehicle_number: vehicleNumber || '',
                tenant_id: tenantId
            },
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('User creation failed');

        const authUserId = authData.user.id;

        // 4. Create Public User (The Missing Link)
        const { data: publicUser, error: publicError } = await supabaseAdmin
            .from('users')
            .insert({
                auth_id: authUserId, // LINK AUTH!
                email: email,
                name: name,
                role: role,
                tenant_id: tenantId,
                phone: finalPhone,
                phone_number: finalPhone,
                shift: shift
            })
            .select('id')
            .single();

        if (publicError) {
            // ROLLBACK 1: Delete Auth User
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            console.error("Public User Insert Failed:", publicError);
            return { error: `Database Error: ${publicError.message}` };
        }

        const publicUserId = publicUser.id;

        // 5. Create Wallet
        const { error: walletError } = await supabaseAdmin
            .from('employee_wallets')
            .insert({
                user_id: publicUserId,
                balance: 0,
                tenant_id: tenantId
            });

        if (walletError) {
            // ROLLBACK 2: Delete Public User + Auth User
            await supabaseAdmin.from('users').delete().eq('id', publicUserId);
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            return { error: `Wallet Creation Failed: ${walletError.message}` };
        }

        // 6. Create Profile (Legacy)
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: authUserId, // LINK TO AUTH USER (Satisfies FK to auth.users)
                full_name: name,
                role: role,
                tenant_id: tenantId,
                phone_number: finalPhone,
                vehicle_number: vehicleNumber || ''
            });

        if (profileError) {
            // ROLLBACK 3: Delete Wallet + Public User + Auth User
            await supabaseAdmin.from('employee_wallets').delete().eq('user_id', publicUserId);
            await supabaseAdmin.from('users').delete().eq('id', publicUserId);
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            return { error: `Profile Creation Failed: ${profileError.message}` };
        }

        return { success: true, message: `Employee ${name} created successfully!` };
    } catch (error: any) {
        console.error('Create Employee Error:', error);
        return { error: error.message };
    }
}
