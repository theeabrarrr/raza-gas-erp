'use client';

import { useState, useEffect } from 'react';
import { getExpenses, getExpenseStats, approveExpense, rejectExpense } from '@/app/actions/adminExpenseActions';
import { toast } from 'sonner';
import { Check, X, Eye, BanknoteIcon, Clock, ChartBar, DownloadCloud, AlertCircle } from 'lucide-react';
import { User, FileText } from 'lucide-react';

type Expense = {
    id: string;
    created_at: string;
    amount: number;
    category: string;
    description?: string;
    proof_url: string;
    status: 'pending' | 'approved' | 'rejected';
    profiles: { full_name: string };
};

type Stats = {
    monthSpend: number;
    pendingLiability: number;
    topCategory: { name: string; amount: number; percentage: number };
    weeklyTrend: { date: string; amount: number }[];
};

export default function AdminExpensesPage() {
    const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingStats, setLoadingStats] = useState(true);

    // Modal State
    const [showProofModal, setShowProofModal] = useState(false);
    const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; id: string; amount: number; name: string } | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        // Load Lists
        const data = await getExpenses(activeTab);
        setExpenses(data as Expense[]);
        setLoading(false);

        // Load Stats only once or on specific triggers if needed.
        if (!stats) {
            setLoadingStats(true);
            const statsData = await getExpenseStats();
            setStats(statsData);
            setLoadingStats(false);
        }
    };

    const handleActionClick = (type: 'approve' | 'reject', expense: Expense) => {
        setConfirmAction({
            type,
            id: expense.id,
            amount: expense.amount,
            name: expense.profiles?.full_name || 'Unknown Driver'
        });
    };

    const confirmActionHandler = async () => {
        if (!confirmAction) return;
        setProcessingId(confirmAction.id);

        let res;
        if (confirmAction.type === 'approve') {
            res = await approveExpense(confirmAction.id);
        } else {
            res = await rejectExpense(confirmAction.id);
        }

        setProcessingId(null);
        setConfirmAction(null);

        if (res.success) {
            toast.success(`Expense ${confirmAction.type === 'approve' ? 'Approved' : 'Rejected'}!`);
            loadData(); // Reload both list and stats as amounts changed
        } else {
            toast.error(res.error || "Action Failed");
        }
    };

    const exportCSV = () => {
        if (expenses.length === 0) {
            toast.error("No data to export");
            return;
        }

        const headers = ["ID", "Date", "Driver", "Category", "Amount", "Status", "Description"];
        const rows = expenses.map(e => [
            e.id,
            new Date(e.created_at).toLocaleDateString(),
            e.profiles?.full_name || 'Unknown',
            e.category,
            e.amount,
            e.status,
            e.description || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.map(c => `"${c}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expenses-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const openProof = (url: string) => {
        setSelectedProofUrl(url);
        setShowProofModal(true);
    };

    const formatCurrency = (amount: number) => {
        return `Rs. ${amount.toLocaleString()}`;
    };

    // Calculate chart total for empty state check
    const chartTotal = stats?.weeklyTrend.reduce((acc, curr) => acc + curr.amount, 0) || 0;

    return (
        <div className="min-h-screen bg-slate-50 p-8 space-y-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* 1. Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Financial Dashboard</h1>
                        <p className="text-slate-500">Manage expenses and approve requests.</p>
                    </div>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        <DownloadCloud size={18} /> Export CSV
                    </button>
                </div>

                {/* 2. Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Card 1: Month Spend */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Month's Spend</p>
                            <h2 className="text-3xl font-black text-slate-800">
                                {loadingStats ? '...' : formatCurrency(stats?.monthSpend || 0)}
                            </h2>
                            <p className="text-emerald-600 text-xs font-bold mt-2 flex items-center gap-1">
                                <Check size={12} /> Approved Limit
                            </p>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <BanknoteIcon size={24} />
                        </div>
                    </div>

                    {/* Card 2: Pending Liability */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Pending Liability</p>
                            <h2 className="text-3xl font-black text-slate-800">
                                {loadingStats ? '...' : formatCurrency(stats?.pendingLiability || 0)}
                            </h2>
                            <p className="text-orange-500 text-xs font-bold mt-2 flex items-center gap-1">
                                <Clock size={12} /> Needs Approval
                            </p>
                        </div>
                        <div className="p-3 bg-orange-50 text-orange-500 rounded-xl">
                            <AlertCircle size={24} />
                        </div>
                    </div>

                    {/* Card 3: Top Category */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Top Category</p>
                            <h2 className="text-3xl font-black text-slate-800">
                                {loadingStats ? '...' : stats?.topCategory.name}
                            </h2>
                            <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden max-w-[100px]">
                                <div className="h-full bg-blue-500" style={{ width: `${stats?.topCategory.percentage || 0}%` }}></div>
                            </div>
                            <p className="text-slate-400 text-xs mt-1 font-medium">{stats?.topCategory.percentage || 0}% of spend</p>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <ChartBar size={24} />
                        </div>
                    </div>
                </div>

                {/* 3. Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200">
                    {(['pending', 'approved', 'rejected'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 text-sm font-bold capitalize transition-all border-b-2 ${activeTab === tab
                                ? 'border-slate-800 text-slate-800'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* 4. Chart & List Content */}
                <div className="space-y-6">

                    {/* Chart - Only for Approved Tab */}
                    {activeTab === 'approved' && (
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-6">Last 7 Days Spending</h3>

                            {loadingStats ? (
                                <div className="h-40 flex items-center justify-center text-slate-300">Loading Trends...</div>
                            ) : chartTotal === 0 ? (
                                <div className="h-40 flex items-center justify-center text-slate-400 font-medium bg-slate-50/50 rounded-lg">
                                    No spending activity this week.
                                </div>
                            ) : (
                                <div className="h-40 flex items-end justify-between gap-4 px-4">
                                    {stats?.weeklyTrend.map((day, idx) => {
                                        const maxVal = Math.max(...(stats?.weeklyTrend.map(d => d.amount) || [1]));
                                        // Ensure at least a sliver if > 0, else 0 height if 0.
                                        const height = day.amount === 0 ? 0 : Math.max(2, (day.amount / maxVal) * 100);

                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                                                <div className="relative w-full max-w-[60px] rounded-t-lg bg-emerald-100/30 hover:bg-emerald-100 transition-colors h-full flex items-end overflow-visible">
                                                    {/* Bar */}
                                                    <div
                                                        className="w-full bg-emerald-500 rounded-t-lg transition-all duration-500 hover:bg-emerald-600"
                                                        style={{ height: `${height}%` }}
                                                    ></div>

                                                    {/* Tooltip */}
                                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-bold py-1.5 px-3 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                                        Rs. {day.amount.toLocaleString()}
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold text-slate-400 uppercase">{day.date}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* List */}
                    {loading ? (
                        <div className="text-center py-20 text-slate-400 animate-pulse">Loading records...</div>
                    ) : expenses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm border-dashed">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <FileText size={32} className="text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">No {activeTab} expenses</h3>
                            <p className="text-slate-500 text-sm">Everything looks clear here.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {expenses.map((expense) => (
                                <div key={expense.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${expense.category === 'Fuel' ? 'bg-blue-50 text-blue-600' :
                                            expense.category === 'Food' ? 'bg-orange-50 text-orange-600' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                            {expense.category[0]}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-lg">{expense.category}</h3>
                                            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                                <span className="flex items-center gap-1 font-medium text-slate-600">
                                                    <User size={14} /> {expense.profiles?.full_name || 'Unknown'}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span>{new Date(expense.created_at).toLocaleDateString()}</span>
                                            </div>
                                            {expense.description && (
                                                <p className="text-sm text-slate-400 mt-1 max-w-md">{expense.description}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-slate-900">
                                                {formatCurrency(expense.amount)}
                                            </p>
                                            <p className={`text-xs font-bold uppercase tracking-wider ${expense.status === 'approved' ? 'text-emerald-500' :
                                                expense.status === 'rejected' ? 'text-rose-500' : 'text-orange-500'
                                                }`}>
                                                {expense.status}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openProof(expense.proof_url)}
                                                className="p-3 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                                                title="View Receipt"
                                            >
                                                <Eye size={20} />
                                            </button>

                                            {activeTab === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleActionClick('reject', expense)}
                                                        disabled={!!processingId}
                                                        className="p-3 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 transition-colors disabled:opacity-50"
                                                        title="Reject"
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleActionClick('approve', expense)}
                                                        disabled={!!processingId}
                                                        className="p-3 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                                        title="Approve"
                                                    >
                                                        <Check size={20} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Proof Modal (unchanged styles) */}
                {showProofModal && (
                    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowProofModal(false)}>
                        <div className="relative bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl scale-100 transition-all" onClick={e => e.stopPropagation()}>
                            <div className="absolute top-4 right-4 z-10">
                                <button onClick={() => setShowProofModal(false)} className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 backdrop-blur-md transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            {selectedProofUrl ? (
                                <div className="w-full h-[80vh] bg-black flex items-center justify-center">
                                    <img
                                        src={selectedProofUrl}
                                        alt="Expense Proof"
                                        className="max-w-full max-h-full object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="p-20 text-center text-slate-400">
                                    <p>No proof image available.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Confirm Action Modal (unchanged styles) */}
                {confirmAction && (
                    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
                        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
                            <h3 className="text-xl font-bold text-slate-800 mb-2">
                                {confirmAction.type === 'approve' ? 'Confirm Approval?' : 'Reject Request?'}
                            </h3>
                            <p className="text-slate-600 mb-6">
                                {confirmAction.type === 'approve'
                                    ? <span>Approve this expense for <span className="font-bold text-slate-900">{confirmAction.name}</span>?</span>
                                    : <span>Are you sure you want to reject this request from <span className="font-bold text-slate-900">{confirmAction.name}</span>?</span>
                                }
                            </p>

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmActionHandler}
                                    disabled={!!processingId}
                                    className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center gap-2 ${confirmAction.type === 'approve'
                                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                                        : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                                        }`}
                                >
                                    {processingId ? 'Processing...' : (confirmAction.type === 'approve' ? 'Confirm Approval' : 'Reject Expense')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
