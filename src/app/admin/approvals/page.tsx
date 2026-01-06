'use client';

import { useState, useEffect } from 'react';
import { getPendingHandovers, approveHandover, rejectHandover, getPendingCylinderDetails } from '@/app/actions/adminActions';
import { toast } from 'sonner';
import { CheckCircle, XCircle, RefreshCw, User, DollarSign, Package, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type Tab = 'empties' | 'cash' | 'requests';

export default function ApprovalsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('empties');
    const [requests, setRequests] = useState<any[]>([]);
    const [pendingCylinders, setPendingCylinders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Record<string, number>>({});
    const [confirmModal, setConfirmModal] = useState<{ id: string, type: 'cash' | 'assets' | 'reject', qty?: number, msg: string } | null>(null);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setLoading(true);
        const [reqs, cyls] = await Promise.all([
            getPendingHandovers(),
            getPendingCylinderDetails()
        ]);
        setRequests(reqs);
        setPendingCylinders(cyls);
        setLoading(false);
    };

    const handleApprove = (id: string, type: 'cash' | 'assets') => {
        let actualQty = undefined;
        let msg = "";

        if (type === 'assets') {
            const req = requests.find(r => (r.transaction_id || r.id) === id);
            const claimed = req?.description ? parseInt(req.description.match(/(\d+) Cylinders/)?.[1] || '0') : 0;
            const edited = editValues[id];
            actualQty = edited !== undefined ? edited : claimed;
            msg = `Confirm return of ${actualQty} Cylinders?` + (actualQty < claimed ? ` (${claimed - actualQty} will be marked MISSING/LOST)` : '');
        } else {
            msg = "Confirm Cash Receipt? This will verify the driver's deposit.";
        }

        setConfirmModal({ id, type, qty: actualQty, msg });
    };

    const handleReject = (id: string) => {
        setConfirmModal({ id, type: 'reject', msg: "Reject Request? Items will remain with driver." });
    };

    const executeAction = async () => {
        if (!confirmModal) return;
        const { id, type, qty } = confirmModal;

        setProcessing(id); // Use this to show loading on modal button if needed
        let res;

        if (type === 'reject') {
            res = await rejectHandover(id);
        } else {
            res = await approveHandover(id, qty);
        }

        setConfirmModal(null); // Close modal logic first or after? Let's close after result to show success/error logic? 
        // User wants modal. Let's close modal immediately so we can show Toast.

        if (res?.error) {
            // Smart Error Handling
            if (res.error.includes("not found") || res.error.toLowerCase().includes("processed")) {
                toast.info("Request was already processed.");
                loadRequests(); // Refresh list to remove stale item
            } else {
                toast.error(res.error);
            }
        } else {
            toast.success(type === 'reject' ? "Request Rejected" : "Inventory Updated Successfully");
            loadRequests();
        }
        setProcessing(null);
    };

    // Filter Logic
    const cashRequests = requests.filter(r => r.amount > 0);
    const assetRequests = requests.filter(r => {
        // Condition: Has pending cylinders OR specifically mentions cylinders with amount 0
        const hasPendingCylinders = pendingCylinders.some(c => c.current_holder_id === r.user_id);
        const mentionsCylinders = r.description && r.description.includes('Cylinders') && parseInt(r.description.match(/(\d+) Cylinders/)?.[1] || '0') > 0;
        return hasPendingCylinders || mentionsCylinders;
    });
    const otherRequests = requests.filter(r => false); // Placeholder

    const renderTabContent = () => {
        if (loading) return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-pulse">
                {[1, 2, 3].map(i => <div key={i} className="h-48 bg-slate-100 rounded-2xl" />)}
            </div>
        );

        let data = activeTab === 'cash' ? cashRequests : assetRequests;
        if (activeTab === 'requests') data = otherRequests;

        if (data.length === 0) return (
            <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-100">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    {activeTab === 'cash' ? <DollarSign size={32} /> : <Package size={32} />}
                </div>
                <h3 className="text-lg font-bold text-slate-800">No Pending {activeTab === 'cash' ? 'Cash' : activeTab === 'requests' ? 'Stock Requests' : 'Returns'}</h3>
                <p className="text-slate-400">Drivers are clear.</p>
            </div>
        );

        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.map((req, idx) => {
                    const reqId = req.transaction_id || req.id;
                    const driverName = req.driver_name || req.users?.name || 'Unknown Driver';
                    const driverCylinders = pendingCylinders.filter(c => c.current_holder_id === req.user_id);

                    return (
                        <div key={reqId || idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 border border-slate-200 font-bold max-sm:hidden">
                                            {driverName[0]}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Driver</p>
                                            <p className="font-bold text-slate-800">{driverName}</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                                        {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                                    </span>
                                </div>

                                <div className="space-y-3 mb-6">
                                    {activeTab === 'cash' && (
                                        <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                            <div className="flex items-center gap-2 text-emerald-700 text-sm font-bold">
                                                <DollarSign size={18} /> Cash Deposit
                                            </div>
                                            <span className="font-black text-xl text-emerald-800">Rs {req.amount?.toLocaleString()}</span>
                                        </div>
                                    )}

                                    {activeTab === 'empties' && (
                                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                                            <div className="flex items-between w-full mb-3">
                                                <div className="flex items-center gap-2 text-amber-700 text-sm font-bold">
                                                    <Package size={18} /> Assets
                                                </div>
                                                <span className="ml-auto text-xs font-bold bg-white px-2 py-1 rounded border border-amber-200 text-amber-600">
                                                    {driverCylinders.length} Pending
                                                </span>
                                            </div>

                                            {/* Serial Numbers Display */}
                                            <div className="flex flex-wrap gap-1 mb-3 max-h-24 overflow-y-auto">
                                                {driverCylinders.length > 0 ? driverCylinders.map((c: any, i: number) => (
                                                    <span key={c.id || i} className="text-[10px] font-bold bg-white border border-amber-200 text-slate-600 px-1.5 py-0.5 rounded">
                                                        {c.serial_number}
                                                    </span>
                                                )) : (
                                                    <span className="text-xs text-slate-400 italic">No specific serials logged.</span>
                                                )}
                                            </div>

                                            <p className="text-xs text-slate-500 mb-2 border-t border-amber-200 pt-2">
                                                <span className="font-bold">Claimed:</span> {req.description}
                                            </p>

                                            {/* Edit Qty Input */}
                                            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-amber-200">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Approved Qty:</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="w-full font-bold text-slate-900 outline-none text-sm"
                                                    placeholder={driverCylinders.length.toString()}
                                                    value={editValues[reqId] ?? ''}
                                                    onChange={(e) => setEditValues({ ...editValues, [reqId]: parseInt(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-slate-50">
                                <button
                                    onClick={() => handleReject(reqId)}
                                    disabled={!!processing}
                                    className="flex-1 py-2 bg-white border border-red-100 text-red-600 rounded-lg font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                    {processing === reqId ? <RefreshCw className="animate-spin mx-auto" size={16} /> : 'Reject'}
                                </button>
                                <button
                                    onClick={() => handleApprove(reqId, activeTab === 'cash' ? 'cash' : 'assets')}
                                    disabled={!!processing}
                                    className="flex-[2] py-2 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {processing === reqId ? (
                                        <><RefreshCw className="animate-spin" size={16} /> Approving...</>
                                    ) : (
                                        <><CheckCircle size={16} /> Approve</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Reconciliation Hub</h1>
                    <p className="text-slate-500 font-medium mt-1">Verify Driver Deposits & Returns</p>
                </div>
                <button
                    onClick={loadRequests}
                    className="p-2 bg-white border border-slate-200 rounded-full text-slate-600 hover:text-emerald-600 hover:border-emerald-200 transition-colors shadow-sm"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </header>

            {/* Tabs */}
            <div className="border-b border-slate-200">
                <nav className="flex gap-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('empties')}
                        className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'empties'
                            ? 'border-emerald-500 text-emerald-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                        <Package size={18} />
                        Empties Return
                        {assetRequests.length > 0 && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px]">{assetRequests.length}</span>}
                    </button>

                    <button
                        onClick={() => setActiveTab('cash')}
                        className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'cash'
                            ? 'border-emerald-500 text-emerald-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                        <DollarSign size={18} />
                        Cash Handover
                        {cashRequests.length > 0 && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px]">{cashRequests.length}</span>}
                    </button>

                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'requests'
                            ? 'border-emerald-500 text-emerald-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                        <AlertTriangle size={18} />
                        Stock Requests
                    </button>
                </nav>
            </div>

            {/* Content */}
            <main className="min-h-[400px]">
                {renderTabContent()}
            </main>
            {/* Confirmation Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md p-6 rounded-2xl shadow-xl border border-slate-100 scale-100 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className={`p-3 rounded-full ${confirmModal.type === 'reject' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {confirmModal.type === 'reject' ? <XCircle size={32} /> : <CheckCircle size={32} />}
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">
                                {confirmModal.type === 'reject' ? 'Reject Request' : 'Confirm Approval'}
                            </h3>
                            <p className="text-slate-500 font-medium">
                                {confirmModal.msg}
                            </p>

                            <div className="flex gap-3 w-full pt-4">
                                <button
                                    onClick={() => setConfirmModal(null)}
                                    disabled={!!processing}
                                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeAction}
                                    disabled={!!processing}
                                    className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 ${confirmModal.type === 'reject'
                                        ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                                        }`}
                                >
                                    {processing ? (
                                        <><RefreshCw className="animate-spin" size={20} /> Processing...</>
                                    ) : (
                                        confirmModal.type === 'reject' ? 'Reject' : 'Confirm'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
