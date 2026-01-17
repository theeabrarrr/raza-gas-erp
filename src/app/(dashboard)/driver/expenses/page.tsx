'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Check, UploadCloud, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { submitExpense } from '@/app/actions/driverExpenseActions';
import Link from 'next/link';
import Image from 'next/image';

const CATEGORIES = ['Fuel', 'Food', 'Challan', 'Maintenance', 'Other'];

export default function AddExpensePage() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setProofFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const handleSubmit = async () => {
        // Validation
        if (!amount || parseFloat(amount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }
        if (!category) {
            toast.error("Please select a category");
            return;
        }
        if (!proofFile) {
            toast.error("Please upload a proof photo");
            return;
        }

        setSubmitting(true);
        const formData = new FormData();
        formData.append('amount', amount);
        formData.append('category', category);
        formData.append('description', description);
        formData.append('proof_file', proofFile);

        const res = await submitExpense(formData);

        if (res.error) {
            toast.error(res.error);
            setSubmitting(false);
        } else {
            toast.success("Expense Added Successfully!");
            router.push('/driver');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-10">
            {/* Header */}
            <header className="bg-white p-4 shadow-sm border-b border-slate-100 flex items-center gap-4 sticky top-0 z-20">
                <Link href="/driver" className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-xl font-black text-slate-800 tracking-tight">Add New Expense</h1>
            </header>

            <main className="p-6 max-w-md mx-auto space-y-8">

                {/* 1. Category Selector */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Category</label>
                    <div className="flex flex-wrap gap-3">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategory(cat)}
                                className={`px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-sm ${category === cat ? 'bg-emerald-600 text-white shadow-emerald-200 scale-105 ring-2 ring-emerald-600 ring-offset-2' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Amount Input */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Amount</label>
                    <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-300">Rs.</span>
                        <input
                            type="number"
                            placeholder="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full h-24 pl-16 bg-white rounded-3xl border border-slate-200 shadow-sm text-5xl font-black text-slate-900 placeholder:text-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                    </div>
                </div>

                {/* 3. Description (Optional) */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Details (Optional)</label>
                    <textarea
                        rows={2}
                        placeholder="e.g. Pump Name, Workshop Details..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-4 bg-white rounded-2xl border border-slate-200 font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-200 transition-all resize-none"
                    />
                </div>

                {/* 4. Proof Upload */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Proof of Payment</label>
                    <label className={`block w-full aspect-video rounded-3xl border-3 border-dashed transition-all cursor-pointer relative overflow-hidden group ${proofFile ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-100 hover:bg-white hover:border-slate-400'}`}>
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment" // Opens camera on mobile
                            className="hidden"
                            onChange={handleFileChange}
                        />

                        {previewUrl ? (
                            <div className="absolute inset-0 z-10">
                                <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="bg-white/90 backdrop-blur text-slate-900 px-4 py-2 rounded-full font-bold text-sm shadow-xl flex items-center gap-2">
                                        <Camera size={16} /> Retake
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                                    <Camera size={32} className="text-slate-400" />
                                </div>
                                <span className="font-bold text-sm">Tap to Take Photo</span>
                            </div>
                        )}
                    </label>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 active:scale-[98%] transition-transform disabled:opacity-50 flex items-center justify-center gap-3 hover:bg-emerald-700"
                    >
                        {submitting ? (
                            <>
                                <UploadCloud size={24} className="animate-bounce" /> Uploading...
                            </>
                        ) : (
                            <>
                                <Receipt size={24} /> Submit Expense
                            </>
                        )}
                    </button>
                </div>

            </main>
        </div>
    );
}
