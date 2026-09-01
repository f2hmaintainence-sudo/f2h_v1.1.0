// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : OrderActionModal.tsx
// Description : Premium Order Action Confirmation Modal
//
// ============================================================================

'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  Wallet,
  Repeat,
  ShoppingBag,
  ShieldAlert,
  Loader2,
  Calendar,
} from 'lucide-react';

export type ModalType = 'bulk-fail' | 'bulk-deliver' | 'single-fail' | 'single-deliver' | null;

export interface ModalData {
  orderId?: string;
  customerName?: string;
  isSubscription?: boolean;
  isPrepaid?: boolean;
  totalAmount?: number;
  date?: string;
  fromDate?: string;
  toDate?: string;
  slot?: string;
  isRange?: boolean;
  scopeLabel?: string;
}

export interface BulkActionPayload {
  scope?: string;
  fromDate?: string;
  toDate?: string;
  date?: string;
}

interface OrderActionModalProps {
  isOpen: boolean;
  type: ModalType;
  data?: ModalData;
  loading: boolean;
  onClose: () => void;
  onConfirm: (payload?: BulkActionPayload) => void;
}

function getTodayDateString(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function getLastMonthInfo() {
  const d = new Date();
  const firstDay = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth(), 0);
  const fromStr = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;
  const toStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(firstDay);
  return { fromStr, toStr, monthName, days: lastDay.getDate() };
}

function checkIsPastDate(dateStr?: string): boolean {
  if (!dateStr || dateStr.toLowerCase() === 'today') return false;
  let normalized = dateStr.trim();
  if (normalized.includes('-')) {
    const parts = normalized.split('-');
    if (parts[2]?.length === 4) {
      normalized = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  const today = getTodayDateString();
  return normalized < today;
}

export default function OrderActionModal({
  isOpen,
  type,
  data,
  loading,
  onClose,
  onConfirm,
}: OrderActionModalProps) {
  const lastMonth = getLastMonthInfo();
  const hasFilterRange = !!(data?.fromDate && data?.toDate);
  const [scopeMode, setScopeMode] = React.useState<'last_month' | 'filter_range' | 'single_date'>(
    hasFilterRange ? 'filter_range' : 'last_month'
  );

  React.useEffect(() => {
    if (isOpen) {
      setScopeMode(hasFilterRange ? 'filter_range' : 'last_month');
    }
  }, [isOpen, hasFilterRange]);

  if (!isOpen || !type) return null;

  const isBulkFail = type === 'bulk-fail';
  const isBulkDeliver = type === 'bulk-deliver';
  const isSingleFail = type === 'single-fail';
  const isSingleDeliver = type === 'single-deliver';

  const isPast = isBulkFail
    ? scopeMode === 'last_month'
      ? true
      : scopeMode === 'filter_range'
        ? checkIsPastDate(data?.toDate || data?.fromDate)
        : checkIsPastDate(data?.date)
    : true;

  const handleConfirm = () => {
    if (isBulkFail) {
      if (scopeMode === 'last_month') {
        onConfirm({ scope: 'last_month', fromDate: lastMonth.fromStr, toDate: lastMonth.toStr });
      } else if (scopeMode === 'filter_range') {
        onConfirm({ fromDate: data?.fromDate, toDate: data?.toDate });
      } else {
        onConfirm({ date: data?.date });
      }
    } else {
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden transform animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon / Accent */}
        <div
          className={`px-6 py-5 border-b flex items-center justify-between ${
            isBulkFail || isSingleFail
              ? 'bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border-amber-200/80'
              : 'bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border-emerald-200/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl border shadow-2xs ${
                isBulkFail || isSingleFail
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
              }`}
            >
              {isBulkFail ? (
                <ShieldAlert className="w-5 h-5 text-amber-700" />
              ) : isSingleFail ? (
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              )}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                {isBulkFail && 'Bulk Mark as Failed & Refund'}
                {isBulkDeliver && 'Bulk Mark as Delivered'}
                {isSingleFail && 'Mark Order as Failed'}
                {isSingleDeliver && 'Mark Order as Delivered'}
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {isBulkFail && 'Batch status update with automated refund routing'}
                {isBulkDeliver && 'Batch delivery status update for date / range'}
                {isSingleFail && `Order #${data?.orderId || ''}`}
                {isSingleDeliver && `Order #${data?.orderId || ''}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-slate-700">
          {/* BULK FAIL CONTENT */}
          {isBulkFail && (
            <div className="space-y-4">
              {/* Target Scope Selection Tabs */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                  Select Target Period:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setScopeMode('last_month')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-1 cursor-pointer ${
                      scopeMode === 'last_month'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-950 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Calendar size={13} className={scopeMode === 'last_month' ? 'text-amber-600' : 'text-slate-400'} />
                      Last Month
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal truncate">
                      {lastMonth.monthName}
                    </span>
                  </button>

                  {hasFilterRange && (
                    <button
                      type="button"
                      onClick={() => setScopeMode('filter_range')}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-1 cursor-pointer ${
                        scopeMode === 'filter_range'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-950 ring-2 ring-amber-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Calendar size={13} className={scopeMode === 'filter_range' ? 'text-amber-600' : 'text-slate-400'} />
                        Filter Range
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal truncate">
                        {data?.fromDate} – {data?.toDate}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setScopeMode('single_date')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-1 cursor-pointer ${
                      scopeMode === 'single_date'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-950 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Calendar size={13} className={scopeMode === 'single_date' ? 'text-amber-600' : 'text-slate-400'} />
                      Specific Date
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal truncate">
                      {data?.date || data?.fromDate || 'Selected'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Scope Summary Box */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950">Active Batch Scope:</span>
                  <span className="font-mono font-bold text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">
                    {scopeMode === 'last_month' && `Full Month: ${lastMonth.fromStr} to ${lastMonth.toStr}`}
                    {scopeMode === 'filter_range' && `Range: ${data?.fromDate} to ${data?.toDate}`}
                    {scopeMode === 'single_date' && `Date: ${data?.date || data?.fromDate || 'Today'}`}
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  {scopeMode === 'last_month' && `⚡ Will process all undelivered orders across the entire month of ${lastMonth.monthName}.`}
                  {scopeMode === 'filter_range' && `⚡ Will process all undelivered orders between ${data?.fromDate} and ${data?.toDate}.`}
                  {scopeMode === 'single_date' && `⚡ Will process all undelivered orders on ${data?.date || data?.fromDate || 'Today'}.`}
                </p>
              </div>

              <div className="space-y-2.5">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Automated Processing Policy:
                </p>

                {/* Policy Card 1: One-Time */}
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-xs">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 shrink-0 mt-0.5">
                    <Wallet size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-extrabold text-amber-950">
                      <ShoppingBag size={13} />
                      <span>One-Time Prepaid Orders</span>
                      <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded font-black text-[10px]">
                        AUTO-REFUND
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900/90 mt-1 leading-relaxed">
                      Prepaid amount is <strong>automatically credited</strong> back into the customer's wallet balance with an audit ledger entry and push notification.
                    </p>
                  </div>
                </div>

                {/* Policy Card 2: Subscription */}
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/90 text-xs">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-900 border border-purple-300 shrink-0 mt-0.5">
                    <Repeat size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-extrabold text-purple-950">
                      <span>Subscription Deliveries</span>
                      <span className="bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded font-bold text-[10px]">
                        STATUS ONLY
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-900/90 mt-1 leading-relaxed">
                      Order status will be updated to <strong>Failed</strong> without wallet deduction, following the recurring cycle policy.
                    </p>
                  </div>
                </div>
              </div>

              {!isPast ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-900">Bulk failure can only be processed for past dates.</p>
                    <p className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                      Active orders for today are in progress. Please select <strong>Last Month</strong> or a past date range.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  ⚠️ All pending undelivered orders in this period will transition to Failed.
                </div>
              )}
            </div>
          )}

          {/* BULK DELIVER CONTENT */}
          {isBulkDeliver && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Are you sure you want to mark all <strong>"Out for Delivery" / Pending</strong> orders as <strong>Delivered</strong> for {data?.fromDate && data?.toDate ? `${data.fromDate} to ${data.toDate}` : (data?.date || 'today')}?
              </p>
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <span className="text-xs text-emerald-900 font-semibold">
                  This will also trigger first-order unlock and referral reward engines for eligible customers.
                </span>
              </div>
            </div>
          )}

          {/* SINGLE ORDER FAIL CONTENT */}
          {isSingleFail && (
            <div className="space-y-3.5">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-900">{data?.customerName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Order Source:</span>
                  <span className={`font-bold px-2 py-0.5 rounded-md border text-[11px] ${
                    data?.isSubscription
                      ? 'bg-purple-50 text-purple-900 border-purple-200'
                      : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  }`}>
                    {data?.isSubscription ? 'Subscription Delivery' : 'One-Time Order'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Order Amount:</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    ₹{Number(data?.totalAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {!data?.isSubscription && data?.isPrepaid ? (
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                    <Wallet size={15} className="text-amber-700" />
                    <span>Automated Refund to Wallet</span>
                  </div>
                  <p className="text-[11px] text-amber-900">
                    <strong>₹{Number(data?.totalAmount || 0).toFixed(2)}</strong> will be instantly credited to the customer's wallet balance.
                  </p>
                </div>
              ) : data?.isSubscription ? (
                <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-[11px] text-purple-950 font-medium">
                  🥛 Subscription delivery will be marked as Failed. No wallet refund is deducted for daily recurring milk subscriptions.
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-600">
                  Unpaid COD order. No wallet refund is required.
                </div>
              )}
            </div>
          )}

          {/* SINGLE ORDER DELIVER CONTENT */}
          {isSingleDeliver && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                Mark Order <strong>#{data?.orderId}</strong> as <strong>Delivered</strong>?
              </p>
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                <span>Customer delivery status will be confirmed.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-200/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || (isBulkFail && !isPast)}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
              isBulkFail || isSingleFail
                ? 'bg-gradient-to-r from-amber-600 via-rose-600 to-amber-700 hover:from-amber-700 hover:to-rose-700 shadow-amber-600/20'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/20'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                {isBulkFail && (isPast ? (scopeMode === 'last_month' ? 'Confirm Full Last Month Failure' : 'Confirm & Process Bulk Failure') : 'Past Dates Only')}
                {isBulkDeliver && 'Confirm All Delivered'}
                {isSingleFail && 'Confirm Mark as Failed'}
                {isSingleDeliver && 'Confirm Delivered'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
