'use client';

import { MapPin, Search, X, CheckCircle, Wallet, ArrowRight, Phone, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// Mock User ID provided by Auth Context in real app
const DEFAULT_RECOVERY_AGENT_ID = '00000000-0000-0000-0000-000000000003';

interface Customer {
    id: string;
    name: string;
    phone: string;
    address: string;
    current_balance: number;
    lastOrder?: any;
}

export default function RecoveryPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals State
    const [showCollectModal, setShowCollectModal] = useState(false);
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

    // Collect Form
    const [collectAmount, setCollectAmount] = useState('');
    const [collectProof, setCollectProof] = useState<File | null>(null);
    const [collecting, setCollecting] = useState(false);

    // Handover Form
    const [handoverAmount, setHandoverAmount] = useState('');
    const [handoverReceiver, setHandoverReceiver] = useState('');
    const [cashiers, setCashiers] = useState<any[]>([]);
    const [handingOver, setHandingOver] = useState(false);

    // Stats
    const totalOutstanding = customers.filter(c => c.current_balance > 0).reduce((sum, c) => sum + c.current_balance, 0);

    useEffect(() => {
        fetchCustomers();
        fetchCashiers();
    }, []);

    async function fetchCashiers() {
        const { data } = await supabase.from('users').select('*').in('role', ['admin', 'shop_manager']);
        setCashiers(data || []);
    }

    async function fetchCustomers() {
        const { data, error } = await supabase
            .from('customers')
            .select('*, orders(readable_id, created_at, total_amount, status)')
            .order('name');

        if (error) {
            toast.error('Failed to load customers');
        } else {
            const processed = (data || []).map((c: any) => {
                const sortedOrders = c.orders?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const lastOrder = sortedOrders?.[0];
                return { ...c, lastOrder };
            });
            setCustomers(processed);
        }
        setLoading(false);
    }

    const openCollectModal = (customer: any) => {
        setSelectedCustomer(customer);
        setCollectAmount('');
        setCollectProof(null);
        setShowCollectModal(true);
    };

    const handleCollectSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomer) return;

        const amount = parseFloat(collectAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Invalid amount');
            return;
        }

        setCollecting(true);

        // Get GPS
        toast.info('Getting Location...');
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
                    let proofUrl = null;
                    if (collectProof) {
                        const fileExt = collectProof.name.split('.').pop();
                        const fileName = `proof_${Date.now()}.${fileExt}`;
                        const { error: uploadError } = await supabase.storage
                            .from('receipts')
                            .upload(fileName, collectProof);

                        if (uploadError) throw uploadError;

                        const { data: { publicUrl } } = supabase.storage
                            .from('receipts')
                            .getPublicUrl(fileName);
                        proofUrl = publicUrl;
                    }

                    const { error: txnError } = await supabase
                        .from('transactions')
                        .insert([{
                            customer_id: selectedCustomer.id,
                            user_id: DEFAULT_RECOVERY_AGENT_ID,
                            amount: amount,
                            type: 'recovery',
                            gps_lat: latitude,
                            gps_long: longitude,
                            proof_url: proofUrl
                        }]);

                    if (txnError) throw txnError;

                    const { error: updateError } = await supabase
                        .from('customers')
                        .update({
                            current_balance: selectedCustomer.current_balance - amount,
                            last_payment_date: new Date().toISOString()
                        })
                        .eq('id', selectedCustomer.id);

                    if (updateError) throw updateError;

                    await supabase.from('activity_logs').insert([{
                        user_id: DEFAULT_RECOVERY_AGENT_ID,
                        action_text: `Collected Rs ${amount.toLocaleString()} from ${selectedCustomer.name}`
                    }]);

                    toast.success(`Rs ${amount} Collected Successfully`);
                    setShowCollectModal(false);
                    fetchCustomers();

                } catch (error: any) {
                    toast.error(`Transaction Failed: ${error.message}`);
                } finally {
                    setCollecting(false);
                }
            },
            (error) => {
                toast.error('Location Access Denied. Cannot process transaction.');
                setCollecting(false);
            }
        );
    };

    const handleHandoverSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(handoverAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Invalid amount');
            return;
        }
        if (!handoverReceiver) {
            toast.error('Select a receiver');
            return;
        }

        setHandingOver(true);
        try {
            const receiverName = cashiers.find(c => c.id === handoverReceiver)?.name || 'Unknown';
            await supabase.from('activity_logs').insert([{
                user_id: DEFAULT_RECOVERY_AGENT_ID,
                action_text: `Handed over Rs ${amount.toLocaleString()} to ${receiverName}`
            }]);
            toast.success(`Handover of Rs ${amount} recorded!`);
            setShowHandoverModal(false);
            setHandoverAmount('');
        } catch (error: any) {
            toast.error(`Handover Failed: ${error.message}`);
        } finally {
            setHandingOver(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-slate-400 font-bold">Loading Recovery Data...</div>;

    return (
        <div className="p-8 bg-slate-50 min-h-screen pb-24 font-sans">

            <div className="flex justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Recovery Management</h1>
                    <p className="text-sm text-slate-500 font-medium">Track debts and daily collections</p>
                </div>
                <button
                    onClick={() => setShowHandoverModal(true)}
                    className="btn-primary flex items-center gap-2 shrink-0 shadow-lg shadow-emerald-600/20"
                >
                    <Wallet size={18} /> <span className="hidden sm:inline">Handover Cash</span>
                </button>
            </div>

            {/* Revised Total Outstanding Banner - Light Theme */}
            <div className="max-w-full mx-auto mb-8">
                <div className="bg-white rounded-xl border border-emerald-100 p-8 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                    <div className="z-10">
                        {/* Typography Fix: Uppercase, [10px], Slate-400, Tracking-Widest, Bold */}
                        <span className="text-slate-400 font-bold tracking-widest text-[10px] uppercase block mb-2">Total Outstanding Debt</span>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-extrabold text-emerald-600">Rs {totalOutstanding.toLocaleString()}</h2>
                            <span className="text-emerald-500 text-sm font-bold bg-emerald-50 px-2 py-1 rounded-full">+0% this week</span>
                        </div>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-full z-10 text-emerald-600">
                        <TrendingUp size={32} />
                    </div>
                    {/* Subtle Decoration */}
                    <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-emerald-50 to-transparent"></div>
                </div>
            </div>

            {/* Responsive Grid Layout */}
            {customers.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm">No customers found.</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {customers.map((customer: any) => (
                    <div key={customer.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between h-full transition-all hover:shadow-md hover:border-emerald-200">

                        {/* Card Header & Details */}
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                {/* Customer Name Typography Fix: text-xl font-bold text-slate-900 mb-1 */}
                                <h3 className="text-xl font-bold text-slate-900 mb-1 leading-tight">
                                    {customer.name}
                                </h3>
                                {customer.current_balance > 0 ? (
                                    <span className="bg-rose-50 text-rose-600 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider shrink-0 border border-rose-100">Debt</span>
                                ) : (
                                    <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider shrink-0 border border-emerald-100">Adv</span>
                                )}
                            </div>

                            <div className="space-y-2 mb-6">
                                {/* Secondary Text: text-slate-500 font-medium */}
                                <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                    <Phone size={14} className="text-slate-400 shrink-0" /> {customer.phone || 'No Phone'}
                                </p>
                                <p className="text-sm font-medium text-slate-500 flex items-start gap-2">
                                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                    <span className="line-clamp-2">{customer.address || 'Location N/A'}</span>
                                </p>
                            </div>
                        </div>

                        {/* Card Footer: Balance & Action */}
                        <div className="pt-4 border-t border-slate-50">
                            <div className="bg-slate-50 p-4 rounded-lg flex justify-between items-center mb-4">
                                {/* Balance Label Fix: text-[10px] font-bold text-slate-400 uppercase */}
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Balance</span>
                                {customer.current_balance > 0 ? (
                                    <span className="text-xl font-extrabold text-rose-600">
                                        Rs {customer.current_balance.toLocaleString()}
                                    </span>
                                ) : (
                                    <span className="text-xl font-extrabold text-emerald-600">
                                        Adv: {Math.abs(customer.current_balance).toLocaleString()}
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={() => openCollectModal(customer)}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg transition-all active:scale-95 shadow-sm shadow-emerald-600/10 flex justify-center items-center gap-2"
                            >
                                Collect Payment
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Collect Modal */}
            {showCollectModal && selectedCustomer && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-8 rounded-2xl w-full max-w-sm relative animate-in fade-in zoom-in duration-200 shadow-2xl">
                        <button onClick={() => setShowCollectModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24} /></button>

                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900">Collect Payment</h2>
                            <p className="text-sm text-slate-500 font-medium mt-1">{selectedCustomer.name}</p>
                        </div>

                        <form onSubmit={handleCollectSubmit} className="space-y-6">
                            <div>
                                <label className="text-label">Amount Received (Rs)</label>
                                <input
                                    type="number"
                                    autoFocus
                                    required
                                    value={collectAmount}
                                    onChange={(e) => setCollectAmount(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-3xl font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-center"
                                    placeholder="0"
                                />
                            </div>

                            <div>
                                <label className="text-label">Proof (Optional)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setCollectProof(e.target.files?.[0] || null)}
                                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={collecting}
                                className="btn-primary w-full py-4 text-base flex justify-center items-center gap-2"
                            >
                                {collecting ? 'Processing Transaction...' : <><CheckCircle size={18} /> Confirm Collection</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Handover Modal */}
            {showHandoverModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-8 rounded-2xl w-full max-w-sm relative animate-in fade-in zoom-in duration-200 shadow-2xl">
                        <button onClick={() => setShowHandoverModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24} /></button>

                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900">Handover Cash</h2>
                            <p className="text-sm text-slate-500 font-medium mt-1">Transfer collected cash to Office</p>
                        </div>

                        <form onSubmit={handleHandoverSubmit} className="space-y-6">
                            <div>
                                <label className="text-label">Amount to Handover</label>
                                <input
                                    type="number"
                                    autoFocus
                                    required
                                    value={handoverAmount}
                                    onChange={(e) => setHandoverAmount(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-3xl font-black text-slate-900 focus:ring-2 focus:ring-slate-500 outline-none text-center"
                                    placeholder="0"
                                />
                            </div>

                            <div>
                                <label className="text-label">Receiver</label>
                                <select
                                    required
                                    value={handoverReceiver}
                                    onChange={(e) => setHandoverReceiver(e.target.value)}
                                    className="input-field"
                                >
                                    <option value="">Select Receiver...</option>
                                    {cashiers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={handingOver}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {handingOver ? 'Recording...' : <><ArrowRight size={18} /> Record Handover</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
