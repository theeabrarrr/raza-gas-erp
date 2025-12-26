'use client';

import { ClipboardCheck, Package, LayoutGrid, RefreshCw, X, ArrowRight, ShieldAlert, CircleDashed, CheckCircle, Database, Filter, Truck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ShopPage() {
    // Live Asset Metrics
    const [sellableStock, setSellableStock] = useState(0);
    const [deadAssets, setDeadAssets] = useState(0);
    const [activeAssets, setActiveAssets] = useState(0);
    const [totalAssets, setTotalAssets] = useState(0);

    const [cylinders, setCylinders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        // Metrics
        refreshMetrics();

        // Fetch Fleet List
        const { data, error } = await supabase
            .from('cylinders')
            .select('*')
            .order('status', { ascending: true }); // Group by status somewhat

        if (error) toast.error('Failed to load fleet');
        else setCylinders(data || []);

        setLoading(false);
    };

    const refreshMetrics = async () => {
        // Total Physical Assets
        const { count: total } = await supabase.from('cylinders').select('*', { count: 'exact', head: true });
        setTotalAssets(total || 0);

        // Sellable Stock (Full @ Shop/Godown)
        const { count: sellable } = await supabase.from('cylinders').select('*', { count: 'exact', head: true })
            .eq('type', '45.4KG').eq('status', 'full').in('current_location_type', ['shop', 'godown']);
        setSellableStock(sellable || 0);

        // Dead Assets (Empty @ Shop/Godown)
        const { count: dead } = await supabase.from('cylinders').select('*', { count: 'exact', head: true })
            .eq('type', '45.4KG').eq('status', 'empty').in('current_location_type', ['shop', 'godown']);
        setDeadAssets(dead || 0);

        // Active Assets (Drivers/Customer)
        const { count: active } = await supabase.from('cylinders').select('*', { count: 'exact', head: true })
            .eq('type', '45.4KG').in('current_location_type', ['driver', 'customer']);
        setActiveAssets(active || 0);
    }

    const filteredCylinders = cylinders.filter(c =>
        c.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.status.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 bg-slate-50 min-h-screen pb-24 font-sans">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Shop Manager</h1>
                    <p className="text-sm text-slate-500 font-medium">Fleet Overview (45.4KG Only)</p>
                </div>
                <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
                    <RefreshCw size={16} /> Refresh Data
                </button>
            </div>

            {/* Live Asset Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between h-32">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Package size={16} /> Sellable Stock
                    </span>
                    <span className="text-3xl font-extrabold text-emerald-600">{sellableStock}</span>
                    <span className="text-[10px] uppercase font-bold text-emerald-500 -mt-2">Full @ Shop/Godown</span>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between h-32">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <CircleDashed size={16} /> Dead Assets
                    </span>
                    <span className="text-3xl font-extrabold text-slate-800">{deadAssets}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 -mt-2">Empty @ Shop/Godown</span>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between h-32">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <ArrowRight size={16} /> Active Assets
                    </span>
                    <span className="text-3xl font-extrabold text-blue-600">{activeAssets}</span>
                    <span className="text-[10px] uppercase font-bold text-blue-500 -mt-2">With Drivers/Cust</span>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between h-32">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Database size={16} /> Total Fleet
                    </span>
                    <span className="text-3xl font-extrabold text-slate-900">{totalAssets}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 -mt-2">Physical Count</span>
                </div>
            </div>

            {/* Unified Fleet Table */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-6 bg-slate-900 rounded-full"></span>
                        Cylinder Fleet (45.4KG)
                    </h2>
                    <div className="relative w-64">
                        <input
                            type="text"
                            placeholder="Filter Status/Serial..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold w-full focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <Filter size={16} className="absolute left-3 top-3 text-slate-400" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Serial</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Current Location</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Last Update</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCylinders.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-400 font-medium">
                                        {loading ? 'Loading Fleet...' : 'No cylinders found.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredCylinders.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-bold text-slate-900 font-mono">{c.serial_number}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-black uppercase tracking-wider ${c.status === 'full' ? 'bg-emerald-100 text-emerald-700' :
                                                c.status === 'empty' ? 'bg-slate-100 text-slate-600' :
                                                    c.status === 'missing' ? 'bg-rose-100 text-rose-700' :
                                                        'bg-amber-100 text-amber-700'
                                                }`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="flex items-center gap-2 text-sm font-bold text-slate-700 capitalize">
                                                {c.current_location_type === 'shop' && <Database size={14} className="text-emerald-500" />}
                                                {c.current_location_type === 'driver' && <Truck size={14} className="text-blue-500" />}
                                                {c.current_location_type === 'customer' && <CheckCircle size={14} className="text-purple-500" />}
                                                {c.current_location_type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-slate-500 font-medium">
                                            {new Date(c.updated_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
