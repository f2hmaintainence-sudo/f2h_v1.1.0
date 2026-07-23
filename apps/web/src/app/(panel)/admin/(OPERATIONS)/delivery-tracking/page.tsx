"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  MapPin, Truck, CheckCircle2, Clock, AlertTriangle, XCircle,
  RefreshCw, Home, ChevronRight, ChevronDown, Package, Users,
  Activity, Eye, BarChart3
} from "lucide-react";
import Link from "next/link";

interface RunSummary {
  total_runs: number; planned: number; assigned: number; in_progress: number;
  completed: number; partial: number; cancelled: number;
  total_addresses: number; total_completed: number; total_failed: number;
  active_partners: number; unassigned: number;
}

interface Run {
  run_id: string; run_number: string; delivery_partner_id: string;
  branch_id: string; run_date: string; delivery_slot: string;
  status: string; assignment_method: string;
  total_addresses: number; completed_addresses: number; failed_addresses: number;
  partner_name: string; partner_phone: string; branch_name: string;
  run_value: number;
}

const runStatusConfig: Record<string, { color: string; bg: string; label: string }> = {
  planned: { color: "text-slate-600", bg: "bg-slate-50 border-slate-200", label: "Planned" },
  assigned: { color: "text-sky-600", bg: "bg-sky-50 border-sky-200", label: "Assigned" },
  in_progress: { color: "text-blue-600", bg: "bg-blue-50 border-blue-200", label: "In Progress" },
  completed: { color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", label: "Completed" },
  partial: { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", label: "Partial" },
  cancelled: { color: "text-rose-600", bg: "bg-rose-50 border-rose-200", label: "Cancelled" },
};

export default function OperationsDeliveryTrackingPage() {
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [runAddresses, setRunAddresses] = useState<Record<string, any[]>>({});
  const [slotFilter, setSlotFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (slotFilter) params.append("slot", slotFilter);
      if (statusFilter) params.append("status", statusFilter);
      const qs = params.toString() ? `?${params.toString()}` : "";

      const [runsRes, summaryRes] = await Promise.all([
        api.get<any>(`/admin/delivery/runs${qs}`),
        api.get<any>("/admin/delivery/runs/summary"),
      ]);
      if (runsRes.data?.data) setRuns(runsRes.data.data);
      if (summaryRes.data?.data) setSummary(summaryRes.data.data);
    } catch { } finally { setLoading(false); setRefreshing(false); }
  }, [slotFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 45000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const loadRunAddresses = async (runId: string) => {
    if (expandedRun === runId) { setExpandedRun(null); return; }
    setExpandedRun(runId);
    if (runAddresses[runId]) return;
    try {
      const res = await api.get<any>(`/admin/delivery/runs/${runId}/addresses`);
      if (res.data?.data) {
        setRunAddresses(prev => ({ ...prev, [runId]: res.data.data }));
      }
    } catch { }
  };

  const completionPct = (run: Run) => {
    if (run.total_addresses === 0) return 0;
    return Math.round((run.completed_addresses / run.total_addresses) * 100);
  };

  const addrStatusConfig: Record<string, { color: string; icon: any }> = {
    pending: { color: "text-amber-500", icon: Clock },
    in_transit: { color: "text-blue-500", icon: Truck },
    arrived: { color: "text-indigo-500", icon: MapPin },
    delivered: { color: "text-emerald-500", icon: CheckCircle2 },
    failed: { color: "text-rose-500", icon: XCircle },
    skipped: { color: "text-slate-400", icon: AlertTriangle },
  };

  return (
    <div className="space-y-5 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Delivery Tracking</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <MapPin size={24} className="text-blue-500" /> Delivery Tracking
          </h1>
          <p className="text-xs text-slate-400 mt-1">Track delivery runs in real-time • Auto-refreshes every 45s</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
            <RefreshCw size={14} className={refreshing ? "animate-spin text-blue-500" : ""} /> Refresh
          </button>
          <Link href="/admin/delivery/tracking"
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all">
            <Eye size={14} /> Full View
          </Link>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            { label: "Total Runs", value: summary.total_runs, color: "bg-slate-50 border-slate-200" },
            { label: "In Progress", value: summary.in_progress, color: "bg-blue-50 border-blue-200" },
            { label: "Completed", value: summary.completed, color: "bg-emerald-50 border-emerald-200" },
            { label: "Addresses Done", value: summary.total_completed, color: "bg-green-50 border-green-200" },
            { label: "Failed", value: summary.total_failed, color: "bg-rose-50 border-rose-200" },
            { label: "Unassigned", value: summary.unassigned, color: "bg-amber-50 border-amber-200" },
            { label: "Partners Active", value: summary.active_partners, color: "bg-indigo-50 border-indigo-200" },
          ].map(c => (
            <div key={c.label} className={`${c.color} rounded-xl p-3 border`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.label}</p>
              <p className="text-xl font-black text-slate-900">{c.value ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1">
          {["", "morning", "afternoon", "evening"].map(s => (
            <button key={s} onClick={() => setSlotFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize ${slotFilter === s ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              {s || "All Slots"}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1">
          {["", "assigned", "in_progress", "completed", "partial"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize ${statusFilter === s ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              {s ? s.replace(/_/g, " ") : "All Status"}
            </button>
          ))}
        </div>
      </div>

      {/* Runs List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-[3px] border-blue-100 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <Truck size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-400">No delivery runs found</p>
          <p className="text-xs text-slate-300 mt-1">Create delivery runs from the assignment page</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(run => {
            const sc = runStatusConfig[run.status] || runStatusConfig.planned;
            const pct = completionPct(run);
            const isExpanded = expandedRun === run.run_id;
            const addresses = runAddresses[run.run_id] || [];

            console.log('Addresses:', addresses);

            return (
              <div key={run.run_id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                <div className="px-4 py-3 cursor-pointer" onClick={() => loadRunAddresses(run.run_id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                        <Truck size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{run.run_id}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${sc.bg} ${sc.color}`}>
                            {sc.label}
                          </span>
                          <span className="text-[10px] text-slate-400 capitalize">{run.delivery_slot}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1"><Users size={10} />{run.partner_name || "Unassigned"}</span>
                          <span>{run.branch_name || "—"}</span>
                          <span className="text-[9px] capitalize">{run.assignment_method?.replace(/_/g, " ")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-slate-800">
                          {run.completed_addresses}/{run.total_addresses}
                          <span className="text-slate-400 font-normal ml-1">addresses</span>
                        </p>
                        <p className="text-xs font-semibold text-emerald-600">₹{Number(run.run_value ?? 0).toLocaleString("en-IN")}</p>
                      </div>
                      <div className="w-16">
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-400 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[9px] text-slate-400 text-center mt-0.5">{pct}%</p>
                      </div>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </div>

                {/* Expanded: Address List */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                    {addresses.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">Loading addresses...</p>
                    ) : (
                      <div className="space-y-1.5">
                        {addresses.map((addr: any, idx: number) => {
                          const asc = addrStatusConfig[addr.status] || addrStatusConfig.pending;
                          const AddrIcon = asc.icon;
                          return (
                            <div key={addr.id} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 w-5">{addr.sequence_no || idx + 1}</span>
                              <AddrIcon size={14} className={asc.color} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{addr.customer_name || "N/A"}</p>
                                <p className="text-[10px] text-slate-400 truncate">{addr.address_line || ""}</p>
                              </div>
                              <span className={`text-[10px] font-bold capitalize ${asc.color}`}>
                                {addr.status?.replace(/_/g, " ")}
                              </span>
                              {addr.delivered_at && (
                                <span className="text-[9px] text-slate-400">
                                  {new Date(addr.delivered_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                              <span className="text-xs font-semibold text-emerald-600">
                                ₹{Number(addr.total_amount ?? 0).toLocaleString("en-IN")}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
