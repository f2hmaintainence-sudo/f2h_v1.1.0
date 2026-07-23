// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Payments and Billing reports page matching F2H theme
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { CreditCard, ChevronRight, Home, RefreshCw, FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";

function formatMoney(v: number) {
  return "₹" + (v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function PaymentsPage() {
  const [data, setData] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>(`/admin/analytics/payments?days=${days}`);
      if (res.data?.data) setData(res.data.data);
    } catch { } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const totalCollected = data
    .filter((d: any) => d.payment_status === "paid")
    .reduce((acc: number, curr: any) => acc + Number(curr.total_amount || 0), 0);

  const totalPending = data
    .filter((d: any) => d.payment_status === "pending")
    .reduce((acc: number, curr: any) => acc + Number(curr.total_amount || 0), 0);

  const totalTransactions = data.reduce((acc: number, curr: any) => acc + Number(curr.count || 0), 0);

  return (
    <div className="space-y-6 p-4 md:p-6 animate-in fade-in duration-300">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-[#16a34a] transition-colors">
          <Home size={13} /> Dashboard
        </Link>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="text-slate-500 font-medium">Finance &amp; Reports</span>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="font-semibold text-slate-800">Payments &amp; Billing</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/60 shadow-xs shrink-0">
            <CreditCard size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Payments &amp; Billing Overview</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive report of payment gateway modes, customer billing invoices, and collection statuses.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  days === d
                    ? "bg-[#16a34a] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <button
            onClick={fetch_}
            disabled={loading}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-all shrink-0"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[#16a34a]" : "text-slate-500"} />
          </button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Paid &amp; Billed</p>
            <h3 className="text-lg font-bold text-[#16a34a]">{formatMoney(totalCollected)}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Pending Billing / COD</p>
            <h3 className="text-lg font-bold text-amber-600">{formatMoney(totalPending)}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Billed Transactions</p>
            <h3 className="text-lg font-bold text-slate-800">{totalTransactions}</h3>
          </div>
        </div>
      </div>

      {/* Payments & Billing Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100">
          <div className="w-10 h-10 border-4 border-emerald-100 border-t-[#16a34a] rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading payment &amp; billing analytics...</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CreditCard size={16} className="text-[#16a34a]" /> Payment Modes &amp; Billing Status
            </h3>
            <span className="text-xs text-slate-500 font-medium">Last {days} days</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/40 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[11px]">
                  <th className="px-6 py-3.5 text-left font-bold">Payment Mode</th>
                  <th className="px-6 py-3.5 text-left font-bold">Billing Status</th>
                  <th className="px-6 py-3.5 text-right font-bold">Invoice Count</th>
                  <th className="px-6 py-3.5 text-right font-bold">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((d: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800 capitalize">
                      {d.payment_mode || "Online / Gateway"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          d.payment_status === "paid"
                            ? "bg-emerald-50 text-[#16a34a] border border-emerald-100"
                            : d.payment_status === "pending"
                            ? "bg-amber-50 text-amber-700 border border-amber-100"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {d.payment_status || "Pending"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-700">{d.count} invoices</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                      {formatMoney(Number(d.total_amount || 0))}
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-xs text-slate-400 font-medium">
                      No payment or billing records found for this timeframe.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
