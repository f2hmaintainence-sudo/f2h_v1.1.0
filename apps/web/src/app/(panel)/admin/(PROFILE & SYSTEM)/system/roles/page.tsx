"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { Shield, RefreshCw, Home, ChevronRight, Plus, Edit, ToggleLeft, ToggleRight, X, Check } from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";

const allPermissions = [
  "dashboard.view", "orders.view", "orders.manage", "subscriptions.view", "subscriptions.manage",
  "customers.view", "customers.manage", "catalog.view", "catalog.manage",
  "inventory.view", "inventory.manage", "warehouse.view", "warehouse.manage",
  "delivery.view", "delivery.manage", "delivery.assign",
  "reports.view", "finance.view", "finance.manage",
  "branches.view", "branches.manage", "staff.view", "staff.manage",
  "system.admins", "system.roles", "system.notifications", "system.audit",
];

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ role_name: "", description: "", permissions: [] as string[], is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/system/roles");
      if (res.data?.data) setRoles(res.data.data);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const togglePermission = (perm: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingRole) {
        await api.patch<any>(`/admin/system/roles/${editingRole.id}`, formData);
        showSuccessToast("Role updated");
      } else {
        await api.post<any>("/admin/system/roles", formData);
        showSuccessToast("Role created");
      }
      setShowForm(false); setEditingRole(null);
      setFormData({ role_name: "", description: "", permissions: [], is_active: true });
      fetchRoles();
    } catch { alert("Failed to save role"); } finally { setSaving(false); }
  };

  const startEdit = (role: any) => {
    setEditingRole(role);
    setFormData({
      role_name: role.role_name, description: role.description || "",
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
      is_active: role.is_active,
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-5 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Roles & Permissions</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Shield size={24} className="text-purple-500" /> Roles & Permissions</h1>
          <p className="text-xs text-slate-400 mt-1">Define access levels and permissions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditingRole(null); setFormData({ role_name: "", description: "", permissions: [], is_active: true }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700"><Plus size={14} /> Add Role</button>
          <button onClick={fetchRoles} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50"><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {/* Role Form Modal */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-purple-200 shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">{editingRole ? "Edit Role" : "New Role"}</h3>
            <button onClick={() => setShowForm(false)}><X size={16} className="text-slate-400" /></button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Role Name</label>
                <input type="text" value={formData.role_name} onChange={e => setFormData(p => ({ ...p, role_name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="e.g. branch_manager" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Description</label>
                <input type="text" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Role description" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Permissions</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {allPermissions.map(p => (
                  <button key={p} onClick={() => togglePermission(p)}
                    className={`px-2.5 py-1.5 text-[10px] font-semibold rounded-lg border text-left transition-all ${formData.permissions.includes(p)
                      ? "bg-purple-50 text-purple-700 border-purple-300" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                    {formData.permissions.includes(p) ? <Check size={10} className="inline mr-1" /> : null}
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={handleSave} disabled={saving || !formData.role_name}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50">
                {saving ? "Saving..." : "Save Role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roles List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-[3px] border-purple-100 border-t-purple-500 rounded-full animate-spin" /></div>
      ) : roles.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <Shield size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">No roles defined yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-purple-500" />
                  <span className="text-sm font-bold text-slate-900">{r.role_name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${r.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <button onClick={() => startEdit(r)} className="text-slate-400 hover:text-slate-600"><Edit size={14} /></button>
              </div>
              {r.description && <p className="text-xs text-slate-400 mb-3">{r.description}</p>}
              <div className="flex flex-wrap gap-1">
                {(Array.isArray(r.permissions) ? r.permissions : []).slice(0, 8).map((p: string) => (
                  <span key={p} className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[9px] font-semibold">{p}</span>
                ))}
                {Array.isArray(r.permissions) && r.permissions.length > 8 && (
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-semibold">+{r.permissions.length - 8} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
