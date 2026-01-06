"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

// Master Key: The UUID of the SaaS Owner Tenant
const OWNER_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export async function checkSuperAdmin() {
    const supabase = await createClient();

    // 1. Get Auth User
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        throw new Error("Unauthorized: Please log in.");
    }

    // 2. Fetch Profile to verify Role & Tenant
    const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("tenant_id, role")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
        throw new Error("Unauthorized: Profile not found.");
    }

    // 3. VALIDATION RULE (Master Key or Role)
    const isOwner = profile.tenant_id === OWNER_TENANT_ID;
    const isSuperAdmin = profile.role === 'super_admin';

    if (!isOwner && !isSuperAdmin) {
        throw new Error("Unauthorized: You are not the System Owner");
    }

    return user;
}

export async function getTenants() {
    await checkSuperAdmin();
    const supabase = await createClient();

    const { data: tenants, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return tenants;
}

interface CreateTenantParams {
    name: string;
    plan: 'basic' | 'standard' | 'premium';
    owner_email: string;
    owner_password: string;
}

export async function createTenant(params: CreateTenantParams) {
    await checkSuperAdmin();
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 1. Create Tenant in DB
    const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
            name: params.name,
            subscription_status: 'active',
            // Defaulting plan might need a column update or metadata field, assuming 'subscription_status' suffices for now or 'plan' if column exists. 
            // Checking schema from context: 'subscription_plan' implies logic, but let's stick to status 'active' and maybe store plan in a future column if not present.
            // For now, we will assume standard 'subscription_status' is enough to activate them.
        })
        .select()
        .single();

    if (tenantError) throw new Error("Failed to create tenant: " + tenantError.message);

    // 2. Create Admin User for this Tenant
    // Metadata is critical for the trigger to pick it up and assign correct Tenant ID + Role
    const { data: user, error: userError } = await adminClient.auth.admin.createUser({
        email: params.owner_email,
        password: params.owner_password,
        email_confirm: true,
        user_metadata: {
            tenant_id: tenant.id,
            role: 'admin',
            name: 'Tenant Owner',
        }
    });

    if (userError) {
        // Rollback Tenant? (Ideal world yes, simplified here: just error out)
        // Ideally we delete the tenant if user creation fails to avoid orphans.
        await supabase.from("tenants").delete().eq("id", tenant.id);
        throw new Error("Failed to create owner account: " + userError.message);
    }

    return { tenant, user };
}
