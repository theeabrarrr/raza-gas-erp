'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createEmployee } from '@/app/actions/createEmployee';
import { updateUser, resetPassword, toggleUserStatus, getStaffUsers } from '@/app/actions/manageUser';
import {
    Users, UserPlus, Search, Phone, Shield, Loader2, X,
    Briefcase, Truck, MoreVertical, Edit, Lock, Ban, MailIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';

// --- Types ---
interface Employee {
    id: string;
    name?: string;
    role: string;
    phone?: string;
    email?: string;
    shift?: string;
    created_at: string;
    phone_number?: string;
    // New Props from Join
    profiles?: {
        vehicle_number?: string;
        phone_number?: string;
    } | null;
    raw_user_meta_data?: any;
}

export default function UsersPage() {
    const supabase = createClient();
    const router = useRouter();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [currentUserId, setCurrentUserId] = useState<string>('');

    // Modals
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);

    // Action Modals
    const [resettingUser, setResettingUser] = useState<Employee | null>(null);
    const [deactivatingUser, setDeactivatingUser] = useState<Employee | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State (Unified for Create & Edit)
    const [formData, setFormData] = useState({
        id: '', // For Edit
        name: '',
        email: '',
        phone_number: '',
        role: 'driver',
        shift: 'Day',
        vehicle_number: '',
        password: '' // Only for Create
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

            const result = await getStaffUsers();

            if (result.success && result.data) {
                // Map the data to match Employee interface if needed, or rely on loose typing if compatible
                // The data from getStaffUsers includes profiles join, which matches the interface expectation partially
                // We ensure it matches the Employee state
                const mapped: Employee[] = result.data.map((u: any) => ({
                    id: u.id,
                    name: u.name,
                    role: u.role,
                    email: u.email,
                    phone: u.phone_number, // users table has phone_number
                    phone_number: u.phone_number,
                    shift: u.shift,
                    created_at: u.created_at,
                    profiles: u.profiles, // joined data
                    raw_user_meta_data: u.raw_user_meta_data
                }));
                setEmployees(mapped);
            } else {
                toast.error(result.error || "Failed to load staff.");
            }
        } catch (err) {
            toast.error("Failed to load staff.");
        } finally {
            setLoading(false);
        }
    }

    // --- Actions ---

    const openCreateModal = () => {
        setModalMode('create');
        setFormData({
            id: '',
            name: '',
            email: '',
            phone_number: '',
            role: 'driver',
            shift: 'Day',
            vehicle_number: '',
            password: ''
        });
        setIsUserModalOpen(true);
    };

    const openEditModal = (emp: Employee) => {
        setModalMode('edit');
        setFormData({
            id: emp.id,
            name: emp.name || '',
            email: emp.email || '', // Email usually mostly read-only/display but we keep it
            phone_number: emp.profiles?.phone_number || emp.phone_number || emp.phone || '',
            role: emp.role || 'driver',
            shift: emp.shift || emp.raw_user_meta_data?.shift || 'Day',
            vehicle_number: emp.profiles?.vehicle_number || '', // Fetch from Profile
            password: '' // Not needed for edit
        });
        setIsUserModalOpen(true);
    };

    const handleUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const payload = new FormData();

        // Common Fields
        payload.append('name', formData.name);
        payload.append('role', formData.role);
        payload.append('shift', formData.shift);
        payload.append('phone_number', formData.phone_number);
        // Conditional Vehicle
        if (formData.role === 'driver') {
            payload.append('vehicle_number', formData.vehicle_number);
        }

        try {
            let result;
            if (modalMode === 'create') {
                payload.append('email', formData.email);
                payload.append('password', formData.password);
                result = await createEmployee(null, payload);
            } else {
                payload.append('id', formData.id);
                // updateUser handles the rest
                result = await updateUser(null, payload);
            }

            if (result.error) toast.error(result.error);
            else {
                toast.success(result.message);
                setIsUserModalOpen(false);
                fetchEmployees();
                if (modalMode === 'edit') router.refresh();
            }
        } catch { toast.error('Operation failed'); }
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
        } catch { toast.error('Error resetting password'); }
        finally { setIsSubmitting(false); }
    };

    const handleToggleStatus = async () => {
        if (!deactivatingUser) return;
        setIsSubmitting(true);
        const payload = new FormData();
        payload.append('id', deactivatingUser.id);
        payload.append('action', 'deactivate');

        try {
            const result = await toggleUserStatus(null, payload);
            if (result.error) toast.error(result.error);
            else {
                toast.success(result.message);
                setDeactivatingUser(null);
                fetchEmployees();
            }
        } catch { toast.error('Error updating status'); }
        finally { setIsSubmitting(false); }
    };

    // --- UI Helpers ---
    const getRoleBadge = (role: string) => {
        switch (role.toLowerCase()) {
            case 'admin': return { style: 'bg-blue-100 text-blue-700', icon: Shield, label: 'Admin' };
            case 'driver': return { style: 'bg-emerald-100 text-emerald-700', icon: Truck, label: 'Driver' };
            case 'manager': return { style: 'bg-purple-100 text-purple-700', icon: Briefcase, label: 'Manager' };
            default: return { style: 'bg-slate-100 text-slate-600', icon: Users, label: role };
        }
    };

    const filteredEmployees = employees.filter(e =>
        (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.role || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Staff Management</h1>
                    <p className="text-slate-500 font-medium mt-1">Manage users, roles, and profiles.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/10 transition-all active:scale-95"
                >
                    <UserPlus size={18} /> Add New Staff
                </button>
            </header>

            {/* Main Content */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            placeholder="Search staff..."
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Shift</th>
                                <th className="px-6 py-4">Phone</th>
                                <th className="px-6 py-4">Vehicle</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredEmployees.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No staff found.</td></tr>
                            ) : (
                                filteredEmployees.map((emp) => {
                                    const badge = getRoleBadge(emp.role);
                                    const phone = emp.profiles?.phone_number || emp.phone_number || emp.phone || '-';
                                    const vehicle = emp.profiles?.vehicle_number || '-';

                                    return (
                                        <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-700">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                                                        {(emp.name || 'U')[0]}
                                                    </div>
                                                    {emp.name || 'Unknown'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${badge.style}`}>
                                                    <badge.icon size={12} /> {badge.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-medium">
                                                {emp.shift || 'Day'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                                {phone}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">
                                                {emp.role === 'driver' && vehicle !== '-' ? (
                                                    <div className="flex items-center gap-1.5 text-xs font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-100 w-fit">
                                                        <Truck size={12} /> {vehicle}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => openEditModal(emp)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                                        <Edit size={16} />
                                                    </button>
                                                    <button onClick={() => setResettingUser(emp)} className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Reset Password">
                                                        <Lock size={16} />
                                                    </button>
                                                    <button onClick={() => setDeactivatingUser(emp)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Deactivate">
                                                        <Ban size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* CREATE / EDIT USER MODAL */}
            {isUserModalOpen && (
                <Modal
                    title={modalMode === 'create' ? "Add New Staff" : "Edit Details"}
                    icon={modalMode === 'create' ? <UserPlus size={20} className="text-emerald-600" /> : <Edit size={20} className="text-blue-600" />}
                    onClose={() => setIsUserModalOpen(false)}
                >
                    <form onSubmit={handleUserSubmit} className="space-y-4">
                        <Input
                            label="Full Name"
                            value={formData.name}
                            onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />

                        {/* Email only adjustable on Create for now (Supabase Auth complexity) */}
                        {modalMode === 'create' && (
                            <Input
                                label="Email Address"
                                type="email"
                                value={formData.email}
                                onChange={(e: any) => setFormData({ ...formData, email: e.target.value })}
                                required
                                icon={<MailIcon size={16} />}
                            />
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <Select
                                label="Role"
                                value={formData.role}
                                onChange={(e: any) => setFormData({ ...formData, role: e.target.value })}
                                disabled={modalMode === 'edit' && formData.id === currentUserId} // Prevent self-lockout
                            >
                                <option value="driver">Driver</option>
                                <option value="salesman">Salesman</option>
                                <option value="cashier">Cashier</option>
                                <option value="manager">Manager</option>
                                <option value="recovery">Recovery</option>
                                <option value="admin">Admin</option>
                            </Select>
                            <Select label="Shift" value={formData.shift} onChange={(e: any) => setFormData({ ...formData, shift: e.target.value })}>
                                <option value="Day">Day Shift</option>
                                <option value="Night">Night Shift</option>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Phone Number"
                                value={formData.phone_number}
                                onChange={(e: any) => setFormData({ ...formData, phone_number: e.target.value })}
                                icon={<Phone size={16} />}
                            />

                            {/* CONDITIONAL VEHICLE INPUT */}
                            {formData.role === 'driver' && (
                                <div className="animate-in slide-in-from-left-2 duration-300">
                                    <Input
                                        label="Vehicle Number"
                                        placeholder="KHI-2026"
                                        value={formData.vehicle_number}
                                        onChange={(e: any) => setFormData({ ...formData, vehicle_number: e.target.value })}
                                        icon={<Truck size={16} />}
                                        required={formData.role === 'driver'}
                                    />
                                </div>
                            )}
                        </div>

                        {modalMode === 'create' && (
                            <Input label="Initial Password" value={formData.password} onChange={(e: any) => setFormData({ ...formData, password: e.target.value })} required />
                        )}

                        <div className="pt-4">
                            <Button loading={isSubmitting}>
                                {modalMode === 'create' ? 'Create Account' : 'Save Changes'}
                            </Button>
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
                        <Input label="New Password" placeholder="Enter new password" value={newPassword} onChange={(e: any) => setNewPassword(e.target.value)} required />
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

// --- Components ---

function Modal({ children, title, icon, onClose }: any) {
    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200 text-left">
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
