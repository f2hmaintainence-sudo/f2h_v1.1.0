// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : OrdersTable.tsx
// Description : Minimal custom orders table — 6 cols, timeline, pagination
//
// ============================================================================

'use client';

import { getApiBaseUrl } from '@/lib/api-config';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  Bike,
  XCircle,
  AlertCircle,
  Camera,
  ExternalLink,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';

const API_URL = getApiBaseUrl();

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrdersTableProps {
  endpoint: string;
  onViewOrder: (row: Record<string, any>) => void;
  tableKey?: number;
  activeStatusFilter?: string | null;
  searchQuery?: string;
  slotFilter?: string;
}

// ─── Order Status Pipeline ─────────────────────────────────────────────────

const PIPELINE: { key: string; label: string; color: string; dotColor: string }[] = [
  { key: 'PLACED',           label: 'Placed',           color: 'bg-sky-400',     dotColor: 'bg-sky-500' },
  { key: 'CONFIRMED',        label: 'Confirmed',        color: 'bg-teal-400',    dotColor: 'bg-teal-500' },
  { key: 'ASSIGNED',         label: 'Assigned',         color: 'bg-indigo-400',  dotColor: 'bg-indigo-500' },
  { key: 'PACKED',           label: 'Packed',           color: 'bg-purple-400',  dotColor: 'bg-purple-500' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', color: 'bg-blue-500',    dotColor: 'bg-blue-600' },
  { key: 'DELIVERED',        label: 'Delivered',        color: 'bg-emerald-500', dotColor: 'bg-emerald-600' },
];

const TERMINAL: Record<string, { label: string; color: string; textColor: string }> = {
  CANCELLED: { label: 'Cancelled', color: 'bg-rose-100',  textColor: 'text-rose-700' },
  FAILED:    { label: 'Failed',    color: 'bg-amber-100', textColor: 'text-amber-700' },
};

function stripHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/<[^>]*>/g, '').trim();
}

function normalizeStatus(raw: unknown): string {
  const s = stripHtml(raw).toLowerCase().replace(/[\s_-]+/g, '_');
  if (s.includes('out_for_delivery') || s.includes('outfordelivery') || s.includes('dispatch')) return 'OUT_FOR_DELIVERY';
  if (s.includes('deliver')) return 'DELIVERED';
  if (s.includes('pack'))    return 'PACKED';
  if (s.includes('assign'))  return 'ASSIGNED';
  if (s.includes('confirm')) return 'CONFIRMED';
  if (s.includes('cancel'))  return 'CANCELLED';
  if (s.includes('fail'))    return 'FAILED';
  if (s.includes('place'))   return 'PLACED';
  return s.toUpperCase();
}

function formatMoney(value: unknown) {
  const n = Number(value ?? 0);
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

// ─── Tooltip Portal ─────────────────────────────────────────────────────────

function TooltipPortal({ x, y, step, isCurrent, isDone, pipelineLength, idx }: {
  x: number; y: number;
  step: { key: string; label: string; color: string; dotColor: string };
  isCurrent: boolean; isDone: boolean;
  pipelineLength: number; idx: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left: x, top: y, transform: 'translate(-50%, 8px)' }}
    >
      {/* Arrow */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[5px] border-l-transparent border-r-transparent border-b-white drop-shadow-sm" />
      <div className="w-44 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 p-2.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            Step {idx + 1} / {pipelineLength}
          </span>
          {isCurrent ? (
            <span className="text-[8px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">ACTIVE</span>
          ) : isDone ? (
            <span className="text-[9px] font-bold text-emerald-600">✓ Done</span>
          ) : (
            <span className="text-[9px] font-medium text-slate-400">Pending</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md ${isDone ? step.dotColor : 'bg-slate-100'}`}>
            <CheckCircle2 size={10} className={isDone ? 'text-white' : 'text-slate-400'} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-900 leading-tight">{step.label}</p>
            <p className="text-[9px] text-slate-500 mt-0.5">
              {isCurrent ? 'Currently here' : isDone ? 'Completed' : 'Not yet reached'}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Status Timeline Cell ──────────────────────────────────────────────────

function StatusTimeline({ status }: { status: string }) {
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number } | null>(null);

  const terminalInfo = TERMINAL[status];

  if (terminalInfo) {
    return (
      <div className="flex items-center gap-1 py-0.5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${terminalInfo.color} ${terminalInfo.textColor} border border-current/20`}>
          {status === 'CANCELLED' ? <XCircle size={10} /> : <AlertCircle size={10} />}
          <span>{terminalInfo.label}</span>
        </span>
      </div>
    );
  }

  const currentIdx = PIPELINE.findIndex((s) => s.key === status);
  const effectiveIdx = currentIdx === -1 ? 0 : currentIdx;

  return (
    <div className="relative flex items-center gap-0.5 w-full min-w-[110px] max-w-[130px] py-0.5">
      {PIPELINE.map((step, idx) => {
        const isDone    = idx <= effectiveIdx;
        const isCurrent = idx === effectiveIdx;
        const isLast    = idx === PIPELINE.length - 1;

        return (
          <React.Fragment key={step.key}>
            {/* Step Node */}
            <div
              className="relative flex items-center justify-center cursor-pointer"
              onMouseEnter={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setTooltip({ idx, x: rect.left + rect.width / 2, y: rect.bottom });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Outer pulsing aura for current step */}
              {isCurrent && (
                <span className="absolute -inset-0.5 rounded-full bg-emerald-400/40 animate-ping pointer-events-none" />
              )}

              {/* Dot Circle */}
              <div
                className={`relative z-10 w-2 h-2 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCurrent
                    ? `${step.dotColor} ring-1 ring-emerald-500 ring-offset-1 scale-110`
                    : isDone
                    ? `${step.dotColor}`
                    : 'bg-slate-200 border border-slate-300'
                }`}
              >
                {isDone && (
                  <svg className="w-1.5 h-1.5 stroke-white stroke-[3]" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>

              {/* Tooltip (portal) */}
              {tooltip?.idx === idx && (
                <TooltipPortal
                  x={tooltip.x}
                  y={tooltip.y}
                  step={step}
                  isCurrent={isCurrent}
                  isDone={isDone}
                  pipelineLength={PIPELINE.length}
                  idx={idx}
                />
              )}
            </div>

            {/* Connecting bar */}
            {!isLast && (
              <div className="flex-1 h-px mx-0.5 rounded-full overflow-hidden bg-slate-200">
                <div
                  className={`h-full transition-all duration-500 ${
                    idx < effectiveIdx
                      ? `${step.color}`
                      : 'bg-transparent'
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    PLACED:           { label: 'Placed',           cls: 'bg-sky-50 text-sky-800 border-sky-200',           Icon: Clock },
    CONFIRMED:        { label: 'Confirmed',        cls: 'bg-teal-50 text-teal-800 border-teal-200',        Icon: CheckCircle2 },
    ASSIGNED:         { label: 'Assigned',         cls: 'bg-indigo-50 text-indigo-800 border-indigo-200',  Icon: Clock },
    PACKED:           { label: 'Packed',           cls: 'bg-purple-50 text-purple-800 border-purple-200',  Icon: Package },
    OUT_FOR_DELIVERY: { label: 'Out for Delivery', cls: 'bg-blue-50 text-blue-800 border-blue-200',        Icon: Truck },
    DELIVERED:        { label: 'Delivered',        cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
    CANCELLED:        { label: 'Cancelled',        cls: 'bg-rose-50 text-rose-800 border-rose-200',        Icon: XCircle },
    FAILED:           { label: 'Failed',           cls: 'bg-amber-50 text-amber-800 border-amber-200',     Icon: AlertCircle },
  };
  const cfg = configs[status] ?? { label: status, cls: 'bg-gray-50 text-gray-700 border-gray-200', Icon: Clock };
  const { label, cls, Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${cls} mt-1`}>
      <Icon size={10} />
      {label}
    </span>
  );
}

// ─── Slot Badge ────────────────────────────────────────────────────────────

function SlotBadge({ slot }: { slot: string }) {
  const s = slot.toLowerCase();
  if (s.includes('morning')) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">☀ Morning</span>;
  }
  if (s.includes('evening')) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">🌙 Evening</span>;
  }
  return <span className="text-[11px] text-gray-500 font-medium">{slot || '—'}</span>;
}

// ─── Payment Status Badge ──────────────────────────────────────────────────

export function PaymentStatusBadge({
  paymentStatus,
  paymentMode,
}: {
  paymentStatus: unknown;
  paymentMode?: unknown;
}) {
  const rawStatus = stripHtml(paymentStatus).toLowerCase().trim();
  const rawMode   = stripHtml(paymentMode).toUpperCase().trim();

  const isPaid     = rawStatus === 'paid';
  const isFailed   = rawStatus === 'failed';
  const isRefunded = rawStatus === 'refunded';

  let label = 'Unpaid';
  let badgeCls = 'bg-amber-50 text-amber-700 border-amber-200/90';
  let dotCls = 'bg-amber-500';

  if (isPaid) {
    label = 'Paid';
    badgeCls = 'bg-emerald-50 text-emerald-700 border-emerald-200/90';
    dotCls = 'bg-emerald-500';
  } else if (isFailed) {
    label = 'Failed';
    badgeCls = 'bg-rose-50 text-rose-700 border-rose-200/90';
    dotCls = 'bg-rose-500';
  } else if (isRefunded) {
    label = 'Refunded';
    badgeCls = 'bg-purple-50 text-purple-700 border-purple-200/90';
    dotCls = 'bg-purple-500';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 w-fit px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeCls} transition-colors tracking-tight`}
      title={rawMode ? `Payment: ${label} (${rawMode})` : `Payment: ${label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
      <span>{label}</span>
      {rawMode && (
        <span className="opacity-70 font-medium text-[9px] uppercase tracking-normal">
          • {rawMode}
        </span>
      )}
    </span>
  );
}

// ─── Delivery Image Helpers & Preview ──────────────────────────────────────

export function getDeliveryImageUrl(path?: string | null): string | null {
  if (!path) return null;
  const trimmed = String(path).trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '—' || trimmed === '-') return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function ImagePreviewModal({
  isOpen,
  imageUrl,
  title,
  onClose,
}: {
  isOpen: boolean;
  imageUrl: string | null;
  title?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs">
              <Camera size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm leading-tight">{title || 'Proof of Delivery Photo'}</h3>
              <p className="text-[10px] text-slate-500 font-medium">Uploaded by delivery partner on completion</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors inline-flex items-center gap-1 border border-emerald-200"
            >
              Open Original <ExternalLink size={11} />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-4 bg-slate-950 flex items-center justify-center min-h-[300px] max-h-[75vh] overflow-hidden">
          <img
            src={imageUrl}
            alt="Delivery Proof Full"
            className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-slate-800"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

export function DeliveryProofCell({
  imageUrl,
  orderId,
  onPreview,
}: {
  imageUrl?: string | null;
  orderId?: string;
  onPreview: (url: string, title?: string) => void;
}) {
  const url = getDeliveryImageUrl(imageUrl);
  if (!url) {
    return <span className="text-[11px] text-slate-300 font-medium select-none">—</span>;
  }

  return (
    <div className="inline-flex items-center justify-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview(url, `Delivery Proof — #${orderId || ''}`);
        }}
        className="group relative block w-9 h-9 rounded-lg overflow-hidden border border-emerald-200 bg-slate-100 hover:border-emerald-500 hover:ring-2 hover:ring-emerald-400/20 hover:shadow-xs transition-all shrink-0 cursor-pointer"
        title="Click to preview delivery photo"
      >
        <img
          src={url}
          alt="Delivery Proof"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
            if (e.currentTarget.parentElement) {
              const fallback = e.currentTarget.parentElement.querySelector('.proof-fallback');
              if (fallback) (fallback as HTMLElement).style.display = 'flex';
            }
          }}
        />
        <div className="proof-fallback hidden absolute inset-0 bg-emerald-50 items-center justify-center text-emerald-600">
          <Camera size={14} />
        </div>
        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
          <Eye size={12} />
        </div>
      </button>
    </div>
  );
}

// ─── Main Table Component ─────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function OrdersTable({
  endpoint,
  onViewOrder,
  tableKey = 0,
  activeStatusFilter,
  searchQuery = '',
  slotFilter = 'all',
}: OrdersTableProps) {
  const [rows, setRows]             = useState<Record<string, any>[]>([]);
  const [previewImage, setPreviewImage] = useState<{ url: string; title?: string } | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage]             = useState(1);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchOrders = useCallback(async (pg: number) => {
    setLoading(true);
    setError('');
    try {
      const sep = endpoint.includes('?') ? '&' : '?';
      const url = `${API_URL}${endpoint}${sep}page=${pg}&limit=${PAGE_SIZE}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      let data: Record<string, any>[] = [];
      let count = 0;

      if (result && Array.isArray(result.data)) {
        data = result.data;
        count = Number(result.recordsFiltered ?? result.recordsTotal ?? result.total ?? result.count ?? data.length);
      } else if (result && Array.isArray(result.rows)) {
        data = result.rows;
        count = Number(result.recordsFiltered ?? result.recordsTotal ?? result.total ?? result.count ?? data.length);
      } else if (Array.isArray(result)) {
        data = result;
        count = data.length;
      }

      setRows(data);
      setTotalCount(count);
    } catch (e: any) {
      setError(e.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  // Reset page on filter/endpoint change
  useEffect(() => {
    setPage(1);
  }, [endpoint, tableKey, activeStatusFilter, searchQuery, slotFilter]);

  useEffect(() => {
    fetchOrders(page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, endpoint, tableKey]);

  // Client-side filtering
  const filtered = useMemo(() => {
    return rows.filter((order) => {
      if (activeStatusFilter) {
        if (normalizeStatus(order.order_status || order.status) !== activeStatusFilter) return false;
      }
      if (searchQuery.trim()) {
        const q     = searchQuery.toLowerCase();
        const oId   = stripHtml(order.order_id   || order.id              || '').toLowerCase();
        const cName = stripHtml(order.customer_name || order.customer_id  || '').toLowerCase();
        const phone = stripHtml(order.customer_phone || order.phone       || order.contact_number || '').toLowerCase();
        const area  = stripHtml(order.area || order.pincode || order.delivery_address || '').toLowerCase();
        if (!oId.includes(q) && !cName.includes(q) && !phone.includes(q) && !area.includes(q)) return false;
      }
      if (slotFilter !== 'all') {
        const slotStr = stripHtml(order.delivery_slot || order.slot || '').toLowerCase();
        if (slotFilter === 'morning' && !slotStr.includes('morning')) return false;
        if (slotFilter === 'evening' && !slotStr.includes('evening')) return false;
      }
      return true;
    });
  }, [rows, activeStatusFilter, searchQuery, slotFilter]);

  // ── Loading skeleton ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Order ID', 'Customer', 'Delivery Partner', 'Amount', 'Slot', 'Status Timeline', 'Proof', 'Action'].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {[80, 110, 110, 60, 70, 160, 36, 60].map((w, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div className="h-3.5 bg-gray-100 rounded animate-pulse" style={{ width: w }} />
                      {j === 3 && <div className="mt-1 h-2.5 bg-gray-100 rounded animate-pulse" style={{ width: 45 }} />}
                      {j === 5 && <div className="mt-1.5 h-2 bg-gray-100 rounded animate-pulse" style={{ width: 100 }} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-white rounded-xl border border-rose-200 gap-3">
        <AlertCircle size={30} className="text-rose-400" />
        <p className="text-sm font-semibold text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => fetchOrders(page)}
          className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition-colors"
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-14 bg-white rounded-xl border border-dashed border-gray-200 gap-3">
        <Package size={38} className="text-gray-300" />
        <p className="text-sm font-semibold text-gray-500">No orders found matching your filters.</p>
        <button
          type="button"
          onClick={() => fetchOrders(page)}
          className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg border border-gray-200 transition-colors"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
    );
  }

  // ── Table ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50/90 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">Order ID</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">Customer</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">Delivery Partner</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">Amount</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">Slot</th>
              <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500" style={{ width: 160 }}>Status Timeline</th>
              <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 text-center whitespace-nowrap">Proof</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 text-center whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((order, idx) => {
              const orderId      = stripHtml(order.order_id || order.id || '—');
              const customerName = stripHtml(order.customer_name || order.customer_id || 'Guest');
              const phone        = stripHtml(order.customer_phone || order.phone || order.contact_number || '');
              const partnerFirstName = stripHtml(order.partner_first_name || '');
              const partnerLastName  = stripHtml(order.partner_last_name || '');
              const combinedName     = `${partnerFirstName} ${partnerLastName}`.trim();
              const rawPartnerName   = stripHtml(order.partner_name || order.delivery_partner_name || combinedName || '');
              const partnerId        = stripHtml(order.delivery_partner_id || '');
              const partnerPhone     = stripHtml(order.partner_phone || order.delivery_partner_phone || '');
              const partnerDisplayName = rawPartnerName || (partnerId ? `Partner (${partnerId})` : '');
              const amount       = formatMoney(order.total_amount || order.amount || order.subtotal);
              const slot         = stripHtml(order.delivery_slot || order.slot || '');
              const statusRaw    = normalizeStatus(order.order_status || order.status);

              return (
                <tr key={orderId + idx} className="hover:bg-emerald-50/30 transition-colors duration-150 group">
                  {/* Order ID */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[11px] font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                        #{orderId.length > 16 ? `${orderId.slice(0, 16)}…` : orderId}
                      </span>
                      {order.created_at && (
                        <span className="text-[10px] text-gray-400 font-medium">
                          {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="px-4 py-3 whitespace-nowrap max-w-[140px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-slate-800 truncate block" title={customerName}>{customerName}</span>
                      {phone && <span className="text-[10px] text-gray-400 font-medium">{phone}</span>}
                    </div>
                  </td>

                  {/* Delivery Partner */}
                  <td className="px-4 py-3 whitespace-nowrap max-w-[140px]">
                    {partnerDisplayName ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-[10px] shrink-0 font-bold">
                            <Bike size={11} />
                          </div>
                          <span className="font-bold text-slate-800 text-xs truncate max-w-[120px]" title={partnerDisplayName}>
                            {partnerDisplayName}
                          </span>
                        </div>
                        {partnerPhone && (
                          <span className="text-[10px] text-gray-500 font-mono pl-6">
                            {partnerPhone}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                        Unassigned
                      </span>
                    )}
                  </td>

                  {/* Amount & Payment Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      <span className="font-bold text-slate-800 text-sm leading-tight">{amount}</span>
                      <PaymentStatusBadge
                        paymentStatus={order.payment_status}
                        paymentMode={order.payment_mode}
                      />
                    </div>
                  </td>

                  {/* Slot */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <SlotBadge slot={slot} />
                  </td>

                  {/* Timeline */}
                  <td className="px-3 py-2" style={{ minWidth: 160, maxWidth: 180 }}>
                    <StatusTimeline status={statusRaw} />
                    <StatusBadge status={statusRaw} />
                  </td>

                  {/* Delivery Proof */}
                  <td className="px-3 py-3 whitespace-nowrap text-center">
                    <DeliveryProofCell
                      imageUrl={order.delivery_image}
                      orderId={orderId}
                      onPreview={(url, title) => setPreviewImage({ url, title })}
                    />
                  </td>

                  {/* View */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onViewOrder(order)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 bg-white hover:bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200 hover:border-emerald-400 shadow-sm transition-all"
                    >
                      <Eye size={13} /> View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm text-xs font-medium text-gray-600">
        <div>
          Showing <span className="font-bold text-slate-900">{filtered.length}</span> rows on this page &nbsp;·&nbsp; Total <span className="font-bold text-slate-900">{totalCount}</span> orders &nbsp;·&nbsp; Page <span className="font-bold text-slate-900">{page}</span> of <span className="font-bold text-slate-900">{totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            <ChevronLeft size={14} /> Prev
          </button>

          {/* Page pills */}
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pg: number;
              if (totalPages <= 7) {
                pg = i + 1;
              } else if (page <= 4) {
                pg = i + 1;
              } else if (page >= totalPages - 3) {
                pg = totalPages - 6 + i;
              } else {
                pg = page - 3 + i;
              }
              return (
                <button
                  key={pg}
                  type="button"
                  onClick={() => setPage(pg)}
                  className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-bold transition-colors ${
                    pg === page
                      ? 'bg-emerald-700 text-white border border-emerald-700 shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {pg}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <ImagePreviewModal
        isOpen={Boolean(previewImage)}
        imageUrl={previewImage?.url || null}
        title={previewImage?.title}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
