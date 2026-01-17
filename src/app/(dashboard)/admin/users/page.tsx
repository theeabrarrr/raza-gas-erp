'use client';

import { useRouter } from 'next/navigation';

import { useState, useEffect } from 'react';
// import { supabase } from '@/lib/supabase'; // Removed to prevent accidental unsecured usage

import { createEmployee } from '@/app/actions/createEmployee';
import { updateUser, resetPassword, toggleUserStatus } from '@/app/actions/manageUser';
import { getTenantUsers } from '@/app/actions/adminActions';
import {
    Users, UserPlus, Search, Phone, Shield, Loader2, X, AlertCircle,
    Crown, Briefcase, Truck, MoreVertical, Edit, Lock, Ban, User, MailIcon, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase'; // Import Supabase Client

// --- Types ---
interface Employee {
    id: string;
    name?: string;       // Primary
    role: string;
    phone?: string;
    phone_number?: string;
    email?: string;
    shift?: string;
    created_at: string;
    banned_until?: string; // To check status
    raw_user_meta_data?: any;
}

export default function UsersPage() {
    const router = useRouter();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string>('');

    // Modals State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Employee | null>(null);
    const [resettingUser, setResettingUser] = useState<Employee | null>(null);
    const [deactivatingUser, setDeactivatingUser] = useState<Employee | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        total: 0,
        activeShift: 0,
        admins: 0
    });

    // Create Form State
    const [createForm, setCreateForm] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'driver',
        shift: 'Day',
        password: ''
    });

    // Update Form State
    const [editForm, setEditForm] = useState({
        name: '',
        phone: '',
        role: '',
        shift: ''
    });

    // Reset Password State
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        fetchEmployees();
    }, []);

    async function fetchEmployees() {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setCurrentUserId(user.id);

            const rawData = await getTenantUsers();

            // Just use the raw data directly, or map if necessary
            // Filtering logic remains the same below
            setEmployees(rawData);

            // Stats
            const total = rawData.length;
            const activeShift = rawData.filter((e: any) => { // Type assertion for safety
                const s = (e.shift || e.raw_user_meta_data?.shift || '').toLowerCase();
                return s === 'day' || s === 'night';
            }).length;
            const admins = rawData.filter((e: any) => ['admin', 'owner'].includes(e.role)).length;

            setStats({ total, activeShift, admins });
        } catch (err) {
            toast.error("Failed to load staff.");
        } finally {
            setLoading(false);
        }
    }


    // --- Actions ---

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const payload = new FormData();
        Object.entries(createForm).forEach(([key, val]) => payload.append(key, val));

        try {
            const result = await createEmployee(null, payload);
            if (result.error) toast.error(result.error);
            else {
                toast.success(result.message);
                setIsCreateModalOpen(false);
                setCreateForm({ name: '', email: '', phone: '', role: 'driver', shift: 'Day', password: '' });
                fetchEmployees();
            }
        } catch { toast.error('Error creating user'); }
        finally { setIsSubmitting(false); }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setIsSubmitting(true);

        const payload = new FormData();
        payload.append('id', editingUser.id);
        payload.append('name', editForm.name);
        payload.append('phone', editForm.phone);
        payload.append('role', editForm.role);
        payload.append('shift', editForm.shift);

        try {
            const result = await updateUser(null, payload);
            if (result.error) toast.error(result.error);
            else {
                toast.success(result.message);
                setEditingUser(null);
                fetchEmployees();
                router.refresh(); // Force server component refresh if any
            }
        } catch { toast.error('Error updating user'); }
        finally { setIsSubmitting(false); }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resettingUser) return;
        setIsSubmitting(true);

        const payload = new FormData();
        payload.append('id', resettingUser.id);
        payload.append('password', newPassword);

        try {
            const result = await resetPassword(null, payload);
            if (result.error) toast.error(result.error);
            else {
                toast.success(result.message);
                setResettingUser(null);
                setNewPassword('');
            }
        } catch { toast.error('Error reset password'); }
        finally { setIsSubmitting(false); }
    };

    const handleToggleStatus = async () => {
        if (!deactivatingUser) return;
        setIsSubmitting(true);
        // For simplicity, we assume we just want to 'Block' (Deactivate) for now as requested.
        // Or if we want to toggle, we'd need current status. 
        // Let's implement 'Deactivate' as requested.
        const payload = new FormData();
        payload.append('id', deactivatingUser.id);
        payload.append('action', 'deactivate');

        try {
            const result = await toggleUserStatus(null, payload);
            if (result.error) toast.error(result.error);
            else {
                toast.success(result.message);
                setDeactivatingUser(null);
                fetchEmployees(); // Ideally user list updates to show status
            }
        } catch { toast.error('Error updating status'); }
        finally { setIsSubmitting(false); }
    };

    // --- Initializers for Modals ---
    const openEdit = (emp: Employee) => {
        setEditingUser(emp);
        setEditForm({
            name: emp.name || '',
            phone: emp.phone_number || emp.phone || '',
            role: emp.role || 'driver',
            shift: emp.shift || emp.raw_user_meta_data?.shift || 'Day'
        });
    };

    // --- Helpers ---
    const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

    const getShiftBadge = (shift: string | undefined) => {
        if (!shift) return null;
        const s = shift.toLowerCase();
        if (s === 'day') return { label: 'Day Shift', color: 'bg-amber-100 text-amber-700 border-amber-200' };
        if (s === 'night') return { label: 'Night Shift', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
        return { label: shift, color: 'bg-gray-100 text-gray-700 border-gray-200' };
    };

    const getRoleBadge = (role: string) => {
        switch (role.toLowerCase()) {
            case 'owner': return { style: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Crown size={12} />, label: 'Owner' };
            case 'admin': return { style: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Shield size={12} />, label: 'Admin' };
            case 'manager':
            case 'cashier': return { style: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <Briefcase size={12} />, label: role };
            case 'driver': return { style: 'bg-slate-100 text-slate-700 border-slate-200', icon: <Truck size={12} />, label: 'Driver' };
            default: return { style: 'bg-gray-50 text-gray-600 border-gray-200', icon: <User size={12} />, label: role };
        }
    };

    const filteredEmployees = employees.filter(e => {
        const term = search.toLowerCase();
        return (e.name || '').toLowerCase().includes(term) ||
            (e.email || '').toLowerCase().includes(term) ||
            (e.phone_number || e.phone || '').includes(term);
    });

    return (
        <div className="min-h-screen bg-gray-50 pb-32 font-sans">
            {/* Header & Stats */}
            <div className="bg-white border-b border-slate-200 pt-8 pb-12 px-6 sm:px-10">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Team Directory</h1>
                            <p className="text-slate-500 font-medium mt-1">Manage accounts, security roles, and shift assignments.</p>
                        </div>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-slate-900 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-slate-900/10 transition-all active:scale-95"
                        >
                            <UserPlus size={18} /> Add Employee
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard icon={<Users size={24} />} label="Total Staff" value={stats.total} color="text-slate-900" />
                        <StatCard icon={<Briefcase size={24} />} label="Shift Assigned" value={stats.activeShift} color="text-amber-600" />
                        <StatCard icon={<Shield size={24} />} label="System Admins" value={stats.admins} color="text-blue-600" />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 sm:px-10 -mt-8">
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-white/50 backdrop-blur-sm">
                        <Search className="text-slate-400 ml-2" size={20} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 bg-transparent py-2 font-bold text-slate-900 placeholder:text-slate-300 outline-none"
                            placeholder="Search by name, role, email..."
                        />
                    </div>

                    <div className="overflow-x-auto min-h-[400px]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <Loader2 size={32} className="animate-spin mb-4 text-emerald-500" />
                                <p className="font-bold">Loading Team...</p>
                            </div>
                        ) : filteredEmployees.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                                <Users size={48} className="mb-4 opacity-50" />
                                <p className="font-bold text-lg">No team members found</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr>
                                        <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Identity & Shift</th>
                                        <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Role</th>
                                        <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Contact</th>
                                        <th className="p-5 text-right text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredEmployees.map((emp) => {
                                        const displayName = emp.name || 'Unknown User';
                                        const shiftData = emp.shift || (emp.raw_user_meta_data?.shift);
                                        const shiftBadge = getShiftBadge(shiftData);
                                        const badge = getRoleBadge(emp.role);

                                        return (
                                            <tr key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="p-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-black text-sm">
                                                            {getInitials(displayName)}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900">{displayName}</p>
                                                            <p className="text-xs text-slate-400 font-medium">{emp.email}</p>
                                                            {shiftBadge && (
                                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md mt-1 ${shiftBadge.color}`}>
                                                                    <ClockIcon size={10} /> {shiftBadge.label}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-5">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${badge.style}`}>
                                                        {badge.icon} {badge.label}
                                                    </span>
                                                </td>
                                                <td className="p-5">
                                                    <div className="flex items-center gap-2 text-slate-600 font-mono font-medium text-sm">
                                                        <Phone size={14} className="text-slate-300" />
                                                        {emp.phone_number || emp.phone || 'No Phone'}
                                                    </div>
                                                </td>
                                                <td className="p-5 text-right">
                                                    <div className="relative inline-block text-left group/menu">
                                                        <button className="p-2 text-slate-300 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors">
                                                            <MoreVertical size={18} />
                                                        </button>
                                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 py-1 origin-top-right">
                                                            <button onClick={() => openEdit(emp)} className="w-full text-left px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-emerald-600 flex items-center gap-2">
                                                                <Edit size={14} /> Edit Details
                                                            </button>
                                                            <button onClick={() => setResettingUser(emp)} className="w-full text-left px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2">
                                                                <Lock size={14} /> Reset Password
                                                            </button>
                                                            <div className="h-px bg-slate-100 my-1"></div>
                                                            <button onClick={() => setDeactivatingUser(emp)} className="w-full text-left px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 flex items-center gap-2">
                                                                <Ban size={14} /> Deactivate
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* CREATE MODAL */}
            {isCreateModalOpen && (
                <Modal title="New Employee" icon={<UserPlus size={20} className="text-emerald-600" />} onClose={() => setIsCreateModalOpen(false)}>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <Input label="Full Name" placeholder="e.g. Ali Ahmed" value={createForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm({ ...createForm, name: e.target.value })} required />
                        <Input label="Email Address" type="email" placeholder="ali@razagas.com" value={createForm.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm({ ...createForm, email: e.target.value })} required icon={<MailIcon size={16} />} />
                        <div className="grid grid-cols-2 gap-4">
                            <Select label="Role" value={createForm.role} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateForm({ ...createForm, role: e.target.value })}>
                                <option value="driver">Driver</option>
                                <option value="salesman">Salesman</option>
                                <option value="cashier">Cashier</option>
                                <option value="manager">Manager</option>
                                <option value="recovery">Recovery</option>
                                <option value="admin">Admin</option>
                            </Select>
                            <Select label="Shift" value={createForm.shift} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateForm({ ...createForm, shift: e.target.value })}>
                                <option value="Day">Day Shift</option>
                                <option value="Night">Night Shift</option>
                            </Select>
                        </div>
                        <Input label="Phone (Optional)" placeholder="03001234567" value={createForm.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm({ ...createForm, phone: e.target.value })} icon={<Phone size={16} />} />
                        <Input label="Initial Password" placeholder="Set password..." value={createForm.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm({ ...createForm, password: e.target.value })} required />

                        <div className="pt-4">
                            <Button loading={isSubmitting}>Create Account</Button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* EDIT MODAL */}
            {editingUser && (
                <Modal title="Edit Employee" icon={<Edit size={20} className="text-blue-600" />} onClose={() => setEditingUser(null)}>
                    <form onSubmit={handleEdit} className="space-y-4">
                        <Input label="Full Name" value={editForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, name: e.target.value })} required />
                        <Input label="Phone" value={editForm.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, phone: e.target.value })} icon={<Phone size={16} />} />
                        <div className="grid grid-cols-2 gap-4">
                            <Select label="Role" value={editForm.role} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, role: e.target.value })} disabled={editingUser.id === currentUserId}>
                                <option value="driver">Driver</option>
                                <option value="salesman">Salesman</option>
                                <option value="cashier">Cashier</option>
                                <option value="manager">Manager</option>
                                <option value="recovery">Recovery</option>
                                <option value="admin">Admin</option>
                            </Select>
                            <Select label="Shift" value={editForm.shift} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditForm({ ...editForm, shift: e.target.value })}>
                                <option value="Day">Day Shift</option>
                                <option value="Night">Night Shift</option>
                            </Select>
                        </div>
                        <div className="pt-4">
                            <Button loading={isSubmitting}>Save Changes</Button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* RESET PASSWORD MODAL */}
            {resettingUser && (
                <Modal title="Reset Password" icon={<Lock size={20} className="text-orange-600" />} onClose={() => setResettingUser(null)}>
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div className="p-3 bg-orange-50 text-orange-800 text-sm rounded-lg mb-4">
                            Resetting password for <strong>{resettingUser.name}</strong>.
                        </div>
                        <Input label="New Password" placeholder="Enter new password" value={newPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)} required />
                        <div className="pt-4">
                            <Button loading={isSubmitting}>Update Password</Button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* DEACTIVATE MODAL */}
            {deactivatingUser && (
                <Modal title="Deactivate User" icon={<Ban size={20} className="text-red-600" />} onClose={() => setDeactivatingUser(null)}>
                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 text-red-900 rounded-xl border border-red-100">
                            <p className="font-bold text-lg mb-1">Are you sure?</p>
                            <p className="text-sm">
                                This will immediately block access for <strong>{deactivatingUser.name}</strong>.
                                They will be logged out properly.
                            </p>
                        </div>
                        <div className="flex gap-3 pt-4">
                            <button onClick={() => setDeactivatingUser(null)} className="flex-1 py-3 font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                            <button onClick={handleToggleStatus} disabled={isSubmitting} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/20">
                                {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'Confirm Deactivate'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

        </div>
    );
}

// --- Composable UI Components ---

function Modal({ children, title, icon, onClose }: any) {
    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900"><X size={24} /></button>
                <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">{icon} {title}</h2>
                {children}
            </div>
        </div>
    );
}

function Input({ label, icon, ...props }: any) {
    return (
        <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{label}</label>
            <div className="relative">
                {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
                <input
                    {...props}
                    className={`w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none placeholder:font-normal placeholder:text-slate-400 ${icon ? 'pl-10' : ''}`}
                    style={{ color: '#0f172a' }}
                />
            </div>
        </div>
    );
}

function Select({ label, children, ...props }: any) {
    return (
        <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{label}</label>
            <select
                {...props}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                style={{ color: '#0f172a' }}
            >
                {children}
            </select>
        </div>
    );
}

function Button({ children, loading }: any) {
    return (
        <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
            {loading ? <Loader2 className="animate-spin" /> : children}
        </button>
    );
}

function StatCard({ icon, label, value, color }: any) {
    return (
        <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                <div className={color}>{icon}</div>
            </div>
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-black text-slate-900">{value}</p>
            </div>
        </div>
    );
}

function ClockIcon({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}
