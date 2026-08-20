"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  Truck, Zap, Users, RefreshCw, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, ArrowRight, Home, BarChart3, Target,
  Play, Route, MapPin, Search, ArrowRightLeft, ChevronDown,
  ChevronUp, Calendar, Filter, Package, AlertCircle, Sparkles, Loader2
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";
import DeliveryOrderSwapModal from "@/components/f2h/DeliveryOrderSwapModal";
import DeliveryPartnerDragBoard from "@/components/f2h/DeliveryPartnerDragBoard";

function getTodayIST(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

interface RunResult {
  runs_created: number;
  total_assigned: number;
  total_unassigned: number;
  remaining: number;
  methods: { auto_history: number; auto_cluster: number; auto_balanced: number };
  runs: Array<{
    run_id: string;
    run_number: string;
    partner_id: string;
    partner_name: string;
    slot: string;
    addresses: number;
    method: string;
  }>;
  partner_loads: Array<{ id: string; name: string; load: number; max: number }>;
}

interface RunSummary {
  total_runs: number;
  planned: number;
  assigned: number;
  in_progress: number;
  completed: number;
  partial: number;
  cancelled: number;
  total_addresses: number;
  total_completed: number;
  total_failed: number;
  active_partners: number;
  unassigned: number;
}

interface OrderItem {
  order_id: string;
  customer_id: string;
  customer_name: string;
  address_id: string;
  address_line: string;
  delivery_slot: string;
  status: string;
  total_amount: number;
  run_sequence: number;
  created_at: string;
}

interface AddressStopItem {
  run_address_id?: string;
  sequence_no: number;
  address_id: string;
  customer_id: string;
  customer_name: string;
  address_line: string;
  delivery_status: string;
  orders: OrderItem[];
}

interface DeliveryRunDetailed {
  id: string;
  run_id: string;
  run_number: string;
  run_date: string;
  delivery_slot: string;
  status: string;
  branch_id: string;
  branch_name: string;
  delivery_partner_id: string;
  partner_name: string;
  partner_phone: string;
  partner_active: boolean;
  total_addresses: number;
  completed_addresses: number;
  failed_addresses: number;
  created_at: string;
  orders: OrderItem[];
  address_stops?: AddressStopItem[];
}

export default function DeliveryRunsPage() {
  const [activeTab, setActiveTab] = useState<"generate" | "drag_board" | "manage">("generate");
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [generateDate, setGenerateDate] = useState<string>(getTodayIST());
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{
    total_partners: number;
    available_partners: number;
    has_empty_branch: boolean;
    empty_branches: string[];
  } | null>(null);
  const [validatingAvailability, setValidatingAvailability] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Manage / Swap State ──
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsList, setRunsList] = useState<DeliveryRunDetailed[]>([]);
  const [manageDate, setManageDate] = useState<string>(getTodayIST());
  const [manageBranch, setManageBranch] = useState<string>("");
  const [manageSlot, setManageSlot] = useState<string>("");
  const [manageStatus, setManageStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedRunIds, setExpandedRunIds] = useState<Record<string, boolean>>({});
  const [swapModalOrderId, setSwapModalOrderId] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/delivery/runs/summary");
      if (res.data?.data) setSummary(res.data.data);
    } catch { } finally { setLoading(false); }
  }, []);

  const fetchAvailability = useCallback(async (branchId: string, dateStr: string = generateDate) => {
    setValidatingAvailability(true);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branch_id", branchId);
      if (dateStr) params.set("date", dateStr);
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await api.get<any>(`/admin/delivery/runs/check-availability${query}`);
      if (res.data?.data) {
        setAvailability(res.data.data);
      }
    } catch (err) {
      console.error("fetchAvailability error:", err);
    } finally {
      setValidatingAvailability(false);
    }
  }, [generateDate]);

  const fetchRunsWithOrders = useCallback(async () => {
    setRunsLoading(true);
    try {
      const params: any = { date: manageDate };
      if (manageBranch) params.branch_id = manageBranch;
      if (manageSlot) params.slot = manageSlot;
      if (manageStatus) params.status = manageStatus;

      const res = await api.get<any>("/admin/delivery/runs/with-orders", { params });
      if (res.data?.status && Array.isArray(res.data.data)) {
        setRunsList(res.data.data);
        // Expand all runs by default if <= 5 runs
        if (res.data.data.length <= 5) {
          const exp: Record<string, boolean> = {};
          res.data.data.forEach((r: any) => {
            exp[r.run_id] = true;
          });
          setExpandedRunIds(exp);
        }
      }
    } catch (err) {
      console.error("fetchRunsWithOrders error:", err);
    } finally {
      setRunsLoading(false);
    }
  }, [manageDate, manageBranch, manageSlot, manageStatus]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchAvailability(selectedBranch);
  }, [selectedBranch, fetchAvailability]);

  useEffect(() => {
    fetchRunsWithOrders();
  }, [fetchRunsWithOrders]);

  useEffect(() => {
    api.get<any>("/admin/zone/branches-list").then((res) => {
      if (res.data?.data) setBranches(res.data.data);
    }).catch(() => { });
  }, []);

  const toggleRunExpand = (runId: string) => {
    setExpandedRunIds((prev) => ({
      ...prev,
      [runId]: !prev[runId],
    }));
  };

  const expandAll = () => {
    const exp: Record<string, boolean> = {};
    runsList.forEach((r) => { exp[r.run_id] = true; });
    setExpandedRunIds(exp);
  };

  const collapseAll = () => {
    setExpandedRunIds({});
  };

  const executeCreateRuns = async () => {
    setConfirmOpen(false);
    setCreating(true);
    setError(null);
    setResult(null);
    try {
      const body: any = {
        date: generateDate,
      };
      if (selectedBranch) body.branch_id = selectedBranch;
      if (selectedSlot) body.slot = selectedSlot;

      const res = await api.post<any>("/admin/delivery/runs/create", body);
      if (res.data?.data) {
        const data = res.data.data;
        if (data.runs_created === 0 && data.total_assigned === 0) {
          setError(`No unassigned orders found for date ${generateDate} / selected criteria.`);
        } else {
          setResult(data);
          showSuccessToast(`${data.runs_created} delivery runs created with ${data.total_assigned} orders for ${generateDate}!`);
        }
        fetchSummary();
        fetchAvailability(selectedBranch, generateDate);
        fetchRunsWithOrders();
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

  const filteredRuns = runsList.filter((run) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const matchRun =
      (run.run_id || "").toLowerCase().includes(q) ||
      (run.run_number || "").toLowerCase().includes(q) ||
      (run.partner_name || "").toLowerCase().includes(q) ||
      (run.branch_name || "").toLowerCase().includes(q);

    if (matchRun) return true;

    // Check orders inside run
    return (run.orders || []).some((o) =>
      (o.order_id || "").toLowerCase().includes(q) ||
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.address_line || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600">
          <Home size={14} /> Dashboard
        </Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Delivery Runs</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Route size={24} className="text-emerald-500" /> Delivery Runs & Order Swap
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage delivery runs, inspect address stops, and perform controlled order moves or swaps between partners
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchSummary();
              fetchRunsWithOrders();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="flex justify-center py-6">
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
          ].map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className={`${c.color} rounded-xl p-4 border transition-all hover:shadow-sm`}>
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

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("generate")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "generate"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
        >
          <Zap size={14} className={activeTab === "generate" ? "text-amber-400" : ""} />
          <span>Auto-Generate Delivery Runs</span>
        </button>

        <button
          onClick={() => setActiveTab("drag_board")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "drag_board"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
        >
          <ArrowRightLeft size={14} className={activeTab === "drag_board" ? "text-white" : "text-indigo-600"} />
          <span>2-Partner Drag & Drop Board</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-400 text-slate-950 uppercase">
            New
          </span>
        </button>

        <button
          onClick={() => setActiveTab("manage")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "manage"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
        >
          <Route size={14} className={activeTab === "manage" ? "text-indigo-400" : ""} />
          <span>Address Stops by Run</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === "manage" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
            {runsList.length}
          </span>
        </button>
      </div>

      {/* TAB 1: RUN CREATION ENGINE (AUTO-GENERATE) */}
      {activeTab === "generate" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white p-6 shadow-sm">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Left Column: Assignment Strategies */}
              <div className="xl:col-span-7 space-y-5">
                <div className="flex items-center gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
                    <Zap className="h-6 w-6 text-white" />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-900">
                      Smart Delivery Assignment Engine
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Automatically creates clustered delivery runs using past customer route history, geo-proximity, and balanced partner workloads.
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-purple-100 bg-white/90 p-4 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                        <Target size={16} />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">1. History Based</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Matches customers to the delivery partner who has reliably served their address previously.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                        <MapPin size={16} />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">2. Geo Clustering</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Groups nearby addresses in the same street/suburb together to minimize total transit distance.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4 shadow-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <BarChart3 size={16} />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">3. Load Balanced</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Evenly balances remaining address stops among active partners to prevent driver overload.
                    </p>
                  </div>
                </div>

                {/* Quick workflow tip banner */}
                <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-xs flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <Sparkles size={16} className="text-amber-400 shrink-0" />
                    <span className="text-[11px]">
                      After generating runs, you can visually fine-tune stops in the <strong>2-Partner Drag & Drop Board</strong>.
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab("drag_board")}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white transition-colors shrink-0 cursor-pointer"
                  >
                    Open Board &rarr;
                  </button>
                </div>
              </div>

              {/* Right Column: Execution Configuration */}
              <div className="xl:col-span-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 h-full flex flex-col shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Calendar size={14} className="text-emerald-600" />
                      Run Generator Parameters
                    </h3>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      Automated Dispatch
                    </span>
                  </div>

                  <div className="space-y-4 flex-1">
                    {/* Date Picker */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-600">Target Run Date:</label>
                        <button
                          type="button"
                          onClick={() => {
                            const today = new Date().toISOString().split("T")[0];
                            setGenerateDate(today);
                            fetchAvailability(selectedBranch, today);
                          }}
                          className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                        >
                          Set to Today
                        </button>
                      </div>
                      <input
                        type="date"
                        value={generateDate}
                        onChange={(e) => {
                          const newDate = e.target.value;
                          setGenerateDate(newDate);
                          fetchAvailability(selectedBranch, newDate);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none shadow-2xs"
                      />
                    </div>

                    {/* Branch Picker */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                        Operational Branch:
                      </label>
                      <select
                        value={selectedBranch}
                        onChange={(e) => {
                          const newBranch = e.target.value;
                          setSelectedBranch(newBranch);
                          fetchAvailability(newBranch, generateDate);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none shadow-2xs"
                      >
                        <option value="">All Active Branches (Global Generation)</option>
                        {branches.map((b: any) => (
                          <option key={b.branch_id} value={b.branch_id}>
                            {b.branch_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Slot Picker */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                        Delivery Slot:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSlot("")}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            selectedSlot === ""
                              ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20"
                              : "border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          All Slots
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedSlot("morning")}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            selectedSlot === "morning"
                              ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20"
                              : "border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          Morning
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedSlot("evening")}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            selectedSlot === "evening"
                              ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20"
                              : "border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          Evening
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Availability Status Card */}
                  {availability && (
                    <div className="mt-4 text-xs animate-in fade-in duration-300">
                      {selectedBranch ? (
                        availability.total_partners === 0 ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 flex items-start gap-2.5">
                            <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">No Partners Assigned</p>
                              <p className="text-[11px] text-red-600 mt-0.5">No active delivery partners exist in this branch.</p>
                            </div>
                          </div>
                        ) : availability.available_partners === 0 ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-700 flex items-start gap-2.5">
                            <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">All Partners On Leave</p>
                              <p className="text-[11px] text-amber-600 mt-0.5">All delivery partners for this branch are currently unavailable.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-900 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 size={15} className="text-emerald-600" />
                              <span className="font-bold text-xs">{availability.available_partners} of {availability.total_partners} Partners Ready</span>
                            </div>
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              Available
                            </span>
                          </div>
                        )
                      ) : (
                        availability.has_empty_branch ? (
                          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <AlertTriangle size={15} className="text-red-500" />
                              <span className="font-bold text-xs">Cannot generate runs globally:</span>
                            </div>
                            <p className="pl-6 text-[11px] text-red-600">
                              Branches without available partners: <span className="font-bold">{availability.empty_branches.join(", ")}</span>.
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-900 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 size={15} className="text-emerald-600" />
                              <span className="font-bold text-xs">All Branches Ready ({availability.available_partners} Partners)</span>
                            </div>
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              Global Ready
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Generate Button */}
                  <button
                    onClick={() => setConfirmOpen(true)}
                    disabled={creating || validatingAvailability || !availability || availability.has_empty_branch}
                    className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Generating Optimized Runs...</span>
                      </>
                    ) : (
                      <>
                        <Play size={15} />
                        <span>Generate Delivery Runs</span>
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

          {/* Results Summary & Quick Actions */}
          {result && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <CheckCircle2 size={17} className="text-emerald-500" />
                    <span>Assignment Results Summary</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab("drag_board")}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRightLeft size={13} />
                      <span>Fine-Tune in Drag & Drop Board</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("manage")}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Route size={13} />
                      <span>View Address Stops</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Runs Created</p>
                    <p className="text-2xl font-black text-emerald-800 mt-0.5">{result.runs_created}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3.5 border border-blue-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Orders Assigned</p>
                    <p className="text-2xl font-black text-blue-800 mt-0.5">{result.total_assigned}</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Remaining Unassigned</p>
                    <p className="text-2xl font-black text-amber-800 mt-0.5">{result.remaining}</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3.5 border border-purple-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Methods Used</p>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {Object.entries(result.methods).filter(([, v]) => v > 0).map(([k, v]) => {
                        const ml = methodLabels[k];
                        return <span key={k} className={`px-1.5 py-0.5 rounded text-[9px] font-black ${ml?.color}`}>{ml?.label}: {v}</span>;
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Created Runs Table */}
              {result.runs.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Generated Runs ({result.runs.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                          <th className="px-4 py-2.5 text-left font-bold">Run #</th>
                          <th className="px-4 py-2.5 text-left font-bold">Delivery Partner</th>
                          <th className="px-4 py-2.5 text-center font-bold">Slot</th>
                          <th className="px-4 py-2.5 text-center font-bold">Address Stops</th>
                          <th className="px-4 py-2.5 text-center font-bold">Strategy Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.runs.map((run) => {
                          const ml = methodLabels[run.method];
                          return (
                            <tr key={run.run_id} className="hover:bg-slate-50/60">
                              <td className="px-4 py-3 font-mono font-bold text-slate-800">{run.run_number}</td>
                              <td className="px-4 py-3 font-bold text-slate-800">{run.partner_name || "—"}</td>
                              <td className="px-4 py-3 text-center capitalize text-slate-600">{run.slot}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-800 rounded-full font-bold">
                                  {run.addresses} Stops
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ml?.color}`}>
                                  {ml?.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: 2-PARTNER DRAG & DROP BOARD */}
      {activeTab === "drag_board" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Top Filter for Drag Board */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 flex-1">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Run Date
                </label>
                <input
                  type="date"
                  value={manageDate}
                  onChange={(e) => setManageDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Branch
                </label>
                <select
                  value={manageBranch}
                  onChange={(e) => setManageBranch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none"
                >
                  <option value="">All Branches</option>
                  {branches.map((b: any) => (
                    <option key={b.branch_id} value={b.branch_id}>
                      {b.branch_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Slot
                </label>
                <select
                  value={manageSlot}
                  onChange={(e) => setManageSlot(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none"
                >
                  <option value="">All Slots</option>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => fetchRunsWithOrders()}
              disabled={runsLoading}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <RefreshCw size={13} className={runsLoading ? "animate-spin" : ""} />
              <span>Refresh Runs</span>
            </button>
          </div>

          <DeliveryPartnerDragBoard
            selectedDate={manageDate}
            selectedBranch={manageBranch}
            selectedSlot={manageSlot}
            branches={branches}
            onRefreshParent={fetchRunsWithOrders}
          />
        </div>
      )}

      {/* TAB 3: ADDRESS STOPS BY RUN */}
      {activeTab === "manage" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Filter Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1">
              {/* Date */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Run Date
                </label>
                <input
                  type="date"
                  value={manageDate}
                  onChange={(e) => setManageDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>

              {/* Branch */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Branch
                </label>
                <select
                  value={manageBranch}
                  onChange={(e) => setManageBranch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none"
                >
                  <option value="">All Branches</option>
                  {branches.map((b: any) => (
                    <option key={b.branch_id} value={b.branch_id}>
                      {b.branch_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Slot */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Slot
                </label>
                <select
                  value={manageSlot}
                  onChange={(e) => setManageSlot(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none"
                >
                  <option value="">All Slots</option>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Run Status
                </label>
                <select
                  value={manageStatus}
                  onChange={(e) => setManageStatus(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="partial">Partial</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search partner, customer, run ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <button
                onClick={() => fetchRunsWithOrders()}
                disabled={runsLoading}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw size={13} className={runsLoading ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Runs & Address Stops List */}
          {runsLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
              <p className="text-xs text-slate-500 font-semibold mt-3">Loading delivery runs and address stops...</p>
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <Package className="mx-auto h-12 w-12 text-slate-300" />
              <p className="text-sm font-bold text-slate-700 mt-2">No Delivery Runs Found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No delivery runs match your selected filter criteria. Try changing the date, slot, branch, or auto-generate runs using the first tab.
              </p>
              <button
                onClick={() => setActiveTab("generate")}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all inline-flex items-center gap-1.5"
              >
                <Zap size={14} />
                <span>Go to Auto-Generate Runs</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRuns.map((run) => {
                const isExpanded = expandedRunIds[run.run_id] ?? false;
                const addressStops = run.address_stops || [];
                const stopsCount = addressStops.length > 0 ? addressStops.length : (run.total_addresses || 0);
                const ordersCount = run.orders?.length || 0;

                return (
                  <div
                    key={run.id || run.run_id}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:border-slate-300"
                  >
                    {/* Run Header */}
                    <div
                      onClick={() => toggleRunExpand(run.run_id)}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                          <Truck size={18} />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-black text-slate-900">
                              {run.run_id}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-slate-100 text-slate-700">
                              {run.delivery_slot}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                run.status === "completed"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : run.status === "in_progress"
                                  ? "bg-blue-100 text-blue-800"
                                  : run.status === "partial"
                                  ? "bg-amber-100 text-amber-800"
                                  : run.status === "cancelled"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-indigo-100 text-indigo-800"
                              }`}
                            >
                              {run.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                            <Users size={12} className="text-slate-400" />
                            <span className="font-bold text-slate-800">{run.partner_name || "Unassigned"}</span>
                            <span className="text-slate-400">• {run.branch_name}</span>
                            {run.partner_phone && (
                              <span className="text-slate-400 font-mono text-[11px]">• {run.partner_phone}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-bold text-slate-800">
                        <span>{stopsCount} Stops</span>
                        <span>{ordersCount} Orders</span>
                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Content */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[10px] text-slate-400 uppercase tracking-wider">
                              <th className="px-2 pb-2 text-left font-bold">Stop</th>
                              <th className="px-2 pb-2 text-left font-bold">Customer</th>
                              <th className="px-2 pb-2 text-left font-bold">Address</th>
                              <th className="px-2 pb-2 text-center font-bold">Status</th>
                              <th className="px-2 pb-2 text-right font-bold">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {addressStops.map((stop: any, idx: number) => {
                              const canSwap = !["completed", "cancelled"].includes(run.status);
                              const isPending = stop.delivery_status === "pending";
                              const firstOrderId = stop.orders?.[0]?.order_id;
                              const stopStatus = stop.delivery_status || "pending";
                              return (
                                <tr key={idx} className="hover:bg-white transition-colors">
                                  <td className="px-2 py-2.5 font-mono font-bold text-slate-600">#{stop.sequence_no || idx + 1}</td>
                                  <td className="px-2 py-2.5 font-bold text-slate-800">{stop.customer_name}</td>
                                  <td className="px-2 py-2.5 text-slate-600 max-w-[200px] truncate">{stop.address_line}</td>
                                  <td className="px-2 py-2.5 text-center">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                        stopStatus === "delivered"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : stopStatus === "failed"
                                          ? "bg-rose-100 text-rose-800"
                                          : "bg-amber-50 text-amber-800"
                                      }`}
                                    >
                                      {stopStatus}
                                    </span>
                                  </td>
                                  <td className="py-2.5 pr-2 text-right">
                                        <button
                                          onClick={() => {
                                            if (firstOrderId) setSwapModalOrderId(firstOrderId);
                                          }}
                                          disabled={!canSwap || !firstOrderId}
                                          title={
                                            !isPending
                                              ? "Only pending stops can be swapped or moved"
                                              : ["completed", "cancelled"].includes(run.status)
                                              ? `Cannot modify ${run.status} run`
                                              : "Swap or Move this address stop"
                                          }
                                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors border border-indigo-200/60 inline-flex items-center gap-1 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                          <ArrowRightLeft size={11} />
                                          <span>Swap / Move</span>
                                        </button>
                                      </td>
                                    </tr>
                                  );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Generating Runs */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 !m-0">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl animate-in zoom-in duration-200">
            <div className="p-8 text-center animate-in fade-in duration-300">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                <Route className="h-10 w-10 text-emerald-600" />
              </div>

              <h2 className="text-2xl font-black text-gray-900 mb-3">
                Generate Delivery Runs?
              </h2>

              <p className="text-sm leading-6 text-gray-500 mb-6">
                Are you sure you want to generate optimized delivery runs for today's unassigned orders?
              </p>

              <div className="rounded-xl bg-slate-50 border p-4 mb-6 text-left space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider">Run Date:</span>
                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {generateDate}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider">Branch:</span>
                  <span className="font-bold text-slate-800">
                    {selectedBranch ? branches.find((b) => b.branch_id === selectedBranch)?.branch_name || "Selected" : "All Branches"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider">Delivery Slot:</span>
                  <span className="font-bold text-slate-800 capitalize">
                    {selectedSlot || "All Slots"}
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

      {/* Controlled Order Swap Modal */}
      <DeliveryOrderSwapModal
        orderId={swapModalOrderId}
        onClose={() => setSwapModalOrderId(null)}
        onSuccess={() => {
          fetchRunsWithOrders();
          fetchSummary();
        }}
      />
    </div>
  );
}
