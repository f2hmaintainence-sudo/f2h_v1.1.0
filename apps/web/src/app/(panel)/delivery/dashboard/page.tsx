'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api.client';
import { useAuth } from '@/context/AuthContext';
import { showErrorToast } from '@/components/Toast';
import {
  Package, TrendingUp, CheckCircle2, SkipForward,
  Clock, MapPin, RefreshCw, Bike, IndianRupee,
  CalendarDays, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

interface TodayStat {
  total: number;
  delivered: number;
  pending: number;
  skipped: number;
  amount: number;
  progress: number;
}

interface DayRow {
  date: string;
  delivered: number;
  skipped: number;
  total: number;
  amount: number;
}

interface DashData {
  today: TodayStat;
  week: { total: number; delivered: number; amount: number; daily: DayRow[] };
  zones: { zone_id: string; name: string }[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function shortDay(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── stat card ───────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, accent,
}: {
  icon: React.ElementType; label: string; value: string | number; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

// ─── bar ─────────────────────────────────────────────────────────────────────

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden w-full">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
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
// ─── page ────────────────────────────────────────────────────────────────────

export default function DeliveryDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: res, error } = await api.get<{ data: DashData }>('/f2h/orders/my-dashboard');
      if (error) { if (!silent) showErrorToast('Failed to load dashboard'); return; }
      setData(res?.data ?? null);
    } catch {
      if (!silent) showErrorToast('Failed to load dashboard');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // ─── skeleton ──────────────
  if (loading) {
    return (
      <div className="space-y-4 pb-8">
        <div className="h-24 bg-white rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-48 bg-white rounded-2xl animate-pulse" />
        <div className="h-32 bg-white rounded-2xl animate-pulse" />
      </div>
    );
  }

  const t = data?.today ?? { total: 0, delivered: 0, pending: 0, skipped: 0, amount: 0, progress: 0 };
  const w = data?.week ?? { total: 0, delivered: 0, amount: 0, daily: [] };
  const zones = data?.zones ?? [];
  const maxDaily = Math.max(...w.daily.map(d => d.total), 1);

  return (
    <div className="space-y-4 pb-20">

      {/* ── Greeting + date ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
              <Bike size={20} className="text-deep-green" />
              Dashboard
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">{today}</p>
            {user?.first_name && (
              <p className="text-sm text-gray-600 mt-1">
                Welcome back, <span className="font-semibold text-deep-green">{user.first_name}</span>
              </p>
            )}
          </div>
          <button onClick={() => load()} className="p-2 rounded-xl border border-gray-200 active:bg-gray-50">
            <RefreshCw size={14} className="text-gray-500" />
          </button>
        </div>

        {/* Overall progress */}
        {t.total > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-500">Today&apos;s progress</span>
              <span className="font-bold text-deep-green">{t.delivered}/{t.total} — {t.progress}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-deep-green transition-all duration-700"
                style={{ width: `${t.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <Tooltip text="Total deliveries assigned today">
          <KpiCard icon={Package} label="Total Today" value={t.total} accent="bg-deep-green" />
        </Tooltip>
        <Tooltip text="Successfully delivered so far">
          <KpiCard icon={CheckCircle2} label="Delivered" value={t.delivered} accent="bg-green-500" />
        </Tooltip>
        <Tooltip text="Deliveries still pending">
          <KpiCard icon={Clock} label="Pending" value={t.pending} accent="bg-amber-500" />
        </Tooltip>
        <Tooltip text="Deliveries skipped today">
          <KpiCard icon={SkipForward} label="Skipped" value={t.skipped} accent="bg-gray-400" />
        </Tooltip>
      </div>

      {/* ── Today's earnings ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-2">
          <IndianRupee size={15} className="text-deep-green" />
          <span className="font-bold text-gray-800 text-sm">Today&apos;s Value</span>
        </div>
        <p className="text-3xl font-extrabold text-deep-green">₹{Number(t.amount).toLocaleString('en-IN')}</p>
        <p className="text-xs text-gray-400 mt-1">Total value of deliveries assigned today</p>
      </div>

      {/* ── Quick action ── */}
      <Link
        href="/delivery/today"
        className="flex items-center justify-between bg-deep-green text-white rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-3">
          <Package size={20} />
          <div>
            <p className="font-bold text-sm">Today&apos;s Deliveries</p>
            <p className="text-[11px] opacity-80">{t.pending} pending &bull; {t.delivered} done</p>
          </div>
        </div>
        <ChevronRight size={18} className="opacity-60" />
      </Link>

      {/* ── Last 7 days ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-deep-green" />
            <span className="font-bold text-gray-800 text-sm">Last 7 Days</span>
          </div>
          <Link href="/delivery/history" className="text-xs text-deep-green font-semibold flex items-center gap-0.5">
            View all <ChevronRight size={12} />
          </Link>
        </div>

        {/* Weekly summary bar */}
        <div className="px-4 pb-3 flex gap-3">
          <Tooltip text="Deliveries completed this week">
            <div className="flex-1 text-center rounded-xl bg-green-50 py-2">
              <p className="text-lg font-extrabold text-green-700">{w.delivered}</p>
              <p className="text-[10px] text-green-600">Delivered</p>
            </div>
          </Tooltip>
          <Tooltip text="Total deliveries this week">
            <div className="flex-1 text-center rounded-xl bg-gray-50 py-2">
              <p className="text-lg font-extrabold text-gray-700">{w.total}</p>
              <p className="text-[10px] text-gray-500">Total</p>
            </div>
          </Tooltip>
          <Tooltip text="Total value of deliveries this week">
            <div className="flex-1 text-center rounded-xl bg-amber-50 py-2">
              <p className="text-lg font-extrabold text-amber-700">₹{Number(w.amount).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-amber-600">Value</p>
            </div>
          </Tooltip>
        </div>

        {/* Daily mini chart */}
        <div className="px-4 pb-4 space-y-2">
          {w.daily.map(day => {
            const pct = day.total ? Math.round((day.delivered / day.total) * 100) : 0;
            return (
              <div key={day.date} className="flex items-center gap-3">
                <div className="w-16 shrink-0">
                  <p className="text-xs font-semibold text-gray-700">{shortDay(day.date)}</p>
                  <p className="text-[10px] text-gray-400">{fmtDate(day.date)}</p>
                </div>
                <div className="flex-1">
                  <MiniBar value={day.delivered} max={maxDaily} color="bg-deep-green" />
                </div>
                <span className="text-xs font-bold text-gray-600 w-12 text-right">{day.delivered}/{day.total}</span>
                <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
              </div>
            );
          })}
          {w.daily.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
          )}
        </div>
      </div>

      {/* ── Zones assigned ── */}
      {zones.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={15} className="text-deep-green" />
            <span className="font-bold text-gray-800 text-sm">My Zones</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {zones.map(z => (
              <span
                key={z.zone_id}
                className="px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold border border-green-100"
              >
                {z.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── History link ── */}
      <Link
        href="/delivery/history"
        className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-4 active:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <CalendarDays size={18} className="text-gray-400" />
          <div>
            <p className="font-bold text-sm text-gray-800">Delivery History</p>
            <p className="text-[11px] text-gray-400">View all past deliveries and records</p>
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-400" />
      </Link>
    </div>
  );
}
