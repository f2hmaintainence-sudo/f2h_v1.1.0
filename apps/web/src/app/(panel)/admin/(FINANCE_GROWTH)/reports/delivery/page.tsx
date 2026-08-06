"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { Truck, ChevronRight, Home, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function DeliveryEfficiencyPage() {
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/admin/analytics/delivery-efficiency?days=${days}`);
      if (res.data?.data) setData(res.data.data);
    } catch {} finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" /><span className="font-semibold text-slate-800">Delivery Efficiency</span>
      </nav>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Truck size={24} className="text-sky-500" /> Delivery Efficiency</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden">
            {[7, 14, 30, 90].map(d => (<button key={d} onClick={() => setDays(d)} className={`px-3 py-2 text-xs font-semibold ${days === d ? 'bg-sky-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{d}d</button>))}
          </div>
          <button onClick={fetch_} className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw size={14} /></button>
        </div>
      </div>
      {loading || !data ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-sky-200 border-t-sky-500 rounded-full animate-spin" /></div> : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
            <p className="text-4xl font-black text-emerald-600">{data.success_rate ?? 0}%</p>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Success Rate</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
            <p className="text-4xl font-black text-slate-900">{data.total_deliveries ?? 0}</p>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Total Deliveries</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
            <p className="text-4xl font-black text-emerald-600">{data.successful ?? 0}</p>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Successful</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
            <p className="text-4xl font-black text-rose-600">{data.failed ?? 0}</p>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Failed</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
            <p className="text-4xl font-black text-blue-600">{data.partners_active ?? 0}</p>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Active Partners</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
            <p className="text-4xl font-black text-indigo-600">{Number(data.avg_per_partner ?? 0).toFixed(1)}</p>
            <p className="text-xs font-bold text-slate-400 uppercase mt-1">Avg / Partner</p>
          </div>
        </div>
      )}
    </div>
  );
}
