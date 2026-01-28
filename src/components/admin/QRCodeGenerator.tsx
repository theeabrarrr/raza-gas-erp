import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { X, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface QRCodeGeneratorProps {
    serialNumbers: string[];
    tenantId: string;
    onClose: () => void;
}

export default function QRCodeGenerator({ serialNumbers, tenantId, onClose }: QRCodeGeneratorProps) {
    const [isOpen, setIsOpen] = useState(true);

    // Sync external open state if needed, but since it's mounted conditionally likely, we just default true.
    // However, if the parent controls mounting, we can just render the Dialog open={true}.

    const handlePrint = () => {
        window.print();
    };

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            onClose();
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white sm:rounded-2xl print:shadow-none print:w-full print:max-w-none print:rounded-none">
                {/* Header - Hidden in Print */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center print:hidden">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Print QR Codes</h2>
                        <p className="text-sm text-slate-500 font-medium">Ready to print {serialNumbers.length} labels</p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={handlePrint}
                            className="bg-slate-900 text-white font-bold gap-2 hover:bg-slate-800"
                        >
                            <Printer size={18} /> Print Labels
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => handleOpenChange(false)}
                            className="bg-slate-100 text-slate-600 font-bold hover:bg-slate-200"
                        >
                            <X size={18} />
                        </Button>
                    </div>
                </div>

                {/* Grid */}
                <div className="p-8 print:p-0 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible">
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
            </DialogContent>
        </Dialog>
    );
}
