'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Copy, Plus, Archive, Filter, CheckCircle, ArrowRight, Database, RefreshCw, UploadCloud } from 'lucide-react';
import Link from 'next/link';

interface Cylinder {
    id: string;
    serial_number: string;
    type: '45.4KG';
    status: 'full' | 'empty' | 'missing' | 'maintenance';
    current_location_type: 'godown' | 'shop' | 'driver' | 'customer';
    condition: string;
}

export default function CylinderRegistry() {
    const [cylinders, setCylinders] = useState<Cylinder[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Bulk Form State
    const [bulkPrefix, setBulkPrefix] = useState('RG-');
    const [bulkStart, setBulkStart] = useState('');
    const [bulkEnd, setBulkEnd] = useState('');

    // Single Form State
    const [singleSerial, setSingleSerial] = useState('');
    const [mode, setMode] = useState<'bulk' | 'single'>('bulk');

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [refilling, setRefilling] = useState(false);

    useEffect(() => {
        fetchCylinders();
    }, []);

    const fetchCylinders = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('cylinders')
            .select('*')
            .order('serial_number', { ascending: true });

        if (error) {
            toast.error('Failed to load cylinders');
        } else {
            // @ts-ignore
            setCylinders(data || []);
        }
        setLoading(false);
    };

    const handleRefill = async () => {
        if (selectedIds.length === 0) return;
        setRefilling(true);
        try {
            const { error } = await supabase
                .from('cylinders')
                .update({
                    status: 'full',
                    current_location_type: 'godown', // Critical: Set location to Godown so it appears in Dispatch
                    updated_at: new Date().toISOString()
                })
                .in('id', selectedIds);

            if (error) throw error;
            toast.success(`Refilled ${selectedIds.length} cylinders!`);
            setSelectedIds([]);
            fetchCylinders();
        } catch (error: any) {
            toast.error('Refill failed');
        } finally {
            setRefilling(false);
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredCylinders.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredCylinders.map(c => c.id));
        }
    };

    const handleBulkGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        const start = parseInt(bulkStart);
        const end = parseInt(bulkEnd);

        if (isNaN(start) || isNaN(end) || start > end) {
            toast.error('Invalid number range');
            return;
        }

        if (end - start > 500) {
            toast.error('Limit bulk generation to 500 at a time');
            return;
        }

        setGenerating(true);
        const newCylinders = [];

        for (let i = start; i <= end; i++) {
            // Pad number with leading zeros (e.g., 001)
            const numStr = i.toString().padStart(3, '0');
            newCylinders.push({
                serial_number: `${bulkPrefix}${numStr}`,
                type: '45.4KG',
                status: 'full',
                current_location_type: 'godown',
                condition: 'good'
            });
        }

        try {
            const { error } = await supabase.from('cylinders').insert(newCylinders);
            if (error) {
                if (error.code === '23505') { // Unique constraint
                    toast.error('Some serial numbers already exist. Check duplicates.');
                } else {
                    throw error;
                }
            } else {
                toast.success(`Successfully generated ${newCylinders.length} cylinders!`);
                setBulkStart('');
                setBulkEnd('');
                fetchCylinders();
            }
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setGenerating(false);
        }
    };

    const handleSingleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!singleSerial) return;

        setGenerating(true);
        try {
            const { error } = await supabase.from('cylinders').insert([{
                serial_number: singleSerial.toUpperCase(),
                type: '45.4KG',
                status: 'full',
                current_location_type: 'godown',
                condition: 'good'
            }]);

            if (error) throw error;

            toast.success(`Cylinder ${singleSerial} added!`);
            setSingleSerial('');
            fetchCylinders();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setGenerating(false);
        }
    };

    const filteredCylinders = cylinders.filter(c =>
        c.serial_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 bg-slate-50 min-h-screen pb-32 font-sans">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cylinder Registry</h1>
                    <p className="text-sm text-slate-500 font-medium">Manage fleet of 45.4KG Cylinders</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/admin/import" className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-100 transition-colors">
                        <UploadCloud size={16} /> Bulk Import Stock
                    </Link>
                    <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Database size={16} className="text-emerald-600" />
                        Total Assets: <span className="text-slate-900 text-lg">{cylinders.length}</span>
                    </div>
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-lg animate-in slide-in-from-bottom-4 fade-in duration-200">
                    <div className="bg-gray-900/95 backdrop-blur-sm text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-gray-800/50">
                        <span className="font-bold">{selectedIds.length} Selected</span>
                        <button
                            onClick={handleRefill}
                            disabled={refilling}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
                        >
                            {refilling ? 'Updating...' : <><RefreshCw size={16} /> Mark as Refilled (Full)</>}
                        </button>
                    </div>
                </div>
            )}

            {/* Generator Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 mb-8">
                <div className="flex gap-4 mb-6 border-b border-slate-100 pb-4">
                    <button
                        onClick={() => setMode('bulk')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${mode === 'bulk' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Copy size={18} /> Bulk Generator
                    </button>
                    <button
                        onClick={() => setMode('single')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${mode === 'single' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Plus size={18} /> Single Entry
                    </button>
                </div>

                {mode === 'bulk' ? (
                    <form onSubmit={handleBulkGenerate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                        <div className="lg:col-span-1">
                            <label className="text-label">Prefix</label>
                            <input
                                type="text"
                                value={bulkPrefix}
                                onChange={(e) => setBulkPrefix(e.target.value)}
                                className="input-field"
                                placeholder="RG-"
                            />
                        </div>
                        <div className="lg:col-span-1">
                            <label className="text-label">Start No.</label>
                            <input
                                type="number"
                                value={bulkStart}
                                onChange={(e) => setBulkStart(e.target.value)}
                                className="input-field"
                                placeholder="001"
                            />
                        </div>
                        <div className="lg:col-span-1">
                            <label className="text-label">End No.</label>
                            <input
                                type="number"
                                value={bulkEnd}
                                onChange={(e) => setBulkEnd(e.target.value)}
                                className="input-field"
                                placeholder="100"
                            />
                        </div>
                        <div className="lg:col-span-2">
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                                <span className="text-xs font-bold text-slate-400 uppercase">Fixed Type</span>
                                <div className="text-sm font-black text-slate-900">45.4KG STANDARD</div>
                            </div>
                        </div>
                        <div className="lg:col-span-5 mt-4">
                            <button
                                type="submit"
                                disabled={generating}
                                className="btn-primary w-full h-[50px] flex justify-center items-center gap-2"
                            >
                                {generating ? 'Generating...' : <><Archive size={18} /> Generate Assets</>}
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleSingleAdd} className="flex gap-4 items-end">
                        <div className="w-1/2">
                            <label className="text-label">Serial Number</label>
                            <input
                                type="text"
                                value={singleSerial}
                                onChange={(e) => setSingleSerial(e.target.value)}
                                className="input-field uppercase"
                                placeholder="RG-XX-000"
                                autoFocus
                            />
                        </div>
                        <div className="w-1/4">
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                                <span className="text-xs font-bold text-slate-400 uppercase">Type</span>
                                <div className="text-sm font-black text-slate-900">45.4KG</div>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={generating}
                            className="btn-primary w-1/4 h-[50px] flex justify-center items-center gap-2"
                        >
                            {generating ? 'Adding...' : <><Plus size={18} /> Add Cylinder</>}
                        </button>
                    </form>
                )}
            </div>

            {/* Asset List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-900">Registered Assets</h2>
                    <div className="relative w-64">
                        <input
                            type="text"
                            placeholder="Search Serial..."
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
                                <th className="p-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                                        checked={filteredCylinders.length > 0 && selectedIds.length === filteredCylinders.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Serial Number</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Condition</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCylinders.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">No assets found.</td>
                                </tr>
                            ) : (
                                filteredCylinders.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                                                checked={selectedIds.includes(c.id)}
                                                onChange={() => toggleSelect(c.id)}
                                            />
                                        </td>
                                        <td className="p-4 font-bold text-slate-900">{c.serial_number}</td>
                                        <td className="p-4 text-sm text-slate-600 font-bold">{c.type}</td>
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
                                            <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                {c.current_location_type === 'godown' && <Database size={14} className="text-slate-500" />}
                                                {c.current_location_type === 'shop' && <Database size={14} className="text-emerald-500" />}
                                                {c.current_location_type === 'driver' && <ArrowRight size={14} className="text-blue-500" />}
                                                {c.current_location_type === 'customer' && <CheckCircle size={14} className="text-purple-500" />}
                                                <span className="capitalize">{c.current_location_type}</span>
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-slate-500 capitalize">{c.condition}</td>
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
