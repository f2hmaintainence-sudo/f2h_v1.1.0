// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Customer Billing Outstandings, Due Date Reminders & Invoicing
//
// ============================================================================

"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/services/api.client";
import Link from "next/link";
import {
  FileText, RefreshCw, ChevronRight, Home, Search,
  CheckCircle2, Clock, AlertTriangle, X, PlusCircle,
  Eye, Loader2, ChevronLeft, Calendar, CreditCard, ShoppingBag, ShieldAlert,
  Download, Send, Bell, BellRing, Phone, Mail, Building, Printer,
  Filter, CheckSquare, Square, DollarSign, ArrowUpRight, CheckCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const formatMoney = (v: number) =>
  "₹" + Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fmtDate = (d?: string, year = true) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", ...(year && { year: "numeric" }) }) : "—";

interface OutstandingBill {
  id: string;
  bill_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  branch_name?: string;
  branch_id?: string;
  bill_type?: string;
  payment_method?: string;
  payment_type?: string;
  period_start?: string;
  period_end?: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  status: "pending" | "partial" | "paid" | "overdue" | string;
  order_count?: number;
  days_overdue?: number;
  created_at: string;
}

interface OutstandingsStats {
  summary: {
    total_outstanding: number;
    total_bills: number;
    overdue_amount: number;
    overdue_count: number;
    aging_0_7_amount: number;
    aging_0_7_count: number;
    aging_8_15_amount: number;
    aging_8_15_count: number;
    aging_16_30_amount: number;
    aging_16_30_count: number;
    aging_30_plus_amount: number;
    aging_30_plus_count: number;
  };
  topDebtors: Array<{
    customer_id: string;
    customer_name: string;
    customer_phone: string;
    branch_name: string;
    bill_count: number;
    total_due: number;
  }>;
  branchDues: Array<{
    branch_name: string;
    branch_id: string;
    bill_count: number;
    total_due: number;
  }>;
}

export default function OutstandingPage() {
  const [bills, setBills] = useState<OutstandingBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all"); // 'all' | 'overdue' | 'unpaid' | 'partial'
  const [typeFilter, setTypeFilter] = useState<string>("all"); // 'all' | 'postpaid' | 'order'
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef<any>(null);

  // Stats
  const [stats, setStats] = useState<OutstandingsStats | null>(null);
  const [branches, setBranches] = useState<any[]>([]);

  // Selection for bulk intimations
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);

  // Modals
  const [inspectingBillId, setInspectingBillId] = useState<string | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<any | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Payment Modal
  const [payingBill, setPayingBill] = useState<OutstandingBill | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [paymentRefNumber, setPaymentRefNumber] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Due Reminder / Intimation Modal
  const [intimationModalOpen, setIntimationModalOpen] = useState(false);
  const [intimationTargetBill, setIntimationTargetBill] = useState<OutstandingBill | null>(null); // null means bulk
  const [customIntimationMessage, setCustomIntimationMessage] = useState("");
  const [sendingIntimation, setSendingIntimation] = useState(false);

  // Toast message
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<any>("/admin/finance/outstandings/stats");
      if (res.data?.status && res.data.data) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load outstanding stats:", err);
    }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get<any>("/admin/branches");
      if (res.data?.data) {
        setBranches(Array.isArray(res.data.data) ? res.data.data : []);
      }
    } catch {
      // fallback
    }
  }, []);

  const fetchBills = useCallback(async (p = page, q = searchQuery, st = statusFilter, tp = typeFilter, br = branchFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
        ...(st !== "all" && { status: st }),
        ...(tp !== "all" && { type: tp }),
        ...(br !== "all" && { branchId: br }),
        ...(q.trim() && { search: q.trim() }),
      });
      const res = await api.get<any>(`/admin/finance/outstandings?${params}`);
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
      console.error("Failed to load outstanding bills:", err);
      showToast("Failed to fetch outstanding bills", false);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, typeFilter, branchFilter, searchQuery]);

  useEffect(() => {
    fetchStats();
    fetchBranches();
  }, [fetchStats, fetchBranches]);

  useEffect(() => {
    fetchBills(page, searchQuery, statusFilter, typeFilter, branchFilter);
  }, [page, statusFilter, typeFilter, branchFilter]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchBills(1, val, statusFilter, typeFilter, branchFilter);
    }, 350);
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedBillIds.length === bills.length && bills.length > 0) {
      setSelectedBillIds([]);
    } else {
      setSelectedBillIds(bills.map((b) => b.id || b.bill_number));
    }
  };

  const toggleSelectBill = (id: string) => {
    setSelectedBillIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
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
      showToast(`Downloading invoice PDF for ${cleanId}...`, true);
    } catch {
      showToast("Could not download PDF invoice", false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams({
        export: "true",
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(typeFilter !== "all" && { type: typeFilter }),
        ...(branchFilter !== "all" && { branchId: branchFilter }),
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
      });
      const res = await api.get<any>(`/admin/finance/outstandings?${params}`);
      const list = res.data?.data || [];
      if (!list || list.length === 0) {
        showToast("No data to export", false);
        return;
      }

      const headers = [
        "Bill Number", "Customer Name", "Customer Phone", "Customer Email",
        "Branch", "Bill Type", "Period Start", "Period End", "Due Date",
        "Total Billed", "Paid Amount", "Outstanding Due", "Status", "Days Overdue", "Created At"
      ];
      const rows = list.map((b: any) => [
        `"${b.bill_number || b.id}"`,
        `"${(b.customer_name || '').replace(/"/g, '""')}"`,
        `"${b.customer_phone || ''}"`,
        `"${b.customer_email || ''}"`,
        `"${b.branch_name || ''}"`,
        `"${b.bill_type || ''}"`,
        `"${b.period_start || ''}"`,
        `"${b.period_end || ''}"`,
        `"${b.due_date || ''}"`,
        Number(b.total_amount || 0),
        Number(b.paid_amount || 0),
        Number(b.due_amount || 0),
        `"${b.status || ''}"`,
        Number(b.days_overdue || 0),
        `"${b.created_at || ''}"`
      ]);

      const csvContent = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `F2H_Outstanding_Bills_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${list.length} outstanding records to CSV!`, true);
    } catch {
      showToast("Failed to export bills to CSV", false);
    }
  };

  // Record Payment
  const openPaymentModal = (bill: OutstandingBill) => {
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

  // Intimations / Due Date Reminders
  const openSingleReminderModal = (bill: OutstandingBill) => {
    setIntimationTargetBill(bill);
    setCustomIntimationMessage(
      `Dear ${bill.customer_name || 'Customer'}, your pending bill #${bill.bill_number || bill.id} of ${formatMoney(bill.due_amount)} (Due: ${fmtDate(bill.due_date)}) is awaiting settlement. Please pay via the F2H Fresh app.`
    );
    setIntimationModalOpen(true);
  };

  const openBulkReminderModal = () => {
    setIntimationTargetBill(null);
    const count = selectedBillIds.length > 0 ? selectedBillIds.length : (stats?.summary?.overdue_count || "all overdue");
    setCustomIntimationMessage(
      `Dear Customer, gentle reminder from F2H Fresh regarding your pending invoice dues. Please settle promptly in the app to maintain uninterrupted fresh daily deliveries.`
    );
    setIntimationModalOpen(true);
  };

  const handleSendIntimations = async () => {
    setSendingIntimation(true);
    try {
      if (intimationTargetBill) {
        // Single reminder
        const res = await api.post<any>(`/admin/finance/outstandings/${intimationTargetBill.id || intimationTargetBill.bill_number}/remind`, {
          message: customIntimationMessage || undefined,
        });
        showToast(res.data?.message || `Due intimation sent to ${intimationTargetBill.customer_name}!`, true);
      } else {
        // Bulk reminder
        const payload: any = {
          customMessage: customIntimationMessage || undefined,
        };
        if (selectedBillIds.length > 0) {
          payload.billIds = selectedBillIds;
        } else {
          payload.overdueOnly = statusFilter === "overdue" || statusFilter === "all";
        }
        const res = await api.post<any>("/admin/finance/outstandings/bulk-remind", payload);
        showToast(res.data?.message || `Intimations dispatched to ${res.data?.sentCount || 0} customers!`, true);
        setSelectedBillIds([]);
      }
      setIntimationModalOpen(false);
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to send reminders", false);
    } finally {
      setSendingIntimation(false);
    }
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = status === "overdue" || (new Date(dueDate) < new Date() && status !== "paid");
    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
          <AlertTriangle size={11} className="text-rose-600" /> Overdue
        </span>
      );
    }
    if (status === "partial") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
          <Clock size={11} className="text-blue-600" /> Partial Paid
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
        <Clock size={11} className="text-amber-600" /> Pending Due
      </span>
    );
  };

  const totalOutstanding = stats?.summary?.total_outstanding || bills.reduce((acc, b) => acc + Number(b.due_amount || 0), 0);
  const overdueAmount = stats?.summary?.overdue_amount || 0;
  const overdueCount = stats?.summary?.overdue_count || 0;

  return (
    <div className="space-y-5 p-2 sm:p-4 md:p-6 bg-slate-50/60 min-h-screen font-sans">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-bold transition-all animate-in fade-in slide-in-from-top-2 ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
        >
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
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
        <span className="font-bold text-slate-800">Customer Outstandings &amp; Invoices</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 shadow-xs shrink-0">
            <ShieldAlert size={26} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Customer Billing &amp; Outstanding Dues
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Track unpaid subscriber invoices, schedule due date reminders, download bill receipts &amp; collect balances.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openBulkReminderModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-amber-500/20 transition-all cursor-pointer"
          >
            <BellRing size={15} />
            <span>Intimate Due Reminders {selectedBillIds.length > 0 ? `(${selectedBillIds.length})` : ""}</span>
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

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-rose-100 bg-rose-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider mb-1">Total Outstanding</p>
          <p className="text-xl font-black text-rose-700">{formatMoney(totalOutstanding)}</p>
          <p className="text-[10px] text-rose-600/70 mt-0.5">{totalCount} Unpaid Invoices</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider mb-1">Overdue Amount</p>
          <p className="text-xl font-black text-amber-800">{formatMoney(overdueAmount)}</p>
          <p className="text-[10px] text-amber-600 font-bold mt-0.5">{overdueCount} Past Due Date</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">0–7 Days Dues</p>
          <p className="text-lg font-black text-slate-800">{formatMoney(stats?.summary?.aging_0_7_amount || 0)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{stats?.summary?.aging_0_7_count || 0} bills</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">8–15 Days Dues</p>
          <p className="text-lg font-black text-slate-800">{formatMoney(stats?.summary?.aging_8_15_amount || 0)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{stats?.summary?.aging_8_15_count || 0} bills</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">16–30 Days Dues</p>
          <p className="text-lg font-black text-slate-800">{formatMoney(stats?.summary?.aging_16_30_amount || 0)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{stats?.summary?.aging_16_30_count || 0} bills</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-2xs">
          <p className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider mb-1">&gt;30 Days Critical</p>
          <p className="text-lg font-black text-purple-800">{formatMoney(stats?.summary?.aging_30_plus_amount || 0)}</p>
          <p className="text-[10px] text-purple-600/70 font-bold mt-0.5">{stats?.summary?.aging_30_plus_count || 0} high priority</p>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative max-w-md w-full">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Bill #, Customer Name, Phone, ID..."
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
            {/* Bill Type Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Bill Types</option>
                <option value="postpaid">Subscription / Postpaid</option>
                <option value="order">Prepaid / One-Time</option>
              </select>
            </div>

            {/* Branch Filter */}
            {branches.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <Building size={13} className="text-slate-400 shrink-0" />
                <select
                  value={branchFilter}
                  onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[150px] truncate"
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

        {/* Status Filter Pills */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {[
              { id: "all", label: "All Unpaid Bills", count: totalCount },
              { id: "overdue", label: "Overdue Only", count: overdueCount, badgeCls: "bg-rose-500 text-white" },
              { id: "unpaid", label: "Upcoming Due", count: Math.max(0, totalCount - overdueCount) },
              { id: "partial", label: "Partially Paid" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => { setStatusFilter(st.id); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === st.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {st.label}
                {st.count !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${st.badgeCls || (statusFilter === st.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700")}`}>
                    {st.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {selectedBillIds.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl">
              <span>{selectedBillIds.length} bills selected</span>
              <button
                onClick={() => setSelectedBillIds([])}
                className="text-amber-800 underline hover:text-amber-900 text-[11px] cursor-pointer"
              >
                Deselect All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Outstandings Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {selectedBillIds.length > 0 && selectedBillIds.length === bills.length ? (
                      <CheckSquare size={16} className="text-emerald-600" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3.5">Bill / Invoice ID</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Billing Period</th>
                <th className="px-4 py-3.5">Due Date &amp; Aging</th>
                <th className="px-4 py-3.5 text-right">Invoiced</th>
                <th className="px-4 py-3.5 text-right">Paid</th>
                <th className="px-4 py-3.5 text-right">Balance Due</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" />
                    <p className="font-bold text-slate-700 text-sm">No outstanding bills found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      All customer bills matching your current filter criteria are settled and clear.
                    </p>
                  </td>
                </tr>
              ) : (
                bills.map((bill) => {
                  const billId = bill.id || bill.bill_number;
                  const isSelected = selectedBillIds.includes(billId);
                  const isOverdue = new Date(bill.due_date) < new Date() && bill.status !== "paid";
                  const daysOverdue = bill.days_overdue || (isOverdue ? Math.max(1, Math.round((new Date().getTime() - new Date(bill.due_date).getTime()) / (1000 * 3600 * 24))) : 0);

                  return (
                    <tr
                      key={billId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-amber-50/40" : isOverdue ? "bg-rose-50/15" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => toggleSelectBill(billId)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-emerald-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-3.5 align-middle">
                        <button
                          type="button"
                          onClick={() => openInspectReceipt(billId)}
                          className="text-left group cursor-pointer"
                        >
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-900 px-1.5 py-0.5 rounded text-[11px] transition-colors inline-block">
                            #{bill.bill_number || bill.id}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5 capitalize">
                            {bill.bill_type || "Postpaid"}
                          </div>
                        </button>
                      </td>

                      <td className="px-4 py-3.5 align-middle">
                        <div className="font-bold text-slate-900">{bill.customer_name || `Customer #${bill.customer_id}`}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{bill.customer_phone}</span>
                          {bill.branch_name && (
                            <span className="text-slate-400">· {bill.branch_name}</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 align-middle">
                        <div className="text-slate-800 font-semibold">
                          {fmtDate(bill.period_start || bill.created_at, false)} – {fmtDate(bill.period_end || bill.created_at, false)}
                        </div>
                        {bill.order_count !== undefined && bill.order_count > 0 && (
                          <span className="text-[10px] text-slate-400">{bill.order_count} orders delivered</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 align-middle">
                        <div className="font-bold text-slate-800">{fmtDate(bill.due_date)}</div>
                        {isOverdue && (
                          <div className="text-[10px] font-bold text-rose-600 mt-0.5">
                            {daysOverdue} days overdue
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right font-bold text-slate-700 align-middle">
                        {formatMoney(bill.total_amount)}
                      </td>

                      <td className="px-4 py-3.5 text-right font-bold text-emerald-600 align-middle">
                        {formatMoney(bill.paid_amount)}
                      </td>

                      <td className="px-4 py-3.5 text-right align-middle">
                        <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100 text-xs">
                          {formatMoney(bill.due_amount)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center align-middle">
                        {getStatusBadge(bill.status, bill.due_date)}
                      </td>

                      <td className="px-4 py-3.5 text-right align-middle">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview & Download Invoice */}
                          <button
                            type="button"
                            onClick={() => openInspectReceipt(billId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors font-bold text-[11px] cursor-pointer"
                            title="Preview Invoice Breakdown & Download PDF"
                          >
                            <Eye size={13} />
                            <span>Preview</span>
                          </button>

                          {/* Intimate Due Reminder Alert */}
                          <button
                            type="button"
                            onClick={() => openSingleReminderModal(bill)}
                            className="p-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                            title="Send Due Alert Notification to Customer App"
                          >
                            <BellRing size={13} />
                          </button>

                          {/* Record Payment */}
                          <button
                            type="button"
                            onClick={() => openPaymentModal(bill)}
                            className="p-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                            title="Record Payment Settlement"
                          >
                            <DollarSign size={13} />
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
            Showing <strong className="text-slate-800">{totalCount > 0 ? (page - 1) * limit + 1 : 0}</strong> to <strong className="text-slate-800">{Math.min(page * limit, totalCount)}</strong> of <strong className="text-slate-800">{totalCount}</strong> outstanding bills
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
      {/* MODAL: DUE DATE INTIMATION & NOTIFICATION MODAL */}
      {/* ========================================================================= */}
      {intimationModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                  <BellRing size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {intimationTargetBill ? "Send Due Date Intimation" : "Broadcast Bulk Due Date Reminders"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {intimationTargetBill
                      ? `Recipient: ${intimationTargetBill.customer_name || intimationTargetBill.customer_id}`
                      : `Recipients: ${selectedBillIds.length > 0 ? `${selectedBillIds.length} selected bills` : `All ${overdueCount} overdue subscribers`}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIntimationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {intimationTargetBill && (
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Bill Reference:</span>
                  <span className="font-mono font-bold text-slate-900">#{intimationTargetBill.bill_number || intimationTargetBill.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Due Amount:</span>
                  <span className="font-black text-rose-600">{formatMoney(intimationTargetBill.due_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Due Date:</span>
                  <span className="font-bold text-slate-800">{fmtDate(intimationTargetBill.due_date)}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Notification Message Preview
              </label>
              <textarea
                rows={4}
                value={customIntimationMessage}
                onChange={(e) => setCustomIntimationMessage(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:border-amber-600 focus:outline-none transition-all resize-none"
                placeholder="Enter custom reminder message..."
              />
              <p className="text-[11px] text-slate-400 mt-1">
                ✓ Dispatched via high-priority FCM Push Notification to customer devices.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIntimationModalOpen(false)}
                className="px-4 py-2 text-slate-600 text-xs font-bold hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingIntimation}
                onClick={handleSendIntimations}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {sendingIntimation ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send size={14} /> Dispatch Intimations
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD PAYMENT MODAL */}
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
                  placeholder="e.g. Paid during delivery visit"
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

      {/* ========================================================================= */}
      {/* MODAL: INVOICE / RECEIPT INSPECTION & PRINT MODAL */}
      {/* ========================================================================= */}
      {inspectingBillId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Tax Invoice &amp; Delivery Breakdown</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Invoice ID: <span className="font-mono font-bold text-slate-800">{inspectingBillId}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadBillPdf(inspectingBillId)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
                >
                  <Download size={14} /> Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingBillId(null)}
                  className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {loadingReceipt ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
                <Loader2 size={32} className="animate-spin text-emerald-600" />
                <span className="text-xs font-bold">Loading invoice receipt details...</span>
              </div>
            ) : receiptDetail?.bill ? (
              <div className="space-y-6">
                {/* Customer & Branch Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                      Customer Information
                    </span>
                    <p className="text-sm font-black text-slate-900">{receiptDetail.bill.customer_name}</p>
                    <p className="text-slate-600 font-semibold">Phone: {receiptDetail.bill.customer_phone || "N/A"}</p>
                    {receiptDetail.bill.customer_email && (
                      <p className="text-slate-600">Email: {receiptDetail.bill.customer_email}</p>
                    )}
                    {receiptDetail.bill.customer_address && (
                      <p className="text-slate-500 mt-1">{receiptDetail.bill.customer_address}</p>
                    )}
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                      Billing &amp; Hub Details
                    </span>
                    <p className="text-sm font-black text-slate-900">{receiptDetail.bill.branch_name || "F2H Fresh Hub"}</p>
                    <p className="text-slate-600">Period: {fmtDate(receiptDetail.bill.period_start)} to {fmtDate(receiptDetail.bill.period_end)}</p>
                    <p className="text-slate-600">Due Date: <strong className="text-slate-900">{fmtDate(receiptDetail.bill.due_date)}</strong></p>
                    <p className="text-slate-600">Payment Type: <strong className="capitalize">{receiptDetail.bill.payment_type || "Postpaid"}</strong></p>
                  </div>
                </div>

                {/* Line Items Table */}
                <div>
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider mb-2.5">
                    Delivered Line Items ({receiptDetail.items?.length || 0})
                  </h4>
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5">Date / Slot</th>
                          <th className="px-4 py-2.5">Item Description</th>
                          <th className="px-4 py-2.5 text-center">Qty</th>
                          <th className="px-4 py-2.5 text-right">Unit Price</th>
                          <th className="px-4 py-2.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {!receiptDetail.items || receiptDetail.items.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                              No individual line items breakdown recorded.
                            </td>
                          </tr>
                        ) : (
                          receiptDetail.items.map((it: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/60">
                              <td className="px-4 py-2.5 text-slate-600">
                                {fmtDate(it.scheduled_date)}
                                {it.delivery_slot ? ` · ${it.delivery_slot}` : ""}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-slate-900">
                                {it.item_name}
                              </td>
                              <td className="px-4 py-2.5 text-center font-bold text-slate-700">
                                {it.quantity}
                              </td>
                              <td className="px-4 py-2.5 text-right text-slate-600">
                                {formatMoney(it.unit_price)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                                {formatMoney(it.total_amount)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Totals Calculation Box */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>{formatMoney(receiptDetail.bill.subtotal || receiptDetail.bill.total_amount)}</span>
                  </div>
                  {Number(receiptDetail.bill.discount_amount) > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Discounts:</span>
                      <span>-{formatMoney(receiptDetail.bill.discount_amount)}</span>
                    </div>
                  )}
                  {Number(receiptDetail.bill.tax_amount) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Taxes &amp; GST:</span>
                      <span>+{formatMoney(receiptDetail.bill.tax_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total Invoiced Amount:</span>
                    <span className="text-emerald-700">{formatMoney(receiptDetail.bill.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Paid to Date:</span>
                    <span className="text-emerald-600">{formatMoney(receiptDetail.bill.paid_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-rose-700 pt-1 border-t border-slate-200">
                    <span>Remaining Balance Due:</span>
                    <span>{formatMoney(receiptDetail.bill.due_amount)}</span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setInspectingBillId(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
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
