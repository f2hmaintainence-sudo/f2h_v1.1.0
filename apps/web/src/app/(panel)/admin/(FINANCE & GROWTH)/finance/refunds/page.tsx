"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { ArrowRightLeft, ChevronRight, Home, RefreshCw } from "lucide-react";
import Link from "next/link";

function formatMoney(v: number) { return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function RefundsPage() {
  const [data, setData] = useState<any[]>([]);
  const [refundsList, setRefundsList] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const [reportRes, listRes] = await Promise.all([
        api.get<any>(`/admin/analytics/refunds?days=${days}`),
        api.get<any>(`/admin/analytics/refunds/list?days=${days}`)
      ]);
      if (reportRes.data?.data) setData(reportRes.data.data);
      if (listRes.data?.data) setRefundsList(listRes.data.data);
    } catch { } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const totalAmount = data.reduce((s, d) => s + Number(d.total_amount ?? 0), 0);
  const totalCount = data.reduce((s, d) => s + (d.count ?? 0), 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-slate-500">Finance</span>
        <ChevronRight size={14} className="text-slate-300" />
        <span className="font-semibold text-slate-800">Refund Tracking</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><ArrowRightLeft size={24} className="text-rose-500" /> Refund Tracking</h1>
          <p className="text-sm text-slate-400 mt-1">{totalCount} refunds totalling {formatMoney(totalAmount)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden">
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)} className={`px-3 py-2 text-xs font-semibold ${days === d ? 'bg-rose-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{d}d</button>
            ))}
          </div>
          <button onClick={fetch_} className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw size={14} /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          {/* Summary Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-sm">Refund Summary By Status & Method</h2>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-right">Count</th><th className="px-4 py-3 text-right">Total Amount</th>
              </tr></thead>
              <tbody>
                {data.map((d: any, i: number) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${d.status === 'processed' ? 'bg-emerald-50 text-emerald-600' :
                          d.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                            d.status === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                        }`}>{d.status || '-'}</span>
                    </td>
                    <td className="px-4 py-3 capitalize">{d.refund_method || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{d.count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-600">{formatMoney(Number(d.total_amount))}</td>
                  </tr>
                ))}
                {data.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-slate-400">No refunds in this period</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Detailed Refunds Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-sm">Detailed Refund Transactions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead><tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Refund Number</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Order ID</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr></thead>
                <tbody>
                  {refundsList.map((r: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.refund_number}</td>
                      <td className="px-4 py-3 text-slate-800">{r.customer_id}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.order_id || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600">{formatMoney(Number(r.refund_amount))}</td>
                      <td className="px-4 py-3 capitalize text-slate-700">{r.refund_type}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${r.status === 'processed' ? 'bg-emerald-50 text-emerald-600' :
                            r.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                              r.status === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                          }`}>{r.status || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate" title={r.reason}>{r.reason || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(r.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}</td>
                    </tr>
                  ))}
                  {refundsList.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-slate-400">No refund transactions recorded</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
