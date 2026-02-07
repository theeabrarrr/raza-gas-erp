"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Cylinder, Users, Settings, Briefcase, ShoppingCart, Database, CheckSquare, ClipboardList, Landmark, FileText, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import LogoutBtn from "@/components/LogoutBtn";

// ...

const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
    { href: '/admin/cylinders', label: 'Inventory', icon: Database },
    { href: "/admin/approvals", label: "Approvals", icon: CheckSquare },
    { href: "/admin/finance", label: "Finance", icon: Landmark },
    { href: "/admin/expenses", label: "Expenses", icon: ClipboardList },
    { href: "/admin/finance/reports", label: "Reports", icon: FileText },
    { href: "/admin/finance/handovers", label: "Cash Handovers", icon: Banknote },
    { href: "/admin/customers", label: "Customer CRM", icon: Users },
    { href: "/admin/users", label: "Staff", icon: Briefcase },
    { href: "/admin/settings", label: "Settings", icon: Settings },
];

import { useState, useEffect } from "react";
import { getTenantInfo } from "@/app/actions/adminActions";

export function AdminSidebar() {
    const pathname = usePathname();
    const [tenantName, setTenantName] = useState<string>("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getTenantInfo().then(info => {
            setTenantName(info.name || "LPG Manager");
            setLoading(false);
        });
    }, []);

    return (
        <aside className="hidden md:flex flex-col w-64 border-r border-border bg-white h-screen sticky top-0">
            <div className="p-6 border-b border-border">
                <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
                    <span className="bg-primary/10 p-1.5 rounded-lg">
                        <Cylinder className="w-5 h-5 text-primary" />
                    </span>
                    {loading ? (
                        <>
                            <span className="sr-only">Loading tenant name...</span>
                            <span aria-hidden="true" className="h-6 w-24 bg-slate-100 animate-pulse rounded block" />
                        </>
                    ) : (
                        tenantName
                    )}
                </h1>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-border">
                {/* We are reusing the LogoutBtn but we might need to style it to fit the sidebar look if needed. 
              Currently LogoutBtn renders a button. We can wrap it or just place it. */}
                <div className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground">
                    <LogoutBtn />
                </div>
            </div>
        </aside>
    );
}
