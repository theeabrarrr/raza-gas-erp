'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function submitExpense(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Auth Check
    if (!user) return { error: "Unauthorized" };
    const tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) return { error: "Tenant ID missing" };

    // Parse Data
    const amount = parseFloat(formData.get('amount')?.toString() || '0');
    const category = formData.get('category')?.toString();
    const description = formData.get('description')?.toString() || '';
    const proofFile = formData.get('proof_file') as File;

    // Validation
    if (!amount || amount <= 0) return { error: "Invalid Amount" };
    if (!category) return { error: "Category is required" };
    if (!proofFile || proofFile.size === 0) return { error: "Proof of expense is required" };

    try {
        // 1. Upload Proof Image
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
            .from('expense-proofs')
            .upload(fileName, proofFile);

        if (uploadError) throw new Error(`Upload Failed: ${uploadError.message}`);

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('expense-proofs')
            .getPublicUrl(fileName);

        // 2. Insert into DB
        const { error: insertError } = await supabase
            .from('expenses')
            .insert({
                tenant_id: tenantId,
                user_id: user.id,
                amount: amount,
                category: category,
                description: description,
                proof_url: publicUrl,
                status: 'pending'
            });

        if (insertError) throw new Error(`DB Insert Failed: ${insertError.message}`);

        revalidatePath('/driver');
        return { success: true };

    } catch (err: any) {
        console.error("Submit Expense Error:", err);
        return { error: err.message || "Failed to submit expense" };
    }
}
