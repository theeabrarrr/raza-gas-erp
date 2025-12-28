'use server';

import { createClient } from '@supabase/supabase-js';

// Note: We use the supabase-js client directly for Admin actions ensuring we bypass RLS with the Service Role Key
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

export async function createEmployee(prevState: any, formData: FormData) {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string; // Optional now
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const shift = formData.get('shift') as string;

    if (!name || !email || !password || !role || !shift) {
        return { error: 'Please fill in all required fields (Name, Email, Password, Role, Shift)' };
    }

    try {
        // 1. Create User in Supabase Auth
        // The Database Trigger 'on_auth_user_created' will handle:
        // - Inserting into 'users' table
        // - Creating 'employee_wallets' entry
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: name,
                role: role,
                shift: shift,
                phone: phone || '' // Store phone if provided, else empty
            },
        });

        if (authError) throw authError;
        if (!authUser.user) throw new Error('User creation failed');

        return { success: true, message: `Employee ${name} created successfully!` };
    } catch (error: any) {
        console.error('Create Employee Error:', error);
        return { error: error.message };
    }
}
