'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
  subscription_number: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  pause: 'Paused',
  failed: 'Delivery Failed',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
  stock_out: 'Out of Stock',
};

const REASON_COLORS: Record<string, string> = {
  pause: 'bg-amber-100 text-amber-800',
  failed: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-red-100 text-red-800',
  skipped: 'bg-slate-100 text-slate-700',
  stock_out: 'bg-orange-100 text-orange-800',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtAmount(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ data, loading }: { data: SummaryData | null; loading: boolean }) {
  const cards = [
    {
      label: 'Pending Amount',
      value: data ? fmtAmount(data.pending_amount) : '—',
      icon: IndianRupee,
      color: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
    },
    {
      label: 'Pending Customers',
      value: data?.pending_customers ?? '—',
      icon: Users,
      color: 'from-blue-500 to-indigo-500',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
    },
    {
      label: 'Pending Deliveries',
      value: data?.pending_count ?? '—',
      icon: Package,
      color: 'from-violet-500 to-purple-500',
      bg: 'bg-violet-50',
      text: 'text-violet-700',
    },
    {
      label: 'Refunded Amount',
      value: data ? fmtAmount(data.refunded_amount) : '—',
      icon: Wallet,
      color: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
    },
    {
      label: 'Refunded Deliveries',
      value: data?.refunded_count ?? '—',
      icon: CheckCircle2,
      color: 'from-green-500 to-emerald-500',
      bg: 'bg-green-50',
      text: 'text-green-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className={`${c.bg} rounded-2xl p-4 flex flex-col gap-2 border border-white shadow-sm`}>
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center`}>
              <Icon size={16} className="text-white" />
            </div>
            <div className={`text-xl font-black ${c.text}`}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : c.value}
            </div>
            <div className="text-xs font-semibold text-slate-500">{c.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Delivery Row ─────────────────────────────────────────────────────────────

function DeliveryRow({
  delivery,
  selected,
  onToggle,
  onInspect,
}: {
  delivery: Delivery;
  selected: boolean;
  onToggle: () => void;
  onInspect?: (id: string) => void;
}) {
  // Pause day and failed order are different kinds of money owed — never blur them.
  const isPause = (delivery.source ?? delivery.refund_reason) === 'pause';
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
        selected ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100 hover:bg-slate-50'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="accent-emerald-600 w-4 h-4 rounded"
        id={`chk-${delivery.refund_candidate_id}`}
      />
      <label
        htmlFor={`chk-${delivery.refund_candidate_id}`}
        className="flex-1 flex flex-wrap items-center gap-2 cursor-pointer min-w-0"
      >
        <span className="font-semibold text-slate-800 text-sm">{fmtDate(delivery.scheduled_date)}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
          delivery.delivery_slot === 'morning' ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-100 text-indigo-800'
        }`}>
          {delivery.delivery_slot}
        </span>
        <span
          className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
            isPause
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {isPause ? 'PAUSE DAY' : 'FAILED ORDER'}
        </span>
        <span className="text-xs text-slate-500 truncate">
          {delivery.product_name} · {delivery.variant_name}
        </span>
        <span className="text-[11px] text-slate-400 font-semibold">
          {delivery.quantity} × {fmtAmount(delivery.final_price ?? 0)}
        </span>
        {delivery.order_number && (
          <span className="text-xs font-mono text-slate-400">#{delivery.order_number}</span>
        )}
        {delivery.status === 'reviewed' && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
            REVIEWED
          </span>
        )}
      </label>
      {onInspect && (
        <button
          type="button"
          onClick={() => onInspect(delivery.refund_candidate_id)}
          title="Review calculation"
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
        >
          <Eye size={15} />
        </button>
      )}
      <span className="font-black text-emerald-700 text-sm shrink-0">
        {fmtAmount(delivery.refund_amount)}
      </span>
    </div>
  );
}

// ─── Customer Accordion ───────────────────────────────────────────────────────

function CustomerAccordion({
  group,
  selectedIds,
  onToggleDelivery,
  onSelectAll,
  onInspect,
}: {
  group: CustomerGroup;
  selectedIds: Set<string>;
  onToggleDelivery: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onInspect?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const deliveries = group.deliveries ?? [];
  const allSelected = deliveries.length > 0 && deliveries.every((d) => selectedIds.has(d.refund_candidate_id));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelectAll(deliveries.map((d) => d.refund_candidate_id));
          }}
          className="accent-emerald-600 w-4 h-4"
          onClick={(e) => e.stopPropagation()}
          id={`sel-all-${group.customer_id}`}
        />
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-deep-green to-emerald-600 flex items-center justify-center shrink-0">
          <span className="text-white font-black text-base">{(group.customer_name || 'U')[0].toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-900 text-sm">{group.customer_name}</div>
          <div className="text-xs text-slate-500">{group.customer_phone}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-black text-emerald-700">{fmtAmount(group.pending_refund_amount)}</div>
          <div className="text-xs text-slate-500">{group.pending_deliveries} deliveries</div>
        </div>
        <div className="ml-2 text-slate-400">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Expanded deliveries */}
      {open && (
        <div className="border-t border-slate-100 p-4 space-y-2 bg-slate-50/50">
          {deliveries.map((d) => (
            <DeliveryRow
              key={d.refund_candidate_id}
              delivery={d}
              selected={selectedIds.has(d.refund_candidate_id)}
              onToggle={() => onToggleDelivery(d.refund_candidate_id)}
              onInspect={onInspect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Payouts Tab ──────────────────────────────────────────────────────────────

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={36} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!payouts.length) {
    return (
      <div className="text-center py-20 text-slate-400">
        <Receipt size={48} className="mx-auto mb-3 text-slate-300" />
        <p className="font-semibold">No refund payouts yet.</p>
        <p className="text-xs mt-1">Payouts are created when you approve refund candidates.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-100">
          <tr>
            <th className="px-5 py-4">Refund #</th>
            <th className="px-5 py-4">Customer</th>
            <th className="px-5 py-4 text-right">Amount</th>
            <th className="px-5 py-4 text-right">Deliveries</th>
            <th className="px-5 py-4">Status</th>
            <th className="px-5 py-4">Approved At</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payouts.map((p) => (
            <tr key={p.refund_payout_id} className="hover:bg-slate-50 transition-colors">
              <td className="px-5 py-4 font-mono text-xs text-slate-500">{p.refund_number}</td>
              <td className="px-5 py-4">
                <div className="font-semibold text-slate-800">{p.customer_name}</div>
                <div className="text-xs text-slate-400">{p.customer_phone}</div>
              </td>
              <td className="px-5 py-4 text-right font-black text-emerald-700">{fmtAmount(p.total_amount)}</td>
              <td className="px-5 py-4 text-right text-slate-600 font-semibold">{p.total_deliveries}</td>
              <td className="px-5 py-4">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  p.status === 'processed' ? 'bg-emerald-100 text-emerald-700' :
                  p.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {p.status}
                </span>
              </td>
              <td className="px-5 py-4 text-xs text-slate-500">{fmtDate(p.approved_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RefundCandidatesPage() {
  const [activeTab, setActiveTab] = useState<'candidates' | 'payouts'>('candidates');
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterSubscription, setFilterSubscription] = useState('');
  const [filterSource, setFilterSource] = useState('');

  const [branches, setBranches] = useState<Array<{ branch_id: string; branch_name: string }>>([]);
  const [warehouses, setWarehouses] = useState<Array<{ warehouse_id: string; name: string }>>([]);
  const [scanning, setScanning] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Developer Testing: Scan Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ range: { from: string; to: string }; rows: any[] } | null>(null);

  const handlePreviewScan = async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API}/subscriptions/refund-candidates/scan/preview?${buildQuery()}`, { credentials: 'include' });
      const json = await res.json();
      if (json.status && json.data) {
        setPreviewData(json.data);
      } else {
        setPreviewData(null);
        showToast('error', json.message || 'Failed to fetch scan preview');
      }
    } catch {
      showToast('error', 'Network error during preview calculation');
    } finally {
      setPreviewLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch Summary ─────────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`${API}/subscriptions/refund-candidates/summary`, { credentials: 'include' });
      const json = await res.json();
      setSummary(json.data ?? null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // ── Fetch Customer Groups ─────────────────────────────────────────────────────
  /** Filters shared by the listing and the calculation, so both agree on scope. */
  const buildQuery = useCallback(() => {
    const q = new URLSearchParams();
    // An explicit date range wins over the month picker.
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
    filterMonth, filterDateFrom, filterDateTo, filterCustomer,
    filterBranch, filterWarehouse, filterSubscription, filterSource,
  ]);

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const res = await fetch(
        `${API}/subscriptions/refund-candidates/customer-groups?${buildQuery()}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      setGroups(json.data ?? []);
    } finally {
      setGroupsLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // Branch and warehouse pickers.
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

  // ── Calculate refundable days/orders for the selected scope ──────────────────
  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(
        `${API}/subscriptions/refund-candidates/scan?${buildQuery()}`,
        { method: 'POST', credentials: 'include' },
      );
      const json = await res.json();
      if (json.status) {
        showToast('success', json.message ?? 'Refund calculation complete');
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

  // ── Review (Eligible → Reviewed) ─────────────────────────────────────────────
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

  /** Opens the review drawer with the full calculation basis for one day. */
  const openDetail = async (candidateId: string) => {
    setDetailLoading(true);
    setDetail({ loading: true });
    try {
      const res = await fetch(
        `${API}/subscriptions/refund-candidates/detail/${candidateId}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      setDetail(json.data ?? null);
    } catch {
      setDetail(null);
      showToast('error', 'Could not load refund details');
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Selection Helpers ─────────────────────────────────────────────────────────
  const toggleDelivery = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allIn = ids.every((id) => next.has(id));
      ids.forEach((id) => (allIn ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const selectAll = () => {
    const allIds = groups.flatMap((g) => g.deliveries?.map((d) => d.refund_candidate_id) ?? []);
    setSelectedIds(new Set(allIds));
  };

  const clearAll = () => setSelectedIds(new Set());

  // ── Bulk Approve ──────────────────────────────────────────────────────────────
  const handleBulkApprove = async () => {
    if (!selectedIds.size) return showToast('error', 'Please select at least one delivery');
    if (!confirm(`Approve and refund wallet for ${selectedIds.size} selected deliveries?`)) return;
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
        showToast('success', json.message ?? 'Refunds approved and credited!');
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

  // ── Bulk Reject ───────────────────────────────────────────────────────────────
  const handleBulkReject = async () => {
    if (!selectedIds.size) return showToast('error', 'Please select at least one delivery');
    const notes = prompt(`Reason for rejecting ${selectedIds.size} deliveries (optional):`);
    if (notes === null) return; // cancelled
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
        showToast('success', json.message ?? 'Refunds rejected');
        setSelectedIds(new Set());
        fetchSummary();
        fetchGroups();
      } else {
        showToast('error', json.message ?? 'Failed to reject');
      }
    } catch {
      showToast('error', 'Network error — please try again');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 p-2 md:p-4 bg-[#f9f6ef] min-h-screen font-sans">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold flex items-center gap-2 transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-deep-green tracking-tight flex items-center gap-2">
            <ArrowRightLeft size={26} className="text-emerald-600" />
            Subscription Refund Candidates
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Review paused, failed, and skipped prepaid deliveries. Approve to credit customer wallets.
          </p>
        </div>
        <button
          onClick={() => { fetchSummary(); fetchGroups(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <SummaryCards data={summary} loading={summaryLoading} />

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-2xl p-1 border border-slate-200 w-fit shadow-sm">
        {([['candidates', 'Refund Candidates', Package], ['payouts', 'Refund Payouts', Receipt]] as const).map(([tab, label, Icon]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab
                ? 'bg-deep-green text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Candidates Tab ── */}
      {activeTab === 'candidates' && (
        <div className="space-y-5">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Filter size={16} className="text-slate-400" />
              Filters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1">
                  <CalendarDays size={12} />
                  Month
                </label>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1">
                  <CalendarDays size={12} />
                  From Date
                </label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1">
                  <CalendarDays size={12} />
                  To Date
                </label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-400">Branch</label>
                <select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 transition-colors bg-white"
                >
                  <option value="">All branches</option>
                  {branches.map((b) => (
                    <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-400">Warehouse</label>
                <select
                  value={filterWarehouse}
                  onChange={(e) => setFilterWarehouse(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 transition-colors bg-white"
                >
                  <option value="">All warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-400">Reason</label>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 transition-colors bg-white"
                >
                  <option value="">Pause days + failed orders</option>
                  <option value="pause">Pause days only</option>
                  <option value="order">Failed orders only</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-400">Subscription</label>
                <input
                  type="text"
                  placeholder="Subscription no. or ID…"
                  value={filterSubscription}
                  onChange={(e) => setFilterSubscription(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-400">Customer ID</label>
                <input
                  type="text"
                  placeholder="Search by customer ID…"
                  value={filterCustomer}
                  onChange={(e) => setFilterCustomer(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 transition-colors"
                />
              </div>
            </div>

            {/* Nothing is refundable until it has been calculated — this is that trigger. */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="flex items-center gap-2 px-4 py-2 bg-deep-green hover:bg-emerald-800 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {scanning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {scanning
                    ? 'Calculating…'
                    : `Calculate refunds for ${filterMonth || 'this month'}`}
                </button>

                <button
                  type="button"
                  onClick={handlePreviewScan}
                  disabled={previewLoading || scanning}
                  className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60"
                >
                  {previewLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                  Developer: Preview Calculations
                </button>
              </div>

              <p className="text-xs text-slate-400 font-medium">
                Scans paused days and failed subscription orders. Safe to re-run — existing
                refunds are never duplicated.
              </p>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="sticky top-16 z-30 flex flex-wrap items-center gap-3 bg-deep-green text-white px-5 py-3 rounded-2xl shadow-xl">
              <span className="font-bold text-sm">{selectedIds.size} selected</span>
              <button
                onClick={handleBulkReview}
                disabled={reviewing || processing}
                className="flex items-center gap-2 px-4 py-1.5 bg-white/15 hover:bg-white/25 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60"
              >
                {reviewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                Mark Reviewed
              </button>
              <button
                onClick={handleBulkApprove}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-deep-green font-bold text-sm rounded-xl transition-colors disabled:opacity-60"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Approve & Credit Wallet
              </button>
              <button
                onClick={handleBulkReject}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60"
              >
                <XCircle size={14} />
                Reject Selected
              </button>
              <button onClick={clearAll} className="ml-auto text-white/70 hover:text-white text-xs underline">
                Clear selection
              </button>
            </div>
          )}

          {/* Select All */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-slate-600">
              {groups.length} customer{groups.length !== 1 ? 's' : ''} with pending refunds
            </span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs font-bold text-emerald-700 hover:underline">Select All</button>
              <span className="text-slate-300">|</span>
              <button onClick={clearAll} className="text-xs font-bold text-slate-500 hover:underline">Clear</button>
            </div>
          </div>

          {/* Groups */}
          {groupsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={36} className="animate-spin text-emerald-600" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-2xl border border-slate-100">
              <CheckCircle2 size={52} className="mx-auto mb-3 text-emerald-400" />
              <h3 className="font-black text-slate-700 text-lg">No pending refunds!</h3>
              <p className="text-slate-400 text-sm mt-1">All subscription deliveries are fully settled.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <CustomerAccordion
                  key={g.customer_id}
                  group={g}
                  selectedIds={selectedIds}
                  onToggleDelivery={toggleDelivery}
                  onSelectAll={toggleSelectAll}
                  onInspect={openDetail}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Payouts Tab ── */}
      {activeTab === 'payouts' && <PayoutsTab />}

      {/* ── Review Drawer: how this amount was arrived at ── */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-emerald-600" />
                <h3 className="font-black text-slate-800 text-sm">Refund Review</h3>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <XCircle size={18} />
              </button>
            </div>

            {detailLoading || detail.loading ? (
              <div className="p-10 flex justify-center">
                <Loader2 size={22} className="animate-spin text-emerald-600" />
              </div>
            ) : (
              <div className="p-5 space-y-5">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                    Refundable amount
                  </p>
                  <p className="text-3xl font-black text-emerald-800 mt-1">
                    {fmtAmount(detail.refund_amount)}
                  </p>
                  <p className="text-xs text-emerald-700/80 mt-1 font-semibold">
                    {detail.quantity} × {fmtAmount(detail.final_price)} (prepaid price)
                  </p>
                  {Number(detail.recomputed_amount) !== Number(detail.refund_amount) && (
                    <p className="text-xs font-bold text-rose-700 mt-2">
                      Stored amount differs from quantity × price — verify before approving.
                    </p>
                  )}
                </div>

                <dl className="space-y-2 text-sm">
                  {[
                    ['Status', String(detail.status ?? '').toUpperCase()],
                    ['Reason', detail.source === 'pause' ? 'Pause Day' : 'Failed Order'],
                    ['Customer', `${detail.customer_name ?? ''} · ${detail.customer_phone ?? ''}`],
                    ['Subscription', detail.subscription_number ?? detail.subscription_id],
                    ['Payment type', detail.payment_type],
                    ['Branch', detail.branch_name ?? detail.branch_id],
                    ['Date', `${fmtDate(detail.scheduled_date)} · ${detail.delivery_slot}`],
                    ['Product', `${detail.product_name ?? ''} ${detail.variant_name ?? ''}`],
                    ['Order', detail.order_number ?? '—'],
                    ['Order status', detail.order_status ?? '—'],
                    ['Stop status', detail.stop_status ?? '—'],
                    ['Failure reason', detail.failed_reason ?? '—'],
                    ['Item unit price', fmtAmount(detail.item_unit_price ?? 0)],
                    ['Discount applied', fmtAmount(detail.discount_amount ?? 0)],
                    ['Coupon applied', fmtAmount(detail.coupon_amount ?? 0)],
                    ['Reviewed by', detail.reviewed_by ?? '—'],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between gap-4">
                      <dt className="text-slate-400 font-semibold shrink-0">{label}</dt>
                      <dd className="text-slate-800 font-bold text-right break-words">
                        {String(value ?? '—')}
                      </dd>
                    </div>
                  ))}
                </dl>

                {detail.notes && (
                  <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                    <p className="text-[10px] font-black uppercase text-amber-700">Notes</p>
                    <p className="text-xs text-amber-900 mt-1">{detail.notes}</p>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Amounts use the price stored on the subscription item at purchase time, so
                  later catalogue price changes never affect a refund.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Developer Testing: Preview Calculations Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                  <Receipt size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    Developer Testing — Subscription Prepaid Refund Preview
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Simulates refund calculation on paused days and failed deliveries without writing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>

            {previewLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-2 text-slate-400">
                <Loader2 size={24} className="animate-spin text-emerald-600" />
                <p className="text-xs font-bold">Calculating refundable days &amp; failed orders...</p>
              </div>
            ) : previewData ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Analyzed Window</span>
                    <p className="font-bold text-slate-800">{previewData.range?.from} to {previewData.range?.to}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Detected Refund Candidates</span>
                    <p className="font-black text-slate-900 text-sm">{previewData.rows?.length ?? 0} items</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Total Estimated Valuation</span>
                    <p className="font-black text-emerald-700 text-sm">
                      {fmtAmount((previewData.rows || []).reduce((acc: number, r: any) => acc + Number(r.refund_amount || 0), 0))}
                    </p>
                  </div>
                </div>

                {(!previewData.rows || previewData.rows.length === 0) ? (
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
                          <th className="p-2.5 text-right">Final Price</th>
                          <th className="p-2.5 text-right">Refund Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData.rows.map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 font-medium text-slate-700">
                            <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">
                              {row.scheduled_date} <span className="text-[10px] text-slate-400">({row.slot})</span>
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span className="font-bold text-slate-800">{row.customer_id}</span>
                              <div className="text-[10px] text-slate-400">{row.subscription_id}</div>
                            </td>
                            <td className="p-2.5">
                              {row.product_name || 'Product'} {row.variant_name ? `(${row.variant_name})` : ''}
                            </td>
                            <td className="p-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                row.source === 'pause' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {row.source === 'pause' ? 'Paused Day' : 'Delivery Failed'}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-bold">{row.quantity}</td>
                            <td className="p-2.5 text-right">{fmtAmount(row.final_price || row.unit_price)}</td>
                            <td className="p-2.5 text-right font-bold text-emerald-700">{fmtAmount(row.refund_amount)}</td>
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
                Run Live Calculation &amp; Save Candidates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
