'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, RefreshCcw, Store, Truck, Package } from 'lucide-react';
import { clsx } from 'clsx';

export function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        { label: 'Home', href: '/', icon: LayoutDashboard }, // Admin is treated as Home/CEO View
        { label: 'Dispatch', href: '/orders/new', icon: Package },
        { label: 'Recover', href: '/recovery', icon: RefreshCcw },
        { label: 'Shop', href: '/shop', icon: Store },
        { label: 'Driver', href: '/driver', icon: Truck },
    ];

    if (pathname === '/login') return null;

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 pb-safe z-50 flex justify-around items-center shadow-upper">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={clsx(
                            "flex flex-col items-center justify-center p-2 rounded-xl transition-colors min-w-[4rem]",
                            isActive ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <Icon size={24} className={clsx("mb-1", isActive && "fill-current text-blue-600")} strokeWidth={isActive ? 2.5 : 2} />
                        <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
