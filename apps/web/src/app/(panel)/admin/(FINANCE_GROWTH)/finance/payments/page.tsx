// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Online Payment Gateway Dashboard (Razorpay Transactions & Telemetry)
//
// ============================================================================

"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/services/api.client";
import {
  CreditCard, ChevronRight, Home, RefreshCw,
  CheckCircle2, Clock, AlertCircle, TrendingUp, DollarSign,
  Download, Search, Filter, X, ArrowUpRight, Percent, Layers,
  ShoppingBag, Calendar, Eye, Building, Loader2, Sparkles,
  ShieldCheck, AlertTriangle, HelpCircle, ArrowDownLeft
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
} from "recharts";

function formatMoney(v: number) {
  return "₹" + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

const fmtDate = (d?: string, year = true) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", ...(year && { year: "numeric" }) }) : "—";

const METHOD_COLORS: Record<string, { stroke: string; bg: string; text: string; label: string }> = {
  upi: { stroke: "#10b981", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "text-emerald-600", label: "UPI" },
  card: { stroke: "#ec4899", bg: "bg-pink-50 text-pink-700 border-pink-200", text: "text-pink-600", label: "Card" },
  netbanking: { stroke: "#3b82f6", bg: "bg-blue-50 text-blue-700 border-blue-200", text: "text-blue-600", label: "Netbanking" },
  wallet: { stroke: "#8b5cf6", bg: "bg-purple-50 text-purple-700 border-purple-200", text: "text-purple-600", label: "Wallet" },
  razorpay: { stroke: "#0ea5e9", bg: "bg-sky-50 text-sky-700 border-sky-200", text: "text-sky-600", label: "Razorpay" },
  other: { stroke: "#64748b", bg: "bg-slate-50 text-slate-700 border-slate-200", text: "text-slate-600", label: "Gateway" },
};

const PURPOSE_BADGES: Record<string, { bg: string; label: string }> = {
  wallet_topup: { bg: "bg-purple-100 text-purple-800 border-purple-200", label: "Wallet Top-up" },
  order: { bg: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Order Checkout" },
  subscription: { bg: "bg-indigo-100 text-indigo-800 border-indigo-200", label: "Subscription" },
  bill: { bg: "bg-amber-100 text-amber-800 border-amber-200", label: "Bill Settlement" },
};

export default function PaymentsPage() {
  const [days, setDays] = useState<number>(30);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [loadingTable, setLoadingTable] = useState<boolean>(true);

  // Stats & Trend Data
  const [statsData, setStatsData] = useState<any>(null);

  // Table Data & Filters
  const [transactions, setTransactions] = useState<any[]>([]);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPurpose, setSelectedPurpose] = useState<string>("all");
  const [selectedMethod, setSelectedMethod] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const searchTimeoutRef = useRef<any>(null);

  // Active chart lines toggle
  const [activeLines, setActiveLines] = useState<Record<string, boolean>>({
    total: true,
    upi: true,
    razorpay: true,
    card: true,
    wallet: true,
  });

  // Modal / Transaction Detail
  const [inspectingTx, setInspectingTx] = useState<any | null>(null);

  // Toast
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

  const fetchTransactions = useCallback(async (
    p = page,
    q = searchQuery,
    st = selectedStatus,
    purp = selectedPurpose,
    m = selectedMethod,
    d = days
  ) => {
    setLoadingTable(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
        days: String(d),
        ...(st !== "all" && { status: st }),
        ...(purp !== "all" && { purpose: purp }),
        ...(m !== "all" && { method: m }),
        ...(q.trim() && { search: q.trim() }),
      });
      const res = await api.get<any>(`/admin/finance/payments?${params}`);
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
  }, [page, limit, days, selectedStatus, selectedPurpose, selectedMethod, searchQuery]);

  useEffect(() => {
    fetchStats(days);
  }, [days, fetchStats]);

  useEffect(() => {
    fetchTransactions(page, searchQuery, selectedStatus, selectedPurpose, selectedMethod, days);
  }, [page, selectedStatus, selectedPurpose, selectedMethod, days]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchTransactions(1, val, selectedStatus, selectedPurpose, selectedMethod, days);
    }, 350);
  };

  const toggleLine = (key: string) => {
    setActiveLines((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams({
        export: "true",
        days: String(days),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
        ...(selectedPurpose !== "all" && { purpose: selectedPurpose }),
        ...(selectedMethod !== "all" && { method: selectedMethod }),
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
      });
      const res = await api.get<any>(`/admin/finance/payments?${params}`);
      const list = res.data?.data || [];
      if (!list || list.length === 0) {
        showToast("No payment records to export", false);
        return;
      }

      const headers = [
        "Transaction ID", "Razorpay Payment ID", "Razorpay Order ID",
        "Customer ID", "Customer Name", "Customer Phone",
        "Purpose", "Method", "Amount", "Currency", "Status",
        "Refunded Amount", "Created At", "Paid At"
      ];
      const rows = list.map((tx: any) => [
        `"${tx.transaction_id || tx.id}"`,
        `"${tx.provider_payment_id || ''}"`,
        `"${tx.provider_order_id || ''}"`,
        `"${tx.customer_id || ''}"`,
        `"${(tx.customer_name || '').replace(/"/g, '""')}"`,
        `"${tx.customer_phone || ''}"`,
        `"${tx.purpose || ''}"`,
        `"${tx.method || ''}"`,
        Number(tx.amount || 0),
        `"${tx.currency || 'INR'}"`,
        `"${tx.status || ''}"`,
        Number(tx.refunded_amount || 0),
        `"${tx.created_at || ''}"`,
        `"${tx.paid_at || ''}"`
      ]);

      const csvContent = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `F2H_Razorpay_Payments_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${list.length} Razorpay transactions to CSV!`, true);
    } catch {
      showToast("Failed to export payments", false);
    }
  };

  const general = statsData?.general || {};
  const methods = statsData?.methods || [];
  const dailyTrend = statsData?.dailyTrend || [];

  const totalCollected = Number(general.total_collected || 0);
  const totalTransactions = Number(general.total_transactions || 0);
  const successRate = general.success_rate !== undefined ? Number(general.success_rate) : 100;
  const avgTransactionValue = Number(general.avg_transaction_value || 0);

  const getStatusBadge = (st: string) => {
    const s = String(st || "").toLowerCase();
    if (s === "paid" || s === "fulfilled") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 size={11} className="text-emerald-700" /> Success / Paid
        </span>
      );
    }
    if (s === "created") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
          <Clock size={11} className="text-blue-700" /> Created / Pending
        </span>
      );
    }
    if (s === "failed") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
          <AlertCircle size={11} className="text-rose-700" /> Failed
        </span>
      );
    }
    if (s === "refunded") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
          <ArrowDownLeft size={11} className="text-purple-700" /> Refunded
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300 capitalize">
        {st}
      </span>
    );
  };

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
        <span className="font-bold text-slate-800">Online Payments &amp; Razorpay Gateway</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-xs shrink-0">
            <CreditCard size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Online Payments &amp; Gateway Analytics
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Live Razorpay payment gateway telemetry, transaction audits, and payment method trend graphs.
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
            <RefreshCw size={15} className={loadingStats || loadingTable ? "animate-spin text-blue-600" : ""} />
          </button>
        </div>
      </div>

      {/* Telemetry KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider mb-1">Razorpay Volume</p>
          <p className="text-xl font-black text-emerald-700">{formatMoney(totalCollected)}</p>
          <p className="text-[10px] text-emerald-600/70 font-semibold mt-0.5">{general.paid_count || 0} Successful Txns</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider mb-1">Success Rate</p>
          <p className="text-xl font-black text-blue-700">{successRate}%</p>
          <p className="text-[10px] text-blue-600/70 font-semibold mt-0.5">{totalTransactions} total attempts</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider mb-1">Created / Pending</p>
          <p className="text-xl font-black text-amber-800">{general.created_count || 0}</p>
          <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Checkout sessions</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-100 bg-rose-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider mb-1">Failed Attempts</p>
          <p className="text-xl font-black text-rose-700">{general.failed_count || 0}</p>
          <p className="text-[10px] text-rose-600/70 mt-0.5">Declined / Timeout</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider mb-1">Wallet Top-ups</p>
          <p className="text-xl font-black text-purple-800">{formatMoney(general.wallet_topup_volume || 0)}</p>
          <p className="text-[10px] text-purple-600/70 font-semibold mt-0.5">{general.wallet_topup_count || 0} top-ups</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Avg Ticket Size</p>
          <p className="text-xl font-black text-slate-900">{formatMoney(avgTransactionValue)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Per success txn</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ONLINE PAYMENT METHOD LINE GRAPH & TREND AREA CHART */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-600" />
              <span>Online Payment Method Revenue Trend</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Daily transaction volume segmented by online gateway mode over the last {days} days.
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
              <span>Total Volume</span>
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
                activeLines.razorpay ? "bg-sky-600 text-white shadow-2xs" : "bg-slate-100 text-slate-400"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-sky-300" />
              <span>Razorpay</span>
            </button>

            <button
              type="button"
              onClick={() => toggleLine("card")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeLines.card ? "bg-pink-600 text-white shadow-2xs" : "bg-slate-100 text-slate-400"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-pink-300" />
              <span>Card</span>
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
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-72 w-full pt-2">
          {loadingStats ? (
            <div className="h-full flex flex-col items-center justify-center space-y-2 text-slate-400">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <span className="text-xs font-bold">Rendering collection graphs...</span>
            </div>
          ) : dailyTrend.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <p className="text-xs font-bold">No online payment transaction records in this time range.</p>
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
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="walletGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
                    name="Total Volume"
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
                    name="Razorpay"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#razorpayGrad)"
                  />
                )}
                {activeLines.card && (
                  <Area
                    type="monotone"
                    dataKey="card"
                    name="Card"
                    stroke="#ec4899"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#cardGrad)"
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
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ONLINE PAYMENT TRANSACTIONS TABLE */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative max-w-md w-full">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Transaction ID, Payment ID, Order ID, Customer..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
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
              {/* Purpose Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] font-bold text-slate-400">Purpose:</span>
                <select
                  value={selectedPurpose}
                  onChange={(e) => { setSelectedPurpose(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Purposes</option>
                  <option value="wallet_topup">Wallet Top-up</option>
                  <option value="order">Order Payment</option>
                  <option value="subscription">Subscription</option>
                  <option value="bill">Bill Settlement</option>
                </select>
              </div>

              {/* Method Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] font-bold text-slate-400">Method:</span>
                <select
                  value={selectedMethod}
                  onChange={(e) => { setSelectedMethod(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Methods</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="netbanking">Netbanking</option>
                  <option value="wallet">Wallet</option>
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
                  <option value="created">Created / Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
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
                  <th className="px-4 py-3.5">Internal Txn ID</th>
                  <th className="px-4 py-3.5">Gateway IDs (Razorpay)</th>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Purpose</th>
                  <th className="px-4 py-3.5">Method</th>
                  <th className="px-4 py-3.5 text-right">Amount</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loadingTable ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <CreditCard size={36} className="mx-auto mb-3 text-slate-300" />
                      <p className="font-bold text-slate-700 text-sm">No online payment transactions found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try adjusting your filters or time window.
                      </p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const methodKey = (tx.method || tx.provider || "other").toLowerCase();
                    const methodCfg = METHOD_COLORS[methodKey] || METHOD_COLORS.other;
                    const purposeCfg = PURPOSE_BADGES[tx.purpose] || { bg: "bg-slate-100 text-slate-800", label: tx.purpose || "Payment" };

                    return (
                      <tr key={tx.id || tx.transaction_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 align-middle">
                          <button
                            type="button"
                            onClick={() => setInspectingTx(tx)}
                            className="font-mono font-bold text-slate-900 bg-slate-100 hover:bg-blue-100 hover:text-blue-900 px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer"
                          >
                            {tx.transaction_id || tx.id}
                          </button>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          {tx.provider_payment_id ? (
                            <div className="font-mono font-bold text-slate-800 text-[10px]">{tx.provider_payment_id}</div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">—</span>
                          )}
                          {tx.provider_order_id && (
                            <div className="text-[10px] font-mono text-slate-400">{tx.provider_order_id}</div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <div className="font-bold text-slate-900">{tx.customer_name || `Customer #${tx.customer_id}`}</div>
                          <div className="text-[10px] text-slate-400">{tx.customer_phone}</div>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold border ${purposeCfg.bg}`}>
                            {purposeCfg.label}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${methodCfg.bg}`}>
                            {tx.method || "Razorpay"}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right font-black text-slate-900 align-middle">
                          {formatMoney(tx.amount)}
                        </td>

                        <td className="px-4 py-3.5 text-center align-middle">
                          {getStatusBadge(tx.status)}
                        </td>

                        <td className="px-4 py-3.5 text-slate-500 text-[11px] align-middle">
                          {fmtDate(tx.created_at)}
                        </td>

                        <td className="px-4 py-3.5 text-right align-middle">
                          <button
                            type="button"
                            onClick={() => setInspectingTx(tx)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                            title="Inspect Transaction Details"
                          >
                            <Eye size={13} />
                          </button>
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
              Showing <strong className="text-slate-800">{totalCount > 0 ? (page - 1) * limit + 1 : 0}</strong> to <strong className="text-slate-800">{Math.min(page * limit, totalCount)}</strong> of <strong className="text-slate-800">{totalCount}</strong> online transactions
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
      {/* MODAL: TRANSACTION DETAILS INSPECTOR */}
      {/* ========================================================================= */}
      {inspectingTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100">
                  <CreditCard size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Online Transaction Audit</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    ID: <span className="font-mono font-bold text-slate-800">{inspectingTx.transaction_id || inspectingTx.id}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingTx(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Customer:</span>
                  <span className="font-bold text-slate-900">{inspectingTx.customer_name} ({inspectingTx.customer_phone || "N/A"})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Purpose:</span>
                  <span className="font-bold uppercase tracking-wider text-slate-800">{inspectingTx.purpose}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Provider:</span>
                  <span className="font-bold uppercase tracking-wider text-blue-700">{inspectingTx.provider || "Razorpay"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Status:</span>
                  <span>{getStatusBadge(inspectingTx.status)}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-semibold">Provider Order ID:</span>
                  <span className="font-bold text-slate-900">{inspectingTx.provider_order_id || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-semibold">Provider Payment ID:</span>
                  <span className="font-bold text-slate-900">{inspectingTx.provider_payment_id || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-semibold">Amount:</span>
                  <span className="font-sans font-black text-emerald-700">{formatMoney(inspectingTx.amount)} {inspectingTx.currency || "INR"}</span>
                </div>
                {Number(inspectingTx.refunded_amount) > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span className="font-sans font-semibold">Refunded:</span>
                    <span className="font-sans font-bold">{formatMoney(inspectingTx.refunded_amount)}</span>
                  </div>
                )}
              </div>

              {inspectingTx.failure_reason && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-rose-600" /> Failure Reason:
                  </p>
                  <p className="text-xs font-mono">{inspectingTx.failure_reason}</p>
                </div>
              )}

              {inspectingTx.notes && Object.keys(inspectingTx.notes).length > 0 && (
                <div>
                  <h4 className="font-extrabold text-[11px] text-slate-400 uppercase tracking-wider mb-1.5">
                    Gateway Metadata &amp; Notes
                  </h4>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-2xl text-[11px] overflow-x-auto font-mono">
                    {JSON.stringify(inspectingTx.notes, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectingTx(null)}
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
