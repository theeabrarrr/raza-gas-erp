'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
    Plus, Filter, RefreshCw, UploadCloud, QrCode, Truck,
    MoreVertical, Edit, Trash2, Database, Box, CheckCircle
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import QRCodeGenerator from '@/components/admin/QRCodeGenerator';
import StockImportModal from '@/components/admin/inventory/StockImportModal';
import PlantOperationsModal from '@/components/admin/inventory/PlantOperationsModal';
import { getTenantInfo } from '@/app/actions/adminActions';
import {
    createCylinder,
    getCylinders,
    updateCylinderStatus,
    updateCylinder,
    deleteCylinder
} from '@/app/actions/cylinderActions';
import { Badge } from "@/components/ui/badge";

interface Cylinder {
    id: string;
    serial_number: string;
    type: '45.4KG';
    status: 'full' | 'empty' | 'missing' | 'maintenance' | 'at_customer';
    current_location_type: 'warehouse' | 'shop' | 'driver' | 'customer';
    condition: string;
    holder_name?: string;
    tenant_id?: string;
    updated_at: string;
}

export default function CylinderRegistry() {
    const [cylinders, setCylinders] = useState<Cylinder[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showQRModal, setShowQRModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showPlantModal, setShowPlantModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [tenantId, setTenantId] = useState('');
    const [tenantName, setTenantName] = useState('');

    // Bulk Form State
    const [bulkPrefix, setBulkPrefix] = useState('');
    const [bulkStart, setBulkStart] = useState('');
    const [bulkEnd, setBulkEnd] = useState('');

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [refilling, setRefilling] = useState(false);

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editSerial, setEditSerial] = useState('');

    // Delete State
    const [deleteTarget, setDeleteTarget] = useState<{ id: string, serial: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const info = await getTenantInfo();
            setTenantName(info.name || "My Organization");

            const generatedPrefix = (info.name || "My Organization")
                .split(' ')
                .map((word: string) => word[0])
                .join('')
                .toUpperCase() + "-";
            setBulkPrefix(generatedPrefix);

            const data = await getCylinders();
            // @ts-ignore
            setCylinders(data);

            const { data: { user } } = await supabase.auth.getUser();
            if (user?.app_metadata?.tenant_id) {
                setTenantId(user.app_metadata.tenant_id);
            }

        } catch (error) {
            toast.error('Failed to load inventory data');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefill = async () => {
        if (selectedIds.length === 0) return;
        setRefilling(true);
        try {
            const promises = selectedIds.map(id => updateCylinderStatus(id, 'full'));
            await Promise.all(promises);
            toast.success(`Refilled ${selectedIds.length} cylinders!`);
            setSelectedIds([]);
            await loadData();
        } catch (error: any) {
            toast.error('Refill failed: ' + error.message);
        } finally {
            setRefilling(false);
        }
    };

    // Bulk Generator Logic
    const handleBulkGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        const start = parseInt(bulkStart);
        const end = parseInt(bulkEnd);

        if (isNaN(start) || isNaN(end) || start > end) {
            toast.error('Invalid number range');
            return;
        }

        if (end - start > 500) {
            toast.error('Please limit bulk to 500 at a time');
            return;
        }

        setGenerating(true);
        let successCount = 0;
        let errors = 0;

        try {
            // Loop creation (reusing existing logic from previous page)
            for (let i = start; i <= end; i++) {
                const numStr = i.toString().padStart(3, '0');
                const serial = `${bulkPrefix}${numStr}`;

                const formData = new FormData();
                formData.append('serial_number', serial);
                formData.append('type', '45.4KG');
                formData.append('status', 'full');

                const result = await createCylinder(null, formData);
                if (result?.error) errors++;
                else successCount++;
            }

            if (errors > 0) toast.warning(`Generated ${successCount}. ${errors} failed.`);
            else toast.success(`Generated ${successCount} cylinders!`);

            setBulkStart('');
            setBulkEnd('');
            setShowBulkModal(false);
            await loadData();

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId || !editSerial) return;

        try {
            const result = await updateCylinder(editingId, editSerial);
            if (result.error) throw new Error(result.error);
            toast.success("Updated successfully");
            setEditingId(null);
            loadData();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            const result = await deleteCylinder(deleteTarget.id);
            if (result.error) throw new Error(result.error);
            toast.success("Deleted successfully");
            setDeleteTarget(null);
            loadData();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const filteredCylinders = cylinders.filter(c =>
        c.serial_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredCylinders.length) setSelectedIds([]);
        else setSelectedIds(filteredCylinders.map(c => c.id));
    };

    // Stats
    const totalCount = cylinders.length;
    const fullCount = cylinders.filter(c => c.status === 'full').length;
    const emptyCount = cylinders.filter(c => c.status === 'empty').length;
    const atPlantCount = cylinders.filter(c => c.status === 'maintenance').length;


    // Helper for Status Badge
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'full': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 shadow-none">Full</Badge>;
            case 'empty': return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200 shadow-none">Empty</Badge>;
            case 'maintenance': return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200 shadow-none">Maintenance</Badge>;
            case 'at_customer': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 shadow-none">At Customer</Badge>;
            case 'missing': return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200 shadow-none">Missing</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="p-8 space-y-8 bg-slate-50/50 min-h-screen pb-32">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Inventory Registry</h1>
                    <p className="text-slate-500 mt-1 font-medium">Manage gas cylinders and meaningful assets for {tenantName}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowPlantModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors">
                        <Truck size={16} /> Plant Operations
                    </button>
                    <button onClick={() => setShowBulkModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm shadow-emerald-200 transition-all active:scale-95">
                        <Plus size={18} /> Add Stock
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Assets" value={totalCount} icon={<Database className="text-blue-600" />} />
                <StatCard title="Filled Cylinders" value={fullCount} icon={<CheckCircle className="text-emerald-600" />} />
                <StatCard title="Empty Cylinders" value={emptyCount} icon={<Box className="text-slate-600" />} />
                <StatCard title="At Plant" value={atPlantCount} icon={<Truck className="text-orange-600" />} />
            </div>

            {/* Main Content */}
            <div className="bg-white border boundary-slate-200 rounded-xl shadow-sm overflow-hidden">
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by serial number..."
                            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowImportModal(true)} className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors">
                            <UploadCloud size={16} /> Legacy Import
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                            <tr>
                                <th className="p-4 w-[40px]">
                                    <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                        checked={filteredCylinders.length > 0 && selectedIds.length === filteredCylinders.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="p-4">Serial #</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Location</th>
                                <th className="p-4">Last Update</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredCylinders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400">
                                        No assets found matching your search.
                                    </td>
                                </tr>
                            ) : (
                                filteredCylinders.map((cyl) => (
                                    <tr key={cyl.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-4">
                                            <input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                checked={selectedIds.includes(cyl.id)}
                                                onChange={() => toggleSelect(cyl.id)}
                                            />
                                        </td>
                                        <td className="p-4 font-bold text-slate-900">{cyl.serial_number}</td>
                                        <td className="p-4">{getStatusBadge(cyl.status)}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-700 capitalize">{cyl.current_location_type}</span>
                                                {cyl.holder_name && cyl.current_location_type !== 'warehouse' && (
                                                    <span className="text-xs text-slate-500">{cyl.holder_name}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-500">
                                            {new Date(cyl.updated_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger className="p-2 hover:bg-slate-100 rounded-full transition-colors outline-none text-slate-400 hover:text-slate-600">
                                                    <MoreVertical size={16} />
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => {
                                                        setEditingId(cyl.id);
                                                        setEditSerial(cyl.serial_number);
                                                    }}>
                                                        <Edit className="mr-2 h-4 w-4" /> Edit Serial
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => setDeleteTarget({ id: cyl.id, serial: cyl.serial_number })}>
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Asset
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bulk Action Bar - Preserved Functionality */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-lg animate-in slide-in-from-bottom-4 fade-in duration-200">
                    <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 px-6 rounded-2xl shadow-xl border border-slate-800 flex items-center justify-between">
                        <span className="font-bold text-sm tracking-wide">{selectedIds.length} Selected</span>
                        <div className="flex items-center gap-3">
                            {/* Contextual Actions */}
                            {selectedIds.length > 0 && (
                                <button
                                    onClick={() => setShowQRModal(true)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-300 hover:text-white" title="Print QR"
                                >
                                    <QrCode size={18} />
                                </button>
                            )}

                            {/* Refill Action (Only for Empty) */}
                            {filteredCylinders.filter(c => selectedIds.includes(c.id)).every(c => c.status === 'empty') && (
                                <button
                                    onClick={handleRefill}
                                    disabled={refilling}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                                >
                                    {refilling ? 'Processing...' : <><RefreshCw size={14} /> Refill</>}
                                </button>
                            )}

                            {/* Clear Selection */}
                            <button onClick={() => setSelectedIds([])} className="ml-2 text-xs font-bold text-slate-500 hover:text-slate-300 uppercase tracking-wider">
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showQRModal && (
                <QRCodeGenerator
                    serialNumbers={filteredCylinders.filter(c => selectedIds.includes(c.id)).map(c => c.serial_number)}
                    tenantId={tenantId}
                    onClose={() => setShowQRModal(false)}
                />
            )}

            {showImportModal && (
                <StockImportModal
                    onClose={() => setShowImportModal(false)}
                    onSuccess={() => loadData()}
                />
            )}

            {showPlantModal && (
                <PlantOperationsModal
                    onClose={() => setShowPlantModal(false)}
                    onSuccess={() => loadData()}
                    emptyCount={emptyCount}
                    maintenanceCount={atPlantCount}
                />
            )}

            {/* Bulk Generate Modal (Simple Version) */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-xl font-bold text-slate-900">Add New Assets</h3>
                            <p className="text-sm text-slate-500">Generate serial numbers in bulk.</p>
                        </div>
                        <form onSubmit={handleBulkGenerate} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Prefix</label>
                                <input type="text" value={bulkPrefix} readOnly className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-mono text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Start #</label>
                                    <input type="number" required value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} className="w-full mt-1 p-3 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" placeholder="001" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">End #</label>
                                    <input type="number" required value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} className="w-full mt-1 p-3 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" placeholder="100" />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowBulkModal(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" disabled={generating} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none">
                                    {generating ? 'Generating...' : 'Generate Assets'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Serial Modal */}
            {editingId && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Serial Number</h3>
                        <form onSubmit={handleEdit} className="space-y-4">
                            <input
                                type="text"
                                value={editSerial}
                                onChange={(e) => setEditSerial(e.target.value)}
                                className="w-full p-3 border border-slate-200 rounded-xl font-mono uppercase focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setEditingId(null)} className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                                <button type="submit" className="flex-1 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800">Update</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* DELETE ALERT DIALOG */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete cylinder
                            <span className="font-bold text-slate-900"> {deleteTarget?.serial} </span>
                            from the database.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white border-0">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}



function StatCard({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
                <div className="text-2xl font-bold text-slate-900">{value}</div>
            </div>
            <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                {icon}
            </div>
        </div>
    )
}
