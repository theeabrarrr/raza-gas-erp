import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { clsx } from 'clsx';
import { BottomNav } from '@/components/BottomNav';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Raza Gas ERP',
  description: 'Gas Cylinder Distribution Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={clsx(inter.className, 'bg-slate-50 text-slate-900')}>
        <main className="min-h-screen pb-32 md:pb-36"> {/* Increased padding for safe bottom nav spacing */}
          {children}
        </main>
        <BottomNav />
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
