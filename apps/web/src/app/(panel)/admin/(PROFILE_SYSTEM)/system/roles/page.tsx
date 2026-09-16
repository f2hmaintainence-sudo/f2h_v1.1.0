'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '@/services/api.client';
import {
  Shield,
  RefreshCw,
  Home,
  ChevronRight,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Copy,
  Layers,
  Search,
  AlertTriangle,
  Sparkles,
  CheckSquare,
  Square,
  Lock,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { showSuccessToast, showErrorToast } from '@/components/Toast';

interface PermissionCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  permissions: {
    key: string;
    label: string;
    description: string;
  }[];
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'dashboard',
    name: 'Dashboard & Reports',
    icon: '📊',
    description: 'Analytics, revenue, performance KPIs and exports',
    permissions: [
      { key: 'dashboard.view', label: 'View Dashboard', description: 'Access operational dashboard and metrics' },
      { key: 'dashboard.analytics', label: 'View Analytics', description: 'Access deep business and sales analytics' },
      { key: 'reports.view', label: 'View Reports', description: 'Access revenue and financial reports' },
      { key: 'reports.export', label: 'Export Data', description: 'Download CSV and Excel report exports' },
    ],
  },
  {
    id: 'orders',
    name: 'Orders & Subscriptions',
    icon: '🛒',
    description: 'Daily milk deliveries, orders, customer subscriptions',
    permissions: [
      { key: 'orders.view', label: 'View Orders', description: 'View live and historical order lists' },
      { key: 'orders.manage', label: 'Manage Orders', description: 'Edit status, reschedule, and process orders' },
      { key: 'orders.cancel', label: 'Cancel Orders', description: 'Cancel placed orders and release holds' },
      { key: 'subscriptions.view', label: 'View Subscriptions', description: 'View recurring customer milk subscriptions' },
      { key: 'subscriptions.manage', label: 'Manage Subscriptions', description: 'Pause, edit, or generate subscription orders' },
      { key: 'subscriptions.refunds', label: 'Process Subscription Refunds', description: 'Review refund candidates' },
    ],
  },
  {
    id: 'customers',
    name: 'Customer Management',
    icon: '👥',
    description: 'Profiles, customer addresses, special discount pricing',
    permissions: [
      { key: 'customers.view', label: 'View Customers', description: 'Browse customer list and view profiles' },
      { key: 'customers.manage', label: 'Manage Customers', description: 'Edit customer profiles and delivery addresses' },
      { key: 'customers.special_prices', label: 'Custom Product Pricing', description: 'Set personalized product rates' },
    ],
  },
  {
    id: 'catalog',
    name: 'Catalog & Products',
    icon: '📦',
    description: 'Milk variants, groceries, categories, pricing, coupons',
    permissions: [
      { key: 'catalog.view', label: 'View Catalog', description: 'Browse products, categories, and inventory items' },
      { key: 'catalog.manage', label: 'Manage Products', description: 'Create, edit, and archive products and variants' },
      { key: 'catalog.categories', label: 'Manage Categories', description: 'Add and organize product categories' },
      { key: 'catalog.pricing', label: 'Manage Pricing', description: 'Set standard prices and subscription plans' },
      { key: 'catalog.promotions', label: 'Promotions & Coupons', description: 'Create coupon codes and promo discounts' },
    ],
  },
  {
    id: 'vendors',
    name: 'Vendors & Milk Procurement',
    icon: '🥛',
    description: 'Farmer vendors, daily milk intake, fat testing, WhatsApp slips',
    permissions: [
      { key: 'vendors.view', label: 'View Vendors', description: 'Browse farmer vendor directory and accounts' },
      { key: 'vendors.manage', label: 'Manage Vendors', description: 'Register and update farmer vendor records' },
      { key: 'vendors.collections.view', label: 'View Collections', description: 'Browse daily milk and produce collection logs' },
      { key: 'vendors.collections.create', label: 'Record Intake', description: 'Enter milk quantity, fat %, SNF, and rate' },
      { key: 'vendors.collections.manage', label: 'Edit & Delete Intake', description: 'Modify or remove collection records' },
      { key: 'vendors.slips.send', label: 'Send WhatsApp Slips', description: 'Dispatch automated intake slips to vendors' },
    ],
  },
  {
    id: 'warehouse',
    name: 'Inventory & Warehouse',
    icon: '🏬',
    description: 'Stock levels, stock movements, packing dispatch, crates',
    permissions: [
      { key: 'inventory.view', label: 'View Stock', description: 'Monitor live warehouse stock balances' },
      { key: 'inventory.manage', label: 'Adjust Stock', description: 'Record manual inventory adjustments and counts' },
      { key: 'warehouse.view', label: 'Warehouse View', description: 'Browse warehouses and storage locations' },
      { key: 'warehouse.stock_movements', label: 'Stock In/Out', description: 'Log inbound stock and transfers' },
      { key: 'warehouse.dispatch', label: 'Packing & Dispatch', description: 'Process dispatch runs and bag allocations' },
      { key: 'packages.containers', label: 'Crates & Containers', description: 'Track reusable milk crates and bags' },
    ],
  },
  {
    id: 'delivery',
    name: 'Delivery & Fleet Operations',
    icon: '🚚',
    description: 'Delivery partners, run assignment, live routes, leaves',
    permissions: [
      { key: 'delivery.view', label: 'View Deliveries', description: 'View live delivery runs and driver status' },
      { key: 'delivery.assign', label: 'Assign Delivery Runs', description: 'Assign routes and crates to delivery partners' },
      { key: 'delivery.partners.manage', label: 'Manage Partners', description: 'Approve, onboard, and manage delivery drivers' },
      { key: 'delivery.logs.view', label: 'Delivery Tracking Logs', description: 'Inspect delivery proof and GPS timestamps' },
      { key: 'delivery.leave_requests', label: 'Leave Requests', description: 'Approve or reject partner leave requests' },
      { key: 'delivery.referrals', label: 'Referral Bonuses', description: 'Manage partner referral payouts' },
    ],
  },
  {
    id: 'finance',
    name: 'Finance & Billing',
    icon: '💳',
    description: 'Invoices, outstanding dues, payments, wallet topups, refunds',
    permissions: [
      { key: 'finance.view', label: 'View Financials', description: 'View billing summaries and payment records' },
      { key: 'finance.manage', label: 'Manage Payments', description: 'Record offline payments and settlements' },
      { key: 'finance.billing', label: 'Billing Invoices', description: 'Generate customer invoices and monthly bills' },
      { key: 'finance.wallet', label: 'Customer Wallets', description: 'Manage customer wallet balances and adjustments' },
      { key: 'finance.refunds', label: 'Process Refunds', description: 'Approve and disburse payment refunds' },
      { key: 'finance.outstandings', label: 'Outstandings & Dues', description: 'Track customer balances and credit limits' },
    ],
  },
  {
    id: 'branches',
    name: 'Branch Management & Staff',
    icon: '🏢',
    description: 'Branch locations, coverage zones, staff members',
    permissions: [
      { key: 'branches.view', label: 'View Branches', description: 'Browse branch locations and geofences' },
      { key: 'branches.manage', label: 'Manage Branches', description: 'Create and configure branch delivery radii' },
      { key: 'branches.zones', label: 'Zone Expansion', description: 'Handle new delivery area requests' },
      { key: 'staff.view', label: 'View Staff', description: 'View team members and organizational tree' },
      { key: 'staff.manage', label: 'Manage Staff', description: 'Create, update, and manage staff accounts' },
      { key: 'staff.roles', label: 'Assign Roles', description: 'Grant and revoke permissions for staff' },
    ],
  },
  {
    id: 'system',
    name: 'System & Platform Settings',
    icon: '⚙️',
    description: 'Audit logs, roles & permissions, mobile app version, APIs',
    permissions: [
      { key: 'system.admins', label: 'Admin Accounts', description: 'Full administrator account management' },
      { key: 'system.roles', label: 'Roles & Permissions', description: 'Define and customize access roles' },
      { key: 'system.notifications', label: 'Notifications Setup', description: 'Configure push, SMS, and email alerts' },
      { key: 'system.audit', label: 'Audit Trail', description: 'Inspect full system modification audit logs' },
      { key: 'system.version_control', label: 'App Version Control', description: 'Control mobile app release version gates' },
      { key: 'developer.api_integrations', label: 'API Integrations', description: 'Manage third-party payment and maps keys' },
    ],
  },
];

const PRESETS = [
  {
    name: 'Super Admin',
    desc: 'All system permissions',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    keys: PERMISSION_CATEGORIES.flatMap((c) => c.permissions.map((p) => p.key)),
  },
  {
    name: 'Branch Manager',
    desc: 'Branch orders, procurement, delivery & local staff',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    keys: [
      'dashboard.view',
      'orders.view', 'orders.manage', 'subscriptions.view',
      'customers.view',
      'catalog.view',
      'vendors.view', 'vendors.collections.view', 'vendors.collections.create', 'vendors.collections.manage', 'vendors.slips.send',
      'inventory.view', 'inventory.manage', 'warehouse.view', 'warehouse.dispatch',
      'delivery.view', 'delivery.assign', 'delivery.partners.manage', 'delivery.logs.view', 'delivery.leave_requests',
      'branches.view', 'staff.view',
    ],
  },
  {
    name: 'Procurement Officer',
    desc: 'Milk and produce intake collections & vendor slips',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    keys: [
      'dashboard.view',
      'catalog.view',
      'vendors.view', 'vendors.manage', 'vendors.collections.view', 'vendors.collections.create', 'vendors.collections.manage', 'vendors.slips.send',
      'inventory.view',
    ],
  },
  {
    name: 'Warehouse Manager',
    desc: 'Inventory movements, stock transfers & container packing',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    keys: [
      'dashboard.view',
      'catalog.view',
      'inventory.view', 'inventory.manage', 'warehouse.view', 'warehouse.stock_movements', 'warehouse.dispatch', 'packages.containers',
    ],
  },
  {
    name: 'Delivery Coordinator',
    desc: 'Run assignments, driver fleet & live delivery routes',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    keys: [
      'dashboard.view',
      'orders.view',
      'delivery.view', 'delivery.assign', 'delivery.partners.manage', 'delivery.logs.view', 'delivery.leave_requests',
    ],
  },
  {
    name: 'Billing & Finance',
    desc: 'Invoices, outstandings, wallets and payment refunds',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    keys: [
      'dashboard.view', 'reports.view', 'reports.export',
      'orders.view',
      'customers.view',
      'finance.view', 'finance.manage', 'finance.billing', 'finance.wallet', 'finance.refunds', 'finance.outstandings',
    ],
  },
];

export default function RolesAndPermissionsPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<any>(null);

  const [formData, setFormData] = useState({
    role_name: '',
    description: '',
    permissions: [] as string[],
    is_active: true,
  });

  const [saving, setSaving] = useState(false);
  const [permSearch, setPermSearch] = useState('');

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/admin/system/roles');
      if (res.data?.data) {
        setRoles(res.data.data);
      }
    } catch {
      showErrorToast('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Open Create Role Modal
  const handleOpenAdd = () => {
    setEditingRole(null);
    setFormData({
      role_name: '',
      description: '',
      permissions: [],
      is_active: true,
    });
    setPermSearch('');
    setShowModal(true);
  };

  // Open Edit Role Modal
  const handleOpenEdit = (role: any) => {
    setEditingRole(role);
    setFormData({
      role_name: role.role_name || '',
      description: role.description || '',
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
      is_active: role.is_active === true || role.is_active === 1,
    });
    setPermSearch('');
    setShowModal(true);
  };

  // Duplicate Role
  const handleDuplicate = (role: any) => {
    setEditingRole(null);
    setFormData({
      role_name: `${role.role_name}_copy`,
      description: `Copy of ${role.description || role.role_name}`,
      permissions: Array.isArray(role.permissions) ? [...role.permissions] : [],
      is_active: true,
    });
    setPermSearch('');
    setShowModal(true);
  };

  // Toggle single permission
  const handleTogglePermission = (permKey: string) => {
    setFormData((prev) => {
      const has = prev.permissions.includes(permKey);
      return {
        ...prev,
        permissions: has
          ? prev.permissions.filter((p) => p !== permKey)
          : [...prev.permissions, permKey],
      };
    });
  };

  // Toggle entire category
  const handleToggleCategory = (cat: PermissionCategory) => {
    const catKeys = cat.permissions.map((p) => p.key);
    const allSelected = catKeys.every((k) => formData.permissions.includes(k));

    setFormData((prev) => {
      if (allSelected) {
        return {
          ...prev,
          permissions: prev.permissions.filter((p) => !catKeys.includes(p)),
        };
      } else {
        const set = new Set([...prev.permissions, ...catKeys]);
        return {
          ...prev,
          permissions: Array.from(set),
        };
      }
    });
  };

  // Select all permissions
  const handleSelectAll = () => {
    const allKeys = PERMISSION_CATEGORIES.flatMap((c) => c.permissions.map((p) => p.key));
    setFormData((prev) => ({ ...prev, permissions: allKeys }));
  };

  // Deselect all permissions
  const handleDeselectAll = () => {
    setFormData((prev) => ({ ...prev, permissions: [] }));
  };

  // Apply Preset
  const handleApplyPreset = (keys: string[]) => {
    setFormData((prev) => ({ ...prev, permissions: keys }));
  };

  // Save Role
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.role_name.trim()) {
      showErrorToast('Role name is required');
      return;
    }

    setSaving(true);
    try {
      if (editingRole) {
        const res = await api.patch<any>(`/admin/system/roles/${editingRole.id}`, formData);
        if (res.error) {
          showErrorToast(res.error);
        } else {
          showSuccessToast('Role updated successfully');
          setShowModal(false);
          fetchRoles();
        }
      } else {
        const res = await api.post<any>('/admin/system/roles', formData);
        if (res.error) {
          showErrorToast(res.error);
        } else {
          showSuccessToast('Role created successfully');
          setShowModal(false);
          fetchRoles();
        }
      }
    } catch {
      showErrorToast('Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;
    setSaving(true);
    try {
      await api.delete<any>(`/admin/system/roles/${roleToDelete.id}`);
      showSuccessToast('Role deleted successfully');
      setShowDeleteModal(false);
      setRoleToDelete(null);
      fetchRoles();
    } catch {
      showErrorToast('Failed to delete role');
    } finally {
      setSaving(false);
    }
  };

  // Filtered categories for editor
  const filteredCategories = useMemo(() => {
    if (!permSearch.trim()) return PERMISSION_CATEGORIES;
    const q = permSearch.toLowerCase();
    return PERMISSION_CATEGORIES.map((cat) => ({
      ...cat,
      permissions: cat.permissions.filter(
        (p) =>
          p.key.toLowerCase().includes(q) ||
          p.label.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.permissions.length > 0);
  }, [permSearch]);

  const totalPossiblePermissions = useMemo(() => {
    return PERMISSION_CATEGORIES.reduce((acc, cat) => acc + cat.permissions.length, 0);
  }, []);

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
        <span className="font-bold text-deep-green">Roles & Permissions</span>
      </nav>

      {/* ── Header Banner ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl shadow-purple-950/20 border border-purple-800/30 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[11px] font-bold tracking-wider uppercase backdrop-blur-md border border-white/10 text-purple-200">
            <Shield size={12} className="text-purple-400" /> Access Control & RBAC
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            Roles & Privileges
          </h1>
          <p className="text-xs md:text-sm text-purple-100/70 max-w-xl">
            Configure system roles with fine-grained access rules across catalog, intake procurement, dispatch, billing, and staff.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-2xl shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={16} /> Create Role
          </button>
          <button
            type="button"
            onClick={fetchRoles}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-2xl border border-white/15 backdrop-blur-md transition-all"
            title="Refresh Roles"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Shield size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Defined Roles</p>
            <p className="text-xl font-black text-slate-800">{roles.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Roles</p>
            <p className="text-xl font-black text-emerald-600">
              {roles.filter((r) => r.is_active === true || r.is_active === 1).length}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 col-span-2 lg:col-span-1">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Sliders size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">System Privileges</p>
            <p className="text-xl font-black text-indigo-700">{totalPossiblePermissions} Controls</p>
          </div>
        </div>
      </div>

      {/* ── Roles Grid ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-10 h-10 border-[3px] border-purple-100 border-t-purple-600 rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-400 mt-3">Loading roles & permissions...</p>
        </div>
      ) : roles.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <Shield size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-700">No roles defined yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Click &quot;Create Role&quot; or refresh to initialize the standard role set.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl shadow-md"
          >
            <Plus size={14} /> Create Role
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => {
            const rolePerms: string[] = Array.isArray(role.permissions) ? role.permissions : [];
            const isActive = role.is_active === true || role.is_active === 1;

            return (
              <div
                key={role.id}
                className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                        <Shield size={18} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-sm">
                          {role.role_name.replace(/_/g, ' ').toUpperCase()}
                        </h4>
                        <span
                          className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isActive ? 'Active Role' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDuplicate(role)}
                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Duplicate Role"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(role)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Role & Permissions"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRoleToDelete(role);
                          setShowDeleteModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Role"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {role.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1 mb-3">{role.description}</p>
                  )}

                  {/* Permissions count breakdown */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-2">
                      <span>Privileges Granted</span>
                      <span className="text-purple-700 font-bold">
                        {rolePerms.length} / {totalPossiblePermissions}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 max-h-24 overflow-hidden">
                      {rolePerms.slice(0, 6).map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 bg-slate-50 border border-slate-200/70 text-slate-700 rounded-md text-[9px] font-semibold truncate max-w-[130px]"
                        >
                          {p}
                        </span>
                      ))}
                      {rolePerms.length > 6 && (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-bold rounded-md text-[9px]">
                          +{rolePerms.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">System RBAC</span>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(role)}
                    className="text-purple-600 hover:text-purple-800 font-bold flex items-center gap-1"
                  >
                    Configure <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL: CREATE / EDIT ROLE
      ════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[92vh] flex flex-col relative overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    {editingRole ? `Edit Role: ${editingRole.role_name}` : 'Create New System Role'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {formData.permissions.length} of {totalPossiblePermissions} permissions selected
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="overflow-y-auto p-6 space-y-6 flex-1 text-xs">
              {/* Role Details Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Role Identifier / Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.role_name}
                    onChange={(e) => setFormData({ ...formData, role_name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    placeholder="e.g. branch_manager"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Unique slug used in staff assignments (lowercase, underscores)</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of responsibilities..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* Quick Role Presets */}
              <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={13} className="text-purple-600" /> Apply Preset Templates
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-700 font-bold rounded-lg border border-purple-200 transition-colors"
                    >
                      Select All ({totalPossiblePermissions})
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-lg border border-slate-200 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleApplyPreset(preset.keys)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:scale-105 active:scale-95 ${preset.color}`}
                      title={preset.desc}
                    >
                      {preset.name} ({preset.keys.length})
                    </button>
                  ))}
                </div>
              </div>

              {/* Permission Categories Matrix */}
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Layers size={16} className="text-purple-600" /> Module Access Permissions
                  </h4>
                  <div className="relative max-w-xs w-full">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      placeholder="Filter permission controls..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredCategories.map((category) => {
                    const catKeys = category.permissions.map((p) => p.key);
                    const selectedCatKeys = catKeys.filter((k) => formData.permissions.includes(k));
                    const isAllSelected = catKeys.length > 0 && selectedCatKeys.length === catKeys.length;
                    const isPartial = selectedCatKeys.length > 0 && selectedCatKeys.length < catKeys.length;

                    return (
                      <div
                        key={category.id}
                        className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{category.icon}</span>
                            <div>
                              <p className="font-bold text-slate-800 text-xs">{category.name}</p>
                              <p className="text-[10px] text-slate-400">{category.description}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleCategory(category)}
                            className="text-[11px] font-bold text-purple-700 hover:text-purple-900 px-2.5 py-1 bg-white hover:bg-purple-50 rounded-lg border border-purple-200 transition-colors flex items-center gap-1.5"
                          >
                            {isAllSelected ? (
                              <>
                                <CheckSquare size={13} className="text-purple-600" /> All Selected
                              </>
                            ) : isPartial ? (
                              <>
                                <span className="w-3 h-3 bg-purple-600 rounded-sm inline-block" /> Selected ({selectedCatKeys.length}/{catKeys.length})
                              </>
                            ) : (
                              <>
                                <Square size={13} className="text-slate-400" /> Select Category
                              </>
                            )}
                          </button>
                        </div>

                        {/* Permission Checkbox Tiles */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {category.permissions.map((perm) => {
                            const isChecked = formData.permissions.includes(perm.key);
                            return (
                              <button
                                key={perm.key}
                                type="button"
                                onClick={() => handleTogglePermission(perm.key)}
                                className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                                  isChecked
                                    ? 'bg-purple-50/80 border-purple-300 text-purple-900 shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded-md mt-0.5 flex items-center justify-center text-[10px] font-black shrink-0 transition-colors ${
                                    isChecked ? 'bg-purple-600 text-white' : 'border border-slate-300 bg-slate-50'
                                  }`}
                                >
                                  {isChecked && <Check size={11} />}
                                </div>
                                <div className="space-y-0.5 min-w-0">
                                  <p className="font-bold text-xs truncate leading-snug">{perm.label}</p>
                                  <p className="text-[10px] text-slate-400 font-mono truncate">{perm.key}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span>Active Status:</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className="font-bold text-slate-700"
                >
                  {formData.is_active ? (
                    <span className="text-emerald-600">Enabled</span>
                  ) : (
                    <span className="text-slate-400">Disabled</span>
                  )}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveRole}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-md shadow-purple-600/20 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL: CONFIRM DELETE
      ════════════════════════════════════════════════════════════════ */}
      {showDeleteModal && roleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md p-6 relative">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold mx-auto mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="text-center text-base font-black text-slate-800">Delete System Role</h3>
            <p className="text-center text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Are you sure you want to delete the role <span className="font-bold text-slate-800">{roleToDelete.role_name}</span>?
              Staff assigned to this role may lose access to their privileged features.
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
