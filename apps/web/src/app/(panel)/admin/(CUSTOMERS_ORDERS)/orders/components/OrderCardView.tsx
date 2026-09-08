// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : OrderCardView.tsx
// Description : Cards grid view with 20-card pagination, "View" button & "Subscribed" badge
//
// ============================================================================

'use client';

import React, { useState, useMemo } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

import { PaymentStatusBadge } from './OrdersTable';

interface OrderCardViewProps {
  orders: Record<string, any>[];
  loading: boolean;
  onViewOrder: (order: Record<string, any>) => void;
  onUpdateStatus?: (orderId: string, newStatus: string) => void;
}

export function stripHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str.replace(/<[^>]*>/g, '').trim();
}

function getLightStatusBadge(statusRaw: unknown) {
  const status = stripHtml(statusRaw).toLowerCase().replace(/[\s_-]+/g, '_');

  if (status.includes('out_for_delivery') || status.includes('outfordelivery') || status.includes('dispatch')) {
    return { label: 'Out for Delivery 🚚', bg: 'bg-blue-50 text-blue-900 border-blue-200', icon: Truck };
  }
  if (status.includes('deliver')) {
    return { label: 'Delivered ✓', bg: 'bg-emerald-50 text-emerald-900 border-emerald-200', icon: CheckCircle2 };
  }
  if (status.includes('pack')) {
    return { label: 'Packed', bg: 'bg-purple-50 text-purple-900 border-purple-200', icon: Package };
  }
  if (status.includes('assign')) {
    return { label: 'Assigned', bg: 'bg-indigo-50 text-indigo-900 border-indigo-200', icon: Clock };
  }
  if (status.includes('confirm')) {
    return { label: 'Confirmed', bg: 'bg-teal-50 text-teal-900 border-teal-200', icon: CheckCircle2 };
  }
  if (status.includes('fail')) {
    return { label: 'Failed ❌', bg: 'bg-amber-50 text-amber-900 border-amber-200', icon: XCircle };
  }
  if (status.includes('cancel')) {
    return { label: 'Cancelled', bg: 'bg-rose-50 text-rose-900 border-rose-200', icon: XCircle };
  }
  return { label: 'Placed', bg: 'bg-sky-50 text-sky-900 border-sky-200', icon: Clock };
}

function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
}

// Readable Status Action Dropdown (h-9 with generous padding)
function StatusDropdownMenu({
  orderId,
  onUpdateStatus,
}: {
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
        className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-2xs whitespace-nowrap"
        title="Update order stage"
      >
        <Sparkles size={13} className="text-emerald-600" />
        <span>Update Status</span>
        <ChevronDown size={12} className="text-emerald-700" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 z-20 w-44 rounded-xl bg-white border border-gray-200 shadow-xl py-1 text-xs space-y-0.5 animate-in fade-in duration-150">
            <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
              Select New Stage
            </div>
            {options.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    onUpdateStatus(orderId, opt.key);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 font-semibold flex items-center gap-2 transition-colors ${opt.color}`}
                >
                  <Icon size={13} />
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

export default function OrderCardView({
  orders,
  loading,
  onViewOrder,
  onUpdateStatus,
}: OrderCardViewProps) {
  // 20-Cards-Per-Page Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));

  // Reset to page 1 if orders array changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [orders.length]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return orders.slice(start, start + pageSize);
  }, [currentPage, orders]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-gray-200 animate-pulse space-y-3 shadow-2xs">
            <div className="h-6 bg-gray-200 rounded-lg w-1/3" />
            <div className="h-4 bg-gray-100 rounded w-2/3" />
            <div className="h-16 bg-gray-50 rounded-xl" />
            <div className="h-8 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200 text-gray-500 space-y-2">
        <Package size={36} className="text-gray-300" />
        <p className="text-sm font-semibold">No orders matched your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {paginatedOrders.map((order) => {
          const rawOrderId = order.order_id || order.id || 'N/A';
          const orderId = stripHtml(rawOrderId);
          const rawSource = stripHtml(order.order_source || order.order_type || '');
          const isSubscription = Boolean(
            order.is_subscription ||
            rawSource.toLowerCase().includes('sub') ||
            order.subscription_id
          );

          const statusInfo = getLightStatusBadge(order.order_status || order.status);
          const StatusIcon = statusInfo.icon;

          const rawSlot = stripHtml(order.delivery_slot || order.slot || '');
          const isMorning = rawSlot.toLowerCase().includes('morning');

          const customerName = stripHtml(order.customer_name || order.customer_id || 'Customer');
          const customerPhone = stripHtml(order.customer_phone || order.phone || order.contact_number || '');
          const addressArea = stripHtml(order.delivery_address || order.area || order.pincode || '');

          return (
            <div
              key={orderId}
              className="group bg-white rounded-2xl border border-gray-200/90 shadow-2xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between"
            >
              {/* Top Light Status Banner */}
              <div className={`px-4 py-2 flex items-center justify-between text-xs font-bold border-b ${statusInfo.bg}`}>
                <div className="flex items-center gap-1.5">
                  <StatusIcon size={14} />
                  <span>{statusInfo.label}</span>
                </div>
                <span className="text-xs font-mono font-bold">#{orderId}</span>
              </div>

              {/* Main Card Content */}
              <div className="p-4 space-y-3 flex-1">
                {/* Order Type Tag & Delivery Slot ("Subscribed" badge & "One-Time" badge) */}
                <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                  {isSubscription ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 whitespace-nowrap">
                      <Repeat size={13} className="text-purple-600 shrink-0" /> Subscribed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                      <ShoppingCart size={13} className="text-emerald-600 shrink-0" /> One-Time
                    </span>
                  )}

                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap ${
                    isMorning
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                  }`}>
                    {isMorning ? <Sun size={11} /> : <Moon size={11} />}
                    {rawSlot || 'Standard'}
                  </span>
                </div>

                {/* Customer Info Box */}
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/70 space-y-1">
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <User size={12} className="text-slate-400 shrink-0" />
                    {customerName}
                  </p>
                  {customerPhone && (
                    <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                      <Phone size={12} className="text-slate-400 shrink-0" />
                      {customerPhone}
                    </p>
                  )}
                  {addressArea && (
                    <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 line-clamp-1">
                      <MapPin size={12} className="text-slate-400 shrink-0" />
                      {addressArea}
                    </p>
                  )}
                </div>

                {/* Pricing & Item Count */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 block">Total Amount</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-lg font-extrabold text-emerald-700">
                        {formatMoney(order.total_amount || order.amount)}
                      </span>
                      <PaymentStatusBadge
                        paymentStatus={order.payment_status}
                        paymentMode={order.payment_mode}
                      />
                    </div>
                  </div>
                  {order.items_count && (
                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-gray-500 block">Items</span>
                      <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-md">
                        {order.items_count} item(s)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions (Matching h-9 heights, "View" text & generous padding) */}
              <div className="p-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => onViewOrder(order)}
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 bg-white hover:bg-gray-100 text-gray-800 text-xs font-semibold rounded-xl border border-gray-200 shadow-2xs transition-colors whitespace-nowrap"
                  title="View order items and details"
                >
                  <Eye size={13} /> View
                </button>

                {onUpdateStatus && (
                  <StatusDropdownMenu
                    orderId={orderId}
                    onUpdateStatus={onUpdateStatus}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer (20 Items Per Page) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-2xs text-xs font-medium text-gray-600">
        <div>
          Showing{' '}
          <span className="font-bold text-slate-900">
            {(currentPage - 1) * pageSize + 1}
          </span>{' '}
          to{' '}
          <span className="font-bold text-slate-900">
            {Math.min(currentPage * pageSize, orders.length)}
          </span>{' '}
          of <span className="font-bold text-slate-900">{orders.length}</span> orders
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors font-semibold"
          >
            <ChevronLeft size={14} />
            Previous
          </button>

          <span className="px-3 py-1 bg-gray-100 rounded-lg text-slate-800 font-bold border border-gray-200">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors font-semibold"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
