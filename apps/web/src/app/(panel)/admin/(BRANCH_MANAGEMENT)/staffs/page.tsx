'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '@/services/api.client';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Building,
  Phone,
  Mail,
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  Check,
  X,
  RefreshCw,
  Home,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  BadgeCheck,
  AlertTriangle,
  LayoutGrid,
  List,
  Sparkles,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import { showSuccessToast, showErrorToast } from '@/components/Toast';

interface StaffMember {
  management_id: string;
  user_id: string;
  user_name: string;
  email: string;
  phone: string;
  role_id: string;
  role_name?: string;
  branch_id?: string | null;
  branch_name?: string | null;
  department?: string | null;
  designation?: string | null;
  is_active: boolean | number;
  created_at?: string;
  updated_at?: string;
}

interface RoleOption {
  id: number;
  role_name: string;
  description?: string;
  permissions?: string[];
  is_active?: boolean;
}

interface BranchOption {
  branch_id: string;
  branch_name: string;
  branch_code?: string;
  city?: string;
}

const DEPARTMENTS = [
  'Operations',
  'Procurement & Intake',
  'Warehouse & Inventory',
  'Delivery & Logistics',
  'Billing & Finance',
  'Customer Support',
  'Administration & IT',
];

const DESIGNATIONS = [
  'General Manager',
  'Branch Manager',
  'Operations Lead',
  'Procurement Officer',
  'Milk Collector',
  'Quality Control Supervisor',
  'Warehouse Executive',
  'Delivery Dispatcher',
  'Billing Specialist',
  'Support Executive',
  'Staff Associate',
];

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    user_name: '',
    email: '',
    phone: '',
    password: '',
    role_id: 'admin',
    branch_id: '',
    department: 'Operations',
    designation: 'Staff Associate',
    is_active: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Fetch all staff members
  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (searchQuery) params.search = searchQuery;
      if (selectedBranch !== 'all') params.branch_id = selectedBranch;
      if (selectedRole !== 'all') params.role_id = selectedRole;
      if (selectedStatus !== 'all') params.is_active = selectedStatus === 'active' ? 'true' : 'false';

      const res = await api.get<any>('/admin/system/admins', { params });
      if (res.data?.data) {
        setStaffList(res.data.data);
      }
    } catch {
      showErrorToast('Failed to load staff list');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedBranch, selectedRole, selectedStatus]);

  // Fetch roles and branches for dropdowns
  const fetchMetadata = useCallback(async () => {
    try {
      const [rolesRes, branchRes] = await Promise.all([
        api.get<any>('/admin/system/roles'),
        api.get<any>('/admin/branch/table?limit=100'),
      ]);

      if (rolesRes.data?.data) {
        setRoles(rolesRes.data.data);
      }
      if (branchRes.data?.data) {
        setBranches(branchRes.data.data);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Password Generator Helper
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, password: pass }));
    setShowPassword(true);
  };

  // Open Create Modal
  const handleOpenAdd = () => {
    setFormData({
      user_name: '',
      email: '',
      phone: '',
      password: '',
      role_id: roles[0]?.role_name || 'admin',
      branch_id: branches[0]?.branch_id || '',
      department: 'Operations',
      designation: 'Staff Associate',
      is_active: true,
    });
    setFormError('');
    setShowPassword(false);
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setFormData({
      user_name: staff.user_name || '',
      email: staff.email || '',
      phone: staff.phone || '',
      password: '',
      role_id: staff.role_id || 'admin',
      branch_id: staff.branch_id || '',
      department: staff.department || 'Operations',
      designation: staff.designation || 'Staff Associate',
      is_active: staff.is_active === true || staff.is_active === 1,
    });
    setFormError('');
    setShowPassword(false);
    setShowEditModal(true);
  };

  // Open View Modal
  const handleOpenView = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setShowViewModal(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setShowDeleteModal(true);
  };

  // Save New Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.user_name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setFormError('Please fill in all required contact and identity fields.');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        branch_id: formData.branch_id || null,
      };
      const res = await api.post<any>('/admin/system/admins', payload);
      if (res.error) {
        setFormError(res.error);
        showErrorToast(res.error);
      } else {
        showSuccessToast('Staff member created successfully');
        setShowAddModal(false);
        fetchStaff();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create staff member');
      showErrorToast('Failed to create staff member');
    } finally {
      setSaving(false);
    }
  };

  // Save Updated Staff
  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setFormError('');

    if (!formData.user_name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setFormError('Please fill in all required contact fields.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        user_name: formData.user_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        role_id: formData.role_id,
        branch_id: formData.branch_id || null,
        department: formData.department,
        designation: formData.designation,
        is_active: formData.is_active,
      };
      if (formData.password?.trim()) {
        payload.password = formData.password.trim();
      }

      const id = selectedStaff.management_id || selectedStaff.user_id;
      const res = await api.patch<any>(`/admin/system/admins/${id}`, payload);
      if (res.error) {
        setFormError(res.error);
        showErrorToast(res.error);
      } else {
        showSuccessToast('Staff member updated successfully');
        setShowEditModal(false);
        fetchStaff();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to update staff member');
      showErrorToast('Failed to update staff member');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (staff: StaffMember) => {
    const nextStatus = !(staff.is_active === true || staff.is_active === 1);
    const id = staff.management_id || staff.user_id;

    // Optimistic UI update
    setStaffList((prev) =>
      prev.map((s) => (s.user_id === staff.user_id ? { ...s, is_active: nextStatus } : s)),
    );

    try {
      await api.patch<any>(`/admin/system/admins/${id}`, { is_active: nextStatus });
      showSuccessToast(`Staff status updated to ${nextStatus ? 'Active' : 'Inactive'}`);
    } catch {
      showErrorToast('Failed to change status');
      fetchStaff();
    }
  };

  // Confirm Delete Staff
  const handleConfirmDelete = async () => {
    if (!selectedStaff) return;
    setSaving(true);
    try {
      const id = selectedStaff.management_id || selectedStaff.user_id;
      await api.delete<any>(`/admin/system/admins/${id}`);
      showSuccessToast('Staff member deleted successfully');
      setShowDeleteModal(false);
      setSelectedStaff(null);
      fetchStaff();
    } catch {
      showErrorToast('Failed to delete staff member');
    } finally {
      setSaving(false);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const total = staffList.length;
    const active = staffList.filter((s) => s.is_active === true || s.is_active === 1).length;
    const branchBound = staffList.filter((s) => Boolean(s.branch_id)).length;
    const central = total - branchBound;
    return { total, active, branchBound, central };
  }, [staffList]);

  // Helper for role pill styling
  const getRoleBadge = (roleName: string = '') => {
    const r = roleName.toLowerCase();
    if (r.includes('super')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (r.includes('procure') || r.includes('milk')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (r.includes('branch') || r.includes('manager')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (r.includes('warehouse') || r.includes('inventory')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (r.includes('deliver') || r.includes('dispatch')) {
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    }
    if (r.includes('finance') || r.includes('bill')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  // Resolve permissions list for view modal
  const selectedStaffRolePermissions = useMemo(() => {
    if (!selectedStaff) return [];
    const matchedRole = roles.find(
      (r) =>
        r.role_name.toLowerCase() === selectedStaff.role_id?.toLowerCase() ||
        r.role_name.toLowerCase() === selectedStaff.role_name?.toLowerCase(),
    );
    return matchedRole?.permissions || [];
  }, [selectedStaff, roles]);

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
        <span className="text-gray-400">Administration</span>
        <ChevronRight size={13} className="text-gray-300" />
        <span className="font-bold text-deep-green">Staff Management</span>
      </nav>

      {/* ── Top Header & Stats ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl shadow-emerald-950/20 border border-emerald-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-fresh-green/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[11px] font-bold tracking-wider uppercase backdrop-blur-md border border-white/10 text-emerald-200">
            <Shield size={12} className="text-emerald-400" /> Administrative Personnel
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            Staff & Team Members
          </h1>
          <p className="text-xs md:text-sm text-emerald-100/70 max-w-xl">
            Manage organization staff, branch personnel assignments, access privileges, and system roles.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-fresh-green text-white text-sm font-bold rounded-2xl shadow-lg shadow-fresh-green/30 hover:bg-deep-green transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <UserPlus size={16} />
            Add Staff Member
          </button>
          <button
            type="button"
            onClick={fetchStaff}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-2xl border border-white/15 backdrop-blur-md transition-all"
            title="Refresh Staff List"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Staff</p>
            <p className="text-xl font-black text-slate-800">{metrics.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            <BadgeCheck size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Staff</p>
            <p className="text-xl font-black text-emerald-600">{metrics.active}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Building2 size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Branch Personnel</p>
            <p className="text-xl font-black text-blue-700">{metrics.branchBound}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Shield size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Central Admins</p>
            <p className="text-xl font-black text-purple-700">{metrics.central}</p>
          </div>
        </div>
      </div>

      {/* ── Filter and Control Bar ── */}
      <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5 w-full">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone, role, dept..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Branch Filter */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.branch_id} value={b.branch_id}>
                {b.branch_name}
              </option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">All Roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.role_name}>
                {r.role_name.replace(/_/g, ' ').toUpperCase()}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-end md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'table' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Table View"
          >
            <List size={15} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'cards' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Grid Cards View"
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {/* ── Staff Listing ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-10 h-10 border-[3px] border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-400 mt-3">Loading staff members...</p>
        </div>
      ) : staffList.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Users size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-700">No staff members found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            {searchQuery || selectedBranch !== 'all' || selectedRole !== 'all' || selectedStatus !== 'all'
              ? 'Try adjusting your filters or search terms.'
              : 'Add your first staff member to start building your administrative team.'}
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-fresh-green text-white text-xs font-bold rounded-xl shadow-md hover:bg-deep-green transition-all"
          >
            <UserPlus size={14} /> Add Staff Member
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* ── TABLE VIEW ── */
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">
                  <th className="px-5 py-3.5">Staff Member</th>
                  <th className="px-4 py-3.5">Contact Details</th>
                  <th className="px-4 py-3.5">Branch & Dept</th>
                  <th className="px-4 py-3.5">System Role</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map((staff) => {
                  const isActive = staff.is_active === true || staff.is_active === 1;
                  return (
                    <tr key={staff.user_id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Member Info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                            {staff.user_name?.slice(0, 2) || 'ST'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-xs">{staff.user_name}</p>
                            <p className="text-[11px] text-slate-400">{staff.designation || 'Staff Member'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5 space-y-0.5">
                        <a
                          href={`mailto:${staff.email}`}
                          className="flex items-center gap-1.5 text-slate-600 hover:text-emerald-600 transition-colors font-medium text-[11px]"
                        >
                          <Mail size={12} className="text-slate-400" />
                          <span>{staff.email}</span>
                        </a>
                        <a
                          href={`tel:${staff.phone}`}
                          className="flex items-center gap-1.5 text-slate-500 hover:text-emerald-600 transition-colors font-medium text-[11px]"
                        >
                          <Phone size={12} className="text-slate-400" />
                          <span>{staff.phone}</span>
                        </a>
                      </td>

                      {/* Branch & Dept */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                            <Building size={10} className="text-slate-400" />
                            {staff.branch_name || 'Central Head Office'}
                          </span>
                          {staff.department && (
                            <p className="text-[10px] text-slate-400 font-medium">{staff.department}</p>
                          )}
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getRoleBadge(
                            staff.role_name || staff.role_id,
                          )}`}
                        >
                          <Shield size={11} />
                          {(staff.role_name || staff.role_id || 'Staff').replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>

                      {/* Status Toggle */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(staff)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold transition-all focus:outline-none"
                          title={isActive ? 'Click to Deactivate' : 'Click to Activate'}
                        >
                          {isActive ? (
                            <ToggleRight size={24} className="text-emerald-600 hover:text-emerald-700" />
                          ) : (
                            <ToggleLeft size={24} className="text-slate-300 hover:text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenView(staff)}
                            className="p-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 rounded-lg transition-colors"
                            title="View Staff Profile & Permissions"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(staff)}
                            className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-colors"
                            title="Edit Staff Member"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(staff)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg transition-colors"
                            title="Delete Staff Member"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── GRID CARDS VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffList.map((staff) => {
            const isActive = staff.is_active === true || staff.is_active === 1;
            return (
              <div
                key={staff.user_id}
                className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold text-sm uppercase shadow-sm">
                        {staff.user_name?.slice(0, 2) || 'ST'}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-sm leading-snug">{staff.user_name}</h4>
                        <p className="text-xs text-slate-400 font-medium">{staff.designation || 'Staff Associate'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(staff)}
                      title={isActive ? 'Active Member' : 'Inactive Member'}
                    >
                      {isActive ? (
                        <ToggleRight size={24} className="text-emerald-600" />
                      ) : (
                        <ToggleLeft size={24} className="text-slate-300" />
                      )}
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{staff.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-slate-400 shrink-0" />
                      <span>{staff.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Building size={13} className="text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-700">{staff.branch_name || 'Central Head Office'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getRoleBadge(
                      staff.role_name || staff.role_id,
                    )}`}
                  >
                    <Shield size={10} />
                    {(staff.role_name || staff.role_id || 'Staff').replace(/_/g, ' ').toUpperCase()}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenView(staff)}
                      className="p-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(staff)}
                      className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDelete(staff)}
                      className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL: ADD STAFF MEMBER
      ════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Add New Staff Member</h3>
                  <p className="text-xs text-slate-400">Create staff credentials, assign role and branch</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="mt-5 space-y-4 text-xs font-medium text-slate-700">
              {/* Identity Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Staff Name / Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.user_name}
                    onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. ramesh@form2home.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold inline-flex items-center gap-1"
                    >
                      <Sparkles size={11} /> Generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Min 6 characters"
                      className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Organization & Role Assignment */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    System Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  >
                    {roles.length > 0 ? (
                      roles.map((r) => (
                        <option key={r.id} value={r.role_name}>
                          {r.role_name.replace(/_/g, ' ').toUpperCase()}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="milk_collector">MILK COLLECTOR</option>
                        <option value="admin">ADMIN</option>
                        <option value="branch_manager">BRANCH MANAGER</option>
                        <option value="milk_procurement_officer">MILK PROCUREMENT OFFICER</option>
                        <option value="warehouse_manager">WAREHOUSE MANAGER</option>
                        <option value="delivery_dispatcher">DELIVERY DISPATCHER</option>
                        <option value="finance_billing_staff">FINANCE BILLING STAFF</option>
                        <option value="staff">STAFF</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Branch Assignment
                  </label>
                  <select
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  >
                    <option value="">Central / Head Office (All Branches)</option>
                    {branches.map((b) => (
                      <option key={b.branch_id} value={b.branch_id}>
                        {b.branch_name} {b.city ? `(${b.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Designation
                  </label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  >
                    {DESIGNATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Switch */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Account Status</p>
                  <p className="text-[11px] text-slate-400">Active members can log into the staff panel immediately</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className="inline-flex items-center gap-1.5 focus:outline-none"
                >
                  {formData.is_active ? (
                    <ToggleRight size={28} className="text-emerald-600" />
                  ) : (
                    <ToggleLeft size={28} className="text-slate-300" />
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-fresh-green hover:bg-deep-green text-white font-bold rounded-xl text-xs shadow-md shadow-fresh-green/20 transition-all disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL: EDIT STAFF MEMBER
      ════════════════════════════════════════════════════════════════ */}
      {showEditModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Edit Staff Member</h3>
                  <p className="text-xs text-slate-400">Update staff details, role, or reset password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateStaff} className="mt-5 space-y-4 text-xs font-medium text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Staff Name / Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.user_name}
                    onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    New Password (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Leave blank to keep unchanged"
                      className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Organization & Role Assignment */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    System Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.role_id}
                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    {roles.length > 0 ? (
                      roles.map((r) => (
                        <option key={r.id} value={r.role_name}>
                          {r.role_name.replace(/_/g, ' ').toUpperCase()}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="milk_collector">MILK COLLECTOR</option>
                        <option value="admin">ADMIN</option>
                        <option value="branch_manager">BRANCH MANAGER</option>
                        <option value="milk_procurement_officer">MILK PROCUREMENT OFFICER</option>
                        <option value="warehouse_manager">WAREHOUSE MANAGER</option>
                        <option value="delivery_dispatcher">DELIVERY DISPATCHER</option>
                        <option value="finance_billing_staff">FINANCE BILLING STAFF</option>
                        <option value="staff">STAFF</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Branch Assignment
                  </label>
                  <select
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="">Central / Head Office (All Branches)</option>
                    {branches.map((b) => (
                      <option key={b.branch_id} value={b.branch_id}>
                        {b.branch_name} {b.city ? `(${b.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Designation
                  </label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    {DESIGNATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Switch */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Account Status</p>
                  <p className="text-[11px] text-slate-400">Toggle active or inactive status</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className="inline-flex items-center gap-1.5 focus:outline-none"
                >
                  {formData.is_active ? (
                    <ToggleRight size={28} className="text-emerald-600" />
                  ) : (
                    <ToggleLeft size={28} className="text-slate-300" />
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Update Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL: VIEW DETAILS & PERMISSIONS
      ════════════════════════════════════════════════════════════════ */}
      {showViewModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-800">Staff Profile & Privileges</h3>
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {/* Profile Card */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-black text-lg uppercase shadow-md shadow-emerald-700/20">
                  {selectedStaff.user_name?.slice(0, 2) || 'ST'}
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-base">{selectedStaff.user_name}</h4>
                  <p className="text-xs text-slate-500 font-semibold">{selectedStaff.designation || 'Staff Associate'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${getRoleBadge(
                        selectedStaff.role_name || selectedStaff.role_id,
                      )}`}
                    >
                      <Shield size={10} />
                      {(selectedStaff.role_name || selectedStaff.role_id || 'Staff').replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        selectedStaff.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {selectedStaff.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact & Assignment info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</p>
                  <p className="font-semibold text-slate-800 mt-0.5 truncate">{selectedStaff.email}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedStaff.phone}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Branch</p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {selectedStaff.branch_name || 'Central Head Office'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedStaff.department || 'Operations'}</p>
                </div>
              </div>

              {/* Permissions list */}
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Assigned Privileges ({selectedStaffRolePermissions.length})</span>
                  <span className="text-[10px] text-emerald-600 font-semibold lowercase">inherited from role</span>
                </p>
                {selectedStaffRolePermissions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No specific permissions configured for this role.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                    {selectedStaffRolePermissions.map((perm) => (
                      <span
                        key={perm}
                        className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-lg text-[10px] font-semibold"
                      >
                        <Check size={10} className="inline mr-1" />
                        {perm}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowViewModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL: CONFIRM DELETE
      ════════════════════════════════════════════════════════════════ */}
      {showDeleteModal && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 relative">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold mx-auto mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="text-center text-base font-black text-slate-800">Delete Staff Member</h3>
            <p className="text-center text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Are you sure you want to remove <span className="font-bold text-slate-800">{selectedStaff.user_name}</span>?
              This will deactivate and remove their admin credentials.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
