import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    // 1. Verify Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        redirect('/login');
    }

    // 2. Verify Role (Secure)
    // We check public.users via auth_id
    const { data: dbUser } = await supabase
        .from('users')
        .select('role')
        .eq('auth_id', user.id)
        .single();

    if (!dbUser || dbUser.role !== 'admin') {
        // Redirect based on role, or kick out
        if (dbUser?.role === 'recovery') redirect('/recovery');
        if (dbUser?.role === 'driver') redirect('/driver');
        redirect('/login');
    }

    return (
        <div className="flex min-h-screen bg-slate-50/50">
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto h-screen">
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
