'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
    const supabase = createClient();
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
            // 1. Authenticate
            const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                if (authError.message.includes('Invalid login credentials')) {
                    throw new Error('Incorrect Email or Password.');
                }
                throw authError;
            }

            if (!user) throw new Error('Authentication failed. Please try again.');

            // 2. Fetch Profile
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('auth_id', user.id)
                .maybeSingle();

            if (profileError) {
                console.error('Profile Fetch Error:', profileError);
                throw new Error('System Error: Unable to retrieve user profile.');
            }

            // 3. Verify Identity
            if (!profile) {
                throw new Error('Account Setup Incomplete: Identity Missing. Please contact Admin.');
            }

            // 4. Check Role
            const role = profile.role;
            if (!role) {
                throw new Error('Access Denied: No role assigned.');
            }

            // Success
            toast.success(`Welcome back, ${profile.name || 'User'}`);

            // Redirect
            // Redirect
            if (role === 'super_admin') router.push('/super-admin');
            else if (role === 'admin') router.push('/admin');
            else if (role === 'driver') router.push('/driver');
            else if (role === 'recovery_agent') router.push('/recovery');
            else router.push('/');

        } catch (error: any) {
            console.error('Login Error:', error);
            setErrorMsg(error.message || 'An unexpected error occurred.');
            toast.error(error.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50/50 to-slate-50">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="mx-auto h-12 w-12 text-emerald-600 flex items-center justify-center">
                    <Shield size={48} />
                </div>
                <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900">
                    Sign in to your account
                </h2>
                <div className="mt-2 text-center">
                    <p className="text-sm text-slate-600">Enter your credentials to access the workspace</p>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[480px]">
                <div className="bg-white py-10 px-10 shadow-2xl rounded-2xl border border-slate-100 border-t-4 border-t-emerald-500">
                    {errorMsg && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-destructive animate-in fade-in slide-in-from-top-2">
                            <AlertCircle size={20} className="shrink-0 mt-0.5" />
                            <p className="text-sm font-semibold">{errorMsg}</p>
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                                Email Address
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full h-12 rounded-lg bg-slate-50 border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all sm:text-sm outline-none px-4"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                                Password
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full h-12 rounded-lg bg-slate-50 border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all sm:text-sm outline-none px-4"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex w-full justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {loading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="mt-8 text-center text-xs text-slate-400">
                    <p>© 2026 LPG Management System. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
}
