"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  ScrollText, RefreshCw, Home, ChevronRight, Search,
  Camera, Package, AlertTriangle
} from "lucide-react";
import Link from "next/link";

const statusColors: Record<string, string> = {
  delivered: "bg-emerald-50 text-emerald-600 border-emerald-200",
  failed: "bg-rose-50 text-rose-600 border-rose-200",
  status_change: "bg-blue-50 text-blue-600 border-blue-200",
  reassignment: "bg-amber-50 text-amber-600 border-amber-200",
};

export default function DeliveryLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (search) params.set("customer_id", search);
      const res = await api.get<any>(`/admin/delivery/logs?${params}`);
      if (res.data?.status) {
        setLogs(res.data.data || []);
        setTotal(res.data.total || 0);
      }
    } catch { } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-400">Delivery</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Delivery Logs</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ScrollText size={24} className="text-cyan-500" /> Delivery Logs
          </h1>
          <p className="text-xs text-slate-400 mt-1">Complete audit trail of all delivery events and container tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Search by customer ID..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs w-52 focus:ring-2 focus:ring-cyan-300 outline-none"
            />
          </div>
          <button onClick={fetchLogs}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-[3px] border-cyan-100 border-t-cyan-500 rounded-full animate-spin" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <ScrollText size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">No delivery logs found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Run / Order</th>
                  <th className="px-4 py-3 text-left">Delivery Boy</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Containers</th>
                  <th className="px-4 py-3 text-center">Proof</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any, i: number) => {
                  const sc = statusColors[log.event_type] || statusColors[log.to_status] || "bg-slate-50 text-slate-600 border-slate-200";
                  const hasContainers = (log.returned_containers || 0) + (log.damaged_containers || 0) + (log.lost_containers || 0) > 0;
                  return (
                    <tr key={log.id || i} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono font-bold text-slate-700">{log.run_id || "—"}</p>
                        <p className="text-[10px] text-slate-400">{log.order_id || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{log.delivery_partner_name || log.performed_by || "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{(log.event_type || "").replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc}`}>
                          {log.to_status || log.status || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasContainers ? (
                          <div className="flex items-center justify-center gap-2 text-[10px]">
                            {log.returned_containers > 0 && <span className="text-emerald-600">↩{log.returned_containers}</span>}
                            {log.damaged_containers > 0 && <span className="text-amber-600">⚠{log.damaged_containers}</span>}
                            {log.lost_containers > 0 && <span className="text-rose-600">✕{log.lost_containers}</span>}
                          </div>
                        ) : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.proof_photo_url || log.proof_url ? (
                          <Camera size={14} className="mx-auto text-emerald-500" />
                        ) : <span className="text-[10px] text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {log.created_at ? new Date(log.created_at).toLocaleString("en-IN", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
                        }) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50/50 border-t flex items-center justify-between text-xs text-slate-400">
            <span>{total} total logs</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded bg-white border disabled:opacity-30">Prev</button>
              <span className="px-3 py-1">Page {page}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={logs.length < 25}
                className="px-3 py-1 rounded bg-white border disabled:opacity-30">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
