"use client";

import { useState } from "react";
import { signupSuperAdmin } from "@/app/actions/authActions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldAlert, Loader2, ArrowRight } from "lucide-react";

export default function SignupPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const password = formData.get("password") as string;
        const confirmPassword = formData.get("confirmPassword") as string;

        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            const result = await signupSuperAdmin(formData);

            if (result.error) {
                toast.error(result.error);
            } else if (result.success) {
                toast.success(result.message || "Account created! Redirecting...");
                if (result.redirect) {
                    router.push(result.redirect);
                } else {
                    // If email confirmation is needed
                    router.push("/login?message=Check your email to confirm account");
                }
            }
        } catch (err: any) {
            toast.error("Something went wrong: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-8 pb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <ShieldAlert size={24} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">Emergency Access</h1>
                    <p className="text-slate-500 mt-2">Create the <strong className="text-slate-900">Super Admin (Owner)</strong> account to restore system access.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 pt-0 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">System Email</label>
                        <input
                            name="email"
                            type="email"
                            required
                            placeholder="superadmin@example.com"
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Password</label>
                            <input
                                name="password"
                                type="password"
                                required
                                placeholder="••••••••"
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Confirm</label>
                            <input
                                name="confirmPassword"
                                type="password"
                                required
                                placeholder="••••••••"
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <>Restore Access <ArrowRight size={20} /></>}
                    </button>
                </form>

                <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                    <p className="text-xs text-slate-400 font-medium">This is a restricted administrative action.</p>
                </div>
            </div>
        </div>
    );
}
