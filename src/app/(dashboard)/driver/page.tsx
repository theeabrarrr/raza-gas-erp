'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User, Bell, Wallet, Truck, Package, Receipt, LogOut,
  RefreshCw, ChevronRight, MapPin, Check, X, Info, Home
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getDriverStats, getDriverAllAssets, getReceivers } from '@/app/actions/driverActions';

export default function DriverDashboard() {
  const router = useRouter();

  // -- STATE --
  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState('Driver');
  const [isOnline, setIsOnline] = useState(false);

  // Stats
  const [stats, setStats] = useState({ cashLiability: 0, emptiesOnHand: 0, fullOnHand: 0 });

  // Modals
  const [showStockModal, setShowStockModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);

  // Handover Form
  const [receivers, setReceivers] = useState<any[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState('');
  const [driverAssets, setDriverAssets] = useState<any[]>([]);
  const [selectedHandoverAssets, setSelectedHandoverAssets] = useState<string[]>([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [submittingHandover, setSubmittingHandover] = useState(false);

  // -- LOAD DATA --
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    // 1. User Info
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setDriverName(user.user_metadata?.name || 'Driver');

      // Fetch Real Name & Status
      const { data: profile } = await supabase
        .from('users')
        .select('name, status') // Assuming 'name' column exists in 'users' table (which is our profiles)
        .eq('id', user.id)
        .single();

      if (profile?.name) setDriverName(profile.name);
      setIsOnline(profile?.status === 'active' || profile?.status === 'online');
    }

    // 2. Stats
    const hudStats = await getDriverStats();
    // getDriverStats currently returns { cashLiability, emptiesOnHand }. 
    // We might need to fetch 'fullOnHand' separately or update getDriverStats.
    // For now, let's assume we can fetch inventory count 
    const { data: inventory } = await supabase
      .from('cylinders')
      .select('status')
      .eq('current_holder_id', user?.id)
      .eq('current_location_type', 'driver');

    const fullCount = inventory?.filter(c => c.status === 'full').length || 0;
    const emptyCount = inventory?.filter(c => c.status === 'empty').length || 0;

    setStats({
      cashLiability: hudStats.cashLiability,
      emptiesOnHand: emptyCount,
      fullOnHand: fullCount
    });

    setLoading(false);
  };

  // -- HANDLERS --

  const toggleStatus = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update DB
    await supabase.from('users').update({
      status: newStatus ? 'active' : 'inactive'
    }).eq('id', user.id);

    toast.success(newStatus ? "You are now ONLINE" : "You are now OFFLINE");
  };

  const openHandover = async () => {
    setShowHandoverModal(true);
    // Load Handover Data
    const [assets, recs] = await Promise.all([
      getDriverAllAssets(),
      getReceivers()
    ]);
    setDriverAssets(assets);
    setReceivers(recs);
    if (recs.length > 0) setSelectedReceiver(recs[0].id);
    setDepositAmount(stats.cashLiability.toString()); // Default Max
  };

  const submitHandover = async () => {
    if (!selectedReceiver) {
      toast.error("Please select a receiver (Admin/Manager).");
      return;
    }

    const deposit = parseFloat(depositAmount);
    if (deposit > stats.cashLiability) {
      toast.error(`Insufficient Wallet Balance. Max: ${stats.cashLiability}`);
      return;
    }

    setSubmittingHandover(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      // RPC CALL
      const { data, error } = await supabase.rpc('submit_driver_handover', {
        p_driver_id: user.id,
        p_receiver_id: selectedReceiver,
        p_cash_amount: deposit,
        p_cylinders: selectedHandoverAssets // Array of Serial Numbers
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.message || "Handover failed");

      toast.success("Handover Request Sent!", {
        description: "Admin approval required."
      });
      setShowHandoverModal(false);
      loadDashboardData(); // Refresh Stats

    } catch (err: any) {
      console.error("RPC Error:", err);
      toast.error(err.message || "Failed to submit handover.");
    } finally {
      setSubmittingHandover(false);
    }
  };

  // Helper to toggle assets in modal
  const toggleAsset = (serial: string) => {
    if (selectedHandoverAssets.includes(serial)) {
      setSelectedHandoverAssets(selectedHandoverAssets.filter(s => s !== serial));
    } else {
      setSelectedHandoverAssets([...selectedHandoverAssets, serial]);
    }
  };

  // -- RENDER --

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 text-slate-900">

      {/* A. HEADER */}
      <header className="bg-white sticky top-0 z-30 px-6 py-4 shadow-sm border-b border-slate-100 flex justify-between items-center">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Salam,</p>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">{driverName}!</h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Status Toggle */}
          <button
            onClick={toggleStatus}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isOnline ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500' : 'bg-slate-100 text-slate-500'}`}
          >
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </button>
          {/* Notification Bell */}
          <div className="relative">
            <Bell size={24} className="text-slate-600" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">

        {/* B. HERO CARD (WALLET) */}
        {/* B. HERO CARD (WALLET) */}
        <div className="relative overflow-hidden rounded-2xl p-6 shadow-md bg-white border border-slate-100">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Cash in Hand</p>
              {stats.cashLiability >= 10000 ? (
                <div className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-wide border border-rose-100">
                  Deposit Needed
                </div>
              ) : (
                <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wide border border-emerald-100">
                  Limit Safe
                </div>
              )}
            </div>

            <h2 className={`text-4xl font-black mb-4 tracking-tight ${stats.cashLiability >= 10000 ? 'text-rose-600' : 'text-emerald-600'}`}>
              <span className="text-2xl font-bold opacity-60 mr-1 text-slate-400">Rs.</span>
              {stats.cashLiability.toLocaleString()}
            </h2>

            <div className="flex items-center justify-end">
              <Link href="/driver/history" className="flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
                View History <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        {/* C. ACTION GRID */}
        <div className="grid grid-cols-2 gap-4">

          {/* 1. My Stock */}
          <button
            onClick={() => setShowStockModal(true)}
            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-start gap-3 active:scale-[98%] transition-transform"
          >
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Package size={22} />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-slate-800">My Stock</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{stats.fullOnHand + stats.emptiesOnHand} Cylinders</p>
            </div>
          </button>

          {/* 2. New Orders */}
          <Link
            href="/driver/orders"
            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-start gap-3 active:scale-[98%] transition-transform"
          >
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Truck size={22} />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-slate-800">New Orders</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Start Delivery</p>
            </div>
          </Link>

          {/* 3. Add Expense */}
          <Link
            href="/driver/expenses"
            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-start gap-3 active:scale-[98%] transition-transform"
          >
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Receipt size={22} />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-slate-800">Add Expense</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Fuel, Food...</p>
            </div>
          </Link>

          {/* 4. End Shift */}
          {/* 4. End Shift */}
          <button
            onClick={openHandover}
            className="bg-white p-5 rounded-2xl shadow-sm border-2 border-rose-100 flex flex-col items-start gap-3 active:scale-[98%] transition-transform"
          >
            <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <LogOut size={22} />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-slate-800">End Shift</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Handover</p>
            </div>
          </button>
        </div>

        {/* Promo/Status Card (Optional) */}


      </main>

      {/* D. BOTTOM NAVIGATION (Sticky) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center p-2 pb-5 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <Link href="/driver" className="flex flex-col items-center gap-1 p-2 text-emerald-600">
          <div className="bg-emerald-50 px-5 py-1.5 rounded-full">
            <Home size={24} fill="currentColor" />
          </div>
          <span className="text-[10px] font-bold">Home</span>
        </Link>
        <Link href="/driver/history" className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-slate-600 transition-colors">
          <Receipt size={24} />
          <span className="text-[10px] font-medium">History</span>
        </Link>
        <Link href="/driver/profile" className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-slate-600 transition-colors">
          <User size={24} />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </div>


      {/* -- MODALS -- */}

      {/* 1. STOCK MODAL */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative shadow-2xl">
            <button onClick={() => setShowStockModal(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
              <X size={20} />
            </button>

            <h3 className="text-xl font-black text-slate-900 mb-6">Current Inventory</h3>

            <div className="space-y-4">
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center font-bold">F</div>
                  <div>
                    <h4 className="font-bold text-slate-800">Full Cylinders</h4>
                    <p className="text-xs text-emerald-600 font-bold uppercase">Ready to Sell</p>
                  </div>
                </div>
                <span className="text-3xl font-black text-slate-900">{stats.fullOnHand}</span>
              </div>

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center font-bold">E</div>
                  <div>
                    <h4 className="font-bold text-slate-800">Empty Cylinders</h4>
                    <p className="text-xs text-amber-600 font-bold uppercase">To Return</p>
                  </div>
                </div>
                <span className="text-3xl font-black text-slate-900">{stats.emptiesOnHand}</span>
              </div>
            </div>

            <button onClick={() => setShowStockModal(false)} className="w-full mt-6 py-3 bg-slate-900 text-white font-bold rounded-xl">
              Close
            </button>
          </div>
        </div>
      )}

      {/* 2. HANDOVER MODAL */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl relative shadow-2xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl">
              <div>
                <h3 className="text-xl font-black text-slate-900">End Shift Handover</h3>
                <p className="text-xs text-slate-500 font-medium">Return Cash & Assets to Admin</p>
              </div>
              <button onClick={() => setShowHandoverModal(false)} className="p-2 bg-white border border-slate-200 rounded-full text-slate-500 hover:bg-slate-50">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Recevier */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Handover To</label>
                <select
                  value={selectedReceiver}
                  onChange={(e) => setSelectedReceiver(e.target.value)}
                  className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {receivers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.role})</option>)}
                </select>
              </div>

              {/* Cash */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Cash Deposit</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 font-bold text-slate-400">Rs.</span>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full h-12 pl-12 bg-white border border-slate-200 rounded-xl font-black text-xl text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-slate-500">Wallet Balance:</span>
                  <span className="font-bold text-slate-900">Rs {stats.cashLiability.toLocaleString()}</span>
                </div>
              </div>

              {/* Assets */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Select Assets to Return</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {driverAssets.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-4 italic">No assets on truck.</p>
                  ) : (
                    driverAssets.map(asset => (
                      <button
                        key={asset.id}
                        onClick={() => toggleAsset(asset.serial_number)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${selectedHandoverAssets.includes(asset.serial_number) ? 'bg-white border-emerald-500 shadow-sm ring-1 ring-emerald-500' : 'bg-white border-slate-200 opacity-80'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedHandoverAssets.includes(asset.serial_number) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                            {selectedHandoverAssets.includes(asset.serial_number) && <Check size={14} />}
                          </div>
                          <div className="text-left">
                            <span className="block text-sm font-bold text-slate-800">{asset.serial_number}</span>
                            <span className="block text-[10px] uppercase font-bold text-slate-400">{asset.status}</span>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 bg-white border-t border-slate-100 rounded-b-3xl">
              <button
                onClick={submitHandover}
                disabled={submittingHandover}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingHandover ? <RefreshCw className="animate-spin" /> : 'Confirm Handover'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
