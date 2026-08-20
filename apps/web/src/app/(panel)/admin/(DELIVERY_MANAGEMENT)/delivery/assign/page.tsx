"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  Truck, Zap, Users, RefreshCw, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, ArrowRight, Home, BarChart3, Target,
  Play, Route, MapPin, Search, ArrowRightLeft, ChevronDown,
  ChevronUp, Calendar, Filter, Package, AlertCircle
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
  const [activeTab, setActiveTab] = useState<"manage" | "drag_board" | "generate">("manage");
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
          onClick={() => setActiveTab("manage")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
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

        <button
          onClick={() => setActiveTab("drag_board")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
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
          onClick={() => setActiveTab("generate")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
            activeTab === "generate"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
        >
          <Zap size={14} className={activeTab === "generate" ? "text-amber-400" : ""} />
          <span>Auto-Generate Delivery Runs</span>
        </button>
      </div>

      {/* TAB 1: MANAGE RUNS & ORDER SWAP */}
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
                  <option value="planned">Planned</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Search & Accordion Controls */}
            <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l md:pl-3 border-slate-100 pt-2 md:pt-0">
              <div className="relative flex-1 md:w-56">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search run, partner, order..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <button
                onClick={expandAll}
                title="Expand All"
                className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold"
              >
                <ChevronDown size={14} />
              </button>
              <button
                onClick={collapseAll}
                title="Collapse All"
                className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold"
              >
                <ChevronUp size={14} />
              </button>
            </div>
          </div>

          {/* Runs Listing */}
          {runsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 text-slate-400 gap-3">
              <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-xs font-semibold">Loading delivery runs and address stops...</p>
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Truck size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Delivery Runs Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No delivery runs match your selected date and filter criteria. You can create runs using the "Auto-Generate Delivery Runs" tab.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRuns.map((run) => {
                const isExpanded = !!expandedRunIds[run.run_id];
                const ordersCount = run.orders?.length || 0;
                const addressStops = (run.address_stops && run.address_stops.length > 0)
                  ? run.address_stops
                  : (() => {
                      const stopMap = new Map<string, AddressStopItem>();
                      (run.orders || []).forEach((ord, idx) => {
                        const key = ord.address_id || `addr-${idx}`;
                        if (!stopMap.has(key)) {
                          stopMap.set(key, {
                            sequence_no: ord.run_sequence || stopMap.size + 1,
                            address_id: ord.address_id,
                            customer_id: ord.customer_id,
                            customer_name: ord.customer_name,
                            address_line: ord.address_line,
                            delivery_status: ord.status === 'delivered' ? 'delivered' : ord.status === 'failed' ? 'failed' : 'pending',
                            orders: [],
                          });
                        }
                        stopMap.get(key)!.orders.push(ord);
                      });
                      return Array.from(stopMap.values());
                    })();

                const stopsCount = addressStops.length || Number(run.total_addresses || ordersCount);
                const statusColorMap: Record<string, string> = {
                  planned: "bg-slate-100 text-slate-700",
                  assigned: "bg-sky-100 text-sky-700",
                  in_progress: "bg-blue-100 text-blue-700",
                  completed: "bg-emerald-100 text-emerald-700",
                  cancelled: "bg-rose-100 text-rose-700",
                };

                return (
                  <div
                    key={run.run_id}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all"
                  >
                    {/* Run Header / Summary Row */}
                    <div
                      onClick={() => toggleRunExpand(run.run_id)}
                      className="p-4 bg-gradient-to-r from-slate-50/70 via-white to-slate-50/40 hover:bg-slate-50/90 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-black text-xs shrink-0">
                          <Truck size={18} />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-slate-900">{run.run_id}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black capitalize bg-slate-100 text-slate-700">
                              {run.delivery_slot}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${statusColorMap[run.status] || "bg-slate-100 text-slate-700"}`}>
                              {run.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="font-bold text-slate-800 flex items-center gap-1">
                              <Users size={12} className="text-slate-400" />
                              {run.partner_name || "Unassigned Partner"}
                            </span>
                            {run.branch_name && (
                              <span className="text-slate-400">• {run.branch_name}</span>
                            )}
                            {run.partner_phone && (
                              <span className="text-slate-400 font-mono text-[11px]">• {run.partner_phone}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                        <div className="text-left md:text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              {stopsCount} {stopsCount === 1 ? "Stop" : "Stops"}
                            </span>
                            <span className="text-xs text-slate-400 font-normal">
                              ({ordersCount} {ordersCount === 1 ? "order" : "orders"})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] text-emerald-600 font-bold">
                              {run.completed_addresses || 0} done
                            </span>
                            {Number(run.failed_addresses) > 0 && (
                              <span className="text-[10px] text-rose-600 font-bold">
                                • {run.failed_addresses} failed
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Address Stops List */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 p-4 bg-slate-50/40 animate-in fade-in duration-200">
                        {addressStops.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2 text-center">
                            No address stops currently assigned to this delivery run.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-200">
                                  <th className="pb-2 pl-2 font-bold w-16">Stop #</th>
                                  <th className="pb-2 font-bold w-36">Customer</th>
                                  <th className="pb-2 font-bold">Address</th>
                                  <th className="pb-2 font-bold">Orders</th>
                                  <th className="pb-2 font-bold w-24">Status</th>
                                  <th className="pb-2 pr-2 text-right font-bold w-32">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {addressStops.map((stop, idx) => {
                                  const stopOrders = stop.orders || [];
                                  const stopStatus = stop.delivery_status || "pending";
                                  const isPending = stopStatus === "pending";
                                  const canSwap = isPending && !["completed", "cancelled"].includes(run.status);
                                  const firstOrderId = stopOrders[0]?.order_id;

                                  return (
                                    <tr key={stop.address_id || idx} className="hover:bg-white transition-colors group">
                                      <td className="py-2.5 pl-2 font-mono font-bold text-slate-600">
                                        #{stop.sequence_no ?? idx + 1}
                                      </td>
                                      <td className="py-2.5 font-bold text-slate-800">
                                        {stop.customer_name || "Customer"}
                                      </td>
                                      <td className="py-2.5 text-slate-600 max-w-xs truncate" title={stop.address_line}>
                                        {stop.address_line || "—"}
                                      </td>
                                      <td className="py-2.5">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                                            {stopOrders.length} {stopOrders.length === 1 ? "Order" : "Orders"}
                                          </span>
                                          {stopOrders.map((ord) => (
                                            <span
                                              key={ord.order_id}
                                              className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-600 border border-slate-200"
                                              title={`Order: ${ord.order_id}`}
                                            >
                                              #{ord.order_id}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="py-2.5">
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                            stopStatus === "delivered"
                                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                              : stopStatus === "failed"
                                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                                              : "bg-amber-50 text-amber-800 border border-amber-200"
                                          }`}
                                        >
                                          {stopStatus}
                                        </span>
                                      </td>
                                      <td className="py-2.5 pr-2 text-right">
                                        <button
                                          disabled={!canSwap || !firstOrderId}
                                          onClick={() => firstOrderId && setSwapModalOrderId(firstOrderId)}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ml-auto ${
                                            canSwap && firstOrderId
                                              ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200/60 shadow-sm cursor-pointer"
                                              : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                                          }`}
                                          title={!isPending ? `Cannot swap stop with status '${stopStatus}'` : undefined}
                                        >
                                          <ArrowRightLeft size={12} />
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RUN CREATION ENGINE */}
      {activeTab === "generate" && (
        <div className="space-y-6 animate-in fade-in duration-300">
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
                      <h4 className="font-bold text-slate-800">History Based</h4>
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
                      <h4 className="font-bold text-slate-800">Address Clustering</h4>
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
                      <h4 className="font-bold text-slate-800">Load Balanced</h4>
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
                  <h3 className="font-bold text-slate-900 mb-4">Generate Delivery Runs</h3>

                  <div className="space-y-4 flex-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center justify-between">
                        <span>Run / Target Date</span>
                        <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Testing Date</span>
                      </label>
                      <input
                        type="date"
                        value={generateDate}
                        onChange={(e) => {
                          const newDate = e.target.value;
                          setGenerateDate(newDate);
                          fetchAvailability(selectedBranch, newDate);
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    {branches.length > 0 && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          Branch
                        </label>
                        <select
                          value={selectedBranch}
                          onChange={(e) => {
                            const newBranch = e.target.value;
                            setSelectedBranch(newBranch);
                            fetchAvailability(newBranch, generateDate);
                          }}
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
                              The following branches have no available partners today: <span className="font-semibold">{availability.empty_branches.join(", ")}</span>.
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
                        {result.runs.map((run) => {
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
