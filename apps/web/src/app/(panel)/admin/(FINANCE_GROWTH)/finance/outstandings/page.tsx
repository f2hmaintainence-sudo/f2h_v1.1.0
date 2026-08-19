"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api.client";
import Link from "next/link";
import { showSuccessToast, showErrorToast, showWarningToast } from "@/components/Toast";
import {
  FileText, RefreshCw, ChevronRight, Home, Search,
  CheckCircle2, Clock, AlertTriangle, X, PlusCircle,
  Eye, Loader2, ChevronLeft, Calendar, CreditCard, ShoppingBag, ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "@/components/Table Generator/SkeletonForm.css";
import { BillingTable } from "../../reports/billing/components/BillingTable";

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
}

export default function OutstandingPage() {
  const [bills, setBills] = useState<PostpaidBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Action States
  const [showDetailsModal, setShowDetailsModal] = useState<PostpaidBill | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Summary Stats
  const [stats, setStats] = useState({ totalOutstanding: 0, overdueCount: 0 });

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        type: "postpaid",
        status: "overdue",
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
      });
      const res = await api.get<any>(`/admin/postpaid-bills?${params}`);
      if (res.data?.status && Array.isArray(res.data.data)) {
        setBills(res.data.data);
        setTotalPages(res.data.meta?.totalPages || 1);
        setTotalCount(res.data.meta?.total || 0);
      } else {
        setBills([]);
      }
    } catch (err) {
      console.error("Failed to load outstanding bills:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page]);

  const fetchSummaryStats = useCallback(async () => {
    try {
      const res = await api.get<any>("/admin/postpaid-bills?limit=500&type=postpaid&status=overdue");
      if (res.data?.status && Array.isArray(res.data.data)) {
        let outstanding = 0;
        for (const b of res.data.data) {
          outstanding += Number(b.balanceAmount || 0);
        }
        setStats({ totalOutstanding: outstanding, overdueCount: res.data.meta?.total || 0 });
      }
    } catch (err) {
      console.error("Failed to load outstanding stats:", err);
    }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);
  useEffect(() => { fetchSummaryStats(); }, [fetchSummaryStats]);

  const handleOpenDetails = async (bill: PostpaidBill) => {
    setShowDetailsModal(bill);
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
        <span className="font-bold text-slate-800">Outstanding Balances</span>
      </nav>

      {/* Clean Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <ShieldAlert className="text-rose-600 shrink-0" size={28} /> Outstanding Balances
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            View and manage postpaid customers with overdue billing balances.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => { fetchBills(); fetchSummaryStats(); }}
            title="Refresh Data"
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
          >
            <RefreshCw size={18} className={loading ? "animate-spin text-emerald-600" : ""} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Total Outstanding Amount", val: formatMoney(stats.totalOutstanding), cls: "text-rose-600" },
          { label: "Overdue Invoices Count", val: `${stats.overdueCount} Bills`, cls: "text-amber-600" },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{card.label}</span>
            <p className={`text-2xl font-black mt-1 ${card.cls}`}>{card.val}</p>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <span className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#388E3C] text-white shadow-sm shrink-0">
            Overdue Bills Only
          </span>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search Bill #, Customer Name, ID..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Overdue Bills List */}
      <BillingTable
        bills={bills}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalCount={totalCount}
        onInspect={handleOpenDetails}
        isPostpaid={true}
        title="Outstanding Postpaid Bills List"
        getStatusBadge={getStatusBadge}
        formatMoney={formatMoney}
        fmtDate={fmtDate}
        statusFilter="OVERDUE"
        searchQuery={searchQuery}
      />

      {/* Inspect Delivered Orders Modal */}
      <AnimatePresence>
        {showDetailsModal && (
          <div className="skf-overlay">
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.98 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-[950px] overflow-hidden flex flex-col mx-4 my-8"
              style={{ maxHeight: "calc(100vh - 4rem)" }}
            >
              {/* Premium Header */}
              <div className="relative px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50 shadow-sm flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-black text-slate-800 tracking-tight">
                        {showDetailsModal.customerName || "Customer Invoice"}
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200/50 uppercase tracking-wide">
                        #{showDetailsModal.billNumber}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                      Customer ID: <span className="text-slate-600 font-extrabold">{showDetailsModal.customerId}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailsModal(null)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all duration-200"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="px-6 py-6 space-y-6 overflow-y-auto max-h-[calc(100vh-16rem)] scrollbar-thin">
                {/* Visual Grid Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400 border border-slate-100">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Period Start</span>
                      <span className="text-sm font-black text-slate-700 mt-0.5 block">
                        {fmtDate(showDetailsModal.billingPeriod?.start || showDetailsModal.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400 border border-slate-100">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Period End</span>
                      <span className="text-sm font-black text-slate-700 mt-0.5 block">
                        {fmtDate(showDetailsModal.billingPeriod?.end || showDetailsModal.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400 border border-slate-100">
                      <Clock size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Due Date</span>
                      <span className="text-sm font-black text-slate-700 mt-0.5 block">
                        {fmtDate(showDetailsModal.dueDate)}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400 border border-slate-100">
                      <CreditCard size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                      <div className="mt-1">
                        {getStatusBadge(showDetailsModal.status, showDetailsModal.dueDate)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Styled Financial Banner */}
                <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white border border-emerald-500/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800/80 uppercase tracking-wider block">Total Invoiced Amount</span>
                    <span className="text-3xl font-black text-emerald-700 mt-1 block">
                      {formatMoney(showDetailsModal.totalAmount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 divide-x divide-slate-100 bg-white border border-slate-100 rounded-xl p-3.5 shadow-sm">
                    <div className="px-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Paid To Date</span>
                      <span className="text-base font-black text-emerald-600 mt-0.5 block">
                        {formatMoney(showDetailsModal.paidAmount)}
                      </span>
                    </div>
                    <div className="pl-6 pr-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Remaining Balance</span>
                      <span className={`text-base font-black mt-0.5 block ${showDetailsModal.balanceAmount > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                        {formatMoney(showDetailsModal.balanceAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modern Table List */}
                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <ShoppingBag size={16} className="text-emerald-600" />
                    <span>Delivered Orders List ({showDetailsModal.ordersIncluded?.length || showDetailsModal.orderCount || 0})</span>
                  </h4>

                  {loadingDetails ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                      <Loader2 size={24} className="animate-spin text-emerald-600" />
                      <span className="text-xs font-bold">Loading order details...</span>
                    </div>
                  ) : !showDetailsModal.ordersIncluded || showDetailsModal.ordersIncluded.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 text-xs font-bold">
                      No order line-items found for this bill.
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                      <table className="w-full text-left border-collapse text-[13px]">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="py-3 px-4">Order ID</th>
                            <th className="py-3 px-4">Order Name</th>
                            <th className="py-3 px-4">Scheduled Date</th>
                            <th className="py-3 px-4 text-center">Slot</th>
                            <th className="py-3 px-4 text-center">Type</th>
                            <th className="py-3 px-4 text-right">Order Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {showDetailsModal.ordersIncluded.map((ord, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors duration-150">
                              <td className="py-3.5 px-4 font-bold text-slate-700">{ord.orderId}</td>
                              <td className="py-3.5 px-4 font-semibold text-emerald-700">{ord.orderName || "Standard Order"}</td>
                              <td className="py-3.5 px-4 font-bold text-slate-500">{fmtDate(ord.scheduledDate)}</td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                  String(ord.deliverySlot || '').toUpperCase().includes('EVE')
                                    ? 'bg-blue-50 text-blue-700 border-blue-200/30'
                                    : 'bg-amber-50 text-amber-700 border-amber-200/30'
                                }`}>
                                  {ord.deliverySlot || "Morning"}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                  (ord as any).orderSource === 'subscription' 
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200/30' 
                                    : 'bg-blue-50 text-blue-700 border-blue-200/30'
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
              </div>

              {/* Premium Footer */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/50 gap-3">
                <button
                  type="button"
                  onClick={() => setShowDetailsModal(null)}
                  className="px-5 py-2.5 bg-[#388E3C] hover:opacity-90 text-white rounded-xl text-xs font-black shadow-sm transition-all duration-150"
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
