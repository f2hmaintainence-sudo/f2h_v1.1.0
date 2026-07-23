"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { AlertTriangle, ChevronRight, Home, RefreshCw, Calendar, Truck } from "lucide-react";
import Link from "next/link";

export default function MissedDeliveriesPage() {
  const [data, setData] = useState<any[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/admin/delivery/missed?days=${days}`);
      if (res.data?.data) setData(res.data.data);
    } catch {} finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" /><span className="font-semibold text-slate-800">Missed Deliveries</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><AlertTriangle size={24} className="text-rose-500" /> Missed Deliveries</h1>
          <p className="text-sm text-slate-400 mt-1">{data.length} missed/failed deliveries in last {days} days</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden">
            {[3, 7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)} className={`px-3 py-2 text-xs font-semibold ${days === d ? 'bg-rose-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{d}d</button>
            ))}
          </div>
          <button onClick={fetch_} className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw size={14} /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin" /></div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-slate-400"><Truck size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm font-bold">No missed deliveries — great job!</p></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-3 py-3 text-left">Order</th><th className="px-3 py-3 text-left">Customer</th>
                <th className="px-3 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Partner</th><th className="px-3 py-3 text-right">Amount</th>
              </tr></thead>
              <tbody>
                {data.map((o: any) => (
                  <tr key={o.order_id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono text-xs text-slate-600">{String(o.order_id).slice(0, 12)}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-800 text-xs">{o.customer_name || 'N/A'}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{o.address_line || ''}</p>
                    </td>
                    <td className="px-3 py-3 text-xs flex items-center gap-1"><Calendar size={12} className="text-slate-400" />{o.scheduled_date}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        o.status === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                      }`}>{o.status}</span>
                    </td>
                    <td className="px-3 py-3 text-xs">{o.partner_name || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-3 text-right font-semibold">₹{Number(o.total_amount ?? 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}