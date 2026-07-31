"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { Activity, TrendingUp, Users, RefreshCw, Truck, Wallet, ChevronRight, Home, ShoppingCart, IndianRupee, BarChart3 } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

function formatMoney(v: number) { return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/analytics/consolidated?days=7");
      if (res.data?.data) setData(res.data.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (loading || !data) return <div className="flex justify-center py-24"><div className="w-10 h-10 border-3 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" /></div>;

  const revenue = data.revenue || { daily: [], totals: {} };
  const wallet = data.wallet || {};
  const customerGrowth = data.customerGrowth || [];
  const subscriptionGrowth = data.subscriptionGrowth || [];
  const delivery = data.delivery || {};
  const maxRev = Math.max(...(revenue.daily || []).map((d: any) => d.revenue), 1);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" /><span className="font-semibold text-slate-800">Analytics Dashboard</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Activity size={24} className="text-indigo-500" /> Consolidated Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">7-day snapshot of all key metrics</p>
        </div>
        <button onClick={fetch_} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 flex items-center gap-2"><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg">
          <IndianRupee size={20} className="mb-2 text-emerald-200" />
          <p className="text-[10px] font-bold uppercase text-emerald-200">7d Revenue</p>
          <p className="text-2xl font-black">{formatMoney(revenue.totals?.total_revenue ?? 0)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <ShoppingCart size={20} className="mb-2 text-blue-400" />
          <p className="text-[10px] font-bold uppercase text-slate-400">7d Orders</p>
          <p className="text-2xl font-black text-slate-900">{revenue.totals?.total_orders ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <Wallet size={20} className="mb-2 text-amber-400" />
          <p className="text-[10px] font-bold uppercase text-slate-400">Wallet Balance</p>
          <p className="text-2xl font-black text-slate-900">{formatMoney(Number(wallet.total_balance ?? 0))}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <Truck size={20} className="mb-2 text-sky-400" />
          <p className="text-[10px] font-bold uppercase text-slate-400">Delivery Rate</p>
          <p className="text-2xl font-black text-slate-900">{delivery.success_rate ?? 0}%</p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Revenue Trend (7 days)</h3>
        <div className="flex items-end gap-2 h-32">
          {(revenue.daily || []).map((d: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <motion.div initial={{ height: 0 }} animate={{ height: `${(d.revenue / maxRev) * 100}%` }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
                className="w-full max-w-[32px] bg-gradient-to-t from-emerald-500 to-emerald-300 rounded-t-md" />
              <p className="text-[9px] text-slate-400 mt-1">{new Date(d.day).toLocaleDateString('en-IN', { weekday: 'short' })}</p>
              <p className="text-[10px] font-bold text-slate-600">{formatMoney(d.revenue)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column: Customer Growth + Delivery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Users size={16} className="text-blue-500" /> Customer Growth</h3>
          <div className="space-y-2">
            {customerGrowth.slice(-7).map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400 w-16">{new Date(d.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full" style={{ width: `${Math.max(4, (d.new_customers / Math.max(...customerGrowth.map((c: any) => c.new_customers), 1)) * 100)}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-700 w-8 text-right">+{d.new_customers}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Truck size={16} className="text-sky-500" /> Delivery Efficiency</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-emerald-50 rounded-xl"><p className="text-2xl font-black text-emerald-700">{delivery.successful ?? 0}</p><p className="text-[10px] text-emerald-500 font-bold">Successful</p></div>
            <div className="text-center p-3 bg-rose-50 rounded-xl"><p className="text-2xl font-black text-rose-700">{delivery.failed ?? 0}</p><p className="text-[10px] text-rose-500 font-bold">Failed</p></div>
            <div className="text-center p-3 bg-blue-50 rounded-xl"><p className="text-2xl font-black text-blue-700">{delivery.partners_active ?? 0}</p><p className="text-[10px] text-blue-500 font-bold">Partners Active</p></div>
            <div className="text-center p-3 bg-amber-50 rounded-xl"><p className="text-2xl font-black text-amber-700">{delivery.avg_per_partner ?? 0}</p><p className="text-[10px] text-amber-500 font-bold">Avg/Partner</p></div>
          </div>
        </div>
      </div>

      {/* Quick Links to Detailed Reports */}
      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Detailed Reports</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { name: "Revenue", href: "/admin/reports/revenue", icon: TrendingUp, color: "text-emerald-500 bg-emerald-50" },
            { name: "Subscriptions", href: "/admin/reports/subscription", icon: RefreshCw, color: "text-purple-500 bg-purple-50" },
            { name: "Branch P&L", href: "/admin/reports/branch", icon: BarChart3, color: "text-indigo-500 bg-indigo-50" },
            { name: "Customer Growth", href: "/admin/reports/customer-growth", icon: Users, color: "text-blue-500 bg-blue-50" },
            { name: "Products", href: "/admin/reports/products", icon: ShoppingCart, color: "text-amber-500 bg-amber-50" },
            { name: "Delivery", href: "/admin/reports/delivery", icon: Truck, color: "text-sky-500 bg-sky-50" },
          ].map(r => (
            <Link key={r.href} href={r.href} className="flex flex-col items-center p-3 rounded-xl hover:bg-white transition-colors group border border-transparent hover:border-slate-200">
              <div className={`w-10 h-10 rounded-xl ${r.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}><r.icon size={18} /></div>
              <span className="text-[11px] font-semibold text-slate-600">{r.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
