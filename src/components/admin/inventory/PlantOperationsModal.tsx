"use client";

import { useState } from 'react';
import { X, Truck, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { sendToPlant, receiveFromPlant } from '@/app/actions/cylinderActions';

interface PlantOperationsModalProps {
    onClose: () => void;
    onSuccess: () => void;
    emptyCount: number;
    maintenanceCount: number;
}

export default function PlantOperationsModal({ onClose, onSuccess, emptyCount, maintenanceCount }: PlantOperationsModalProps) {
    const [mode, setMode] = useState<'send' | 'receive'>('send');
    const [quantity, setQuantity] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        const qty = parseInt(quantity);
        if (!qty || qty <= 0) {
            toast.error("Please enter a valid quantity");
            return;
        }

        if (mode === 'send' && qty > emptyCount) {
            toast.error(`Only ${emptyCount} empty cylinders available`);
            return;
        }

        if (mode === 'receive' && qty > maintenanceCount) {
            toast.error(`Only ${maintenanceCount} cylinders at plant`);
            return;
        }

        setLoading(true);
        try {
            const result = mode === 'send'
                ? await sendToPlant(qty)
                : await receiveFromPlant(qty);

            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(mode === 'send'
                    ? `Sent ${result.count} cylinders to plant`
                    : `Received ${result.count} filled cylinders`
                );
                onSuccess();
                onClose();
            }
        } catch (error) {
            toast.error("Operation failed");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                            <Truck size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Plant Operations</h2>
                            <p className="text-sm text-slate-500 font-medium">Bulk Send / Receive Workflow</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {/* Tabs */}
                    <div className="flex bg-slate-100 rounded-lg p-1 mb-6">
                        <button
                            onClick={() => setMode('send')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${mode === 'send'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <ArrowRight size={16} /> Send to Plant
                        </button>
                        <button
                            onClick={() => setMode('receive')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${mode === 'receive'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <ArrowLeft size={16} /> Receive Full
                        </button>
                    </div>

                    {/* Stats & Input */}
                    <div className="space-y-6">
                        <div className="text-center">
                            <p className="text-sm font-medium text-slate-500 mb-1">
                                {mode === 'send' ? 'Available Empty Cylinders' : 'Cylinders Currently at Plant'}
                            </p>
                            <div className="text-3xl font-black text-slate-900">
                                {mode === 'send' ? emptyCount : maintenanceCount}
                            </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Quantity to {mode === 'send' ? 'Send' : 'Receive'}
                            </label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="e.g. 50"
                                className="w-full text-center text-2xl font-bold py-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                autoFocus
                            />
                            <p className="text-xs text-center text-slate-400 mt-2">
                                {mode === 'send'
                                    ? `Will update oldest ${quantity || 0} empty cylinders to 'Maintenance'`
                                    : `Will update ${quantity || 0} cylinders to 'Full'`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`px-6 py-2 text-sm font-bold text-white rounded-lg shadow-lg flex items-center gap-2 transition-transform active:scale-95 ${mode === 'send'
                                ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                            }`}
                    >
                        {loading ? 'Processing...' : (
                            <>
                                <CheckCircle size={16} /> Confirm {mode === 'send' ? 'Dispatch' : 'Receipt'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
