import { getAdminStats } from "@/app/actions/adminActions";
import { getSettings } from "@/app/actions/settingsActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cylinder, Users, AlertTriangle, Activity } from "lucide-react";

export default async function AdminDashboardPage() {
    const stats = await getAdminStats();
    const { settings } = await getSettings();
    const lowStockLimit = settings?.low_stock_threshold || 15;
    const isLowStock = stats.totalCylinders < lowStockLimit;

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                <p className="text-muted-foreground">Overview of your distribution operations.</p>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Warehouse Stock */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className={`text-sm font-medium uppercase ${isLowStock ? 'text-red-600' : 'text-muted-foreground'}`}>Warehouse Stock</CardTitle>
                        <Cylinder className={`h-4 w-4 ${isLowStock ? 'text-red-600' : 'text-primary'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${isLowStock ? 'text-red-600' : ''}`}>{stats.totalCylinders}</div>
                        <p className={`text-xs ${isLowStock ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                            {isLowStock ? `⚠️ Low Stock (<${lowStockLimit})` : 'Available in Warehouse'}
                        </p>
                    </CardContent>
                </Card>

                {/* Distributed / Active Assets */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Distributed</CardTitle>
                        <Activity className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        {/* Use distributedStock if available, otherwise fallback to 0 */}
                        <div className="text-2xl font-bold">{stats.distributedStock}</div>
                        <p className="text-xs text-muted-foreground">With Customers & Drivers</p>
                    </CardContent>
                </Card>

                {/* Empty / Low Stock */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Refill Needed</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.emptyCylinders}</div>
                        <p className="text-xs text-muted-foreground">Empty Cylinders</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity */}
            <Card className="col-span-1 border-t-4 border-t-blue-500">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-500" />
                        Live Activity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {(!stats.recentActivity || stats.recentActivity.length === 0) ? (
                            <div className="text-center py-6 text-muted-foreground text-sm">No recent activity</div>
                        ) : (
                            stats.recentActivity.map((activity: any) => (
                                <div key={activity.id} className="flex justify-between items-start border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                                    <div>
                                        <p className="font-bold text-sm text-slate-800">
                                            {activity.customers?.name || 'Guest'}
                                        </p>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            Order #{activity.friendly_id || activity.id.slice(0, 5)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${activity.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                                            activity.status === 'on_trip' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {activity.status === 'on_trip' ? 'On Way' : activity.status}
                                        </span>
                                        <p className="text-xs font-bold text-slate-900 mt-1">Rs {activity.total_amount}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
