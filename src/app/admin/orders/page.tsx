'use client';

import { useState, useEffect } from 'react';
import { getOrders } from '@/app/actions/orderActions';
import { format } from 'date-fns';
import Link from 'next/link';
import { Printer, Eye, ShoppingCart, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function OrderListPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await getOrders();
        setOrders(data);
        setLoading(false);
    };

    return (
        <div className="p-8 bg-slate-50 min-h-screen pb-32 font-sans">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Order History</h1>
                    <p className="text-sm text-slate-500 font-medium">Track all dispatch and sales records</p>
                </div>
                <Link href="/admin/orders/new" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-900/20">
                    <ShoppingCart size={16} /> New Order
                </Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Order ID</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Driver</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Loading orders...</td></tr>
                            ) : orders.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-400">No orders found.</td></tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-mono font-bold text-slate-600 text-xs">
                                            #{order.friendly_id || order.id.slice(0, 8).toUpperCase()}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-900 text-sm">{order.customers?.name || 'Guest'}</div>
                                            <div className="text-xs text-slate-400">{order.customers?.address || '-'}</div>
                                        </td>
                                        <td className="p-4 text-sm text-slate-600">
                                            {order.driver?.name || 'Unassigned'}
                                        </td>
                                        <td className="p-4 text-sm text-slate-500 flex items-center gap-2">
                                            <Calendar size={14} />
                                            {format(new Date(order.created_at), 'MMM dd, yyyy')}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-black uppercase tracking-wider ${order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                                                order.status === 'on_trip' ? 'bg-purple-100 text-purple-700' :
                                                    order.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-amber-100 text-amber-700'
                                                }`}>
                                                {order.status === 'on_trip' ? 'ON WAY' : order.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-bold text-slate-900">
                                            Rs {order.total_amount?.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link
                                                    href={`/invoice/${order.id}`}
                                                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                                                    title="View Invoice"
                                                >
                                                    <Printer size={16} />
                                                </Link>
                                            </div>
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
