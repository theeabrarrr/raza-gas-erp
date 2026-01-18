'use client';

import { useEffect, useState } from 'react';
import { getDriverProfile } from '@/app/actions/driverActions';
import { User, Truck, Phone, LogOut, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react';
import LogoutBtn from '@/components/LogoutBtn';

export default function DriverProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            const data = await getDriverProfile();
            setProfile(data);
            setLoading(false);
        }
        load();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-white p-6 flex flex-col items-center justify-center space-y-4">
                <div className="w-24 h-24 bg-slate-100 rounded-full animate-pulse" />
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="p-6 text-center pt-24">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={32} />
                </div>
                <p className="text-slate-500 font-medium">Profile data unavailable.</p>
                <div className="mt-8">
                    <LogoutBtn className="w-full justify-center border border-red-200" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-safe">
            {/* 1. Header (Clean White) */}
            <div className="bg-white px-6 pt-12 pb-8 flex flex-col items-center shadow-sm border-b border-slate-100 relative z-10">
                <div className="w-24 h-24 bg-slate-900 text-white rounded-full flex items-center justify-center text-3xl font-bold shadow-xl mb-4 relative">
                    {profile.full_name?.[0] || 'D'}
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full border-4 border-white">
                        <CheckCircle size={16} fill="currentColor" className="text-white" />
                    </div>
                </div>

                <h1 className="text-2xl font-black text-slate-900 tracking-tight text-center">
                    {profile.full_name || 'Unknown Driver'}
                </h1>

                <div className="mt-2 flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wide">
                        {profile.role || 'Active Driver'}
                    </span>
                </div>
            </div>

            {/* 2. Info Content (Settings Rows) */}
            <main className="p-4 space-y-6 max-w-lg mx-auto mt-4">
                <div className="space-y-2">
                    <p className="px-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Vehicle & Contact</p>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
                        {/* Vehicle Row */}
                        <div className="flex items-center p-4 gap-4">
                            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                                <Truck size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-500 font-medium">Vehicle Number</p>
                                <p className="text-base font-bold text-slate-800 truncate">
                                    {profile.vehicle_number || 'No Vehicle'}
                                </p>
                            </div>
                            <button disabled className="text-slate-300">
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Phone Row */}
                        <div className="flex items-center p-4 gap-4">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                <Phone size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-500 font-medium">Phone Number</p>
                                <p className="text-base font-bold text-slate-800 truncate">
                                    {profile.phone_number || 'No Phone'}
                                </p>
                            </div>
                            <button disabled className="text-slate-300">
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                    <p className="px-2 text-[10px] text-slate-400">
                        Contact Admin to update these details.
                    </p>
                </div>

                {/* 3. Actions Footer */}
                <div className="pt-8 space-y-3">
                    <a
                        href="tel:+923000000000"
                        className="flex items-center justify-center w-full py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        Call Support
                    </a>

                    <LogoutBtn
                        className="w-full justify-center py-3.5 border border-red-200 bg-white text-red-600 hover:bg-red-50 rounded-xl font-bold shadow-sm"
                        iconOnly={false}
                    />
                </div>
            </main>
        </div>
    );
}
