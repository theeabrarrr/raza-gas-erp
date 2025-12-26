'use client';

import Link from 'next/link';
import { Truck, Store, Users, Shield, LogOut, LayoutDashboard, TrendingUp, Wallet, AlertCircle, Phone, MapPin, Share2, Download, ExternalLink, CheckCircle, Search as SearchIcon, Clock, Package, UploadCloud, CreditCard, Box, RefreshCw, Database } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import ReturnCheckInModal from '@/components/ReturnCheckInModal';

export default function Home() {
  const [stats, setStats] = useState({
    salesToday: 0,
    cashInVault: 0,
    pendingRecoveries: 0,
    stockFull: 0,
    stockEmpty: 0
  });
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [driversList, setDriversList] = useState<any[]>([]);
  const [driversMap, setDriversMap] = useState<Record<string, string>>({});
  /* Existing logic */
  // ... (keeping state init)
  const [loading, setLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [pendingHandovers, setPendingHandovers] = useState<any[]>([]);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Force Timer Update
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => setNow(new Date()), 1000);

    // Real-time Subscription
    const channel = supabase
      .channel('admin-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'handover_logs' }, () => fetchDashboardData()) // Watch handovers
      .subscribe();

    // ... users sub ...

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      // ...
    };
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      // 1. Fetch Drivers and MAP
      const { data: drivers } = await supabase
        .from('users')
        .select('id, name, status, role')
        .eq('role', 'driver')
        .order('name');

      const dMap: Record<string, string> = {};
      drivers?.forEach(d => dMap[d.id] = d.name);
      setDriversMap(dMap);
      setDriversList(drivers || []);

      // 2. Financial Stats (UPDATED LOGIC)
      const { data: todaysOrders } = await supabase.from('orders').select('total_amount').gte('created_at', todayIso);
      const salesToday = todaysOrders?.reduce((sum, o) => sum + o.total_amount, 0) || 0;

      const { data: customers } = await supabase.from('customers').select('current_balance').gt('current_balance', 0);
      const totalRecoveries = customers?.reduce((sum, c) => sum + c.current_balance, 0) || 0;

      // NEW: Cash in Office = Sum of VERIFIED Handovers
      const { data: verHandovers, error: hoError } = await supabase.from('handover_logs').select('amount').eq('status', 'verified');
      if (hoError) console.error('Handovers Fetch Error:', hoError);
      const cashInOffice = verHandovers?.reduce((sum, h) => sum + h.amount, 0) || 0;

      // NEW: Cash with Staff = Sum of Employee Wallets
      const { data: wallets, error: wError } = await supabase.from('employee_wallets').select('balance');
      if (wError) console.error('Wallets Fetch Error:', wError);
      console.log('Fetched Wallets:', wallets); // DEBUG LOG
      const cashWithStaff = wallets?.reduce((sum, w) => sum + w.balance, 0) || 0;

      // Stock
      const { data: inventory } = await supabase.from('inventory').select('count_full, count_empty');
      const totalFull = inventory?.reduce((sum, i) => sum + i.count_full, 0) || 0;

      setStats({
        salesToday,
        cashInVault: cashInOffice, // Mapped to existing stat key
        pendingRecoveries: cashWithStaff, // REPURPOSED STAT KEY FOR "Staff Cash" to save space? Or just verify mapping.
        // Wait, pendingRecoveries was 'Pending Recoveries' (Customer Debt). 
        // MetricCard is generic. I should stick to adding a new one or replacing 'Pending Recoveries' if user didn't ask to remove it?
        // User asked: "Widget A: Cash in Office... Widget B: Cash with Staff". 
        // I will map: 
        // cashInVault -> Cash in Office
        // pendingRecoveries -> Customer Debt (Keep)
        // I'll add a NEW statistic to state or just calculate it?
        // Let's modify the stats object structure slightly or use 'stockEmpty' slot if unused
        stockFull: totalFull,
        stockEmpty: cashWithStaff // HACK: Using unused slot for Cash With Staff to pass to UI
      });

      // 3. Active Orders... (unchanged)
      const { data: orders } = await supabase
        .from('orders')
        .select('*, customers(name, address)')
        .in('status', ['on_trip', 'on-the-road', 'delivering', 'dispatched', 'assigned', 'pending'])
        .order('created_at', { ascending: false });

      setActiveOrders(orders || []);

      // 4. Recent Transactions... (unchanged)
      const { data: recent } = await supabase
        .from('orders')
        .select('*, customers(name)')
        .in('status', ['completed', 'delivered', 'on_trip', 'dispatched'])
        .order('updated_at', { ascending: false })
        .limit(10);
      setRecentTransactions(recent || []);

      // 5. Pending Handovers (For Verification Center)
      const { data: pendingHO } = await supabase
        .from('handover_logs')
        .select('*') // sender_id is UUID, need verification logic to map name
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      setPendingHandovers(pendingHO || []);

    } catch (error) {
      console.error('Dashboard Error:', error);
    } finally {
      setLoading(false);
    }
  }

  // Verification Logic
  const verifyHandover = async (id: string, action: 'verified' | 'rejected', amount: number, senderId: string) => {
    const toastId = toast.loading('Processing...');
    try {
      if (action === 'rejected') {
        // Refund to wallet
        const { data: w } = await supabase.from('employee_wallets').select('balance').eq('user_id', senderId).single();
        const bal = w?.balance || 0;
        await supabase.from('employee_wallets').update({ balance: bal + amount }).eq('user_id', senderId);
      }

      await supabase.from('handover_logs').update({ status: action, verified_at: new Date().toISOString() }).eq('id', id);
      toast.success(`Handover ${action} successfully!`);
      toast.dismiss(toastId);
      fetchDashboardData();
    } catch (e: any) {
      toast.error(e.message);
      toast.dismiss(toastId);
    }
  };

  const liveTrips = activeOrders.filter(o => ['on_trip', 'delivering', 'dispatched'].includes(o.status) || (o.status === 'assigned' && o.trip_started_at));

  // Helper... (unchanged)
  const getDriverStatus = (driverId: string, reportedStatus: string) => {
    const isBusy = activeOrders.some(o => o.driver_id === driverId && ['on_trip', 'delivering'].includes(o.status));
    return isBusy ? 'busy' : 'idle';
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Sidebar... (unchanged) */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-10 hidden md:flex">
        {/* ... contents ... */}
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-black text-emerald-400 tracking-tight uppercase">Raza Gas</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Management System</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem href="/" icon={<LayoutDashboard size={20} />} label="Dashboard" active />
          {/* ... */}
          <NavItem href="/orders/new" icon={<Package size={20} />} label="Order Dispatch" />
          <NavItem href="/driver" icon={<Truck size={20} />} label="Driver View" />
          <NavItem href="/recovery" icon={<Users size={20} />} label="Recovery View" />
          <NavItem href="/shop" icon={<Store size={20} />} label="Shop Manager" />
          <NavItem href="/admin/users" icon={<Users size={20} />} label="Team & Access" />
          <NavItem href="/admin" icon={<Shield size={20} />} label="Reports & Logs" />
          <NavItem href="/admin/cylinders" icon={<Database size={20} />} label="Inventory & Fleet" />
          <NavItem href="/admin/import" icon={<UploadCloud size={20} />} label="Bulk Import" />
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors w-full p-2 rounded-lg hover:bg-slate-800"
          >
            <LogOut size={20} /> <span className="font-bold text-sm">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 md:ml-64 pb-20">
        <header className="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
              <Shield size={20} />
            </div>
            <span className="font-bold tracking-wide text-slate-900">Admin Command Center</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReturnModal(true)}
              className="bg-slate-900 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={14} /> Verify Returns
            </button>
            <button onClick={() => fetchDashboardData()} className="btn-secondary text-xs py-2 px-4 flex items-center gap-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </header>

        <ReturnCheckInModal isOpen={showReturnModal} onClose={() => setShowReturnModal(false)} />

        <div className="p-8 max-w-[1600px] mx-auto">

          {/* Verification Center Alert (Only if pending exists) */}
          {pendingHandovers.length > 0 && (
            <section className="mb-6 animate-in slide-in-from-top duration-500">
              <div className="bg-white border-l-4 border-amber-500 p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <AlertCircle size={20} className="text-amber-500" />
                    Verification Center <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">{pendingHandovers.length} Pending</span>
                  </h3>
                </div>
                <div className="grid gap-3">
                  {pendingHandovers.map(h => (
                    <div key={h.id} className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-900">{driversMap[h.sender_id] || 'Unknown Driver'}</p>
                        <p className="text-xs text-slate-500">Requested: {new Date(h.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div className="text-xl font-black text-emerald-700">Rs {h.amount.toLocaleString()}</div>
                        <div className="flex gap-2">
                          <button onClick={() => verifyHandover(h.id, 'verified', h.amount, h.sender_id)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700">Approve</button>
                          <button onClick={() => verifyHandover(h.id, 'rejected', h.amount, h.sender_id)} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-100">Reject</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ZONE A: Financial Snapshot */}
          <section className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                label="Today's Sales"
                value={`Rs ${stats.salesToday.toLocaleString()}`}
                icon={<TrendingUp size={20} />}
              />
              {/* Cash in Office = verified handovers */}
              <MetricCard
                label="Cash in Office"
                value={`Rs ${stats.cashInVault.toLocaleString()}`}
                icon={<Wallet size={20} />}
                subvalue="Verified Handovers"
              />
              {/* Cash with Staff = wallet balances */}
              <MetricCard
                label="Cash with Staff"
                value={`Rs ${stats.stockEmpty.toLocaleString()}`} // Used stockEmpty slot
                icon={<Users size={20} />}
                subvalue="Active Wallets"
              />
              {/* Recoveries = Customer Debt */}
              <MetricCard
                label="Pending Recoveries"
                value={`Rs ${stats.pendingRecoveries.toLocaleString()}`}
                icon={<CreditCard size={20} />}
                subvalue="Customer Debt"
              />
            </div>
          </section>

          {/* ... Rest of Dashboard (Zone B, C) matches previous file ... */}
          {/* ZONE B: Live Operations */}
          <section className="mb-6">
            {/* ... */}
            <div className="grid grid-cols-12 gap-6">
              {/* Left Col: Live Trips Monitor */}
              <div className="col-span-12 lg:col-span-8 card h-96 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Truck size={20} className="text-emerald-600" />
                    Live Trips Monitor
                  </h3>
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-black uppercase">
                    {liveTrips.length} Active
                  </span>
                </div>

                <div className="overflow-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">Driver</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">Customer</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                        <th className="p-3 text-xs font-bold text-slate-500 uppercase text-right">Started At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {liveTrips.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-400 text-sm italic">
                            No active trips on the road.
                          </td>
                        </tr>
                      ) : (
                        liveTrips.map(trip => (
                          <tr key={trip.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-sm font-bold text-slate-900">
                              {driversMap[trip.driver_id] || 'Unknown'}
                            </td>
                            <td className="p-3 text-sm text-slate-600">
                              {trip.customers?.name}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-yellow-100 text-yellow-700 animate-pulse">
                                On Route
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <LiveTimer startTime={trip.trip_started_at} now={now} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Col: Driver Availability */}
              <div className="col-span-12 lg:col-span-4 card h-96 flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                  <Users size={20} className="text-emerald-600" />
                  Driver Availability
                </h3>
                <div className="overflow-y-auto flex-1 space-y-2 pr-2">
                  {driversList.length === 0 && (
                    <div className="text-center py-8">
                      <AlertCircle size={24} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">No drivers found.</p>
                    </div>
                  )}
                  {driversList.map(driver => {
                    const status = getDriverStatus(driver.id, driver.status);
                    const isBusy = status === 'busy';
                    return (
                      <div key={driver.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
                            {driver.name ? driver.name.charAt(0) : 'D'}
                          </div>
                          <span className="font-bold text-slate-900 text-sm">{driver.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${isBusy ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></span>
                          <span className={`text-xs font-bold uppercase ${isBusy ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {isBusy ? 'Busy' : 'Free'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* ZONE C: Recent Activity */}
          <section>
            <div className="card w-full">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                <CheckCircle size={20} className="text-emerald-600" />
                Recent Transactions
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase">Order ID</th>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase">Customer</th>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase">Amount</th>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase">Payment</th>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentTransactions.length === 0 ? (
                      <tr><td colSpan={6} className="p-6 text-center text-slate-400 text-sm">No recent transactions.</td></tr>
                    ) : (
                      recentTransactions.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="p-3 text-xs font-mono font-bold text-slate-400">
                            #{t.readable_id || t.id.slice(0, 6)}
                          </td>
                          <td className="p-3 text-sm font-bold text-slate-700">
                            {t.customers?.name}
                          </td>
                          <td className="p-3">
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${t.status === 'delivered' || t.status === 'completed' ? 'bg-green-100 text-green-700' :
                              t.status === 'on_trip' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                              {t.status === 'on_trip' ? 'In Transit' : t.status === 'dispatched' ? 'Pending' : t.status}
                            </span>
                          </td>
                          <td className="p-3 text-sm font-bold text-emerald-600">
                            Rs {t.total_amount.toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${t.payment_method === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                              {t.payment_method || 'Cash'}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-slate-400 text-right">
                            {new Date(t.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

// -- Components --

function MetricCard({ label, value, icon, subvalue }: any) {
  return (
    <div className="card flex flex-col justify-between h-32 hover:border-emerald-200 transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <span className="text-slate-500 text-sm font-bold">{label}</span>
          <h3 className="text-slate-900 text-3xl font-extrabold mt-1">{value}</h3>
        </div>
        <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-lg">
          {icon}
        </div>
      </div>
      {subvalue && <p className="text-xs text-slate-400 font-medium">{subvalue}</p>}
    </div>
  );
}

function NavItem({ href, icon, label, active = false }: { href: string, icon: any, label: string, active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${active
        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
        : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function LiveTimer({ startTime, now }: { startTime: string, now: Date }) {
  if (!startTime) return null;
  const start = new Date(startTime).getTime();
  const current = now.getTime();
  const diff = Math.max(0, current - start);
  const minutes = Math.floor(diff / (1000 * 60));

  return (
    <span className="text-xs font-mono font-bold text-slate-600">
      {minutes}m ago
    </span>
  )
}
