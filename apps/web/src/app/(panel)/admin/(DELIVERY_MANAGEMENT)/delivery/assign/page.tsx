"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  Truck, Zap, Users, RefreshCw, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, ArrowRight, Home, BarChart3, Target,
  Play, Route, MapPin
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";
import { BsTypeH2, BsTypeH4 } from "react-icons/bs";

interface RunResult {
  runs_created: number; total_assigned: number; total_unassigned: number;
  remaining: number;
  methods: { auto_history: number; auto_cluster: number; auto_balanced: number };
  runs: Array<{
    run_id: string; run_number: string; partner_id: string; partner_name: string;
    slot: string; addresses: number; method: string;
  }>;
  partner_loads: Array<{ id: string; name: string; load: number; max: number }>;
}

interface RunSummary {
  total_runs: number; planned: number; assigned: number; in_progress: number;
  completed: number; partial: number; cancelled: number;
  total_addresses: number; total_completed: number; total_failed: number;
  active_partners: number; unassigned: number;
}

export default function DeliveryRunsPage() {
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{
    total_partners: number;
    available_partners: number;
    has_empty_branch: boolean;
    empty_branches: string[];
  } | null>(null);
  const [validatingAvailability, setValidatingAvailability] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/delivery/runs/summary");
      if (res.data?.data) setSummary(res.data.data);
    } catch { } finally { setLoading(false); }
  }, []);

  const fetchAvailability = useCallback(async (branchId: string) => {
    setValidatingAvailability(true);
    try {
      const url = branchId 
        ? `/admin/delivery/runs/check-availability?branch_id=${branchId}`
        : `/admin/delivery/runs/check-availability`;
      const res = await api.get<any>(url);
      if (res.data?.data) {
        setAvailability(res.data.data);
      }
    } catch (err) {
      console.error("fetchAvailability error:", err);
    } finally {
      setValidatingAvailability(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchAvailability(selectedBranch);
  }, [selectedBranch, fetchAvailability]);

  useEffect(() => {
    api.get<any>("/admin/zone/branches-list").then(res => {
      if (res.data?.data) setBranches(res.data.data);
    }).catch(() => { });
  }, []);

  const executeCreateRuns = async () => {
    setConfirmOpen(false);
    setCreating(true);
    setError(null);
    setResult(null);
    try {
      const body: any = {};
      if (selectedBranch) body.branch_id = selectedBranch;
      if (selectedSlot) body.slot = selectedSlot;

      const res = await api.post<any>("/admin/delivery/runs/create", body);
      if (res.data?.data) {
        const data = res.data.data;
        if (data.runs_created === 0 && data.total_assigned === 0) {
          setError("No unassigned orders found for this date/criteria.");
        } else {
          setResult(data);
          showSuccessToast(`${data.runs_created} delivery runs created with ${data.total_assigned} orders!`);
        }
        fetchSummary();
        fetchAvailability(selectedBranch);
      } else {
        setError(res.data?.message || "Failed to generate delivery runs");
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || "Failed to generate delivery runs");
    } finally { setCreating(false); }
  };

  const methodLabels: Record<string, { label: string; color: string; desc: string }> = {
    auto_history: { label: "History", color: "bg-purple-100 text-purple-700", desc: "Based on previous delivery history" },
    auto_cluster: { label: "Cluster", color: "bg-blue-100 text-blue-700", desc: "Proximity-based address clustering" },
    auto_balanced: { label: "Balanced", color: "bg-teal-100 text-teal-700", desc: "Load-balanced across partners" },
    manual: { label: "Manual", color: "bg-slate-100 text-slate-700", desc: "Manually assigned" },
  };

  return (
    <div className="space-y-6 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Generate Delivery Runs</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Route size={24} className="text-emerald-500" /> Generate Delivery Runs
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automatically create optimized delivery runs by grouping orders by branch, slot, and proximity
          </p>
        </div>
        <button onClick={fetchSummary}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Runs", value: summary.total_runs, color: "bg-slate-50 border-slate-200", icon: Route },
            { label: "Assigned", value: summary.assigned, color: "bg-sky-50 border-sky-200", icon: Users },
            { label: "In Progress", value: summary.in_progress, color: "bg-blue-50 border-blue-200", icon: Truck },
            { label: "Completed", value: summary.completed, color: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
            { label: "Unassigned Orders", value: summary.unassigned, color: "bg-amber-50 border-amber-200", icon: AlertTriangle },
            { label: "Active Partners", value: summary.active_partners, color: "bg-indigo-50 border-indigo-200", icon: Users },
          ].map(c => {
            const Icon = c.icon;
            return (
              <div key={c.label} className={`${c.color} rounded-xl p-4 border`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className="opacity-60" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.label}</span>
                </div>
                <p className="text-2xl font-black text-slate-900">{c.value ?? 0}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Run Creation Panel */}
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-sm">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

          {/* Left */}
          <div className="xl:col-span-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Zap className="h-6 w-6 text-emerald-600" />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Smart Delivery Assignment
                </h2>
                <p className="text-sm text-slate-500">
                  Automatically creates optimized delivery runs using customer history,
                  nearby addresses and balanced workloads.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">

              <div className="rounded-xl border bg-white p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Target size={18} className="text-purple-600" />
                  </div>

                  <h4 className="font-bold text-slate-800">
                    History Based
                  </h4>
                </div>

                <p className="text-xs text-slate-500 leading-6">
                  Prefers assigning customers to delivery partners who have previously
                  served the same addresses.
                </p>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <MapPin size={18} className="text-blue-600" />
                  </div>

                  <h4 className="font-bold text-slate-800">
                    Address Clustering
                  </h4>
                </div>

                <p className="text-xs text-slate-500 leading-6">
                  Groups nearby delivery addresses into efficient delivery runs to
                  reduce travel distance.
                </p>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <BarChart3 size={18} className="text-emerald-600" />
                  </div>

                  <h4 className="font-bold text-slate-800">
                    Load Balanced
                  </h4>
                </div>

                <p className="text-xs text-slate-500 leading-6">
                  Evenly distributes orders across available delivery partners while
                  respecting workload limits.
                </p>
              </div>

            </div>
          </div>

          {/* Right */}
          <div className="xl:col-span-4">
            <div className="rounded-xl border bg-white p-5 h-full flex flex-col">

              <h3 className="font-bold text-slate-900 mb-4">
                Generate Delivery Runs
              </h3>

              <div className="space-y-4 flex-1">

                {branches.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Branch
                    </label>

                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">All Branches</option>

                      {branches.map((b: any) => (
                        <option key={b.branch_id} value={b.branch_id}>
                          {b.branch_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Delivery Slot
                  </label>

                  <select
                    value={selectedSlot}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All Slots</option>
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                  </select>
                </div>

              </div>

              {availability && (
                <div className="mt-4 text-xs animate-in fade-in duration-300">
                  {selectedBranch ? (
                    availability.total_partners === 0 ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 flex items-start gap-2">
                        <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                        <span>No delivery partners are assigned to this branch.</span>
                      </div>
                    ) : availability.available_partners === 0 ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 flex items-start gap-2">
                        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <span>All delivery partners for this branch are on leave/unavailable today.</span>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-emerald-800 flex items-start gap-2">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>{availability.available_partners} of {availability.total_partners} partners available.</span>
                      </div>
                    )
                  ) : (
                    availability.has_empty_branch ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 flex flex-col gap-1.5">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                          <span className="font-bold">Cannot generate runs globally:</span>
                        </div>
                        <span className="pl-6 text-[11px] text-red-600">
                          The following branches have no available partners today: <span className="font-semibold">{availability.empty_branches.join(', ')}</span>.
                        </span>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-emerald-800 flex items-start gap-2">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>All branches have available partners ({availability.available_partners} partners total).</span>
                      </div>
                    )
                  )}
                </div>
              )}

              <button
                onClick={() => setConfirmOpen(true)}
                disabled={creating || validatingAvailability || !availability || availability.has_empty_branch}
                className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Generate
                  </>
                )}
              </button>

            </div>
          </div>

        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Error Generating Runs</p>
            <p className="text-xs text-rose-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Assignment Summary */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" /> Assignment Results
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                <p className="text-[10px] font-bold uppercase text-emerald-400">Runs Created</p>
                <p className="text-2xl font-black text-emerald-700">{result.runs_created}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-[10px] font-bold uppercase text-blue-400">Orders Assigned</p>
                <p className="text-2xl font-black text-blue-700">{result.total_assigned}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <p className="text-[10px] font-bold uppercase text-amber-400">Remaining</p>
                <p className="text-2xl font-black text-amber-700">{result.remaining}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                <p className="text-[10px] font-bold uppercase text-indigo-400">Methods Used</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {Object.entries(result.methods).filter(([, v]) => v > 0).map(([k, v]) => {
                    const ml = methodLabels[k];
                    return <span key={k} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ml?.color}`}>{ml?.label}: {v}</span>;
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Created Runs */}
          {result.runs.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-50/80 border-b">
                <h3 className="text-sm font-bold text-slate-800">Created Runs ({result.runs.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b">
                      <th className="px-4 py-3 text-left">Run</th>
                      <th className="px-4 py-3 text-left">Partner</th>
                      <th className="px-4 py-3 text-center">Slot</th>
                      <th className="px-4 py-3 text-center">Addresses</th>
                      <th className="px-4 py-3 text-center">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.runs.map(run => {
                      const ml = methodLabels[run.method];
                      return (
                        <tr key={run.run_id} className="border-b last:border-0 hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{run.run_number}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-slate-800">{run.partner_name || "—"}</td>
                          <td className="px-4 py-3 text-center text-xs capitalize text-slate-500">{run.slot}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">{run.addresses}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ml?.color}`}>{ml?.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Partner Load */}
          {result.partner_loads && result.partner_loads.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Users size={14} className="text-indigo-500" /> Partner Loads After Assignment
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {result.partner_loads.map(p => {
                  const pct = p.max ? Math.min(100, Math.round((p.load / p.max) * 100)) : 0;
                  return (
                    <div key={p.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct > 90 ? "bg-rose-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{p.load}/{p.max}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 !m-0">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl animate-in zoom-in duration-200">
            <div className="p-8 text-center animate-in fade-in duration-300">
              {/* Icon */}
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                <Route className="h-10 w-10 text-emerald-600" />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-black text-gray-900 mb-3">
                Generate Delivery Runs?
              </h2>

              {/* Message */}
              <p className="text-sm leading-6 text-gray-500 mb-6">
                Are you sure you want to generate optimized delivery runs for today's unassigned orders?
              </p>

              {/* Selection details */}
              <div className="rounded-xl bg-slate-50 border p-4 mb-6 text-left space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider">Branch:</span>
                  <span className="font-bold text-slate-800">
                    {selectedBranch ? branches.find(b => b.branch_id === selectedBranch)?.branch_name || 'Selected' : 'All Branches'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider">Delivery Slot:</span>
                  <span className="font-bold text-slate-800 capitalize">
                    {selectedSlot || 'All Slots'}
                  </span>
                </div>
                {availability && (
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-400 uppercase tracking-wider">Available Partners:</span>
                    <span className="font-bold text-emerald-600">
                      {availability.available_partners} of {availability.total_partners}
                    </span>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="h-12 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={executeCreateRuns}
                  className="h-12 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
                >
                  Confirm & Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
