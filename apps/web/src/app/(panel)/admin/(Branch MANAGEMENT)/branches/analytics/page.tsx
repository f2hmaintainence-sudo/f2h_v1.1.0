"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  BarChart3, RefreshCw, Home, ChevronRight, TrendingUp,
  Users, ShoppingCart, Truck, IndianRupee, Calendar
} from "lucide-react";
import Link from "next/link";

export default function BranchAnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [daysRange, setDaysRange] = useState("30");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branches, setBranches] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: daysRange });
      if (selectedBranch) params.append("branch_id", selectedBranch);
      const res = await api.get<any>(`/admin/branch-config/analytics?${params}`);
      if (res.data?.data) setAnalytics(res.data.data);
    } catch { } finally { setLoading(false); }
  }, [daysRange, selectedBranch]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    api.get<any>("/admin/dashboard/branch-performance?days=1").then(res => {
      if (res.data?.data) setBranches(res.data.data);
    }).catch(() => { });
  }, []);

  return (
    <div className="space-y-5 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Branch Analytics</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><BarChart3 size={24} className="text-cyan-500" /> Branch Analytics</h1>
          <p className="text-xs text-slate-400 mt-1">Compare performance across branches</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50"><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1">
          {["7", "14", "30", "90"].map(d => (
            <button key={d} onClick={() => setDaysRange(d)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${daysRange === d ? "bg-cyan-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              {d}d
            </button>
          ))}
        </div>
        {branches.length > 0 && (
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
            <option value="">All Branches</option>
            {branches.map((b: any) => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-[3px] border-cyan-100 border-t-cyan-500 rounded-full animate-spin" /></div>
      ) : analytics?.branches?.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <BarChart3 size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">No branch data available</p>
        </div>
      ) : (
        <>
          {/* Branch Comparison Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Branch</th>
                    <th className="px-4 py-3 text-right">Orders</th>
                    <th className="px-4 py-3 text-right">Delivered</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Delivery Rate</th>
                    <th className="px-4 py-3 text-right">Customers</th>
                    <th className="px-4 py-3 text-right">Runs</th>
                    <th className="px-4 py-3 text-right">Partners</th>
                    <th className="px-4 py-3 text-right">Subscriptions</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.branches || []).map((b: any) => (
                    <tr key={b.branch_id} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-xs font-bold text-slate-800">{b.branch_name}</td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">{b.total_orders}</td>
                      <td className="px-4 py-3 text-right text-xs text-emerald-600 font-bold">{b.delivered_orders}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-emerald-700">₹{Number(b.revenue ?? 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-bold ${Number(b.delivery_rate) >= 90 ? "text-emerald-600" : Number(b.delivery_rate) >= 70 ? "text-amber-600" : "text-rose-600"}`}>
                          {Number(b.delivery_rate ?? 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-600">{b.unique_customers}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-600">{b.total_runs}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-600">{b.active_partners}</td>
                      <td className="px-4 py-3 text-right text-xs text-indigo-600 font-semibold">{b.active_subscriptions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Cards */}
          {analytics?.branches?.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Revenue", value: `₹${(analytics.branches.reduce((s: number, b: any) => s + Number(b.revenue || 0), 0)).toLocaleString("en-IN")}`, icon: IndianRupee, color: "bg-emerald-50 border-emerald-200 text-emerald-600" },
                { label: "Total Orders", value: analytics.branches.reduce((s: number, b: any) => s + Number(b.total_orders || 0), 0), icon: ShoppingCart, color: "bg-blue-50 border-blue-200 text-blue-600" },
                { label: "Total Customers", value: analytics.branches.reduce((s: number, b: any) => s + Number(b.unique_customers || 0), 0), icon: Users, color: "bg-indigo-50 border-indigo-200 text-indigo-600" },
                { label: "Total Runs", value: analytics.branches.reduce((s: number, b: any) => s + Number(b.total_runs || 0), 0), icon: Truck, color: "bg-cyan-50 border-cyan-200 text-cyan-600" },
              ].map(c => {
                const Icon = c.icon;
                return (
                  <div key={c.label} className={`${c.color} rounded-xl p-4 border`}>
                    <div className="flex items-center gap-2 mb-1"><Icon size={14} /><span className="text-[10px] font-bold uppercase tracking-wider">{c.label}</span></div>
                    <p className="text-xl font-black text-slate-900">{c.value}</p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
