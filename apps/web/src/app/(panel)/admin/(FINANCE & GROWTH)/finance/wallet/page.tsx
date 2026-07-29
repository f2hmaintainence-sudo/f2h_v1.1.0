// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Executive Customer Wallet Transactions & Ledger Command Center
//               Zero top gap, crisp padding & live wallet table API
//
// ============================================================================

"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/services/api.client";
import {
  Wallet, ChevronRight, Home, RefreshCw, IndianRupee, Users, TrendingUp,
  CreditCard, CheckCircle2
} from "lucide-react";
import Link from "next/link";
import SkeletonTable from "@/components/Table Generator/SkeletonTable";

function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

export default function WalletReportPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "positive" | "zero" | "frozen">("all");
  const [tableKey, setTableKey] = useState(0);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/analytics/wallet");
      if (res.data?.data) setData(res.data.data);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (activeFilter === "positive") params.set("wallet", "positive");
    if (activeFilter === "zero") params.set("wallet", "zero");
    if (activeFilter === "frozen") params.set("frozen", "true");
    const str = params.toString();
    return `/admin/customer/wallets/table${str ? `?${str}` : ""}`;
  }, [activeFilter]);

  return (
    <div className="pt-3 md:pt-4 px-4 md:px-6 pb-8 space-y-4 font-sans min-h-screen bg-slate-50/60">
      
      {/* ── Breadcrumb & Action Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-4 md:p-5 rounded-2xl border border-gray-200/80 shadow-2xs">
        <div>
          <nav className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100/90 rounded-lg border border-slate-200/70 text-xs text-slate-500 mb-2 font-medium" aria-label="Breadcrumb">
            <Link href="/admin/dashboard" className="inline-flex items-center gap-1 hover:text-emerald-700 transition-colors font-semibold text-slate-600">
              <Home size={13} className="text-emerald-600" /> Dashboard
            </Link>
            <ChevronRight size={13} className="text-slate-400" />
            <span className="text-slate-500 font-medium">Finance & Reports</span>
            <ChevronRight size={13} className="text-slate-400" />
            <span className="font-bold text-amber-800">Customer Wallet Transactions</span>
          </nav>

          <div className="mt-1 flex items-center gap-2">
            <Wallet size={22} className="text-amber-500" />
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Customer Wallet Transactions & Ledger</h1>
            <span className="bg-amber-50 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
              Prepaid Ledger
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => { fetchStats(); setTableKey((k) => k + 1); }}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 bg-white text-slate-800 text-xs font-bold rounded-xl border border-gray-200 shadow-2xs hover:border-amber-500 hover:text-amber-700 transition-colors"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh Ledger
          </button>
        </div>
      </div>

      {/* ── Executive Wallet KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Wallet Balance */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-4 text-white shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-100">
            <span className="flex items-center gap-1.5">
              <IndianRupee size={15} /> Total Balance
            </span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-extrabold">
              System Wide
            </span>
          </div>
          <p className="text-2xl font-black pt-1">{formatMoney(data?.total_balance ?? 0)}</p>
          <p className="text-[11px] text-amber-100 font-medium">Customer funds on deposit</p>
        </div>

        {/* Total Registered Wallets */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Users size={15} className="text-blue-500" /> Total Wallets
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 pt-1">{data?.total_wallets ?? 0}</p>
          <p className="text-[11px] text-gray-500 font-medium">Registered customer accounts</p>
        </div>

        {/* Active Wallets (>₹0) */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-600" /> Active Wallets
            </span>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
              {data?.active_wallets ?? 0} Funded
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 pt-1">{data?.active_wallets ?? 0}</p>
          <p className="text-[11px] text-gray-500 font-medium">Wallets with balance &gt; ₹0</p>
        </div>

        {/* Average Balance */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-800 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <TrendingUp size={15} className="text-indigo-600" /> Avg Balance
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 pt-1">{formatMoney(data?.avg_balance ?? 0)}</p>
          <p className="text-[11px] text-gray-500 font-medium">Average funds per customer</p>
        </div>

        {/* Max Balance */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-teal-800 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <CreditCard size={15} className="text-teal-600" /> Peak Balance
            </span>
          </div>
          <p className="text-2xl font-extrabold text-teal-700 pt-1">{formatMoney(data?.max_balance ?? 0)}</p>
          <p className="text-[11px] text-gray-500 font-medium">Highest individual balance</p>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="bg-white rounded-2xl p-3 border border-gray-200/90 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200/80">
          {[
            { id: "all", label: "All Customer Wallets" },
            { id: "positive", label: "Positive Balance (>₹0)" },
            { id: "zero", label: "Zero Balance (₹0)" },
            { id: "frozen", label: "Frozen Wallets" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as any)}
              className={`h-7 px-3 text-xs font-semibold rounded-lg transition-all ${
                activeFilter === tab.id
                  ? "bg-white text-slate-900 shadow-2xs font-bold border border-gray-200"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing real-time prepaid customer wallet ledger
        </div>
      </div>

      {/* ── Executive Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden p-2">
        <SkeletonTable
          key={`wallet-${activeFilter}-${tableKey}`}
          apiEndpoint={endpoint}
          onAction={(type, row) => {
            if (type === "view") {
              const custId = row.customer_id || row.id;
              window.location.href = `/admin/customers/${custId}`;
            }
          }}
          actionTypes={["view"]}
          initialPageSize={20}
        />
      </div>

    </div>
  );
}
