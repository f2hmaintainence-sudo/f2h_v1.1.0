"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api.client";
import {
  ShoppingCart, Package, Truck, MapPin,
  TrendingUp, AlertCircle, Clock, Sparkles,
  Activity, ArrowRight, ArrowUpRight, CheckCircle2,
  BarChart2, Bell, RefreshCw,
  ChevronRight, Users, Box, Zap, Shield,
  Wallet, IndianRupee, AlertTriangle, Building,
  Layers, Orbit, Eye
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { showSuccessToast } from "@/components/Toast";

// ── Types ─────────────────────────────────────────────────────────────────────
interface KpiData {
  total_customers: number; active_customers: number; new_customers_7d: number; new_customers_30d: number;
  active_subscriptions: number; paused_subscriptions: number; total_subscriptions: number; new_subscriptions_7d: number;
  today_total: number; today_pending: number; today_placed: number; today_confirmed: number;
  today_packed: number; today_out_for_delivery: number; today_delivered: number; today_cancelled: number;
  today_revenue: number; today_subscription_orders: number; today_onetime_orders: number;
  total_revenue: number; revenue_30d: number; revenue_7d: number;
  total_delivery_partners: number; active_delivery_partners: number; pending_delivery_count: number;
  total_wallet_balance: number; wallets_with_balance: number;
  total_variants: number; low_stock_count: number; out_of_stock_count: number;
  date: string;
}

interface BranchPerf { branch_id: string; branch_name: string; total_orders: number; delivered_orders: number; revenue: number; unique_customers: number; delivery_rate: number; }
interface GrowthDay { day: string; orders: number; revenue: number; new_customers: number; new_subscriptions: number; }
interface Alert { type: string; category: string; title: string; msg: string; time: string; }

function formatMoney(v?: number | null) {
  if (v == null) return '₹0';
  return '₹' + v.toLocaleString('en-IN');
}

function KpiCard({ label, value, sub, icon: Icon, color, href }: any) {
  const colors: Record<string, string> = {
    blue: 'border-l-blue-400 bg-blue-50/60', green: 'border-l-emerald-400 bg-emerald-50/60',
    amber: 'border-l-amber-400 bg-amber-50/60', rose: 'border-l-rose-400 bg-rose-50/60',
    indigo: 'border-l-indigo-400 bg-indigo-50/60', purple: 'border-l-purple-400 bg-purple-50/60',
    teal: 'border-l-teal-400 bg-teal-50/60', sky: 'border-l-sky-400 bg-sky-50/60',
  };
  const iconColors: Record<string, string> = {
    blue: 'text-blue-500 bg-blue-100', green: 'text-emerald-500 bg-emerald-100',
    amber: 'text-amber-500 bg-amber-100', rose: 'text-rose-500 bg-rose-100',
    indigo: 'text-indigo-500 bg-indigo-100', purple: 'text-purple-500 bg-purple-100',
    teal: 'text-teal-500 bg-teal-100', sky: 'text-sky-500 bg-sky-100',
  };
  const Wrapper = href ? Link : 'div';
  return (
    <Wrapper href={href || '#'} className={`rounded-xl border-l-4 ${colors[color]} p-3 md:p-4 shadow-sm hover:shadow-md transition-all group cursor-pointer`}>
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg ${iconColors[color]} flex items-center justify-center`}><Icon size={16} /></div>
        {href && <ArrowUpRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />}
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-xl font-black text-slate-900 tracking-tight">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{sub}</p>}
    </Wrapper>
  );
}

function MiniBar({ data, maxVal }: { data: number[]; maxVal: number }) {
  return (
    <div className="flex items-end gap-[3px] h-10">
      {data.map((v, i) => (
        <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${Math.max(4, (v / Math.max(maxVal, 1)) * 100)}%` }}
          transition={{ delay: i * 0.05, duration: 0.6 }}
          className="flex-1 bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-t-sm min-h-[2px]" />
      ))}
    </div>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const typeColors: Record<string, string> = { critical: 'text-rose-500 bg-rose-50', warning: 'text-amber-500 bg-amber-50', info: 'text-blue-500 bg-blue-50' };
  const tc = typeColors[alert.type] || typeColors.info;
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border-l-2 border-transparent hover:border-l-rose-300">
      <div className={`w-8 h-8 rounded-lg ${tc} flex items-center justify-center shrink-0`}>
        <AlertCircle size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-[9px] font-bold uppercase tracking-widest ${tc.split(' ')[0]}`}>{alert.type}</span>
          <span className="text-[9px] text-slate-300 font-bold">{alert.time}</span>
        </div>
        <p className="text-xs font-semibold text-slate-800 truncate">{alert.title}</p>
        <p className="text-[10px] text-slate-400 truncate">{alert.msg}</p>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [branches, setBranches] = useState<BranchPerf[]>([]);
  const [growth, setGrowth] = useState<GrowthDay[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState(new Date().toLocaleTimeString());

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  };

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [kpiRes, branchRes, growthRes, alertRes] = await Promise.all([
        api.get<any>("/admin/dashboard/kpis"),
        api.get<any>("/admin/dashboard/branch-performance?days=30"),
        api.get<any>("/admin/dashboard/growth?days=7"),
        api.get<any>("/admin/dashboard/alerts"),
      ]);
      // if (kpiRes.data?.data) setKpi(kpiRes.data.data);
      setKpi(
        kpiRes.data?.data ?? {
          date: new Date().toISOString().split('T')[0],
        } as KpiData,
      );
      if (branchRes.data?.data) setBranches(branchRes.data.data);
      if (growthRes.data?.data) setGrowth(growthRes.data.data);
      if (alertRes.data?.data) setAlerts(alertRes.data.data);
      setLastSynced(new Date().toLocaleTimeString());
      if (silent) showSuccessToast("Dashboard synced");
    } catch { /* silent */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading && !kpi) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6">
        <div className="relative">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 border-[6px] border-[#388e3c]/10 border-t-[#388e3c] rounded-full" />
          <Orbit className="absolute inset-0 m-auto text-[#388e3c] animate-pulse" size={32} />
        </div>
        <div className="text-center space-y-2">
          <p className="text-sm font-black text-slate-900 uppercase tracking-[0.3em]">F2H COMMAND</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] animate-pulse">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!kpi) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <AlertTriangle className="text-rose-500 w-12 h-12 opacity-50" />
        <p className="text-slate-600 font-medium">Failed to load dashboard data.</p>
        <button onClick={() => fetchAll()} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-slate-800 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  const k = kpi;
  if (!k) {
    return null;
  }
  const displayedGrowth = growth.slice(-7);
  const maxGrowthOrders = Math.max(...displayedGrowth.map(g => g.orders), 1);
  const maxBranchRevenue = Math.max(...branches.map(b => b.revenue), 1);

  return (
    <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 space-y-5 pb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#388e3c]/10 border border-[#388e3c]/20 mb-2">
            <Sparkles size={12} className="text-[#388e3c]" />
            <span className="text-[10px] font-bold text-[#388e3c] uppercase tracking-widest">{getGreeting()}, {user?.first_name || "Admin"}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Command Center</h1>
          <p className="text-xs text-slate-400 mt-1">Real-time operational intelligence for {k.date}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchAll(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold shadow-sm hover:bg-slate-50 transition-all">
            <RefreshCw size={14} className={refreshing ? "animate-spin text-[#388e3c]" : ""} />
            Sync
          </button>
          <span className="text-[9px] text-slate-300 font-bold">{lastSynced}</span>
        </div>
      </div>

      {/* Today's Operations HUD */}
      <section>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Today&apos;s Operations</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2">
          <KpiCard label="Total Orders" value={k.today_total} icon={ShoppingCart} color="blue" href="/admin/orders/today" />
          <KpiCard label="Pending" value={k.today_pending} icon={Clock} color="amber" href="/admin/orders/today" />
          {/* <KpiCard label="Placed" value={k.today_placed} icon={ShoppingCart} color="amber" href="/admin/orders/today" /> */}
          <KpiCard label="Confirmed" value={k.today_confirmed} icon={CheckCircle2} color="teal" />
          <KpiCard label="Packed" value={k.today_packed} icon={Package} color="indigo" />
          <KpiCard label="Out for Delivery" value={k.today_out_for_delivery} icon={Truck} color="sky" href="/admin/delivery-tracking" />
          <KpiCard label="Delivered" value={k.today_delivered} icon={CheckCircle2} color="green" />
          <KpiCard label="Cancelled" value={k.today_cancelled} icon={AlertTriangle} color="rose" />
          <KpiCard label="Revenue" value={formatMoney(k.today_revenue)} icon={IndianRupee} color="green" sub={`Sub: ${k.today_subscription_orders} | OT: ${k.today_onetime_orders}`} />
        </div>
      </section>

      {/* Main KPIs */}
      <section>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Key Performance Indicators</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="Customers" value={k.total_customers} sub={`+${k.new_customers_7d} this week`} icon={Users} color="blue" href="/admin/customers/allcustomers" />
          <KpiCard label="Active Subscriptions" value={k.active_subscriptions} sub={`${k.paused_subscriptions} paused`} icon={RefreshCw} color="purple" href="/admin/subscriptions/status" />
          <KpiCard label="Revenue (30d)" value={formatMoney(k.revenue_30d)} sub={`7d: ${formatMoney(k.revenue_7d)}`} icon={TrendingUp} color="green" href="/admin/reports/revenue" />
          <KpiCard label="Pending Deliveries" value={k.pending_delivery_count} sub={`${k.active_delivery_partners} partners active`} icon={Truck} color="sky" href="/admin/delivery/assign" />
          <KpiCard label="Wallet Balance" value={formatMoney(k.total_wallet_balance)} sub={`${k.wallets_with_balance} wallets`} icon={Wallet} color="amber" href="/admin/finance/wallet" />
        </div>
      </section>

      {/* Two Column Layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left: Growth + Branch Performance */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {/* 7-Day Growth */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500"><BarChart2 size={16} /></div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">7-Day Growth</h3>
                  <p className="text-[10px] text-slate-400">Orders, customers, subscriptions</p>
                </div>
              </div>
              <Link href="/admin/reports/revenue" className="text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-1">
                View Reports <ArrowRight size={12} />
              </Link>
            </div>
            {displayedGrowth.length > 0 ? (
              <div className="grid grid-cols-7 gap-2">
                {displayedGrowth.map((g, i) => (
                  <div key={i} className="text-center">
                    <div className="h-16 flex items-end justify-center mb-1">
                      <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(8, (g.orders / maxGrowthOrders) * 100)}%` }}
                        transition={{ delay: i * 0.08, duration: 0.5 }}
                        className="w-full max-w-[28px] bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-t-md" />
                    </div>
                    <p className="text-[9px] font-bold text-slate-500">{new Date(g.day).toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                    <p className="text-[10px] font-black text-slate-800">{g.orders}</p>
                    <p className="text-[8px] text-slate-400">+{g.new_customers} cust</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400 text-center py-6">No growth data yet</p>}
          </div>

          {/* Branch Performance */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500"><Building size={16} /></div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Branch Performance (30d)</h3>
                  <p className="text-[10px] text-slate-400">Revenue & delivery rate by branch</p>
                </div>
              </div>
              <Link href="/admin/reports/branch" className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1">
                Full Report <ArrowRight size={12} />
              </Link>
            </div>
            {branches.length > 0 ? (
              <div className="space-y-3">
                {branches.slice(0, 5).map((b, i) => (
                  <div key={b.branch_id} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-800 truncate">{b.branch_name || b.branch_id}</span>
                        <span className="text-xs font-bold text-emerald-600">{formatMoney(b.revenue)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(b.revenue / maxBranchRevenue) * 100}%` }}
                          transition={{ delay: i * 0.1, duration: 0.8 }}
                          className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full" />
                      </div>
                      <div className="flex gap-3 mt-1 text-[9px] text-slate-400">
                        <span>{b.total_orders} orders</span>
                        <span>{b.delivered_orders} delivered</span>
                        <span>{b.unique_customers} customers</span>
                        <span className="text-emerald-500 font-bold">{b.delivery_rate}% rate</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400 text-center py-6">No branch data</p>}
          </div>

          {/* Inventory & Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiCard label="Active Products" value={k.total_variants} icon={Package} color="blue" href="/admin/catalog/variants" />
            <KpiCard label="Low Stock" value={k.low_stock_count} sub={`${k.out_of_stock_count} out of stock`} icon={AlertTriangle} color="rose" href="/admin/inventory/overview" />
            <KpiCard label="Delivery Partners" value={`${k.active_delivery_partners}/${k.total_delivery_partners}`} sub="Active / Total" icon={Truck} color="sky" href="/admin/delivery/partners" />
          </div>
        </div>

        {/* Right Column: Alerts + Quick Links */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Alerts */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Bell size={16} className="text-rose-400" />Alerts</h3>
              {alerts.length > 0 && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-400 animate-ping" /><span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">{alerts.length}</span></div>}
            </div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {alerts.length > 0 ? alerts.map((a, i) => <AlertRow key={i} alert={a} />) : (
                <div className="flex flex-col items-center py-8 text-slate-300">
                  <Shield size={28} className="mb-2 opacity-30" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">All Clear</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Zap size={16} className="text-amber-500" />Quick Actions</h3>
            <div className="space-y-2">
              {[
                { name: "Auto-Assign Deliveries", href: "/admin/delivery/assign", icon: Truck, color: "bg-sky-50 text-sky-600" },
                { name: "Today's Orders", href: "/admin/orders/today", icon: ShoppingCart, color: "bg-blue-50 text-blue-600" },
                { name: "Generate Sub Orders", href: "/admin/subscriptions/generate-orders", icon: RefreshCw, color: "bg-purple-50 text-purple-600" },
                { name: "Revenue Reports", href: "/admin/reports/revenue", icon: TrendingUp, color: "bg-emerald-50 text-emerald-600" },
                { name: "Stock Overview", href: "/admin/inventory/overview", icon: Layers, color: "bg-amber-50 text-amber-600" },
              ].map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-100">
                  <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <item.icon size={14} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">{item.name}</span>
                  <ChevronRight size={14} className="ml-auto text-slate-200 group-hover:text-slate-400" />
                </Link>
              ))}
            </div>
          </div>

          {/* Revenue Sparkline */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-4 shadow-lg text-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Total Revenue</p>
                <p className="text-2xl font-black tracking-tight">{formatMoney(k.total_revenue)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><IndianRupee size={20} /></div>
            </div>
            <MiniBar data={displayedGrowth.map(g => g.revenue)} maxVal={Math.max(...displayedGrowth.map(g => g.revenue), 1)} />
            <div className="flex justify-between mt-2 text-[9px] text-emerald-200 font-bold">
              <span>7d: {formatMoney(k.revenue_7d)}</span>
              <span>30d: {formatMoney(k.revenue_30d)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}