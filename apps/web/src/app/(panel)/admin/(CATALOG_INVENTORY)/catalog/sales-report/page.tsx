// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Catalog & Inventory Sales Report with granular filters & CSV export
// ============================================================================

"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api-config";
import { api } from "@/services/api.client";
import {
  TrendingUp,
  Download,
  RefreshCw,
  ChevronRight,
  Home,
  IndianRupee,
  ShoppingCart,
  Building2,
  Package,
  Layers,
  Search,
  Filter,
  X,
  FileSpreadsheet,
  Calendar,
  Tag,
  Boxes,
  ArrowUpDown,
  ChevronLeft,
  Percent,
} from "lucide-react";

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface Totals {
  total_net_sales: number;
  total_gross_sales: number;
  total_discounts: number;
  total_quantity: number;
  total_orders: number;
  total_products: number;
  total_customers: number;
  avg_order_value: number;
}

interface DailyRow {
  day: string;
  orders: number;
  quantity: number;
  revenue: number;
  gross: number;
}

interface ProductRow {
  product_id: string;
  product_name: string;
  category_name: string;
  variant_name: string;
  quantity_sold: number;
  orders_count: number;
  revenue: number;
  gross: number;
  avg_price: number;
  share_pct: number;
}

interface BranchRow {
  branch_id: string | null;
  branch_name: string;
  orders_count: number;
  quantity_sold: number;
  revenue: number;
  gross: number;
  share_pct: number;
}

interface LineItemRow {
  item_id: number;
  order_id: string;
  order_date: string;
  order_source: string;
  order_status: string;
  payment_mode: string;
  payment_status: string;
  branch_name: string;
  product_name: string;
  variant_name: string;
  unit_value: string;
  unit_type: string;
  quantity: number;
  unit_price: number;
  gross_amount: number;
  discount_amount: number;
  total_amount: number;
  customer_name: string;
  customer_phone: string;
}

interface SalesReportData {
  range: { from: string; to: string };
  totals: Totals;
  daily: DailyRow[];
  by_product: ProductRow[];
  by_branch: BranchRow[];
  line_items: LineItemRow[];
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
}

interface FilterOption {
  product_id?: string;
  branch_id?: string;
  category_id?: string;
  name?: string;
  branch_name?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatMoney = (v: number) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const formatCompactMoney = (v: number) => {
  const num = Number(v ?? 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)} k`;
  return `₹${num.toFixed(0)}`;
};

const formatQty = (v: number) =>
  Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 1 });

const formatPct = (v: number) => `${Number(v ?? 0).toFixed(1)}%`;

const isoDaysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const getMonthStart = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function CatalogSalesReportPage() {
  // Date range
  const [from, setFrom] = useState(() => isoDaysAgo(29));
  const [to, setTo] = useState(() => isoDaysAgo(0));

  // Granular filters
  const [branchId, setBranchId] = useState("");
  const [productId, setProductId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [orderSource, setOrderSource] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"products" | "branches" | "items">("products");

  // Filter options
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Report state
  const [report, setReport] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // 1. Fetch filter options on mount
  useEffect(() => {
    api
      .get<any>("/admin/catalog/sales-report/filter-options")
      .then((res) => {
        if (res.data?.data) {
          setBranches(res.data.data.branches || []);
          setProducts(res.data.data.products || []);
          setCategories(res.data.data.categories || []);
        }
      })
      .catch(() => {
        // Fallback for branches
        api
          .get<any>("/admin/zone/branches-list")
          .then((res) => {
            if (Array.isArray(res.data?.data)) setBranches(res.data.data);
          })
          .catch(() => {});
      });
  }, []);

  // 2. Query parameters for report and export
  const queryParams = useMemo(() => {
    const p: Record<string, string | number> = { from, to, page, limit };
    if (branchId) p.branch_id = branchId;
    if (productId) p.product_id = productId;
    if (categoryId) p.category_id = categoryId;
    if (orderSource) p.order_source = orderSource;
    if (orderStatus) p.status = orderStatus;
    if (search.trim()) p.search = search.trim();
    return p;
  }, [from, to, branchId, productId, categoryId, orderSource, orderStatus, search, page, limit]);

  // 3. Load report data
  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/catalog/sales-report", {
        params: queryParams,
      });
      if (res.data?.data) {
        setReport(res.data.data as SalesReportData);
      }
    } catch {
      // Empty or error state handled by UI
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Reset page to 1 when filters change
  const handleFilterChange = (setter: (v: string) => void) => (val: string) => {
    setter(val);
    setPage(1);
  };

  // Date preset helper
  const applyPreset = (preset: "today" | "yesterday" | "7d" | "30d" | "90d" | "this_month") => {
    setPage(1);
    const today = isoDaysAgo(0);
    switch (preset) {
      case "today":
        setFrom(today);
        setTo(today);
        break;
      case "yesterday":
        setFrom(isoDaysAgo(1));
        setTo(isoDaysAgo(1));
        break;
      case "7d":
        setFrom(isoDaysAgo(6));
        setTo(today);
        break;
      case "30d":
        setFrom(isoDaysAgo(29));
        setTo(today);
        break;
      case "90d":
        setFrom(isoDaysAgo(89));
        setTo(today);
        break;
      case "this_month":
        setFrom(getMonthStart());
        setTo(today);
        break;
    }
  };

  const isPresetActive = (preset: string) => {
    const today = isoDaysAgo(0);
    if (preset === "today") return from === today && to === today;
    if (preset === "yesterday") return from === isoDaysAgo(1) && to === isoDaysAgo(1);
    if (preset === "7d") return from === isoDaysAgo(6) && to === today;
    if (preset === "30d") return from === isoDaysAgo(29) && to === today;
    if (preset === "90d") return from === isoDaysAgo(89) && to === today;
    if (preset === "this_month") return from === getMonthStart() && to === today;
    return false;
  };

  const clearAllFilters = () => {
    setBranchId("");
    setProductId("");
    setCategoryId("");
    setOrderSource("");
    setOrderStatus("");
    setSearch("");
    setFrom(isoDaysAgo(29));
    setTo(isoDaysAgo(0));
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    branchId || productId || categoryId || orderSource || orderStatus || search
  );

  // 4. CSV Export Download
  const downloadCsv = async () => {
    setExporting(true);
    try {
      const exportParams: Record<string, string> = { from, to };
      if (branchId) exportParams.branch_id = branchId;
      if (productId) exportParams.product_id = productId;
      if (categoryId) exportParams.category_id = categoryId;
      if (orderSource) exportParams.order_source = orderSource;
      if (orderStatus) exportParams.status = orderStatus;
      if (search.trim()) exportParams.search = search.trim();

      const qs = new URLSearchParams(exportParams).toString();
      const res = await fetch(
        `${getApiBaseUrl()}/admin/catalog/sales-report/export/csv?${qs}`,
        { credentials: "include" }
      );

      if (!res.ok) throw new Error("Export request failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-report-${from}-to-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export sales report. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const totals = report?.totals;
  const daily = report?.daily || [];
  const maxDailyRevenue = Math.max(...daily.map((d) => d.revenue), 1);
  const productsList = report?.by_product || [];
  const branchesList = report?.by_branch || [];
  const lineItems = report?.line_items || [];
  const pagination = report?.pagination || { page: 1, limit: 50, total_items: 0, total_pages: 1 };

  return (
    <div className="space-y-6 p-4 md:p-6 animate-in fade-in duration-300">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-1 hover:text-[#16a34a] transition-colors"
        >
          <Home size={13} /> Dashboard
        </Link>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="text-slate-500 font-medium">Catalog &amp; Inventory</span>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="font-semibold text-slate-800">Sales Report</span>
      </nav>

      {/* ── Header Banner ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/60 shadow-xs shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Catalog &amp; Inventory Sales Report
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                Analytics &amp; Export
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Analyze product sales velocity, branch fulfillment volume, and itemized orders with exportable data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={downloadCsv}
            disabled={exporting}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet
              size={15}
              className={`text-[#16a34a] ${exporting ? "animate-bounce" : ""}`}
            />
            {exporting ? "Exporting CSV…" : "Export CSV"}
          </button>

          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            title="Refresh Data"
            className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-[#16a34a]" : ""} />
          </button>
        </div>
      </div>

      {/* ── Filters Section ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Filter size={14} className="text-[#16a34a]" />
            <span>Filter Sales Report</span>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 bg-emerald-50 text-[#16a34a] text-[10px] rounded-md font-extrabold">
                Active Filters
              </span>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100 text-xs">
            {(
              [
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "7d", label: "7 Days" },
                { id: "30d", label: "30 Days" },
                { id: "90d", label: "90 Days" },
                { id: "this_month", label: "This Month" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isPresetActive(p.id)
                    ? "bg-[#16a34a] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* From Date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              From Date
            </label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#16a34a] focus:bg-white transition-all"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              To Date
            </label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#16a34a] focus:bg-white transition-all"
            />
          </div>

          {/* Branch Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Branch / Hub
            </label>
            <select
              value={branchId}
              onChange={(e) => handleFilterChange(setBranchId)(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#16a34a] focus:bg-white transition-all"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.branch_id} value={b.branch_id}>
                  {b.branch_name}
                </option>
              ))}
            </select>
          </div>

          {/* Product Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Product
            </label>
            <select
              value={productId}
              onChange={(e) => handleFilterChange(setProductId)(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#16a34a] focus:bg-white transition-all"
            >
              <option value="">All Products</option>
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => handleFilterChange(setCategoryId)(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#16a34a] focus:bg-white transition-all"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Order Source Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Order Source
            </label>
            <select
              value={orderSource}
              onChange={(e) => handleFilterChange(setOrderSource)(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#16a34a] focus:bg-white transition-all"
            >
              <option value="">All Sources</option>
              <option value="subscription">Subscription Orders</option>
              <option value="one-time">One-Time Orders</option>
            </select>
          </div>
        </div>

        {/* Search & Reset Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="relative w-full sm:w-80">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search product, customer, or order ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#16a34a] focus:bg-white transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <X size={13} /> Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Sales */}
        <div className="bg-gradient-to-br from-[#15803d] to-[#16a34a] text-white p-5 rounded-3xl shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-100">
              Total Net Sales
            </span>
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <IndianRupee size={16} />
            </div>
          </div>
          <p className="text-2xl md:text-3xl font-black mt-2">
            {formatMoney(totals?.total_net_sales || 0)}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-emerald-100/90 font-medium">
            <span>Gross: {formatMoney(totals?.total_gross_sales || 0)}</span>
            <span>•</span>
            <span>Disc: {formatMoney(totals?.total_discounts || 0)}</span>
          </div>
        </div>

        {/* Total Units Sold */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Quantity / Units Sold
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes size={16} />
            </div>
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
            {formatQty(totals?.total_quantity || 0)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            Across {totals?.total_products || 0} unique items
          </p>
        </div>

        {/* Total Orders & AOV */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Orders Count
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShoppingCart size={16} />
            </div>
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
            {totals?.total_orders?.toLocaleString("en-IN") || 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            Avg Order Value: {formatMoney(totals?.avg_order_value || 0)}
          </p>
        </div>

        {/* Unique Customers */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Unique Customers
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Package size={16} />
            </div>
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-900 mt-2">
            {totals?.total_customers?.toLocaleString("en-IN") || 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            Period: {report?.range?.from || from} to {report?.range?.to || to}
          </p>
        </div>
      </div>

      {/* ── Daily Sales Trend Chart ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp size={16} className="text-[#16a34a]" /> Daily Sales &amp; Quantity Trend
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Day-by-day sales revenue and fulfilled volume
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {daily.length} Days in Period
          </span>
        </div>

        {daily.length === 0 ? (
          <div className="py-12 text-center text-xs font-semibold text-slate-300">
            No sales recorded in the selected period.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-1.5 h-44 pt-4 overflow-x-auto pb-2 scrollbar-thin">
              {daily.map((d) => {
                const heightPct = Math.round((d.revenue / maxDailyRevenue) * 100);
                return (
                  <div
                    key={d.day}
                    className="flex-1 min-w-[28px] max-w-[48px] flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 bg-slate-900 text-white text-[10px] font-semibold py-1 px-2 rounded-md shadow-lg pointer-events-none whitespace-nowrap">
                      <div>{d.day}</div>
                      <div className="text-emerald-400 font-bold">{formatMoney(d.revenue)}</div>
                      <div className="text-slate-300">{d.orders} orders • {d.quantity} units</div>
                    </div>

                    {/* Bar */}
                    <div
                      className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-t-lg transition-all"
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    />
                    <span className="text-[9px] font-bold text-slate-400 mt-1 truncate w-full text-center">
                      {d.day.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-50">
              <span>Peak Day: {formatMoney(maxDailyRevenue)}</span>
              <span>Total Period Revenue: {formatMoney(totals?.total_net_sales || 0)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Tabbed Detail Breakdowns ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "products"
                  ? "border-[#16a34a] text-[#16a34a]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Package size={15} />
              Sales by Product ({productsList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("branches")}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "branches"
                  ? "border-[#16a34a] text-[#16a34a]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Building2 size={15} />
              Sales by Branch ({branchesList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("items")}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "items"
                  ? "border-[#16a34a] text-[#16a34a]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layers size={15} />
              Detailed Line Items ({pagination.total_items})
            </button>
          </div>

          <span className="text-xs text-slate-400 hidden sm:inline-block">
            {activeTab === "items"
              ? `Showing page ${pagination.page} of ${pagination.total_pages}`
              : "Sorted by revenue (descending)"}
          </span>
        </div>

        {/* Tab 1: Sales by Product */}
        {activeTab === "products" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/60 text-slate-400 font-extrabold uppercase text-[10px] border-b border-slate-100 tracking-wider">
                  <th className="py-3 px-5">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Variant / Pack</th>
                  <th className="py-3 px-4 text-right">Units Sold</th>
                  <th className="py-3 px-4 text-right">Orders</th>
                  <th className="py-3 px-4 text-right">Avg Price</th>
                  <th className="py-3 px-4 text-right">Revenue</th>
                  <th className="py-3 px-5 text-right">Share %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productsList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                      No product sales matching the filters.
                    </td>
                  </tr>
                ) : (
                  productsList.map((p, idx) => (
                    <tr key={`${p.product_id}-${p.variant_name}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-5 font-bold text-slate-900">
                        {p.product_name}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-medium">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {p.category_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {p.variant_name || "Standard"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatQty(p.quantity_sold)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        {p.orders_count}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        {formatMoney(p.avg_price)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-[#15803d]">
                        {formatMoney(p.revenue)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, p.share_pct))}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 w-10 text-right">
                            {formatPct(p.share_pct)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Sales by Branch */}
        {activeTab === "branches" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/60 text-slate-400 font-extrabold uppercase text-[10px] border-b border-slate-100 tracking-wider">
                  <th className="py-3 px-5">Branch Name</th>
                  <th className="py-3 px-4 text-right">Orders Fulfilled</th>
                  <th className="py-3 px-4 text-right">Units Sold</th>
                  <th className="py-3 px-4 text-right">Gross Sales</th>
                  <th className="py-3 px-4 text-right">Net Revenue</th>
                  <th className="py-3 px-5 text-right">Share %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branchesList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                      No branch sales recorded for this period.
                    </td>
                  </tr>
                ) : (
                  branchesList.map((b, idx) => (
                    <tr key={`${b.branch_id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-5 font-bold text-slate-900 flex items-center gap-2">
                        <Building2 size={14} className="text-slate-400" />
                        {b.branch_name}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 font-medium">
                        {b.orders_count.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatQty(b.quantity_sold)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        {formatMoney(b.gross)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-[#15803d]">
                        {formatMoney(b.revenue)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, b.share_pct))}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 w-10 text-right">
                            {formatPct(b.share_pct)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Detailed Line Items */}
        {activeTab === "items" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/60 text-slate-400 font-extrabold uppercase text-[10px] border-b border-slate-100 tracking-wider">
                  <th className="py-3 px-5">Order ID / Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Product &amp; Variant</th>
                  <th className="py-3 px-4 text-right">Qty</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-semibold">
                      No sales records match the applied criteria.
                    </td>
                  </tr>
                ) : (
                  lineItems.map((item) => (
                    <tr key={item.item_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-5">
                        <div className="font-bold text-slate-900">#{item.order_id}</div>
                        <div className="text-[11px] text-slate-400">{item.order_date}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {item.customer_name || "Guest Customer"}
                        </div>
                        {item.customer_phone && (
                          <div className="text-[11px] text-slate-400">{item.customer_phone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {item.branch_name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{item.product_name}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.variant_name || ""}{" "}
                          {item.unit_value ? `(${item.unit_value} ${item.unit_type})` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatQty(item.quantity)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-medium">
                        {formatMoney(item.unit_price)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-[#15803d]">
                        {formatMoney(item.total_amount)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            item.order_source === "subscription"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {item.order_source || "one-time"}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            item.order_status === "delivered"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : item.order_status === "cancelled"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {item.order_status || "pending"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {pagination.total_pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/40 text-xs">
                <span className="text-slate-500 font-medium">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total_items)} of{" "}
                  {pagination.total_items} items
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft size={13} /> Prev
                  </button>
                  <span className="text-xs font-bold text-slate-700">
                    {pagination.page} / {pagination.total_pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                    disabled={pagination.page >= pagination.total_pages}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    Next <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
