"use server";

import { createClient } from "@/utils/supabase/server";

export async function signupSuperAdmin(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
        return { error: "Email and password are required" };
    }

    const supabase = await createClient();

    // CRITICAL: Hardcoded Owner Tenant ID for the first Super Admin
    const OWNER_TENANT_ID = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                tenant_id: OWNER_TENANT_ID,
                role: 'super_admin',
                name: 'System Owner'
            }
        }
    });

    if (error) {
        return { error: error.message };
    }

    // Check if session exists (Auto-confirm enabled) or user needs to verify email
    if (data.session) {
        return { success: true, redirect: "/super-admin" };
    } else if (data.user) {
        return { success: true, message: "Please check your email to confirm account." };
    }

    return { error: "Unknown error occurred" };
}
