"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { Wallet, ChevronRight, Home, RefreshCw, IndianRupee, Users, TrendingUp } from "lucide-react";
import Link from "next/link";
import TableComponents from "@/components/Table Generator/TableComponents";

function formatMoney(v: number) { return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 }); }

export default function WalletReportPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/analytics/wallet");
      if (res.data?.data) setData(res.data.data);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (loading || !data) return <div className="flex justify-center py-24"><div className="w-8 h-8 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" /><span className="text-gray-400">Finance</span>
        <ChevronRight size={14} className="text-gray-300" /><span className="font-semibold text-slate-800">Wallet Transactions</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Wallet size={24} className="text-amber-500" /> Wallet Transactions & Report</h1>
        <button onClick={fetch_} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 flex items-center gap-2"><RefreshCw size={14} /> Refresh Stats</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg col-span-1 sm:col-span-2 lg:col-span-1">
          <IndianRupee size={20} className="mb-2 text-amber-200" />
          <p className="text-[10px] font-bold uppercase text-amber-200">Total Balance</p>
          <p className="text-2xl font-black">{formatMoney(Number(data.total_balance ?? 0))}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <Users size={20} className="mb-2 text-blue-400" />
          <p className="text-[10px] font-bold uppercase text-slate-400">Total Wallets</p>
          <p className="text-2xl font-black text-slate-900">{data.total_wallets ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <Wallet size={20} className="mb-2 text-emerald-400" />
          <p className="text-[10px] font-bold uppercase text-slate-400">Active Wallets</p>
          <p className="text-2xl font-black text-slate-900">{data.active_wallets ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <TrendingUp size={20} className="mb-2 text-indigo-400" />
          <p className="text-[10px] font-bold uppercase text-slate-400">Avg Balance</p>
          <p className="text-2xl font-black text-slate-900">{formatMoney(Number(data.avg_balance ?? 0))}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <IndianRupee size={20} className="mb-2 text-rose-400" />
          <p className="text-[10px] font-bold uppercase text-slate-400">Max Balance</p>
          <p className="text-2xl font-black text-slate-900">{formatMoney(Number(data.max_balance ?? 0))}</p>
        </div>
      </div>

      <div className="pt-2">
        <TableComponents
          title=""
          apiBase="/admin/customer/wallets"
          actionTypes={["view"]}
        />
      </div>
    </div>
  );
}
