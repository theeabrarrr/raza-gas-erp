'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { createEmployee } from '@/app/actions/createEmployee';
import {
    Users, UserPlus, Search, Phone, Shield, Loader2, X, AlertCircle,
    Crown, Briefcase, Truck, MoreVertical, Edit, Lock, Ban, User
} from 'lucide-react';
import { toast } from 'sonner';

// --- Types ---
interface Employee {
    id: string;
    name?: string;       // Fallback
    full_name?: string;  // Primary
    role: string;
    phone?: string;
    email?: string;
    created_at: string;
    // We parse 'shift' from name if possible
}

export default function UsersPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [search, setSearch] = useState('');

    // Stats
    const [stats, setStats] = useState({
        total: 0,
        activeShift: 0,
        admins: 0
    });

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        role: 'driver',
        password: ''
    });

    useEffect(() => {
        fetchEmployees();
    }, []);

    async function fetchEmployees() {
        setLoading(true);
        // 1. Fetch Data
        // Try 'profiles' first, fallback 'users'
        let rawData: any[] = [];

        let { data: profiles, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });

        if (error || !profiles) {
            const { data: users, error: usersError } = await supabase.from('users').select('*').order('created_at', { ascending: false });
            if (!usersError && users) {
                rawData = users;
            }
        } else {
            rawData = profiles;
        }

        setEmployees(rawData);

        // 2. Calculate Stats
        const total = rawData.length;
        // Heuristic: Count "Day" or "Night" in name as "Shift Assigned". 
        // And if it's currently day/night time? Let's just count ALL with explicit shift for now as "Shifted Staff"
        const activeShift = rawData.filter(e =>
            (e.full_name || e.name || '').toLowerCase().includes('day') ||
            (e.full_name || e.name || '').toLowerCase().includes('night')
        ).length;

        const admins = rawData.filter(e => ['admin', 'owner'].includes(e.role)).length;

        setStats({ total, activeShift, admins });
        setLoading(false);
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formPayload = new FormData();
        formPayload.append('name', formData.name);
        formPayload.append('phone', formData.phone);
        formPayload.append('role', formData.role);
        formPayload.append('password', formData.password);

        try {
            const result = await createEmployee(null, formPayload);
            if (result.error) {
                toast.error(result.error);
            } else {
                toast.success(result.message);
                setShowModal(false);
                setFormData({ name: '', phone: '', role: 'driver', password: '' });
                fetchEmployees();
            }
        } catch (error) {
            toast.error('Something went wrong');
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Helpers ---
    const getInitials = (name: string) => {
        const clean = name.replace(/day|night|shift|[()]/gi, '').trim();
        return clean.slice(0, 2).toUpperCase();
    };

    const parseShift = (name: string) => {
        if (name.toLowerCase().includes('day')) return { label: 'Day Shift', color: 'bg-amber-100 text-amber-700 border-amber-200' };
        if (name.toLowerCase().includes('night')) return { label: 'Night Shift', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
        return null;
    };

    const getRoleBadge = (role: string) => {
        switch (role.toLowerCase()) {
            case 'owner':
                return {
                    style: 'bg-amber-100 text-amber-800 border-amber-200 ring-1 ring-amber-200/50',
                    icon: <Crown size={12} className="fill-current" />,
                    label: 'Owner'
                };
            case 'admin':
                return {
                    style: 'bg-blue-100 text-blue-800 border-blue-200 ring-1 ring-blue-200/50',
                    icon: <Shield size={12} />,
                    label: 'Admin'
                };
            case 'manager':
            case 'cashier':
                return {
                    style: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    icon: <Briefcase size={12} />,
                    label: role
                };
            case 'driver':
                return {
                    style: 'bg-slate-100 text-slate-700 border-slate-200',
                    icon: <Truck size={12} />,
                    label: 'Driver'
                };
            default:
                return {
                    style: 'bg-gray-50 text-gray-600 border-gray-200',
                    icon: <User size={12} />,
                    label: role
                };
        }
    };

    // Convert email "[phone]@razagas.com" back to clean phone
    const parsePhone = (email: string | undefined, phone: string | undefined) => {
        if (phone) return phone;
        if (email && email.includes('@')) return email.split('@')[0];
        return 'No Phone';
    };

    const filteredEmployees = employees.filter(e => {
        const term = search.toLowerCase();
        const name = (e.full_name || e.name || '').toLowerCase();
        const ph = (e.phone || e.email || '').toLowerCase();
        return name.includes(term) || ph.includes(term);
    });

    return (
        <div className="min-h-screen bg-gray-50 pb-32 font-sans">

            {/* 1. Header & Stats Section */}
            <div className="bg-white border-b border-slate-200 pt-8 pb-12 px-6 sm:px-10">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Team Directory</h1>
                            <p className="text-slate-500 font-medium mt-1">Manage accounts, security roles, and shift assignments.</p>
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-slate-900 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-slate-900/10 transition-all active:scale-95"
                        >
                            <UserPlus size={18} /> Add Employee
                        </button>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-900 shadow-sm">
                                <Users size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Staff</p>
                                <p className="text-2xl font-black text-slate-900">{stats.total}</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-amber-600 shadow-sm">
                                <Briefcase size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shift Assigned</p>
                                <p className="text-2xl font-black text-slate-900">{stats.activeShift}</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-blue-600 shadow-sm">
                                <Shield size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Admins</p>
                                <p className="text-2xl font-black text-slate-900">{stats.admins}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Main Content */}
            <div className="max-w-7xl mx-auto px-6 sm:px-10 -mt-8">
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">

                    {/* Toolbar */}
                    <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-white/50 backdrop-blur-sm">
                        <Search className="text-slate-400 ml-2" size={20} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 bg-transparent py-2 font-bold text-slate-900 placeholder:text-slate-300 outline-none"
                            placeholder="Search by name, role, or phone..."
                        />
                    </div>

                    {/* Table */}
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
                                <p className="text-sm">Try adjusting your search terms</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr>
                                        <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Identity & Shift</th>
                                        <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Role & Authority</th>
                                        <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Contact</th>
                                        <th className="p-5 text-right text-xs font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredEmployees.map((emp) => {
                                        const displayName = emp.full_name || emp.name || 'Unknown User';
                                        const shift = parseShift(displayName);
                                        const badge = getRoleBadge(emp.role);

                                        return (
                                            <tr key={emp.id} className="group hover:bg-slate-50/50 transition-colors">
                                                {/* Col 1: Identity */}
                                                <td className="p-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-black text-sm">
                                                            {getInitials(displayName)}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900">{displayName}</p>
                                                            {shift && (
                                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md mt-1 ${shift.color}`}>
                                                                    <ClockIcon size={10} /> {shift.label}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Col 2: Role */}
                                                <td className="p-5">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${badge.style}`}>
                                                        {badge.icon}
                                                        {badge.label}
                                                    </span>
                                                </td>

                                                {/* Col 3: Contact */}
                                                <td className="p-5">
                                                    <div className="flex items-center gap-2 text-slate-600 font-mono font-medium text-sm">
                                                        <Phone size={14} className="text-slate-300" />
                                                        {parsePhone(emp.email, emp.phone)}
                                                    </div>
                                                </td>

                                                {/* Col 4: Actions */}
                                                <td className="p-5 text-right">
                                                    <div className="relative inline-block text-left group/menu">
                                                        <button className="p-2 text-slate-300 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors">
                                                            <MoreVertical size={18} />
                                                        </button>
                                                        {/* Dropdown (Simplified CSS-only for demo, ideally accessible component) */}
                                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 py-1">
                                                            <button className="w-full text-left px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-emerald-600 flex items-center gap-2">
                                                                <Edit size={14} /> Edit Details
                                                            </button>
                                                            <button className="w-full text-left px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2">
                                                                <Lock size={14} /> Reset Password
                                                            </button>
                                                            <div className="h-px bg-slate-100 my-1"></div>
                                                            <button className="w-full text-left px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 flex items-center gap-2">
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

            {/* Add Employee Modal (Reused) */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200">
                        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900"><X size={24} /></button>

                        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <UserPlus size={20} className="text-emerald-600" /> New Employee
                        </h2>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Full Name & Shift</label>
                                <input
                                    type="text" required
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none placeholder:font-normal"
                                    placeholder="e.g. Ali Ahmed (Day Shift)"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Include 'Day' or 'Night' in name to prompt Shift Tag.</p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Phone Number</label>
                                <div className="relative">
                                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text" required
                                        className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="03001234567"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Role</label>
                                <select
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="driver">Driver</option>
                                    <option value="salesman">Salesman</option>
                                    <option value="cashier">Cashier</option>
                                    <option value="manager">Shop Manager</option>
                                    <option value="recovery">Recovery Agent</option>
                                    <option value="admin">System Admin</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Initial Password</label>
                                <input
                                    type="text" required
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="Set password..."
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-2 text-xs text-blue-700">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <p>A new user account will be created securely. They can login using the phone number as email ID.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-slate-900 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Create System Account'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

// Icon Helper
function ClockIcon({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}
