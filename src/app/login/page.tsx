'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

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
                .eq('id', user.id)
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
            if (role === 'admin') router.push('/admin');
            else if (role === 'driver') router.push('/driver');
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md overflow-hidden border-0 shadow-lg ring-1 ring-slate-900/5">
                <CardHeader className="bg-primary p-8 text-center text-primary-foreground relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/10 z-0"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="mb-8">
                            <div className="bg-emerald-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-emerald-600">
                                <Shield size={32} />
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">SaaS Login</h1>
                            <p className="text-slate-500 mt-2 font-medium">LPG Management System</p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-8 pt-8">
                    {errorMsg && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-destructive animate-in fade-in slide-in-from-top-2">
                            <AlertCircle size={20} className="shrink-0 mt-0.5" />
                            <p className="text-sm font-semibold">{errorMsg}</p>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-muted-foreground uppercase text-xs font-bold">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10"
                                    placeholder="admin@aligas.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-muted-foreground uppercase text-xs font-bold">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 text-base font-bold shadow-md shadow-primary/20"
                            isLoading={loading}
                        >
                            Sign In
                        </Button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-muted-foreground">
                            System Access is restricted. <br /> Contact Administrator for support.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
