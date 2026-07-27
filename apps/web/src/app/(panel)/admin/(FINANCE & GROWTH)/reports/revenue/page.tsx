// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Revenue report page for admin panel
//
// ============================================================================

"use client";

import { getApiBaseUrl } from "@/lib/api-config";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { TrendingUp, Download, RefreshCw, ChevronRight, Home, IndianRupee, ShoppingCart, Calendar } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

function formatMoney(v: number) { return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function RevenuePage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/admin/analytics/revenue?days=${days}`);
      if (res.data?.data) setData(res.data.data);
    } catch { } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/analytics/export/revenue?days=${days}`, { credentials: 'include' });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `revenue-report.pdf`; a.click(); window.URL.revokeObjectURL(url);
    } catch { alert("Export failed"); } finally { setExporting(false); }
  };

  const daily = data?.daily || [];
  const totals = data?.totals || {};
  const maxRev = Math.max(...daily.map((d: any) => d.revenue), 1);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" /><span className="font-semibold text-slate-800">Revenue Report</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><TrendingUp size={24} className="text-emerald-500" /> Revenue Report</h1>
          <p className="text-sm text-slate-400 mt-1">Track daily revenue, orders, and discounts</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden">
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)} className={`px-3 py-2 text-xs font-semibold ${days === d ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{d}d</button>
            ))}
          </div>
          <button onClick={exportPdf} disabled={exporting} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 disabled:opacity-50">
            <Download size={14} className={exporting ? "animate-bounce" : ""} /> {exporting ? "Exporting..." : "Export PDF"}
          </button>
          <button onClick={fetch_} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50"><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2"><IndianRupee size={18} /><span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Total Revenue</span></div>
          <p className="text-3xl font-black">{formatMoney(totals.total_revenue ?? 0)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><ShoppingCart size={18} className="text-blue-500" /><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Orders</span></div>
          <p className="text-3xl font-black text-slate-900">{totals.total_orders ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><Calendar size={18} className="text-amber-500" /><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Daily</span></div>
          <p className="text-3xl font-black text-slate-900">{formatMoney(daily.length ? totals.total_revenue / daily.length : 0)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Daily Revenue Trend</h3>
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>
        ) : daily.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 min-w-[600px] h-48 px-2">
              {daily.map((d: any, i: number) => (
                <div key={i} className="flex-1 flex flex-col items-center group">
                  <div className="w-full flex items-end justify-center h-40">
                    <motion.div initial={{ height: 0 }} animate={{ height: `${(d.revenue / maxRev) * 100}%` }}
                      transition={{ delay: i * 0.02, duration: 0.4 }}
                      className="w-full max-w-[24px] bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-t-md hover:from-emerald-600 hover:to-emerald-400 transition-colors cursor-pointer relative group">
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold">{formatMoney(d.revenue)}</div>
                    </motion.div>
                  </div>
                  <p className="text-[8px] text-slate-400 mt-1 truncate w-full text-center">{new Date(d.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                </div>
              ))}
            </div>
          </div>
        ) : <p className="text-center text-sm text-slate-400 py-12">No data for this period</p>}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-right">Orders</th>
              <th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Discounts</th>
              <th className="px-4 py-3 text-right">Subscription</th><th className="px-4 py-3 text-right">One-time</th>
            </tr></thead>
            <tbody>
              {daily.map((d: any, i: number) => (
                <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{new Date(d.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-right">{d.orders}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatMoney(d.revenue)}</td>
                  <td className="px-4 py-3 text-right text-amber-600">{formatMoney(d.discounts)}</td>
                  <td className="px-4 py-3 text-right">{d.sub_orders}</td>
                  <td className="px-4 py-3 text-right">{d.onetime_orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
