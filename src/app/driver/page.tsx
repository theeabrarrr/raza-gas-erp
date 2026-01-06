'use client';

import { useState, useEffect } from 'react';
import { Truck, MapPin, DollarSign, Camera, Check, Navigation, X, Share2, Phone, AlertCircle, RefreshCw, User as UserIcon, Package } from 'lucide-react';
import LogoutBtn from '@/components/LogoutBtn';
import { toast } from 'sonner';
import { getDriverOrders, startTrip, completeDelivery, getCompletedOrders, getDriverInventory, getDriverStats, getDriverAllAssets, processHandover, getReceivers } from '@/app/actions/driverActions';
import { getCustomerAssets } from '@/app/actions/customerActions';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

type View = 'route' | 'history';

export default function DriverApp() {
  const [view, setView] = useState<View>('route');
  const [orders, setOrders] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState('Driver');
  const [stockCount, setStockCount] = useState(0);

  // HUD Stats
  const [stats, setStats] = useState({ cashLiability: 0, emptiesOnHand: 0 });

  // Trip State
  const isTripStarted = orders.some(o => o.status === 'on_trip');

  // Modal State
  const [activeOrder, setActiveOrder] = useState<any>(null); // For Delivery Modal
  const [showHandover, setShowHandover] = useState(false); // For Handover Modal

  const [submitting, setSubmitting] = useState(false);

  // Delivery Form State
  const [receivedAmount, setReceivedAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [returnsCount, setReturnsCount] = useState('0'); // Fallback
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [customerAssets, setCustomerAssets] = useState<any[]>([]);
  const [selectedReturns, setSelectedReturns] = useState<string[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Handover Form State
  const [depositAmount, setDepositAmount] = useState('');
  const [driverAssets, setDriverAssets] = useState<any[]>([]);
  const [selectedHandoverAssets, setSelectedHandoverAssets] = useState<string[]>([]);
  const [receivers, setReceivers] = useState<any[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // Fetch Driver Name
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.name) {
      setDriverName(user.user_metadata.name);
    }

    const [pending, done, inventory, hudStats] = await Promise.all([
      getDriverOrders(),
      getCompletedOrders(),
      getDriverInventory(),
      getDriverStats()
    ]);

    setOrders(pending);
    setCompleted(done);
    setStockCount(inventory.count);
    setStats(hudStats);
    setLoading(false);
  };

  const openHandoverModal = async () => {
    setShowHandover(true);
    setDepositAmount(stats.cashLiability.toString()); // Default to max
    setSelectedHandoverAssets([]);
    setLoadingAssets(true);
    const [assets, recs] = await Promise.all([
      getDriverAllAssets(),
      getReceivers()
    ]);
    setDriverAssets(assets);
    setReceivers(recs);
    if (recs.length > 0) setSelectedReceiver(recs[0].id); // Default to first
    setLoadingAssets(false);
  };

  const toggleHandoverAsset = (serial: string) => {
    setSelectedHandoverAssets(prev =>
      prev.includes(serial) ? prev.filter(s => s !== serial) : [...prev, serial]
    );
  };

  const handleHandoverSubmit = async () => {
    if (!selectedReceiver) {
      toast.error("Please select a receiver");
      return;
    }

    // Validation: Prevent Fake Money
    const deposit = parseFloat(depositAmount);
    if (deposit > stats.cashLiability) {
      toast.error(`Insufficient Funds! You only have Rs ${stats.cashLiability}`);
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('deposit_amount', depositAmount);
    formData.append('returned_serials', JSON.stringify(selectedHandoverAssets));
    formData.append('receiver_id', selectedReceiver);

    const res = await processHandover(formData);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success("Request Sent for Approval!");
      setShowHandover(false);
      loadData();
    }
    setSubmitting(false);
  };


  // ... (handleStartTrip, openDeliveryModal etc. remain same)

  const handleStartTrip = async () => {
    const ids = orders.map(o => o.id);
    const res = await startTrip(ids);
    if (res?.error) toast.error(res.error);
    else {
      toast.success("Trip Started! Drive Safe 🚚");
      loadData();
    }
  };

  const openDeliveryModal = async (order: any) => {
    setActiveOrder(order);
    setReceivedAmount(order.total_amount.toString()); // Default to full
    setPaymentMethod('cash');
    setReturnsCount('0');
    setProofFile(null);
    setSelectedReturns([]);
    setCustomerAssets([]);

    // Fetch Assets for Swap
    if (order.customer_id) {
      setLoadingAssets(true);
      const assets = await getCustomerAssets(order.customer_id);
      setCustomerAssets(assets);
      setLoadingAssets(false);
    }
  };

  const toggleReturnAsset = (serial: string) => {
    setSelectedReturns(prev =>
      prev.includes(serial) ? prev.filter(s => s !== serial) : [...prev, serial]
    );
  };

  const handleDeliverySubmit = async () => {
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
    const formData = new FormData();
    formData.append('order_id', activeOrder.id);
    formData.append('received_amount', amt.toString());
    formData.append('payment_method', paymentMethod);
    formData.append('returned_empty_count', returnsCount); // Fallback
    formData.append('returned_serials', JSON.stringify(selectedReturns)); // Specifics
    if (proofFile) formData.append('proof_file', proofFile);

    const res = await completeDelivery(formData);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success("Delivery Completed!");
      setActiveOrder(null);
      loadData();
    }
    setSubmitting(false);
  };

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
    if (activeOrder) {
      if (method === 'credit') {
        setReceivedAmount('0'); // Auto-zero for credit
      } else {
        setReceivedAmount(activeOrder.total_amount.toString()); // Auto-fill for cash
      }
    }
  };

  // Helper for Friendly ID
  const getFriendlyId = (order: any) => {
    if (order.friendly_id) return `#${order.friendly_id}`;
    return `#${order.id.slice(0, 5).toUpperCase()}`;
  };

  const handleSingleStart = async (id: string) => {
    const res = await startTrip([id]);
    if (res?.error) toast.error(res.error);
    else {
      toast.success("Trip Started for Order");
      loadData();
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-24">
      {/* Dark Premium Navbar */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="flex justify-between items-center p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700">
              <UserIcon size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Driver</p>
              <h1 className="text-sm font-black tracking-tight">{driverName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openHandoverModal}
              title="Deposit & Return"
              className="p-2 bg-slate-800 text-emerald-400 border border-slate-700 rounded-full hover:bg-slate-700 hover:text-emerald-300 transition-colors"
            >
              <DollarSign size={20} />
            </button>
            <button
              onClick={loadData}
              className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white active:bg-slate-700 transition-colors"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* HUD STATS BAR */}
        <div className="grid grid-cols-3 gap-px bg-slate-800 border-t border-slate-800">
          <div className="bg-slate-900 p-2 text-center">
            <p className="text-[10px] uppercase font-bold text-slate-500">Full</p>
            <p className="text-lg font-black text-emerald-400">{stockCount}</p>
          </div>
          <div className="bg-slate-900 p-2 text-center">
            <p className="text-[10px] uppercase font-bold text-slate-500">Empty</p>
            <p className="text-lg font-black text-amber-500">{stats.emptiesOnHand}</p>
          </div>
          <div className="bg-slate-900 p-2 text-center">
            <p className="text-[10px] uppercase font-bold text-slate-500">Cash</p>
            <p className="text-lg font-black text-white">Rs {stats.cashLiability.toLocaleString()}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pb-0 gap-6">
          <button
            onClick={() => setView('route')}
            className={`pb-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${view === 'route' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500'}`}
          >
            My Route ({orders.length})
          </button>
          <button
            onClick={() => setView('history')}
            className={`pb-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${view === 'history' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500'}`}
          >
            History
          </button>
        </div>
      </header>
      <main className="p-4 max-w-md mx-auto relative z-10">

        {/* ROUTE VIEW */}
        {view === 'route' && !loading && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6 text-slate-400">
                  <Truck size={40} />
                </div>
                <h3 className="text-xl font-black text-slate-700">All Clear!</h3>
                <p className="text-slate-500 text-sm mt-2 font-medium max-w-[200px]">No pending deliveries assigned to you at the moment.</p>
                <button onClick={loadData} className="mt-6 px-6 py-3 bg-white border border-slate-200 shadow-sm rounded-full font-bold text-slate-600 active:scale-95 transition-transform text-sm">
                  Check for Updates
                </button>
              </div>
            ) : (
              orders.map(order => (
                <div key={order.id} className="bg-white rounded-xl shadow-md border-0 ring-1 ring-slate-100 overflow-hidden transform transition-all active:scale-[99%]">
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
                        {order.status === 'on_trip' && (
                          <span className="animate-pulse bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase px-2 py-1 rounded-full">Live</span>
                        )}
                        {order.status === 'assigned' && (
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
                        onClick={() => handleSingleStart(order.id)}
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
          </div>
        )}

        {/* HISTORY VIEW */}
        {view === 'history' && !loading && (
          <div className="space-y-3">
            {completed.map(order => (
              <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center opacity-75 grayscale hover:grayscale-0 transition-all">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{getFriendlyId(order)}</p>
                  <p className="font-bold text-slate-900 text-sm">{order.customers?.name}</p>
                  <p className="text-xs text-slate-500 font-medium">{format(new Date(order.created_at), 'h:mm a · MMM dd')}</p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-600 font-black">Rs {order.total_amount?.toLocaleString()}</p>
                  <a
                    href={`https://wa.me/?text=Invoice for Order ${getFriendlyId(order)}: Rs ${order.total_amount} - Paid via Cash`}
                    target="_blank"
                    className="text-[10px] font-bold text-emerald-500 flex items-center justify-end gap-1 mt-1 hover:text-emerald-700"
                  >
                    <Share2 size={12} /> Share Invoice
                  </a>
                </div>
              </div>
            ))}
            {completed.length === 0 && <p className="text-center text-slate-400 py-12 text-sm font-medium">No completed orders today.</p>}
          </div>
        )}
      </main>

      {/* DELIVERY MODAL - Centered & Responsive */}
      {
        activeOrder && (
          <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setActiveOrder(null)} className="absolute top-4 right-4 bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200 z-10"><X size={20} /></button>

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

                {/* Inventory Returns (Asset Swap) */}
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

                  {/* Fallback Manual Entry (Hidden mostly, or optional) */}
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

              <div className="p-4 bg-white border-t border-slate-100">
                <button
                  onClick={handleDeliverySubmit}
                  disabled={submitting}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-lg shadow-xl active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? <RefreshCw className="animate-spin" /> : 'Confirm Delivery'}
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* HANDOVER MODAL */}
      {showHandover && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowHandover(false)} className="absolute top-4 right-4 bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200 z-10"><X size={20} /></button>

            <div className="p-6 pb-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Deposit & Return</h3>
              <p className="text-slate-500 text-sm font-medium">Handover cash and assets to Warehouse.</p>
            </div>

            <div className="p-6 space-y-6">

              {/* Receiver Selection - REQUIRED */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Handover To (Admin)</label>
                <select
                  value={selectedReceiver}
                  onChange={(e) => setSelectedReceiver(e.target.value)}
                  className="w-full h-14 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                >
                  <option value="" disabled>Select Receiver</option>
                  {receivers.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.role})</option>
                  ))}
                </select>
              </div>

              {/* Cash Deposit Section */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Cash Deposit</label>
                <div className="relative">
                  <div className="absolute left-4 top-4 text-slate-400 font-bold">Rs</div>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full h-14 pl-10 bg-slate-50 rounded-xl border border-slate-200 font-black text-2xl text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-300"
                    placeholder="0"
                  />
                </div>
                <div className="mt-2 flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-500">Liability: <span className="text-slate-900 font-bold">Rs {stats.cashLiability.toLocaleString()}</span></span>
                  <button onClick={() => setDepositAmount(stats.cashLiability.toString())} className="text-emerald-600 font-bold hover:underline">Max</button>
                </div>
              </div>

              {/* Asset Return Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-3 flex justify-between items-center">
                  <span>Select Assets to Return</span>
                  {loadingAssets && <RefreshCw size={12} className="animate-spin text-emerald-500" />}
                </label>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {driverAssets.length > 0 ? (
                    driverAssets.map((asset) => (
                      <label key={asset.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedHandoverAssets.includes(asset.serial_number) ? 'bg-white border-emerald-500 shadow-sm' : 'border-transparent hover:bg-white/50'}`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedHandoverAssets.includes(asset.serial_number) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                          {selectedHandoverAssets.includes(asset.serial_number) && <Check size={14} strokeWidth={3} />}
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={selectedHandoverAssets.includes(asset.serial_number)}
                          onChange={() => toggleHandoverAsset(asset.serial_number)}
                        />
                        <div>
                          <p className="font-bold text-slate-700 text-sm">📦 {asset.serial_number}</p>
                          <p className="text-[10px] uppercase font-bold text-slate-400">{asset.status.toUpperCase()}</p>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-slate-400 font-medium">Truck is empty.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className="p-4 bg-white border-t border-slate-100">
              <button
                onClick={handleHandoverSubmit}
                disabled={submitting}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-lg shadow-xl active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <RefreshCw className="animate-spin" /> : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
