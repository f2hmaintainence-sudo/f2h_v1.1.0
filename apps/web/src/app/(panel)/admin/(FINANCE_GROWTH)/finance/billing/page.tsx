// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Customer Billing Records, Invoice Breakdowns & Multi-Method Reconciliation
//
// ============================================================================

"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/services/api.client";
import Link from "next/link";
import {
  Receipt, RefreshCw, ChevronRight, Home, Search,
  CheckCircle2, Clock, AlertCircle, AlertTriangle, X, Eye, Loader2,
  Calendar, CreditCard, ShoppingBag, Download, Send, Phone,
  Mail, Building, DollarSign, Wallet, ArrowUpRight, Layers, TrendingUp
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const formatMoney = (v: number) =>
  "₹" + Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fmtDate = (d?: string, year = true) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", ...(year && { year: "numeric" }) }) : "—";

const METHOD_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  wallet: { bg: "bg-purple-50 text-purple-700 border-purple-200", text: "text-purple-700", label: "Wallet" },
  upi: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "text-emerald-700", label: "UPI" },
  razorpay: { bg: "bg-blue-50 text-blue-700 border-blue-200", text: "text-blue-700", label: "Razorpay" },
  online: { bg: "bg-blue-50 text-blue-700 border-blue-200", text: "text-blue-700", label: "Online" },
  cash: { bg: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-700", label: "Cash / COD" },
  cod: { bg: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-700", label: "Cash / COD" },
  card: { bg: "bg-pink-50 text-pink-700 border-pink-200", text: "text-pink-700", label: "Card" },
  other: { bg: "bg-slate-50 text-slate-700 border-slate-200", text: "text-slate-700", label: "Other" },
};

export default function CustomerBillingPage() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef<any>(null);

  // Stats & Trend Chart
  const [stats, setStats] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loadingStats, setLoadingStats] = useState(false);
  const [activeLines, setActiveLines] = useState<Record<string, boolean>>({
    total: true,
    wallet: true,
    upi: true,
    razorpay: true,
    card: true,
    cash: true,
  });

  const toggleLine = (key: string) => {
    setActiveLines((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Receipt / Line Items Modal
  const [inspectingBillId, setInspectingBillId] = useState<string | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<any | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Payment Recording Modal
  const [payingBill, setPayingBill] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [paymentRefNumber, setPaymentRefNumber] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Developer Testing: Postpaid Bill Generation Modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [eligibleCustomers, setEligibleCustomers] = useState<any[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [genCustomerId, setGenCustomerId] = useState<string>("ALL");
  const [genPeriodStart, setGenPeriodStart] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [genPeriodEnd, setGenPeriodEnd] = useState<string>(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth(), 0);
    return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  });
  const [genDueDate, setGenDueDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-05`;
  });
  const [generatingBills, setGeneratingBills] = useState(false);
  const [generationResult, setGenerationResult] = useState<any | null>(null);

  const openGenerateBillsModal = async () => {
    setShowGenerateModal(true);
    setGenerationResult(null);
    setLoadingEligible(true);
    try {
      const res = await api.get<any>('/admin/postpaid-bills/eligible-customers');
      if (res.data?.status && Array.isArray(res.data.data)) {
        setEligibleCustomers(res.data.data);
      } else if (Array.isArray(res.data)) {
        setEligibleCustomers(res.data);
      } else {
        setEligibleCustomers([]);
      }
    } catch (err: any) {
      console.error('Failed to load eligible customers:', err);
      showToast('Failed to load eligible postpaid customers', false);
    } finally {
      setLoadingEligible(false);
    }
  };

  const handleRunBillGeneration = async () => {
    setGeneratingBills(true);
    setGenerationResult(null);
    try {
      const payload: any = {
        customerId: genCustomerId === "ALL" ? "" : genCustomerId,
        periodStart: genPeriodStart,
        periodEnd: genPeriodEnd,
        dueDate: genDueDate,
      };
      const res = await api.post<any>('/admin/postpaid-bills/generate', payload);
      setGenerationResult(res.data);
      if (res.data?.status || (res.data?.summary && res.data.summary.generated > 0)) {
        showToast(`Postpaid bill calculation finished. Generated: ${res.data?.summary?.generated ?? 1}`, true);
        fetchBills();
        fetchStats();
      } else {
        showToast(res.data?.message || 'Bill calculation completed with notes', false);
      }
    } catch (err: any) {
      console.error('Bill generation error:', err);
      showToast(err.response?.data?.message || 'Failed to calculate postpaid bills', false);
    } finally {
      setGeneratingBills(false);
    }
  };

  const fetchStats = useCallback(async (d = days) => {
    setLoadingStats(true);
    try {
      const res = await api.get<any>(`/admin/finance/billing/stats?days=${d}`);
      if (res.data?.status && res.data.data) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load billing stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [days]);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get<any>("/admin/branches");
      if (res.data?.data) {
        setBranches(Array.isArray(res.data.data) ? res.data.data : []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchBills = useCallback(async (
    p = page,
    q = searchQuery,
    m = methodFilter,
    st = statusFilter,
    tp = typeFilter,
    br = branchFilter
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
        ...(m !== "all" && { payment_method: m }),
        ...(st !== "all" && { status: st }),
        ...(tp !== "all" && { type: tp }),
        ...(br !== "all" && { branchId: br }),
        ...(q.trim() && { search: q.trim() }),
      });
      const res = await api.get<any>(`/admin/finance/billing?${params}`);
      if (res.data?.status && Array.isArray(res.data.data)) {
        setBills(res.data.data);
        setTotalPages(res.data.meta?.totalPages || 1);
        setTotalCount(res.data.meta?.total || 0);
      } else {
        setBills([]);
        setTotalPages(1);
        setTotalCount(0);
      }
    } catch (err) {
      console.error("Failed to load customer bills:", err);
      showToast("Failed to fetch customer billing records", false);
    } finally {
      setLoading(false);
    }
  }, [page, limit, methodFilter, statusFilter, typeFilter, branchFilter, searchQuery]);

  useEffect(() => {
    fetchStats();
    fetchBranches();
  }, [fetchStats, fetchBranches]);

  useEffect(() => {
    fetchBills(page, searchQuery, methodFilter, statusFilter, typeFilter, branchFilter);
  }, [page, methodFilter, statusFilter, typeFilter, branchFilter]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchBills(1, val, methodFilter, statusFilter, typeFilter, branchFilter);
    }, 350);
  };

  // Inspect Receipt
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
  const downloadBillPdf = async (billId: string) => {
    try {
      const cleanId = String(billId).trim();
      showToast(`Generating invoice PDF for #${cleanId}...`, true);
      const blob = await api.getBlob(`/admin/finance/receipt/${cleanId}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Tax-Invoice-${cleanId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast(`Invoice #${cleanId} downloaded successfully!`, true);
    } catch (err) {
      console.error("Failed to download PDF invoice:", err);
      showToast("Could not download PDF invoice", false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams({
        export: "true",
        ...(methodFilter !== "all" && { payment_method: methodFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(typeFilter !== "all" && { type: typeFilter }),
        ...(branchFilter !== "all" && { branchId: branchFilter }),
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
      });
      const res = await api.get<any>(`/admin/finance/billing?${params}`);
      const list = res.data?.data || [];
      if (!list || list.length === 0) {
        showToast("No billing records to export", false);
        return;
      }

      const headers = [
        "Bill ID", "Customer Name", "Customer Phone", "Customer Email",
        "Branch", "Bill Type", "Payment Method", "Payment Type",
        "Period Start", "Period End", "Subtotal", "Tax", "Discount",
        "Total Invoiced", "Paid Amount", "Due Balance", "Status", "Date"
      ];
      const rows = list.map((b: any) => [
        `"${b.bill_number || b.id}"`,
        `"${(b.customer_name || '').replace(/"/g, '""')}"`,
        `"${b.customer_phone || ''}"`,
        `"${b.customer_email || ''}"`,
        `"${b.branch_name || ''}"`,
        `"${b.bill_type || ''}"`,
        `"${b.payment_method || ''}"`,
        `"${b.payment_type || ''}"`,
        `"${b.period_start || ''}"`,
        `"${b.period_end || ''}"`,
        Number(b.subtotal || b.total_amount || 0),
        Number(b.tax_amount || 0),
        Number(b.discount_amount || 0),
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
      a.download = `F2H_Customer_Billing_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${list.length} billing records to CSV!`, true);
    } catch {
      showToast("Failed to export bills to CSV", false);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status?: string, dueDate?: string) => {
    const s = (status || "").toLowerCase();
    if (s === "paid") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 size={11} className="text-emerald-700" /> Paid
        </span>
      );
    }
    const isOverdue = s === "overdue" || (dueDate && new Date(dueDate) < new Date() && s !== "paid");
    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
          <AlertTriangle size={11} className="text-rose-600" /> Overdue
        </span>
      );
    }
    if (s === "partial") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
          <Clock size={11} className="text-blue-600" /> Partial Paid
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
        <Clock size={11} className="text-amber-700" /> Pending Due
      </span>
    );
  };

  // Payment Recording
  const openPaymentModal = (bill: any) => {
    setPayingBill(bill);
    setPayAmount(String(bill.due_amount || bill.total_amount || 0));
    setPaymentMode("cash");
    setPaymentRefNumber("");
    setPaymentNotes("");
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      showToast("Please enter a valid payment amount", false);
      return;
    }
    setRecordingPayment(true);
    try {
      const res = await api.post<any>(`/admin/finance/outstandings/${payingBill.id || payingBill.bill_number}/pay`, {
        amount: amt,
        paymentMode,
        referenceNumber: paymentRefNumber || undefined,
        notes: paymentNotes || undefined,
      });
      showToast(res.data?.message || "Payment recorded successfully!", true);
      setPayingBill(null);
      fetchBills();
      fetchStats();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to record payment", false);
    } finally {
      setRecordingPayment(false);
    }
  };

  const general = stats?.general || {};
  const totalInvoiced = Number(general.total_invoiced || bills.reduce((a, b) => a + Number(b.total_amount || 0), 0));
  const totalCollected = Number(general.total_collected || bills.reduce((a, b) => a + Number(b.paid_amount || 0), 0));
  const totalDue = Number(general.total_due || bills.reduce((a, b) => a + Number(b.due_amount || 0), 0));

  return (
    <div className="space-y-5 p-2 sm:p-4 md:p-6 bg-slate-50/60 min-h-screen font-sans">
      {/* Toast */}
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
        <span className="font-bold text-slate-800">Customer Billing &amp; Invoices</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 shadow-xs shrink-0">
            <Receipt size={26} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Customer Billing &amp; Invoices
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Complete ledger of all customer bills across Wallet, UPI, Razorpay, and Cash on Delivery.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openGenerateBillsModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Receipt size={14} /> Developer: Calculate Postpaid Bills
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            type="button"
            onClick={() => { fetchBills(); fetchStats(); }}
            title="Refresh"
            className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-emerald-600" : ""} />
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Total Invoiced</p>
          <p className="text-xl font-black text-slate-900">{formatMoney(totalInvoiced)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{totalCount} total bills</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider mb-1">Collected Revenue</p>
          <p className="text-xl font-black text-emerald-700">{formatMoney(totalCollected)}</p>
          <p className="text-[10px] text-emerald-600/70 font-semibold mt-0.5">{general.paid_count || totalCount} Paid</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider mb-1">Pending Due</p>
          <p className="text-xl font-black text-amber-800">{formatMoney(totalDue)}</p>
          <p className="text-[10px] text-amber-600 font-semibold mt-0.5">{general.pending_count || 0} Unpaid</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider mb-1">Wallet Payments</p>
          <p className="text-xl font-black text-purple-800">{formatMoney(general.wallet_collected || 0)}</p>
          <p className="text-[10px] text-purple-600/70 font-semibold mt-0.5">Prepaid balance</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-teal-100 bg-teal-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-teal-700 uppercase tracking-wider mb-1">UPI Payments</p>
          <p className="text-xl font-black text-teal-800">{formatMoney(general.upi_collected || 0)}</p>
          <p className="text-[10px] text-teal-600/70 font-semibold mt-0.5">Instant UPI transfer</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider mb-1">Razorpay Online</p>
          <p className="text-xl font-black text-blue-800">{formatMoney(general.razorpay_collected || 0)}</p>
          <p className="text-[10px] text-blue-600/70 font-semibold mt-0.5">Gateway collections</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ONLINE PAYMENT METHOD LINE GRAPH & TREND AREA CHART */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-600" />
              <span>Online Payment Method Revenue Trend</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Daily customer billing &amp; collection volume segmented by payment method over the last {days} days.
            </p>
          </div>

          {/* Days Filter + Interactive Line Toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={days}
              onChange={(e) => {
                const d = Number(e.target.value);
                setDays(d);
                fetchStats(d);
              }}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer mr-1"
            >
              <option value={7}>Last 7 Days</option>
              <option value={15}>Last 15 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={60}>Last 60 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>

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
              <span className="text-xs font-bold">Rendering revenue trend graphs...</span>
            </div>
          ) : (stats?.dailyTrend || []).length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <p className="text-xs font-bold">No billing transaction records in this time range.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.dailyTrend || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="walletGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
                    name="Total Volume"
                    stroke="#0f172a"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#totalGrad)"
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

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative max-w-md w-full">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Bill ID, Customer Name, Phone, Email..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-600 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setPage(1); fetchBills(1, ""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Payment Method Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400">Method:</span>
              <select
                value={methodFilter}
                onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Payment Methods</option>
                <option value="wallet">Wallet Balance</option>
                <option value="upi">UPI</option>
                <option value="razorpay">Razorpay / Online</option>
                <option value="cash">Cash / COD</option>
              </select>
            </div>

            {/* Bill Type Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="subscription">Subscriptions / Postpaid</option>
                <option value="order">Prepaid / One-Time</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Branch Filter */}
            {branches.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <Building size={13} className="text-slate-400 shrink-0" />
                <select
                  value={branchFilter}
                  onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[140px] truncate"
                >
                  <option value="all">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.branch_id || b.id} value={b.branch_id || b.id}>
                      {b.branch_name || b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Bills Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Bill ID</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Branch</th>
                <th className="px-4 py-3.5">Payment Method</th>
                <th className="px-4 py-3.5">Bill Type</th>
                <th className="px-4 py-3.5 text-right">Invoiced</th>
                <th className="px-4 py-3.5 text-right">Paid Amount</th>
                <th className="px-4 py-3.5 text-right">Due Balance</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center">
                    <Receipt size={36} className="mx-auto mb-3 text-slate-300" />
                    <p className="font-bold text-slate-700 text-sm">No customer bills found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting your search criteria or payment method filters.
                    </p>
                  </td>
                </tr>
              ) : (
                bills.map((bill) => {
                  const billId = bill.bill_number || bill.id;
                  const methodKey = (bill.payment_method || "other").toLowerCase();
                  const methodCfg = METHOD_BADGES[methodKey] || METHOD_BADGES.other;
                  const isPaid = (bill.status || "").toLowerCase() === "paid";

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
                        <div className="font-bold text-slate-900">{bill.customer_name || `Customer #${bill.customer_id}`}</div>
                        <div className="text-[10px] text-slate-400">{bill.customer_phone}</div>
                      </td>

                      <td className="px-4 py-3.5 text-slate-600 align-middle">
                        {bill.branch_name || "Main Hub"}
                      </td>

                      <td className="px-4 py-3.5 align-middle">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${methodCfg.bg}`}>
                          {methodCfg.label}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-slate-600 capitalize align-middle">
                        {bill.bill_type || bill.payment_type || "Order"}
                      </td>

                      <td className="px-4 py-3.5 text-right font-bold text-slate-700 align-middle">
                        {formatMoney(bill.total_amount)}
                      </td>

                      <td className="px-4 py-3.5 text-right font-bold text-emerald-600 align-middle">
                        {formatMoney(bill.paid_amount)}
                      </td>

                      <td className="px-4 py-3.5 text-right align-middle">
                        {Number(bill.due_amount) > 0 ? (
                          <span className="font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 text-[11px]">
                            {formatMoney(bill.due_amount)}
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
                        {fmtDate(bill.created_at)}
                      </td>

                      <td className="px-4 py-3.5 text-right align-middle">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview & Download Invoice */}
                          <button
                            type="button"
                            onClick={() => openInspectReceipt(billId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors font-bold text-[11px] cursor-pointer"
                            title="Preview Tax Invoice & Download PDF"
                          >
                            <Eye size={13} />
                            <span>Preview</span>
                          </button>
                          {Number(bill.due_amount) > 0 && (
                            <button
                              type="button"
                              onClick={() => openPaymentModal(bill)}
                              className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                              title="Record Payment Settlement"
                            >
                              <DollarSign size={13} />
                            </button>
                          )}
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
            Showing <strong className="text-slate-800">{totalCount > 0 ? (page - 1) * limit + 1 : 0}</strong> to <strong className="text-slate-800">{Math.min(page * limit, totalCount)}</strong> of <strong className="text-slate-800">{totalCount}</strong> customer bills
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all cursor-pointer"
            >
              ← Previous
            </button>
            <span className="text-xs font-bold text-slate-600 px-2 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage(page + 1)}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-all cursor-pointer"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: INVOICE / LINE ITEMS BREAKDOWN */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL: INSPECT / PREVIEW TAX INVOICE */}
      {/* ========================================================================= */}
      {inspectingBillId && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Header Brand Bar */}
            <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 text-white p-5 md:px-7 md:py-6 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
                  <Receipt size={22} className="text-emerald-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black tracking-tight text-white">F2H FRESH</h3>
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-700/60 border border-emerald-400/30 text-emerald-100 rounded-md">
                      OFFICIAL TAX INVOICE
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/80 font-medium">
                    Invoice: <span className="font-mono font-bold text-white">#{inspectingBillId}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadBillPdf(inspectingBillId)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer"
                  title="Download PDF Tax Invoice"
                >
                  <Download size={14} /> <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingBillId(null)}
                  className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-7 overflow-y-auto space-y-5 text-xs flex-1">
              {loadingReceipt ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
                  <Loader2 size={36} className="animate-spin text-emerald-600" />
                  <span className="text-xs font-bold text-slate-600">Generating live Tax Invoice preview...</span>
                </div>
              ) : receiptDetail?.bill ? (
                <div className="space-y-5">
                  {/* Two Column Details Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1.5 shadow-2xs">
                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">Billed Customer</span>
                      <p className="text-sm font-black text-slate-900">{receiptDetail.bill.customer_name || "Customer"}</p>
                      <p className="text-slate-600 font-medium">Phone: <strong className="text-slate-800">{receiptDetail.bill.customer_phone || "N/A"}</strong></p>
                      {receiptDetail.bill.customer_email && <p className="text-slate-600">Email: <strong className="text-slate-800">{receiptDetail.bill.customer_email}</strong></p>}
                      <p className="text-slate-500 pt-0.5 leading-relaxed">{receiptDetail.bill.customer_address || "Registered Customer Address"}</p>
                    </div>

                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1.5 shadow-2xs">
                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">Invoice &amp; Payment Summary</span>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Bill Type:</span>
                        <span className="font-bold text-slate-800 uppercase">{receiptDetail.bill.bill_type || "Subscription"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Payment Mode:</span>
                        <span className="font-bold text-slate-900 uppercase">{receiptDetail.bill.payment_method || "Wallet"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Invoice Date:</span>
                        <span className="font-bold text-slate-800">{fmtDate(receiptDetail.bill.created_at || receiptDetail.bill.period_start)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Due Date:</span>
                        <span className="font-bold text-rose-700">{fmtDate(receiptDetail.bill.due_date)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                        <span className="text-slate-500">Status:</span>
                        <span>{getStatusBadge(receiptDetail.bill.status, receiptDetail.bill.due_date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Delivered Items Table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider">
                        Delivered Produce &amp; Line Items ({receiptDetail.items?.length || 1})
                      </h4>
                      <span className="text-[11px] font-bold text-slate-500">F2H Supply Hub</span>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-2.5 text-left">#</th>
                            <th className="px-4 py-2.5 text-left">Item Description</th>
                            <th className="px-4 py-2.5 text-center">Schedule / Ref</th>
                            <th className="px-4 py-2.5 text-center">Qty</th>
                            <th className="px-4 py-2.5 text-right">Unit Price</th>
                            <th className="px-4 py-2.5 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {receiptDetail.items && receiptDetail.items.length > 0 ? (
                            receiptDetail.items.map((it: any, i: number) => (
                              <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-4 py-2.5 text-slate-400 font-mono font-bold">{i + 1}</td>
                                <td className="px-4 py-2.5 font-bold text-slate-900">{it.item_name}</td>
                                <td className="px-4 py-2.5 text-center text-slate-500">{fmtDate(it.scheduled_date)}</td>
                                <td className="px-4 py-2.5 text-center font-bold text-slate-700">
                                  <span className="px-2 py-0.5 bg-slate-100 rounded-md font-mono">{it.quantity}</span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-600">{formatMoney(it.unit_price)}</td>
                                <td className="px-4 py-2.5 text-right font-black text-slate-900">{formatMoney(it.total_amount)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="px-4 py-2.5 text-slate-400 font-mono font-bold">1</td>
                              <td className="px-4 py-2.5 font-bold text-slate-900">{receiptDetail.bill.remarks || "Daily Subscription Supply"}</td>
                              <td className="px-4 py-2.5 text-center text-slate-500">{fmtDate(receiptDetail.bill.created_at)}</td>
                              <td className="px-4 py-2.5 text-center font-bold text-slate-700">
                                <span className="px-2 py-0.5 bg-slate-100 rounded-md font-mono">1</span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-slate-600">{formatMoney(receiptDetail.bill.total_amount)}</td>
                              <td className="px-4 py-2.5 text-right font-black text-slate-900">{formatMoney(receiptDetail.bill.total_amount)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Calculations & Totals Box */}
                  {(() => {
                    const itemsGrossSubtotal = (receiptDetail.items || []).reduce((sum: number, it: any) => sum + (Number(it.unit_price || 0) * (Number(it.quantity) || 1)), 0);
                    const itemsDiscounts = (receiptDetail.items || []).reduce((sum: number, it: any) => sum + Number(it.discount_amount || 0), 0);
                    const billTotal = Number(receiptDetail.bill.total_amount || 0);
                    const effectiveDiscount = Math.max(Number(receiptDetail.bill.discount_amount || 0), itemsDiscounts, Math.max(0, itemsGrossSubtotal - billTotal));
                    const effectiveSubtotal = Math.max(itemsGrossSubtotal, Number(receiptDetail.bill.subtotal || 0), billTotal + effectiveDiscount);

                    return (
                      <div className="bg-slate-50/90 p-4.5 rounded-2xl border border-slate-200 space-y-2 shadow-2xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal:</span>
                          <span className="font-bold text-slate-800">{formatMoney(effectiveSubtotal)}</span>
                        </div>
                        {effectiveDiscount > 0 ? (
                          <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                            <span>Discount / Promo Savings:</span>
                            <span>-{formatMoney(effectiveDiscount)}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-slate-500">
                            <span>Discounts &amp; Offers:</span>
                            <span>₹0.00</span>
                          </div>
                        )}
                        {Number(receiptDetail.bill.tax_amount) > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Taxes &amp; GST (Included):</span>
                            <span>+{formatMoney(receiptDetail.bill.tax_amount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                          <span>Total Invoiced Amount:</span>
                          <span className="text-emerald-700 font-black">{formatMoney(receiptDetail.bill.total_amount)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>Amount Paid to Date:</span>
                          <span className="text-emerald-600">{formatMoney(receiptDetail.bill.paid_amount)}</span>
                        </div>
                        {Number(receiptDetail.bill.due_amount) > 0 && (
                          <div className="flex justify-between text-sm font-black text-rose-700 pt-1.5 border-t border-slate-200">
                            <span>Remaining Balance Due:</span>
                            <span>{formatMoney(receiptDetail.bill.due_amount)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 md:px-7 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                Computer-generated official Tax Invoice • F2H Fresh
              </span>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => downloadBillPdf(inspectingBillId)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={14} /> Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingBillId(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD PAYMENT */}
      {/* ========================================================================= */}
      {payingBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmPayment}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Record Payment</h3>
                  <p className="text-xs text-slate-500 font-medium">Bill #{payingBill.bill_number || payingBill.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayingBill(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Customer:</span>
                <span className="font-bold text-slate-900">{payingBill.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Total Invoiced:</span>
                <span className="font-bold text-slate-800">{formatMoney(payingBill.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Remaining Due:</span>
                <span className="font-black text-rose-600">{formatMoney(payingBill.due_amount)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={payingBill.due_amount || payingBill.total_amount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full py-2.5 px-3 bg-emerald-50/40 border border-emerald-300 text-emerald-950 rounded-xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  <option value="cash">Cash / Counter Collection</option>
                  <option value="upi">UPI / QR Code</option>
                  <option value="bank_transfer">Bank Transfer / NEFT</option>
                  <option value="pos">POS / Card Swipe</option>
                  <option value="wallet">Wallet Balance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reference / Transaction # (Optional)
                </label>
                <input
                  type="text"
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  placeholder="e.g. UPI-928374 or Cheque #"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Counter payment"
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPayingBill(null)}
                className="px-4 py-2 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recordingPayment}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {recordingPayment ? "Recording..." : "Confirm & Settle Payment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Developer Testing: Postpaid Bill Generation Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                  <Receipt size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    Developer Testing — Postpaid Billing Engine
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Test &amp; trigger monthly postpaid bill calculation for eligible customers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Target Customer
                </label>
                {loadingEligible ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                    <Loader2 size={14} className="animate-spin text-emerald-600" />
                    Loading eligible postpaid customers...
                  </div>
                ) : (
                  <select
                    value={genCustomerId}
                    onChange={(e) => setGenCustomerId(e.target.value)}
                    className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="ALL">🌟 ALL Eligible Postpaid Customers ({eligibleCustomers.length})</option>
                    {eligibleCustomers.map((cust) => (
                      <option key={cust.customerId || cust.customer_id} value={cust.customerId || cust.customer_id}>
                        {cust.customerName || cust.first_name || "Customer"} ({cust.customerId || cust.customer_id}) {cust.phone ? `— ${cust.phone}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Period Start
                  </label>
                  <input
                    type="date"
                    value={genPeriodStart}
                    onChange={(e) => setGenPeriodStart(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Period End
                  </label>
                  <input
                    type="date"
                    value={genPeriodEnd}
                    onChange={(e) => setGenPeriodEnd(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={genDueDate}
                    onChange={(e) => setGenDueDate(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {generationResult && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>Calculation Result:</span>
                    <span className={generationResult.status ? "text-emerald-600" : "text-amber-600"}>
                      {generationResult.message || (generationResult.status ? "Completed" : "Note")}
                    </span>
                  </div>
                  {generationResult.summary && (
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-center">
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold">Eligible</p>
                        <p className="text-sm font-black text-slate-800">{generationResult.summary.eligibleCustomers ?? 0}</p>
                      </div>
                      <div className="bg-emerald-50/50 p-2 rounded-xl border border-emerald-100">
                        <p className="text-[10px] text-emerald-600 font-bold">Generated</p>
                        <p className="text-sm font-black text-emerald-700">{generationResult.summary.generated ?? 0}</p>
                      </div>
                      <div className="bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                        <p className="text-[10px] text-amber-600 font-bold">Skipped</p>
                        <p className="text-sm font-black text-amber-700">{generationResult.summary.skipped ?? 0}</p>
                      </div>
                      <div className="bg-rose-50/50 p-2 rounded-xl border border-rose-100">
                        <p className="text-[10px] text-rose-600 font-bold">Failed</p>
                        <p className="text-sm font-black text-rose-700">{generationResult.summary.failed ?? 0}</p>
                      </div>
                    </div>
                  )}
                  {generationResult.billNumber && (
                    <div className="mt-2 p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 font-medium">
                      Generated Bill ID: <span className="font-bold">{generationResult.billNumber}</span> &bull; Amount: <span className="font-bold">₹{generationResult.totalAmount}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleRunBillGeneration}
                disabled={generatingBills}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {generatingBills ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Calculating &amp; Generating...
                  </>
                ) : (
                  <>
                    <Receipt size={14} />
                    Run Calculation &amp; Generate Bills
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
