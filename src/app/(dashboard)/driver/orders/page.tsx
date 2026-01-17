'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, MapPin, Phone, Package, AlertCircle, Camera, Check, X, RefreshCw, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { getDriverOrders, startTrip, completeDelivery } from '@/app/actions/driverActions';
import { getCustomerAssets } from '@/app/actions/customerActions';

export default function OrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  
  // -- DELIVERY MODAL STATE --
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'credit'
  const [proofFile, setProofFile] = useState<File | null>(null);
  
  // Inventory Return State
  const [customerAssets, setCustomerAssets] = useState<any[]>([]);
  const [selectedReturns, setSelectedReturns] = useState<string[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [returnsCount, setReturnsCount] = useState('0'); // Fallback manual count

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await getDriverOrders();
      setOrders(data);
    } catch (error) {
      console.error("Failed to load orders", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  // -- HANDLERS --

  const handleStartTrip = async (orderId: string) => {
    const res = await startTrip([orderId]);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success("Trip Started! Drive Safe 🚚");
      loadOrders(); // Refresh status
    }
  };

  const openDeliveryModal = async (order: any) => {
    setActiveOrder(order);
    // Reset Form
    setReceivedAmount(order.total_amount.toString());
    setPaymentMethod('cash');
    setProofFile(null);
    setReturnsCount('0');
    setSelectedReturns([]);
    setCustomerAssets([]);

    // Fetch Assets if customer exists
    if (order.customer_id) {
      setLoadingAssets(true);
      try {
        const assets = await getCustomerAssets(order.customer_id);
        setCustomerAssets(assets);
      } catch (err) {
        console.error("Failed to fetch customer assets", err);
      } finally {
        setLoadingAssets(false);
      }
    }
  };

  const toggleReturnAsset = (serial: string) => {
    setSelectedReturns(prev => 
      prev.includes(serial) ? prev.filter(s => s !== serial) : [...prev, serial]
    );
  };

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
    if (activeOrder) {
      if (method === 'credit') {
        setReceivedAmount('0');
      } else {
        setReceivedAmount(activeOrder.total_amount.toString());
      }
    }
  };

  const handleSubmitDelivery = async () => {
    if (!activeOrder) return;

    // Validation
    const amt = parseFloat(receivedAmount);
    if (isNaN(amt) || amt < 0) {
      toast.error("Invalid Amount");
      return;
    }

    if (paymentMethod === 'cash' && amt > 0 && !proofFile) {
        toast.error("Please upload a photo of the cash/receipt!");
        return;
    }

    setSubmitting(true);
    
    // Prepare FormData
    const formData = new FormData();
    formData.append('order_id', activeOrder.id);
    formData.append('received_amount', amt.toString());
    formData.append('payment_method', paymentMethod);
    formData.append('returned_empty_count', returnsCount);
    formData.append('returned_serials', JSON.stringify(selectedReturns));
    if (proofFile) formData.append('proof_file', proofFile);
    
    // Append notes if needed, skipping for now as per backup

    const res = await completeDelivery(formData);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success("Delivery Completed!");
      setActiveOrder(null);
      loadOrders(); // Refresh list
    }
    setSubmitting(false);
  };

  // Helper
  const getFriendlyId = (order: any) => {
    if (order.friendly_id) return `#${order.friendly_id}`;
    return `#${order.id.slice(0, 5).toUpperCase()}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* HEADER */}
      <header className="bg-white px-6 py-4 shadow-sm border-b border-slate-100 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/driver" className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500">
            <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-black text-slate-800 tracking-tight">Active Orders</h1>
        {loading && <RefreshCw size={16} className="animate-spin text-slate-400 ml-auto" />}
      </header>

      <main className="p-4 space-y-4 max-w-md mx-auto">
        {!loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-300">
              <Truck size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-700">All Caught Up!</h3>
            <p className="text-slate-500 text-sm mt-2 font-medium max-w-[200px]">No pending deliveries assigned to you.</p>
            <button onClick={loadOrders} className="mt-6 px-6 py-3 bg-white border border-slate-200 shadow-sm rounded-full font-bold text-slate-600 active:scale-95 transition-transform text-sm">
              Refresh
            </button>
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transform transition-all active:scale-[99%]">
               {/* Card Header */}
               <div className="p-5 border-b border-slate-50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-5">
                      <Truck size={64} />
                    </div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{getFriendlyId(order)}</span>
                          <h3 className="text-lg font-black text-slate-800 leading-tight">{order.customers?.name}</h3>
                        </div>
                        {order.status === 'on_trip' ? (
                          <span className="animate-pulse bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase px-2 py-1 rounded-full">Live</span>
                        ) : (
                          <span className="bg-blue-50 text-blue-600 text-[10px] font-black uppercase px-2 py-1 rounded-full">Assigned</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 font-medium flex items-start gap-1.5 leading-snug">
                        <MapPin size={14} className="shrink-0 mt-0.5 text-slate-400" />
                        {order.customers?.address || 'Address not provided'}
                      </p>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 pt-4">
                     {/* Asset List */}
                     <div className="bg-slate-50 rounded-lg p-3 mb-4 border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 flex items-center gap-1">
                        <Package size={12} /> Assigned Assets
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {order.cylinders && order.cylinders.length > 0 ? (
                          order.cylinders.map((cyl: any, i: number) => (
                            <span key={i} className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded shadow-sm">
                              📦 {cyl.serial_number}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No specific assets linked</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Qty</p>
                        <p className="font-black text-xl text-slate-800">{order.order_items?.[0]?.quantity || 0}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3 text-right">
                        <p className="text-[10px] uppercase font-bold text-emerald-600/60 mb-1">To Collect</p>
                        <p className="font-black text-xl text-emerald-700">Rs {order.total_amount?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                   {/* Card Footer */}
                   <div className="p-2 pb-3 px-3 flex gap-2">
                    <a href={`tel:${order.customers?.phone}`} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-sm flex items-center justify-center gap-2 active:bg-slate-50">
                      <Phone size={16} /> Call
                    </a>

                    {order.status === 'assigned' ? (
                      <button
                        onClick={() => handleStartTrip(order.id)}
                        className="flex-[2] py-3 rounded-lg font-bold text-sm shadow-md flex items-center justify-center gap-2 text-white transition-all bg-slate-800 active:bg-slate-900"
                      >
                        <Truck size={16} /> Start Trip
                      </button>
                    ) : (
                      <button
                        onClick={() => openDeliveryModal(order)}
                        className="flex-[2] py-3 rounded-lg font-bold text-sm shadow-md flex items-center justify-center gap-2 text-white transition-all bg-emerald-600 active:bg-emerald-700"
                      >
                        DELIVER & PAY
                      </button>
                    )}
                  </div>
            </div>
          ))
        )}
      </main>

      {/* -- DELIVERY MODAL -- */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
             <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={() => setActiveOrder(null)} className="absolute top-4 right-4 bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200 z-10">
                    <X size={20} />
                </button>

                <div className="p-6 pb-2">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Collect Payment</h3>
                    <p className="text-slate-500 text-sm font-medium">{getFriendlyId(activeOrder)} • {activeOrder.customers?.name}</p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Payment Section */}
                    <div>
                        <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                            <button
                                onClick={() => handlePaymentMethodChange('cash')}
                                className={`flex-1 py-3 font-bold text-sm rounded-lg transition-all shadow-sm ${paymentMethod === 'cash' ? 'bg-white text-emerald-700 ring-1 ring-slate-200' : 'text-slate-400 shadow-none'}`}
                            >
                                CASH
                            </button>
                            <button
                                onClick={() => handlePaymentMethodChange('credit')}
                                className={`flex-1 py-3 font-bold text-sm rounded-lg transition-all shadow-sm ${paymentMethod === 'credit' ? 'bg-white text-amber-600 ring-1 ring-slate-200' : 'text-slate-400 shadow-none'}`}
                            >
                                CREDIT
                            </button>
                        </div>
                        
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Amount Received</label>
                        <div className="relative">
                            <div className="absolute left-4 top-4 text-slate-400 font-bold">Rs</div>
                            <input
                                type="number"
                                value={receivedAmount}
                                onChange={(e) => setReceivedAmount(e.target.value)}
                                className="w-full h-14 pl-10 bg-slate-50 rounded-xl border border-slate-200 font-black text-2xl text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-300"
                                placeholder="0"
                            />
                        </div>
                        
                        {/* Debt Warning */}
                         {parseFloat(receivedAmount || '0') < activeOrder.total_amount && (
                            <div className="mt-3 bg-amber-50 p-3 rounded-lg border border-amber-100 flex items-start gap-2">
                                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-700 font-bold leading-tight">
                                    Rs {(activeOrder.total_amount - (parseFloat(receivedAmount) || 0)).toLocaleString()} added to Ledger.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Proof Upload (Only if Cash > 0) */}
                    {parseFloat(receivedAmount || '0') > 0 && paymentMethod === 'cash' && (
                        <div>
                             <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Proof of Payment</label>
                             <label className={`flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all ${proofFile ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
                                {proofFile ? (
                                    <div className="text-emerald-600 font-bold text-sm flex flex-col items-center gap-1 animate-in zoom-in">
                                        <Check size={24} className="bg-emerald-100 p-1 rounded-full" />
                                        <span>Image Attached</span>
                                    </div>
                                ) : (
                                    <>
                                        <Camera size={28} className="text-slate-400 mb-2" />
                                        <span className="text-xs text-slate-500 font-bold">Tap to Take Photo</span>
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                                />
                             </label>
                        </div>
                    )}

                    {/* Inventory Returns */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-3 flex justify-between items-center">
                            <span>Select Returning Assets</span>
                            {loadingAssets && <RefreshCw size={12} className="animate-spin text-emerald-500" />}
                        </label>

                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {customerAssets.length > 0 ? (
                                customerAssets.map((asset) => (
                                    <label key={asset.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedReturns.includes(asset.serial_number) ? 'bg-white border-emerald-500 shadow-sm' : 'border-transparent hover:bg-white/50'}`}>
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedReturns.includes(asset.serial_number) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                                            {selectedReturns.includes(asset.serial_number) && <Check size={14} strokeWidth={3} />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={selectedReturns.includes(asset.serial_number)}
                                            onChange={() => toggleReturnAsset(asset.serial_number)}
                                        />
                                        <div>
                                            <p className="font-bold text-slate-700 text-sm">📦 {asset.serial_number}</p>
                                            <p className="text-[10px] uppercase font-bold text-slate-400">{asset.status === 'at_customer' ? 'At Customer' : asset.status}</p>
                                        </div>
                                    </label>
                                ))
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-sm text-slate-400 font-medium">No assets found for this customer.</p>
                                </div>
                            )}
                        </div>
                        
                        {/* Fallback Manual Entry */}
                         {customerAssets.length === 0 && (
                             <div className="mt-3 pt-3 border-t border-slate-200">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Manual Count (Fallback)</p>
                                <div className="flex items-center bg-white rounded-lg p-1 border border-slate-200">
                                    <button onClick={() => setReturnsCount(Math.max(0, parseInt(returnsCount) - 1).toString())} className="w-10 h-10 rounded shadow-sm font-bold text-slate-500 active:bg-slate-50">-</button>
                                    <input 
                                        type="number" 
                                        value={returnsCount}
                                        onChange={(e) => setReturnsCount(e.target.value)}
                                        className="flex-1 h-10 bg-transparent text-center font-bold text-slate-900 outline-none"
                                    />
                                    <button onClick={() => setReturnsCount((parseInt(returnsCount) + 1).toString())} className="w-10 h-10 rounded shadow-sm font-bold text-slate-500 active:bg-slate-50">+</button>
                                </div>
                             </div>
                         )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-slate-100">
                    <button
                        onClick={handleSubmitDelivery}
                        disabled={submitting}
                        className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-lg shadow-xl active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {submitting ? <RefreshCw className="animate-spin" /> : 'Confirm Delivery'}
                    </button>
                </div>

             </div>
        </div>
      )}
    </div>
  );
}
