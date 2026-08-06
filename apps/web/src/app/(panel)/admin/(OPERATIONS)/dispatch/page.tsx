"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  Package, Truck, CheckCircle2, Clock, AlertTriangle,
  RefreshCw, Home, ChevronRight, Search, Filter,
  ClipboardCheck, ArrowRight, Box, ShoppingBag, Printer
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";

interface Order {
  order_id: string; customer_name: string; status: string; total_amount: number;
  delivery_slot: string; address_line: string; contact_number: string;
  order_source: string; delivery_partner_id: string; partner_name: string;
  items_count?: number;
}

export default function DispatchPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"to_pack" | "packed" | "dispatched">("to_pack");
  const [searchQuery, setSearchQuery] = useState("");

  const statusMap: Record<string, string> = {
    to_pack: "confirmed",
    packed: "packed",
    dispatched: "out_for_delivery",
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const status = statusMap[activeTab];
      const [trackRes, summaryRes] = await Promise.all([
        api.get<any>(`/admin/delivery/tracking?status=${status}`),
        api.get<any>("/admin/delivery/tracking/summary"),
      ]);
      if (trackRes.data?.data) setOrders(trackRes.data.data);
      if (summaryRes.data?.data) setSummary(summaryRes.data.data);
      setSelectedOrders(new Set());
    } catch { } finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleBulkAction = async (newStatus: string) => {
    if (selectedOrders.size === 0) return;
    const label = newStatus.replace(/_/g, " ");
    if (!confirm(`Mark ${selectedOrders.size} orders as "${label}"?`)) return;

    let success = 0;
    for (const orderId of selectedOrders) {
      try {
        await api.patch<any>(`/admin/delivery/orders/${orderId}/status`, { status: newStatus });
        success++;
      } catch { }
    }
    showSuccessToast(`${success} orders updated to ${label}`);
    fetchOrders();
  };

  const handleSingleAction = async (orderId: string, newStatus: string) => {
    try {
      await api.patch<any>(`/admin/delivery/orders/${orderId}/status`, { status: newStatus });
      showSuccessToast(`Order updated to ${newStatus.replace(/_/g, " ")}`);
      fetchOrders();
    } catch { alert("Failed to update"); }
  };

  const toggleSelect = (orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.order_id)));
    }
  };

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return o.order_id?.toLowerCase().includes(q) ||
      o.customer_name?.toLowerCase().includes(q) ||
      o.address_line?.toLowerCase().includes(q);
  });

  const tabs = [
    { key: "to_pack" as const, label: "Ready to Pack", icon: Box, count: summary?.today_confirmed ?? 0, color: "text-teal-600" },
    { key: "packed" as const, label: "Packed", icon: Package, count: summary?.today_packed ?? 0, color: "text-indigo-600" },
    { key: "dispatched" as const, label: "Dispatched", icon: Truck, count: summary?.in_transit ?? 0, color: "text-blue-600" },
  ];

  const getActionConfig = () => {
    switch (activeTab) {
      case "to_pack": return { nextStatus: "packed", label: "Mark Packed", icon: Package };
      case "packed": return { nextStatus: "out_for_delivery", label: "Dispatch", icon: Truck };
      case "dispatched": return { nextStatus: "delivered", label: "Mark Delivered", icon: CheckCircle2 };
    }
  };

  const action = getActionConfig();

  return (
    <div className="space-y-5 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Dispatch & Packing</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Package size={24} className="text-indigo-500" /> Dispatch & Packing
          </h1>
          <p className="text-xs text-slate-400 mt-1">Pack, verify, and dispatch orders for delivery</p>
        </div>
        <button onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Pipeline Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Confirmed", value: summary.today_confirmed ?? 0, icon: ClipboardCheck, color: "bg-teal-50 border-teal-200 text-teal-600" },
            { label: "Packed", value: summary.today_packed ?? 0, icon: Package, color: "bg-indigo-50 border-indigo-200 text-indigo-600" },
            { label: "In Transit", value: summary.in_transit ?? 0, icon: Truck, color: "bg-blue-50 border-blue-200 text-blue-600" },
            { label: "Delivered", value: summary.delivered ?? 0, icon: CheckCircle2, color: "bg-emerald-50 border-emerald-200 text-emerald-600" },
          ].map(c => {
            const Icon = c.icon;
            return (
              <div key={c.label} className={`${c.color} rounded-xl p-4 border transition-all hover:shadow-sm`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{c.label}</span>
                </div>
                <p className="text-2xl font-black text-slate-900">{c.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1.5 w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.key
                ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>
              <Icon size={14} /> {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === tab.key
                ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + Bulk Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
        </div>
        {selectedOrders.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">{selectedOrders.size} selected</span>
            <button onClick={() => handleBulkAction(action.nextStatus)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm">
              <action.icon size={14} /> {action.label} All
            </button>
          </div>
        )}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-[3px] border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <Package size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">No orders in this stage</p>
          <p className="text-xs text-slate-300 mt-1">Orders will appear here as they move through the pipeline</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  </th>
                  <th className="px-4 py-3 text-left">Order</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Slot</th>
                  <th className="px-4 py-3 text-left">Partner</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(o => (
                  <tr key={o.order_id} className={`border-b last:border-0 transition-colors ${selectedOrders.has(o.order_id) ? "bg-indigo-50/40" : "hover:bg-slate-50/50"}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedOrders.has(o.order_id)}
                        onChange={() => toggleSelect(o.order_id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-600 font-semibold">{String(o.order_id).slice(0, 12)}</span>
                      <p className="text-[10px] text-slate-400 capitalize">{o.order_source || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 text-xs">{o.customer_name || "N/A"}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{o.address_line || ""}</p>
                      {o.contact_number && <p className="text-[10px] text-slate-400">{o.contact_number}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 capitalize">{o.delivery_slot || "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {o.partner_name || <span className="text-amber-500 font-bold">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                      ₹{Number(o.total_amount ?? 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleSingleAction(o.order_id, action.nextStatus)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-all border border-indigo-200">
                        <action.icon size={10} /> {action.label}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50/50 border-t flex items-center justify-between text-xs text-slate-400">
            <span>{filteredOrders.length} orders</span>
            {selectedOrders.size > 0 && <span className="font-bold text-indigo-600">{selectedOrders.size} selected</span>}
          </div>
        </div>
      )}
    </div>
  );
}
