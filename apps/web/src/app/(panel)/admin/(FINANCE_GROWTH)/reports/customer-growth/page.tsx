"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { Users, ChevronRight, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function CustomerGrowthPage() {
  const [data, setData] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/admin/analytics/customer-growth?days=${days}`);
      if (res.data?.data) setData(res.data.data);
    } catch {} finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const totalNew = data.reduce((s, d) => s + (d.new_customers ?? 0), 0);
  const maxNew = Math.max(...data.map(d => d.new_customers), 1);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" /><span className="font-semibold text-slate-800">Customer Growth</span>
      </nav>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Users size={24} className="text-blue-500" /> Customer Growth</h1>
          <p className="text-sm text-slate-400 mt-1">{totalNew} new customers in last {days} days</p></div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden">
            {[7, 14, 30, 90].map(d => (<button key={d} onClick={() => setDays(d)} className={`px-3 py-2 text-xs font-semibold ${days === d ? 'bg-blue-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{d}d</button>))}
          </div>
          <button onClick={fetch_} className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw size={14} /></button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" /></div> : (
        <>
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Daily New Customers</h3>
            <div className="space-y-2">
              {data.map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 w-20 shrink-0">{new Date(d.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(2, (d.new_customers / maxNew) * 100)}%` }}
                      transition={{ delay: i * 0.02, duration: 0.4 }}
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-8 text-right">+{d.new_customers}</span>
                  <span className="text-[9px] text-slate-400 w-16 text-right">{d.cumulative} total</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
