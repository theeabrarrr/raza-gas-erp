'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { UploadCloud, FileSpreadsheet, Check, AlertCircle, Database, User, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';

export default function BulkImportPage() {
    const [activeTab, setActiveTab] = useState<'customers' | 'inventory'>('customers');
    const [loading, setLoading] = useState(false);

    // Customer State
    const [customerRows, setCustomerRows] = useState<any[]>([
        { id: '1', name: '', phone: '', address: '', initialBalance: '0' }
    ]);

    // Inventory State (Refactored for Single 45.4KG Type)
    const [inventoryRows, setInventoryRows] = useState<any[]>([
        { id: '1', itemName: 'LPG Cylinder 45.4KG', type: '45.4KG', openingStock: '0', purchasePrice: '11000' }
    ]);

    // -- Customer Handlers --
    const addCustomerRow = () => {
        const newId = (parseInt(customerRows[customerRows.length - 1]?.id || '0') + 1).toString();
        setCustomerRows([...customerRows, { id: newId, name: '', phone: '', address: '', initialBalance: '0' }]);
    };

    const updateCustomerRow = (index: number, field: string, value: string) => {
        const newRows = [...customerRows];
        newRows[index][field] = value;
        setCustomerRows(newRows);
    };

    const removeCustomerRow = (index: number) => {
        if (customerRows.length > 1) {
            const newRows = [...customerRows];
            newRows.splice(index, 1);
            setCustomerRows(newRows);
        }
    };

    const handleCustomerCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            complete: (results) => {
                const rows = results.data.slice(1).map((row: any, idx) => ({
                    id: (idx + 1).toString(),
                    name: row[0] || '',
                    phone: row[1] || '',
                    address: row[2] || '',
                    initialBalance: row[3] || '0'
                }));
                // @ts-ignore
                if (rows.length > 0) setCustomerRows(rows);
            },
            header: false
        });
    };

    const submitCustomers = async () => {
        setLoading(true);
        try {
            const validRows = customerRows.filter(r => r.name && r.phone);
            if (validRows.length === 0) throw new Error('No valid rows to import');

            const payload = validRows.map(r => ({
                name: r.name,
                phone: r.phone,
                address: r.address,
                current_balance: parseFloat(r.initialBalance) || 0
            }));

            const { error } = await supabase.from('customers').insert(payload);
            if (error) throw error;

            toast.success(`Successfully imported ${validRows.length} customers!`);
            setCustomerRows([{ id: '1', name: '', phone: '', address: '', initialBalance: '0' }]);
        } catch (error: any) {
            toast.error(`Import Failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // -- Inventory Handlers --
    const addInventoryRow = () => {
        const newId = (parseInt(inventoryRows[inventoryRows.length - 1]?.id || '0') + 1).toString();
        setInventoryRows([...inventoryRows, { id: newId, itemName: 'LPG Cylinder 45.4KG', type: '45.4KG', openingStock: '0', purchasePrice: '11000' }]);
    };

    const updateInventoryRow = (index: number, field: string, value: string) => {
        const newRows = [...inventoryRows];
        newRows[index][field] = value;
        setInventoryRows(newRows);
    };

    const removeInventoryRow = (index: number) => {
        if (inventoryRows.length > 1) {
            const newRows = [...inventoryRows];
            newRows.splice(index, 1);
            setInventoryRows(newRows);
        }
    };

    const handleInventoryCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            complete: (results) => {
                const rows = results.data.slice(1).map((row: any, idx) => {
                    const cells = row as string[];
                    return {
                        id: (idx + 1).toString(),
                        itemName: cells[0] || 'LPG Cylinder 45.4KG',
                        type: '45.4KG', // Enforce 45.4KG
                        openingStock: cells[2] || '0',
                        purchasePrice: cells[3] || '11000'
                    };
                });

                const validRows = rows.filter((r: any) => r.itemName);
                if (validRows.length > 0) setInventoryRows(validRows);
            },
            header: false
        });
    };

    const submitInventory = async () => {
        setLoading(true);
        try {
            const validRows = inventoryRows.filter(r => r.itemName && parseInt(r.openingStock) > 0);
            if (validRows.length === 0) throw new Error('No valid rows or 0 stock');

            // 1. Get/Create Location (Assume 'Main Shop' for import)
            let { data: location } = await supabase.from('locations').select('id').eq('name', 'Main Shop').single();
            if (!location) {
                const { data: newLoc, error: locError } = await supabase.from('locations').insert([{ name: 'Main Shop', address: 'HQ' }]).select().single();
                if (locError) throw locError;
                location = newLoc;
            }

            // 2. Process Products & Inventory
            for (const row of validRows) {
                // Check if product exists
                let { data: product } = await supabase.from('products').select('id').eq('name', row.itemName).single();

                if (!product) {
                    const { data: newProd, error: prodError } = await supabase.from('products').insert([{
                        name: row.itemName,
                        type: row.type,
                        price: parseFloat(row.purchasePrice) || 0
                    }]).select().single();
                    if (prodError) throw prodError;
                    product = newProd;
                }

                // Insert/Update Inventory Count
                // Note: This matches the old 'inventory' table. 
                // With 'cylinders' table, we should ideally generate assets, but this import tool 
                // is likely legacy or for bulk counting. 
                // For consisteny with Single Type, we will just update the counts.
                // NOTE: If we want strict asset tracking, this tool should generate serials too.
                // But for now, we just update the counts as requested.

                const { error: invError } = await supabase.from('inventory').upsert({
                    location_id: location?.id,
                    product_id: product?.id,
                    count_full: parseInt(row.openingStock),
                    count_empty: 0
                }, { onConflict: 'location_id,product_id' });

                if (invError) throw invError;
            }

            toast.success(`Imported stock for ${validRows.length} items!`);
            setInventoryRows([{ id: '1', itemName: 'LPG Cylinder 45.4KG', type: '45.4KG', openingStock: '0', purchasePrice: '11000' }]);

        } catch (error: any) {
            toast.error(`Import Failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 bg-slate-50 min-h-screen font-sans pb-24">
            <Link href="/admin/cylinders" className="flex items-center gap-2 text-slate-500 mb-6 hover:text-emerald-600 transition-colors font-bold text-sm">
                <ArrowLeft size={18} /> Back to Inventory
            </Link>

            <div className="flex items-center gap-3 mb-8">
                <div className="bg-slate-900 p-3 rounded-xl text-white shadow-lg shadow-slate-900/20">
                    <UploadCloud size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bulk Import Wizard</h1>
                    <p className="text-slate-500 text-sm font-medium">Upload legacy data (CSV) or manual entry</p>
                </div>
            </div>

            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setActiveTab('customers')}
                    className={`px-6 py-3 rounded-xl font-bold transition-all text-sm flex items-center gap-2 ${activeTab === 'customers'
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                        }`}
                >
                    <User size={18} /> Customers
                </button>
                <button
                    onClick={() => setActiveTab('inventory')}
                    className={`px-6 py-3 rounded-xl font-bold transition-all text-sm flex items-center gap-2 ${activeTab === 'inventory'
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                        }`}
                >
                    <Database size={18} /> Stock & Products
                </button>
            </div>

            <div className="card p-6 min-h-[500px]">
                {/* Header Actions */}
                <div className="flex justify-between items-center mb-6 pb-6 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                        <label className="btn-secondary cursor-pointer flex items-center gap-2 text-sm">
                            <FileSpreadsheet size={16} /> Upload CSV
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={activeTab === 'customers' ? handleCustomerCSV : handleInventoryCSV}
                            />
                        </label>
                        <button
                            onClick={activeTab === 'customers' ? addCustomerRow : addInventoryRow}
                            className="text-sm font-bold text-slate-500 hover:text-emerald-600 underline"
                        >
                            + Add Empty Row
                        </button>
                    </div>

                    <button
                        onClick={activeTab === 'customers' ? submitCustomers : submitInventory}
                        disabled={loading}
                        className="btn-primary px-8 py-2.5 flex items-center gap-2"
                    >
                        {loading ? 'Processing...' : <><Check size={18} /> Run Import</>}
                    </button>
                </div>

                {/* Table Area */}
                <div className="overflow-x-auto">
                    {activeTab === 'customers' ? (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">#</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Balance (Rs)</th>
                                    <th className="px-6 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {customerRows.map((row, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50">
                                        <td className="p-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                                        <td className="p-2">
                                            <input type="text" className="input-field py-2 text-sm" placeholder="John Doe" value={row.name} onChange={e => updateCustomerRow(idx, 'name', e.target.value)} />
                                        </td>
                                        <td className="p-2">
                                            <input type="text" className="input-field py-2 text-sm" placeholder="0300..." value={row.phone} onChange={e => updateCustomerRow(idx, 'phone', e.target.value)} />
                                        </td>
                                        <td className="p-2">
                                            <input type="text" className="input-field py-2 text-sm" placeholder="House 123..." value={row.address} onChange={e => updateCustomerRow(idx, 'address', e.target.value)} />
                                        </td>
                                        <td className="p-2">
                                            <input type="text" className="input-field py-2 text-sm text-right font-mono" placeholder="0" value={row.initialBalance} onChange={e => updateCustomerRow(idx, 'initialBalance', e.target.value)} />
                                        </td>
                                        <td className="p-2 text-center">
                                            <button onClick={() => removeCustomerRow(idx)} className="text-slate-300 hover:text-red-500"><X size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">#</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Opening Stock</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Price (Rs)</th>
                                    <th className="px-6 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {inventoryRows.map((row, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50">
                                        <td className="p-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                                        <td className="p-2">
                                            <input type="text" className="input-field py-2 text-sm" value={row.itemName} onChange={e => updateInventoryRow(idx, 'itemName', e.target.value)} />
                                        </td>
                                        <td className="p-2">
                                            {/* Fixed Type for 45.4KG Requirement */}
                                            <div className="input-field py-2 text-sm bg-slate-100 text-slate-500 cursor-not-allowed">
                                                45.4KG
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            <input type="number" className="input-field py-2 text-sm text-center font-bold" placeholder="0" value={row.openingStock} onChange={e => updateInventoryRow(idx, 'openingStock', e.target.value)} />
                                        </td>
                                        <td className="p-2">
                                            <input type="number" className="input-field py-2 text-sm text-right font-mono" placeholder="0" value={row.purchasePrice} onChange={e => updateInventoryRow(idx, 'purchasePrice', e.target.value)} />
                                        </td>
                                        <td className="p-2 text-center">
                                            <button onClick={() => removeInventoryRow(idx)} className="text-slate-300 hover:text-red-500"><X size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="mt-6 flex items-start gap-3 p-4 bg-blue-50 text-blue-700 rounded-lg text-sm">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p>
                        <strong>Note:</strong> Importing stock here updates the <em>Inventory Counts</em> (Full/Empty).
                        To track individual assets, please use the <a href="/admin/cylinders" className="underline font-bold">Asset Registry</a> generator.
                        Importing here does NOT generate serial numbers automatically.
                    </p>
                </div>
            </div>
        </div>
    );
}
