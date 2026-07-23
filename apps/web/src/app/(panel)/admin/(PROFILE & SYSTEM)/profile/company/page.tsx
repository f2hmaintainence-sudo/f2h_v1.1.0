"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { Building, Save, ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";

export default function CompanyProfilePage() {
  const [form, setForm] = useState({ name: '', legal_name: '', gst_number: '', pan_number: '', email: '', phone: '', address: '', city: '', state: '', pincode: '', website: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<any>("/admin/profile/company");
        if (res.data?.data) setForm(res.data.data);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put<any>("/admin/profile/company", form);
      if (res.data?.status) showSuccessToast("Company profile saved!");
    } catch { alert("Save failed"); } finally { setSaving(false); }
  };

  const fields = [
    { key: 'name', label: 'Company Name', type: 'text' },
    { key: 'legal_name', label: 'Legal Name', type: 'text' },
    { key: 'gst_number', label: 'GST Number', type: 'text' },
    { key: 'pan_number', label: 'PAN Number', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'address', label: 'Address', type: 'textarea' },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'state', label: 'State', type: 'text' },
    { key: 'pincode', label: 'Pincode', type: 'text' },
    { key: 'website', label: 'Website', type: 'url' },
  ];

  if (loading) return <div className="flex justify-center py-24"><div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" /><span className="font-semibold text-slate-800">Company Profile</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Building size={24} className="text-indigo-500" /> Company Profile</h1>
        <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 disabled:opacity-50">
          <Save size={16} /> {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(f => (
            <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea value={(form as any)[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 resize-none h-24" />
              ) : (
                <input type={f.type} value={(form as any)[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
