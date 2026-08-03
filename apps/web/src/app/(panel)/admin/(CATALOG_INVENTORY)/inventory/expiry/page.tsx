"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api.client";
import {
  LayoutDashboard, RefreshCw, Home, ChevronRight,
  Warehouse, MapPin, AlertTriangle, Truck,
  ArrowLeftRight, Factory, ArrowDownUp, Package
} from "lucide-react";
import Link from "next/link";

export default function InventoryDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/inventory/dashboard");
      if (res.data?.status) setData(res.data.data);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-[3px] border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const warehouseSummary = data?.warehouse_summary || [];
  const branchSummary = data?.branch_summary || [];
  const lowStockAlerts = data?.low_stock_alerts || [];
  const dispatchStatus = data?.dispatch_status || [];
  const transferStatus = data?.transfer_status || [];
  const productionReqs = data?.production_requirements || [];
  const recentMovements = data?.recent_movements || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Inventory Dashboard</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <LayoutDashboard size={24} className="text-emerald-500" /> Inventory Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">360° view of your inventory, dispatch, and delivery operations.</p>
        </div>
        <button onClick={fetchDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Warehouse Summary */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
          <Warehouse size={16} className="text-emerald-500" /> Warehouse Stock Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouseSummary.map((w: any) => (
            <div key={w.warehouse_id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800">{w.warehouse_name}</h3>
                <span className="text-[10px] font-mono text-slate-400">{w.code}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-emerald-50">
                  <p className="text-[10px] text-emerald-500 font-bold">Available</p>
                  <p className="font-bold text-emerald-700">{Number(w.total_available || 0).toLocaleString("en-IN")}</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-50">
                  <p className="text-[10px] text-amber-500 font-bold">Reserved</p>
                  <p className="font-bold text-amber-700">{Number(w.total_reserved || 0).toLocaleString("en-IN")}</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-50">
                  <p className="text-[10px] text-blue-500 font-bold">Dispatched</p>
                  <p className="font-bold text-blue-700">{Number(w.total_dispatched || 0).toLocaleString("en-IN")}</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50">
                  <p className="text-[10px] text-slate-500 font-bold">Stock Value</p>
                  <p className="font-bold text-slate-700">₹{Number(w.stock_value || 0).toLocaleString("en-IN")}</p>
                </div>
              </div>
              {(w.low_stock_count > 0 || w.out_of_stock_count > 0) && (
                <div className="mt-2 flex gap-2">
                  {w.low_stock_count > 0 && <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-bold border border-amber-200">{w.low_stock_count} low</span>}
                  {w.out_of_stock_count > 0 && <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full font-bold border border-rose-200">{w.out_of_stock_count} out</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Branch Summary + Low Stock Alerts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch Summary */}
        <div>
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
            <MapPin size={16} className="text-blue-500" /> Branch Stock Summary
          </h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">Branch</th>
                  <th className="px-4 py-2.5 text-center">Demand</th>
                  <th className="px-4 py-2.5 text-center">Orders</th>
                  <th className="px-4 py-2.5 text-center">Dispatched</th>
                </tr>
              </thead>
              <tbody>
                {branchSummary.map((b: any) => (
                  <tr key={b.branch_id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-semibold text-slate-700">{b.branch_name}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-violet-600">{b.predicted_demand}</td>
                    <td className="px-4 py-2.5 text-center text-slate-600">{b.orders_today}</td>
                    <td className="px-4 py-2.5 text-center text-blue-600">{b.dispatched_today}</td>
                  </tr>
                ))}
                {branchSummary.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No branch data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div>
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-500" /> Low Stock Alerts
            {lowStockAlerts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-600">{lowStockAlerts.length}</span>
            )}
          </h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 max-h-80 overflow-y-auto space-y-2">
            {lowStockAlerts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <Package size={32} className="mx-auto mb-2 text-slate-200" />
                All stock levels healthy
              </div>
            ) : lowStockAlerts.slice(0, 15).map((alert: any, idx: number) => (
              <div key={idx} className={`flex items-center justify-between p-2.5 rounded-xl ${Number(alert.available_quantity) <= 0 ? "bg-rose-50" : "bg-amber-50"}`}>
                <div>
                  <p className="text-xs font-semibold text-slate-700">{alert.product_name} — {alert.variant_name}</p>
                  <p className="text-[10px] text-slate-400">{alert.warehouse_name}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${Number(alert.available_quantity) <= 0 ? "text-rose-600" : "text-amber-600"}`}>
                    {Number(alert.available_quantity)}
                  </p>
                  <p className="text-[10px] text-slate-400">/ {alert.low_stock_threshold}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dispatch & Transfer Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
            <Truck size={16} className="text-blue-500" /> Today&apos;s Dispatch Status
          </h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            {dispatchStatus.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No dispatch plans today</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {dispatchStatus.map((d: any) => (
                  <div key={d.status} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-center min-w-[80px]">
                    <p className="text-[10px] text-slate-400 capitalize">{(d.status || "").replace(/_/g, " ")}</p>
                    <p className="text-lg font-black text-slate-800">{d.count}</p>
                    <p className="text-[10px] text-slate-400">{d.total_qty} qty</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
            <ArrowLeftRight size={16} className="text-teal-500" /> Transfer Status (30d)
          </h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            {transferStatus.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No recent transfers</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {transferStatus.map((t: any) => (
                  <div key={t.status} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-center min-w-[80px]">
                    <p className="text-[10px] text-slate-400 capitalize">{(t.status || "").replace(/_/g, " ")}</p>
                    <p className="text-lg font-black text-slate-800">{t.count}</p>
                    <p className="text-[10px] text-slate-400">{Number(t.total_qty || 0).toLocaleString("en-IN")} qty</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Stock Movements */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
          <ArrowDownUp size={16} className="text-indigo-500" /> Recent Stock Movements
        </h2>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">Product</th>
                  <th className="px-4 py-2.5 text-left">Warehouse</th>
                  <th className="px-4 py-2.5 text-center">Type</th>
                  <th className="px-4 py-2.5 text-center">Dir</th>
                  <th className="px-4 py-2.5 text-center">Qty</th>
                  <th className="px-4 py-2.5 text-center">Before → After</th>
                  <th className="px-4 py-2.5 text-left">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.slice(0, 10).map((m: any) => (
                  <tr key={m.movement_id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-slate-700">{m.product_name || "—"}</p>
                      <p className="text-[10px] text-slate-400">{m.variant_name}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{m.warehouse_name || "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 capitalize">
                        {(m.movement_type || "").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`font-bold ${m.direction === 1 ? "text-emerald-600" : "text-rose-600"}`}>
                        {m.direction === 1 ? "↓ IN" : "↑ OUT"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-slate-700">{Number(m.quantity).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 text-center text-slate-400">
                      {m.quantity_before} → {m.quantity_after}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">
                      {m.created_at ? new Date(m.created_at).toLocaleString("en-IN", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
                      }) : "—"}
                    </td>
                  </tr>
                ))}
                {recentMovements.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No recent movements</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
