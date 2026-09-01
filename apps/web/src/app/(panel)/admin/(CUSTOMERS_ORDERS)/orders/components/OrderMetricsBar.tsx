// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : OrderMetricsBar.tsx
// Description : Executive metrics bar with light pastel theme matching F2H panel
//
// ============================================================================

'use client';

import React from 'react';
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  TrendingUp,
  Repeat,
  Layers,
  AlertOctagon,
} from 'lucide-react';

export interface DashboardSummary {
  total_orders: number;
  pending: number;
  placed: number;
  confirmed: number;
  assigned: number;
  packed: number;
  out_for_delivery: number;
  delivered: number;
  failed: number;
  cancelled: number;
  revenue: number;
  subscription_count: number;
  one_time_count: number;
}

interface OrderMetricsBarProps {
  summary: DashboardSummary | null;
  loading: boolean;
  activeStatusFilter: string | null;
  onSelectStatusFilter: (status: string | null) => void;
  scope?: 'today' | 'all';
}

function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
}

const STATUS_CARDS = [
  { key: 'total_orders', label: 'All Orders', statusVal: null, icon: Layers, bg: 'bg-slate-100/90 text-slate-800 border-slate-200' },
  { key: 'placed', label: 'Placed', statusVal: 'PLACED', icon: Clock, bg: 'bg-sky-50 text-sky-900 border-sky-200' },
  { key: 'confirmed', label: 'Confirmed', statusVal: 'CONFIRMED', icon: CheckCircle2, bg: 'bg-teal-50 text-teal-900 border-teal-200' },
  { key: 'assigned', label: 'Assigned', statusVal: 'ASSIGNED', icon: Clock, bg: 'bg-indigo-50 text-indigo-900 border-indigo-200' },
  { key: 'out_for_delivery', label: 'Out for Delivery', statusVal: 'OUT_FOR_DELIVERY', icon: Truck, bg: 'bg-blue-50 text-blue-900 border-blue-200' },
  { key: 'delivered', label: 'Delivered', statusVal: 'DELIVERED', icon: CheckCircle2, bg: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
  { key: 'failed', label: 'Failed', statusVal: 'FAILED', icon: AlertOctagon, bg: 'bg-amber-50 text-amber-900 border-amber-200' },
  { key: 'cancelled', label: 'Cancelled', statusVal: 'CANCELLED', icon: XCircle, bg: 'bg-rose-50 text-rose-900 border-rose-200' },
] as const;

export default function OrderMetricsBar({
  summary,
  loading,
  activeStatusFilter,
  onSelectStatusFilter,
  scope = 'today',
}: OrderMetricsBarProps) {
  return (
    <div className="space-y-3">
      {/* Light Financial & Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Total Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <TrendingUp size={15} className="text-emerald-600" /> {scope === 'today' ? 'Total Revenue Today' : 'Total Revenue'}
            </span>
            <span className="text-[11px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
              Live
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 pt-1">
            {loading ? (
              <span className="inline-block h-7 w-28 animate-pulse rounded bg-gray-200" />
            ) : (
              formatMoney(summary?.revenue)
            )}
          </p>
          <p className="text-[11px] text-gray-500">
            Combined billing from one-time & daily subscriptions
          </p>
        </div>

        {/* One-Time Orders */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-sky-800 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <ShoppingCart size={15} className="text-sky-600" /> One-Time Orders
            </span>
            <span className="text-[11px] bg-sky-50 text-sky-800 px-2.5 py-0.5 rounded-full border border-sky-200">
              Instant
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <p className="text-2xl font-extrabold text-slate-900">
              {loading ? (
                <span className="inline-block h-7 w-16 animate-pulse rounded bg-gray-200" />
              ) : (
                summary?.one_time_count ?? 0
              )}
            </p>
            <span className="text-xs text-sky-800 font-bold bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
              {summary?.total_orders ? Math.round(((summary.one_time_count || 0) / summary.total_orders) * 100) : 0}% of total
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            Direct cart checkout orders
          </p>
        </div>

        {/* Subscription Deliveries */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-purple-800 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Repeat size={15} className="text-purple-600" /> Subscription Deliveries
            </span>
            <span className="text-[11px] bg-purple-50 text-purple-800 px-2.5 py-0.5 rounded-full border border-purple-200">
              Recurring
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <p className="text-2xl font-extrabold text-slate-900">
              {loading ? (
                <span className="inline-block h-7 w-16 animate-pulse rounded bg-gray-200" />
              ) : (
                summary?.subscription_count ?? 0
              )}
            </p>
            <span className="text-xs text-purple-800 font-bold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
              {summary?.total_orders ? Math.round(((summary.subscription_count || 0) / summary.total_orders) * 100) : 0}% of total
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            Auto-generated daily recurring deliveries
          </p>
        </div>
      </div>

      {/* Stage-by-Stage Order Status Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {STATUS_CARDS.map(({ key, label, statusVal, icon: Icon, bg }) => {
          const isSelected = activeStatusFilter === statusVal;
          const count = summary?.[key as keyof DashboardSummary] ?? 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectStatusFilter(isSelected ? null : statusVal)}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-left ${
                isSelected
                  ? 'bg-white ring-2 ring-emerald-600 border-emerald-600 shadow-sm'
                  : 'bg-white border-gray-200/90 hover:border-gray-300 hover:shadow-2xs'
              }`}
              title={`Filter by ${label}`}
            >
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className={`p-1 rounded-md border ${bg}`}>
                    <Icon size={12} />
                  </div>
                  <span className="text-[11px] font-bold text-gray-800">{label}</span>
                </div>
                <p className="text-base font-extrabold text-slate-900">
                  {loading ? <span className="inline-block h-4 w-6 animate-pulse rounded bg-gray-200" /> : count}
                </p>
              </div>
              {isSelected && (
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-600 ring-2 ring-emerald-200" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
