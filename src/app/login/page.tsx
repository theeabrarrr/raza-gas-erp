'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Shield, ChevronRight, Lock, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // STEP 1: Auth (Get Session)
            console.log("Attempting SignIn...");
            const { data: { user }, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error("SignIn Error:", error);
                throw error;
            }
            if (!user) throw new Error('No user found');
            console.log("SignIn Success:", user.id);

            // STEP 2: Get User Profile (Explicit Schema)
            console.log("Fetching Profile...");
            // @ts-ignore - Explicitly using schema.table string to bypass potential type ambiguity
            const { data: profile, error: profileError } = await supabase
                .from('public.users')
                .select('id, name, role, shift, is_online')
                .eq('id', user.id)
                .single();

            if (profileError) {
                console.warn("Profile fetch warning:", profileError);
                // Don't crash, try to proceed if we have a user, or throw if critical
                // But for Driver Login, we often need the role.
            } else {
                console.log("Profile Fetched:", profile);
            }

            // STEP 3: Get Wallet (Explicit Schema)
            console.log("Fetching Wallet...");
            // @ts-ignore
            const { data: wallet, error: walletError } = await supabase
                .from('public.employee_wallets')
                .select('balance, id')
                .eq('user_id', user.id)
                .single();

            if (walletError && walletError.code !== 'PGRST116') { // Ignore "No Rows Found" (406 in some clients)
                console.warn("Wallet fetch warning (non-critical):", walletError);
            }

            if (walletError) console.warn("Wallet Error:", walletError);
            else console.log("Wallet Fetched:", wallet);

            const role = profile?.role || 'driver';
            const userName = profile?.name || email.split('@')[0];

            toast.success(`Welcome, ${userName}!`);

            // STEP 4: Routing
            if (['admin', 'owner', 'manager', 'cashier'].includes(role)) {
                router.push('/');
            } else if (role === 'driver') {
                router.push('/driver');
            } else if (role === 'recovery') {
                router.push('/recovery');
            } else {
                router.push('/');
            }

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">

                {/* Header */}
                <div className="bg-emerald-600 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-emerald-700/20 z-0"></div>
                    <div className="relative z-10">
                        <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 text-white">
                            <Shield size={32} />
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Raza Gas</h1>
                        <p className="text-emerald-100 font-medium text-sm">Secure ERP Access</p>
                    </div>
                </div>

                {/* Form */}
                <div className="p-8">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="admin@razagas.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <>
                                    Sign In <ChevronRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-xs text-slate-400">
                            Protected specific access only. <br /> Contact Master Admin for credentials.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}
