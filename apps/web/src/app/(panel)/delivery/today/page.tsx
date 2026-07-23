'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/services/api.client';
import { useOrderSocket } from '@/hooks/useOrderSocket';
import { useAuth } from '@/context/AuthContext';
import { showSuccessToast, showErrorToast } from '@/components/Toast';
import {
  CheckCircle2, SkipForward, Clock, Sun, Moon,
  Wifi, WifiOff, RefreshCw, MapPin, Phone,
  ChevronDown, ChevronUp, Package, RotateCcw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeliveryRow {
  schedule_id: number;
  delivery_slot: 'morning' | 'evening';
  quantity: number;
  price: number;
  delivery_status: string;
  delivery_date: string;
  schedule_updated_at?: string;
  order_updated_at?: string;
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
  rider_name: string;
  delivery_partner_user_id?: string;
  bottle_picked_up?: boolean | number;
  delivered_at?: string;
  skipped_by?: string | null;
}

type SlotKey = 'morning' | 'evening';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  delivered: { bg: 'bg-green-100', text: 'text-green-700', label: 'Delivered' },
  skipped: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Skipped' },
  paused: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'Paused' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-500', label: 'Cancelled' },
};

function statusStyle(s: string) {
  return STATUS_STYLE[s] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: s };
}

function fullName(r: DeliveryRow) {
  return [r.first_name, r.last_name].filter(Boolean).join(' ');
}

function area(r: DeliveryRow) {
  return [r.area, r.city].filter(Boolean).join(', ') || '—';
}

function formatTime(timestamp?: string): string {
  if (!timestamp) return '—';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '—';
  }
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex-1 rounded-2xl p-3 text-center ${color}`}>
      <p className="text-2xl font-extrabold leading-none">{value}</p>
      <p className="text-[11px] font-medium mt-1 opacity-80">{label}</p>
    </div>
  );
}

function Tooltip({ text, children, className }: { text: string; children: React.ReactNode; className?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const handleEnter = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ x: r.left, y: r.top });
    }
  };

  return (
    <div
      ref={ref}
      className={`relative ${className ?? 'flex-1'}`}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && (
        <>
          <style>{`
            @keyframes tooltipIn {
              from { opacity: 0; transform: translateY(4px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          <div
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.y - 48,
              zIndex: 9999,
              pointerEvents: 'none',
              animation: 'tooltipIn 0.18s cubic-bezier(.34,1.56,.64,1) both',
            }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
              border: '1px solid #bbf7d0',
              borderRadius: '14px',
              padding: '8px 14px',
              boxShadow: '0 12px 32px -4px rgba(22,163,74,0.15), 0 4px 12px -2px rgba(0,0,0,0.08)',
              whiteSpace: 'nowrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  boxShadow: '0 0 0 2px #bbf7d0',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#166534', letterSpacing: '0.01em' }}>
                  {text}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Order Card ──────────────────────────────────────────────────────────────

type ActionStatus = 'delivered' | 'skipped' | 'scheduled';

interface OrderCardProps {
  row: DeliveryRow;
  onAction: (scheduleId: number, status: ActionStatus) => void;
  onBottleToggle: (scheduleId: number, picked: boolean) => void;
  updating: boolean;
  flash: boolean;
  myUserId?: string;
}

function OrderCard({ row, onAction, onBottleToggle, updating, flash, myUserId }: OrderCardProps) {
  const [open, setOpen] = useState(false);
  const st = statusStyle(row.delivery_status);
  const isDone = row.delivery_status === 'delivered';
  const isSkipped = row.delivery_status === 'skipped';
  const isPending = row.delivery_status === 'scheduled';
  const isCancelled = row.delivery_status === 'cancelled';
  const isPaused = row.delivery_status === 'paused';
  const bottleOk = Number(row.bottle_picked_up) === 1;

  return (
    <div
      className={`
        rounded-2xl border transition-all duration-300
        ${flash ? 'ring-2 ring-green-400 border-green-300' : 'border-gray-100'}
        ${isDone ? 'bg-green-50/60' : isSkipped ? 'bg-gray-50/70' : 'bg-white'}
        shadow-sm overflow-visible
      `}
    >
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${isDone ? 'bg-green-500' : isSkipped ? 'bg-gray-400' : isPaused ? 'bg-yellow-400' : isCancelled ? 'bg-red-400' : 'bg-amber-400'
          }`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-900 text-base truncate">{fullName(row)}</p>
            <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
              {st.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            {row.product_name} &times; {row.quantity} {row.unit_type}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <MapPin size={10} /> {area(row)}
            </span>
            <span className="text-xs font-semibold text-deep-green">
              ₹{Number(row.price).toFixed(0)}
            </span>
          </div>
        </div>

        {open
          ? <ChevronUp size={16} className="text-gray-400 mt-1 shrink-0" />
          : <ChevronDown size={16} className="text-gray-400 mt-1 shrink-0" />
        }
      </button>

      {/* ── Quick action strip ── */}
      <div className="px-4 pb-3 flex gap-2">
        {isPending && (
          <>
            <Tooltip text="Mark this delivery as completed">
              <button
                disabled={updating}
                onClick={() => onAction(row.schedule_id, 'delivered')}
                className="w-full flex items-center justify-center gap-1.5 bg-deep-green text-white font-semibold text-sm py-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                {updating ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Delivered
              </button>
            </Tooltip>
            <Tooltip text="Skip this delivery for today">
              <button
                disabled={updating}
                onClick={() => onAction(row.schedule_id, 'skipped')}
                className="w-full flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 font-semibold text-sm py-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
              >
                <SkipForward size={14} />
                Skip
              </button>
            </Tooltip>
          </>
        )}
        {isDone && (
          <div className="flex gap-2 w-full">
            <Tooltip text="Undo and reset to pending" className="flex-none">
              <button
                disabled={updating}
                onClick={() => onAction(row.schedule_id, 'scheduled')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium active:scale-95 transition-transform disabled:opacity-50"
              >
                {updating
                  ? <RefreshCw size={12} className="animate-spin" />
                  : <RotateCcw size={12} />}
                Undo
              </button>
            </Tooltip>
            <Tooltip text={bottleOk ? 'Bottle already picked up' : 'Mark bottle as picked up'} className="flex-1">
              <button
                disabled={updating}
                onClick={() => onBottleToggle(row.schedule_id, !bottleOk)}
                className={`w-full flex items-center justify-center gap-1.5 font-semibold text-sm py-2 rounded-xl active:scale-95 transition-all disabled:opacity-50 border ${bottleOk ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}
              >
                {bottleOk ? <CheckCircle2 size={14} /> : <Package size={14} />}
                {bottleOk ? 'Bottle Picked ✓' : 'Pick Bottle'}
              </button>
            </Tooltip>
          </div>
        )}
        {isSkipped && (
          <div className="flex gap-2 w-full">
            {/* Only show undo if the delivery boy skipped it themselves */}
            {(!row.skipped_by || row.skipped_by === myUserId) ? (
              <Tooltip text="Undo and reset to pending" className="flex-none">
                <button
                  disabled={updating}
                  onClick={() => onAction(row.schedule_id, 'scheduled')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium active:scale-95 transition-transform disabled:opacity-50"
                >
                  {updating
                    ? <RefreshCw size={12} className="animate-spin" />
                    : <RotateCcw size={12} />}
                  Undo
                </button>
              </Tooltip>
            ) : null}
            <span className="flex-1 text-xs px-3 py-2 rounded-xl bg-gray-100 text-gray-500 font-medium text-center">
              {row.skipped_by && row.skipped_by !== myUserId ? 'Skipped by admin' : 'Skipped — no action available'}
            </span>
          </div>
        )}
        {(isCancelled || isPaused) && (
          <span className={`text-xs px-3 py-2 rounded-xl ${st.bg} ${st.text} font-medium`}>
            {st.label} — no action available
          </span>
        )}
      </div>

      {/* ── Expanded detail ── */}
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Phone</p>
              <a href={`tel:${row.customer_phone}`} className="font-medium text-sky-600 flex items-center gap-1">
                <Phone size={12} /> {row.customer_phone || '—'}
              </a>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Zone</p>
              <p className="font-medium text-gray-800">{row.zone_name}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Product</p>
              <p className="font-medium text-gray-800">
                {row.product_name} × {row.quantity} {row.unit_type}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Order ID</p>
              <p className="font-medium text-gray-500 text-xs">{row.order_id}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Area</p>
              <p className="font-medium text-gray-800">{area(row)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Amount</p>
              <p className="font-bold text-deep-green text-base">₹{Number(row.price).toFixed(2)}</p>
            </div>
            {isDone && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Delivered At</p>
                <p className="font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 size={12} /> {formatTime(row.delivered_at || row.schedule_updated_at)}
                </p>
              </div>
            )}
            {isDone && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Bottle Picked Up</p>
                <p className={`font-medium flex items-center gap-1 ${bottleOk ? 'text-green-600' : 'text-amber-600'}`}>
                  <Package size={12} /> {bottleOk ? 'Yes ✓' : 'No ✗'}
                </p>
              </div>
            )}
            {isSkipped && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Skipped At</p>
                <p className="font-medium text-gray-600 flex items-center gap-1">
                  <Clock size={12} /> {formatTime(row.schedule_updated_at)}
                </p>
              </div>
            )}
            {!isDone && !isSkipped && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Last Updated</p>
                <p className="font-medium text-gray-600 flex items-center gap-1">
                  <Clock size={12} /> {formatTime(row.order_updated_at)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Slot section ─────────────────────────────────────────────────────────────

function SlotSection({
  slot, rows, updating, flashing, onAction, onBottleToggle, myUserId,
}: {
  slot: SlotKey;
  rows: DeliveryRow[];
  updating: Set<number>;
  flashing: Set<number>;
  onAction: (id: number, s: ActionStatus) => void;
  onBottleToggle: (id: number, picked: boolean) => void;
  myUserId?: string;
}) {
  const done = rows.filter((r) => r.delivery_status === 'delivered').length;
  const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;

  return (
    <section className="space-y-3">
      {/* Slot header */}
      <div className="flex items-center justify-between sticky top-[56px] z-10 bg-gray-50/90 backdrop-blur-sm py-2">
        <div className="flex items-center gap-2">
          {slot === 'morning'
            ? <Sun size={15} className="text-amber-500" />
            : <Moon size={15} className="text-indigo-500" />
          }
          <span className="font-bold text-gray-700 capitalize">{slot}</span>
          <span className="text-xs text-gray-400 ml-1">{rows.length} orders</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-deep-green transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-deep-green">{pct}%</span>
        </div>
      </div>

      {rows.map((row) => (
        <OrderCard
          key={row.schedule_id}
          row={row}
          onAction={onAction}
          onBottleToggle={onBottleToggle}
          updating={updating.has(row.schedule_id)}
          flash={flashing.has(row.schedule_id)}
          myUserId={myUserId}
        />
      ))}

      {rows.length === 0 && (
        <div className="text-center text-sm text-gray-400 py-8">No {slot} orders</div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeliveryTodayPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updating, setUpdating] = useState<Set<number>>(new Set());
  const [flashing, setFlashing] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [slotFilter, setSlotFilter] = useState<'all' | SlotKey>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>('all');

  // ── Fetch my today's orders ──
  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const { data, error } = await api.get<{ data: DeliveryRow[] }>('/f2h/orders/my-today');
      if (error) { if (!silent) showErrorToast('Failed to load deliveries'); return; }
      setRows(data?.data || []);
    } catch {
      if (!silent) showErrorToast('Failed to load deliveries');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ── WS — live status updates + zone assignment changes ──
  const { connected } = useOrderSocket(useMemo(() => ({
    onStatusUpdate: ({ scheduleId, status, ...rest }) => {
      // Handle bottle pickup updates (no status field, has bottlePickedUp)
      if ((rest as any).bottlePickedUp !== undefined) {
        setRows((prev) =>
          prev.map((r) =>
            r.schedule_id === scheduleId ? { ...r, bottle_picked_up: (rest as any).bottlePickedUp ? 1 : 0 } : r,
          ),
        );
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.schedule_id === scheduleId ? {
            ...r,
            delivery_status: status,
            skipped_by: status === 'skipped' ? ((rest as any).skippedBy || null) : null,
          } : r,
        ),
      );
      setFlashing((prev) => { const n = new Set(prev); n.add(scheduleId); return n; });
      setTimeout(() => {
        setFlashing((prev) => { const n = new Set(prev); n.delete(scheduleId); return n; });
      }, 2000);
    },
    onZoneChange: ({ newRiderUserId, prevRiderUserIds }) => {
      const myId = user?.user_id;
      if (!myId) return;
      // Am I affected? Either newly assigned OR removed from zone
      const isNewRider = newRiderUserId === myId;
      const wasOldRider = prevRiderUserIds.includes(myId);
      if (isNewRider || wasOldRider) {
        if (isNewRider) {
          showSuccessToast('You have been assigned to a new zone! Loading your orders…');
        } else {
          showErrorToast('Your zone assignment has changed. Updating orders…', 4000);
        }
        // Silent re-fetch — keep the page usable while loading
        fetchOrders(true);
      }
    },
  } as Parameters<typeof useOrderSocket>[0]), [user?.user_id, fetchOrders]));

  // ── Update status ──
  const handleAction = useCallback(async (scheduleId: number, status: ActionStatus) => {
    // Optimistic
    setRows((prev) =>
      prev.map((r) => r.schedule_id === scheduleId ? { ...r, delivery_status: status } : r),
    );
    setUpdating((prev) => { const s = new Set(prev); s.add(scheduleId); return s; });

    try {
      const { error } = await api.put(`/f2h/orders/schedule/${scheduleId}/status`, { status });
      if (error) {
        // Rollback
        await fetchOrders();
        showErrorToast('Failed to update status');
      } else {
        const msg =
          status === 'delivered' ? 'Marked as delivered!' :
            status === 'skipped' ? 'Order skipped' :
              'Reset to pending';
        showSuccessToast(msg);
        // Flash self
        setFlashing((prev) => { const s = new Set(prev); s.add(scheduleId); return s; });
        setTimeout(() => {
          setFlashing((prev) => { const s = new Set(prev); s.delete(scheduleId); return s; });
        }, 2000);
      }
    } catch {
      await fetchOrders();
      showErrorToast('Network error');
    } finally {
      setUpdating((prev) => { const s = new Set(prev); s.delete(scheduleId); return s; });
    }
  }, [fetchOrders]);

  // ── Toggle bottle pickup ──
  const handleBottleToggle = useCallback(async (scheduleId: number, picked: boolean) => {
    // Optimistic
    setRows((prev) =>
      prev.map((r) => r.schedule_id === scheduleId ? { ...r, bottle_picked_up: picked ? 1 : 0 } : r),
    );
    setUpdating((prev) => { const s = new Set(prev); s.add(scheduleId); return s; });

    try {
      const { error } = await api.put(`/f2h/orders/schedule/${scheduleId}/bottle-pickup`, { picked });
      if (error) {
        await fetchOrders(true);
        showErrorToast('Failed to update bottle status');
      } else {
        showSuccessToast(picked ? 'Bottle picked up!' : 'Bottle pickup undone');
      }
    } catch {
      await fetchOrders(true);
      showErrorToast('Network error');
    } finally {
      setUpdating((prev) => { const s = new Set(prev); s.delete(scheduleId); return s; });
    }
  }, [fetchOrders]);

  // ── Derived values ──
  const total = rows.length;
  const delivered = rows.filter((r) => r.delivery_status === 'delivered').length;
  const pending = rows.filter((r) => r.delivery_status === 'scheduled').length;
  const skipped = rows.filter((r) => r.delivery_status === 'skipped').length;
  const pct = total ? Math.round((delivered / total) * 100) : 0;

  const filtered = useMemo(() => {
    let list = rows;
    if (slotFilter !== 'all') list = list.filter((r) => r.delivery_slot === slotFilter);
    if (statusFilter === 'pending') list = list.filter((r) => r.delivery_status === 'scheduled');
    if (statusFilter === 'done') list = list.filter((r) => ['delivered', 'skipped'].includes(r.delivery_status));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        fullName(r).toLowerCase().includes(q) ||
        r.product_name.toLowerCase().includes(q) ||
        (r.area || '').toLowerCase().includes(q) ||
        (r.city || '').toLowerCase().includes(q) ||
        r.zone_name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, slotFilter, statusFilter, search]);

  const morning = filtered.filter((r) => r.delivery_slot === 'morning');
  const evening = filtered.filter((r) => r.delivery_slot === 'evening');

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  // ─── Skeleton ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 pb-8">
        <div className="h-20 bg-white rounded-2xl animate-pulse" />
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="flex-1 h-16 bg-white rounded-2xl animate-pulse" />)}
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />
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
              <Package size={18} className="text-deep-green" />
              My Deliveries
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">{today}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* WS indicator */}
            <div className="flex items-center gap-1 text-xs">
              {connected
                ? <><Wifi size={13} className="text-green-500" /><span className="text-green-600 font-medium">Live</span></>
                : <><WifiOff size={13} className="text-gray-400" /><span className="text-gray-400">Offline</span></>
              }
            </div>
            <button
              onClick={() => fetchOrders()}
              className="p-2 rounded-xl border border-gray-200 active:bg-gray-50"
            >
              <RefreshCw size={14} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Overall progress */}
        {total > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-500">Overall progress</span>
              <span className="font-bold text-deep-green">{delivered}/{total} — {pct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-deep-green transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── KPI strip ── */}
      <div className="flex gap-2">
        <Tooltip text="Total deliveries today">
          <StatBadge label="Total" value={total} color="bg-white border border-gray-100 text-gray-800" />
        </Tooltip>
        <Tooltip text="Deliveries still pending">
          <StatBadge label="Pending" value={pending} color="bg-amber-50 text-amber-700" />
        </Tooltip>
        <Tooltip text="Successfully delivered">
          <StatBadge label="Done" value={delivered} color="bg-green-50 text-green-700" />
        </Tooltip>
        <Tooltip text="Deliveries skipped today">
          <StatBadge label="Skipped" value={skipped} color="bg-gray-100 text-gray-600" />
        </Tooltip>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {/* Search */}
        <div className="relative shrink-0 flex-1 min-w-[160px]">
          <input
            type="search"
            placeholder="Search name / area…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full pl-3 pr-3 py-2.5 text-sm rounded-xl border border-gray-200
              outline-none focus:border-deep-green/40 bg-white
            "
          />
        </div>

        {/* Slot filter chips */}
        {(['all', 'morning', 'evening'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSlotFilter(s)}
            className={`
              shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-semibold
              border transition-colors
              ${slotFilter === s
                ? 'bg-deep-green text-white border-deep-green'
                : 'bg-white text-gray-600 border-gray-200'}
            `}
          >
            {s === 'morning' && <Sun size={11} />}
            {s === 'evening' && <Moon size={11} />}
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}

        {/* Status filter chips */}
        {([
          { v: 'all', l: 'All Status' },
          { v: 'pending', l: 'Pending' },
          { v: 'done', l: 'Done' },
        ] as const).map(({ v, l }) => (
          <button
            key={v}
            onClick={() => setStatusFilter(v)}
            className={`
              shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-semibold
              border transition-colors whitespace-nowrap
              ${statusFilter === v
                ? 'bg-deep-green text-white border-deep-green'
                : 'bg-white text-gray-600 border-gray-200'}
            `}
          >
            {v === 'pending' && <Clock size={11} />}
            {v === 'done' && <CheckCircle2 size={11} />}
            {l}
          </button>
        ))}
      </div>

      {/* ── Slot sections ── */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-16">
          No orders match your filters
        </div>
      ) : (
        <div className="space-y-6">
          {morning.length > 0 && (
            <SlotSection
              slot="morning"
              rows={morning}
              updating={updating}
              flashing={flashing}
              onAction={handleAction}
              onBottleToggle={handleBottleToggle}
              myUserId={user?.user_id}
            />
          )}
          {evening.length > 0 && (
            <SlotSection
              slot="evening"
              rows={evening}
              updating={updating}
              flashing={flashing}
              onAction={handleAction}
              onBottleToggle={handleBottleToggle}
              myUserId={user?.user_id}
            />
          )}
        </div>
      )}
    </div>
  );
}

