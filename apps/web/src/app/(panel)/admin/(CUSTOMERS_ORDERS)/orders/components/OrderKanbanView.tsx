// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : OrderKanbanView.tsx
// Description : Kanban pipeline board with light pastel theme matching F2H panel
//
// ============================================================================

'use client';

import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  XCircle,
  Repeat,
  ShoppingCart,
  Sun,
  Moon,
  Eye,
  User,
  Phone,
  MapPin,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface OrderKanbanViewProps {
  orders: Record<string, any>[];
  loading: boolean;
  onViewOrder: (order: Record<string, any>) => void;
  onUpdateStatus?: (orderId: string, newStatus: string) => void;
}

const STAGES = [
  {
    key: 'PENDING',
    label: 'Pending',
    icon: Clock,
    bgHeader: 'bg-amber-50 text-amber-900 border-amber-200',
    countBg: 'bg-amber-200/80 text-amber-900 border border-amber-300',
    accent: 'border-l-amber-400',
  },
  {
    key: 'CONFIRMED',
    label: 'Confirmed',
    icon: CheckCircle2,
    bgHeader: 'bg-teal-50 text-teal-900 border-teal-200',
    countBg: 'bg-teal-200/80 text-teal-900 border border-teal-300',
    accent: 'border-l-teal-400',
  },
  {
    key: 'PACKED',
    label: 'Packed',
    icon: Package,
    bgHeader: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    countBg: 'bg-indigo-200/80 text-indigo-900 border border-indigo-300',
    accent: 'border-l-indigo-400',
  },
  {
    key: 'OUT_FOR_DELIVERY',
    label: 'Out for Delivery',
    icon: Truck,
    bgHeader: 'bg-blue-50 text-blue-900 border-blue-200',
    countBg: 'bg-blue-200/80 text-blue-900 border border-blue-300',
    accent: 'border-l-blue-400',
  },
  {
    key: 'DELIVERED',
    label: 'Delivered',
    icon: CheckCircle2,
    bgHeader: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    countBg: 'bg-emerald-200/80 text-emerald-900 border border-emerald-300',
    accent: 'border-l-emerald-400',
  },
  {
    key: 'CANCELLED',
    label: 'Cancelled',
    icon: XCircle,
    bgHeader: 'bg-rose-50 text-rose-900 border-rose-200',
    countBg: 'bg-rose-200/80 text-rose-900 border border-rose-300',
    accent: 'border-l-rose-400',
  },
] as const;

export function stripHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str.replace(/<[^>]*>/g, '').trim();
}

export function normalizeStatus(stRaw: unknown): 'PENDING' | 'CONFIRMED' | 'PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' {
  if (!stRaw) return 'PENDING';
  let str = stripHtml(stRaw).toLowerCase().replace(/[\s_-]+/g, '_');

  if (str.includes('out_for_delivery') || str.includes('outfordelivery') || str.includes('dispatch')) return 'OUT_FOR_DELIVERY';
  if (str.includes('deliver')) return 'DELIVERED';
  if (str.includes('pack')) return 'PACKED';
  if (str.includes('confirm')) return 'CONFIRMED';
  if (str.includes('cancel')) return 'CANCELLED';
  if (str.includes('pend') || str.includes('place')) return 'PENDING';

  return 'PENDING';
}

function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
}

// Status Action Dropdown
function StatusDropdownMenu({
  currentStatus,
  orderId,
  onUpdateStatus,
}: {
  currentStatus: string;
  orderId: string;
  onUpdateStatus: (orderId: string, newStatus: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const options = [
    { key: 'CONFIRMED', label: 'Confirmed', icon: CheckCircle2, color: 'text-teal-700 hover:bg-teal-50' },
    { key: 'PACKED', label: 'Packed', icon: Package, color: 'text-indigo-700 hover:bg-indigo-50' },
    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Truck, color: 'text-blue-700 hover:bg-blue-50' },
    { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle2, color: 'text-emerald-700 hover:bg-emerald-50' },
    { key: 'CANCELLED', label: 'Cancelled', icon: XCircle, color: 'text-rose-700 hover:bg-rose-50' },
  ];

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 border border-gray-200 rounded-lg transition-all"
        title="Click to update order status"
      >
        <Sparkles size={11} className="text-emerald-600" />
        <span>Status</span>
        <ChevronDown size={11} className="text-gray-500" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 z-20 w-40 rounded-xl bg-white border border-gray-200 shadow-lg py-1 text-xs space-y-0.5 animate-in fade-in duration-150">
            <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
              Update Status
            </div>
            {options.map((opt) => {
              const Icon = opt.icon;
              const isCurrent = currentStatus === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    onUpdateStatus(orderId, opt.key);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 font-semibold flex items-center gap-2 transition-colors ${opt.color} ${
                    isCurrent ? 'bg-gray-100 font-bold' : ''
                  }`}
                >
                  <Icon size={12} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function OrderKanbanView({
  orders,
  loading,
  onViewOrder,
  onUpdateStatus,
}: OrderKanbanViewProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 min-h-[450px]">
        {STAGES.map((s) => (
          <div key={s.key} className="bg-slate-50/80 rounded-2xl p-3 border border-gray-200 animate-pulse space-y-3">
            <div className="h-9 bg-gray-200 rounded-xl" />
            <div className="h-28 bg-white rounded-xl border border-gray-200" />
            <div className="h-28 bg-white rounded-xl border border-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start overflow-x-auto pb-4">
      {STAGES.map(({ key: stageKey, label, icon: Icon, bgHeader, countBg, accent }) => {
        const stageOrders = orders.filter((o) => normalizeStatus(o.order_status || o.status) === stageKey);
        const stageTotalMoney = stageOrders.reduce((sum, o) => sum + Number(o.total_amount || o.amount || 0), 0);

        return (
          <div
            key={stageKey}
            className="flex flex-col bg-slate-50/70 rounded-2xl border border-gray-200/80 p-2.5 min-w-[260px] shadow-xs"
          >
            {/* Column Light Header */}
            <div className={`flex items-center justify-between p-2.5 rounded-xl border ${bgHeader} mb-2 shadow-xs`}>
              <div className="flex items-center gap-2">
                <Icon size={15} />
                <span className="text-xs font-bold">{label}</span>
              </div>
              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${countBg}`}>
                {stageOrders.length}
              </span>
            </div>

            {/* Sub-header Monetary Total */}
            {stageOrders.length > 0 && (
              <div className="px-1 mb-2 flex justify-between text-[11px] font-medium text-slate-500">
                <span>Total:</span>
                <span className="text-slate-800 font-bold">{formatMoney(stageTotalMoney)}</span>
              </div>
            )}

            {/* Orders Column */}
            <div className="space-y-2.5 min-h-[380px] max-h-[70vh] overflow-y-auto pr-0.5">
              {stageOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white/60 text-xs font-medium">
                  <span>No orders</span>
                </div>
              ) : (
                stageOrders.map((order) => {
                  const rawOrderId = order.order_id || order.id || 'N/A';
                  const orderId = stripHtml(rawOrderId);
                  const rawSource = stripHtml(order.order_source || order.order_type || '');
                  const isSubscription = Boolean(
                    order.is_subscription ||
                    rawSource.toLowerCase().includes('sub') ||
                    order.subscription_id
                  );

                  const rawSlot = stripHtml(order.delivery_slot || order.slot || '');
                  const isMorning = rawSlot.toLowerCase().includes('morning');

                  const customerName = stripHtml(order.customer_name || order.customer_id || 'Customer');
                  const customerPhone = stripHtml(order.customer_phone || order.phone || order.contact_number || '');
                  const addressArea = stripHtml(order.area || order.pincode || order.delivery_address || '');

                  return (
                    <div
                      key={orderId}
                      className={`group bg-white rounded-xl p-3 border border-gray-200/90 shadow-2xs hover:shadow-md transition-all border-l-4 ${accent} space-y-2`}
                    >
                      {/* Top Row: Order ID & Type Badge */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900">
                          #{orderId}
                        </span>
                        {isSubscription ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            <Repeat size={10} className="text-purple-600" /> Subscription
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <ShoppingCart size={10} className="text-emerald-600" /> One-Time
                          </span>
                        )}
                      </div>

                      {/* Customer Information */}
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-800 line-clamp-1 flex items-center gap-1">
                          <User size={11} className="text-slate-400 shrink-0" />
                          {customerName}
                        </p>
                        {customerPhone && (
                          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            <Phone size={11} className="text-slate-400 shrink-0" />
                            {customerPhone}
                          </p>
                        )}
                        {addressArea && (
                          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 line-clamp-1">
                            <MapPin size={11} className="text-slate-400 shrink-0" />
                            {addressArea}
                          </p>
                        )}
                      </div>

                      {/* Delivery Slot & Amount */}
                      <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          isMorning
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                        }`}>
                          {isMorning ? <Sun size={10} /> : <Moon size={10} />}
                          {rawSlot || 'Standard'}
                        </span>
                        <span className="font-bold text-emerald-700">
                          {formatMoney(order.total_amount || order.amount)}
                        </span>
                      </div>

                      {/* Action Bar */}
                      <div className="pt-1.5 flex items-center justify-between gap-1 border-t border-slate-50">
                        <button
                          type="button"
                          onClick={() => onViewOrder(order)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          title="View order items and details"
                        >
                          <Eye size={11} /> Details
                        </button>

                        {onUpdateStatus && (
                          <StatusDropdownMenu
                            currentStatus={stageKey}
                            orderId={orderId}
                            onUpdateStatus={onUpdateStatus}
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
