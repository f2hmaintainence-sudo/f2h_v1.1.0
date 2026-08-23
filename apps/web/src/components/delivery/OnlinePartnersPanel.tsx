"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  Filter,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  Users,
  Wifi,
  WifiOff,
  Activity,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { api } from "@/services/api.client";

export interface PartnerDetail {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  profile_photo_url?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  status: "ONLINE" | "OFFLINE" | "ON_LEAVE";
  is_online: boolean;
  is_active: boolean;
  is_available: boolean;
  is_available_for_assignment: boolean;
  max_daily_orders: number;
  today_assigned_addresses: number;
  today_completed_addresses: number;
  today_failed_addresses: number;
  used_capacity: number;
  remaining_capacity: number;
  utilization_rate: number;
  current_run?: {
    run_id: string;
    run_status: string;
    slot: string;
    assigned_stops: number;
    completed_stops: number;
    failed_stops: number;
  } | null;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  average_rating?: number | null;
  daily_salary?: number | null;
  current_lat?: number | null;
  current_lng?: number | null;
  last_location_at?: string | null;
  is_location_stale?: boolean;
  on_leave_today?: boolean;
  today_leave_details?: {
    id: string;
    leave_type: string;
    leave_from: string;
    leave_to: string;
    half_day_shift?: string | null;
    reason?: string | null;
    status: string;
  } | null;
  has_pending_leave?: boolean;
  pending_leave_requests?: number;
}

export interface BranchSummary {
  branch_id: string;
  branch_name: string;
  total_partners: number;
  online_partners: number;
  offline_partners: number;
  on_leave_partners: number;
  available_partners_count: number;
  total_capacity: number;
  used_capacity: number;
  remaining_capacity: number;
  available_delivery_capacity: number;
  today_total_delivery_addresses: number;
  today_assigned_orders: number;
  today_unassigned_orders: number;
  requirement_status: "Sufficient" | "Near Capacity" | "Extra Delivery Partner Required";
  is_extra_required: boolean;
  extra_capacity_needed: number;
  extra_partners_needed: number;
}

export interface OverallSummary {
  total_partners: number;
  total_online: number;
  total_offline: number;
  total_on_leave: number;
  total_available_partners: number;
  total_capacity: number;
  total_used_capacity: number;
  total_available_capacity: number;
  total_today_addresses: number;
  total_unassigned_orders: number;
  branches_requiring_extra_partners: number;
  total_extra_partners_needed: number;
}

interface ApiResponse {
  status: boolean;
  partners?: PartnerDetail[];
  data?: PartnerDetail[];
  branches_summary?: BranchSummary[];
  overall_summary?: OverallSummary;
  summary?: OverallSummary;
}

export default function OnlinePartnersPanel({
  branchId,
}: {
  branchId?: string;
}) {
  const [partners, setPartners] = useState<PartnerDetail[]>([]);
  const [branchesSummary, setBranchesSummary] = useState<BranchSummary[]>([]);
  const [overallSummary, setOverallSummary] = useState<OverallSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "ONLINE" | "OFFLINE" | "ON_LEAVE">("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    const query = branchId ? `?branch_id=${encodeURIComponent(branchId)}` : "";

    try {
      const response = await api.get<ApiResponse>(`/admin/delivery/partner-availability${query}`);
      const res = response.data;

      if (res && res.status) {
        const partnerList = res.partners || res.data || [];
        setPartners(Array.isArray(partnerList) ? partnerList : []);
        setBranchesSummary(Array.isArray(res.branches_summary) ? res.branches_summary : []);
        setOverallSummary(res.overall_summary || res.summary || null);
        setError(null);
        setLastUpdated(new Date());
      } else {
        throw new Error("Could not load partner availability data");
      }
    } catch {
      // Fallback try online route
      try {
        const fallbackRes = await api.get<ApiResponse>(`/admin/delivery/partners/online${query}`);
        const res = fallbackRes.data;
        if (res && res.status) {
          const partnerList = res.partners || res.data || [];
          setPartners(Array.isArray(partnerList) ? partnerList : []);
          setBranchesSummary(Array.isArray(res.branches_summary) ? res.branches_summary : []);
          setOverallSummary(res.overall_summary || res.summary || null);
          setError(null);
          setLastUpdated(new Date());
        } else {
          throw new Error("Could not load partner availability");
        }
      } catch {
        setError("Failed to fetch partner availability & capacity");
      }
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  // Filtered partners based on search and status
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.full_name?.toLowerCase().includes(q);
        const matchPhone = p.phone?.toLowerCase().includes(q);
        const matchBranch = p.branch_name?.toLowerCase().includes(q);
        const matchRun = p.current_run?.run_id?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchBranch && !matchRun) {
          return false;
        }
      }

      // Status Tab Filter
      if (statusFilter === "AVAILABLE") return p.is_available_for_assignment;
      if (statusFilter === "ONLINE") return p.status === "ONLINE";
      if (statusFilter === "OFFLINE") return p.status === "OFFLINE";
      if (statusFilter === "ON_LEAVE") return p.status === "ON_LEAVE";
      return true;
    });
  }, [partners, searchQuery, statusFilter]);

  // Filtered branches
  const displayedBranches = useMemo(() => {
    if (!branchId) return branchesSummary;
    return branchesSummary.filter((b) => b.branch_id === branchId);
  }, [branchesSummary, branchId]);

  return (
    <div className="space-y-6">
      {/* ── 1. Top Executive KPI Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Partners */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Total Partners</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{overallSummary?.total_partners ?? partners.length}</span>
            <span className="text-[11px] font-semibold text-slate-400">active</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>Roster registered</span>
          </div>
        </div>

        {/* Online Partners */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-200/90 shadow-2xs relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">Online</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wifi size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-700">{overallSummary?.total_online ?? partners.filter((p) => p.status === "ONLINE").length}</span>
            <span className="text-[11px] font-bold text-emerald-600">clocked-in</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live on shift</span>
          </div>
        </div>

        {/* Available for Assignment */}
        <div className="bg-white rounded-2xl p-4 border border-teal-200/90 shadow-2xs relative overflow-hidden group hover:border-teal-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700">Available</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-teal-700">{overallSummary?.total_available_partners ?? partners.filter((p) => p.is_available_for_assignment).length}</span>
            <span className="text-[11px] font-bold text-teal-600">with capacity</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-teal-600 font-medium">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500" />
            <span>Ready for orders</span>
          </div>
        </div>

        {/* Offline */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Offline</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
              <WifiOff size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-700">{overallSummary?.total_offline ?? partners.filter((p) => p.status === "OFFLINE").length}</span>
            <span className="text-[11px] font-semibold text-slate-400">partners</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span>0 available capacity</span>
          </div>
        </div>

        {/* On Leave */}
        <div className="bg-white rounded-2xl p-4 border border-rose-200/90 shadow-2xs relative overflow-hidden group hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700">On Leave</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <CalendarOff size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-700">{overallSummary?.total_on_leave ?? partners.filter((p) => p.status === "ON_LEAVE").length}</span>
            <span className="text-[11px] font-semibold text-rose-500">approved</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-500 font-medium">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>0 available capacity</span>
          </div>
        </div>

        {/* Available Remaining Capacity */}
        <div className="bg-gradient-to-br from-emerald-800 to-teal-900 rounded-2xl p-4 text-white shadow-sm shadow-emerald-900/20 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-200">Avail. Capacity</span>
            <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md text-emerald-300 flex items-center justify-center">
              <PackageCheck size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white">{overallSummary?.total_available_capacity ?? partners.reduce((acc, p) => acc + p.remaining_capacity, 0)}</span>
            <span className="text-[11px] font-bold text-emerald-200">stops left</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-200/90 font-medium">
            <span>Used: {overallSummary?.total_used_capacity ?? partners.reduce((acc, p) => acc + p.used_capacity, 0)} addresses</span>
          </div>
        </div>
      </div>

      {/* ── 2. Branch Requirement & Capacity Alert Banner ── */}
      {displayedBranches.some((b) => b.is_extra_required) && (
        <div className="bg-gradient-to-r from-rose-50 via-rose-100/70 to-amber-50 border-2 border-rose-300/80 rounded-2xl p-4.5 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/30">
              <AlertTriangle size={22} className="animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider bg-rose-600 text-white px-2.5 py-0.5 rounded-full">
                  Action Required
                </span>
                <h3 className="text-sm font-black text-rose-950">
                  Extra Delivery Partners Required Today
                </h3>
              </div>
              <p className="text-xs font-medium text-rose-800/90 mt-1 leading-relaxed">
                Delivery capacity is insufficient for scheduled demand in{" "}
                <span className="font-extrabold text-rose-950">
                  {displayedBranches.filter((b) => b.is_extra_required).map((b) => b.branch_name).join(", ")}
                </span>
                . Additional{" "}
                <span className="font-black text-rose-900 underline underline-offset-2">
                  +{displayedBranches.reduce((acc, b) => acc + b.extra_capacity_needed, 0)} delivery stops capacity
                </span>{" "}
                (approx.{" "}
                <span className="font-black text-rose-900">
                  +{displayedBranches.reduce((acc, b) => acc + b.extra_partners_needed, 0)} partner(s)
                </span>
                ) must be activated or scheduled to fulfill today&apos;s orders.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="shrink-0 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black rounded-xl shadow-sm transition-all"
          >
            Recheck Capacity
          </button>
        </div>
      )}

      {/* ── 3. Branch-Wise Capacity & Requirement Table ── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center">
              <BarChart3 size={17} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Branch-Wise Delivery Capacity & Requirement Standing
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Live delivery demand vs available partner capacity calculated per branch
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-emerald-700" : "text-slate-600"} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th scope="col" className="px-5 py-3.5">Branch</th>
                <th scope="col" className="px-4 py-3.5 text-center">Partners (On/Tot)</th>
                <th scope="col" className="px-4 py-3.5 text-center">Available Partners</th>
                <th scope="col" className="px-4 py-3.5 text-center">Today Demand (Stops)</th>
                <th scope="col" className="px-4 py-3.5 text-center">Total Capacity</th>
                <th scope="col" className="px-4 py-3.5 text-center">Used Capacity</th>
                <th scope="col" className="px-4 py-3.5 text-center">Remaining Capacity</th>
                <th scope="col" className="px-5 py-3.5 text-center">Requirement Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {displayedBranches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                    No branch capacity data available for selected filter.
                  </td>
                </tr>
              ) : (
                displayedBranches.map((b) => {
                  const isExtra = b.requirement_status === "Extra Delivery Partner Required";
                  const isNear = b.requirement_status === "Near Capacity";

                  return (
                    <tr
                      key={b.branch_id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isExtra ? "bg-rose-50/30 font-medium" : ""
                      }`}
                    >
                      {/* Branch */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-emerald-700 shrink-0" />
                          <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                            {b.branch_name}
                          </span>
                        </div>
                      </td>

                      {/* Partners On/Total */}
                      <td className="px-4 py-4 text-center">
                        <span className="font-bold text-slate-800">
                          <span className="text-emerald-700 font-extrabold">{b.online_partners}</span>
                          <span className="text-slate-400"> / </span>
                          <span>{b.total_partners}</span>
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {b.on_leave_partners > 0 ? `${b.on_leave_partners} leave` : "0 leave"}
                        </div>
                      </td>

                      {/* Available Partners */}
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center gap-1 font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/80">
                          <Sparkles size={11} /> {b.available_partners_count}
                        </span>
                      </td>

                      {/* Today Demand (Stops) */}
                      <td className="px-4 py-4 text-center">
                        <div className="font-extrabold text-slate-900">{b.today_total_delivery_addresses}</div>
                        <div className="text-[10px] text-slate-400">
                          {b.today_unassigned_orders} unassigned
                        </div>
                      </td>

                      {/* Total Nominal Capacity */}
                      <td className="px-4 py-4 text-center font-bold text-slate-600">
                        {b.total_capacity}
                      </td>

                      {/* Used Capacity */}
                      <td className="px-4 py-4 text-center">
                        <span className="font-extrabold text-slate-800">{b.used_capacity}</span>
                        <div className="text-[10px] text-slate-400">stops assigned</div>
                      </td>

                      {/* Remaining Capacity */}
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-block font-black px-2.5 py-1 rounded-lg ${
                            b.remaining_capacity > 0
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300/80"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {b.remaining_capacity}
                        </span>
                      </td>

                      {/* Requirement Status */}
                      <td className="px-5 py-4 text-center">
                        {isExtra ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-800 border border-rose-300 shadow-2xs">
                              <AlertCircle size={13} className="text-rose-600 shrink-0" />
                              Extra Delivery Partner Required
                            </span>
                            <span className="text-[10px] font-black text-rose-700">
                              +{b.extra_capacity_needed} orders / +{b.extra_partners_needed} partner(s)
                            </span>
                          </div>
                        ) : isNear ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800 border border-amber-300">
                            <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                            Near Capacity
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 border border-emerald-300">
                            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                            Sufficient
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 4. Partner-Wise Availability & Capacity Grid / Table ── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        {/* Header & Filter Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3.5 bg-slate-50/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Partner-Wise Availability & Real-Time Capacity
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Real-time partner duty status, max limits, assigned stops, remaining capacity, and active runs
              </p>
            </div>

            {/* Live Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search partner name, phone, run ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Filter size={11} /> Filter:
            </span>
            {(
              [
                { id: "ALL", label: "All Partners", count: partners.length },
                {
                  id: "AVAILABLE",
                  label: "Available for Assignment",
                  count: partners.filter((p) => p.is_available_for_assignment).length,
                  highlight: "text-teal-700 bg-teal-50 border-teal-300",
                },
                {
                  id: "ONLINE",
                  label: "Online",
                  count: partners.filter((p) => p.status === "ONLINE").length,
                },
                {
                  id: "OFFLINE",
                  label: "Offline",
                  count: partners.filter((p) => p.status === "OFFLINE").length,
                },
                {
                  id: "ON_LEAVE",
                  label: "On Leave",
                  count: partners.filter((p) => p.status === "ON_LEAVE").length,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs flex items-center gap-1.5 border ${
                  statusFilter === tab.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    statusFilter === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Partners Table */}
        {error ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <AlertCircle size={26} className="text-rose-600" />
            <p className="text-sm font-bold text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-sm"
            >
              Retry
            </button>
          </div>
        ) : loading && partners.length === 0 ? (
          <div className="flex items-center justify-center gap-2.5 px-4 py-16 text-sm font-semibold text-slate-500">
            <Loader2 size={20} className="animate-spin text-emerald-700" />
            Calculating real-time delivery partner availability & capacity...
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="px-4 py-16 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">No delivery partners match this filter</p>
            <p className="text-xs text-slate-400">Try selecting another branch or clearing the search keyword.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Delivery Partner</th>
                  <th scope="col" className="px-4 py-3.5">Branch</th>
                  <th scope="col" className="px-4 py-3.5 text-center">Status</th>
                  <th scope="col" className="px-4 py-3.5 text-center">Max Daily Orders</th>
                  <th scope="col" className="px-4 py-3.5 text-center">Today Assigned Stops</th>
                  <th scope="col" className="px-4 py-3.5 text-center">Remaining Capacity</th>
                  <th scope="col" className="px-4 py-3.5">Current Delivery Run</th>
                  <th scope="col" className="px-5 py-3.5 text-center">Assignment Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredPartners.map((partner) => {
                  const isAvailable = partner.is_available_for_assignment;
                  const isOnline = partner.status === "ONLINE";
                  const isOnLeave = partner.status === "ON_LEAVE";

                  return (
                    <tr key={partner.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Partner Identity */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 flex items-center justify-center font-black text-xs shrink-0 border border-slate-200">
                            {partner.full_name?.charAt(0) || "P"}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                              {partner.full_name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                              <span>{partner.phone || "No phone"}</span>
                              {partner.vehicle_number && (
                                <>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-0.5">
                                    <Truck size={10} /> {partner.vehicle_number}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3.5 text-slate-600 font-medium">
                        <div className="flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span>{partner.branch_name || "Unassigned"}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        {isOnLeave ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-black text-rose-800 border border-rose-200">
                              <CalendarOff size={11} /> ON LEAVE
                            </span>
                            {partner.today_leave_details?.reason && (
                              <span className="text-[10px] text-rose-600 max-w-[110px] truncate mt-0.5" title={partner.today_leave_details.reason}>
                                {partner.today_leave_details.reason}
                              </span>
                            )}
                          </div>
                        ) : isOnline ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-800 border border-emerald-300">
                            <Wifi size={11} className="animate-pulse text-emerald-600" /> ONLINE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 border border-slate-200">
                            <WifiOff size={11} /> OFFLINE
                          </span>
                        )}
                      </td>

                      {/* Max Daily Orders */}
                      <td className="px-4 py-3.5 text-center font-bold text-slate-700">
                        {partner.max_daily_orders}
                      </td>

                      {/* Today Assigned Stops with Progress Bar */}
                      <td className="px-4 py-3.5 text-center min-w-[130px]">
                        <div className="flex items-center justify-center gap-1.5 font-black text-slate-900">
                          <span>{partner.today_assigned_addresses}</span>
                          <span className="text-[10px] font-normal text-slate-400">/ {partner.max_daily_orders}</span>
                        </div>
                        {/* Mini Utilization Bar */}
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              partner.utilization_rate >= 90
                                ? "bg-rose-500"
                                : partner.utilization_rate >= 70
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, partner.utilization_rate)}%` }}
                          />
                        </div>
                      </td>

                      {/* Remaining Capacity */}
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block font-black px-2.5 py-1 rounded-lg text-xs ${
                            isAvailable
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {partner.remaining_capacity}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {isOnline ? (partner.remaining_capacity > 0 ? "slots open" : "at limit") : "unavailable"}
                        </div>
                      </td>

                      {/* Current Delivery Run */}
                      <td className="px-4 py-3.5">
                        {partner.current_run ? (
                          <div className="space-y-0.5">
                            <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1">
                              <Activity size={11} className="text-emerald-600" />
                              <span>{partner.current_run.run_id}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              <span className="capitalize font-bold text-slate-700">{partner.current_run.run_status}</span> •{" "}
                              <span>
                                {partner.current_run.completed_stops}/{partner.current_run.assigned_stops} done
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No active run</span>
                        )}
                      </td>

                      {/* Assignment Availability Indicator */}
                      <td className="px-5 py-3.5 text-center">
                        {isAvailable ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-100/80 px-2.5 py-1 text-xs font-black text-teal-900 border border-teal-300 shadow-2xs">
                            <CheckCircle2 size={12} className="text-teal-700" /> Available for Assignment
                          </span>
                        ) : isOnLeave ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">
                            Unavailable (On Leave)
                          </span>
                        ) : isOnline ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            At Max Capacity
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            Unavailable (Offline)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
