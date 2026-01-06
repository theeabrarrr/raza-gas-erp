"use client";

import { useState, useEffect } from "react";
import { getTenants, createTenant } from "@/app/actions/superAdminActions";
import { Plus, Building, Users, Activity, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import LogoutBtn from "@/components/LogoutBtn";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function SuperAdminPage() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTenantName, setNewTenantName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const router = useRouter();

    useEffect(() => {
        loadTenants();
    }, []);

    const loadTenants = async () => {
        try {
            const data = await getTenants();
            setTenants(data);
        } catch (error: any) {
            toast.error("Access Denied: " + error.message);
            if (error.message.includes("Unauthorized")) {
                router.push("/");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTenant = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        const name = newTenantName;
        const plan = formData.get('plan') as any;
        const owner_email = formData.get('owner_email') as string;
        const owner_password = formData.get('owner_password') as string;

        if (!name.trim() || !owner_email || !owner_password) return;

        setIsCreating(true);
        try {
            await createTenant({
                name,
                plan,
                owner_email,
                owner_password
            });
            toast.success("Tenant & Owner Account Created!");
            setNewTenantName("");
            (e.target as HTMLFormElement).reset(); // Reset form
            loadTenants();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsCreating(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-muted-foreground animate-pulse">Loading Dashboard...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                            <ShieldCheck className="text-primary" size={32} />
                            Super Admin
                        </h1>
                        <p className="text-muted-foreground font-medium">SaaS Tenant Management</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-white px-4 py-2 rounded-full border shadow-sm flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-bold text-muted-foreground">System Healthy</span>
                        </div>
                        <LogoutBtn />
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Create Tenant Card */}
                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Plus size={20} className="text-primary" />
                                Onboard New Tenant
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateTenant} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="orgName" className="text-xs font-bold text-muted-foreground uppercase">Organization Name</Label>
                                    <Input
                                        id="orgName"
                                        type="text"
                                        value={newTenantName}
                                        onChange={(e) => setNewTenantName(e.target.value)}
                                        placeholder="e.g. City Gas Distributors"
                                        className="bg-slate-50"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase">Subscription Plan</Label>
                                    <select
                                        className="w-full h-10 rounded-md border border-input bg-slate-50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        name="plan"
                                    >
                                        <option value="basic">Basic (Free)</option>
                                        <option value="standard">Standard (Paid)</option>
                                        <option value="premium">Premium (Enterprise)</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase">Owner Email</Label>
                                    <Input
                                        name="owner_email"
                                        type="email"
                                        placeholder="admin@company.com"
                                        className="bg-slate-50"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase">Initial Password</Label>
                                    <Input
                                        name="owner_password"
                                        type="password"
                                        placeholder="*******"
                                        className="bg-slate-50"
                                        required
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={isCreating}
                                    isLoading={isCreating}
                                >
                                    Create Organization & User
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Tenant List */}
                    <div className="lg:col-span-2">
                        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-slate-200">
                            <div className="p-6 border-b bg-white flex justify-between items-center">
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Building size={20} className="text-muted-foreground" />
                                    Active Tenants
                                </h2>
                                <Badge variant="secondary" className="px-3 py-1 text-xs">
                                    {tenants.length} Organizations
                                </Badge>
                            </div>

                            {tenants.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">
                                    No tenants found. Create one to get started.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 bg-white">
                                    {tenants.map(tenant => (
                                        <div key={tenant.id} className="p-6 hover:bg-slate-50 transition-colors group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">{tenant.name}</h3>
                                                    <p className="text-xs text-muted-foreground font-mono mt-1">{tenant.id}</p>
                                                </div>
                                                <Badge variant={tenant.subscription_status === 'active' ? 'success' : 'secondary'}>
                                                    {tenant.subscription_status}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-6 mt-4">
                                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                                    <Activity size={16} />
                                                    <span>Created {new Date(tenant.created_at).toLocaleDateString()}</span>
                                                </div>
                                                {/* Placeholder for future stats */}
                                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                                    <Users size={16} />
                                                    <span>-- Users</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
