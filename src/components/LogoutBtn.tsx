"use client";

import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";

interface LogoutBtnProps {
    className?: string;
    iconOnly?: boolean;
}

export default function LogoutBtn({ className, iconOnly = false }: LogoutBtnProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        setLoading(true);
        try {
            const promise = async () => {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                router.push("/login?message=Logged out successfully");
                router.refresh();
            };

            await toast.promise(promise(), {
                loading: "Logging out...",
                success: "Logged out successfully",
                error: (err) => `Error logging out: ${err.message}`,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleLogout}
            disabled={loading}
            className={`flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${className}`}
            title="Sign Out"
        >
            <LogOut size={20} />
            {!iconOnly && <span className="font-bold">Logout</span>}
        </button>
    );
}
