"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { RefreshCw, ChevronRight, Home, TrendingUp, Download } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

function formatMoney(v: number) { return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function SubscriptionRevenuePage() {
  const [data, setData] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/admin/analytics/subscription-revenue?days=${days}`);
      if (res.data?.data) setData(res.data.data);
    } catch {} finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const totalRev = data.reduce((s, d) => s + Number(d.revenue ?? 0), 0);
  const totalOrders = data.reduce((s, d) => s + (d.orders ?? 0), 0);
  const maxRev = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" /><span className="font-semibold text-slate-800">Subscription Revenue</span>
      </nav>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><RefreshCw size={24} className="text-purple-500" /> Subscription Revenue</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden">
            {[7, 14, 30, 90].map(d => (<button key={d} onClick={() => setDays(d)} className={`px-3 py-2 text-xs font-semibold ${days === d ? 'bg-purple-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{d}d</button>))}
          </div>
          <button onClick={fetch_} className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw size={14} /></button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase text-purple-200">Total Sub Revenue</p>
          <p className="text-3xl font-black">{formatMoney(totalRev)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Total Sub Orders</p>
          <p className="text-3xl font-black text-slate-900">{totalOrders}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Daily Subscription Revenue</h3>
        {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin" /></div> :
          <div className="overflow-x-auto"><div className="flex items-end gap-1 min-w-[600px] h-40 px-2">
            {data.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <motion.div initial={{ height: 0 }} animate={{ height: `${(d.revenue / maxRev) * 100}%` }} transition={{ delay: i * 0.02, duration: 0.4 }}
                  className="w-full max-w-[20px] bg-gradient-to-t from-purple-500 to-purple-300 rounded-t-md" />
                <p className="text-[8px] text-slate-400 mt-1">{new Date(d.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
              </div>
            ))}
          </div></div>}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"><div className="overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase">
          <th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-right">Orders</th><th className="px-4 py-3 text-right">Revenue</th>
        </tr></thead><tbody>
          {data.map((d, i) => (<tr key={i} className="border-b last:border-0 hover:bg-slate-50">
            <td className="px-4 py-3">{new Date(d.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
            <td className="px-4 py-3 text-right">{d.orders}</td>
            <td className="px-4 py-3 text-right font-semibold text-purple-600">{formatMoney(d.revenue)}</td>
          </tr>))}
        </tbody></table></div></div>
    </div>
  );
}
