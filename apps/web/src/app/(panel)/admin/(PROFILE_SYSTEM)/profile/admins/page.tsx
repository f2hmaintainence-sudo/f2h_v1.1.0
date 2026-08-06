"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { Users, RefreshCw, Home, ChevronRight, Search, Shield, ToggleLeft, ToggleRight } from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      const res = await api.get<any>(`/admin/system/admins?${params}`);
      if (res.data?.data) setAdmins(res.data.data);
      if (res.data?.total) setTotal(res.data.total);
    } catch { } finally { setLoading(false); }
  }, [searchQuery]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      await api.patch<any>(`/admin/system/admins/${userId}`, { is_active: !isActive });
      showSuccessToast(`Admin ${isActive ? "deactivated" : "activated"}`);
      fetchAdmins();
    } catch { alert("Failed to update"); }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await api.patch<any>(`/admin/system/admins/${userId}`, { role });
      showSuccessToast("Role updated");
      fetchAdmins();
    } catch { alert("Failed to update role"); }
  };

  const roleColors: Record<string, string> = {
    super_admin: "bg-rose-50 text-rose-600 border-rose-200",
    admin: "bg-indigo-50 text-indigo-600 border-indigo-200",
    manager: "bg-blue-50 text-blue-600 border-blue-200",
    staff: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <div className="space-y-5 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Admin Users</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Shield size={24} className="text-indigo-500" /> Admin Users</h1>
          <p className="text-xs text-slate-400 mt-1">Manage admin access and roles • {total} users</p>
        </div>
        <button onClick={fetchAdmins} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50"><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search admins..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-[3px] border-indigo-100 border-t-indigo-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-center">Role</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a: any) => (
                  <tr key={a.user_id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-slate-800">{a.user_name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{a.email}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{a.phone || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <select value={a.role} onChange={e => handleRoleChange(a.user_id, e.target.value)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-full border ${roleColors[a.role] || roleColors.staff}`}>
                        <option value="super_admin">Super Admin</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="staff">Staff</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold ${a.is_active ? "text-emerald-600" : "text-slate-400"}`}>
                        {a.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggleActive(a.user_id, a.is_active)}
                        className="text-slate-400 hover:text-slate-600">
                        {a.is_active ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
