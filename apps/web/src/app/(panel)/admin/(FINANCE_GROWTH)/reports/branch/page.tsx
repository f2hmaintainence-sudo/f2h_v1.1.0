"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { Building, ChevronRight, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

function formatMoney(v: number) { return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function BranchProfitabilityPage() {
  const [data, setData] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/admin/analytics/branch-performance?days=${days}`);
      if (res.data?.data) setData(res.data.data);
    } catch {} finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const maxRev = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" /><span className="font-semibold text-slate-800">Branch Profitability</span>
      </nav>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Building size={24} className="text-indigo-500" /> Branch Profitability</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden">
            {[7, 14, 30, 90].map(d => (<button key={d} onClick={() => setDays(d)} className={`px-3 py-2 text-xs font-semibold ${days === d ? 'bg-indigo-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{d}d</button>))}
          </div>
          <button onClick={fetch_} className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw size={14} /></button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" /></div> : (
        <div className="space-y-4">
          {data.map((b, i) => (
            <div key={b.branch_id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center font-black text-sm">{i + 1}</div>
                  <div><p className="text-sm font-bold text-slate-900">{b.branch_name || b.branch_id}</p>
                    <p className="text-[10px] text-slate-400">{b.total_orders} orders · {b.unique_customers} customers</p></div>
                </div>
                <p className="text-xl font-black text-emerald-600">{formatMoney(b.revenue)}</p>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(b.revenue / maxRev) * 100}%` }} transition={{ delay: i * 0.1, duration: 0.8 }}
                  className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full" />
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div><p className="text-sm font-bold text-slate-800">{b.total_orders}</p><p className="text-[9px] text-slate-400 uppercase font-bold">Orders</p></div>
                <div><p className="text-sm font-bold text-emerald-600">{b.delivered}</p><p className="text-[9px] text-slate-400 uppercase font-bold">Delivered</p></div>
                <div><p className="text-sm font-bold text-slate-800">{b.unique_customers}</p><p className="text-[9px] text-slate-400 uppercase font-bold">Customers</p></div>
                <div><p className="text-sm font-bold text-blue-600">{b.delivery_rate}%</p><p className="text-[9px] text-slate-400 uppercase font-bold">Rate</p></div>
              </div>
            </div>
          ))}
          {data.length === 0 && <div className="text-center py-16 text-slate-400"><Building size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm font-bold">No branch data</p></div>}
        </div>
      )}
    </div>
  );
}
