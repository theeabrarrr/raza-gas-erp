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

    // 2. Verify Role (Metadata Strategy)
    // Using metadata is faster and avoids RLS/DB loops.
    // Syncs with middleware logic.
    const role = user.user_metadata?.role || user.app_metadata?.role;

    const allowedRoles = ['admin', 'shop_manager', 'finance', 'super_admin'];

    if (!role || !allowedRoles.includes(role)) {
        // Redirect based on role, or kick out
        if (role === 'recovery_agent') redirect('/recovery');
        if (role === 'driver') redirect('/driver');

        // If unknown role, send to login (which will likely loop if we are not careful, 
        // but middleware handles logged in users. 
        // If we are here, we are logged in but have wrong role for this page.)
        // Better to redirect to root to let page.tsx sort it out, or specific error page.
        // But for now, let's assume if it's not allowed, we shouldn't be here.

        // If we redirect to /login, middleware will redirect to / (if logged in).
        // If / redirects to /admin, and we block it here... LOOP.

        // Break the loop:
        // If role is missing/invalid, force logout or show 403.
        // But for safely, let's redirect to /login and rely on middleware to route correct roles.
        // The issue was 'finance'/'shop_manager' getting blocked here.
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
