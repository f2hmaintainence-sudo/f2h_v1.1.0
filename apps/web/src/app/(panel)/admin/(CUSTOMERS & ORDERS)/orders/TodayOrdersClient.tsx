// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : TodayOrdersClient.tsx
// Description : Today orders component for admin panel
//
// ============================================================================

'use client';

import { getApiBaseUrl } from '@/lib/api-config';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Home,
  Package,
  PackageOpen,
  RefreshCw,
  ShoppingCart,
  Truck,
  X,
  XCircle,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Repeat,
} from 'lucide-react';
import Link from 'next/link';
import SkeletonTable from '@/components/Table Generator/SkeletonTable';

type OrderTab = 'all' | 'one-time' | 'subscription';

interface TodayOrdersClientProps {
  initialTab?: OrderTab;
  title?: string;
  scope?: 'today' | 'all';
  fixedTab?: boolean;
  endpointOverride?: string;
  filters?: string[];
  showDashboard?: boolean;
}

interface OrderItem {
  id: number | string;
  product_id?: string;
  product_name?: string;
  product_variant_id?: string;
  variant_id?: string;
  variant_name?: string;
  unit_price?: string | number;
  discount_amount?: string | number;
  coupon_amount?: string | number;
  final_price?: string | number;
  is_free?: boolean;
  quantity?: string | number;
  default_m_quantity?: string | number;
  default_e_quantity?: string | number;
}

interface DashboardSummary {
  total_orders: number;
  pending: number;
  placed: number;
  confirmed: number;
  packed: number;
  out_for_delivery: number;
  delivered: number;
  cancelled: number;
  revenue: number;
  subscription_count: number;
  one_time_count: number;
}

const API_URL = getApiBaseUrl();

function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  });
}

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const SUMMARY_CARDS = [
  { key: 'total_orders', label: 'Total Orders', icon: ShoppingCart, gradient: 'from-slate-500 to-slate-700', bg: 'bg-slate-50' },
  { key: 'pending', label: 'Pending', icon: Clock, gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-50' },
  { key: 'placed', label: 'Placed', icon: Package, gradient: 'from-sky-500 to-sky-600', bg: 'bg-sky-50' },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, gradient: 'from-teal-500 to-teal-600', bg: 'bg-teal-50' },
  { key: 'packed', label: 'Packed', icon: Package, gradient: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle, gradient: 'from-rose-500 to-rose-600', bg: 'bg-rose-50' },
] as const;

export default function TodayOrdersClient({
  initialTab = 'all',
  title = "Today's Orders",
  scope = 'today',
  fixedTab = false,
  endpointOverride,
  filters = [],
  showDashboard = true,
}: TodayOrdersClientProps) {
  const [activeTab, setActiveTab] = useState<OrderTab>(initialTab);
  const [tableKey, setTableKey] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Record<string, any> | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState('');

  // Dashboard state
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Bulk action state
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // PDF export state
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Fetch summary for dashboard cards
  const fetchSummary = useCallback(async () => {
    if (!showDashboard) return;
    setSummaryLoading(true);
    try {
      const summaryPath = scope === 'today' ? 'today/summary' : 'summary';
      const res = await fetch(`${API_URL}/admin/orders/${summaryPath}`, {
        credentials: 'include',
      });
      const result = await res.json();
      if (result.status) {
        setSummary(result.data);
      }
    } catch {
      // Silently fail; summary is non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, [scope, showDashboard]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const endpoint = useMemo(() => {
    const appendFilters = (path: string) => {
      const url = new URL(path, 'http://local');
      filters.forEach((filter) => url.searchParams.append('filters', filter));
      return url.pathname + url.search;
    };

    if (endpointOverride) return appendFilters(endpointOverride);

    if (activeTab === 'subscription') {
      const params = new URLSearchParams({ type: 'subscription' });
      if (scope === 'today') params.set('today', '1');
      return appendFilters(`/admin/orders/subscription-orders/table?${params.toString()}`);
    }

    if (activeTab === 'one-time') {
      const params = new URLSearchParams({ type: 'one-time' });
      if (scope === 'today') params.set('today', '1');
      return appendFilters(`/admin/orders/onetime-orders/table?${params.toString()}`);
    }

    // "all" tab uses the unified table
    if (scope === 'today') {
      return appendFilters(`/admin/orders/today/table`);
    }
    return appendFilters(`/admin/orders/table`);
  }, [activeTab, endpointOverride, filters, scope]);

  const handleAction = useCallback((type: string, row: Record<string, any>) => {
    if (type !== 'view') return;
    setSelectedOrder(row);
    setItems([]);
    setItemsError('');

    const rawOrderId = row.order_id;
    if (!rawOrderId || rawOrderId === 'null' || rawOrderId === 'undefined') {
      setItemsError('No order_id is linked to this row yet.');
      setLoadingItems(false);
      return;
    }

    const orderId = encodeURIComponent(String(rawOrderId));

    setLoadingItems(true);
    fetch(`${API_URL}/admin/orders/${orderId}/items`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.status) {
          setItems(Array.isArray(result.data) ? result.data : []);
        } else {
          setItemsError(result.message || 'Failed to load order items');
        }
      })
      .catch(() => setItemsError('Failed to load order items'))
      .finally(() => setLoadingItems(false));
  }, []);

  const closeItems = () => {
    setSelectedOrder(null);
    setItems([]);
    setItemsError('');
    setLoadingItems(false);
  };

  const handleBulkDeliver = async () => {
    if (!confirm('Mark ALL "Out for Delivery" orders as Delivered for today?')) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const res = await fetch(`${API_URL}/admin/orders/today/bulk-deliver`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (result.status) {
        setBulkResult(`✅ ${result.updated} order(s) marked as delivered`);
        setTableKey((k) => k + 1);
        fetchSummary();
      } else {
        setBulkResult(`❌ ${result.message || 'Failed'}`);
      }
    } catch {
      setBulkResult('❌ Network error');
    } finally {
      setBulkLoading(false);
      setTimeout(() => setBulkResult(null), 5000);
    }
  };

  const handlePdfExport = async () => {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'one-time') params.set('order_source', 'one-time');
      if (activeTab === 'subscription') params.set('order_source', 'subscription');

      const res = await fetch(
        `${API_URL}/admin/orders/today/export-pdf?${params.toString()}`,
        { credentials: 'include' },
      );

      if (!res.ok) throw new Error('PDF generation failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `orders-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  const itemTotal = items.reduce((sum, item) => sum + Number(item.final_price ?? 0), 0);

  return (
    <div className="space-y-4 p-1 md:p-2 font-sans min-h-screen">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-gray-500" aria-label="Breadcrumb">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-1 hover:text-fresh-green transition-colors"
            >
              <Home size={14} />
              <span>Dashboard</span>
            </Link>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="text-gray-400">Orders</span>
            <ChevronRight size={14} className="text-gray-300" />
            <span className="font-semibold text-deep-green">{title}</span>
          </nav>
          <div className="mt-2 flex items-center gap-2">
            <CalendarDays size={18} className="text-fresh-green" />
            <h1 className="text-xl font-bold text-deep-green">{title}</h1>
            {scope === 'today' && <span className="text-sm text-gray-500">{todayLabel()}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {scope === 'today' && (
            <>
              <button
                type="button"
                onClick={handlePdfExport}
                disabled={pdfLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-deep-green to-fresh-green text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                id="btn-export-pdf"
              >
                <Download size={16} className={pdfLoading ? 'animate-bounce' : ''} />
                {pdfLoading ? 'Generating...' : 'Export PDF'}
              </button>
              <button
                type="button"
                onClick={handleBulkDeliver}
                disabled={bulkLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                id="btn-bulk-deliver"
              >
                <CheckCircle2 size={16} className={bulkLoading ? 'animate-spin' : ''} />
                {bulkLoading ? 'Processing...' : 'Mark All Delivered'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setTableKey((v) => v + 1);
              fetchSummary();
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-deep-green text-sm font-semibold rounded-lg border border-gray-200 shadow-sm hover:border-fresh-green transition-colors"
            id="btn-refresh"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Bulk action result banner ── */}
      {bulkResult && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm animate-in fade-in duration-300">
          {bulkResult}
        </div>
      )}

      {/* ── Dashboard Summary ── */}
      {showDashboard && (
        <div className="space-y-3">
          {/* Status cards row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {SUMMARY_CARDS.map(({ key, label, icon: Icon, gradient, bg }) => (
              <div
                key={key}
                className={`${bg} rounded-xl border border-gray-100/80 p-3 shadow-sm hover:shadow-md transition-shadow group`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
                    <Icon size={14} className="text-white" />
                  </div>
                </div>
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">
                  {summaryLoading ? (
                    <span className="inline-block h-5 w-10 animate-pulse rounded bg-gray-200" />
                  ) : (
                    summary?.[key as keyof DashboardSummary] ?? 0
                  )}
                </p>
              </div>
            ))}
          </div>

          {/* Revenue & Source breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-100/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Revenue</span>
              </div>
              <p className="text-2xl font-bold text-emerald-800">
                {summaryLoading ? (
                  <span className="inline-block h-7 w-24 animate-pulse rounded bg-emerald-200" />
                ) : (
                  formatMoney(summary?.revenue ?? 0)
                )}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl border border-blue-100/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart size={16} className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">One-Time Orders</span>
              </div>
              <p className="text-2xl font-bold text-blue-800">
                {summaryLoading ? (
                  <span className="inline-block h-7 w-12 animate-pulse rounded bg-blue-200" />
                ) : (
                  summary?.one_time_count ?? 0
                )}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-100/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Repeat size={16} className="text-purple-600" />
                <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Subscription Orders</span>
              </div>
              <p className="text-2xl font-bold text-purple-800">
                {summaryLoading ? (
                  <span className="inline-block h-7 w-12 animate-pulse rounded bg-purple-200" />
                ) : (
                  summary?.subscription_count ?? 0
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      {!fixedTab && (
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {([
            { key: 'all', label: 'All Orders', icon: BarChart3 },
            { key: 'one-time', label: 'One-time', icon: ShoppingCart },
            { key: 'subscription', label: 'Subscription', icon: Repeat },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${activeTab === key
                ? 'bg-fresh-green text-white shadow-sm'
                : 'text-gray-600 hover:text-deep-green'
                }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100/80">
        <SkeletonTable
          key={`${activeTab}-${tableKey}`}
          apiEndpoint={endpoint}
          onAction={handleAction}
          actionTypes={['view']}
          initialPageSize={10}
        />
      </div>

      {/* ── Order Items Drawer ── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-deep-green">
                  Order Items
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedOrder.order_id} - {selectedOrder.customer_name || selectedOrder.customer_id || 'Customer'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeItems}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-deep-green"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-auto p-5">
              {loadingItems ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-fresh-green" />
                  Loading items
                </div>
              ) : itemsError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {itemsError}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <PackageOpen size={36} className="mb-3 text-gray-300" />
                  No items found for this order.
                </div>
              ) : (
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                      <th className="px-3 py-3">Variant Id</th>
                      <th className="px-3 py-3">Product</th>
                      <th className="px-3 py-3 text-right">Qty</th>
                      <th className="px-3 py-3 text-right">Unit Price</th>
                      <th className="px-3 py-3 text-right">Discount</th>
                      <th className="px-3 py-3 text-right">Coupon</th>
                      <th className="px-3 py-3 text-right">Final</th>
                      <th className="px-3 py-3">Free</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-3 text-gray-600">
                          {item.variant_id || item.product_variant_id || '-'}
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-900">
                          {item.variant_name || item.product_name || 'Product'}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {item.quantity ?? `${item.default_m_quantity ?? 0}/${item.default_e_quantity ?? 0}`}
                        </td>
                        <td className="px-3 py-3 text-right">{formatMoney(item.unit_price)}</td>
                        <td className="px-3 py-3 text-right">{formatMoney(item.discount_amount)}</td>
                        <td className="px-3 py-3 text-right">{formatMoney(item.coupon_amount)}</td>
                        <td className="px-3 py-3 text-right font-semibold text-deep-green">
                          {formatMoney(item.final_price)}
                        </td>
                        <td className="px-3 py-3">{item.is_free ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
              <span className="text-sm text-gray-500">{items.length} item(s)</span>
              <span className="text-sm font-bold text-deep-green">Items total: {formatMoney(itemTotal)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
