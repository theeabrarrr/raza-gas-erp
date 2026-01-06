'use client';

import { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { createCustomer } from '@/app/actions/customerActions';
import { toast } from 'sonner';

interface AddCustomerModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddCustomerModal({ onClose, onSuccess }: AddCustomerModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        try {
            const result = await createCustomer(null, formData);
            if (result?.error) {
                toast.error(result.error);
            } else {
                toast.success("Customer account created successfully!");
                onSuccess();
                onClose();
            }
        } catch (err) {
            toast.error("Failed to create customer");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Add New Customer</h2>
                        <p className="text-sm text-slate-500 font-medium">Create a new client account and ledger</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
                        {/* Column 1: Identity */}
                        <div className="space-y-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Identity</h3>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="name"
                                    required
                                    type="text"
                                    className="w-full rounded-md border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none border transition-all"
                                    placeholder="e.g. Karachi Broast"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Phone Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="phone"
                                    required
                                    type="tel"
                                    pattern="^03[0-9]{9}$"
                                    title="Format: 03001234567"
                                    className="w-full rounded-md border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none border transition-all"
                                    placeholder="03001234567"
                                />
                                <p className="text-xs text-slate-400 mt-1">Format: 03001234567 (11 digits)</p>
                            </div>
                        </div>

                        {/* Column 2: Location */}
                        <div className="space-y-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Location</h3>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Area / City
                                </label>
                                <input
                                    name="city"
                                    type="text"
                                    className="w-full rounded-md border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none border transition-all"
                                    placeholder="e.g. Gulshan-e-Iqbal, Karachi"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Full Address
                                </label>
                                <textarea
                                    name="address"
                                    rows={3}
                                    className="w-full rounded-md border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none border transition-all resize-none"
                                    placeholder="Street, Plot No, Landmark..."
                                />
                            </div>
                        </div>

                        {/* Full Width: Financials */}
                        <div className="md:col-span-2 space-y-6 pt-2">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                                Financial Overview <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full">Ledger Init</span>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                                        Opening Balance (Rs)
                                        <div className="group relative">
                                            <AlertCircle size={14} className="text-slate-400 cursor-help" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                Amount they owe us from the past. Enter negative for Advance.
                                            </div>
                                        </div>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">Rs</span>
                                        <input
                                            name="opening_balance"
                                            type="number"
                                            step="0.01"
                                            className="w-full rounded-md border-slate-300 pl-10 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none border transition-all font-mono font-bold text-slate-700"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Security Deposit (Rs) <span className="text-xs font-normal text-slate-400">(Optional)</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">Rs</span>
                                        <input
                                            name="security_deposit"
                                            type="number"
                                            step="0.01"
                                            className="w-full rounded-md border-slate-300 pl-10 p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none border transition-all font-mono font-bold text-slate-700"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Held against cylinders (Liability)</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-emerald-900/10 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Creating Account...' : <><Save size={16} /> Create Account</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
