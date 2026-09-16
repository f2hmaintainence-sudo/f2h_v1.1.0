'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/services/api.client';
import {
  Users,
  RefreshCw,
  Home,
  ChevronRight,
  Search,
  Shield,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  Building,
  Mail,
  Phone,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { showSuccessToast, showErrorToast } from '@/components/Toast';

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (searchQuery) params.search = searchQuery;
      const res = await api.get<any>('/admin/system/admins', { params });
      if (res.data?.data) setAdmins(res.data.data);
      if (res.data?.total !== undefined) setTotal(res.data.total);
    } catch {
      showErrorToast('Failed to load administrator accounts');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      await api.patch<any>(`/admin/system/admins/${userId}`, { is_active: !isActive });
      showSuccessToast(`Admin account ${isActive ? 'deactivated' : 'activated'}`);
      fetchAdmins();
    } catch {
      showErrorToast('Failed to update status');
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await api.patch<any>(`/admin/system/admins/${userId}`, { role });
      showSuccessToast('Role updated successfully');
      fetchAdmins();
    } catch {
      showErrorToast('Failed to update role');
    }
  };

  const roleColors: Record<string, string> = {
    super_admin: 'bg-rose-50 text-rose-700 border-rose-200',
    admin: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    branch_manager: 'bg-blue-50 text-blue-700 border-blue-200',
    milk_procurement_officer: 'bg-amber-50 text-amber-700 border-amber-200',
    warehouse_manager: 'bg-purple-50 text-purple-700 border-purple-200',
    delivery_dispatcher: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    finance_billing_staff: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    staff: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <div className="space-y-5 p-3 md:p-6 font-sans min-h-screen animate-in fade-in duration-300">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 hover:text-fresh-green transition-colors"
        >
          <Home size={13} />
          <span>Dashboard</span>
        </Link>
        <ChevronRight size={13} className="text-gray-300" />
        <span className="text-gray-400">System</span>
        <ChevronRight size={13} className="text-gray-300" />
        <span className="font-bold text-deep-green">Admin Accounts</span>
      </nav>

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl shadow-indigo-950/20 border border-indigo-800/30">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[11px] font-bold tracking-wider uppercase backdrop-blur-md border border-white/10 text-indigo-200 mb-2">
            <Shield size={12} className="text-indigo-400" /> Identity & Access
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            Admin Accounts
          </h1>
          <p className="text-xs md:text-sm text-indigo-100/70 mt-1">
            Manage administrative access, privileged roles, and team assignments • {total} accounts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/staffs"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-fresh-green hover:bg-deep-green text-white text-xs font-bold rounded-2xl shadow-lg transition-all"
          >
            <UserPlus size={14} /> Full Staff Management
          </Link>
          <button
            type="button"
            onClick={fetchAdmins}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-2xl border border-white/15 backdrop-blur-md transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="relative max-w-sm w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search admins by name, email, phone..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 outline-none"
          />
        </div>

        <Link
          href="/admin/system/roles"
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <span>Manage Roles & Permissions</span>
          <ArrowUpRight size={13} />
        </Link>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-10 h-10 border-[3px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-400 mt-3">Loading admin accounts...</p>
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <Users size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-700">No admin accounts found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Create staff accounts in Staff Management to assign system administrative access.
          </p>
          <Link
            href="/admin/staffs"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md"
          >
            <UserPlus size={14} /> Open Staff Management
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">
                  <th className="px-5 py-3.5">Administrator</th>
                  <th className="px-4 py-3.5">Contact</th>
                  <th className="px-4 py-3.5">Branch</th>
                  <th className="px-4 py-3.5 text-center">Assigned Role</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Active Switch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {admins.map((a) => {
                  const isActive = a.is_active === true || a.is_active === 1;
                  return (
                    <tr key={a.user_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-700 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                            {a.user_name?.slice(0, 2) || 'AD'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-xs">{a.user_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{a.user_id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 space-y-0.5">
                        <p className="flex items-center gap-1.5 text-slate-600 font-medium text-[11px]">
                          <Mail size={12} className="text-slate-400" />
                          <span>{a.email}</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                          <Phone size={12} className="text-slate-400" />
                          <span>{a.phone || '—'}</span>
                        </p>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                          <Building size={10} className="text-slate-400" />
                          {a.branch_name || 'Central Head Office'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <select
                          value={a.role_id || a.role || 'staff'}
                          onChange={(e) => handleRoleChange(a.user_id, e.target.value)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border outline-none cursor-pointer ${
                            roleColors[a.role_id || a.role] || roleColors.staff
                          }`}
                        >
                          <option value="super_admin">Super Admin</option>
                          <option value="admin">Admin</option>
                          <option value="branch_manager">Branch Manager</option>
                          <option value="milk_procurement_officer">Procurement Officer</option>
                          <option value="warehouse_manager">Warehouse Manager</option>
                          <option value="delivery_dispatcher">Delivery Dispatcher</option>
                          <option value="finance_billing_staff">Billing & Finance</option>
                          <option value="staff">Staff</option>
                        </select>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(a.user_id, isActive)}
                          className="text-slate-400 hover:text-slate-600 focus:outline-none"
                          title={isActive ? 'Deactivate' : 'Activate'}
                        >
                          {isActive ? (
                            <ToggleRight size={22} className="text-emerald-500" />
                          ) : (
                            <ToggleLeft size={22} />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
