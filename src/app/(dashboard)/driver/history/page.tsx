'use client';

import { useState, useEffect } from 'react';
import { getCompletedOrders } from '@/app/actions/driverActions';
import { format, addDays, subDays } from 'date-fns';
import { Share2, ArrowLeft, RefreshCw, Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function HistoryPage() {
    const [loading, setLoading] = useState(true);
    const [completed, setCompleted] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        loadHistory();
    }, [selectedDate]); // Re-run when date changes

    const loadHistory = async () => {
        setLoading(true);
        try {
            // Pass ISO string to backend
            const data = await getCompletedOrders(selectedDate.toISOString());
            setCompleted(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load history");
        } finally {
            setLoading(false);
        }
    };

    const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
    const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));

    const getFriendlyId = (order: any) => {
        if (order.friendly_id) return `#${order.friendly_id}`;
        return `#${order.id.slice(0, 5).toUpperCase()}`;
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24 font-sans">
            {/* 1. MAIN HEADER (Sticky) */}
            <header className="bg-white shadow-sm border-b border-slate-100 z-20 sticky top-0">
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/driver" className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500">
                            <ArrowLeft size={24} />
                        </Link>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">Daily History</h1>
                    </div>
                    <button
                        onClick={loadHistory}
                        className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* 2. DATE NAVIGATION BAR (Sticky Sub-header) */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                    <button
                        onClick={handlePrevDay}
                        className="p-2 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-500 active:scale-95 transition-transform"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm relative">
                        <CalendarIcon size={16} className="text-emerald-500" />
                        <span className="text-sm font-bold text-slate-700 w-32 text-center">
                            {format(selectedDate, 'EEE, MMM do')}
                        </span>
                        {/* Hidden Date Input Overlay */}
                        <input
                            type="date"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            value={format(selectedDate, 'yyyy-MM-dd')}
                            onChange={(e) => {
                                if (e.target.value) setSelectedDate(new Date(e.target.value));
                            }}
                        />
                    </div>

                    <button
                        onClick={handleNextDay}
                        disabled={format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')}
                        className="p-2 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-500 active:scale-95 transition-transform disabled:opacity-50"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </header>


            <main className="p-4 max-w-md mx-auto space-y-4">

                {/* LOADING SHIMMER */}
                {loading && completed.length === 0 && (
                    <div className="space-y-3 mt-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-white rounded-xl shadow-sm animate-pulse border border-slate-100"></div>
                        ))}
                    </div>
                )}

                {/* EMPTY STATE */}
                {!loading && completed.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                            <CheckCircle2 size={32} />
                        </div>
                        <h3 className="text-lg font-black text-slate-600">No Records Found</h3>
                        <p className="text-slate-400 text-sm font-medium mt-1">
                            No deliveries on {format(selectedDate, 'MMM do')}.
                        </p>
                    </div>
                )}

                {/* ORDER LIST */}
                {!loading && completed.map(order => (
                    <div key={order.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden group hover:border-emerald-100 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide">{getFriendlyId(order)}</span>
                                    <span className="text-[10px] uppercase font-bold text-slate-300">
                                        {format(new Date(order.created_at), 'h:mm a')}
                                    </span>
                                </div>
                                <h3 className="font-black text-slate-800 text-base leading-tight">{order.customers?.name || 'Unknown User'}</h3>
                            </div>

                            {/* Status Badge */}
                            <div className="text-right">
                                <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase px-2 py-1 rounded-full border border-emerald-100">
                                    Delivered
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Paid / Total</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="font-bold text-slate-900">Rs {order.amount_received?.toLocaleString() || '0'}</span>
                                    <span className="text-xs text-slate-400 font-medium">/ {order.total_amount?.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Payment</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded capitalize ${order.payment_method === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {order.payment_method || 'Pending'}
                                </span>
                            </div>
                        </div>

                        {/* Share Invoice Action */}
                        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                                href={`https://wa.me/?text=Invoice for Order ${getFriendlyId(order)}: Rs ${order.total_amount} - Paid: Rs ${order.amount_received}`}
                                target="_blank"
                                className="p-2 bg-slate-900 text-white rounded-full shadow-lg hover:scale-110 transition-transform flex"
                            >
                                <Share2 size={14} />
                            </a>
                        </div>
                    </div>
                ))}

            </main>
        </div>
    );
}
