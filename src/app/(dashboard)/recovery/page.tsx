import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getRecoveryStats, getDueCustomers, getRecoveryReceivers } from "@/app/actions/recoveryActions";
import { Card, CardContent } from "@/components/ui/card";
import { HandoverDialog } from "@/components/recovery/HandoverDialog";
import { CollectionDrawer } from "@/components/recovery/CollectionDrawer";
import { MapPin, Phone, Wallet, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RecoveryDashboard() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return redirect("/login");

    const stats = await getRecoveryStats();
    const dueCustomers = await getDueCustomers();
    const receivers = await getRecoveryReceivers();

    // Get User Name from metadata or fallback
    const agentName = user.user_metadata?.full_name || user.user_metadata?.name || "Agent";

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 pb-20 font-sans">
            {/* 1. HERO SECTION & HEADER */}
            <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 pt-8 pb-20 px-6 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden">

                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl -ml-10 pointer-events-none"></div>

                <div className="relative z-10 flex justify-between items-start mb-6">
                    <div>
                        <p className="text-emerald-100/80 text-sm font-medium tracking-wide mb-1 uppercase">Welcome Back</p>
                        <h1 className="text-2xl font-bold text-white tracking-tight">{agentName}</h1>
                        <p className="text-emerald-200/70 text-xs mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="h-10 w-10 bg-emerald-800/50 backdrop-blur-md rounded-full flex items-center justify-center border border-emerald-700/50">
                        <Wallet className="w-5 h-5 text-emerald-100" />
                    </div>
                </div>
            </div>

            {/* 2. FLOATING WALLET CARD */}
            <div className="px-6 -mt-16 relative z-20">
                <Card className="shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border-0 bg-white/95 backdrop-blur-xl ring-1 ring-slate-100 rounded-2xl overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex flex-col items-center justify-center space-y-4">
                            <div className="text-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cash in Hand</span>
                                <div className="text-4xl font-extrabold text-slate-900 mt-2 tracking-tight">
                                    <span className="text-2xl align-top text-slate-400 font-medium mr-1">Rs</span>
                                    {stats.cashOnHand.toLocaleString()}
                                </div>
                            </div>

                            <div className="w-full">
                                <HandoverDialog currentBalance={stats.cashOnHand} receivers={receivers} />
                            </div>
                        </div>
                    </CardContent>
                    {/* Subtle bottom stripe */}
                    <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 opacity-80"></div>
                </Card>
            </div>

            {/* 3. DUE LIST SECTION */}
            <div className="flex-1 px-6 mt-8 space-y-5">
                <div className="flex justify-between items-end px-1">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Due Payments</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Focus on highest debt first</p>
                    </div>
                    <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                        {dueCustomers.length} Pending
                    </span>
                </div>

                <div className="space-y-4">
                    {dueCustomers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards">
                            <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-slate-800 font-semibold text-lg">All Caught Up!</h3>
                                <p className="text-slate-500 text-sm max-w-[200px] mx-auto mt-1">
                                    Great job! No pending collections for today.
                                </p>
                            </div>
                        </div>
                    ) : (
                        dueCustomers.map((c) => (
                            <Card key={c.id} className="group border-0 shadow-sm ring-1 ring-slate-100 hover:ring-rose-200 transition-all duration-300 rounded-xl overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-500 to-rose-400"></div>
                                <CardContent className="p-5 pl-7 relative">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-rose-600 transition-colors">
                                                {c.name}
                                            </h3>
                                            <div className="flex flex-col space-y-1.5 pt-1">
                                                {c.address && (
                                                    <div className="flex items-start gap-2 text-xs text-slate-500">
                                                        <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                                                        <span className="line-clamp-1">{c.address}</span>
                                                    </div>
                                                )}
                                                {c.phone && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                        <span className="font-medium tracking-wide">{c.phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono font-bold text-rose-600 text-lg">
                                                Rs {Math.abs(c.current_balance).toLocaleString()}
                                            </div>
                                            <div className="text-[10px] uppercase font-bold text-rose-400/80 tracking-wider mt-0.5">
                                                Overdue
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <CollectionDrawer customer={c} />
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
