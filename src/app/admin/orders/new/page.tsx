'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ArrowLeft, Truck, Package, User, ScanBarcode, Check, ShoppingCart, List, X, Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createOrder } from '@/app/actions/orderActions';
import { getCustomers } from '@/app/actions/customerActions';
import { getDrivers } from '@/app/actions/adminActions';
import { getAvailableStock } from '@/app/actions/cylinderActions';
import { getSettings } from '@/app/actions/settingsActions';

export default function NewOrderPage() {
    const router = useRouter();

    // Data State
    const [customers, setCustomers] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [availableCylinders, setAvailableCylinders] = useState<any[]>([]);

    // Form State
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [selectedSerials, setSelectedSerials] = useState<string[]>([]);

    // UI State
    const [isSerialModalOpen, setIsSerialModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [loadingStock, setLoadingStock] = useState(true);

    // Pricing State
    const [price, setPrice] = useState(0);
    const [productName, setProductName] = useState('LPG Cylinder 45.4KG');

    useEffect(() => {
        fetchData();
        fetchAvailableCylinders();
        fetchPrice();
    }, []);

    const fetchData = async () => {
        const [customersData, safeDrivers] = await Promise.all([
            getCustomers(1, 1000, '', 'active'),
            getDrivers()
        ]);
        // @ts-ignore
        setCustomers(customersData.data || []);
        setDrivers(safeDrivers as any[]);
    };

    const fetchPrice = async () => {
        const { settings } = await getSettings();
        if (settings?.default_gas_rate) {
            setPrice(settings.default_gas_rate);
        } else {
            // Fallback (or keep existing daily_rates logic if you prefer, but usually settings overrides)
            const { data } = await supabase.from('daily_rates').select('current_rate').eq('product_name', productName).single();
            setPrice(data?.current_rate || 11000);
        }
    };

    const fetchAvailableCylinders = async () => {
        setLoadingStock(true);
        const stock = await getAvailableStock();
        setAvailableCylinders(stock as any[]);
        setLoadingStock(false);
    };

    const calculateTotal = () => quantity * price;

    const toggleSerial = (serial: string) => {
        const isSelected = selectedSerials.includes(serial);
        if (isSelected) {
            setSelectedSerials(selectedSerials.filter(s => s !== serial));
        } else {
            if (selectedSerials.length >= quantity) {
                toast.error(`Quantity limit reached (${quantity}). Unselect one first.`);
                return;
            }
            setSelectedSerials([...selectedSerials, serial]);
        }
    };

    const autoSelectSerials = () => {
        if (availableCylinders.length < quantity) {
            toast.error("Not enough cylinders in stock!");
            return;
        }
        // Basic FIFO auto-select
        const toSelect = availableCylinders.slice(0, quantity).map(c => c.serial_number);
        setSelectedSerials(toSelect);
        toast.success(`Auto-selected ${quantity} cylinders`);
    };

    const handleDispatch = async () => {
        if (!selectedCustomerId || !selectedDriverId) {
            toast.error('Customer and Driver are required');
            return;
        }
        if (selectedSerials.length !== quantity) {
            toast.error(`Please select exactly ${quantity} serial numbers.`);
            setIsSerialModalOpen(true);
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('customer_id', selectedCustomerId);
            formData.append('driver_id', selectedDriverId);
            formData.append('cylinders_count', quantity.toString());
            formData.append('total_amount', calculateTotal().toString());
            formData.append('product_name', productName);
            formData.append('price', price.toString());
            formData.append('serials', JSON.stringify(selectedSerials));

            const result = await createOrder(null, formData);

            if (result?.error) throw new Error(result.error);

            toast.success("Order Dispatch Successful!", {
                description: result.assignedSerials && result.assignedSerials.length > 0
                    ? `Assigned: ${result.assignedSerials.join(', ')}`
                    : "Drivers notified."
            });

            if (result.orderId) router.push(`/invoice/${result.orderId}`);
            else router.push('/admin/orders');

        } catch (error: any) {
            toast.error(error.message || "Dispatch failed");
        } finally {
            setSubmitting(false);
        }
    };

    // Derived State
    const currentCustomer = customers.find(c => c.id === selectedCustomerId);
    const isSatisfied = selectedSerials.length === quantity;

    return (
        <div className="min-h-screen bg-slate-50 p-6 pb-32">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <Link href="/admin/orders" className="flex items-center gap-2 text-slate-500 hover:text-emerald-700 font-bold text-sm mb-1 transition-colors">
                            <ArrowLeft size={16} /> Back to Orders
                        </Link>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">New Order Dispatch</h1>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* LEFT COLUMN: Logistics */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Logistics Details</h2>

                            <div className="space-y-6">
                                {/* Customer */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Select Customer</label>
                                    <div className="relative">
                                        <select
                                            value={selectedCustomerId}
                                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                                            className="w-full h-10 pl-3 pr-8 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium appearance-none"
                                        >
                                            <option value="">-- Choose Customer --</option>
                                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <User size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                                    </div>
                                    {currentCustomer && (
                                        <div className={`mt-2 text-xs font-medium px-3 py-2 rounded-lg flex justify-between items-center ${currentCustomer.current_balance < 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                            <span>Current Balance:</span>
                                            <span className="font-bold">Rs {currentCustomer.current_balance?.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Driver */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Assign Driver</label>
                                    <div className="relative">
                                        <select
                                            value={selectedDriverId}
                                            onChange={(e) => setSelectedDriverId(e.target.value)}
                                            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium appearance-none"
                                        >
                                            <option value="">-- Choose Driver --</option>
                                            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                        <Truck size={16} className="absolute left-3 top-3 text-emerald-600 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stock Summary Card */}
                        <div className="bg-slate-900 p-6 rounded-xl shadow-lg text-white">
                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">My Warehouse Stock</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-emerald-400">{loadingStock ? '...' : availableCylinders.length}</span>
                                <span className="text-sm font-medium text-slate-300">Cylinders Available</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">Only 'Full' cylinders shown.</p>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Cart & Actions */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Order Items */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                    <ShoppingCart size={16} /> Order Items
                                </h2>
                            </div>

                            <table className="w-full text-left">
                                <thead className="bg-white text-xs text-slate-400 border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 font-bold uppercase">Product</th>
                                        <th className="p-4 font-bold uppercase w-32">Rate (Rs)</th>
                                        <th className="p-4 font-bold uppercase w-32 text-center">Qty</th>
                                        <th className="p-4 font-bold uppercase w-32 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-900">{productName}</div>
                                            <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-1">
                                                <Check size={12} /> In Stock
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <input
                                                type="number"
                                                value={price}
                                                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                                                className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-emerald-500 outline-none py-1 font-mono text-sm"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2 bg-slate-100 rounded-lg p-1">
                                                <button
                                                    onClick={() => {
                                                        const n = Math.max(1, quantity - 1);
                                                        setQuantity(n);
                                                        if (selectedSerials.length > n) setSelectedSerials(selectedSerials.slice(0, n));
                                                    }}
                                                    className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-emerald-600 font-bold"
                                                >-</button>
                                                <input
                                                    type="number"
                                                    value={quantity}
                                                    onChange={(e) => {
                                                        const n = Math.max(1, parseInt(e.target.value) || 1);
                                                        setQuantity(n);
                                                        if (selectedSerials.length > n) setSelectedSerials(selectedSerials.slice(0, n));
                                                    }}
                                                    className="w-10 text-center bg-transparent outline-none font-bold text-slate-900"
                                                />
                                                <button
                                                    onClick={() => setQuantity(quantity + 1)}
                                                    className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 hover:text-emerald-600 font-bold"
                                                >+</button>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-black text-slate-900">
                                            {(quantity * price).toLocaleString()}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Asset Selection Bar */}
                            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSatisfied ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                        <ScanBarcode size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">
                                            {selectedSerials.length} of {quantity} Assets Selected
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {isSatisfied ? 'Ready for dispatch' : 'Please select specific cylinders'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={autoSelectSerials}
                                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
                                    >
                                        Auto-Select
                                    </button>
                                    <button
                                        onClick={() => setIsSerialModalOpen(true)}
                                        className={`px-4 py-2 text-sm font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 ${isSatisfied ? 'bg-white text-emerald-700 border border-emerald-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                                    >
                                        <List size={16} /> {isSatisfied ? 'View / Edit Serials' : 'Select Serials'}
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* FOOTER ACTION BAR */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-2xl z-40">
                    <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-left">
                            <p className="text-xs font-bold text-slate-400 uppercase">Grand Total</p>
                            <p className="text-3xl font-black text-emerald-600 tracking-tight">
                                <span className="text-lg text-emerald-400 font-bold mr-1">Rs.</span>
                                {calculateTotal().toLocaleString()}
                            </p>
                        </div>
                        <div className="flex gap-4 w-full md:w-auto">
                            <Link href="/admin/orders" className="flex-1 md:flex-none px-6 py-3 text-center text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
                                Cancel
                            </Link>
                            <button
                                onClick={handleDispatch}
                                disabled={submitting}
                                className="flex-1 md:flex-none px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                            >
                                {submitting ? 'Creating Invoice...' : <><Check size={18} /> Confirm Order</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* SERIAL SELECTION MODAL */}
                {isSerialModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Select Cylinders</h2>
                                    <p className="text-xs text-slate-500 font-medium">Please select exactly {quantity} serial numbers.</p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-2xl font-black ${isSatisfied ? 'text-emerald-600' : 'text-amber-500'}`}>
                                        {selectedSerials.length}
                                    </span>
                                    <span className="text-slate-400 font-bold text-sm">/{quantity}</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-white min-h-[300px]">
                                {availableCylinders.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <Info size={48} className="mb-4 opacity-20" />
                                        <p className="font-bold">No Warehouse Stock Available</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                        {availableCylinders.map(c => {
                                            const active = selectedSerials.includes(c.serial_number);
                                            return (
                                                <button
                                                    key={c.id}
                                                    onClick={() => toggleSerial(c.serial_number)}
                                                    className={`px-2 py-2 text-xs font-mono font-bold rounded border transition-all ${active
                                                        ? 'bg-slate-800 text-white border-slate-800 shadow-md scale-105 ring-2 ring-emerald-400'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400 hover:text-emerald-600'
                                                        }`}
                                                >
                                                    {c.serial_number}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                                <button
                                    onClick={() => setIsSerialModalOpen(false)}
                                    className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
