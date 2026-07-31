"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  Truck, RefreshCw, Home, ChevronRight, MapPin, User,
  Clock, CheckCircle2, ArrowRight, Building,
} from "lucide-react";
import Link from "next/link";

const runStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-slate-50 text-slate-600 border-slate-200", label: "Pending" },
  assigned: { color: "bg-sky-50 text-sky-600 border-sky-200", label: "Assigned" },
  dispatched: { color: "bg-blue-50 text-blue-600 border-blue-200", label: "Dispatched" },
  in_progress: { color: "bg-amber-50 text-amber-600 border-amber-200", label: "In Progress" },
  completed: { color: "bg-emerald-50 text-emerald-600 border-emerald-200", label: "Completed" },
  partial: { color: "bg-orange-50 text-orange-600 border-orange-200", label: "Partial" },
  cancelled: { color: "bg-rose-50 text-rose-600 border-rose-200", label: "Cancelled" },
};

export default function DeliveryRunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const [runsRes, summaryRes] = await Promise.all([
        api.get<any>(`/admin/delivery/runs?${params}`),
        api.get<any>("/admin/delivery/runs/summary"),
      ]);
      if (runsRes.data?.status) setRuns(runsRes.data.data || []);
      if (summaryRes.data?.status) setSummary(summaryRes.data.data);
    } catch { } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-400">Delivery</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Delivery Runs</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Truck size={24} className="text-blue-500" /> Delivery Runs
          </h1>
          <p className="text-xs text-slate-400 mt-1">Today&apos;s delivery runs with real-time status tracking.</p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Runs", value: summary.total_runs, color: "text-blue-600 bg-blue-50" },
            { label: "In Progress", value: summary.in_progress, color: "text-amber-600 bg-amber-50" },
            { label: "Completed", value: summary.completed, color: "text-emerald-600 bg-emerald-50" },
            { label: "Addresses Done", value: summary.total_completed, color: "text-green-600 bg-green-50" },
            { label: "Failed", value: summary.total_failed, color: "text-rose-600 bg-rose-50" },
            { label: "Unassigned", value: summary.unassigned, color: "text-slate-600 bg-slate-50" },
          ].map((card, idx) => (
            <div key={idx} className={`p-4 rounded-2xl border border-gray-100 ${card.color}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{card.label}</p>
              <h3 className="text-2xl font-black mt-1">{card.value ?? 0}</h3>
            </div>
          ))}
        </div>
      )}

      {/* Status Filter */}
      <div className="flex flex-wrap gap-1 bg-white rounded-lg border border-slate-200 p-1 w-fit">
        {["", ...Object.keys(runStatusConfig)].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize ${statusFilter === s ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
            {s ? s.replace(/_/g, " ") : "All"}
          </button>
        ))}
      </div>

      {/* Runs List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-[3px] border-blue-100 border-t-blue-500 rounded-full animate-spin" /></div>
      ) : runs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <Truck size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">No delivery runs found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run: any) => {
            const sc = runStatusConfig[run.status] || runStatusConfig.pending;
            return (
              <div key={run.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-50">
                      <Truck size={18} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{run.run_id || `Run #${run.id}`}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Building size={10} /> {run.branch_name || "Branch"}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <User size={10} /> {run.partner_name || "Delivery Boy"}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock size={10} /> {run.delivery_slot || "—"}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <MapPin size={10} /> {run.total_addresses || 0} addresses
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <span className="text-emerald-600 font-bold">{run.completed_addresses || 0}</span>
                      <span className="text-slate-300"> / </span>
                      <span className="text-slate-600">{run.total_addresses || 0}</span>
                      {run.failed_addresses > 0 && (
                        <span className="ml-1 text-rose-500 font-bold">({run.failed_addresses} failed)</span>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${sc.color}`}>{sc.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
