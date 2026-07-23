'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/services/api.client';
import { showErrorToast } from '@/components/Toast';
import {
  History, CheckCircle2, SkipForward, Clock,
  ChevronDown, ChevronUp, MapPin, Phone,
  RefreshCw, Package, Search, Filter, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoryRow {
  schedule_id: number;
  delivery_slot: 'morning' | 'evening';
  quantity: number;
  price: number;
  delivery_status: string;
  delivery_date: string;
  order_id: string;
  order_type: string;
  customer_id: string;
  area: string | null;
  city: string | null;
  first_name: string;
  last_name: string;
  customer_phone: string;
  product_name: string;
  unit_type: string;
  zone_name: string;
}

type StatusFilter = 'all' | 'delivered' | 'skipped' | 'scheduled';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  scheduled:  { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400',  label: 'Pending'   },
  delivered:  { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500',  label: 'Delivered' },
  skipped:    { bg: 'bg-gray-50',   text: 'text-gray-500',   dot: 'bg-gray-400',   label: 'Skipped'   },
  paused:     { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-400',   label: 'Paused'    },
  cancelled:  { bg: 'bg-red-50',    text: 'text-red-500',    dot: 'bg-red-400',    label: 'Cancelled' },
};

function statusStyle(s: string) {
  return STATUS_STYLE[s] ?? { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400', label: s };
}

function fullName(r: HistoryRow) {
  return [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Customer';
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

// ─── Row card ────────────────────────────────────────────────────────────────

function HistoryCard({ row }: { row: HistoryRow }) {
  const [open, setOpen] = useState(false);
  const st = statusStyle(row.delivery_status);
  const place = [row.area, row.city].filter(Boolean).join(', ') || '—';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setOpen(v => !v)}
      >
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-900 text-sm truncate">{fullName(row)}</p>
            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
              {st.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {row.product_name} &times; {row.quantity} {row.unit_type}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[11px] text-gray-400">{fmtDate(row.delivery_date)}</span>
            <span className="text-[11px] text-gray-400 capitalize">{row.delivery_slot}</span>
            <span className="text-xs font-semibold text-deep-green">₹{Number(row.price).toFixed(0)}</span>
          </div>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400 mt-1 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 mt-1 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Phone</p>
              <a href={`tel:${row.customer_phone}`} className="font-medium text-sky-600 flex items-center gap-1 text-xs">
                <Phone size={10} /> {row.customer_phone || '—'}
              </a>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Zone</p>
              <p className="font-medium text-gray-800 text-xs">{row.zone_name}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Area</p>
              <p className="font-medium text-gray-800 text-xs flex items-center gap-1">
                <MapPin size={10} /> {place}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Order</p>
              <p className="font-medium text-gray-500 text-xs">{row.order_id}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Group by date ───────────────────────────────────────────────────────────

function DateGroup({ date, rows }: { date: string; rows: HistoryRow[] }) {
  const delivered = rows.filter(r => r.delivery_status === 'delivered').length;
  const total = rows.length;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between sticky top-[56px] z-10 bg-gray-50/90 backdrop-blur-sm py-2">
        <span className="text-xs font-bold text-gray-700">{fmtDate(date)}</span>
        <span className="text-[11px] text-gray-400">{delivered}/{total} delivered</span>
      </div>
      {rows.map(row => (
        <HistoryCard key={row.schedule_id} row={row} />
      ))}
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function DeliveryHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchHistory = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));

      const qs = params.toString();
      const { data, error } = await api.get<{ data: HistoryRow[]; total: number }>(
        `/f2h/orders/my-history${qs ? `?${qs}` : ''}`,
      );
      if (error) { if (!silent) showErrorToast('Failed to load history'); return; }
      setRows(data?.data || []);
      setTotal(data?.total || 0);
    } catch {
      if (!silent) showErrorToast('Failed to load history');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [startDate, endDate, statusFilter, page]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Quick date presets
  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(isoDate(start));
    setEndDate(isoDate(end));
    setPage(0);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setStatusFilter('all');
    setSearch('');
    setPage(0);
  };

  // Client-side search (within loaded page)
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      fullName(r).toLowerCase().includes(q) ||
      r.product_name.toLowerCase().includes(q) ||
      (r.area || '').toLowerCase().includes(q) ||
      (r.city || '').toLowerCase().includes(q) ||
      r.zone_name.toLowerCase().includes(q) ||
      r.order_id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  // Group by delivery_date
  const grouped = useMemo(() => {
    const map = new Map<string, HistoryRow[]>();
    for (const row of filtered) {
      const key = row.delivery_date?.split('T')[0] ?? 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasActive = startDate || endDate || statusFilter !== 'all';

  // ─── Skeleton ──────────────
  if (loading) {
    return (
      <div className="space-y-4 pb-8">
        <div className="h-16 bg-white rounded-2xl animate-pulse" />
        <div className="h-12 bg-white rounded-2xl animate-pulse" />
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
              <History size={18} className="text-deep-green" />
              Delivery History
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {total} total records
              {hasActive && <span className="text-deep-green font-semibold"> (filtered)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`p-2 rounded-xl border transition-colors ${showFilters ? 'bg-deep-green text-white border-deep-green' : 'border-gray-200 active:bg-gray-50'}`}
            >
              <Filter size={14} />
            </button>
            <button onClick={() => fetchHistory()} className="p-2 rounded-xl border border-gray-200 active:bg-gray-50">
              <RefreshCw size={14} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          {/* Date presets */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Quick Range</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {[
                { label: 'Last 7 days', days: 7 },
                { label: 'Last 14 days', days: 14 },
                { label: 'Last 30 days', days: 30 },
                { label: 'Last 90 days', days: 90 },
              ].map(p => (
                <button
                  key={p.days}
                  onClick={() => setPreset(p.days)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 active:bg-gray-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide">From</label>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setPage(0); }}
                className="w-full mt-1 px-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-deep-green/40"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide">To</label>
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setPage(0); }}
                className="w-full mt-1 px-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-deep-green/40"
              />
            </div>
          </div>

          {/* Status filter */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Status</p>
            <div className="flex gap-2">
              {([
                { v: 'all', l: 'All', icon: null },
                { v: 'delivered', l: 'Delivered', icon: CheckCircle2 },
                { v: 'skipped', l: 'Skipped', icon: SkipForward },
                { v: 'scheduled', l: 'Pending', icon: Clock },
              ] as const).map(({ v, l, icon: Icon }) => (
                <button
                  key={v}
                  onClick={() => { setStatusFilter(v); setPage(0); }}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-semibold border transition-colors
                    ${statusFilter === v ? 'bg-deep-green text-white border-deep-green' : 'bg-white text-gray-600 border-gray-200'}
                  `}
                >
                  {Icon && <Icon size={11} />}
                  {l}
                </button>
              ))}
            </div>
          </div>

          {hasActive && (
            <button
              onClick={clearFilters}
              className="w-full text-xs text-gray-500 font-medium py-2 border-t border-gray-100 mt-1"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* ── Search bar ── */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Search name, product, area, order..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:border-deep-green/40 bg-white"
        />
      </div>

      {/* ── Results ── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Package size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 font-medium">No delivery records found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or date range</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, dateRows]) => (
            <DateGroup key={date} date={date} rows={dateRows} />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 disabled:opacity-40"
          >
            <ChevronLeft size={12} /> Prev
          </button>
          <span className="text-xs text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 disabled:opacity-40"
          >
            Next <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
