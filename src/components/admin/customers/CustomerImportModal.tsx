"use client";

import { useState, useRef } from 'react';
import { UploadCloud, X, Check, FileSpreadsheet, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { bulkCreateCustomers } from '@/app/actions/customerActions';

interface CustomerImportModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function CustomerImportModal({ onClose, onSuccess }: CustomerImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseCSV(selectedFile);
        }
    };

    const parseCSV = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.data && results.data.length > 0) {
                    setPreviewData(results.data.slice(0, 5)); // Preview first 5
                }
            },
            error: (error) => {
                toast.error('Failed to parse CSV');
            }
        });
    };

    const handleImport = async () => {
        if (!file) return;

        setLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rows = results.data;

                // Construct Payload
                const payload = rows.map((row: any) => ({
                    name: row['Name'] || row['name'],
                    phone: row['Phone'] || row['phone'],
                    address: row['Address'] || row['address'] || '',
                    current_balance: parseFloat(row['Balance'] || row['balance'] || '0')
                })).filter((item: any) => item.name && item.phone);

                if (payload.length === 0) {
                    toast.error("No valid customers found (Name & Phone required).");
                    setLoading(false);
                    return;
                }

                // Send to Server Action
                const formData = new FormData();
                formData.append('payload', JSON.stringify(payload));

                const response = await bulkCreateCustomers(null, formData);

                if (response?.error) {
                    toast.error(response.error);
                } else {
                    toast.success(`Successfully imported ${response?.count || 0} customers!`);
                    onSuccess();
                    onClose();
                }
                setLoading(false);
            }
        });
    };

    const downloadTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8,Name,Phone,Address,Balance\nJohn Doe,03001234567,House 123,0";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "customer_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Import Customers</h2>
                        <p className="text-sm text-slate-500 font-medium">Upload CSV to bulk add customers</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8">
                    {/* Step 1: Download Template */}
                    <div className="mb-8 p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                <FileSpreadsheet size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Step 1: Get Template</h3>
                                <p className="text-xs text-slate-500">Ensure your CSV matches the required format.</p>
                            </div>
                        </div>
                        <button onClick={downloadTemplate} className="text-sm font-bold text-blue-600 hover:underline">
                            Download CSV
                        </button>
                    </div>

                    {/* Step 2: Upload */}
                    {!file ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-all group"
                        >
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            <div className="bg-slate-100 p-4 rounded-full mb-4 group-hover:bg-emerald-100 transition-colors">
                                <UploadCloud size={32} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                            </div>
                            <h3 className="font-bold text-slate-900 mb-1">Click to Upload</h3>
                            <p className="text-sm text-slate-500 text-center max-w-xs">Supported format: .csv (Max 5MB)</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* File Info */}
                            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                                        <Check size={20} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 text-sm truncate max-w-[200px]">{file.name}</p>
                                        <p className="text-xs text-slate-500">Ready to processing</p>
                                    </div>
                                </div>
                                <button onClick={() => { setFile(null); setPreviewData([]); }} className="text-xs font-bold text-rose-500 hover:text-rose-600">
                                    Remove
                                </button>
                            </div>

                            {/* Preview Table */}
                            {previewData.length > 0 && (
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preview (First 5 Rows)</h4>
                                    </div>
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white border-b border-slate-100">
                                            <tr>
                                                <th className="px-4 py-2 font-bold text-slate-700">Name</th>
                                                <th className="px-4 py-2 font-bold text-slate-700">Phone</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {previewData.map((row, i) => (
                                                <tr key={i} className="bg-white">
                                                    <td className="px-4 py-2 text-slate-600">
                                                        {row['Name'] || row['name'] || '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-slate-600 font-mono">
                                                        {row['Phone'] || row['phone'] || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!file || loading}
                        className="btn-primary px-6 py-2 text-sm flex items-center gap-2"
                    >
                        {loading ? 'Importing...' : 'Confirm Import'}
                    </button>
                </div>
            </div>
        </div>
    );
}
