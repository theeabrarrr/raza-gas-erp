'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ArrowLeft, Truck, Plus, Package, Trash2, User, ScanBarcode, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NewOrderPage() {
    const router = useRouter();
    const [customers, setCustomers] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [availableCylinders, setAvailableCylinders] = useState<any[]>([]);

    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedDriverId, setSelectedDriverId] = useState('');

    // Dynamic Pricing State
    const [price, setPrice] = useState(0);
    const [productName, setProductName] = useState('LPG Cylinder 45.4KG');

    const [quantity, setQuantity] = useState(1);

    // Selected Serials: string[]
    const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
        fetchAvailableCylinders();
        fetchPrice();
    }, []);

    async function fetchPrice() {
        const { data } = await supabase.from('daily_rates').select('current_rate').eq('product_name', productName).single();
        if (data) {
            setPrice(data.current_rate);
        } else {
            // Fallback if not found (though migration ensures it exists)
            setPrice(11000);
        }
    }

    async function fetchData() {
        const { data: custData } = await supabase.from('customers').select('id, name').order('name');
        if (custData) setCustomers(custData);

        const { data: userData } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'driver');
        if (userData) setDrivers(userData);
    }

    const [loadingStock, setLoadingStock] = useState(true);

    async function fetchAvailableCylinders() {
        setLoadingStock(true);
        // Strict Filter: 45.4KG, Full, At Godown (Plant supply to Shop/Driver)
        const { data, error } = await supabase
            .from('cylinders')
            .select('id, serial_number, type')
            .eq('type', '45.4KG')
            .eq('status', 'full')
            .eq('current_location_type', 'godown')
            .order('serial_number');

        if (error) {
            toast.error('Failed to load available stock');
        } else {
            console.log('Available Stock:', data);
            setAvailableCylinders(data || []);
        }
        setLoadingStock(false);
    }

    const calculateTotal = () => {
        return quantity * price;
    };

    // Helper to toggle serial selection
    const toggleSerial = (serial: string) => {
        const isSelected = selectedSerials.includes(serial);

        if (isSelected) {
            setSelectedSerials(selectedSerials.filter(s => s !== serial));
        } else {
            // Check limit
            if (selectedSerials.length >= quantity) {
                toast.error(`You only need ${quantity} cylinders`);
                return;
            }
            setSelectedSerials([...selectedSerials, serial]);
        }
    };

    const handleDispatch = async () => {
        if (!selectedCustomerId || !selectedDriverId) {
            toast.error('Please select Customer and Driver');
            return;
        }

        // Validate Serials
        if (selectedSerials.length !== quantity) {
            toast.error(`Select exact ${quantity} serials (Selected: ${selectedSerials.length})`);
            return;
        }

        setSubmitting(true);
        try {
            const totalAmount = calculateTotal();

            // 1. Create Order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert([{
                    customer_id: selectedCustomerId,
                    driver_id: selectedDriverId,
                    total_amount: totalAmount,
                    status: 'dispatched', // STRICT LOWERCASE: Check constraint requirement
                    payment_method: 'pending'
                }])
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Create Order Items
            const orderItem = {
                order_id: order.id,
                product_name: productName,
                quantity: quantity,
                price: price
            };

            const { error: itemsError } = await supabase.from('order_items').insert([orderItem]);
            if (itemsError) throw itemsError;

            // 3. Update Cylinder Locations
            if (selectedSerials.length > 0) {
                const { error: cylinderError } = await supabase
                    .from('cylinders')
                    .update({
                        status: 'full', // Explicitly maintain 'full' status
                        current_location_type: 'driver',
                        current_holder_id: selectedDriverId,
                        last_order_id: order.id, // LINKAGE: Track which order moved this cylinder
                        updated_at: new Date().toISOString()
                    })
                    .in('serial_number', selectedSerials);

                if (cylinderError) throw cylinderError;
            }

            toast.success(`Order Dispatched! Assets Assigned.`);
            router.push('/shop'); // Redirect to Shop Manager to see updated stock

        } catch (error: any) {
            toast.error(`Dispatch Failed: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const issatisfied = selectedSerials.length === quantity;

    return (
        <div className="p-8 bg-slate-50 min-h-screen font-sans">
            <Link href="/admin" className="flex items-center gap-2 text-slate-500 mb-8 hover:text-emerald-600 transition-colors font-bold text-sm">
                <ArrowLeft size={18} /> Cancel Dispatch
            </Link>

            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600">
                        <Package size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New Order Dispatch</h1>
                        <p className="text-slate-500 text-sm font-medium">Assign 45.4KG Stock</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {/* Main Form */}
                    <div className="card p-8 space-y-8">
                        {/* Customer & Driver */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-label">Customer</label>
                                <div className="relative">
                                    <select
                                        className="input-field appearance-none"
                                        value={selectedCustomerId}
                                        onChange={e => setSelectedCustomerId(e.target.value)}
                                    >
                                        <option value="">-- Select --</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <User size={16} className="absolute right-4 top-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <label className="text-label">Driver</label>
                                <div className="relative">
                                    <select
                                        className="input-field appearance-none pl-10"
                                        value={selectedDriverId}
                                        onChange={e => setSelectedDriverId(e.target.value)}
                                    >
                                        <option value="">-- Select --</option>
                                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                    <Truck size={18} className="absolute left-3 top-3.5 text-emerald-600 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* Items - Simplified for Single Product */}
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-slate-900">{productName}</h3>
                                <p className="text-emerald-600 font-bold text-sm">Rs {price.toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="text-label mb-0">Qty</label>
                                <input
                                    type="number"
                                    min="1"
                                    className="input-field w-24 text-center font-bold font-mono text-xl"
                                    value={quantity}
                                    onChange={e => {
                                        const v = parseInt(e.target.value) || 1;
                                        setQuantity(v);
                                        // Reset serials if qty changes to enforce re-selection
                                        setSelectedSerials([]);
                                    }}
                                />
                            </div>
                        </div>

                        {/* ASSET ASSIGNMENT */}
                        <div>
                            <div className={`p-4 rounded-xl border transition-colors ${issatisfied ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                        <ScanBarcode size={18} /> Select Exact Serials ({selectedSerials.length}/{quantity})
                                    </h3>
                                    {issatisfied && <Check size={18} className="text-emerald-600" />}
                                </div>

                                {loadingStock ? (
                                    <div className="text-slate-500 text-xs font-bold p-4 bg-slate-50 rounded-lg flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                                        Fetching Godown Stock...
                                    </div>
                                ) : availableCylinders.length === 0 ? (
                                    <div className="text-red-500 text-xs font-bold p-2 bg-red-50 rounded-lg">
                                        ⚠️ No 'FULL' 45.4KG cylinders available at Godown.
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                                        {availableCylinders.map(c => {
                                            const active = selectedSerials.includes(c.serial_number);
                                            return (
                                                <button
                                                    key={c.id}
                                                    onClick={() => toggleSerial(c.serial_number)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all border ${active
                                                        ? 'bg-slate-900 text-white border-slate-900 shadow-md transform scale-105'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                                        }`}
                                                >
                                                    {c.serial_number}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Total & Action */}
                        <div className="pt-6 border-t border-slate-100">
                            <div className="flex justify-between items-end mb-6">
                                <span className="text-slate-500 font-bold text-sm uppercase">Total Amount</span>
                                <span className="text-3xl font-black text-slate-900">Rs {calculateTotal().toLocaleString()}</span>
                            </div>
                            <button
                                onClick={handleDispatch}
                                disabled={submitting}
                                className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-lg"
                            >
                                {submitting ? 'Dispatching...' : <><Package size={20} /> Confirm & Dispatch</>}
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
