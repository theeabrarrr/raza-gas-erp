'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateSettings, changePassword, type OrgSettings } from '@/app/actions/settingsActions';
import { toast } from 'sonner';
import { Loader2, Save, Lock, Building, DollarSign } from 'lucide-react';
// import { updateProfile } from '@/app/actions/manageUser';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'profile' | 'config' | 'security'>('profile');
    const [settings, setSettings] = useState<OrgSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Profile Form
    const [form, setForm] = useState({
        company_name: '',
        company_phone: '',
        company_address: '',
        invoice_footer: '',
        default_gas_rate: '',
        low_stock_threshold: ''
    });

    // Password Form
    const [passForm, setPassForm] = useState({
        new_password: '',
        confirm_password: ''
    });

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        setLoading(true);
        const { settings, error } = await getSettings();
        if (settings) {
            setSettings(settings);
            setForm({
                company_name: settings.company_name || '',
                company_phone: settings.company_phone || '',
                company_address: settings.company_address || '',
                invoice_footer: settings.invoice_footer || '',
                default_gas_rate: settings.default_gas_rate?.toString() || '',
                low_stock_threshold: settings.low_stock_threshold?.toString() || ''
            });
        }
        setLoading(false);
    }

    async function handleSaveSettings(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        const payload = new FormData();
        Object.entries(form).forEach(([k, v]) => payload.append(k, v));

        const res = await updateSettings(null, payload);
        if (res.error) toast.error(res.error);
        else toast.success("Settings saved!");
        setSubmitting(false);
    }

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        const payload = new FormData();
        payload.append('new_password', passForm.new_password);
        payload.append('confirm_password', passForm.confirm_password);

        const res = await changePassword(null, payload);
        if (res.error) toast.error(res.error);
        else {
            toast.success("Password changed!");
            setPassForm({ new_password: '', confirm_password: '' });
        }
        setSubmitting(false);
    }

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 max-w-4xl mx-auto min-h-screen pb-32">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">System Settings</h1>
            <p className="text-slate-500 font-medium mb-8">Manage branding, configurations, and security.</p>

            {/* TABS */}
            <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm mb-6 inline-flex">
                <TabButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<Building size={16} />} label="Company Profile" />
                <TabButton active={activeTab === 'config'} onClick={() => setActiveTab('config')} icon={<DollarSign size={16} />} label="Configurations" />
                <TabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={<Lock size={16} />} label="Security" />
            </div>

            {/* TAB CONTENT */}
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">

                {activeTab === 'profile' && (
                    <form onSubmit={handleSaveSettings} className="p-8 space-y-6">
                        <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-4">Branding & Invoice Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="Company Name" value={form.company_name} onChange={(e: any) => setForm({ ...form, company_name: e.target.value })} required />
                            <Input label="Phone Number" value={form.company_phone} onChange={(e: any) => setForm({ ...form, company_phone: e.target.value })} />
                            <div className="md:col-span-2">
                                <Input label="Address" value={form.company_address} onChange={(e: any) => setForm({ ...form, company_address: e.target.value })} />
                            </div>
                            <div className="md:col-span-2">
                                <Input label="Invoice Footer Message" value={form.invoice_footer} onChange={(e: any) => setForm({ ...form, invoice_footer: e.target.value })} />
                            </div>
                        </div>
                        <div className="pt-4 flex justify-end">
                            <SaveButton loading={submitting} />
                        </div>
                    </form>
                )}

                {activeTab === 'config' && (
                    <form onSubmit={handleSaveSettings} className="p-8 space-y-6">
                        <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-4">System Configurations</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100">
                                <label className="block text-sm font-bold text-emerald-800 uppercase mb-2">Today's Gas Rate (Rs)</label>
                                <input
                                    type="number"
                                    value={form.default_gas_rate}
                                    onChange={(e) => setForm({ ...form, default_gas_rate: e.target.value })}
                                    className="w-full text-3xl font-black text-emerald-600 bg-transparent outline-none placeholder:text-emerald-200"
                                    placeholder="0"
                                />
                                <p className="text-xs text-emerald-600 mt-2">Auto-filled in new orders.</p>
                            </div>

                            <div className="bg-rose-50 p-6 rounded-xl border border-rose-100">
                                <label className="block text-sm font-bold text-rose-800 uppercase mb-2">Low Stock Alert Limit</label>
                                <input
                                    type="number"
                                    value={form.low_stock_threshold}
                                    onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                                    className="w-full text-3xl font-black text-rose-600 bg-transparent outline-none placeholder:text-rose-200"
                                    placeholder="15"
                                />
                                <p className="text-xs text-rose-600 mt-2">Trigger for dashboard warnings.</p>
                            </div>
                        </div>
                        <div className="pt-4 flex justify-end">
                            <SaveButton loading={submitting} />
                        </div>
                    </form>
                )}

                {activeTab === 'security' && (
                    <form onSubmit={handleChangePassword} className="p-8 space-y-6">
                        <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-4">Change Password</h2>
                        <div className="max-w-md space-y-4">
                            <Input
                                label="New Password"
                                type="password"
                                value={passForm.new_password}
                                onChange={(e: any) => setPassForm({ ...passForm, new_password: e.target.value })}
                                required
                            />
                            <Input
                                label="Confirm Password"
                                type="password"
                                value={passForm.confirm_password}
                                onChange={(e: any) => setPassForm({ ...passForm, confirm_password: e.target.value })}
                                required
                            />
                        </div>
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-slate-900/10 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />} Update Password
                            </button>
                        </div>
                    </form>
                )}

            </div>
        </div>
    );
}

// --- COMPONENTS ---
function TabButton({ active, onClick, icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
        >
            {icon} {label}
        </button>
    );
}

function Input({ label, ...props }: any) {
    return (
        <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{label}</label>
            <input
                {...props}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
        </div>
    );
}

function SaveButton({ loading }: { loading: boolean }) {
    return (
        <button
            type="submit"
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Changes
        </button>
    );
}
