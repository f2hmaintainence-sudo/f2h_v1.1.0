// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Premium State-of-the-Art Catalog & Inventory Sales Report with
//               Product-level Profit & Loss Analytics, Granular Filters & Export
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
  Boxes,
  ChevronLeft,
  Percent,
  TrendingDown,
  Coins,
  Calendar,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  HelpCircle,
  Tag,
  CheckCircle2,
  BarChart3,
  Flame,
} from "lucide-react";

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface Totals {
  total_net_sales: number;
  total_gross_sales: number;
  total_discounts: number;
  total_cogs: number;
  gross_profit: number;
  total_profit: number;
  total_loss: number;
  gross_margin_pct: number;
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
  sku?: string;
  pack_size?: string;
  orders_count: number;
  quantity_sold: number;
  gross_sales: number;
  total_loss: number;
  revenue: number;
  estimated_cogs: number;
  purchase_price?: number;
  gross_profit: number;
  total_profit: number;
  margin_pct: number;
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
  purchase_price?: number;
  estimated_cogs?: number;
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

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatMoney = (v: number) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const formatCompactMoney = (v: number) => {
  const num = Number(v ?? 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}k`;
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

const formatDateLabel = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-");
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
};

const formatFullDate = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-");
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
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

  // Trend Metric Toggle
  const [chartMetric, setChartMetric] = useState<"revenue" | "quantity" | "orders">("revenue");

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

  const handleFilterChange = (setter: (v: string) => void) => (val: string) => {
    setter(val);
    setPage(1);
  };

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

  // 4. Product Summary CSV Export Download (Products, Total Orders, Total Profit, Total Loss, Gross Profit)
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
      a.download = `product-sales-profit-loss-${from}-to-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export product sales report. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const totals = report?.totals;
  const daily = report?.daily || [];
  const maxMetricValue = Math.max(
    ...daily.map((d) =>
      chartMetric === "revenue" ? d.revenue : chartMetric === "quantity" ? d.quantity : d.orders
    ),
    1
  );

  const productsList = report?.by_product || [];
  const branchesList = report?.by_branch || [];
  const lineItems = report?.line_items || [];
  const pagination = report?.pagination || { page: 1, limit: 50, total_items: 0, total_pages: 1 };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8 animate-in fade-in duration-300 max-w-[1680px] mx-auto">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-1.5 hover:text-[#16a34a] transition-colors"
        >
          <Home size={13} /> Dashboard
        </Link>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="text-slate-500">Catalog &amp; Inventory</span>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="font-bold text-slate-800">Sales Report</span>
      </nav>

      {/* ── Header Banner ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex items-center gap-4.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-[#16a34a] text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
            <TrendingUp size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Catalog &amp; Inventory Sales Report
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#16a34a] text-[11px] font-extrabold border border-emerald-200/60 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                Products &amp; Profitability
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Analyze product sales velocity, total orders, profit &amp; loss, and gross margin across date, branch, and category filters.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-600">
            <Calendar size={14} className="text-slate-400" />
            <span>{formatFullDate(from)}</span>
            <span className="text-slate-300">→</span>
            <span>{formatFullDate(to)}</span>
          </div>

          <button
            type="button"
            onClick={downloadCsv}
            disabled={exporting}
            className="px-5 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-600/20 hover:shadow-md hover:shadow-emerald-600/30 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            title="Export Products Summary (Products, Total Orders, Total Profit, Total Loss, Gross Profit)"
          >
            <FileSpreadsheet
              size={15}
              className={exporting ? "animate-bounce" : ""}
            />
            {exporting ? "Exporting CSV…" : "Export Products (CSV)"}
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

      {/* ── Filter Card ── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        {/* Filter Top Bar: Presets & Live Date Display */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Filter size={15} className="text-[#16a34a]" />
            <span>Filter Report by Date, Product, Branch &amp; More</span>
            {hasActiveFilters && (
              <span className="px-2.5 py-0.5 bg-emerald-50 text-[#16a34a] text-[10px] rounded-full font-black border border-emerald-200/60">
                Active Filters
              </span>
            )}
          </div>

          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100/70 p-1 rounded-xl border border-slate-200/60 text-xs">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* From Date */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
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
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#16a34a] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all shadow-2xs"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
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
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#16a34a] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all shadow-2xs"
            />
          </div>

          {/* Branch Filter */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              Branch / Hub
            </label>
            <select
              value={branchId}
              onChange={(e) => handleFilterChange(setBranchId)(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#16a34a] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all shadow-2xs cursor-pointer"
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
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              Product
            </label>
            <select
              value={productId}
              onChange={(e) => handleFilterChange(setProductId)(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#16a34a] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all shadow-2xs cursor-pointer"
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
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => handleFilterChange(setCategoryId)(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#16a34a] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all shadow-2xs cursor-pointer"
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
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              Order Source
            </label>
            <select
              value={orderSource}
              onChange={(e) => handleFilterChange(setOrderSource)(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#16a34a] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all shadow-2xs cursor-pointer"
            >
              <option value="">All Sources</option>
              <option value="subscription">Subscription Orders</option>
              <option value="one-time">One-Time Orders</option>
            </select>
          </div>
        </div>

        {/* Search & Reset Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="relative w-full sm:w-96">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search product name, SKU, customer phone, or order ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#16a34a] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 transition-all shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-rose-100"
              >
                <X size={13} /> Clear All Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Summary Cards: Clean, Spacious, No Text Clipping ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Net Sales */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Net Sales
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <IndianRupee size={15} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatMoney(totals?.total_net_sales || 0)}
          </div>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-slate-400 font-medium">
            <span>Gross:</span>
            <span className="font-bold text-slate-600">{formatMoney(totals?.total_gross_sales || 0)}</span>
          </div>
        </div>

        {/* Card 2: Gross Profit */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-extrabold text-teal-600 uppercase tracking-wider">
              Gross Profit
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100">
              <Coins size={15} />
            </div>
          </div>
          <div className="text-2xl font-black text-teal-700 tracking-tight">
            {formatMoney(totals?.gross_profit || 0)}
          </div>
          <div className="flex items-center justify-between gap-1.5 mt-2 text-[11px]">
            <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 font-extrabold text-[10px] border border-teal-200/60">
              {totals?.gross_margin_pct || 0}% Margin
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Cost: <span className="font-bold text-slate-600">{formatMoney(totals?.total_cogs || 0)}</span>
            </span>
          </div>
        </div>

        {/* Card 3: Total Profit */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider">
              Total Profit
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatMoney(totals?.total_profit || 0)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-medium">
            Positive product yield
          </div>
        </div>

        {/* Card 4: Total Loss */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-extrabold text-rose-500 uppercase tracking-wider">
              Total Loss
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
              <TrendingDown size={15} />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight">
            {formatMoney(totals?.total_loss || 0)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-medium">
            Loss on sales below purchase cost
          </div>
        </div>

        {/* Card 5: Total Orders */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Total Orders
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <ShoppingCart size={15} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {(totals?.total_orders || 0).toLocaleString("en-IN")}
          </div>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-slate-400 font-medium">
            <span>AOV:</span>
            <span className="font-bold text-slate-600">{formatMoney(totals?.avg_order_value || 0)}</span>
          </div>
        </div>

        {/* Card 6: Units Sold */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Units Sold
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Boxes size={15} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatQty(totals?.total_quantity || 0)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-medium">
            {totals?.total_products || 0} unique items
          </div>
        </div>
      </div>

      {/* ── Daily Sales Trend Chart ── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 size={18} className="text-[#16a34a]" /> Daily Performance Timeline
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Day-by-day sales revenue and volume fulfilled across the selected period
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl border border-slate-200/60 text-xs">
            <button
              type="button"
              onClick={() => setChartMetric("revenue")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMetric === "revenue"
                  ? "bg-[#16a34a] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Revenue (₹)
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("quantity")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMetric === "quantity"
                  ? "bg-[#16a34a] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Units Sold
            </button>
            <button
              type="button"
              onClick={() => setChartMetric("orders")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMetric === "orders"
                  ? "bg-[#16a34a] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Orders
            </button>
          </div>
        </div>

        {daily.length === 0 ? (
          <div className="py-16 text-center text-xs font-semibold text-slate-400">
            No sales recorded in the selected period.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-2 h-44 pt-4 overflow-x-auto pb-2 scrollbar-thin">
              {daily.map((d) => {
                const metricVal =
                  chartMetric === "revenue"
                    ? d.revenue
                    : chartMetric === "quantity"
                    ? d.quantity
                    : d.orders;
                const heightPct = Math.round((metricVal / maxMetricValue) * 100);
                return (
                  <div
                    key={d.day}
                    className="flex-1 min-w-[32px] max-w-[56px] flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-14 z-20 bg-slate-900 text-white text-[11px] font-semibold py-1.5 px-3 rounded-lg shadow-xl pointer-events-none whitespace-nowrap">
                      <div className="text-slate-300 font-bold">{formatDateLabel(d.day)}</div>
                      <div className="text-emerald-400 font-black">{formatMoney(d.revenue)}</div>
                      <div className="text-[10px] text-slate-400">{d.orders} orders • {d.quantity} units</div>
                    </div>

                    {/* Bar */}
                    <div
                      className="w-full bg-gradient-to-t from-emerald-600 to-[#16a34a] group-hover:from-emerald-700 group-hover:to-emerald-500 rounded-t-xl transition-all shadow-2xs"
                      style={{ height: `${Math.max(heightPct, 6)}%` }}
                    />
                    <span className="text-[10px] font-bold text-slate-400 mt-1.5 truncate w-full text-center">
                      {d.day.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
              <span className="font-semibold text-slate-600">
                Peak: {chartMetric === "revenue" ? formatMoney(maxMetricValue) : `${maxMetricValue} ${chartMetric}`}
              </span>
              <span>
                Total Period Revenue: <strong className="text-slate-800">{formatMoney(totals?.total_net_sales || 0)}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Tabbed Detail Breakdowns ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "products"
                  ? "border-[#16a34a] text-[#16a34a]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Package size={16} />
              Products Profit &amp; Loss ({productsList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("branches")}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "branches"
                  ? "border-[#16a34a] text-[#16a34a]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Building2 size={16} />
              Sales by Branch ({branchesList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("items")}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "items"
                  ? "border-[#16a34a] text-[#16a34a]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layers size={16} />
              Order Items Log ({pagination.total_items})
            </button>
          </div>

          <span className="text-xs text-slate-400 hidden sm:inline-block font-medium">
            {activeTab === "items"
              ? `Showing page ${pagination.page} of ${pagination.total_pages}`
              : "Sorted by net sales (descending)"}
          </span>
        </div>

        {/* Tab 1: Sales by Product (with Total Orders, Total Profit, Total Loss, Gross Profit) */}
        {activeTab === "products" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-400 font-extrabold uppercase text-[10px] border-b border-slate-100 tracking-wider">
                  <th className="py-4 px-6">Product</th>
                  <th className="py-4 px-4">Category</th>
                  <th className="py-4 px-4">Pack / Variant</th>
                  <th className="py-4 px-4 text-right">Total Orders</th>
                  <th className="py-4 px-4 text-right">Units Sold</th>
                  <th className="py-4 px-4 text-right text-indigo-700">Purchase Price</th>
                  <th className="py-4 px-4 text-right">Gross Sales</th>
                  <th className="py-4 px-4 text-right text-rose-500">Total Loss</th>
                  <th className="py-4 px-4 text-right text-teal-600">Gross Profit</th>
                  <th className="py-4 px-4 text-right text-[#15803d]">Total Profit</th>
                  <th className="py-4 px-4 text-right">Margin %</th>
                  <th className="py-4 px-6 text-right">Share %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productsList.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-slate-400 font-semibold">
                      No product sales matching the filters.
                    </td>
                  </tr>
                ) : (
                  productsList.map((p, idx) => (
                    <tr key={`${p.product_id}-${p.variant_name}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 font-bold text-slate-900">
                        {p.product_name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {p.category_name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {p.pack_size || p.variant_name || "Standard"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {p.orders_count.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        {formatQty(p.quantity_sold)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-slate-900">
                          {formatMoney(
                            p.purchase_price ||
                              (p.quantity_sold > 0 && p.estimated_cogs > 0
                                ? p.estimated_cogs / p.quantity_sold
                                : 0)
                          )}
                          <span className="text-[10px] text-slate-400 font-normal"> /unit</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Total: {formatMoney(p.estimated_cogs || 0)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600 font-medium">
                        <div className="font-bold text-slate-900">{formatMoney(p.gross_sales)}</div>
                        {p.avg_price > 0 && (
                          <div className="text-[10px] text-slate-400 font-medium">
                            Avg: {formatMoney(p.avg_price)}/unit
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-600">
                        {formatMoney(p.total_loss)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-teal-700">
                        {formatMoney(p.gross_profit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-[#15803d]">
                        {formatMoney(p.total_profit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-700">
                        {p.margin_pct}%
                      </td>
                      <td className="py-3.5 px-6 text-right">
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
                <tr className="bg-slate-50/80 text-slate-400 font-extrabold uppercase text-[10px] border-b border-slate-100 tracking-wider">
                  <th className="py-4 px-6">Branch Name</th>
                  <th className="py-4 px-4 text-right">Orders Fulfilled</th>
                  <th className="py-4 px-4 text-right">Units Sold</th>
                  <th className="py-4 px-4 text-right">Gross Sales</th>
                  <th className="py-4 px-4 text-right">Net Revenue</th>
                  <th className="py-4 px-6 text-right">Share %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branchesList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 font-semibold">
                      No branch sales recorded for this period.
                    </td>
                  </tr>
                ) : (
                  branchesList.map((b, idx) => (
                    <tr key={`${b.branch_id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 font-bold text-slate-900 flex items-center gap-2">
                        <Building2 size={15} className="text-slate-400" />
                        {b.branch_name}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-700 font-medium">
                        {b.orders_count.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatQty(b.quantity_sold)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600 font-medium">
                        {formatMoney(b.gross)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-[#15803d]">
                        {formatMoney(b.revenue)}
                      </td>
                      <td className="py-3.5 px-6 text-right">
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
                <tr className="bg-slate-50/80 text-slate-400 font-extrabold uppercase text-[10px] border-b border-slate-100 tracking-wider">
                  <th className="py-4 px-6">Order ID / Date</th>
                  <th className="py-4 px-4">Customer</th>
                  <th className="py-4 px-4">Branch</th>
                  <th className="py-4 px-4">Product &amp; Variant</th>
                  <th className="py-4 px-4 text-right">Qty</th>
                  <th className="py-4 px-4 text-right text-indigo-700">Purchase Price</th>
                  <th className="py-4 px-4 text-right">Unit Price</th>
                  <th className="py-4 px-4 text-right">Total</th>
                  <th className="py-4 px-4">Source</th>
                  <th className="py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-slate-400 font-semibold">
                      No sales records match the applied criteria.
                    </td>
                  </tr>
                ) : (
                  lineItems.map((item) => (
                    <tr key={item.item_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-slate-900">#{item.order_id}</div>
                        <div className="text-[11px] text-slate-400">{formatDateLabel(item.order_date)}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {item.customer_name || "Guest Customer"}
                        </div>
                        {item.customer_phone && (
                          <div className="text-[11px] text-slate-400">{item.customer_phone}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {item.branch_name}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{item.product_name}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.variant_name || ""}{" "}
                          {item.unit_value ? `(${item.unit_value} ${item.unit_type})` : ""}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatQty(item.quantity)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-slate-900">
                          {formatMoney(
                            item.purchase_price ||
                              (item.quantity > 0 && (item.estimated_cogs || 0) > 0
                                ? (item.estimated_cogs || 0) / item.quantity
                                : 0)
                          )}
                        </div>
                        {(item.estimated_cogs || 0) > 0 && (
                          <div className="text-[10px] text-slate-400 font-medium">
                            Cost: {formatMoney(item.estimated_cogs || 0)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600 font-medium">
                        {formatMoney(item.unit_price)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-[#15803d]">
                        {formatMoney(item.total_amount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            item.order_source === "subscription"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {item.order_source || "one-time"}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
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
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/40 text-xs">
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
                    className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <span className="text-xs font-bold text-slate-700 px-2">
                    {pagination.page} / {pagination.total_pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                    disabled={pagination.page >= pagination.total_pages}
                    className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    Next <ChevronRight size={14} />
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
