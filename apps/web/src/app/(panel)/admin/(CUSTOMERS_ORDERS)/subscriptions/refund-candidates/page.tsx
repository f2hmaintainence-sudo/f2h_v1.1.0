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
  refund_amount: number;
  refund_reason: string;
  product_name: string;
  variant_name: string;
  order_number?: string;
  status: string;
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
}: {
  delivery: Delivery;
  selected: boolean;
  onToggle: () => void;
}) {
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
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${REASON_COLORS[delivery.refund_reason] ?? 'bg-slate-100'}`}>
          {REASON_LABELS[delivery.refund_reason] ?? delivery.refund_reason}
        </span>
        <span className="text-xs text-slate-500 truncate">
          {delivery.product_name} · {delivery.variant_name}
        </span>
        {delivery.order_number && (
          <span className="text-xs font-mono text-slate-400">#{delivery.order_number}</span>
        )}
      </label>
      <span className="font-black text-emerald-700 text-sm ml-auto shrink-0">
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
}: {
  group: CustomerGroup;
  selectedIds: Set<string>;
  onToggleDelivery: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
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
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');

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
  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    const q = new URLSearchParams();
    if (filterDateFrom) q.set('date_from', filterDateFrom);
    if (filterDateTo) q.set('date_to', filterDateTo);
    if (filterCustomer) q.set('customer_id', filterCustomer);
    try {
      const res = await fetch(`${API}/subscriptions/refund-candidates/customer-groups?${q}`, { credentials: 'include' });
      const json = await res.json();
      setGroups(json.data ?? []);
    } finally {
      setGroupsLoading(false);
    }
  }, [filterDateFrom, filterDateTo, filterCustomer]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchGroups(); }, [fetchGroups]);

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="sticky top-16 z-30 flex flex-wrap items-center gap-3 bg-deep-green text-white px-5 py-3 rounded-2xl shadow-xl">
              <span className="font-bold text-sm">{selectedIds.size} selected</span>
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
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Payouts Tab ── */}
      {activeTab === 'payouts' && <PayoutsTab />}
    </div>
  );
}
