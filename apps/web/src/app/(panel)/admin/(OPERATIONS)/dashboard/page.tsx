// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx (Admin Command Center & Operations Dashboard)
// Description : Executive Operations Intelligence, Fast Assign & Run Shortcuts,
//               Interactive Graphs, Heuristic Insights, and Fleet Telemetry
// ============================================================================

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api.client";
import {
  ShoppingCart,
  Package,
  Truck,
  MapPin,
  TrendingUp,
  AlertCircle,
  Clock,
  Sparkles,
  Activity,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  BarChart2,
  Bell,
  RefreshCw,
  ChevronRight,
  Users,
  Box,
  Zap,
  Shield,
  Wallet,
  IndianRupee,
  AlertTriangle,
  Building,
  Layers,
  Orbit,
  Eye,
  Navigation,
  Check,
  Send,
  Ticket,
  Calendar,
  Compass,
  CheckCheck,
  Radio,
  Flame,
  LifeBuoy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { showSuccessToast } from "@/components/Toast";

// ── Interfaces ─────────────────────────────────────────────────────────────────
interface DeliveryRunItem {
  run_id: string;
  run_number?: string;
  delivery_partner_id: string;
  branch_id: string;
  run_date: string;
  delivery_slot: string;
  status: "assigned" | "in_progress" | "completed" | "cancelled";
  total_addresses: number;
  completed_addresses: number;
  failed_addresses: number;
  partner_name: string;
  partner_phone: string;
  branch_name: string;
}

interface LeaveRequestItem {
  id: number;
  delivery_partner_id: string;
  leave_date: string;
  end_date?: string;
  leave_type: string;
  half_day_shift?: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  admin_remarks?: string;
  created_at: string;
  partner_name: string;
  partner_phone: string;
  branch_name: string;
}

interface OperationalInsight {
  id: string;
  type: "success" | "warning" | "info" | "critical";
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
}

interface KpiData {
  total_customers: number;
  active_customers: number;
  new_customers_7d: number;
  new_customers_30d: number;
  active_subscriptions: number;
  paused_subscriptions: number;
  total_subscriptions: number;
  new_subscriptions_7d: number;
  today_total: number;
  today_pending: number;
  today_placed: number;
  today_confirmed: number;
  today_assigned?: number;
  today_packed: number;
  today_out_for_delivery: number;
  today_delivered: number;
  today_cancelled: number;
  today_revenue: number;
  today_subscription_orders: number;
  today_onetime_orders: number;
  today_unassigned_orders?: number;
  total_revenue: number;
  revenue_30d: number;
  revenue_7d: number;
  total_delivery_partners: number;
  active_delivery_partners: number;
  pending_delivery_count: number;
  today_runs_summary?: {
    total_runs: number;
    in_progress_runs: number;
    assigned_runs: number;
    completed_runs: number;
  };
  today_recent_runs?: DeliveryRunItem[];
  total_wallet_balance: number;
  wallets_with_balance: number;
  total_variants: number;
  low_stock_count: number;
  out_of_stock_count: number;
  pending_leave_requests_count?: number;
  unreviewed_leave_requests_count?: number;
  today_recent_leave_requests?: LeaveRequestItem[];
  total_outstandings_amount?: number;
  pending_outstandings_count?: number;
  insights?: OperationalInsight[];
  date: string;
}

interface BranchPerf {
  branch_id: string;
  branch_name: string;
  total_orders: number;
  delivered_orders: number;
  revenue: number;
  unique_customers: number;
  delivery_rate: number;
}

interface GrowthDay {
  day: string;
  orders: number;
  revenue: number;
  new_customers: number;
  new_subscriptions: number;
}

interface Alert {
  type: string;
  category: string;
  title: string;
  msg: string;
  time: string;
}

function formatMoney(v?: number | null) {
  if (v == null) return "₹0";
  return "₹" + Number(v).toLocaleString("en-IN");
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [branches, setBranches] = useState<BranchPerf[]>([]);
  const [growth, setGrowth] = useState<GrowthDay[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState(new Date().toLocaleTimeString());
  const [chartMetric, setChartMetric] = useState<"revenue" | "orders" | "subscriptions" | "customers">("revenue");

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  };

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [kpiRes, branchRes, growthRes, alertRes] = await Promise.all([
        api.get<any>("/admin/dashboard/kpis"),
        api.get<any>("/admin/dashboard/branch-performance?days=30"),
        api.get<any>("/admin/dashboard/growth?days=7"),
        api.get<any>("/admin/dashboard/alerts"),
      ]);

      if (kpiRes.data?.data) {
        setKpi(kpiRes.data.data);
      } else {
        setKpi({
          date: new Date().toISOString().split("T")[0],
        } as KpiData);
      }

      if (branchRes.data?.data) setBranches(branchRes.data.data);
      if (growthRes.data?.data) setGrowth(growthRes.data.data);
      if (alertRes.data?.data) setAlerts(alertRes.data.data);

      setLastSynced(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      if (silent) showSuccessToast("Operations command center synced");
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Auto sync every 60 seconds
    const timer = setInterval(() => {
      fetchAll(true);
    }, 60000);
    return () => clearInterval(timer);
  }, [fetchAll]);

  // Calculations for pipeline progress
  const pipelineMetrics = useMemo(() => {
    if (!kpi) return null;
    const total = kpi.today_total || 0;
    const delivered = kpi.today_delivered || 0;
    const assigned = (kpi.today_assigned || 0) + (kpi.today_out_for_delivery || 0);
    const packed = kpi.today_packed || 0;
    const confirmed = kpi.today_confirmed || 0;
    const pending = (kpi.today_pending || 0) + (kpi.today_placed || 0);
    const cancelled = kpi.today_cancelled || 0;

    const completionRate = total > 0 ? Math.round((delivered / Math.max(total - cancelled, 1)) * 100) : 0;
    const inProgressRate = total > 0 ? Math.round(((delivered + assigned + packed) / Math.max(total - cancelled, 1)) * 100) : 0;

    return {
      total,
      delivered,
      assigned,
      onRoad: assigned,
      packed,
      confirmed,
      pending,
      cancelled,
      completionRate,
      inProgressRate,
    };
  }, [kpi]);

  const displayedGrowth = useMemo(() => growth.slice(-7), [growth]);
  const maxGrowthValue = useMemo(() => {
    if (displayedGrowth.length === 0) return 1;
    if (chartMetric === "revenue") return Math.max(...displayedGrowth.map((g) => g.revenue), 1);
    if (chartMetric === "orders") return Math.max(...displayedGrowth.map((g) => g.orders), 1);
    if (chartMetric === "subscriptions") return Math.max(...displayedGrowth.map((g) => g.new_subscriptions), 1);
    return Math.max(...displayedGrowth.map((g) => g.new_customers), 1);
  }, [displayedGrowth, chartMetric]);

  const maxBranchRevenue = useMemo(() => {
    return Math.max(...branches.map((b) => b.revenue), 1);
  }, [branches]);

  if (loading && !kpi) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] gap-6">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 border-[6px] border-emerald-100 border-t-emerald-600 rounded-full"
          />
          <Orbit className="absolute inset-0 m-auto text-emerald-600 animate-pulse" size={32} />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-black text-slate-900 uppercase tracking-[0.25em]">F2H COMMAND CENTER</p>
          <p className="text-xs font-semibold text-slate-400 animate-pulse">Aggregating real-time fleet &amp; order telemetry...</p>
        </div>
      </div>
    );
  }

  const k = kpi || ({} as KpiData);
  const runsSummary = k.today_runs_summary || { total_runs: 0, in_progress_runs: 0, assigned_runs: 0, completed_runs: 0 };
  const recentRuns = k.today_recent_runs || [];
  const recentLeaves = k.today_recent_leave_requests || [];
  const unreviewedLeavesCount = k.unreviewed_leave_requests_count ?? k.pending_leave_requests_count ?? 0;
  const unassignedOrders = k.today_unassigned_orders || 0;
  const insightsList = k.insights || [];

  return (
    <div className="max-w-[1520px] w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ══════════════════════════════════════════════════════════════════════
          1. HERO COMMAND HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>LIVE OPERATIONS PULSE • {k.date}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              {getGreeting()}, {user?.first_name || "Admin"} 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Real-time route dispatches, delivery partner allocation, fulfillment pipeline, and automated subscriptions intelligence.
            </p>
          </div>

          {/* Quick Header Telemetry & Sync */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center min-w-[120px]">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block">Today Orders</span>
              <span className="text-xl font-black text-white">{k.today_total || 0}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center min-w-[120px]">
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest block">Today Revenue</span>
              <span className="text-xl font-black text-emerald-400">{formatMoney(k.today_revenue)}</span>
            </div>
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition active:scale-95 border border-emerald-400/30"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span>{refreshing ? "Syncing..." : "Sync Live"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. SHORTCUTS & FAST ACTION LAUNCHER (ASSIGN & RUN FOCUSED)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Zap size={14} className="text-amber-500" />
            <span>Fast Operational Launchers &amp; Shortcuts</span>
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">1-Click Dispatch Actions</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {/* Shortcut 1: Auto-Assign Deliveries */}
          <Link
            href="/admin/delivery/assign"
            className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:to-sky-50/60 p-4 rounded-2xl border border-slate-200 hover:border-sky-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-sky-50 group-hover:bg-sky-500 text-sky-600 group-hover:text-white transition-colors border border-sky-100">
                  <Truck size={18} />
                </div>
                {unassignedOrders > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-black bg-amber-500 text-white animate-pulse">
                    {unassignedOrders} Unassigned
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 group-hover:text-sky-900 transition-colors">
                  Assign Deliveries
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Auto cluster &amp; route optimize</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 text-[10.5px] font-bold text-sky-600 mt-3 pt-2 border-t border-slate-100">
              <span>Assign Routes</span>
              <ArrowRight size={11} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Shortcut 2: Live Delivery Runs */}
          <Link
            href="/admin/delivery-tracking"
            className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:to-emerald-50/60 p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white transition-colors border border-emerald-100">
                  <Navigation size={18} />
                </div>
                {runsSummary.in_progress_runs > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-black bg-emerald-600 text-white">
                    {runsSummary.in_progress_runs} On Road
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 group-hover:text-emerald-900 transition-colors">
                  Live Delivery Runs
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">GPS telemetry &amp; live stops</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-600 mt-3 pt-2 border-t border-slate-100">
              <span>Track Live</span>
              <ArrowRight size={11} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Shortcut 3: Dispatch & Crates */}
          <Link
            href="/admin/warehouse/dispatch"
            className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:to-indigo-50/60 p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white transition-colors border border-indigo-100">
                  <Box size={18} />
                </div>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">Hub</span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-900 transition-colors">
                  Dispatch &amp; Crates
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Barcode scan &amp; handover</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 text-[10.5px] font-bold text-indigo-600 mt-3 pt-2 border-t border-slate-100">
              <span>Dispatch Center</span>
              <ArrowRight size={11} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Shortcut 4: Partner Availability */}
          <Link
            href="/admin/delivery/partner-availability"
            className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:to-teal-50/60 p-4 rounded-2xl border border-slate-200 hover:border-teal-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-teal-50 group-hover:bg-teal-600 text-teal-600 group-hover:text-white transition-colors border border-teal-100">
                  <Radio size={18} />
                </div>
                {k.active_delivery_partners > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-black bg-teal-600 text-white">
                    {k.active_delivery_partners} Online
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                  Partner Availability
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Duty roster &amp; online status</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 text-[10.5px] font-bold text-teal-700 mt-3 pt-2 border-t border-slate-100">
              <span>Check Roster</span>
              <ArrowRight size={11} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Shortcut 5: Leave Requests */}
          <Link
            href="/admin/delivery/leave-requests"
            className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:to-purple-50/60 p-4 rounded-2xl border border-slate-200 hover:border-purple-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-purple-50 group-hover:bg-purple-600 text-purple-600 group-hover:text-white transition-colors border border-purple-100">
                  <Calendar size={18} />
                </div>
                {(k.pending_leave_requests_count || 0) > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-black bg-purple-600 text-white animate-pulse">
                    {k.pending_leave_requests_count} Pending
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 group-hover:text-purple-900 transition-colors">
                  Leave Requests
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Partner time-off &amp; approvals</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 text-[10.5px] font-bold text-purple-700 mt-3 pt-2 border-t border-slate-100">
              <span>Review Leaves</span>
              <ArrowRight size={11} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Shortcut 6: Customer Outstandings */}
          <Link
            href="/admin/finance/outstandings"
            className="group relative bg-white hover:bg-gradient-to-br hover:from-white hover:to-rose-50/60 p-4 rounded-2xl border border-slate-200 hover:border-rose-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-rose-50 group-hover:bg-rose-600 text-rose-600 group-hover:text-white transition-colors border border-rose-100">
                  <IndianRupee size={18} />
                </div>
                {(k.total_outstandings_amount || 0) > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-black bg-rose-600 text-white">
                    {formatMoney(k.total_outstandings_amount)}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 group-hover:text-rose-900 transition-colors">
                  Outstandings
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Subscriber dues &amp; collections</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-700 mt-3 pt-2 border-t border-slate-100">
              <span>Manage Dues</span>
              <ArrowRight size={11} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>



      {/* ══════════════════════════════════════════════════════════════════════
          4. FULFILLMENT PIPELINE FUNNEL GAUGE
      ══════════════════════════════════════════════════════════════════════ */}
      {pipelineMetrics && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Compass size={18} className="text-emerald-600" />
                <span>Today&apos;s Order Fulfillment Pipeline</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lifecycle progression from order confirmation to final door-step delivery drop.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Delivered Rate:</span>
              <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                {pipelineMetrics.completionRate}% Done
              </span>
            </div>
          </div>

          {/* Segmented Pipeline Bar */}
          <div className="space-y-2">
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5">
              {pipelineMetrics.delivered > 0 && (
                <div
                  style={{ width: `${(pipelineMetrics.delivered / Math.max(pipelineMetrics.total, 1)) * 100}%` }}
                  className="bg-emerald-500 rounded-full transition-all duration-500"
                  title={`Delivered: ${pipelineMetrics.delivered}`}
                />
              )}
              {pipelineMetrics.onRoad > 0 && (
                <div
                  style={{ width: `${(pipelineMetrics.onRoad / Math.max(pipelineMetrics.total, 1)) * 100}%` }}
                  className="bg-sky-500 rounded-full transition-all duration-500"
                  title={`Out for Delivery: ${pipelineMetrics.onRoad}`}
                />
              )}
              {pipelineMetrics.packed > 0 && (
                <div
                  style={{ width: `${(pipelineMetrics.packed / Math.max(pipelineMetrics.total, 1)) * 100}%` }}
                  className="bg-indigo-500 rounded-full transition-all duration-500"
                  title={`Packed: ${pipelineMetrics.packed}`}
                />
              )}
              {pipelineMetrics.confirmed > 0 && (
                <div
                  style={{ width: `${(pipelineMetrics.confirmed / Math.max(pipelineMetrics.total, 1)) * 100}%` }}
                  className="bg-amber-400 rounded-full transition-all duration-500"
                  title={`Confirmed: ${pipelineMetrics.confirmed}`}
                />
              )}
            </div>

            {/* Pipeline Stage Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
              <Link
                href="/admin/orders/today"
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition text-center group"
              >
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Total Scheduled</span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">{pipelineMetrics.total}</span>
                <span className="text-[10.5px] text-slate-500 font-medium">All Orders</span>
              </Link>

              <Link
                href="/admin/orders/today"
                className="p-3 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 transition text-center group"
              >
                <span className="text-[10px] font-bold uppercase text-amber-700 tracking-wider block">Confirmed</span>
                <span className="text-lg font-black text-amber-900 mt-0.5 block">{pipelineMetrics.confirmed}</span>
                <span className="text-[10.5px] text-amber-700/80 font-medium">Ready to Pack</span>
              </Link>

              <Link
                href="/admin/warehouse/dispatch"
                className="p-3 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-200/80 transition text-center group"
              >
                <span className="text-[10px] font-bold uppercase text-indigo-700 tracking-wider block">Packed</span>
                <span className="text-lg font-black text-indigo-900 mt-0.5 block">{pipelineMetrics.packed}</span>
                <span className="text-[10.5px] text-indigo-700/80 font-medium">In Crates</span>
              </Link>

              <Link
                href="/admin/delivery-tracking"
                className="p-3 rounded-xl bg-sky-50/70 hover:bg-sky-100/70 border border-sky-200/80 transition text-center group"
              >
                <span className="text-[10px] font-bold uppercase text-sky-700 tracking-wider block">On Road</span>
                <span className="text-lg font-black text-sky-900 mt-0.5 block">{pipelineMetrics.onRoad}</span>
                <span className="text-[10.5px] text-sky-700/80 font-medium">Out for Delivery</span>
              </Link>

              <Link
                href="/admin/orders/today"
                className="p-3 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/80 transition text-center group"
              >
                <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider block">Delivered</span>
                <span className="text-lg font-black text-emerald-900 mt-0.5 block">{pipelineMetrics.delivered}</span>
                <span className="text-[10.5px] text-emerald-700/80 font-medium">Completed</span>
              </Link>

              <Link
                href="/admin/orders/failed"
                className="p-3 rounded-xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/80 transition text-center group"
              >
                <span className="text-[10px] font-bold uppercase text-rose-700 tracking-wider block">Cancelled / Fail</span>
                <span className="text-lg font-black text-rose-900 mt-0.5 block">{pipelineMetrics.cancelled}</span>
                <span className="text-[10.5px] text-rose-700/80 font-medium">Exceptions</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          5. MAIN TWO COLUMN ANALYTICS & LIVE RUNS
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left 8 Columns: Interactive Graphs & Branch Matrix */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Interactive 7-Day Growth Trend Graph */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <BarChart2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">7-Day Performance &amp; Revenue Trends</h3>
                  <p className="text-xs text-slate-400">Daily business volume telemetry</p>
                </div>
              </div>

              {/* Chart Metric Switcher */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                {(
                  [
                    { key: "revenue", label: "Revenue (₹)" },
                    { key: "orders", label: "Orders" },
                    { key: "subscriptions", label: "New Subs" },
                    { key: "customers", label: "Customers" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setChartMetric(m.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartMetric === m.key
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Bar Chart */}
            {displayedGrowth.length > 0 ? (
              <div className="pt-2">
                <div className="grid grid-cols-7 gap-2 sm:gap-4 h-48 items-end pb-2 border-b border-slate-100">
                  {displayedGrowth.map((g, idx) => {
                    const value =
                      chartMetric === "revenue"
                        ? g.revenue
                        : chartMetric === "orders"
                          ? g.orders
                          : chartMetric === "subscriptions"
                            ? g.new_subscriptions
                            : g.new_customers;

                    const heightPercent = Math.max(10, Math.round((value / maxGrowthValue) * 100));

                    return (
                      <div key={idx} className="flex flex-col items-center h-full justify-end group cursor-pointer">
                        <div className="opacity-0 group-hover:opacity-100 transition text-[11px] font-black text-slate-800 mb-1 text-center truncate w-full">
                          {chartMetric === "revenue" ? formatMoney(value) : value}
                        </div>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPercent}%` }}
                          transition={{ delay: idx * 0.05, duration: 0.5 }}
                          className={`w-full max-w-[38px] rounded-t-xl transition-all group-hover:brightness-110 ${chartMetric === "revenue"
                            ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                            : chartMetric === "orders"
                              ? "bg-gradient-to-t from-sky-600 to-sky-400"
                              : chartMetric === "subscriptions"
                                ? "bg-gradient-to-t from-purple-600 to-purple-400"
                                : "bg-gradient-to-t from-amber-600 to-amber-400"
                            }`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Day Labels Row */}
                <div className="grid grid-cols-7 gap-2 sm:gap-4 pt-2 text-center">
                  {displayedGrowth.map((g, idx) => (
                    <div key={idx}>
                      <span className="text-[11px] font-bold text-slate-600 block">
                        {new Date(g.day).toLocaleDateString("en-IN", { weekday: "short" })}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(g.day).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">No trend history recorded yet</div>
            )}
          </div>

          {/* Branch Performance & Delivery Matrix */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Building size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Branch Delivery &amp; Revenue Leaderboard</h3>
                  <p className="text-xs text-slate-400">Hub performance across last 30 days</p>
                </div>
              </div>
              <Link
                href="/admin/reports/branch"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <span>Branch Analytics</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {branches.length > 0 ? (
              <div className="space-y-3.5 pt-2">
                {branches.slice(0, 5).map((b, idx) => (
                  <div key={b.branch_id} className="p-3.5 rounded-2xl bg-slate-50/75 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{b.branch_name || b.branch_id}</span>
                      </div>
                      <span className="text-xs font-black text-emerald-700">{formatMoney(b.revenue)}</span>
                    </div>

                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round((b.revenue / maxBranchRevenue) * 100)}%` }}
                        transition={{ delay: idx * 0.1, duration: 0.6 }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-0.5">
                      <span>{b.total_orders} Total Orders</span>
                      <span>{b.delivered_orders} Delivered</span>
                      <span>{b.unique_customers} Customers</span>
                      <span className="text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        {b.delivery_rate}% Success
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No branch performance records available.</p>
            )}
          </div>
        </div>

        {/* Right 4 Columns: Live Active Runs, Alerts & Capacity */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Live Delivery Runs Tracker Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
                  <Truck size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Today&apos;s Active Runs</h3>
                  <p className="text-[10.5px] text-slate-400">{runsSummary.total_runs} runs scheduled</p>
                </div>
              </div>
              <Link
                href="/admin/delivery-tracking"
                className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                <span>Live Map</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {/* Live Runs List */}
            {recentRuns.length > 0 ? (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {recentRuns.map((r) => {
                  const progress =
                    r.total_addresses > 0 ? Math.round((r.completed_addresses / r.total_addresses) * 100) : 0;

                  return (
                    <div
                      key={r.run_id}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-sky-300 transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-xs font-bold text-slate-900">#{r.run_id}</span>
                          <div className="text-[11px] text-slate-500 font-semibold">{r.partner_name}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase ${r.status === "in_progress"
                            ? "bg-sky-100 text-sky-800"
                            : r.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                            }`}
                        >
                          {r.status}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                          <span>
                            {r.completed_addresses} / {r.total_addresses} stops
                          </span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div style={{ width: `${progress}%` }} className="h-full bg-sky-500 rounded-full transition-all" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">
                <Truck size={28} className="mx-auto mb-1.5 opacity-30" />
                <p className="text-xs font-semibold">No delivery runs created yet today</p>
                <Link
                  href="/admin/delivery/assign"
                  className="mt-2 inline-block text-[11px] font-bold text-sky-600 underline"
                >
                  Create Delivery Runs
                </Link>
              </div>
            )}
          </div>

          {/* Latest Partner Leave Requests Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                  <Calendar size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Partner Leave Requests</h3>
                    {unreviewedLeavesCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-black bg-purple-600 text-white animate-pulse">
                        {unreviewedLeavesCount} Pending
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-slate-400">Time-off &amp; duty roster adjustments</p>
                </div>
              </div>
              <Link
                href="/admin/delivery/leave-requests"
                className="text-[11px] font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                <span>Review All</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {/* Leave Requests List */}
            {recentLeaves.length > 0 ? (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {recentLeaves.map((l) => (
                  <div
                    key={l.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-purple-300 transition space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-900 truncate block">{l.partner_name}</span>
                        <span className="text-[10.5px] text-slate-400 font-medium">
                          {l.branch_name} • {l.leave_type || "Leave"}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase shrink-0 ${l.status === "pending"
                          ? "bg-purple-100 text-purple-800"
                          : l.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                          }`}
                      >
                        {l.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10.5px] text-slate-600 font-semibold bg-white p-2 rounded-xl border border-slate-100">
                      <span>
                        📅 {new Date(l.leave_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        {l.end_date && l.end_date !== l.leave_date ? ` - ${new Date(l.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                        {l.half_day_shift ? ` (${l.half_day_shift})` : ""}
                      </span>
                      <Link
                        href="/admin/delivery/leave-requests"
                        className="text-[10px] font-bold text-purple-600 hover:underline"
                      >
                        Take Action →
                      </Link>
                    </div>

                    {l.reason && (
                      <p className="text-[10.5px] text-slate-500 italic truncate px-0.5">
                        &ldquo;{l.reason}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400">
                <Calendar size={24} className="mx-auto mb-1.5 opacity-30 text-purple-500" />
                <p className="text-xs font-semibold">No recent leave requests</p>
              </div>
            )}
          </div>

          {/* Operational Alerts Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Bell size={16} className="text-rose-500" />
                <span>Attention &amp; Alerts</span>
              </h3>
              {alerts.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                  {alerts.length}
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {alerts.length > 0 ? (
                alerts.map((a, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition flex items-start gap-2.5"
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${a.type === "critical"
                        ? "bg-rose-100 text-rose-600"
                        : a.type === "warning"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-blue-100 text-blue-600"
                        }`}
                    >
                      <AlertCircle size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate">{a.title}</span>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-1">{a.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{a.msg}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400">
                  <Shield size={28} className="mx-auto mb-1.5 opacity-30 text-emerald-500" />
                  <p className="text-xs font-semibold text-emerald-700">All systems operating smoothly</p>
                </div>
              )}
            </div>
          </div>

          {/* Key Capacity & Fleet Health Summary */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 border border-slate-700 shadow-md space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Activity size={14} className="text-emerald-400" />
              <span>Fleet &amp; Wallet Capacity</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Active Partners</span>
                <span className="text-lg font-black text-white mt-0.5 block">
                  {k.active_delivery_partners} / {k.total_delivery_partners}
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold">Available on Road</span>
              </div>

              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer Wallets</span>
                <span className="text-lg font-black text-amber-400 mt-0.5 block">
                  {formatMoney(k.total_wallet_balance)}
                </span>
                <span className="text-[10px] text-slate-300 font-semibold">{k.wallets_with_balance} Wallets</span>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between text-xs">
              <span className="text-slate-400">30-Day Total Revenue:</span>
              <span className="font-extrabold text-emerald-400">{formatMoney(k.revenue_30d)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}