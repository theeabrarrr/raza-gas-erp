import React from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface IconBtnProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  color?: 'green' | 'red' | 'blue' | 'slate';
  className?: string; // Allow extra styling if needed
}

export function IconBtn({ icon: Icon, label, onClick, color = 'blue', className }: IconBtnProps) {
  const colorStyles = {
    green: 'bg-green-600 hover:bg-green-700 text-white border-green-800',
    red: 'bg-red-600 hover:bg-red-700 text-white border-red-800',
    blue: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-800',
    slate: 'bg-slate-700 hover:bg-slate-800 text-white border-slate-900',
  };

  return (
    <button
      onClick={onClick}
      className={twMerge(
        'flex flex-col items-center justify-center p-6 rounded-2xl shadow-lg active:scale-95 transition-transform duration-100 border-b-4 h-48 w-full',
        colorStyles[color],
        className
      )}
    >
      <Icon size={64} className="mb-4" />
      <span className="text-2xl font-bold text-center leading-tight">{label}</span>
    </button>
  );
}
