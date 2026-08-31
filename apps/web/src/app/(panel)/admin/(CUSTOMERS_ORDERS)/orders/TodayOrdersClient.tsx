// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : TodayOrdersClient.tsx
// Description : Orders Command Center — table-only view with timeline
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
  FileSpreadsheet,
  Home,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

import OrderMetricsBar, { DashboardSummary } from './components/OrderMetricsBar';
import OrderFilterBar, { OrderTypeTab, DeliverySlotFilter } from './components/OrderFilterBar';
import OrderDetailsDrawer from './components/OrderDetailsDrawer';
import { stripHtml } from './components/OrderDetailsDrawer';
import OrdersTable from './components/OrdersTable';
import OrderActionModal, { ModalType, ModalData } from './components/OrderActionModal';
import { downloadCSV, downloadExcel, ExportColumn } from '@/lib/exportUtils';

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
const EXPORT_PAGE_SIZE = 1000;

const ORDER_EXPORT_COLUMNS: ExportColumn<Record<string, any>>[] = [
  { header: 'Order ID', accessor: (order) => stripHtml(order.order_id || order.id) },
  { header: 'Customer', accessor: (order) => stripHtml(order.customer_name || order.customer_id) },
  { header: 'Phone', accessor: (order) => stripHtml(order.customer_phone || order.contact_number || order.phone) },
  { header: 'Order Type', accessor: (order) => stripHtml(order.order_source) },
  { header: 'Scheduled Date', accessor: (order) => stripHtml(order.scheduled_date) },
  { header: 'Delivery Slot', accessor: (order) => stripHtml(order.delivery_slot || order.slot) },
  { header: 'Status', accessor: (order) => stripHtml(order.order_status || order.status) },
  { header: 'Payment Status', accessor: (order) => stripHtml(order.payment_status) },
  { header: 'Payment Mode', accessor: (order) => stripHtml(order.payment_mode) },
  { header: 'Subtotal', accessor: (order) => Number(order.subtotal || 0) },
  { header: 'Discount', accessor: (order) => Number(order.discount_amount || 0) },
  { header: 'GST', accessor: (order) => Number(order.gst_amount || 0) },
  { header: 'Total Amount', accessor: (order) => Number(order.total_amount || order.amount || 0) },
  { header: 'Created At', accessor: (order) => stripHtml(order.created_at) },
];

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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
  const [activeTab, setActiveTab] = useState<OrderTypeTab>(initialTab);

  // Filter states
  const [searchQuery, setSearchQuery]   = useState('');
  const [slotFilter, setSlotFilter]     = useState<DeliverySlotFilter>('all');
  const [urgentOnly, setUrgentOnly]     = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);

  // Date filter states
  const [selectedDate, setSelectedDate] = useState('');
  const [fromDate, setFromDate]         = useState('');
  const [toDate, setToDate]             = useState('');

  // Refresh key
  const [tableKey, setTableKey] = useState(0);

  // Dashboard summary
  const [summary, setSummary]           = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Bulk / PDF
  const [bulkLoading, setBulkLoading]   = useState(false);
  const [bulkResult, setBulkResult]     = useState<string | null>(null);
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [exportLoading, setExportLoading] = useState<'excel' | 'csv' | null>(null);

  // Action Confirmation Modal
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    data?: ModalData;
  }>({
    isOpen: false,
    type: null,
  });

  // Drawer
  const [selectedOrder, setSelectedOrder] = useState<Record<string, any> | null>(null);
  const [items, setItems]                 = useState<any[]>([]);
  const [loadingItems, setLoadingItems]   = useState(false);
  const [itemsError, setItemsError]       = useState('');

  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);

  // ── Fetch Summary ──────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    if (!showDashboard) return;
    setSummaryLoading(true);
    try {
      const summaryPath = scope === 'today' ? 'today/summary' : 'summary';
      const qp = new URLSearchParams();
      if (selectedDate) qp.set('date', selectedDate);
      if (fromDate)     qp.set('fromDate', fromDate);
      if (toDate)       qp.set('toDate', toDate);
      const qs = qp.toString() ? `?${qp}` : '';
      const res = await fetch(`${API_URL}/admin/orders/${summaryPath}${qs}`, { credentials: 'include' });
      const result = await res.json();
      if (result.status) setSummary(result.data);
    } catch { /* silent */ } finally {
      setSummaryLoading(false);
    }
  }, [fromDate, scope, selectedDate, showDashboard, toDate]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // ── Compute endpoint ───────────────────────────────────────────────────────
  const endpoint = useMemo(() => {
    const appendFilters = (path: string) => {
      const url = new URL(path, 'http://local');
      filters.forEach((f) => url.searchParams.append('filters', f));
      if (selectedDate) url.searchParams.append('date', selectedDate);
      if (fromDate)     url.searchParams.append('fromDate', fromDate);
      if (toDate)       url.searchParams.append('toDate', toDate);
      return url.pathname + url.search;
    };

    if (endpointOverride) return appendFilters(endpointOverride);

    if (activeTab === 'undelivered') {
      const p = new URLSearchParams({ type: 'undelivered' });
      if (scope === 'today' && !selectedDate && !fromDate && !toDate) p.set('today', '1');
      return appendFilters(`/admin/orders/table?${p}`);
    }
    if (activeTab === 'subscription') {
      const p = new URLSearchParams({ type: 'subscription' });
      if (scope === 'today' && !selectedDate && !fromDate && !toDate) p.set('today', '1');
      return appendFilters(`/admin/orders/subscription-orders/table?${p}`);
    }
    if (activeTab === 'one-time') {
      const p = new URLSearchParams({ type: 'one-time' });
      if (scope === 'today' && !selectedDate && !fromDate && !toDate) p.set('today', '1');
      return appendFilters(`/admin/orders/onetime-orders/table?${p}`);
    }
    if (scope === 'today' && !selectedDate && !fromDate && !toDate) {
      return appendFilters(`/admin/orders/today/table`);
    }
    return appendFilters(`/admin/orders/table`);
  }, [activeTab, endpointOverride, filters, fromDate, scope, selectedDate, toDate]);

  // ── View Order (opens drawer) ─────────────────────────────────────────────
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

    Promise.all([
      fetch(`${API_URL}/admin/orders/${orderId}/view`, { credentials: 'include' }),
      fetch(`${API_URL}/admin/orders/${orderId}/items`, { credentials: 'include' }),
    ])
      .then(async ([detailResponse, itemsResponse]) => {
        if (!detailResponse.ok || !itemsResponse.ok) {
          throw new Error('Failed to load complete order details');
        }

        const [detailResult, itemsResult] = await Promise.all([
          detailResponse.json(),
          itemsResponse.json(),
        ]);

        if (detailResult.status && detailResult.data) {
          setSelectedOrder((current) => current ? { ...current, ...detailResult.data } : detailResult.data);
        }
        if (itemsResult.status) {
          setItems(Array.isArray(itemsResult.data) ? itemsResult.data : []);
        } else {
          setItemsError(itemsResult.message || 'Failed to load order items');
        }
      })
      .catch(() => setItemsError('Failed to load complete order details'))
      .finally(() => setLoadingItems(false));
  }, []);

  const handleCloseDrawer = () => {
    setSelectedOrder(null);
    setItems([]);
    setItemsError('');
    setLoadingItems(false);
  };

  // ── Update status ─────────────────────────────────────────────────────────
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
        fetchSummary();
        setTableKey((k) => k + 1);
        if (selectedOrder) {
          setSelectedOrder((prev) => prev ? { ...prev, order_status: newStatus, status: newStatus } : null);
        }
      }
    } catch { /* ignore */ }
  };

  // ── Bulk deliver ──────────────────────────────────────────────────────────
  const handleBulkDeliver = () => {
    setActionModal({
      isOpen: true,
      type: 'bulk-deliver',
      data: { date: 'Today' },
    });
  };

  // ── Bulk Mark Failed ────────────────────────────────────────────────────────
  const handleBulkFail = () => {
    const targetDate = selectedDate || fromDate || 'Today';
    setActionModal({
      isOpen: true,
      type: 'bulk-fail',
      data: { date: targetDate },
    });
  };

  // ── Confirm Modal Action Execution ─────────────────────────────────────────
  const handleConfirmModalAction = async () => {
    if (actionModal.type === 'bulk-fail') {
      setBulkLoading(true);
      setBulkResult(null);
      try {
        const p = new URLSearchParams();
        const targetDate = selectedDate || fromDate || '';
        if (targetDate) p.set('date', targetDate);
        const res = await fetch(`${API_URL}/admin/orders/bulk-fail?${p}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        const result = await res.json();
        if (result.status) {
          setBulkResult(`✅ ${result.message || `${result.updated} orders marked as failed`}`);
          setTableKey((k) => k + 1);
          fetchSummary();
        } else {
          setBulkResult(`❌ ${result.message || 'Failed'}`);
        }
      } catch {
        setBulkResult('❌ Network error');
      } finally {
        setBulkLoading(false);
        setActionModal({ isOpen: false, type: null });
        setTimeout(() => setBulkResult(null), 8000);
      }
    } else if (actionModal.type === 'bulk-deliver') {
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
        setActionModal({ isOpen: false, type: null });
        setTimeout(() => setBulkResult(null), 5000);
      }
    }
  };

  // ── PDF Export ────────────────────────────────────────────────────────────
  const handlePdfExport = async () => {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'one-time')     params.set('order_source', 'one-time');
      if (activeTab === 'subscription') params.set('order_source', 'subscription');

      const res = await fetch(`${API_URL}/admin/orders/today/export-pdf?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
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

  const handleDataExport = async (format: 'excel' | 'csv') => {
    setExportLoading(format);
    try {
      const exportUrl = new URL(`${API_URL}${endpoint}`);
      if (activeStatusFilter) exportUrl.searchParams.set('status', activeStatusFilter);
      if (searchQuery.trim()) exportUrl.searchParams.set('search', searchQuery.trim());
      if (slotFilter !== 'all') exportUrl.searchParams.set('col_delivery_slot', slotFilter);
      exportUrl.searchParams.set('limit', String(EXPORT_PAGE_SIZE));

      const rows: Record<string, any>[] = [];
      let page = 1;
      let total = Number.POSITIVE_INFINITY;

      while (rows.length < total) {
        exportUrl.searchParams.set('page', String(page));
        const response = await fetch(exportUrl.toString(), { credentials: 'include' });
        if (!response.ok) throw new Error(`Export request failed with HTTP ${response.status}`);

        const result = await response.json();
        const batch = Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.rows) ? result.rows : Array.isArray(result) ? result : [];
        total = Number(result?.recordsFiltered ?? result?.total ?? result?.count ?? batch.length);
        rows.push(...batch);

        if (batch.length < EXPORT_PAGE_SIZE) break;
        page += 1;
      }

      if (rows.length === 0) {
        alert('No orders match the current filters.');
        return;
      }

      const datePart = selectedDate || (fromDate && toDate ? `${fromDate}-to-${toDate}` : new Date().toISOString().slice(0, 10));
      const filename = `orders-${datePart}`;
      if (format === 'excel') {
        downloadExcel(filename, 'Orders', ORDER_EXPORT_COLUMNS, rows);
      } else {
        downloadCSV(filename, ORDER_EXPORT_COLUMNS, rows);
      }
    } catch {
      alert(`Failed to export ${format === 'excel' ? 'Excel' : 'CSV'}. Please try again.`);
    } finally {
      setExportLoading(null);
    }
  };

  return (
    <div className="pt-6 md:pt-8 px-4 md:px-7 pb-10 space-y-5 font-sans bg-slate-50/60 min-h-screen overflow-x-hidden">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-5 md:p-6 rounded-2xl border border-gray-200/80 shadow-2xs">
        <div>
          <nav className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100/90 rounded-lg border border-slate-200/70 text-xs text-slate-500 mb-2 font-medium" aria-label="Breadcrumb">
            <Link href="/admin/dashboard" className="inline-flex items-center gap-1 hover:text-emerald-700 transition-colors font-semibold text-slate-600">
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

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleDataExport('excel')}
            disabled={exportLoading !== null}
            className="inline-flex items-center gap-2 h-9 px-4 bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs hover:bg-emerald-800 transition-all disabled:opacity-50"
            title="Export all orders matching the current filters to Excel"
          >
            <FileSpreadsheet size={15} className={exportLoading === 'excel' ? 'animate-bounce' : ''} />
            {exportLoading === 'excel' ? 'Exporting...' : 'Excel'}
          </button>
          <button
            type="button"
            onClick={() => handleDataExport('csv')}
            disabled={exportLoading !== null}
            className="inline-flex items-center gap-2 h-9 px-4 bg-white text-slate-800 text-xs font-bold rounded-xl border border-gray-200 shadow-2xs hover:border-emerald-500 hover:text-emerald-700 transition-colors disabled:opacity-50"
            title="Export all orders matching the current filters to CSV"
          >
            <Download size={15} className={exportLoading === 'csv' ? 'animate-bounce' : ''} />
            {exportLoading === 'csv' ? 'Exporting...' : 'CSV'}
          </button>
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
              {activeTab !== 'undelivered' && (
                <button
                  type="button"
                  onClick={handleBulkDeliver}
                  disabled={bulkLoading}
                  className="inline-flex items-center gap-2 h-9 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold rounded-xl shadow-2xs hover:shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 size={15} className={bulkLoading ? 'animate-spin' : ''} />
                  {bulkLoading ? 'Processing...' : 'Mark All Delivered'}
                </button>
              )}
            </>
          )}

          {activeTab === 'undelivered' && (
            <button
              type="button"
              onClick={handleBulkFail}
              disabled={bulkLoading}
              className="inline-flex items-center gap-2 h-9 px-4 bg-gradient-to-r from-amber-600 to-rose-600 text-white text-xs font-bold rounded-xl shadow-2xs hover:shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              title="Mark all pending undelivered orders as Failed (auto-refunds prepaid one-time orders to wallet)"
            >
              <AlertTriangle size={15} className={bulkLoading ? 'animate-spin' : ''} />
              {bulkLoading ? 'Processing...' : 'Bulk Mark Failed'}
            </button>
          )}
          <button
            type="button"
            onClick={() => { setTableKey((v) => v + 1); fetchSummary(); }}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 bg-white text-slate-800 text-xs font-bold rounded-xl border border-gray-200 shadow-2xs hover:border-emerald-500 hover:text-emerald-700 transition-colors"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Bulk result banner ── */}
      {bulkResult && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900 shadow-2xs">
          {bulkResult}
        </div>
      )}

      {/* ── Dashboard Metrics ── */}
      {showDashboard && (
        <OrderMetricsBar
          summary={summary}
          loading={summaryLoading}
          activeStatusFilter={activeStatusFilter}
          onSelectStatusFilter={setActiveStatusFilter}
        />
      )}

      {/* ── Filter Bar ── */}
      <OrderFilterBar
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

      {/* ── Orders Table ── */}
      <OrdersTable
        key={`${activeTab}-${tableKey}`}
        endpoint={endpoint}
        onViewOrder={handleViewOrder}
        tableKey={tableKey}
        activeStatusFilter={activeStatusFilter}
        searchQuery={searchQuery}
        slotFilter={slotFilter}
      />

      {/* ── Order Details Drawer ── */}
      <OrderDetailsDrawer
        order={selectedOrder}
        items={items}
        loadingItems={loadingItems}
        itemsError={itemsError}
        onClose={handleCloseDrawer}
        onUpdateStatus={handleUpdateStatus}
      />

      {/* ── Action Confirmation Modal ── */}
      <OrderActionModal
        isOpen={actionModal.isOpen}
        type={actionModal.type}
        data={actionModal.data}
        loading={bulkLoading}
        onClose={() => setActionModal({ isOpen: false, type: null })}
        onConfirm={handleConfirmModalAction}
      />
    </div>
  );
}
