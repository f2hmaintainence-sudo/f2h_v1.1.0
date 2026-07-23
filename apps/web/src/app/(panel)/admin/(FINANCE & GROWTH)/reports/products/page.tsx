"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { Package, ChevronRight, Home, RefreshCw } from "lucide-react";
import Link from "next/link";

function formatMoney(v: number) { return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function ProductPerformancePage() {
  const [data, setData] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/admin/analytics/product-performance?days=${days}`);
      if (res.data?.data) setData(res.data.data);
    } catch {} finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" /><span className="font-semibold text-slate-800">Product Performance</span>
      </nav>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Package size={24} className="text-amber-500" /> Product Performance</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden">
            {[7, 14, 30, 90].map(d => (<button key={d} onClick={() => setDays(d)} className={`px-3 py-2 text-xs font-semibold ${days === d ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{d}d</button>))}
          </div>
          <button onClick={fetch_} className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw size={14} /></button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin" /></div> : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"><div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase tracking-wider">
            <th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">Product</th><th className="px-4 py-3 text-left">Variant</th>
            <th className="px-4 py-3 text-right">Qty Sold</th><th className="px-4 py-3 text-right">Orders</th><th className="px-4 py-3 text-right">Revenue</th>
          </tr></thead><tbody>
            {data.map((d, i) => (<tr key={i} className="border-b last:border-0 hover:bg-slate-50">
              <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{d.product_name}</td>
              <td className="px-4 py-3 text-slate-600">{d.variant_name}</td>
              <td className="px-4 py-3 text-right">{d.total_qty}</td>
              <td className="px-4 py-3 text-right">{d.order_count}</td>
              <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatMoney(d.revenue)}</td>
            </tr>))}
            {data.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400">No product data</td></tr>}
          </tbody></table></div></div>
      )}
    </div>
  );
}
