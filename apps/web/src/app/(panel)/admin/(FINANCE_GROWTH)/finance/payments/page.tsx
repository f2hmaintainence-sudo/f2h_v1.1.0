// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Payments & Collections Dashboard with Interactive Payment Method Line Graph
//
// ============================================================================

"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/services/api.client";
import {
  CreditCard, ChevronRight, Home, RefreshCw, FileText,
  CheckCircle2, Clock, AlertCircle, TrendingUp, DollarSign,
  Download, Search, Filter, X, ArrowUpRight, Percent, Layers,
  ShoppingBag, Calendar, Eye, Building, Loader2, Sparkles
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

function formatMoney(v: number) {
  return "₹" + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

const fmtDate = (d?: string, year = true) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", ...(year && { year: "numeric" }) }) : "—";

const METHOD_COLORS: Record<string, { stroke: string; fill: string; bg: string; text: string; label: string }> = {
  upi: { stroke: "#10b981", fill: "#10b98120", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "text-emerald-600", label: "UPI" },
  razorpay: { stroke: "#3b82f6", fill: "#3b82f620", bg: "bg-blue-50 text-blue-700 border-blue-200", text: "text-blue-600", label: "Online Gateway" },
  online: { stroke: "#3b82f6", fill: "#3b82f620", bg: "bg-blue-50 text-blue-700 border-blue-200", text: "text-blue-600", label: "Online" },
  wallet: { stroke: "#8b5cf6", fill: "#8b5cf620", bg: "bg-purple-50 text-purple-700 border-purple-200", text: "text-purple-600", label: "F2H Wallet" },
  cash: { stroke: "#f59e0b", fill: "#f59e0b20", bg: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-600", label: "Cash / COD" },
  cod: { stroke: "#f59e0b", fill: "#f59e0b20", bg: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-600", label: "Cash on Delivery" },
  card: { stroke: "#ec4899", fill: "#ec489920", bg: "bg-pink-50 text-pink-700 border-pink-200", text: "text-pink-600", label: "Debit / Credit Card" },
  other: { stroke: "#64748b", fill: "#64748b20", bg: "bg-slate-50 text-slate-700 border-slate-200", text: "text-slate-600", label: "Other" },
};

export default function PaymentsPage() {
  const [days, setDays] = useState<number>(30);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [loadingTable, setLoadingTable] = useState<boolean>(true);

  // Analytics Stats & Graph Data
  const [statsData, setStatsData] = useState<any>(null);

  // Table Data & Filters
  const [transactions, setTransactions] = useState<any[]>([]);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [selectedMethod, setSelectedMethod] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const searchTimeoutRef = useRef<any>(null);

  // Active chart lines toggle
  const [activeLines, setActiveLines] = useState<Record<string, boolean>>({
    total: true,
    upi: true,
    razorpay: true,
    wallet: true,
    cash: true,
  });

  // Modal / Receipt Detail
  const [inspectingBillId, setInspectingBillId] = useState<string | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<any | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState<boolean>(false);

  // Toast notification
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStats = useCallback(async (d = days) => {
    setLoadingStats(true);
    try {
      const res = await api.get<any>(`/admin/finance/payments-stats?days=${d}`);
      if (res.data?.status && res.data.data) {
        setStatsData(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load payments stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [days]);

  const fetchTransactions = useCallback(async (p = page, q = searchQuery, m = selectedMethod, st = selectedStatus, tp = selectedType, d = days) => {
    setLoadingTable(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
        days: String(d),
        ...(m !== "all" && { method: m }),
        ...(st !== "all" && { status: st }),
        ...(tp !== "all" && { type: tp }),
        ...(q.trim() && { search: q.trim() }),
      });
      const res = await api.get<any>(`/admin/finance/payments-report?${params}`);
      if (res.data?.status && Array.isArray(res.data.data)) {
        setTransactions(res.data.data);
        setTotalCount(res.data.meta?.total || 0);
        setTotalPages(res.data.meta?.totalPages || 1);
      } else {
        setTransactions([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Failed to load payment transactions:", err);
    } finally {
      setLoadingTable(false);
    }
  }, [page, limit, days, selectedMethod, selectedStatus, selectedType, searchQuery]);

  useEffect(() => {
    fetchStats(days);
  }, [days, fetchStats]);

  useEffect(() => {
    fetchTransactions(page, searchQuery, selectedMethod, selectedStatus, selectedType, days);
  }, [page, selectedMethod, selectedStatus, selectedType, days]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchTransactions(1, val, selectedMethod, selectedStatus, selectedType, days);
    }, 350);
  };

  const toggleLine = (key: string) => {
    setActiveLines((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Inspect & Receipt modal
  const openInspectReceipt = async (billId: string) => {
    setInspectingBillId(billId);
    setLoadingReceipt(true);
    try {
      const res = await api.get<any>(`/admin/finance/receipt/${billId}`);
      if (res.data?.status && res.data.data) {
        setReceiptDetail(res.data.data);
      } else {
        showToast("Invoice details not found", false);
        setInspectingBillId(null);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to load receipt", false);
      setInspectingBillId(null);
    } finally {
      setLoadingReceipt(false);
    }
  };

  // Download PDF
  const downloadBillPdf = (billId: string) => {
    try {
      const cleanId = String(billId).trim();
      const url = `${process.env.NEXT_PUBLIC_API_URL || "https://f2hfresh.com/api/v1"}/admin/finance/receipt/${cleanId}/pdf`;
      window.open(url, "_blank");
      showToast(`Downloading receipt PDF for ${cleanId}...`, true);
    } catch {
      showToast("Could not download PDF receipt", false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams({
        export: "true",
        days: String(days),
        ...(selectedMethod !== "all" && { method: selectedMethod }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedType !== "all" && { type: selectedType }),
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
      });
      const res = await api.get<any>(`/admin/finance/payments-report?${params}`);
      const list = res.data?.data || [];
      if (!list || list.length === 0) {
        showToast("No records to export", false);
        return;
      }

      const headers = [
        "Bill / Transaction ID", "Customer Name", "Customer Phone", "Branch",
        "Payment Method", "Payment Type", "Bill Type", "Total Amount",
        "Paid Amount", "Due Amount", "Status", "Date"
      ];
      const rows = list.map((b: any) => [
        `"${b.bill_number || b.id}"`,
        `"${(b.customer_name || '').replace(/"/g, '""')}"`,
        `"${b.customer_phone || ''}"`,
        `"${b.branch_name || ''}"`,
        `"${b.payment_method || ''}"`,
        `"${b.payment_type || ''}"`,
        `"${b.bill_type || ''}"`,
        Number(b.total_amount || 0),
        Number(b.paid_amount || 0),
        Number(b.due_amount || 0),
        `"${b.status || ''}"`,
        `"${b.created_at || ''}"`
      ]);

      const csvContent = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `F2H_Payments_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${list.length} transactions to CSV!`, true);
    } catch {
      showToast("Failed to export payments", false);
    }
  };

  const general = statsData?.general || {};
  const methods = statsData?.methods || [];
  const dailyTrend = statsData?.dailyTrend || [];

  const totalCollected = Number(general.total_collected || 0);
  const totalBilled = Number(general.total_billed || 0);
  const totalPendingDue = Number(general.total_pending_due || 0);
  const totalInvoices = Number(general.total_invoices || 0);
  const successRate = general.success_rate !== undefined ? Number(general.success_rate) : (totalInvoices > 0 ? 100 : 0);
  const avgTransactionValue = Number(general.avg_transaction_value || 0);

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6 bg-slate-50/60 min-h-screen font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold transition-all animate-in fade-in slide-in-from-top-2 ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
        >
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600 transition-colors">
          <Home size={13} /> Dashboard
        </Link>
        <ChevronRight size={12} className="text-slate-300" />
        <span className="text-slate-500">Finance &amp; Growth</span>
        <ChevronRight size={12} className="text-slate-300" />
        <span className="font-bold text-slate-800">Payments &amp; Collections Analytics</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-xs shrink-0">
            <CreditCard size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Payments &amp; Revenue Analytics
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Real-time payment gateway telemetry, payment method volume breakdown, and revenue collection trends.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Timeframe selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  days === d
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            type="button"
            onClick={() => { fetchStats(days); fetchTransactions(); }}
            title="Refresh Analytics"
            className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={loadingStats || loadingTable ? "animate-spin text-emerald-600" : ""} />
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider mb-1">Total Collected</p>
          <p className="text-xl font-black text-emerald-700">{formatMoney(totalCollected)}</p>
          <p className="text-[10px] text-emerald-600/70 font-semibold mt-0.5">{totalInvoices} Invoices Billed</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider mb-1">Pending / COD Due</p>
          <p className="text-xl font-black text-amber-800">{formatMoney(totalPendingDue)}</p>
          <p className="text-[10px] text-amber-600 font-semibold mt-0.5">{general.pending_count || 0} Unsettled Bills</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Total Billed Gross</p>
          <p className="text-xl font-black text-slate-900">{formatMoney(totalBilled)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Last {days} days total</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider mb-1">Success Rate</p>
          <p className="text-xl font-black text-blue-700">{successRate}%</p>
          <p className="text-[10px] text-blue-600/70 font-semibold mt-0.5">{general.paid_count || 0} Success / {general.failed_count || 0} Failed</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider mb-1">Avg Ticket Size</p>
          <p className="text-xl font-black text-purple-800">{formatMoney(avgTransactionValue)}</p>
          <p className="text-[10px] text-purple-600/70 mt-0.5">Per paid transaction</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-100 bg-indigo-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider mb-1">Subscriptions Paid</p>
          <p className="text-xl font-black text-indigo-800">{formatMoney(general.subscription_paid || 0)}</p>
          <p className="text-[10px] text-indigo-600/70 font-semibold mt-0.5">{general.subscription_count || 0} subscriber bills</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAYMENT METHOD LINE GRAPH & TREND AREA CHART */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-600" />
              <span>Payment Methods Collection Trend</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Daily revenue volume segmented by payment gateway mode over the last {days} days.
            </p>
          </div>

          {/* Interactive Line Toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleLine("total")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeLines.total ? "bg-slate-900 text-white shadow-2xs" : "bg-slate-100 text-slate-400"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Total Revenue</span>
            </button>

            <button
              type="button"
              onClick={() => toggleLine("upi")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeLines.upi ? "bg-emerald-600 text-white shadow-2xs" : "bg-slate-100 text-slate-400"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-300" />
              <span>UPI</span>
            </button>

            <button
              type="button"
              onClick={() => toggleLine("razorpay")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeLines.razorpay ? "bg-blue-600 text-white shadow-2xs" : "bg-slate-100 text-slate-400"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-300" />
              <span>Online Gateway</span>
            </button>

            <button
              type="button"
              onClick={() => toggleLine("wallet")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeLines.wallet ? "bg-purple-600 text-white shadow-2xs" : "bg-slate-100 text-slate-400"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-300" />
              <span>Wallet</span>
            </button>

            <button
              type="button"
              onClick={() => toggleLine("cash")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeLines.cash ? "bg-amber-600 text-white shadow-2xs" : "bg-slate-100 text-slate-400"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-300" />
              <span>Cash / COD</span>
            </button>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-72 w-full pt-2">
          {loadingStats ? (
            <div className="h-full flex flex-col items-center justify-center space-y-2 text-slate-400">
              <Loader2 size={32} className="animate-spin text-emerald-600" />
              <span className="text-xs font-bold">Rendering collection graphs...</span>
            </div>
          ) : dailyTrend.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <p className="text-xs font-bold">No payment transaction records in this time range.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="upiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="razorpayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="walletGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="displayDate"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900/95 backdrop-blur-sm text-white p-3.5 rounded-2xl shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[170px]">
                          <p className="font-extrabold text-slate-300 border-b border-slate-800 pb-1">{label}</p>
                          {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                {entry.name}:
                              </span>
                              <span className="font-black text-white">{formatMoney(entry.value)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {activeLines.total && (
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total Revenue"
                    stroke="#0f172a"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#totalGrad)"
                  />
                )}
                {activeLines.upi && (
                  <Area
                    type="monotone"
                    dataKey="upi"
                    name="UPI"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#upiGrad)"
                  />
                )}
                {activeLines.razorpay && (
                  <Area
                    type="monotone"
                    dataKey="razorpay"
                    name="Online Gateway"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#razorpayGrad)"
                  />
                )}
                {activeLines.wallet && (
                  <Area
                    type="monotone"
                    dataKey="wallet"
                    name="Wallet"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#walletGrad)"
                  />
                )}
                {activeLines.cash && (
                  <Area
                    type="monotone"
                    dataKey="cash"
                    name="Cash / COD"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#cashGrad)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAYMENT METHOD CARDS & INSIGHTS BREAKDOWN */}
      {/* ========================================================================= */}
      <div>
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Layers size={16} className="text-emerald-600" />
          <span>Payment Gateway Distribution &amp; Share</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {methods.length === 0 ? (
            <div className="col-span-full p-6 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs font-bold">
              No payment breakdown data available.
            </div>
          ) : (
            methods.map((m: any, idx: number) => {
              const key = (m.payment_method || "other").toLowerCase();
              const cfg = METHOD_COLORS[key] || METHOD_COLORS.other;

              return (
                <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border ${cfg.bg}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs font-black text-slate-900">
                      {m.percentage}%
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Total Volume Collected
                    </span>
                    <p className="text-xl font-black text-slate-900 mt-0.5">
                      {formatMoney(m.paid_amount)}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, m.percentage || 0)}%`, backgroundColor: cfg.stroke }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold pt-1 border-t border-slate-100">
                    <span>{m.count} transactions</span>
                    <span>Avg {formatMoney(m.average_amount)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TRANSACTIONS & BILLING REPORT TABLE */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        {/* Table Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative max-w-md w-full">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Invoice #, Customer Name, Phone..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setPage(1); fetchTransactions(1, ""); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Payment Method Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] font-bold text-slate-400">Method:</span>
                <select
                  value={selectedMethod}
                  onChange={(e) => { setSelectedMethod(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Methods</option>
                  <option value="upi">UPI</option>
                  <option value="razorpay">Online / Razorpay</option>
                  <option value="wallet">Wallet</option>
                  <option value="cash">Cash / COD</option>
                  <option value="card">Card</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] font-bold text-slate-400">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid &amp; Success</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] font-bold text-slate-400">Type:</span>
                <select
                  value={selectedType}
                  onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="subscription">Subscriptions / Postpaid</option>
                  <option value="order">Prepaid / One-Time</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Invoice / Bill #</th>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Branch</th>
                  <th className="px-4 py-3.5">Payment Method</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5 text-right">Invoiced</th>
                  <th className="px-4 py-3.5 text-right">Paid Amount</th>
                  <th className="px-4 py-3.5 text-right">Due Balance</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loadingTable ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 11 }).map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-16 text-center">
                      <CreditCard size={36} className="mx-auto mb-3 text-slate-300" />
                      <p className="font-bold text-slate-700 text-sm">No payment records found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try adjusting your filters or time window.
                      </p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const billId = tx.bill_number || tx.id;
                    const methodKey = (tx.payment_method || "other").toLowerCase();
                    const methodCfg = METHOD_COLORS[methodKey] || METHOD_COLORS.other;
                    const isPaid = (tx.status || "").toLowerCase() === "paid";

                    return (
                      <tr key={billId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 align-middle">
                          <button
                            type="button"
                            onClick={() => openInspectReceipt(billId)}
                            className="font-mono font-bold text-slate-900 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer"
                          >
                            #{billId}
                          </button>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <div className="font-bold text-slate-900">{tx.customer_name || `Customer #${tx.customer_id}`}</div>
                          <div className="text-[10px] text-slate-400">{tx.customer_phone}</div>
                        </td>

                        <td className="px-4 py-3.5 text-slate-600 align-middle">
                          {tx.branch_name || "Main Hub"}
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${methodCfg.bg}`}>
                            {methodCfg.label}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-slate-600 capitalize align-middle">
                          {tx.bill_type || tx.payment_type || "Order"}
                        </td>

                        <td className="px-4 py-3.5 text-right font-bold text-slate-700 align-middle">
                          {formatMoney(tx.total_amount)}
                        </td>

                        <td className="px-4 py-3.5 text-right font-bold text-emerald-600 align-middle">
                          {formatMoney(tx.paid_amount)}
                        </td>

                        <td className="px-4 py-3.5 text-right align-middle">
                          {Number(tx.due_amount) > 0 ? (
                            <span className="font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 text-[11px]">
                              {formatMoney(tx.due_amount)}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-center align-middle">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 size={11} className="text-emerald-700" /> Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock size={11} className="text-amber-700" /> Pending
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-slate-500 text-[11px] align-middle">
                          {fmtDate(tx.created_at)}
                        </td>

                        <td className="px-4 py-3.5 text-right align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => downloadBillPdf(billId)}
                              className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                              title="Download PDF Receipt"
                            >
                              <Download size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openInspectReceipt(billId)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                              title="View Receipt Breakdown"
                            >
                              <Eye size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <p className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{totalCount > 0 ? (page - 1) * limit + 1 : 0}</strong> to <strong className="text-slate-800">{Math.min(page * limit, totalCount)}</strong> of <strong className="text-slate-800">{totalCount}</strong> transactions
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || loadingTable}
                onClick={() => setPage(page - 1)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all cursor-pointer"
              >
                ← Previous
              </button>
              <span className="text-xs font-bold text-slate-600 px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
                Page {page} of {Math.max(1, totalPages)}
              </span>
              <button
                disabled={page >= totalPages || loadingTable}
                onClick={() => setPage(page + 1)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all cursor-pointer"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: RECEIPT / INVOICE BREAKDOWN MODAL */}
      {/* ========================================================================= */}
      {inspectingBillId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Payment Receipt</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Invoice #{inspectingBillId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadBillPdf(inspectingBillId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
                >
                  <Download size={14} /> Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingBillId(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {loadingReceipt ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-400">
                <Loader2 size={28} className="animate-spin text-emerald-600" />
                <span className="text-xs font-bold">Loading payment breakdown...</span>
              </div>
            ) : receiptDetail?.bill ? (
              <div className="space-y-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Customer:</span>
                    <span className="font-bold text-slate-900">{receiptDetail.bill.customer_name} ({receiptDetail.bill.customer_phone || "N/A"})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Branch / Hub:</span>
                    <span className="font-bold text-slate-900">{receiptDetail.bill.branch_name || "Main Hub"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Payment Mode:</span>
                    <span className="font-bold text-emerald-700 uppercase tracking-wider">{receiptDetail.bill.payment_method || "Online"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Payment Status:</span>
                    <span className="font-bold uppercase tracking-wider text-slate-800">{receiptDetail.bill.status}</span>
                  </div>
                </div>

                {receiptDetail.items && receiptDetail.items.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Item Description</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receiptDetail.items.map((it: any, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-bold text-slate-900">{it.item_name}</td>
                            <td className="px-3 py-2 text-center text-slate-600">{it.quantity}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-900">{formatMoney(it.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Billed:</span>
                    <span className="font-bold text-slate-800">{formatMoney(receiptDetail.bill.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Paid Amount:</span>
                    <span>{formatMoney(receiptDetail.bill.paid_amount)}</span>
                  </div>
                  {Number(receiptDetail.bill.due_amount) > 0 && (
                    <div className="flex justify-between text-rose-700 font-bold pt-1 border-t border-slate-200">
                      <span>Remaining Balance Due:</span>
                      <span>{formatMoney(receiptDetail.bill.due_amount)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectingBillId(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
