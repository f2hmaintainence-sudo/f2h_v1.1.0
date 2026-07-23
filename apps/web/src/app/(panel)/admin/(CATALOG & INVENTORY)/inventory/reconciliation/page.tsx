"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  Scale, RefreshCw, Home, ChevronRight, Calendar,
  AlertTriangle, CheckCircle2
} from "lucide-react";
import Link from "next/link";

export default function ReconciliationPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchReconciliation = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/admin/inventory/reconciliation?date=${date}`);
      if (res.data?.status) setData(res.data.data || []);
    } catch { } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { fetchReconciliation(); }, [fetchReconciliation]);

  const discrepancies = data.filter((row) => {
    const opening = Number(row.computed_opening_stock || 0);
    const closing = Number(row.current_stock || 0);
    const totalIn = Number(row.total_in_today || 0);
    const totalOut = Number(row.total_out_today || 0);
    const expected = opening + totalIn - totalOut;
    return Math.abs(expected - closing) > 0.01;
  });

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-400">Inventory</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Reconciliation</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Scale size={24} className="text-cyan-500" /> Daily Reconciliation
          </h1>
          <p className="text-xs text-slate-400 mt-1">Compare opening stock + movements against current stock to identify discrepancies.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
            <Calendar size={14} className="text-slate-400" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="text-xs font-semibold outline-none bg-transparent" />
          </div>
          <button onClick={fetchReconciliation}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Items Tracked</p>
          <h3 className="text-2xl font-black text-slate-800 mt-1">{data.length}</h3>
        </div>
        <div className={`p-5 rounded-2xl border shadow-sm ${discrepancies.length === 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            {discrepancies.length === 0 ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertTriangle size={12} className="text-rose-500" />}
            Discrepancies
          </p>
          <h3 className={`text-2xl font-black mt-1 ${discrepancies.length === 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {discrepancies.length}
          </h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
          <h3 className="text-lg font-black text-slate-800 mt-1">
            {new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
          </h3>
        </div>
      </div>

      {/* Reconciliation Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-[3px] border-cyan-100 border-t-cyan-500 rounded-full animate-spin" /></div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <Scale size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">No reconciliation data for this date</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Product / Variant</th>
                  <th className="px-4 py-3 text-left">Warehouse</th>
                  <th className="px-4 py-3 text-center">Opening Stock</th>
                  <th className="px-4 py-3 text-center">IN Today</th>
                  <th className="px-4 py-3 text-center">OUT Today</th>
                  <th className="px-4 py-3 text-center">Expected</th>
                  <th className="px-4 py-3 text-center">Actual</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row: any, i: number) => {
                  const opening = Number(row.computed_opening_stock || 0);
                  const totalIn = Number(row.total_in_today || 0);
                  const totalOut = Number(row.total_out_today || 0);
                  const expected = opening + totalIn - totalOut;
                  const actual = Number(row.current_stock || 0);
                  const diff = Math.abs(expected - actual);
                  const hasDiscrepancy = diff > 0.01;

                  return (
                    <tr key={i} className={`border-b last:border-0 transition-colors ${hasDiscrepancy ? "bg-rose-50/50 hover:bg-rose-50" : "hover:bg-slate-50/50"}`}>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-800">{row.product_name || "—"}</p>
                        <p className="text-[10px] text-slate-400">{row.variant_name}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.warehouse_name || "—"}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{opening}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-emerald-600">+{totalIn}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-rose-600">-{totalOut}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-600">{expected}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-800">{actual}</td>
                      <td className="px-4 py-3 text-center">
                        {hasDiscrepancy ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-600 border border-rose-200">
                            ⚠ Δ{diff.toFixed(1)}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                            ✓ Match
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
