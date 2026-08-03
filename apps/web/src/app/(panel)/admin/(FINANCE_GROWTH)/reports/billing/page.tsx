"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api.client";
import Link from "next/link";
import { showSuccessToast, showErrorToast, showWarningToast } from "@/components/Toast";
import {
  FileText, RefreshCw, ChevronRight, Home, Search,
  CheckCircle2, Clock, AlertTriangle, X, PlusCircle,
  Eye, Loader2, ChevronLeft, Calendar, CreditCard, ShoppingBag
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "@/components/Table Generator/SkeletonForm.css";
import { BillingTable } from "./components/BillingTable";

const formatMoney = (v: number) =>
  "₹" + Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const fmtDate = (d?: string, year = true) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", ...(year && { year: "numeric" }) }) : "—";

interface OrderIncluded {
  orderId: string;
  orderName?: string;
  scheduledDate: string;
  orderAmount: number;
  status: string;
  paymentStatus?: string;
  deliverySlot?: string;
}

interface PostpaidBill {
  id: string;
  billNumber: string;
  customerName: string;
  customerId: string;
  billingPeriod: { start: string; end: string };
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: "pending" | "partial" | "paid" | "overdue";
  orderCount: number;
  ordersIncluded?: OrderIncluded[];
  createdAt: string;
  is_postpaid_enabled?: boolean;
}

export default function BillingReportPage() {
  const [postpaidBills, setPostpaidBills] = useState<PostpaidBill[]>([]);
  const [prepaidBills, setPrepaidBills] = useState<PostpaidBill[]>([]);
  const [loadingPostpaid, setLoadingPostpaid] = useState(true);
  const [loadingPrepaid, setLoadingPrepaid] = useState(true);

  const [postpaidPage, setPostpaidPage] = useState(1);
  const [prepaidPage, setPrepaidPage] = useState(1);

  const [postpaidTotalPages, setPostpaidTotalPages] = useState(1);
  const [prepaidTotalPages, setPrepaidTotalPages] = useState(1);

  const [totalPostpaidBillsCount, setTotalPostpaidBillsCount] = useState(0);
  const [totalPrepaidBillsCount, setTotalPrepaidBillsCount] = useState(0);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Action States
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState<PostpaidBill | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [eligibleCustomers, setEligibleCustomers] = useState<any[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);

  // Generate Bill Form State
  const [genCustomerId, setGenCustomerId] = useState("");
  const [genPeriodStart, setGenPeriodStart] = useState("2026-07-01");
  const [genPeriodEnd, setGenPeriodEnd] = useState("2026-07-31");
  const [genDueDate, setGenDueDate] = useState("2026-08-05");

  // Summary Stats
  const [stats, setStats] = useState({ totalBilled: 0, totalCollected: 0, totalBalance: 0, overdueCount: 0 });

  const modalOrdersToShow = showDetailsModal?.ordersIncluded?.filter((ord) => {
    const isOneTimePaid = String((ord as any).orderSource || '').toLowerCase() === "one-time"
      && String((ord as any).paymentStatus || '').toLowerCase() === "paid";
    if (isOneTimePaid) return false; // this order is already counted as paid
    if (statusFilter === "SUBSCRIPTION") {
      return String((ord as any).orderSource || '').toLowerCase() === "subscription";
    }
    if (statusFilter === "ONE_TIME") {
      return String((ord as any).orderSource || '').toLowerCase() !== "subscription";
    }
    return true;
  }) || [];

  const fetchEligibleCustomers = useCallback(async () => {
    setLoadingEligible(true);
    try {
      const res = await api.get<any>("/admin/postpaid-bills/eligible-customers");
      setEligibleCustomers(res.data?.status && Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      console.error("Failed to load eligible postpaid customers:", err);
    } finally {
      setLoadingEligible(false);
    }
  }, []);

  const fetchPostpaidBills = useCallback(async () => {
    setLoadingPostpaid(true);
    try {
      const params = new URLSearchParams({
        page: String(postpaidPage),
        limit: "10",
        type: "postpaid",
        ...(statusFilter !== "ALL" && { status: statusFilter.toLowerCase() }),
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
      });
      const res = await api.get<any>(`/admin/postpaid-bills?${params}`);
      if (res.data?.status && Array.isArray(res.data.data)) {
        setPostpaidBills(res.data.data);
        setPostpaidTotalPages(res.data.meta?.totalPages || 1);
        setTotalPostpaidBillsCount(res.data.meta?.total || 0);
      } else {
        setPostpaidBills([]);
      }
    } catch (err) {
      console.error("Failed to load postpaid bills:", err);
    } finally {
      setLoadingPostpaid(false);
    }
  }, [statusFilter, searchQuery, postpaidPage]);

  const fetchPrepaidBills = useCallback(async () => {
    setLoadingPrepaid(true);
    try {
      const params = new URLSearchParams({
        page: String(prepaidPage),
        limit: "10",
        type: "prepaid",
        ...(statusFilter !== "ALL" && { status: statusFilter.toLowerCase() }),
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
      });
      const res = await api.get<any>(`/admin/postpaid-bills?${params}`);
      if (res.data?.status && Array.isArray(res.data.data)) {
        setPrepaidBills(res.data.data);
        setPrepaidTotalPages(res.data.meta?.totalPages || 1);
        setTotalPrepaidBillsCount(res.data.meta?.total || 0);
      } else {
        setPrepaidBills([]);
      }
    } catch (err) {
      console.error("Failed to load prepaid bills:", err);
    } finally {
      setLoadingPrepaid(false);
    }
  }, [statusFilter, searchQuery, prepaidPage]);

  const fetchSummaryStats = useCallback(async () => {
    try {
      const res = await api.get<any>("/admin/postpaid-bills?limit=500");
      if (res.data?.status && Array.isArray(res.data.data)) {
        let billed = 0, collected = 0, balance = 0, overdueCnt = 0;
        for (const b of res.data.data) {
          billed += Number(b.totalAmount || 0);
          collected += Number(b.paidAmount || 0);
          balance += Number(b.balanceAmount || 0);
          if (b.status === "overdue" || (new Date(b.dueDate) < new Date() && b.status !== "paid")) overdueCnt++;
        }
        setStats({ totalBilled: billed, totalCollected: collected, totalBalance: balance, overdueCount: overdueCnt });
      }
    } catch (err) {
      console.error("Failed to load summary stats:", err);
    }
  }, []);

  useEffect(() => { fetchPostpaidBills(); }, [fetchPostpaidBills]);
  useEffect(() => { fetchPrepaidBills(); }, [fetchPrepaidBills]);
  useEffect(() => { fetchSummaryStats(); }, [fetchSummaryStats]);
  useEffect(() => { fetchEligibleCustomers(); }, [fetchEligibleCustomers]);

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genPeriodStart || !genPeriodEnd || !genDueDate) {
      return showWarningToast("Please fill in all required date fields.");
    }
    setGenerating(true);
    try {
      const payload: any = {
        periodStart: genPeriodStart,
        periodEnd: genPeriodEnd,
        dueDate: genDueDate,
      };
      if (genCustomerId.trim()) {
        payload.customerId = genCustomerId.trim();
      }

      const res = await api.post<any>("/postpaid-bills/generate", payload);
      const isBatch = !genCustomerId.trim() || res.data?.isBatch;

      if (isBatch && res.data?.summary) {
        const sum = res.data.summary;
        showSuccessToast(
          `Batch Billing Completed! Evaluated ${sum.eligibleCustomers || 0} customers: ${sum.generated || 0} generated, ${sum.skipped || 0} skipped, ${sum.failed || 0} failed.`
        );
        setShowGenerateModal(false);
        fetchPostpaidBills();
        fetchPrepaidBills();
        fetchSummaryStats();
      } else if (res.data?.status) {
        showSuccessToast(
          res.data.message || `Bill #${res.data["Bill Number"] || res.data.billNumber} processed successfully! Total Amount: ${formatMoney(res.data["Total Amount"] || res.data.totalAmount || 0)}`
        );
        setShowGenerateModal(false);
        fetchPostpaidBills();
        fetchPrepaidBills();
        fetchSummaryStats();
      } else {
        showWarningToast(res.data?.message || "Bill generation skipped or bill already exists.");
      }
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || err.message || "An error occurred during bill generation.");
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenDetails = async (bill: PostpaidBill) => {
    // is_postpaid_enabled is already set by the backend (payment_type = 'postpaid')
    // For prepaid bills it will be false, so we skip fetching order details
    const isPostpaid = (bill as any).is_postpaid_enabled !== false;
    setShowDetailsModal(bill);
    if (!isPostpaid) {
      setLoadingDetails(false);
      return;
    }
    setLoadingDetails(true);
    try {
      const res = await api.get<any>(`/admin/postpaid-bills/${bill.id}/orders`);
      if (res.data?.status && res.data.data) {
        setShowDetailsModal((prev) => (prev ? { ...prev, ordersIncluded: res.data.data.ordersIncluded || [] } : null));
      }
    } catch (err) {
      console.error("Failed to load included orders:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = status === "overdue" || (new Date(dueDate) < new Date() && status !== "paid");
    const cfg = isOverdue
      ? { text: "Overdue", cls: "bg-rose-100 text-rose-800 border-rose-300", icon: AlertTriangle, icls: "text-rose-600" }
      : status === "paid"
        ? { text: "Paid", cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2, icls: "text-emerald-600" }
        : status === "partial"
          ? { text: "Partial", cls: "bg-blue-100 text-blue-800 border-blue-300", icon: Clock, icls: "text-blue-600" }
          : { text: "Pending", cls: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock, icls: "text-amber-600" };
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${cfg.cls}`}>
        <Icon size={13} className={cfg.icls} /> {cfg.text}
      </span>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6 pb-20 bg-slate-50 min-h-screen">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600 transition-colors">
          <Home size={14} /> Dashboard
        </Link>
        <ChevronRight size={14} className="text-slate-300" />
        <span className="text-slate-500">Finance</span>
        <ChevronRight size={14} className="text-slate-300" />
        <span className="font-bold text-slate-800">Postpaid & Prepaid Billing</span>
      </nav>

      {/* Clean Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <FileText className="text-emerald-600 shrink-0" size={28} /> Customer Bills
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Calculate and generate bills for postpaid & prepaid customers across their delivered orders.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-5 py-2.5 bg-[#388E3C] hover:opacity-90 text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition-all"
          >
            <PlusCircle size={16} /> <span>Generate Postpaid Bill</span>
          </button>
          <button
            onClick={() => { fetchPostpaidBills(); fetchPrepaidBills(); fetchSummaryStats(); }}
            title="Refresh Data"
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
          >
            <RefreshCw size={18} className={(loadingPostpaid || loadingPrepaid) ? "animate-spin text-emerald-600" : ""} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Billed", val: formatMoney(stats.totalBilled), cls: "text-slate-900" },
          { label: "Total Collected", val: formatMoney(stats.totalCollected), cls: "text-emerald-600" },
          { label: "Pending Balance", val: formatMoney(stats.totalBalance), cls: "text-amber-600" },
          { label: "Overdue Invoices", val: `${stats.overdueCount} Bills`, cls: "text-rose-600" },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{card.label}</span>
            <p className={`text-2xl font-black mt-1 ${card.cls}`}>{card.val}</p>
          </div>
        ))}
      </div>

      {/* Simple Search and Status Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "ALL", label: "All Bills" },
            { id: "SUBSCRIPTION", label: "Subscription" },
            { id: "ONE_TIME", label: "One Time" },
            { id: "PENDING", label: "Pending" },
            { id: "PAID", label: "Paid" },
            { id: "OVERDUE", label: "Overdue" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id); setPostpaidPage(1); setPrepaidPage(1); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${statusFilter === tab.id ? "bg-[#388E3C] text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search Bill #, Customer Name, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Postpaid Bills Table */}
      <BillingTable
        bills={postpaidBills}
        loading={loadingPostpaid}
        page={postpaidPage}
        totalPages={postpaidTotalPages}
        onPageChange={setPostpaidPage}
        totalCount={totalPostpaidBillsCount}
        onInspect={handleOpenDetails}
        isPostpaid={true}
        title="Postpaid Customer Bills List"
        getStatusBadge={getStatusBadge}
        formatMoney={formatMoney}
        fmtDate={fmtDate}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
      />

      {/* Prepaid Bills Table */}
      <BillingTable
        bills={prepaidBills}
        loading={loadingPrepaid}
        page={prepaidPage}
        totalPages={prepaidTotalPages}
        onPageChange={setPrepaidPage}
        totalCount={totalPrepaidBillsCount}
        onInspect={handleOpenDetails}
        isPostpaid={false}
        title="Prepaid Customer Bills List"
        getStatusBadge={getStatusBadge}
        formatMoney={formatMoney}
        fmtDate={fmtDate}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
      />

      {/* Generate Postpaid Bill Popup Modal */}
      <AnimatePresence>
        {showGenerateModal && (
          <div className="skf-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="skf-modal"
              style={{ maxWidth: "480px" }}
            >
              <div className="skf-header">
                <div>
                  <h3 className="skf-title">Generate Postpaid Bill</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Calculate & create invoice for delivered orders</p>
                </div>
                <button type="button" onClick={() => setShowGenerateModal(false)} className="skf-close-btn">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleGenerateSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="skf-body">
                  <div className="skf-grid">
                    <div className="skf-field skf-full">
                      <label className="skf-label">
                        Select Postpaid Customer <span className="text-slate-400 font-normal text-xs">(Leave default for monthly batch)</span>
                      </label>
                      <select
                        value={genCustomerId}
                        onChange={(e) => setGenCustomerId(e.target.value)}
                        className="skf-select font-bold text-emerald-900 bg-emerald-50/50 border-emerald-300"
                      >
                        <option value="">-- All Eligible Postpaid Customers (Run Monthly Batch) --</option>
                        {eligibleCustomers.map((c: any) => (
                          <option key={c.customerId} value={c.customerId}>
                            {c.customerName || "Customer"} ({c.customerId})
                          </option>
                        ))}
                      </select>
                      {loadingEligible && (
                        <p className="text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin" /> Loading postpaid customers...
                        </p>
                      )}
                    </div>

                    <div className="skf-field skf-half">
                      <label className="skf-label">Period Start <span className="skf-required">*</span></label>
                      <input type="date" value={genPeriodStart} onChange={(e) => setGenPeriodStart(e.target.value)} className="skf-input font-bold" required />
                    </div>

                    <div className="skf-field skf-half">
                      <label className="skf-label">Period End <span className="skf-required">*</span></label>
                      <input type="date" value={genPeriodEnd} onChange={(e) => setGenPeriodEnd(e.target.value)} className="skf-input font-bold" required />
                    </div>

                    <div className="skf-field skf-full">
                      <label className="skf-label">Due Date <span className="skf-required">*</span></label>
                      <input type="date" value={genDueDate} onChange={(e) => setGenDueDate(e.target.value)} className="skf-input font-bold" required />
                    </div>
                  </div>
                </div>

                <div className="skf-footer">
                  <button type="button" onClick={() => setShowGenerateModal(false)} className="skf-btn skf-btn-cancel">Cancel</button>
                  <button type="submit" disabled={generating} className="skf-btn skf-btn-submit flex items-center gap-1.5">
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <span>Generate Bill</span>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inspect Delivered Orders Modal */}
      <AnimatePresence>
        {showDetailsModal && (
          <div className="skf-overlay">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className={`bg-white rounded-3xl border border-slate-200/60 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.18)] w-full overflow-hidden flex flex-col mx-4 my-8 ${showDetailsModal.is_postpaid_enabled !== false ? 'max-w-[600px]' : 'max-w-[460px]'
                }`}
              style={{ maxHeight: "calc(100vh - 4rem)" }}
            >
              {/* Gradient Header */}
              <div className="relative px-5 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between bg-gradient-to-br from-emerald-50/60 via-white to-white">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-center">
                    <FileText size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-black text-slate-800 tracking-tight leading-tight">
                      {showDetailsModal.customerName || "Customer Invoice"}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/60 uppercase tracking-wide">
                        #{showDetailsModal.billNumber}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${showDetailsModal.is_postpaid_enabled !== false
                        ? 'bg-violet-50 text-violet-700 border-violet-200/60'
                        : 'bg-sky-50 text-sky-700 border-sky-200/60'
                        }`}>
                        {showDetailsModal.is_postpaid_enabled !== false ? 'Postpaid' : 'Prepaid'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        ID: <span className="text-slate-500 font-bold">{showDetailsModal.customerId}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailsModal(null)}
                  className="p-1.5 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full border border-slate-200 transition-all duration-200 shadow-sm mt-0.5"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="px-5 py-5 space-y-3 overflow-y-auto max-h-[calc(100vh-14rem)] scrollbar-thin">

                {/* Date Pills Row */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-3.5 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0">
                      <Calendar size={12} className="text-emerald-600" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Billing Period</span>
                      <span className="text-[11px] font-black text-slate-700 mt-0.5 block">
                        {fmtDate(showDetailsModal.billingPeriod?.start)} &ndash; {fmtDate(showDetailsModal.billingPeriod?.end)}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-3.5 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0">
                      <Clock size={12} className="text-amber-500" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Due Date</span>
                      <span className="text-[11px] font-black text-slate-700 mt-0.5 block">{fmtDate(showDetailsModal.dueDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Financial Summary Card */}
                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-emerald-50/40 to-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-[9px] font-bold text-emerald-700/60 uppercase tracking-widest block">Total Amount</span>
                      <span className="text-[26px] font-black text-emerald-700 leading-tight mt-0.5 block">
                        {formatMoney(showDetailsModal.totalAmount)}
                      </span>
                    </div>
                    <div className="flex items-stretch gap-0 bg-white border border-slate-200/70 rounded-2xl overflow-hidden shadow-sm divide-x divide-slate-100">
                      <div className="flex flex-col items-center justify-center px-4 py-3 min-w-[70px]">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Paid</span>
                        <span className="text-sm font-black text-emerald-600 mt-1">{formatMoney(showDetailsModal.paidAmount)}</span>
                      </div>
                      <div className="flex flex-col items-center justify-center px-4 py-3 min-w-[70px]">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Balance</span>
                        <span className={`text-sm font-black mt-1 ${Number(showDetailsModal.balanceAmount) > 0 ? 'text-rose-500' : 'text-slate-400'
                          }`}>{formatMoney(showDetailsModal.balanceAmount)}</span>
                      </div>
                      <div className="flex flex-col items-center justify-center px-4 py-3">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</span>
                        {getStatusBadge(showDetailsModal.status, showDetailsModal.dueDate)}
                      </div>
                    </div>
                  </div>
                </div>


                {/* Modern Table List - Only shown for Postpaid bills */}
                {showDetailsModal.is_postpaid_enabled !== false && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <ShoppingBag size={16} className="text-emerald-600" />
                      <span>Pending Orders List ({modalOrdersToShow.length})</span>
                    </h4>

                    {loadingDetails ? (
                      <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                        <Loader2 size={24} className="animate-spin text-emerald-600" />
                        <span className="text-xs font-bold">Loading order details...</span>
                      </div>
                    ) : modalOrdersToShow.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 text-xs font-bold">
                        No order line-items found for this bill.
                      </div>
                    ) : (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                        <table className="w-full text-left border-collapse text-[13px]">
                          <thead>
                            <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                              <th className="py-3 px-4">Order Name</th>
                              <th className="py-3 px-4">Scheduled Date</th>
                              <th className="py-3 px-4 text-center">Type</th>
                              <th className="py-3 px-4 text-right">Order Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {modalOrdersToShow.map((ord, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors duration-150">
                                <td className="py-3.5 px-4 font-semibold text-emerald-700">{ord.orderName || "Standard Order"}</td>
                                <td className="py-3.5 px-4 font-bold text-slate-500">{fmtDate(ord.scheduledDate)}</td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className={`whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${(ord as any).orderSource === 'subscription'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200/30'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200/30'
                                    }`}>
                                    {(ord as any).orderSource || 'one-time'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right font-black text-slate-800">{formatMoney(ord.orderAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end bg-slate-50/30">
                <button
                  type="button"
                  onClick={() => setShowDetailsModal(null)}
                  className="px-4 py-2 bg-[#388E3C] hover:opacity-90 text-white rounded-lg text-xs font-bold shadow-sm transition-all duration-150"
                >
                  Close Invoice
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

