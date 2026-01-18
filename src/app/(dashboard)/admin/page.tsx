import { getDashboardStats } from "@/app/actions/adminActions";
import { getSettings } from "@/app/actions/settingsActions";
import { DashboardChart } from "@/components/admin/DashboardChart";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    Truck,
    Database,
    DollarSign,
    Plus,
    ArrowUpRight,
    Briefcase
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default async function AdminDashboardPage() {
    const stats = await getDashboardStats();

    // Safety check for stats (in case of error return)
    const {
        totalCash = 0,
        activeDrivers = 0,
        totalAssets = 0,
        emptyCylinders = 0,
        chartData = [],
        recentActivity = []
    } = stats;

    const currentDate = format(new Date(), "EEEE, MMMM d, yyyy");

    return (
        <div className="space-y-8 p-8 min-h-screen bg-slate-50/50 pb-20">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                    <p className="text-slate-500 font-medium mt-1">{currentDate}</p>
                </div>
            </header>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Cash */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Cash</p>
                        <div className="text-2xl font-black text-emerald-600">
                            Rs {totalCash.toLocaleString()}
                        </div>
                    </div>
                    <div className="h-10 w-10 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
                        <DollarSign className="text-emerald-600 h-5 w-5" />
                    </div>
                </div>

                {/* Active Drivers */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Drivers</p>
                        <div className="text-2xl font-bold text-slate-900">
                            {activeDrivers}
                        </div>
                    </div>
                    <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center border border-blue-100">
                        <Truck className="text-blue-600 h-5 w-5" />
                    </div>
                </div>

                {/* Stock Alert (Empty) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Empty Cylinders</p>
                        <div className={`text-2xl font-bold ${emptyCylinders > 5 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {emptyCylinders}
                        </div>
                        {emptyCylinders > 5 && <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">Refill Needed</span>}
                    </div>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center border ${emptyCylinders > 5 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                        <Database className={`${emptyCylinders > 5 ? 'text-rose-600' : 'text-slate-400'} h-5 w-5`} />
                    </div>
                </div>

                {/* Total Assets */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Assets</p>
                        <div className="text-2xl font-bold text-slate-900">
                            {totalAssets}
                        </div>
                    </div>
                    <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                        <Briefcase className="text-slate-600 h-5 w-5" />
                    </div>
                </div>
            </div>

            {/* Middle Section: Chart and Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Weekly Orders</h3>
                            <p className="text-sm text-slate-500">Order volume over the last 7 days</p>
                        </div>
                    </div>
                    <DashboardChart data={chartData} />
                </div>

                {/* Quick Actions */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Quick Actions</h3>
                    <div className="space-y-3 flex-1">
                        <Link href="/admin/finance" className="flex items-center justify-between w-full p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-xl transition-colors group">
                            <span className="font-semibold text-emerald-800">New Finance Entry</span>
                            <ArrowUpRight className="h-5 w-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                        </Link>

                        <Link href="/admin/inventory" className="flex items-center justify-between w-full p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl transition-colors group">
                            <span className="font-semibold text-slate-700">Add Stock</span>
                            <Plus className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </Link>

                        <Link href="/admin/users" className="flex items-center justify-between w-full p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl transition-colors group">
                            <span className="font-semibold text-slate-700">Add Staff</span>
                            <Users className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Recent Activity Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
                        <p className="text-sm text-slate-500">Latest orders and transactions</p>
                    </div>
                    <Link href="/admin/history" className="text-sm font-bold text-emerald-600 hover:text-emerald-700 hover:underline">
                        View All
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                            <tr>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Order ID</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {recentActivity.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                                        No recent activity found.
                                    </td>
                                </tr>
                            ) : (
                                recentActivity.map((activity: any) => (
                                    <tr key={activity.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">
                                            {activity.customers?.name || 'Guest'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                            #{activity.friendly_id || activity.id.slice(0, 8)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className={`
                                                ${activity.status === 'completed' || activity.status === 'delivered' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                    activity.status === 'pending' || activity.status === 'on_trip' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                        'bg-slate-100 text-slate-600 border-slate-200'} shadow-none
                                            `}>
                                                {activity.status === 'on_trip' ? 'On Way' : activity.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            {new Date(activity.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                                            Rs {activity.total_amount?.toLocaleString() || 0}
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
