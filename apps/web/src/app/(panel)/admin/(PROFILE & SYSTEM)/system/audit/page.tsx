"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { FileText, RefreshCw, Home, ChevronRight, Search, Filter, Clock } from "lucide-react";
import Link from "next/link";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (searchQuery) params.append("search", searchQuery);
      if (actionFilter) params.append("action", actionFilter);
      const res = await api.get<any>(`/admin/system/audit?${params}`);
      if (res.data?.data) setLogs(res.data.data);
      if (res.data?.total) setTotal(res.data.total);
    } catch { } finally { setLoading(false); }
  }, [searchQuery, actionFilter, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const actionColors: Record<string, string> = {
    create: "bg-emerald-50 text-emerald-600 border-emerald-200",
    update: "bg-blue-50 text-blue-600 border-blue-200",
    delete: "bg-rose-50 text-rose-600 border-rose-200",
    login: "bg-indigo-50 text-indigo-600 border-indigo-200",
    assign: "bg-amber-50 text-amber-600 border-amber-200",
  };

  return (
    <div className="space-y-5 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Audit Log</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><FileText size={24} className="text-slate-600" /> Audit Log</h1>
          <p className="text-xs text-slate-400 mt-1">Track all admin actions • {total} events recorded</p>
        </div>
        <button onClick={fetchLogs} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50"><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search by admin, action, resource..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20" />
        </div>
        <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1">
          {["", "create", "update", "delete", "login", "assign"].map(a => (
            <button key={a} onClick={() => { setActionFilter(a); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize ${actionFilter === a ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              {a || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-[3px] border-slate-200 border-t-slate-500 rounded-full animate-spin" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <FileText size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">No audit logs found</p>
          <p className="text-xs text-slate-300 mt-1">Admin actions will be recorded here</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Time</th>
                    <th className="px-4 py-3 text-left">Admin</th>
                    <th className="px-4 py-3 text-center">Action</th>
                    <th className="px-4 py-3 text-left">Resource</th>
                    <th className="px-4 py-3 text-left">Details</th>
                    <th className="px-4 py-3 text-left">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l: any, i: number) => {
                    const ac = actionColors[l.action] || "bg-slate-50 text-slate-600 border-slate-200";
                    return (
                      <tr key={l.id || i} className="border-b last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-[10px] text-slate-400 whitespace-nowrap">
                          <Clock size={10} className="inline mr-1" />
                          {l.created_at ? new Date(l.created_at).toLocaleString("en-IN", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                          }) : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-800">{l.admin_name || l.admin_id || "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ac}`}>{l.action}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-600">{l.target_type || "—"}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{l.target_id ? String(l.target_id).slice(0, 12) : ""}</p>
                        </td>
                        <td className="px-4 py-3 text-[10px] text-slate-400 max-w-[200px] truncate">
                          {l.details && typeof l.details === "object" ? JSON.stringify(l.details).slice(0, 60) : "—"}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-slate-400 font-mono">{l.ip_address || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-slate-50/50 border-t flex items-center justify-between text-xs text-slate-400">
              <span>Page {page} • {total} total</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-3 py-1 bg-white border border-slate-200 rounded text-xs disabled:opacity-30">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 50}
                  className="px-3 py-1 bg-white border border-slate-200 rounded text-xs disabled:opacity-30">Next</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
