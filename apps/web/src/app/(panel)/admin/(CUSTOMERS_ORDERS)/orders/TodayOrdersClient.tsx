// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : TodayOrdersClient.tsx
// Description : Executive Multi-View Orders Command Center matching F2H Admin Panel
//
// ============================================================================

'use client';

import { getApiBaseUrl } from '@/lib/api-config';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  Home,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import SkeletonTable from '@/components/Table Generator/SkeletonTable';

import OrderMetricsBar, { DashboardSummary } from './components/OrderMetricsBar';
import OrderFilterBar, { ViewMode, OrderTypeTab, DeliverySlotFilter } from './components/OrderFilterBar';
import OrderCardView, { stripHtml } from './components/OrderCardView';
import OrderDetailsDrawer, { OrderItem } from './components/OrderDetailsDrawer';

interface TodayOrdersClientProps {
  initialTab?: OrderTypeTab;
  title?: string;
  scope?: 'today' | 'all';
  fixedTab?: boolean;
  endpointOverride?: string;
  filters?: string[];
  showDashboard?: boolean;
}

const API_URL = getApiBaseUrl();

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function normalizeStatus(stRaw: unknown): string {
  if (!stRaw) return 'PLACED';
  let str = stripHtml(String(stRaw)).toLowerCase().replace(/[\s_-]+/g, '_');

  if (str.includes('out_for_delivery') || str.includes('outfordelivery') || str.includes('dispatch')) return 'OUT_FOR_DELIVERY';
  if (str.includes('deliver')) return 'DELIVERED';
  if (str.includes('pack')) return 'PACKED';
  if (str.includes('assign')) return 'ASSIGNED';
  if (str.includes('confirm')) return 'CONFIRMED';
  if (str.includes('fail')) return 'FAILED';
  if (str.includes('cancel')) return 'CANCELLED';
  if (str.includes('place')) return 'PLACED';

  return str.toUpperCase();
}

export default function TodayOrdersClient({
  initialTab = 'all',
  title = "Today's Orders",
  scope = 'today',
  fixedTab = false,
  endpointOverride,
  filters = [],
  showDashboard = true,
}: TodayOrdersClientProps) {
  // View mode state (Default to 'grid' Cards)
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<OrderTypeTab>(initialTab);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [slotFilter, setSlotFilter] = useState<DeliverySlotFilter>('all');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);

  // Date wise filter states
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Data states
  const [ordersList, setOrdersList] = useState<Record<string, any>[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [tableKey, setTableKey] = useState(0);

  // Drawer / Order items state
  const [selectedOrder, setSelectedOrder] = useState<Record<string, any> | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState('');

  // Dashboard summary state
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Bulk action & PDF state
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Fetch summary for metrics header
  const fetchSummary = useCallback(async () => {
    if (!showDashboard) return;
    setSummaryLoading(true);
    try {
      const summaryPath = scope === 'today' ? 'today/summary' : 'summary';
      const queryParams = new URLSearchParams();
      if (selectedDate) queryParams.set('date', selectedDate);
      if (fromDate) queryParams.set('fromDate', fromDate);
      if (toDate) queryParams.set('toDate', toDate);

      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const res = await fetch(`${API_URL}/admin/orders/${summaryPath}${qs}`, {
        credentials: 'include',
      });
      const result = await res.json();
      if (result.status) {
        setSummary(result.data);
      }
    } catch {
      // Silently ignore summary error
    } finally {
      setSummaryLoading(false);
    }
  }, [fromDate, scope, selectedDate, showDashboard, toDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Compute table endpoint
  const endpoint = useMemo(() => {
    const appendFilters = (path: string) => {
      const url = new URL(path, 'http://local');
      filters.forEach((filter) => url.searchParams.append('filters', filter));
      if (selectedDate) url.searchParams.append('date', selectedDate);
      if (fromDate) url.searchParams.append('fromDate', fromDate);
      if (toDate) url.searchParams.append('toDate', toDate);
      return url.pathname + url.search;
    };

    if (endpointOverride) return appendFilters(endpointOverride);

    if (activeTab === 'subscription') {
      const params = new URLSearchParams({ type: 'subscription' });
      if (scope === 'today' && !selectedDate && !fromDate && !toDate) params.set('today', '1');
      return appendFilters(`/admin/orders/subscription-orders/table?${params.toString()}`);
    }

    if (activeTab === 'one-time') {
      const params = new URLSearchParams({ type: 'one-time' });
      if (scope === 'today' && !selectedDate && !fromDate && !toDate) params.set('today', '1');
      return appendFilters(`/admin/orders/onetime-orders/table?${params.toString()}`);
    }

    if (scope === 'today' && !selectedDate && !fromDate && !toDate) {
      return appendFilters(`/admin/orders/today/table`);
    }
    return appendFilters(`/admin/orders/table`);
  }, [activeTab, endpointOverride, filters, fromDate, scope, selectedDate, toDate]);

  // Fetch orders list for Cards view
  const fetchOrdersList = useCallback(async () => {
    if (viewMode === 'table') return;
    setLoadingOrders(true);
    try {
      const fetchUrl = `${API_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}page=1&limit=300`;
      const res = await fetch(fetchUrl, { credentials: 'include' });
      const result = await res.json();

      if (result && Array.isArray(result.data)) {
        setOrdersList(result.data);
      } else if (result && Array.isArray(result.rows)) {
        setOrdersList(result.rows);
      } else if (Array.isArray(result)) {
        setOrdersList(result);
      } else {
        setOrdersList([]);
      }
    } catch {
      setOrdersList([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [endpoint, viewMode]);

  useEffect(() => {
    fetchOrdersList();
  }, [fetchOrdersList]);

  // Handle viewing order items in drawer
  const handleViewOrder = useCallback((row: Record<string, any>) => {
    setSelectedOrder(row);
    setItems([]);
    setItemsError('');

    const rawOrderId = stripHtml(row.order_id || row.id);
    if (!rawOrderId || rawOrderId === 'null' || rawOrderId === 'undefined') {
      setItemsError('No valid order ID linked to this record.');
      setLoadingItems(false);
      return;
    }

    const orderId = encodeURIComponent(String(rawOrderId));
    setLoadingItems(true);

    fetch(`${API_URL}/admin/orders/${orderId}/items`, { credentials: 'include' })
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

  const handleCloseDrawer = () => {
    setSelectedOrder(null);
    setItems([]);
    setItemsError('');
    setLoadingItems(false);
  };

  // Quick order status update
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    const cleanId = stripHtml(orderId);
    try {
      const res = await fetch(`${API_URL}/admin/delivery/orders/${encodeURIComponent(cleanId)}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await res.json();

      if (result.status || res.ok) {
        fetchOrdersList();
        fetchSummary();
        setTableKey((k) => k + 1);
        if (selectedOrder) {
          setSelectedOrder((prev) => (prev ? { ...prev, order_status: newStatus, status: newStatus } : null));
        }
      }
    } catch {
      // Ignore fallback
    }
  };

  // Handle bulk deliver
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
        fetchOrdersList();
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

  // Handle PDF Export
  const handlePdfExport = async () => {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'one-time') params.set('order_source', 'one-time');
      if (activeTab === 'subscription') params.set('order_source', 'subscription');

      const res = await fetch(`${API_URL}/admin/orders/today/export-pdf?${params.toString()}`, {
        credentials: 'include',
      });

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

  // Filtered orders list for Cards view
  const filteredOrders = useMemo(() => {
    return ordersList.filter((order) => {
      // 1. Order Type Tab Filter
      if (activeTab === 'one-time') {
        const source = stripHtml(order.order_source || order.order_type || '').toLowerCase();
        if (source === 'subscription' || order.is_subscription || order.subscription_id) return false;
      }
      if (activeTab === 'subscription') {
        const source = stripHtml(order.order_source || order.order_type || '').toLowerCase();
        if (source !== 'subscription' && !order.is_subscription && !order.subscription_id) return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const oId = stripHtml(order.order_id || order.id || '').toLowerCase();
        const cName = stripHtml(order.customer_name || order.customer_id || '').toLowerCase();
        const cPhone = stripHtml(order.customer_phone || order.phone || order.contact_number || '').toLowerCase();
        const area = stripHtml(order.area || order.pincode || order.delivery_address || '').toLowerCase();

        if (!oId.includes(q) && !cName.includes(q) && !cPhone.includes(q) && !area.includes(q)) {
          return false;
        }
      }

      // 3. Slot Filter
      if (slotFilter !== 'all') {
        const slotStr = stripHtml(order.delivery_slot || order.slot || '').toLowerCase();
        if (slotFilter === 'morning' && !slotStr.includes('morning')) return false;
        if (slotFilter === 'evening' && !slotStr.includes('evening')) return false;
      }

      // 4. Status Filter (from status cards click)
      if (activeStatusFilter) {
        const norm = normalizeStatus(order.order_status || order.status);
        if (norm !== activeStatusFilter) return false;
      }

      // 5. Urgent Filter
      if (urgentOnly) {
        const norm = normalizeStatus(order.order_status || order.status);
        if (norm !== 'PENDING') return false;
      }

      return true;
    });
  }, [activeStatusFilter, activeTab, ordersList, searchQuery, slotFilter, urgentOnly]);

  return (
    <div className="pt-6 md:pt-8 px-4 md:px-7 pb-10 space-y-6 font-sans min-h-screen bg-slate-50/60">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-5 md:p-6 rounded-2xl border border-gray-200/80 shadow-2xs">
        <div>
          <nav className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100/90 rounded-lg border border-slate-200/70 text-xs text-slate-500 mb-2 font-medium" aria-label="Breadcrumb">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-1 hover:text-emerald-700 transition-colors font-semibold text-slate-600"
            >
              <Home size={13} className="text-emerald-600" />
              <span>Dashboard</span>
            </Link>
            <ChevronRight size={13} className="text-slate-400" />
            <span className="text-slate-500 font-medium">Orders</span>
            <ChevronRight size={13} className="text-slate-400" />
            <span className="font-bold text-emerald-800">{title}</span>
          </nav>
          <div className="mt-1 flex items-center gap-2">
            <CalendarDays size={20} className="text-emerald-600" />
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
            {scope === 'today' && (
              <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                {todayLabel()}
              </span>
            )}
          </div>
        </div>

        {/* Global Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {scope === 'today' && (
            <>
              <button
                type="button"
                onClick={handlePdfExport}
                disabled={pdfLoading}
                className="inline-flex items-center gap-2 h-9 px-4 bg-gradient-to-r from-emerald-800 to-teal-700 text-white text-xs font-bold rounded-xl shadow-2xs hover:shadow-xs transition-all disabled:opacity-50"
              >
                <Download size={15} className={pdfLoading ? 'animate-bounce' : ''} />
                {pdfLoading ? 'Generating...' : 'Export PDF'}
              </button>
              <button
                type="button"
                onClick={handleBulkDeliver}
                disabled={bulkLoading}
                className="inline-flex items-center gap-2 h-9 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold rounded-xl shadow-2xs hover:shadow-xs transition-all disabled:opacity-50"
              >
                <CheckCircle2 size={15} className={bulkLoading ? 'animate-spin' : ''} />
                {bulkLoading ? 'Processing...' : 'Mark All Delivered'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setTableKey((v) => v + 1);
              fetchSummary();
              fetchOrdersList();
            }}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 bg-white text-slate-800 text-xs font-bold rounded-xl border border-gray-200 shadow-2xs hover:border-emerald-500 hover:text-emerald-700 transition-colors"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Bulk Action Result Banner ── */}
      {bulkResult && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900 shadow-2xs animate-in fade-in duration-300">
          {bulkResult}
        </div>
      )}

      {/* ── Executive Dashboard Summary Bar ── */}
      {showDashboard && (
        <OrderMetricsBar
          summary={summary}
          loading={summaryLoading}
          activeStatusFilter={activeStatusFilter}
          onSelectStatusFilter={setActiveStatusFilter}
        />
      )}

      {/* ── Advanced Filter & View Mode Control Bar ── */}
      <OrderFilterBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        orderType={activeTab}
        onOrderTypeChange={setActiveTab}
        fixedTab={fixedTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        slotFilter={slotFilter}
        onSlotFilterChange={setSlotFilter}
        urgentOnly={urgentOnly}
        onUrgentToggle={() => setUrgentOnly((v) => !v)}
        selectedDate={selectedDate}
        onSelectedDateChange={(d) => { setSelectedDate(d); setFromDate(''); setToDate(''); }}
        fromDate={fromDate}
        onFromDateChange={(fd) => { setFromDate(fd); setSelectedDate(''); }}
        toDate={toDate}
        onToDateChange={(td) => { setToDate(td); setSelectedDate(''); }}
        onClearDates={() => { setSelectedDate(''); setFromDate(''); setToDate(''); }}
      />

      {/* ── View Mode Containers ── */}

      {/* 1. Grid Cards View (Default View Mode) */}
      {viewMode === 'grid' && (
        <OrderCardView
          orders={filteredOrders}
          loading={loadingOrders}
          onViewOrder={handleViewOrder}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {/* 2. Dense Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl shadow-2xs border border-gray-200/90 overflow-hidden p-2">
          <SkeletonTable
            key={`${activeTab}-${tableKey}`}
            apiEndpoint={endpoint}
            onAction={(type, row) => {
              if (type === 'view') handleViewOrder(row);
            }}
            actionTypes={['view']}
            initialPageSize={20}
          />
        </div>
      )}

      {/* ── Order Details Slide-over Drawer ── */}
      <OrderDetailsDrawer
        order={selectedOrder}
        items={items}
        loadingItems={loadingItems}
        itemsError={itemsError}
        onClose={handleCloseDrawer}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}
