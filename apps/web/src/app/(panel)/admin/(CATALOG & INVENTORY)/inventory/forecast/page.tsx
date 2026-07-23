"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  TrendingUp, RefreshCw, Home, ChevronRight, BarChart3, Zap,
  AlertTriangle, ArrowDown
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";

export default function DemandForecastPage() {
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [days, setDays] = useState(7);

  const fetchForecasts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/admin/inventory/forecast?days=${days}&limit=100`);
      if (res.data?.status) setForecasts(res.data.data || []);
    } catch { } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetchForecasts(); }, [fetchForecasts]);

  const computeForecast = async () => {
    setComputing(true);
    try {
      const res = await api.post<any>("/admin/inventory/forecast/compute", { days });
      if (res.data?.status) {
        showSuccessToast(res.data.message || "Forecast computed");
        fetchForecasts();
      }
    } catch { alert("Failed to compute forecast"); }
    finally { setComputing(false); }
  };

  const totalPredicted = forecasts.reduce((s, f) => s + Number(f.predicted_quantity || 0), 0);
  const totalStock = forecasts.reduce((s, f) => s + Number(f.current_stock || 0), 0);
  const totalShortfall = forecasts.reduce((s, f) => s + Number(f.shortfall || 0), 0);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-400">Inventory</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Demand & Forecast</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <TrendingUp size={24} className="text-violet-500" /> Demand & Forecast
          </h1>
          <p className="text-xs text-slate-400 mt-1">Predicted demand vs available stock, with shortfall analysis.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-violet-300 outline-none">
            <option value={3}>Next 3 Days</option>
            <option value={7}>Next 7 Days</option>
            <option value={14}>Next 14 Days</option>
          </select>
          <button onClick={computeForecast} disabled={computing}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-all">
            <Zap size={14} /> {computing ? "Computing..." : "Compute Forecast"}
          </button>
          <button onClick={fetchForecasts}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-5 rounded-2xl text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={18} />
            <span className="text-xs font-semibold opacity-80 uppercase">Predicted Demand</span>
          </div>
          <h3 className="text-3xl font-black">{totalPredicted.toLocaleString("en-IN")}</h3>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDown size={18} />
            <span className="text-xs font-semibold opacity-80 uppercase">Current Stock</span>
          </div>
          <h3 className="text-3xl font-black">{totalStock.toLocaleString("en-IN")}</h3>
        </div>
        <div className={`p-5 rounded-2xl text-white shadow-lg ${totalShortfall > 0 ? "bg-gradient-to-br from-rose-500 to-red-600" : "bg-gradient-to-br from-green-500 to-emerald-600"}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} />
            <span className="text-xs font-semibold opacity-80 uppercase">Shortfall</span>
          </div>
          <h3 className="text-3xl font-black">{totalShortfall > 0 ? totalShortfall.toLocaleString("en-IN") : "None"}</h3>
        </div>
      </div>

      {/* Forecast Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-[3px] border-violet-100 border-t-violet-500 rounded-full animate-spin" /></div>
      ) : forecasts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <TrendingUp size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">No forecast data available</p>
          <p className="text-xs text-slate-300 mt-1">Click &quot;Compute Forecast&quot; to generate predictions</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Product / Variant</th>
                  <th className="px-4 py-3 text-left">Branch</th>
                  <th className="px-4 py-3 text-center">Forecast Date</th>
                  <th className="px-4 py-3 text-center">Predicted</th>
                  <th className="px-4 py-3 text-center">Subscriptions</th>
                  <th className="px-4 py-3 text-center">One-time</th>
                  <th className="px-4 py-3 text-center">Buffer</th>
                  <th className="px-4 py-3 text-center">Current Stock</th>
                  <th className="px-4 py-3 text-center">Shortfall</th>
                  <th className="px-4 py-3 text-center">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((f: any, i: number) => {
                  const shortfall = Number(f.shortfall || 0);
                  return (
                    <tr key={f.id || i} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-800">{f.product_name || "—"}</p>
                        <p className="text-[10px] text-slate-400">{f.variant_name || f.sku || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{f.branch_name || "—"}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">
                        {f.forecast_date ? new Date(f.forecast_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-violet-700">{f.predicted_quantity}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">{f.subscription_qty}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">{f.onetime_qty}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-400">{f.buffer_qty}</td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-emerald-600">{f.current_stock}</td>
                      <td className="px-4 py-3 text-center">
                        {shortfall > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                            -{shortfall}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, f.confidence_pct || 0)}%` }} />
                        </div>
                        <span className="text-[9px] text-slate-400">{f.confidence_pct}%</span>
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
