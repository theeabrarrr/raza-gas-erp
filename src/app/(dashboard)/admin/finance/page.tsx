'use client';

import { useState, useEffect } from 'react';
import { getCompanyStats, getLedgerHistory } from '@/app/actions/financeActions';
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';

import { TransactionModal } from '@/components/admin/TransactionModal';

export default function FinanceDashboard() {
    const [stats, setStats] = useState({ totalBalance: 0 });
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [statsData, historyData] = await Promise.all([
            getCompanyStats(),
            getLedgerHistory()
        ]);
        setStats(statsData);
        setHistory(historyData);
        setLoading(false);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Company Treasury</h1>
                    <p className="text-slate-500 font-medium mt-1">Live Cash Flow & Ledger</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadData}
                        className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-emerald-600 hover:border-emerald-200 transition-colors shadow-sm"
                        title="Refresh Data"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <TransactionModal />
                </div>
            </header>

            {/* 1. STATS CARD */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-48">
                    <div>
                        <p className="text-slate-500 font-bold uppercase tracking-wider text-xs mb-2">Total Cash in Safe</p>
                        <h2 className="text-4xl font-black tracking-tight text-emerald-600">
                            Rs {stats.totalBalance.toLocaleString()}
                        </h2>
                    </div>
                </div>

                {/* Placeholders for Future Stats (Bank, Receivables etc) */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 flex flex-col justify-center opacity-50 h-48">
                    <p className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-2">Bank Balance</p>
                    <h2 className="text-3xl font-bold text-slate-300">Coming Soon</h2>
                </div>
            </div>

            {/* 2. LEDGER HISTORY */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">Recent Transactions</h3>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{history.length} Records</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Admin</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="px-6 py-6">
                                            <div className="h-4 bg-slate-100 rounded w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                                        No transactions recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                history.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 text-slate-500 font-medium">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-slate-300" />
                                                {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-slate-700 block">{tx.transaction_type.replace('_', ' ').toUpperCase()}</span>
                                            <span className="text-xs text-slate-400">{tx.description}</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold">
                                                    {tx.users?.name?.[0] || 'A'}
                                                </div>
                                                {tx.users?.name || 'Unknown'}
                                            </div>
                                        </td>
                                        <td className={`px-6 py-4 text-right font-black ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
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
