import React from 'react';
import QRCode from 'react-qr-code';
import { X, Printer } from 'lucide-react';

interface QRCodeGeneratorProps {
    serialNumbers: string[];
    tenantId: string; // We might need this, or we can just rely on the serial numbers if we assume we are the admin of the current tenant. 
    // Actually, the prompt says "QR Data must match the format: tenant={tenant_id}&id={serial_number}".
    // I need the tenant_id. I can pass it in, or I can fetch it. 
    // Since this is a client component, passing it as a prop is cleaner.
    onClose: () => void;
}

export default function QRCodeGenerator({ serialNumbers, tenantId, onClose }: QRCodeGeneratorProps) {
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex justify-center items-center overflow-y-auto p-4 print:p-0 print:bg-white print:absolute print:inset-0">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none print:rounded-none">
                {/* Header - Hidden in Print */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center print:hidden">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Print QR Codes</h2>
                        <p className="text-sm text-slate-500 font-medium">Ready to print {serialNumbers.length} labels</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handlePrint}
                            className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"
                        >
                            <Printer size={18} /> Print Labels
                        </button>
                        <button
                            onClick={onClose}
                            className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold hover:bg-slate-200 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <div className="p-8 print:p-0">
                    <div className="grid grid-cols-3 gap-8 print:grid-cols-3 print:gap-4">
                        {serialNumbers.map((serial) => (
                            <div key={serial} className="flex flex-col items-center justify-center p-4 border-2 border-slate-900 rounded-xl print:border-2 print:border-black print:break-inside-avoid">
                                <div className="mb-2">
                                    <QRCode
                                        value={`tenant=${tenantId}&id=${serial}`}
                                        size={128}
                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                        viewBox={`0 0 256 256`}
                                    />
                                </div>
                                <div className="text-center">
                                    <div className="text-xl font-black text-slate-900 leading-none mb-1">{serial}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
