// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Subscription Prepaid Refund Candidates & Wallet Credit Approvals
//
// ============================================================================

'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Loader2,
  RefreshCw,
  Users,
  Wallet,
  XCircle,
  AlertCircle,
  IndianRupee,
  Package,
  CalendarDays,
  Receipt,
  Eye,
  Search,
  Download,
  Home,
  ChevronRight,
  ShieldCheck,
  Ban,
  Sparkles,
  SlidersHorizontal,
  FileSpreadsheet,
  Check,
  X,
  AlertTriangle,
  Layers,
  Calendar,
} from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api-config';

const API = typeof window !== 'undefined' ? getApiBaseUrl() : 'http://localhost:5001/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SummaryData {
  pending_count: number;
  refunded_count: number;
  rejected_count: number;
  pending_amount: number;
  refunded_amount: number;
  pending_customers: number;
}

interface Delivery {
  refund_candidate_id: string;
  subscription_id: string;
  subscription_number?: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  scheduled_date: string;
  delivery_slot: string;
  quantity: number;
  /** The prepaid subscription price this refund is valued at. */
  final_price?: number;
  unit_price?: number;
  refund_amount: number;
  refund_reason: string;
  /** 'pause' = paused day, 'order' = failed delivery. */
  source?: string;
  product_name: string;
  variant_name: string;
  order_number?: string;
  status: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  notes?: string | null;
}

interface CustomerGroup {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  pending_deliveries: number;
  pending_refund_amount: number;
  deliveries: Delivery[];
}

interface Payout {
  refund_payout_id: string;
  refund_number: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  total_deliveries: number;
  status: string;
  approved_by: string;
  approved_at: string;
  processed_at: string;
}

// ─── Formatters & Helpers ─────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtAmount(n: number | string | undefined | null) {
  const num = Number(n || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RefundCandidatesPage() {
  const [activeTab, setActiveTab] = useState<'grouped' | 'flat' | 'payouts'>('grouped');
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterSubscription, setFilterSubscription] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [branches, setBranches] = useState<Array<{ branch_id: string; branch_name: string }>>([]);
  const [warehouses, setWarehouses] = useState<Array<{ warehouse_id: string; name: string }>>([]);

  // Inspect Modal
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Developer Testing Preview Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ range: { from: string; to: string }; rows: any[] } | null>(null);

  // Single Action Confirm / Reject Modals
  const [singleRejectTarget, setSingleRejectTarget] = useState<string | null>(null);
  const [singleRejectReason, setSingleRejectReason] = useState('');

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Query Builder ─────────────────────────────────────────────────────────────
  const buildQuery = useCallback(() => {
    const q = new URLSearchParams();
    if (filterDateFrom && filterDateTo) {
      q.set('date_from', filterDateFrom);
      q.set('date_to', filterDateTo);
    } else {
      if (filterDateFrom) q.set('date_from', filterDateFrom);
      if (filterDateTo) q.set('date_to', filterDateTo);
      if (filterMonth) q.set('month', filterMonth);
    }
    if (filterCustomer) q.set('customer_id', filterCustomer);
    if (filterBranch) q.set('branch_id', filterBranch);
    if (filterWarehouse) q.set('warehouse_id', filterWarehouse);
    if (filterSubscription) q.set('subscription_id', filterSubscription);
    if (filterSource) q.set('source', filterSource);
    return q;
  }, [
    filterMonth,
    filterDateFrom,
    filterDateTo,
    filterCustomer,
    filterBranch,
    filterWarehouse,
    filterSubscription,
    filterSource,
  ]);

  // ── Data Fetching ─────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`${API}/subscriptions/refund-candidates/summary`, { credentials: 'include' });
      const json = await res.json();
      setSummary(json.data ?? null);
    } catch {
      // ignore
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const res = await fetch(
        `${API}/subscriptions/refund-candidates/customer-groups?${buildQuery()}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      setGroups(json.data ?? []);
    } catch {
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Load branches & warehouses for dropdowns
  useEffect(() => {
    fetch(`${API}/admin/zone/branches-list`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setBranches(j?.data ?? []))
      .catch(() => {});
    fetch(`${API}/admin/warehouses/active/list`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setWarehouses(j?.data ?? []))
      .catch(() => {});
  }, []);

  // Flattened deliveries for Flat Table view
  const allDeliveries = useMemo(() => {
    const list: (Delivery & { customer_id: string; customer_name: string; customer_phone: string })[] = [];
    groups.forEach((g) => {
      (g.deliveries || []).forEach((d) => {
        list.push({
          ...d,
          customer_id: g.customer_id,
          customer_name: g.customer_name,
          customer_phone: g.customer_phone,
        });
      });
    });
    return list;
  }, [groups]);

  // Filtered deliveries based on local search & status
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim() && filterStatus === 'all') return groups;
    const q = searchQuery.toLowerCase().trim();

    return groups
      .map((g) => {
        const matchCustomer =
          g.customer_name?.toLowerCase().includes(q) ||
          g.customer_phone?.includes(q) ||
          g.customer_id?.toLowerCase().includes(q);

        const matchedDeliveries = (g.deliveries || []).filter((d) => {
          const matchStatus = filterStatus === 'all' || d.status === filterStatus;
          const matchDeliveryText =
            matchCustomer ||
            d.product_name?.toLowerCase().includes(q) ||
            d.variant_name?.toLowerCase().includes(q) ||
            d.subscription_id?.toLowerCase().includes(q) ||
            d.subscription_number?.toLowerCase().includes(q) ||
            d.order_number?.toLowerCase().includes(q) ||
            d.scheduled_date?.includes(q);

          return matchStatus && matchDeliveryText;
        });

        if (matchedDeliveries.length === 0) return null;
        return {
          ...g,
          deliveries: matchedDeliveries,
          pending_deliveries: matchedDeliveries.length,
          pending_refund_amount: matchedDeliveries.reduce((sum, item) => sum + Number(item.refund_amount || 0), 0),
        };
      })
      .filter(Boolean) as CustomerGroup[];
  }, [groups, searchQuery, filterStatus]);

  // Total selected amount
  const selectedTotalAmount = useMemo(() => {
    let sum = 0;
    allDeliveries.forEach((d) => {
      if (selectedIds.has(d.refund_candidate_id)) {
        sum += Number(d.refund_amount || 0);
      }
    });
    return sum;
  }, [allDeliveries, selectedIds]);

  // ── Calculation Actions ───────────────────────────────────────────────────
  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${API}/subscriptions/refund-candidates/scan?${buildQuery()}`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.status) {
        showToast('success', json.message ?? 'Prepaid refund calculation complete');
        fetchSummary();
        fetchGroups();
      } else {
        showToast('error', json.message ?? 'Calculation failed');
      }
    } catch {
      showToast('error', 'Network error — please try again');
    } finally {
      setScanning(false);
    }
  };

  const handlePreviewScan = async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API}/subscriptions/refund-candidates/scan/preview?${buildQuery()}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.status && json.data) {
        setPreviewData(json.data);
      } else {
        setPreviewData(null);
        showToast('error', json.message || 'Failed to calculate scan preview');
      }
    } catch {
      showToast('error', 'Network error during calculation preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Review & Approval Handlers ────────────────────────────────────────────
  const handleBulkReview = async () => {
    if (!selectedIds.size) return showToast('error', 'Please select at least one delivery');
    setReviewing(true);
    try {
      const res = await fetch(`${API}/subscriptions/refund-candidates/bulk-review`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (json.status) {
        showToast('success', json.message ?? 'Marked as reviewed');
        fetchGroups();
      } else {
        showToast('error', json.message ?? 'Could not mark as reviewed');
      }
    } catch {
      showToast('error', 'Network error — please try again');
    } finally {
      setReviewing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedIds.size) return showToast('error', 'Please select at least one delivery');
    if (!confirm(`Approve and credit wallet with ${fmtAmount(selectedTotalAmount)} for ${selectedIds.size} selected deliveries?`)) {
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`${API}/subscriptions/refund-candidates/bulk-approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (json.status) {
        showToast('success', json.message ?? 'Refunds approved and credited to customer wallets!');
        setSelectedIds(new Set());
        fetchSummary();
        fetchGroups();
      } else {
        showToast('error', json.message ?? 'Failed to approve refunds');
      }
    } catch {
      showToast('error', 'Network error — please try again');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (!selectedIds.size) return showToast('error', 'Please select at least one delivery');
    const notes = prompt(`Reason for rejecting ${selectedIds.size} selected deliveries (optional):`);
    if (notes === null) return;
    setProcessing(true);
    try {
      const res = await fetch(`${API}/subscriptions/refund-candidates/bulk-reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: Array.from(selectedIds), notes }),
      });
      const json = await res.json();
      if (json.status) {
        showToast('success', json.message ?? 'Refunds marked as rejected');
        setSelectedIds(new Set());
        fetchSummary();
        fetchGroups();
      } else {
        showToast('error', json.message ?? 'Failed to reject refunds');
      }
    } catch {
      showToast('error', 'Network error — please try again');
    } finally {
      setProcessing(false);
    }
  };

  const handleSingleApprove = async (candidateId: string, amount: number) => {
    if (!confirm(`Approve and refund ${fmtAmount(amount)} to customer wallet?`)) return;
    setProcessing(true);
    try {
      const res = await fetch(`${API}/subscriptions/refund-candidates/bulk-approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: [candidateId] }),
      });
      const json = await res.json();
      if (json.status) {
        showToast('success', 'Refund approved and credited to wallet');
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(candidateId);
          return next;
        });
        fetchSummary();
        fetchGroups();
      } else {
        showToast('error', json.message ?? 'Failed to approve refund');
      }
    } catch {
      showToast('error', 'Network error — please try again');
    } finally {
      setProcessing(false);
    }
  };

  const handleSingleRejectConfirm = async () => {
    if (!singleRejectTarget) return;
    setProcessing(true);
    try {
      const res = await fetch(`${API}/subscriptions/refund-candidates/bulk-reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: [singleRejectTarget], notes: singleRejectReason }),
      });
      const json = await res.json();
      if (json.status) {
        showToast('success', 'Refund candidate rejected');
        setSingleRejectTarget(null);
        setSingleRejectReason('');
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(singleRejectTarget);
          return next;
        });
        fetchSummary();
        fetchGroups();
      } else {
        showToast('error', json.message ?? 'Failed to reject');
      }
    } catch {
      showToast('error', 'Network error');
    } finally {
      setProcessing(false);
    }
  };

  // Inspect detail modal
  const openDetail = async (candidateId: string) => {
    setDetailLoading(true);
    setDetail({ loading: true });
    try {
      const res = await fetch(`${API}/subscriptions/refund-candidates/detail/${candidateId}`, {
        credentials: 'include',
      });
      const json = await res.json();
      setDetail(json.data ?? null);
    } catch {
      setDetail(null);
      showToast('error', 'Could not load refund audit details');
    } finally {
      setDetailLoading(false);
    }
  };

  // Selection helpers
  const toggleDelivery = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectGroup = (ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allIn = ids.every((id) => next.has(id));
      ids.forEach((id) => (allIn ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const selectAllVisible = () => {
    const allIds = filteredGroups.flatMap((g) => g.deliveries?.map((d) => d.refund_candidate_id) ?? []);
    setSelectedIds(new Set(allIds));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleExportCsv = () => {
    if (!allDeliveries.length) {
      showToast('error', 'No candidate data to export');
      return;
    }
    const headers = ['Candidate ID', 'Customer ID', 'Customer Name', 'Phone', 'Subscription ID', 'Date', 'Slot', 'Product', 'Variant', 'Reason', 'Qty', 'Unit Price', 'Final Price', 'Refund Amount', 'Status'];
    const rows = allDeliveries.map((d) => [
      d.refund_candidate_id,
      d.customer_id,
      `"${d.customer_name || ''}"`,
      d.customer_phone || '',
      d.subscription_id,
      d.scheduled_date,
      d.delivery_slot,
      `"${d.product_name || ''}"`,
      `"${d.variant_name || ''}"`,
      d.source === 'pause' ? 'Pause Day' : 'Failed Delivery',
      d.quantity,
      d.unit_price || 0,
      d.final_price || 0,
      d.refund_amount,
      d.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `subscription_refund_candidates_${filterMonth || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Exported refund candidates CSV');
  };

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6 bg-slate-50/60 min-h-screen font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold transition-all animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600 transition-colors">
          <Home size={13} /> Dashboard
        </Link>
        <ChevronRight size={12} className="text-slate-300" />
        <span className="text-slate-500">Customers &amp; Subscriptions</span>
        <ChevronRight size={12} className="text-slate-300" />
        <span className="font-bold text-slate-800">Prepaid Refund Candidates</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 shadow-xs shrink-0">
            <ArrowRightLeft size={26} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Subscription Prepaid Refunds
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Review and credit wallet refunds for paused subscription days and failed prepaid deliveries.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handlePreviewScan}
            disabled={previewLoading || scanning}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60"
          >
            {previewLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
            Developer: Preview Scan
          </button>

          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60"
          >
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {scanning ? 'Calculating...' : `Run Scan for ${filterMonth || 'Month'}`}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            type="button"
            onClick={() => {
              fetchSummary();
              fetchGroups();
            }}
            title="Refresh"
            className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={groupsLoading || summaryLoading ? 'animate-spin text-emerald-600' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider mb-1">Pending Valuation</p>
          <p className="text-xl font-black text-amber-800">
            {summaryLoading ? <Loader2 size={18} className="animate-spin text-amber-600" /> : fmtAmount(summary?.pending_amount)}
          </p>
          <p className="text-[10px] text-amber-600 font-semibold mt-0.5">{summary?.pending_count ?? 0} deliveries pending</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider mb-1">Pending Customers</p>
          <p className="text-xl font-black text-blue-900">
            {summaryLoading ? <Loader2 size={18} className="animate-spin text-blue-600" /> : (summary?.pending_customers ?? 0)}
          </p>
          <p className="text-[10px] text-blue-600 font-semibold mt-0.5">Awaiting wallet credits</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider mb-1">Total Deliveries</p>
          <p className="text-xl font-black text-purple-900">
            {summaryLoading ? <Loader2 size={18} className="animate-spin text-purple-600" /> : (summary?.pending_count ?? 0)}
          </p>
          <p className="text-[10px] text-purple-600 font-semibold mt-0.5">Paused days &amp; failed orders</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider mb-1">Credited to Wallets</p>
          <p className="text-xl font-black text-emerald-700">
            {summaryLoading ? <Loader2 size={18} className="animate-spin text-emerald-600" /> : fmtAmount(summary?.refunded_amount)}
          </p>
          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">{summary?.refunded_count ?? 0} settled deliveries</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Rejected Candidates</p>
          <p className="text-xl font-black text-slate-700">
            {summaryLoading ? <Loader2 size={18} className="animate-spin text-slate-400" /> : (summary?.rejected_count ?? 0)}
          </p>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Disallowed lines</p>
        </div>
      </div>

      {/* Tabs & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex gap-1.5 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('grouped')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'grouped'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users size={14} />
            Customer Groups ({filteredGroups.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('flat')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'flat'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers size={14} />
            All Candidates Table ({allDeliveries.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payouts')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'payouts'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Receipt size={14} />
            Processed Payouts Ledger
          </button>
        </div>

        {/* Quick selection summary if anything is selected */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 animate-in fade-in">
            <span>{selectedIds.size} deliveries selected ({fmtAmount(selectedTotalAmount)})</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-emerald-600 hover:text-emerald-900 underline text-[11px] cursor-pointer ml-1"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Filter Toolbar (Visible in Candidates tabs) */}
      {activeTab !== 'payouts' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative max-w-md w-full">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Customer, Phone, Sub ID, Order #, Product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Month Picker */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] font-bold text-slate-400">Month:</span>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                />
              </div>

              {/* Source Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] font-bold text-slate-400">Reason:</span>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="">All Sources</option>
                  <option value="pause">Paused Days Only</option>
                  <option value="order">Failed Deliveries Only</option>
                </select>
              </div>

              {/* Branch Filter */}
              {branches.length > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-400">Branch:</span>
                  <select
                    value={filterBranch}
                    onChange={(e) => setFilterBranch(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[130px]"
                  >
                    <option value="">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.branch_id} value={b.branch_id}>
                        {b.branch_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Select All Visible Button */}
              <button
                type="button"
                onClick={selectAllVisible}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Select All ({filteredGroups.reduce((acc, g) => acc + g.deliveries.length, 0)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: GROUPED CUSTOMER ACCORDIONS ── */}
      {activeTab === 'grouped' && (
        <div className="space-y-3">
          {groupsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 text-slate-400 space-y-3">
              <Loader2 size={32} className="animate-spin text-emerald-600" />
              <p className="text-xs font-bold">Loading refund candidate groups...</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-slate-200 text-center p-6 space-y-3">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-3xl">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Pending Refund Candidates</h3>
              <p className="text-xs text-slate-500 max-w-md">
                All paused days and failed deliveries for this period have been approved, or none were detected. Click
                &quot;Run Scan&quot; above to recalculate.
              </p>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <CustomerGroupCard
                key={group.customer_id}
                group={group}
                selectedIds={selectedIds}
                onToggleDelivery={toggleDelivery}
                onToggleGroup={toggleSelectGroup}
                onInspect={openDetail}
                onApproveSingle={handleSingleApprove}
                onRejectSingle={(id) => {
                  setSingleRejectTarget(id);
                  setSingleRejectReason('');
                }}
              />
            ))
          )}
        </div>
      )}

      {/* ── TAB 2: FLAT ALL DELIVERIES TABLE ── */}
      {activeTab === 'flat' && (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allDeliveries.length > 0 && allDeliveries.every((d) => selectedIds.has(d.refund_candidate_id))}
                    onChange={() => {
                      if (allDeliveries.every((d) => selectedIds.has(d.refund_candidate_id))) {
                        clearSelection();
                      } else {
                        selectAllVisible();
                      }
                    }}
                    className="accent-emerald-600 rounded cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Scheduled Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Product / Variant</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-right">Calculation</th>
                <th className="px-4 py-3 text-right">Refund Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {allDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400 font-medium">
                    No candidates found.
                  </td>
                </tr>
              ) : (
                allDeliveries.map((d) => {
                  const isSelected = selectedIds.has(d.refund_candidate_id);
                  const isPause = (d.source ?? d.refund_reason) === 'pause';
                  return (
                    <tr
                      key={d.refund_candidate_id}
                      className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-emerald-50/40' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDelivery(d.refund_candidate_id)}
                          className="accent-emerald-600 rounded cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{fmtDate(d.scheduled_date)}</div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md uppercase ${
                          d.delivery_slot === 'morning' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {d.delivery_slot}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{d.customer_name || 'Customer'}</div>
                        <div className="text-[10px] text-slate-400">{d.customer_phone || d.customer_id}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {d.subscription_number || d.subscription_id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{d.product_name}</div>
                        <div className="text-[10px] text-slate-400">{d.variant_name}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            isPause
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {isPause ? 'PAUSE DAY' : 'FAILED ORDER'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {d.quantity} &times; {fmtAmount(d.final_price || d.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-emerald-700 whitespace-nowrap">
                        {fmtAmount(d.refund_amount)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.status === 'reviewed' ? 'bg-sky-100 text-sky-800' :
                          d.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          d.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {d.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openDetail(d.refund_candidate_id)}
                            title="Inspect calculation audit"
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSingleApprove(d.refund_candidate_id, d.refund_amount)}
                            title="Approve & Credit Wallet"
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSingleRejectTarget(d.refund_candidate_id);
                              setSingleRejectReason('');
                            }}
                            title="Reject Candidate"
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <XCircle size={14} />
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
      )}

      {/* ── TAB 3: PROCESSED PAYOUTS TAB ── */}
      {activeTab === 'payouts' && <PayoutsTab />}

      {/* Floating Sticky Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-3xl shadow-2xl border border-slate-800 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-extrabold text-xs">
              {selectedIds.size} Selected &bull; {fmtAmount(selectedTotalAmount)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleBulkReview}
            disabled={reviewing || processing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {reviewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
            Mark Reviewed
          </button>

          <button
            type="button"
            onClick={handleBulkApprove}
            disabled={processing}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {processing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Approve &amp; Credit Wallet
          </button>

          <button
            type="button"
            onClick={handleBulkReject}
            disabled={processing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            <Ban size={13} />
            Reject
          </button>

          <button
            type="button"
            onClick={clearSelection}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
            title="Deselect All"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Developer Testing: Preview Calculations Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    Developer Testing — Subscription Prepaid Refund Preview
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Simulates refund calculations on paused subscription days and failed deliveries without writing data
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {previewLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-2 text-slate-400">
                <Loader2 size={24} className="animate-spin text-emerald-600" />
                <p className="text-xs font-bold">Calculating refundable paused days &amp; undelivered orders...</p>
              </div>
            ) : previewData ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Analyzed Date Window</span>
                    <p className="font-bold text-slate-800">
                      {previewData.range?.from} &rarr; {previewData.range?.to}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Detected Refund Items</span>
                    <p className="font-black text-slate-900 text-sm">{previewData.rows?.length ?? 0} candidates</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Calculated Total Valuation</span>
                    <p className="font-black text-emerald-700 text-sm">
                      {fmtAmount((previewData.rows || []).reduce((acc: number, r: any) => acc + Number(r.refund_amount || 0), 0))}
                    </p>
                  </div>
                </div>

                {!previewData.rows || previewData.rows.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 font-medium">
                    No paused days or failed deliveries found for the selected filter criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-72">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2.5">Date &amp; Slot</th>
                          <th className="p-2.5">Customer / Sub</th>
                          <th className="p-2.5">Product &amp; Variant</th>
                          <th className="p-2.5">Reason</th>
                          <th className="p-2.5 text-right">Qty</th>
                          <th className="p-2.5 text-right">Subscribed Price</th>
                          <th className="p-2.5 text-right">Refund Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {previewData.rows.map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">
                              {row.scheduled_date} <span className="text-[10px] text-slate-400">({row.slot})</span>
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span className="font-bold text-slate-800">{row.customer_id}</span>
                              <div className="text-[10px] text-slate-400 font-mono">{row.subscription_id}</div>
                            </td>
                            <td className="p-2.5">
                              {row.product_name || 'Product'} {row.variant_name ? `(${row.variant_name})` : ''}
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  row.source === 'pause' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {row.source === 'pause' ? 'Paused Day' : 'Delivery Failed'}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-bold">{row.quantity}</td>
                            <td className="p-2.5 text-right">{fmtAmount(row.final_price || row.unit_price)}</td>
                            <td className="p-2.5 text-right font-black text-emerald-700">
                              {fmtAmount(row.refund_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewOpen(false);
                  handleScan();
                }}
                disabled={scanning}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {scanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Run Live Scan &amp; Materialize Candidates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Audit Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                  <Receipt size={18} />
                </div>
                <h3 className="text-base font-black text-slate-900">Refund Candidate Audit</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-emerald-600" />
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-800">Refund Valuation</span>
                    <p className="text-2xl font-black text-emerald-700">{fmtAmount(detail.refund_amount)}</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-extrabold rounded-full text-[11px]">
                    {String(detail.status || 'PENDING').toUpperCase()}
                  </span>
                </div>

                <dl className="space-y-2.5 divide-y divide-slate-100">
                  {[
                    ['Customer', `${detail.customer_name ?? ''} (${detail.customer_phone ?? detail.customer_id})`],
                    ['Subscription', detail.subscription_number ?? detail.subscription_id],
                    ['Reason', detail.source === 'pause' ? 'Paused Day' : 'Failed Delivery'],
                    ['Scheduled Delivery', `${fmtDate(detail.scheduled_date)} (${detail.delivery_slot || 'morning'})`],
                    ['Product Item', `${detail.product_name ?? ''} ${detail.variant_name ? `(${detail.variant_name})` : ''}`],
                    ['Quantity', detail.quantity ?? 1],
                    ['Subscribed Final Price', fmtAmount(detail.final_price || detail.unit_price)],
                    ['Order Ref', detail.order_number || detail.order_id || '—'],
                    ['Failure Reason', detail.failed_reason || '—'],
                    ['Audit Reviewer', detail.reviewed_by || 'Unreviewed'],
                  ].map(([label, value]) => (
                    <div key={label as string} className="pt-2 flex justify-between gap-4">
                      <dt className="text-slate-400 font-semibold shrink-0">{label}</dt>
                      <dd className="text-slate-800 font-bold text-right break-words">{String(value ?? '—')}</dd>
                    </div>
                  ))}
                </dl>

                {detail.notes && (
                  <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                    <p className="text-[10px] font-bold uppercase text-amber-700">Audit Notes</p>
                    <p className="text-xs text-amber-900 mt-0.5">{detail.notes}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="px-4 py-2 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Reject Modal with Reason */}
      {singleRejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-black text-sm">
              <AlertTriangle size={18} />
              Reject Refund Candidate
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Please enter the reason for rejecting this refund candidate:
            </p>
            <textarea
              rows={3}
              value={singleRejectReason}
              onChange={(e) => setSingleRejectReason(e.target.value)}
              placeholder="e.g. Delivery was confirmed offline by customer"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-rose-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSingleRejectTarget(null)}
                className="px-3 py-1.5 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSingleRejectConfirm}
                disabled={processing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {processing ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Customer Group Card Component ────────────────────────────────────────────

function CustomerGroupCard({
  group,
  selectedIds,
  onToggleDelivery,
  onToggleGroup,
  onInspect,
  onApproveSingle,
  onRejectSingle,
}: {
  group: CustomerGroup;
  selectedIds: Set<string>;
  onToggleDelivery: (id: string) => void;
  onToggleGroup: (ids: string[]) => void;
  onInspect: (id: string) => void;
  onApproveSingle: (id: string, amt: number) => void;
  onRejectSingle: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const deliveries = group.deliveries ?? [];
  const groupIds = deliveries.map((d) => d.refund_candidate_id);
  const allInGroupSelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id));

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all">
      {/* Group Header Card */}
      <div
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50/80 transition-colors"
      >
        <div className="flex items-center gap-3.5">
          <input
            type="checkbox"
            checked={allInGroupSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleGroup(groupIds);
            }}
            onClick={(e) => e.stopPropagation()}
            className="accent-emerald-600 w-4 h-4 rounded cursor-pointer shrink-0"
          />

          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-black text-sm shadow-xs shrink-0">
            {(group.customer_name || 'C')[0].toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-sm">{group.customer_name || 'Customer'}</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                {group.customer_id}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">{group.customer_phone || '—'}</div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 pl-7 sm:pl-0">
          <div className="text-right">
            <div className="font-black text-emerald-700 text-base">{fmtAmount(group.pending_refund_amount)}</div>
            <div className="text-[11px] text-slate-400 font-semibold">{deliveries.length} refundable deliveries</div>
          </div>

          <div className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {/* Expanded Deliveries List */}
      {open && (
        <div className="border-t border-slate-100 p-3 sm:p-4 space-y-2 bg-slate-50/40">
          {deliveries.map((d) => {
            const isSelected = selectedIds.has(d.refund_candidate_id);
            const isPause = (d.source ?? d.refund_reason) === 'pause';
            return (
              <div
                key={d.refund_candidate_id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                  isSelected ? 'bg-emerald-50/70 border-emerald-200 shadow-2xs' : 'bg-white border-slate-200/70 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleDelivery(d.refund_candidate_id)}
                    className="accent-emerald-600 w-4 h-4 rounded cursor-pointer shrink-0"
                  />

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-xs">{fmtDate(d.scheduled_date)}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md uppercase ${
                          d.delivery_slot === 'morning' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {d.delivery_slot}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                          isPause
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {isPause ? 'PAUSE DAY' : 'FAILED ORDER'}
                      </span>
                      {d.status === 'reviewed' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                          REVIEWED
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-medium">
                      <span className="font-bold text-slate-800">{d.product_name}</span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="text-slate-500">{d.variant_name}</span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {d.quantity} &times; {fmtAmount(d.final_price || d.unit_price)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pl-7 sm:pl-0 shrink-0">
                  <span className="font-black text-emerald-700 text-sm">{fmtAmount(d.refund_amount)}</span>

                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onInspect(d.refund_candidate_id)}
                      title="Inspect calculation audit"
                      className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onApproveSingle(d.refund_candidate_id, d.refund_amount)}
                      title="Approve & Credit Wallet"
                      className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <CheckCircle2 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectSingle(d.refund_candidate_id)}
                      title="Reject Candidate"
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <XCircle size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Payouts Tab Component ────────────────────────────────────────────────────

function PayoutsTab() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/subscriptions/refund-candidates/payouts?limit=50`, {
        credentials: 'include',
      });
      const json = await res.json();
      setPayouts(json.data ?? []);
    } catch {
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
        <Loader2 size={32} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!payouts.length) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 text-slate-400 p-6">
        <Receipt size={48} className="mx-auto mb-3 text-slate-300" />
        <p className="font-bold text-slate-700">No Processed Payouts Yet</p>
        <p className="text-xs mt-1 text-slate-500">Payout records are created when candidates are approved and credited to customer wallets.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xs">
      <table className="w-full text-xs text-left">
        <thead className="bg-slate-50/80 text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-100">
          <tr>
            <th className="px-5 py-4">Refund #</th>
            <th className="px-5 py-4">Customer</th>
            <th className="px-5 py-4 text-right">Total Amount</th>
            <th className="px-5 py-4 text-right">Deliveries</th>
            <th className="px-5 py-4 text-center">Status</th>
            <th className="px-5 py-4">Approved At</th>
            <th className="px-5 py-4">Approved By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-medium">
          {payouts.map((p) => (
            <tr key={p.refund_payout_id} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-5 py-4 font-mono text-xs text-slate-700 font-bold">{p.refund_number}</td>
              <td className="px-5 py-4">
                <div className="font-bold text-slate-900">{p.customer_name}</div>
                <div className="text-[10px] text-slate-400">{p.customer_phone}</div>
              </td>
              <td className="px-5 py-4 text-right font-black text-emerald-700 text-sm">{fmtAmount(p.total_amount)}</td>
              <td className="px-5 py-4 text-right text-slate-600 font-bold">{p.total_deliveries}</td>
              <td className="px-5 py-4 text-center">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    p.status === 'processed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : p.status === 'failed'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {p.status.toUpperCase()}
                </span>
              </td>
              <td className="px-5 py-4 text-xs text-slate-500">{fmtDate(p.approved_at)}</td>
              <td className="px-5 py-4 text-xs text-slate-500">{p.approved_by || 'system'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
