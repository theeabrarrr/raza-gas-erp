"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Wallet, Database, Phone, MapPin, Receipt, Download, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getCustomerDetails, getCustomerTransactions, getCustomerAssets, getCustomerOrderHistory } from '@/app/actions/customerActions';

export default function CustomerDetail() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [customer, setCustomer] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [orderLogs, setOrderLogs] = useState<any[]>([]);
    const [ledger, setLedger] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'history' | 'assets'>('history');

    useEffect(() => {
        if (id) loadData();
    }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [custData, txnData, assetData, orderLogsData] = await Promise.all([
                getCustomerDetails(id),
                getCustomerTransactions(id),
                getCustomerAssets(id),
                getCustomerOrderHistory(id)
            ]);

            if (!custData) {
                toast.error("Customer not found");
                router.push('/admin/customers');
                return;
            }

            setCustomer(custData);
            setTransactions(txnData || []);
            setAssets(assetData || []);
            setOrderLogs(orderLogsData || []);
            calculateLedger(txnData || []);
        } catch (error) {
            toast.error("Failed to load details");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate Running Balance (Bank Statement Style)
    const calculateLedger = (txns: any[]) => {
        // Sort Ascending (Oldest First)
        const sorted = [...txns].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        let balance = 0;
        const ledgerData = sorted.map(t => {
            const amount = t.amount || 0;
            balance += amount;

            // Determine Debit vs Credit for display
            // Positive Amount = Debit (They bought something / We gave them money) -> Increases Debt
            // Negative Amount = Credit (They paid us / Security Deposit) -> Decreases Debt
            return {
                ...t,
                debit: amount > 0 ? amount : 0,
                credit: amount < 0 ? Math.abs(amount) : 0,
                running_balance: balance
            };
        });

        // Reverse back to Newest First for Display
        setLedger(ledgerData.reverse());
    };

    if (loading) return <div className="p-8 flex justify-center text-slate-400">Loading ledger...</div>;
    if (!customer) return null;

    const debtRatio = (customer.current_balance / (customer.credit_limit || 50000)) * 100;

    return (
        <div className="p-8 bg-slate-50 min-h-screen pb-32 font-sans">
            {/* Header */}
            <div className="mb-8">
                <Link href="/admin/customers" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 mb-4 transition-colors">
                    <ArrowLeft size={16} /> Back to Customers
                </Link>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{customer.name}</h1>
                        <div className="flex items-center gap-4 mt-2 text-slate-500 font-medium">
                            <span className="flex items-center gap-1"><Phone size={14} /> {customer.phone}</span>
                            <span className="flex items-center gap-1"><MapPin size={14} /> {customer.address || "No Address"}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Balance Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
                        <Wallet size={14} /> Current Balance
                    </div>
                    <div className={`text-3xl font-black ${customer.current_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        Rs {Math.abs(customer.current_balance).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 font-bold">
                        {customer.current_balance > 0 ? 'RECEIVABLE' : 'ADVANCE'}
                    </div>
                </div>

                {/* Credit Limit Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-2">
                        <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                            Credit Limit
                        </div>
                        {debtRatio > 90 && <AlertCircle size={16} className="text-red-500" />}
                    </div>
                    <div className="text-3xl font-black text-slate-900">
                        Rs {(customer.credit_limit || 50000).toLocaleString()}
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${debtRatio > 90 ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(debtRatio, 100)}%` }}
                        />
                    </div>
                    <div className="text-xs text-slate-400 mt-1 text-right font-medium">
                        {debtRatio.toFixed(1)}% Used
                    </div>
                </div>

                {/* Asset Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
                        <Database size={14} /> Cylinders Held
                    </div>
                    <div className="text-3xl font-black text-slate-900">
                        {assets.length}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 font-bold">
                        ASSETS IN POSSESSION
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-200/50 p-1 rounded-xl w-fit mb-6">
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Financial Ledger
                </button>
                <button
                    onClick={() => setActiveTab('assets')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'assets' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Asset Logs
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">

                {activeTab === 'history' && (
                    <div>
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-slate-500 uppercase">Statement of Account</h3>
                            <button className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-emerald-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                                <Download size={14} /> Download PDF
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 w-32">Date</th>
                                        <th className="p-4">Description</th>
                                        <th className="p-4 text-right text-emerald-600 bg-emerald-50/30 w-32 border-l border-slate-50">Debit (+)</th>
                                        <th className="p-4 text-right text-indigo-600 bg-indigo-50/30 w-32 border-l border-slate-50">Credit (-)</th>
                                        <th className="p-4 text-right w-32 border-l border-slate-50">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-sm">
                                    {ledger.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-medium">No financial history available.</td></tr>
                                    ) : (
                                        ledger.map((row: any) => (
                                            <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="p-4 font-bold text-slate-600 whitespace-nowrap">
                                                    {new Date(row.created_at).toLocaleDateString()}
                                                    <span className="block text-[10px] text-slate-400 font-normal">{new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800">{row.description || 'Transaction'}</div>
                                                    <div className="flex gap-2 mt-1">
                                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${row.type.includes('sale') ? 'text-emerald-600 border-emerald-200 bg-emerald-50' :
                                                            row.type.includes('payment') ? 'text-indigo-600 border-indigo-200 bg-indigo-50' :
                                                                'text-slate-500 border-slate-200 bg-slate-100'
                                                            }`}>{row.type}</span>
                                                        {row.proof_url && (
                                                            <a href={row.proof_url} target="_blank" className="text-[10px] font-bold text-blue-500 flex items-center gap-1 hover:underline">
                                                                <Receipt size={10} /> Receipt
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right font-mono font-medium text-emerald-700 bg-emerald-50/10 border-l border-slate-50">
                                                    {row.debit > 0 ? row.debit.toLocaleString() : '-'}
                                                </td>
                                                <td className="p-4 text-right font-mono font-medium text-indigo-700 bg-indigo-50/10 border-l border-slate-50">
                                                    {row.credit > 0 ? row.credit.toLocaleString() : '-'}
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-slate-900 border-l border-slate-50 group-hover:bg-white">
                                                    Rs {row.running_balance.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'assets' && (
                    <div className="space-y-8">
                        {/* Current Holdings */}
                        <div>
                            <div className="p-4 bg-slate-50 border-b border-slate-200">
                                <h3 className="text-xs font-bold text-slate-500 uppercase">Current Asset Holdings ({assets.length})</h3>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Serial Number</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Assigned Date</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Condition</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {assets.length === 0 ? (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400">No assets currently held.</td></tr>
                                    ) : (
                                        assets.map(a => (
                                            <tr key={a.id} className="hover:bg-slate-50">
                                                <td className="p-4 font-black text-slate-900">{a.serial_number}</td>
                                                <td className="p-4 text-sm font-bold text-slate-600">
                                                    {new Date(a.updated_at).toLocaleDateString()}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-black uppercase tracking-wider ${a.status === 'full' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {a.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm font-medium text-slate-500 capitalize">{a.condition}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Order History / Logs */}
                        <div>
                            <div className="p-4 bg-slate-50 border-b border-slate-200">
                                <h3 className="text-xs font-bold text-slate-500 uppercase">Asset Movement Logs</h3>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Driver</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Delivered (Full)</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Returned (Empty)</th>
                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {orderLogs.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-slate-400">No movement history found.</td></tr>
                                    ) : (
                                        orderLogs.map(o => (
                                            <tr key={o.id} className="hover:bg-slate-50">
                                                <td className="p-4 font-bold text-slate-600">
                                                    {new Date(o.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="p-4 text-sm font-bold text-slate-900">
                                                    {o.driver?.name || 'Unknown Driver'}
                                                </td>
                                                <td className="p-4 text-emerald-600 font-bold">
                                                    +{o.cylinders_count}
                                                </td>
                                                <td className="p-4 text-indigo-600 font-bold">
                                                    {o.cylinders_returned ? `-${o.cylinders_returned}` : '-'}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {o.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
