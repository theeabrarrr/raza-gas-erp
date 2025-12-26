'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { Printer, Share2, MapPin, Phone, Mail, Package, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function InvoicePage() {
    const { id } = useParams();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function fetchOrder() {
            if (!id) return;
            try {
                setLoading(true);
                // Try searching by ID first (UUID)
                let { data, error } = await supabase
                    .from('orders')
                    .select('*, customers(*), order_items(*)')
                    .eq('id', id)
                    .single();

                if (error || !data) {
                    // Fallback: Try searching by readable_id if the ID param looks short/custom
                    // Note: This depends on if readable_id is unique enough or if we want to support it in URL
                    // For now, let's assume the URL param IS the UUID for simplicity, 
                    // but if the user passed a readable_id, we might want to query that.
                    // Let's stick to UUID for the route param for safety, or check if valid UUID.
                }

                if (error) throw error;
                setOrder(data);
            } catch (err: any) {
                console.error(err);
                setError('Order not found or invalid ID.');
            } finally {
                setLoading(false);
            }
        }

        fetchOrder();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package size={32} />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Invoice Not Found</h1>
                    <p className="text-slate-500 mb-6">{error || "We couldn't locate the order details."}</p>
                    <Link href="/" className="inline-flex items-center gap-2 text-emerald-600 font-bold hover:underline">
                        <ArrowLeft size={16} /> Return to Home
                    </Link>
                </div>
            </div>
        );
    }

    const handlePrint = () => {
        window.print();
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: `Raza Gas Invoice #${order.readable_id || order.id.slice(0, 6)}`,
                text: `Invoice for order #${order.readable_id || order.id.slice(0, 6)} from Raza Gas.`,
                url: window.location.href,
            }).catch(console.error);
        } else {
            // Fallback to WhatsApp
            const text = `Here is your invoice link: ${window.location.href}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans print:p-0 print:bg-white">
            <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none">

                {/* Header */}
                <div className="bg-slate-900 text-white p-8 print:bg-white print:text-black print:border-b-2 print:border-slate-200">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-emerald-400 print:text-emerald-600 uppercase">Raza Gas</h1>
                            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1 print:text-slate-500">Management System</p>
                            <div className="flex items-center gap-4 mt-4 text-sm text-slate-300 print:text-slate-600">
                                <span className="flex items-center gap-1"><MapPin size={14} /> Main Highway, City</span>
                                <span className="flex items-center gap-1"><Phone size={14} /> +92 300 1234567</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="inline-block bg-white/10 p-4 rounded-xl backdrop-blur-sm print:bg-slate-100 print:text-black">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Invoice Number</p>
                                <p className="text-2xl font-mono font-bold tracking-wider">#{order.readable_id || order.id.slice(0, 6).toUpperCase()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* content */}
                <div className="p-8">

                    {/* Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Billed To</h3>
                            <div className="space-y-1">
                                <h2 className="text-xl font-bold text-slate-900">{order.customers?.name || 'Guest Customer'}</h2>
                                <div className="flex items-center gap-2 text-slate-600">
                                    <MapPin size={16} className="text-emerald-600" />
                                    <span>{order.customers?.address || 'No Address Provided'}</span>
                                </div>
                                {order.customers?.phone && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Phone size={16} className="text-emerald-600" />
                                        <span>{order.customers?.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="md:text-right">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Order Details</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between md:justify-end gap-4">
                                    <span className="text-slate-500">Date Issued:</span>
                                    <span className="font-bold text-slate-900">
                                        {order.created_at ? format(new Date(order.created_at), 'MMM dd, yyyy') : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex justify-between md:justify-end gap-4">
                                    <span className="text-slate-500">Status:</span>
                                    <span className={`font-bold px-2 py-0.5 rounded text-xs uppercase ${order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                        {order.status}
                                    </span>
                                </div>
                                <div className="flex justify-between md:justify-end gap-4">
                                    <span className="text-slate-500">Payment:</span>
                                    <span className="font-bold text-slate-900 uppercase">{order.payment_method || 'Unpaid'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden mb-8">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 border-b border-slate-200">Item Description</th>
                                    <th className="p-4 border-b border-slate-200 text-center">Quantity</th>
                                    <th className="p-4 border-b border-slate-200 text-right">Price</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {order.order_items?.map((item: any, i: number) => (
                                    <tr key={i}>
                                        <td className="p-4">
                                            <span className="font-bold text-slate-900 block">{item.product_name}</span>
                                            {/* <span className="text-xs text-slate-400">Standard Cylinder</span> */}
                                        </td>
                                        <td className="p-4 text-center font-mono font-bold text-slate-700">x{item.quantity}</td>
                                        <td className="p-4 text-right font-bold text-slate-900">
                                            {/* Assuming we don't store unit price on item, just guessing or fetching. 
                             If not available, we can just show total for now or calculate if possible.
                             But simplest is to just show total amount at bottom since schema is unclear.
                             Let's leave price column empty per item if we don't have it, or show "---"
                             Actually, let's just show total amount. 
                                            ---
                         */}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50">
                                <tr>
                                    <td colSpan={2} className="p-4 text-right font-bold text-slate-500 uppercase text-xs">Total Amount</td>
                                    <td className="p-4 text-right text-xl font-black text-emerald-600">Rs {order.total_amount?.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Footer Note */}
                    <div className="text-center text-slate-400 text-xs mb-8">
                        <p>Thank you for your business!</p>
                        <p className="mt-1">For questions, please contact our support.</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 justify-center print:hidden">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-95"
                        >
                            <Printer size={20} /> Print Invoice
                        </button>
                        <button
                            onClick={handleShare}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all active:scale-95"
                        >
                            <Share2 size={20} /> Share
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
