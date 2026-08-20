// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Revenue & payments report — branch-wise, payment-type-wise,
//               subscription vs one-time, and billing collection status.
//
// ============================================================================

"use client";

import { getApiBaseUrl } from "@/lib/api-config";
import { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  TrendingUp, Download, RefreshCw, ChevronRight, Home, IndianRupee, ShoppingCart,
  Building2, CreditCard, Repeat, AlertTriangle, FileSpreadsheet, FileText, Wallet, X,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Totals {
  gross_revenue: number; collected: number; outstanding: number; discounts: number;
  tax: number; orders: number; customers: number; subscription_revenue: number;
  onetime_revenue: number; subscription_orders: number; onetime_orders: number;
  avg_order_value: number; collection_rate: number;
}
interface BranchRow {
  branch_id: string | null; branch_name: string; orders: number; customers: number;
  revenue: number; collected: number; outstanding: number;
  subscription_revenue: number; onetime_revenue: number; share_pct: number;
}
interface ModeRow {
  payment_mode: string; orders: number; revenue: number;
  collected: number; outstanding: number; share_pct: number;
}
interface SourceRow {
  source: string; orders: number; customers: number; revenue: number;
  collected: number; avg_order_value: number; share_pct: number;
}
interface BillRow {
  payment_type: string; bill_type: string; bills: number;
  billed: number; paid: number; due: number;
}
interface DailyRow {
  day: string; orders: number; revenue: number; collected: number;
  subscription_revenue: number; onetime_revenue: number;
}
interface RevenueReport {
  range: { from: string; to: string };
  totals: Totals;
  daily: DailyRow[];
  by_branch: BranchRow[];
  by_payment_mode: ModeRow[];
  by_source: SourceRow[];
  billing: {
    by_payment_type: BillRow[];
    collection: {
      settled_bills: number; settled_amount: number;
      due_bills: number; due_amount: number;
      overdue_bills: number; overdue_amount: number;
    };
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const money = (v: number) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const pct = (v: number) => `${Number(v ?? 0).toFixed(1)}%`;
const shortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const titleise = (s: string) =>
  (s || "").replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const isoDaysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const MODE_TONE: Record<string, string> = {
  wallet: "bg-violet-50 text-violet-700 border-violet-100",
  cod: "bg-amber-50 text-amber-700 border-amber-100",
  cash: "bg-amber-50 text-amber-700 border-amber-100",
  upi: "bg-sky-50 text-sky-700 border-sky-100",
  prepaid: "bg-emerald-50 text-emerald-700 border-emerald-100",
  postpaid: "bg-rose-50 text-rose-700 border-rose-100",
  unspecified: "bg-slate-50 text-slate-500 border-slate-200",
};
const toneFor = (m: string) => MODE_TONE[m?.toLowerCase()] ?? "bg-slate-50 text-slate-600 border-slate-200";

// ─── Small building blocks ──────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, accent = false, tone = "text-slate-900",
}: {
  label: string; value: string; sub?: string; icon: any; accent?: boolean; tone?: string;
}) {
  if (accent) {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Icon size={18} />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">{label}</span>
        </div>
        <p className="text-3xl font-black">{value}</p>
        {sub && <p className="text-[11px] text-emerald-100/90 mt-1 font-medium">{sub}</p>}
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className="text-slate-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <p className={`text-3xl font-black ${tone}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1 font-medium">{sub}</p>}
    </div>
  );
}

/** Horizontal share bar used by the breakdown tables. */
function ShareBar({ value, tone = "bg-emerald-500" }: { value: number; tone?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${tone} rounded-full`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="text-[11px] font-bold text-slate-400 w-11 text-right">{pct(value)}</span>
    </div>
  );
}

function Section({
  title, desc, icon: Icon, children,
}: { title: string; desc?: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/40 flex items-center gap-2.5">
        <div className="p-2 bg-white rounded-xl border border-slate-100 text-emerald-600">
          <Icon size={15} />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-800">{title}</h3>
          {desc && <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-sm font-semibold text-slate-300">
        {label}
      </td>
    </tr>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const [from, setFrom] = useState(() => isoDaysAgo(29));
  const [to, setTo] = useState(() => isoDaysAgo(0));
  const [branchId, setBranchId] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [orderSource, setOrderSource] = useState("");

  const [branches, setBranches] = useState<any[]>([]);
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  useEffect(() => {
    api.get<any>("/admin/zone/branches-list")
      .then((res) => { if (Array.isArray(res.data?.data)) setBranches(res.data.data); })
      .catch(() => {});
  }, []);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = { from, to };
    if (branchId) p.branch_id = branchId;
    if (paymentMode) p.payment_mode = paymentMode;
    if (orderSource) p.order_source = orderSource;
    return p;
  }, [from, to, branchId, paymentMode, orderSource]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/analytics/revenue/report", { params: queryParams });
      if (res.data?.data) setReport(res.data.data as RevenueReport);
    } catch {
      /* surface as empty state */
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => { load(); }, [load]);

  const download = async (format: "csv" | "pdf") => {
    setExporting(format);
    try {
      const qs = new URLSearchParams(queryParams).toString();
      const res = await fetch(
        `${getApiBaseUrl()}/admin/analytics/revenue/report/export/${format}?${qs}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `revenue-report-${from}-to-${to}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const applyPreset = (days: number) => { setFrom(isoDaysAgo(days - 1)); setTo(isoDaysAgo(0)); };
  const activePreset = (days: number) => from === isoDaysAgo(days - 1) && to === isoDaysAgo(0);
  const hasFilters = Boolean(branchId || paymentMode || orderSource);

  const totals = report?.totals;
  const daily = report?.daily ?? [];
  const maxRev = Math.max(...daily.map((d) => d.revenue), 1);
  const collection = report?.billing?.collection;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600">
          <Home size={14} /> Dashboard
        </Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-400">Reports</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Revenue &amp; Payments</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <TrendingUp size={24} className="text-emerald-500" /> Revenue &amp; Payments
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Branch-wise, payment-type-wise, and subscription vs one-time collections
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => download("csv")} disabled={exporting !== null}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50">
            <FileSpreadsheet size={14} className={exporting === "csv" ? "animate-bounce" : ""} />
            {exporting === "csv" ? "Exporting…" : "Export CSV"}
          </button>
          <button onClick={() => download("pdf")} disabled={exporting !== null}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 disabled:opacity-50">
            <FileText size={14} className={exporting === "pdf" ? "animate-bounce" : ""} />
            {exporting === "pdf" ? "Exporting…" : "Export PDF"}
          </button>
          <button onClick={load} title="Refresh"
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
        <div className="flex bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => applyPreset(d)}
              className={`px-3 py-2 text-xs font-bold transition-colors ${
                activePreset(d) ? "bg-emerald-500 text-white" : "text-slate-600 hover:bg-white"
              }`}>{d}d</button>
          ))}
        </div>

        <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-emerald-400" />
        <span className="text-xs text-slate-400 font-bold">to</span>
        <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-emerald-400" />

        <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white outline-none focus:border-emerald-400">
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
          ))}
        </select>

        <select value={orderSource} onChange={(e) => setOrderSource(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white outline-none focus:border-emerald-400">
          <option value="">Subscription + One-time</option>
          <option value="subscription">Subscription only</option>
          <option value="one-time">One-time only</option>
        </select>

        <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white outline-none focus:border-emerald-400">
          <option value="">All Payment Types</option>
          {(report?.by_payment_mode ?? []).map((m) => (
            <option key={m.payment_mode} value={m.payment_mode}>{titleise(m.payment_mode)}</option>
          ))}
        </select>

        {hasFilters && (
          <button onClick={() => { setBranchId(""); setPaymentMode(""); setOrderSource(""); }}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard accent label="Gross Revenue" icon={IndianRupee}
          value={money(totals?.gross_revenue ?? 0)}
          sub={`${totals?.orders ?? 0} orders · ${totals?.customers ?? 0} customers`} />
        <StatCard label="Collected" icon={Wallet} tone="text-emerald-600"
          value={money(totals?.collected ?? 0)}
          sub={`${pct(totals?.collection_rate ?? 0)} of gross`} />
        <StatCard label="Outstanding" icon={AlertTriangle}
          tone={(totals?.outstanding ?? 0) > 0 ? "text-rose-600" : "text-slate-900"}
          value={money(totals?.outstanding ?? 0)}
          sub={collection ? `${collection.overdue_bills} bills overdue` : undefined} />
        <StatCard label="Avg Order Value" icon={ShoppingCart}
          value={money(totals?.avg_order_value ?? 0)}
          sub={`Discounts ${money(totals?.discounts ?? 0)}`} />
      </div>

      {/* Subscription vs one-time */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Section title="Daily Revenue Trend" desc="Subscription and one-time revenue per day" icon={TrendingUp}>
            <div className="p-5">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : daily.length ? (
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-1 min-w-[600px] h-48 px-2">
                    {daily.map((d, i) => (
                      <div key={d.day} className="flex-1 flex flex-col items-center group">
                        <div className="w-full flex items-end justify-center h-40">
                          <motion.div initial={{ height: 0 }} animate={{ height: `${(d.revenue / maxRev) * 100}%` }}
                            transition={{ delay: i * 0.02, duration: 0.4 }}
                            className="w-full max-w-[24px] rounded-t-md relative bg-gradient-to-t from-emerald-500 to-emerald-300 hover:from-emerald-600 hover:to-emerald-400 transition-colors cursor-pointer">
                            <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold z-10 text-left leading-relaxed">
                              <div>{money(d.revenue)}</div>
                              <div className="text-emerald-200">Sub {money(d.subscription_revenue)}</div>
                              <div className="text-amber-200">One-time {money(d.onetime_revenue)}</div>
                            </div>
                          </motion.div>
                        </div>
                        <p className="text-[8px] text-slate-400 mt-1 truncate w-full text-center">{shortDate(d.day)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-slate-400 py-12">No revenue in this period</p>
              )}
            </div>
          </Section>
        </div>

        <Section title="Subscription vs One-time" desc="Where the revenue comes from" icon={Repeat}>
          <div className="p-5 space-y-4">
            {(report?.by_source ?? []).length === 0 && !loading && (
              <p className="text-center text-sm text-slate-300 py-8 font-semibold">No data</p>
            )}
            {(report?.by_source ?? []).map((s) => (
              <div key={s.source} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700">{titleise(s.source)}</span>
                  <span className="text-sm font-black text-slate-900">{money(s.revenue)}</span>
                </div>
                <ShareBar value={s.share_pct} tone={s.source === "subscription" ? "bg-violet-500" : "bg-amber-500"} />
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>{s.orders} orders · {s.customers} customers</span>
                  <span>AOV {money(s.avg_order_value)}</span>
                </div>
              </div>
            ))}

            {collection && (
              <div className="pt-4 mt-2 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bill Collection</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Settled</span>
                  <span className="font-black text-emerald-600">{money(collection.settled_amount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Due</span>
                  <span className="font-black text-amber-600">{money(collection.due_amount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Overdue</span>
                  <span className="font-black text-rose-600">{money(collection.overdue_amount)}</span>
                </div>
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Branch-wise */}
      <Section title="Branch-wise Revenue" desc="Collections and outstanding per branch" icon={Building2}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Branch</th>
                <th className="px-4 py-3 text-right">Orders</th>
                <th className="px-4 py-3 text-right">Customers</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Collected</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-right">Subscription</th>
                <th className="px-4 py-3 text-right">One-time</th>
                <th className="px-4 py-3 text-left">Share</th>
              </tr>
            </thead>
            <tbody>
              {(report?.by_branch ?? []).length === 0 ? (
                <EmptyRow colSpan={9} label={loading ? "Loading…" : "No revenue in this period"} />
              ) : (
                report!.by_branch.map((b) => (
                  <tr key={b.branch_id ?? b.branch_name} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-800">{b.branch_name}</td>
                    <td className="px-4 py-3 text-right">{b.orders}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{b.customers}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">{money(b.revenue)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{money(b.collected)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${b.outstanding > 0 ? "text-rose-600" : "text-slate-300"}`}>
                      {money(b.outstanding)}
                    </td>
                    <td className="px-4 py-3 text-right text-violet-600">{money(b.subscription_revenue)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{money(b.onetime_revenue)}</td>
                    <td className="px-4 py-3"><ShareBar value={b.share_pct} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Payment type + billing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Payment Type Wise" desc="How customers actually paid" icon={CreditCard}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Mode</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-left">Share</th>
                </tr>
              </thead>
              <tbody>
                {(report?.by_payment_mode ?? []).length === 0 ? (
                  <EmptyRow colSpan={5} label={loading ? "Loading…" : "No payments in this period"} />
                ) : (
                  report!.by_payment_mode.map((m) => (
                    <tr key={m.payment_mode} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg border text-[11px] font-black ${toneFor(m.payment_mode)}`}>
                          {titleise(m.payment_mode)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{m.orders}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">{money(m.revenue)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${m.outstanding > 0 ? "text-rose-600" : "text-slate-300"}`}>
                        {money(m.outstanding)}
                      </td>
                      <td className="px-4 py-3"><ShareBar value={m.share_pct} tone="bg-sky-500" /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Billing — Prepaid vs Postpaid" desc="Raised against customer bills in this period" icon={FileText}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Payment Type</th>
                  <th className="px-4 py-3 text-left">Bill Type</th>
                  <th className="px-4 py-3 text-right">Bills</th>
                  <th className="px-4 py-3 text-right">Billed</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {(report?.billing?.by_payment_type ?? []).length === 0 ? (
                  <EmptyRow colSpan={6} label={loading ? "Loading…" : "No bills in this period"} />
                ) : (
                  report!.billing.by_payment_type.map((b) => (
                    <tr key={`${b.payment_type}-${b.bill_type}`} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg border text-[11px] font-black ${toneFor(b.payment_type)}`}>
                          {titleise(b.payment_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-semibold">{titleise(b.bill_type)}</td>
                      <td className="px-4 py-3 text-right">{b.bills}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">{money(b.billed)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">{money(b.paid)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${b.due > 0 ? "text-rose-600" : "text-slate-300"}`}>
                        {money(b.due)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {/* Daily detail */}
      <Section title="Daily Breakdown" desc="Every day in the selected period" icon={ShoppingCart}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Orders</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Collected</th>
                <th className="px-4 py-3 text-right">Subscription</th>
                <th className="px-4 py-3 text-right">One-time</th>
              </tr>
            </thead>
            <tbody>
              {daily.length === 0 ? (
                <EmptyRow colSpan={6} label={loading ? "Loading…" : "No revenue in this period"} />
              ) : (
                daily.map((d) => (
                  <tr key={d.day} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {new Date(d.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">{d.orders}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">{money(d.revenue)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{money(d.collected)}</td>
                    <td className="px-4 py-3 text-right text-violet-600">{money(d.subscription_revenue)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{money(d.onetime_revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
