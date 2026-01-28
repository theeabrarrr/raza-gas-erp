'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, RefreshCcw, Store, Truck, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-2 pb-safe z-50 flex justify-around items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex flex-col items-center justify-center p-2 rounded-xl transition-colors min-w-[4rem]",
                            isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Icon size={24} className={cn("mb-1", isActive && "fill-current text-primary")} strokeWidth={isActive ? 2.5 : 2} />
                        <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
