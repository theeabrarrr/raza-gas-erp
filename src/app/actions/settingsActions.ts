'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// --- TYPES ---
export interface OrgSettings {
    id: string;
    company_name: string;
    company_address: string;
    company_phone: string;
    invoice_footer: string;
    default_gas_rate: number;
    low_stock_threshold: number;
}

// --- 1. FETCH SETTINGS ---
export async function getSettings() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('tenant_id', user.app_metadata.tenant_id)
        .single();

    if (error) {
        console.error("Fetch Settings Error:", error);
        return { error: 'Failed to load settings' };
    }

    return { settings: data as OrgSettings };
}

// --- 2. UPDATE BRANDING & CONFIG ---
export async function updateSettings(prevState: any, formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const tenant_id = user.app_metadata.tenant_id;

    // Extract Data
    const updates = {
        company_name: formData.get('company_name'),
        company_address: formData.get('company_address'),
        company_phone: formData.get('company_phone'),
        invoice_footer: formData.get('invoice_footer'),
        default_gas_rate: parseFloat(formData.get('default_gas_rate') as string || '0'),
        low_stock_threshold: parseInt(formData.get('low_stock_threshold') as string || '15'),
        updated_at: new Date().toISOString()
    };

    const { error } = await supabase
        .from('organization_settings')
        .update(updates)
        .eq('tenant_id', tenant_id);

    if (error) {
        console.error("Update Settings Error:", error);
        return { error: 'Failed to update settings' };
    }

    revalidatePath('/admin/settings');
    revalidatePath('/invoice/[id]', 'page'); // Revalidate invoices
    return { success: true, message: 'Settings saved successfully' };
}

// --- 3. SECURITY: CHANGE PASSWORD ---
export async function changePassword(prevState: any, formData: FormData) {
    const supabase = await createClient();

    const password = formData.get('new_password') as string;
    const confirm = formData.get('confirm_password') as string;

    if (!password || password.length < 6) {
        return { error: 'Password must be at least 6 characters' };
    }
    if (password !== confirm) {
        return { error: 'Passwords do not match' };
    }

    const { error } = await supabase.auth.updateUser({
        password: password
    });

    if (error) {
        return { error: error.message };
    }

    return { success: true, message: 'Password updated successfully' };
}
