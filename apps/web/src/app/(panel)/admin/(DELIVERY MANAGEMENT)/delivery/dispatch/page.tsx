"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  SendHorizontal, RefreshCw, Home, ChevronRight,
  Package, Truck, RotateCcw, AlertTriangle
} from "lucide-react";
import Link from "next/link";

export default function DeliveryDispatchPage() {
  const [summary, setSummary] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/delivery/dispatch/summary");
      if (res.data?.status) {
        setSummary(res.data.data || []);
        setTotals(res.data.totals || {});
      }
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-400">Delivery</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Delivery Dispatch</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <SendHorizontal size={24} className="text-indigo-500" /> Delivery Dispatch
          </h1>
          <p className="text-xs text-slate-400 mt-1">Stock dispatched to delivery boys — planned, loaded, delivered, returned, and damaged quantities.</p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Runs", value: totals.total_runs ?? 0, icon: Truck, color: "text-blue-600 bg-blue-50" },
          { label: "Products", value: totals.unique_products ?? 0, icon: Package, color: "text-indigo-600 bg-indigo-50" },
          { label: "Planned", value: Number(totals.total_planned || 0), icon: Package, color: "text-slate-600 bg-slate-50" },
          { label: "Loaded", value: Number(totals.total_loaded || 0), icon: Package, color: "text-sky-600 bg-sky-50" },
          { label: "Delivered", value: Number(totals.total_delivered || 0), icon: Package, color: "text-emerald-600 bg-emerald-50" },
          { label: "Returned", value: Number(totals.total_returned || 0), icon: RotateCcw, color: "text-amber-600 bg-amber-50" },
          { label: "Damaged", value: Number(totals.total_damaged || 0), icon: AlertTriangle, color: "text-rose-600 bg-rose-50" },
        ].map((card, idx) => (
          <div key={idx} className={`p-3 rounded-2xl border border-gray-100 ${card.color}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{card.label}</p>
            <h3 className="text-lg font-black mt-0.5">{card.value.toLocaleString("en-IN")}</h3>
          </div>
        ))}
      </div>

      {/* Dispatch Items Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-[3px] border-indigo-100 border-t-indigo-500 rounded-full animate-spin" /></div>
      ) : summary.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <SendHorizontal size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">No dispatch items for today</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Run / Slot</th>
                  <th className="px-4 py-3 text-left">Delivery Boy</th>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Warehouse</th>
                  <th className="px-4 py-3 text-center">Planned</th>
                  <th className="px-4 py-3 text-center">Loaded</th>
                  <th className="px-4 py-3 text-center">Delivered</th>
                  <th className="px-4 py-3 text-center">Returned</th>
                  <th className="px-4 py-3 text-center">Damaged</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((item: any, i: number) => {
                  const utilization = Number(item.loaded_qty) > 0
                    ? ((Number(item.delivered_qty) / Number(item.loaded_qty)) * 100).toFixed(0)
                    : "0";
                  return (
                    <tr key={item.id || i} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono font-bold text-slate-700">{item.run_id || "—"}</p>
                        <p className="text-[10px] text-slate-400">{item.delivery_slot || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{item.delivery_partner_name || "—"}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-700">{item.product_name || "—"}</p>
                        <p className="text-[10px] text-slate-400">{item.variant_name || item.sku || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{item.warehouse_name || "—"}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-600">{Number(item.planned_qty || 0)}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-sky-600">{Number(item.loaded_qty || 0)}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-emerald-600">{Number(item.delivered_qty || 0)}</td>
                      <td className="px-4 py-3 text-center text-xs text-amber-600">{Number(item.returned_qty || 0)}</td>
                      <td className="px-4 py-3 text-center text-xs text-rose-600">{Number(item.damaged_qty || 0)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.run_status === "completed"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                            : item.run_status === "dispatched"
                              ? "bg-blue-50 text-blue-600 border-blue-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}>
                          {(item.run_status || "pending").replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50/50 border-t text-xs text-slate-400">
            {summary.length} dispatch items shown
          </div>
        </div>
      )}
    </div>
  );
}
