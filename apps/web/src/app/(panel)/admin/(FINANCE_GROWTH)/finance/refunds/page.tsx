"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/services/api.client";
import {
  ArrowRightLeft,
  ChevronRight,
  Home,
  RefreshCw,
  Search,
  Download,
  Calendar,
  Wallet,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
  Layers,
  Filter,
  DollarSign
} from "lucide-react";
import Link from "next/link";

function formatMoney(amount: number) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
}

export default function RefundsPage() {
  const [data, setData] = useState<any[]>([]);
  const [refundsList, setRefundsList] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "subscription_pause_refund" | "order_refund">("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    try {
      const [reportRes, listRes] = await Promise.all([
        api.get<any>(`/admin/analytics/refunds?days=${days}`),
        api.get<any>(`/admin/analytics/refunds/list?days=${days}`)
      ]);
      if (reportRes.data?.data) setData(reportRes.data.data);
      if (listRes.data?.data) setRefundsList(listRes.data.data);
    } catch (err) {
      console.error("Failed to load refunds data", err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  // Derived metrics
  const totalAmount = useMemo(() => {
    return refundsList.reduce((acc, r) => acc + Number(r.refund_amount || 0), 0);
  }, [refundsList]);

  const totalCount = refundsList.length;

  const subscriptionRefunds = useMemo(() => {
    return refundsList.filter((r) => r.category === "subscription_pause_refund");
  }, [refundsList]);

  const orderRefunds = useMemo(() => {
    return refundsList.filter((r) => r.category !== "subscription_pause_refund");
  }, [refundsList]);

  const subTotalAmount = useMemo(() => {
    return subscriptionRefunds.reduce((acc, r) => acc + Number(r.refund_amount || 0), 0);
  }, [subscriptionRefunds]);

  const orderTotalAmount = useMemo(() => {
    return orderRefunds.reduce((acc, r) => acc + Number(r.refund_amount || 0), 0);
  }, [orderRefunds]);

  // Filtered Refunds List
  const filteredRefunds = useMemo(() => {
    return refundsList.filter((item) => {
      // Category filter
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus !== "all" && item.status !== selectedStatus) {
        return false;
      }
      // Search term filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const refNo = String(item.refund_number || "").toLowerCase();
        const custId = String(item.customer_id || "").toLowerCase();
        const orderId = String(item.order_id || "").toLowerCase();
        const reason = String(item.reason || "").toLowerCase();
        return (
          refNo.includes(query) ||
          custId.includes(query) ||
          orderId.includes(query) ||
          reason.includes(query)
        );
      }
      return true;
    });
  }, [refundsList, selectedCategory, selectedStatus, searchTerm]);

  // Export CSV helper
  const handleExportCSV = () => {
    if (!filteredRefunds.length) return;
    const headers = [
      "Refund ID",
      "Customer ID",
      "Order/Sub ID",
      "Category",
      "Method",
      "Status",
      "Amount",
      "Reason",
      "Date"
    ];

    const csvRows = filteredRefunds.map((r) => [
      r.refund_number,
      r.customer_id,
      r.order_id || "",
      r.category === "subscription_pause_refund" ? "Subscription Pause" : "Order Refund",
      r.refund_type || "Wallet Deposit",
      r.status,
      r.refund_amount,
      `"${(r.reason || "").replace(/"/g, '""')}"`,
      new Date(r.created_at).toISOString()
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Refunds_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 bg-slate-50/50 min-h-screen">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs md:text-sm text-slate-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600 font-medium">
          <Home size={14} /> Dashboard
        </Link>
        <ChevronRight size={14} className="text-slate-300" />
        <span className="text-slate-500">Finance</span>
        <ChevronRight size={14} className="text-slate-300" />
        <span className="font-semibold text-slate-900">Refund Command Center</span>
      </nav>

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-2xl border border-rose-200/50 shadow-sm">
              <ArrowRightLeft size={24} />
            </div>
            Refund Tracking & Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time audit log of order cancellations, returns, and automated monthly subscription pause refunds.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Days selector */}
          <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            {[7, 14, 30, 90, 365].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  days === d
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {d === 365 ? "All Time" : `${d}d`}
              </button>
            ))}
          </div>

          <button
            onClick={fetchRefunds}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 shadow-sm transition-all"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-emerald-600" : ""} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!filteredRefunds.length}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Refunded */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Refunded</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{formatMoney(totalAmount)}</h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">{totalCount} total transactions</p>
          </div>
        </div>

        {/* Card 2: Subscription Pause Refunds */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Subscription Pause</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{formatMoney(subTotalAmount)}</h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {subscriptionRefunds.length} pause refund entries
            </p>
          </div>
        </div>

        {/* Card 3: Order Refunds */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Order & Cancellations</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{formatMoney(orderTotalAmount)}</h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">{orderRefunds.length} order refund entries</p>
          </div>
        </div>

        {/* Card 4: Wallet Credit Payouts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Direct Wallet Deposit</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">
              {formatMoney(
                refundsList
                  .filter((r) => r.refund_type === "wallet_deposit" || r.category === "subscription_pause_refund")
                  .reduce((a, b) => a + Number(b.refund_amount || 0), 0)
              )}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Instant customer wallet credit</p>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4">
        {/* Table Filter & Search Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl w-fit">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedCategory === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Refunds ({totalCount})
            </button>
            <button
              onClick={() => setSelectedCategory("subscription_pause_refund")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                selectedCategory === "subscription_pause_refund"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar size={13} />
              Subscription Pause ({subscriptionRefunds.length})
            </button>
            <button
              onClick={() => setSelectedCategory("order_refund")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                selectedCategory === "order_refund"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Package size={13} />
              Order Refunds ({orderRefunds.length})
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search refund ID, customer, order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-medium placeholder:text-slate-400"
              />
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Status</option>
              <option value="processed">Processed</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Detailed Refunds Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-rose-100 border-t-rose-600 rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading Refund Records...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="px-5 py-3.5">Refund ID / Reference</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Order / Sub ID</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  <th className="px-5 py-3.5">Method</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Reason / Breakdown</th>
                  <th className="px-5 py-3.5 text-right">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRefunds.map((r, i) => {
                  const isSubRefund = r.category === "subscription_pause_refund";
                  return (
                    <tr key={r.id || i} className="hover:bg-slate-50/80 transition-colors">
                      {/* Refund ID */}
                      <td className="px-5 py-4 font-mono text-xs font-bold text-slate-800">
                        {r.refund_number}
                      </td>

                      {/* Customer ID */}
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/customers/${r.customer_id}`}
                          className="font-mono text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                        >
                          {r.customer_id}
                        </Link>
                      </td>

                      {/* Order or Sub ID */}
                      <td className="px-5 py-4 font-mono text-xs text-slate-600">
                        {r.order_id || "—"}
                      </td>

                      {/* Category Badge */}
                      <td className="px-5 py-4">
                        {isSubRefund ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/60">
                            <Calendar size={12} />
                            Sub Pause Refund
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200/60">
                            <Package size={12} />
                            Order Refund
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-4 text-right font-black text-rose-600 text-sm">
                        {formatMoney(Number(r.refund_amount))}
                      </td>

                      {/* Method */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 capitalize">
                          <Wallet size={13} className="text-slate-400" />
                          {r.refund_type === "wallet_deposit" ? "Wallet Deposit" : r.refund_type || "Wallet"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                            r.status === "processed" || r.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : r.status === "pending"
                              ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                              : "bg-rose-50 text-rose-700 border border-rose-200/60"
                          }`}
                        >
                          {r.status === "processed" || r.status === "completed" ? (
                            <CheckCircle2 size={11} />
                          ) : r.status === "pending" ? (
                            <Clock size={11} />
                          ) : (
                            <XCircle size={11} />
                          )}
                          {r.status || "processed"}
                        </span>
                      </td>

                      {/* Reason */}
                      <td
                        className="px-5 py-4 text-xs text-slate-600 max-w-[240px] truncate"
                        title={r.reason}
                      >
                        {r.reason || "Subscription paused item refund"}
                      </td>

                      {/* Date & Time */}
                      <td className="px-5 py-4 text-right font-medium text-slate-500 text-xs whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}{" "}
                        <span className="text-[10px] text-slate-400">
                          {new Date(r.created_at).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {filteredRefunds.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-16">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="p-4 bg-slate-100 text-slate-400 rounded-full">
                          <Filter size={24} />
                        </div>
                        <p className="text-sm font-bold text-slate-700 mt-1">No refund records found</p>
                        <p className="text-xs text-slate-400">
                          Try adjusting your search criteria or selecting a different time range.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
