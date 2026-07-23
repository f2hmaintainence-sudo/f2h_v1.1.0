"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  ShoppingCart, Package, Truck, CheckCircle2, Clock, AlertTriangle,
  XCircle, RefreshCw, Home, ChevronRight, Eye, ArrowRight,
  Zap, Filter, Search
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";

interface Order {
  order_id: string; customer_name: string; status: string; total_amount: number;
  delivery_slot: string; address_line: string; contact_number: string;
  branch_id: string; branch_name: string; order_source: string;
  delivery_partner_id: string; partner_name: string;
  created_at: string; scheduled_date: string;
}

const statusConfig: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  pending: { icon: Clock, color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200", label: "Pending" },
  placed: { icon: ShoppingCart, color: "text-sky-600", bgColor: "bg-sky-50 border-sky-200", label: "Placed" },
  confirmed: { icon: CheckCircle2, color: "text-teal-600", bgColor: "bg-teal-50 border-teal-200", label: "Confirmed" },
  packed: { icon: Package, color: "text-indigo-600", bgColor: "bg-indigo-50 border-indigo-200", label: "Packed" },
  out_for_delivery: { icon: Truck, color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200", label: "Out for Delivery" },
  delivered: { icon: CheckCircle2, color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200", label: "Delivered" },
  failed: { icon: XCircle, color: "text-rose-600", bgColor: "bg-rose-50 border-rose-200", label: "Failed" },
  cancelled: { icon: XCircle, color: "text-slate-500", bgColor: "bg-slate-50 border-slate-200", label: "Cancelled" },
};

const statusFlow = ["pending", "placed", "confirmed", "packed", "out_for_delivery", "delivered"];

export default function LiveOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [branches, setBranches] = useState<any[]>([]);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (branchFilter) params.append("branch_id", branchFilter);
      const qs = params.toString() ? `?${params.toString()}` : "";

      const [trackRes, summaryRes] = await Promise.all([
        api.get<any>(`/admin/delivery/tracking${qs}`),
        api.get<any>("/admin/delivery/tracking/summary"),
      ]);
      if (trackRes.data?.data) setOrders(trackRes.data.data);
      if (summaryRes.data?.data) setSummary(summaryRes.data.data);
      if (silent) showSuccessToast("Orders refreshed");
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, [statusFilter, branchFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => fetchOrders(true), 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useEffect(() => {
    api.get<any>("/admin/dashboard/branch-performance?days=1").then(res => {
      if (res.data?.data) setBranches(res.data.data);
    }).catch(() => { });
  }, []);

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await api.patch<any>(`/admin/delivery/orders/${orderId}/status`, { status: newStatus });
      showSuccessToast(`Order updated to ${newStatus.replace(/_/g, " ")}`);
      fetchOrders(true);
    } catch { alert("Failed to update status"); }
  };

  const filteredOrders = orders.filter(o => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return o.order_id?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.address_line?.toLowerCase().includes(q) ||
        o.contact_number?.includes(q);
    }
    return true;
  });

  const getNextStatus = (current: string): string | null => {
    const idx = statusFlow.indexOf(current);
    if (idx >= 0 && idx < statusFlow.length - 1) return statusFlow[idx + 1];
    return null;
  };

  return (
    <div className="space-y-5 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Live Orders</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ShoppingCart size={24} className="text-blue-500" /> Live Orders
          </h1>
          <p className="text-xs text-slate-400 mt-1">Real-time order management • Auto-refreshes every 30s</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchOrders(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all">
            <RefreshCw size={14} className={refreshing ? "animate-spin text-emerald-500" : ""} /> Refresh
          </button>
          <Link href="/admin/delivery/assign"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm">
            <Zap size={14} /> Create Runs
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { label: "Total", value: summary.total_orders, color: "bg-slate-50 border-slate-200" },
            { label: "Assigned", value: summary.assigned, color: "bg-emerald-50 border-emerald-200" },
            { label: "Unassigned", value: summary.unassigned, color: "bg-amber-50 border-amber-200" },
            { label: "In Transit", value: summary.in_transit, color: "bg-blue-50 border-blue-200" },
            { label: "Delivered", value: summary.delivered, color: "bg-green-50 border-green-200" },
            { label: "Failed", value: summary.failed, color: "bg-rose-50 border-rose-200" },
            { label: "Cancelled", value: summary.cancelled, color: "bg-gray-50 border-gray-200" },
            { label: "Partners", value: summary.active_partners, color: "bg-indigo-50 border-indigo-200" },
          ].map(c => (
            <div key={c.label} className={`${c.color} rounded-xl p-3 border transition-all hover:shadow-sm`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.label}</p>
              <p className="text-xl font-black text-slate-900">{c.value ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search orders, customers, addresses..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
          />
        </div>
        <div className="flex flex-wrap gap-1 bg-white rounded-lg border border-slate-200 p-1 w-fit">
          {["", "pending", "confirmed", "packed", "out_for_delivery", "delivered", "failed"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-all ${statusFilter === s
                ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
              {s ? s.replace(/_/g, " ") : "All"}
            </button>
          ))}
        </div>
        {branches.length > 0 && (
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
            <option value="">All Branches</option>
            {branches.map((b: any) => (
              <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-[3px] border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <ShoppingCart size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">No orders match your filters</p>
          <p className="text-xs text-slate-300 mt-1">Try changing the status or search query</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Order</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Slot</th>
                  <th className="px-4 py-3 text-left">Partner</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => {
                  const sc = statusConfig[o.status] || statusConfig.pending;
                  const StatusIcon = sc.icon;
                  const nextStatus = getNextStatus(o.status);
                  return (
                    <tr key={o.order_id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-600 font-semibold">
                          {String(o.order_id).slice(0, 12)}
                        </span>
                        <p className="text-[10px] text-slate-400 capitalize">{o.order_source || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800 text-xs">{o.customer_name || "N/A"}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{o.address_line || ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${sc.bgColor} ${sc.color}`}>
                          <StatusIcon size={10} />{sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 capitalize">{o.delivery_slot || "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {o.partner_name || <span className="text-amber-500 font-bold">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                        ₹{Number(o.total_amount ?? 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {nextStatus && o.status !== "cancelled" && o.status !== "delivered" && o.status !== "failed" ? (
                          <button onClick={() => handleStatusUpdate(o.order_id, nextStatus)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-all border border-emerald-200">
                            <ArrowRight size={10} /> {nextStatus.replace(/_/g, " ")}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50/50 border-t text-xs text-slate-400">
            Showing {filteredOrders.length} orders
          </div>
        </div>
      )}
    </div>
  );
}
