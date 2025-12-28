'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Shield, ChevronRight, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);

        try {
            // 1. Authenticate with Supabase Auth
            const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                if (authError.message.includes('Invalid login credentials')) {
                    throw new Error('Incorrect Email or Password.');
                }
                throw authError; // Throw original for other cases
            }

            if (!user) throw new Error('Authentication outcome unknown. Please try again.');

            // 2. Fetch User Profile from Public Table
            // Using 'maybeSingle' to handle missing profiles gracefully without throwing immediatley
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (profileError) {
                console.error('Profile Fetch Error:', profileError);
                throw new Error('System Error: Unable to retrieve user profile.');
            }

            // 3. Verify Identity/Profile Exists
            if (!profile) {
                // This is the "Ghost User" scenario
                // We can offer a specific message or actions here.
                throw new Error('Account Setup Incomplete: Identity Missing. Please contact Admin.');
            }

            // 4. Check Role Access
            const role = profile.role;
            if (!role) {
                throw new Error('Access Denied: No role assigned to this account.');
            }

            // Success
            toast.success(`Welcome back, ${profile.name || 'User'}`);

            // Redirect based on role
            if (role === 'admin') {
                router.push('/admin');
            } else if (role === 'driver') {
                router.push('/driver');
            } else {
                router.push('/');
            }

        } catch (error: any) {
            console.error('Login Error:', error);
            setErrorMsg(error.message || 'An unexpected error occurred.');
            toast.error(error.message || 'Login failed');
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
                    {errorMsg && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle size={20} className="shrink-0 mt-0.5" />
                            <p className="text-sm font-semibold">{errorMsg}</p>
                        </div>
                    )}

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
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-300"
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
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-300"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
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
                            System Access is restricted. <br /> Contact Administrator for support.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}
