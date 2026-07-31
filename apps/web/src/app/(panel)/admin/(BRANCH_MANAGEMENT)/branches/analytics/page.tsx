// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Executive Branch Analytics with Zero Top Gap, Compact Hub Cards Padding,
//               Executive Table Pagination, Downward Light Tooltips, and Visual Analytics Charts Tab.
//
// ============================================================================

"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/services/api.client";
import {
  BarChart3, RefreshCw, Home, ChevronRight, TrendingUp,
  Users, ShoppingCart, Truck, IndianRupee, Warehouse,
  Percent, Table as TableIcon, LayoutGrid, Building2,
  ExternalLink, Phone, ShieldCheck, UserCheck, PieChart, LineChart,
  ChevronLeft, PackageCheck
} from "lucide-react";
import Link from "next/link";

function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export default function BranchAnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [daysRange, setDaysRange] = useState("30");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "grid" | "charts">("charts");
  const [tablePage, setTablePage] = useState(1);
  const tablePageSize = 10;

  // Tooltip state for popovers
  const [activePartnerPopover, setActivePartnerPopover] = useState<string | null>(null);
  const [activeWarehousePopover, setActiveWarehousePopover] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: daysRange });
      if (selectedBranch) params.append("branch_id", selectedBranch);
      const res = await api.get<any>(`/admin/branch-config/analytics?${params}`);
      if (res.data?.data) setAnalytics(res.data.data);
    } catch { } finally { setLoading(false); }
  }, [daysRange, selectedBranch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    api.get<any>("/admin/zone/branches-list?all=true").then((res) => {
      if (res.data?.data && Array.isArray(res.data.data)) setBranchesList(res.data.data);
      else if (Array.isArray(res.data)) setBranchesList(res.data);
    }).catch(() => { });
  }, []);

  // Compute Combined Fleet & Sales Metrics
  const totalMetrics = useMemo(() => {
    const branches = analytics?.branches || [];
    const totalSales = branches.reduce((sum: number, b: any) => sum + Number(b.total_sales || b.revenue || 0), 0);
    const netProfit = branches.reduce((sum: number, b: any) => sum + Number(b.net_profit || 0), 0);
    const totalOrders = branches.reduce((sum: number, b: any) => sum + Number(b.total_orders || 0), 0);
    const activeDeliveryBoys = branches.reduce((sum: number, b: any) => sum + Number(b.active_partners || 0), 0);
    const totalDeliveryBoys = branches.reduce((sum: number, b: any) => sum + Number(b.total_partners || b.active_partners || 0), 0);
    const totalWarehouses = branches.reduce((sum: number, b: any) => sum + Number(b.warehouses_count || 0), 0);
    const totalItems = branches.reduce((sum: number, b: any) => sum + Number(b.total_items_count || 0), 0);
    const overallMargin = totalSales > 0 ? Math.round((netProfit / totalSales) * 1000) / 10 : 0;

    return {
      totalSales,
      netProfit,
      overallMargin,
      totalOrders,
      activeDeliveryBoys,
      totalDeliveryBoys,
      totalWarehouses,
      totalItems,
      branchCount: branches.length,
    };
  }, [analytics]);

  const maxBranchSales = useMemo(() => {
    const branches = analytics?.branches || [];
    return Math.max(...branches.map((b: any) => Number(b.total_sales || 0)), 1);
  }, [analytics]);

  const paginatedBranches = useMemo(() => {
    const branches = analytics?.branches || [];
    const start = (tablePage - 1) * tablePageSize;
    return branches.slice(start, start + tablePageSize);
  }, [analytics, tablePage]);

  const totalTablePages = useMemo(() => {
    const branches = analytics?.branches || [];
    return Math.max(1, Math.ceil(branches.length / tablePageSize));
  }, [analytics]);

  return (
    <div className="pt-3 md:pt-4 px-4 md:px-6 pb-8 space-y-4 font-sans min-h-screen bg-slate-50/60">
      
      {/* ── Breadcrumb & Top Action Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-4 md:p-5 rounded-2xl border border-gray-200/80 shadow-2xs">
        <div>
          <nav className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100/90 rounded-lg border border-slate-200/70 text-xs text-slate-500 mb-2 font-medium" aria-label="Breadcrumb">
            <Link href="/admin/dashboard" className="inline-flex items-center gap-1 hover:text-emerald-700 transition-colors font-semibold text-slate-600">
              <Home size={13} className="text-emerald-600" /> Dashboard
            </Link>
            <ChevronRight size={13} className="text-slate-400" />
            <span className="text-slate-500 font-medium">Branch Management</span>
            <ChevronRight size={13} className="text-slate-400" />
            <span className="font-bold text-emerald-800">Branch Performance & Analytics</span>
          </nav>

          <div className="mt-1 flex items-center gap-2">
            <BarChart3 size={22} className="text-emerald-600" />
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Branch Performance Analytics</h1>
            <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              {totalMetrics.branchCount} Active Hubs
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 bg-white text-slate-800 text-xs font-bold rounded-xl border border-gray-200 shadow-2xs hover:border-emerald-500 hover:text-emerald-700 transition-colors"
          >
            <RefreshCw size={15} /> Refresh Analytics
          </button>
        </div>
      </div>

      {/* ── Executive Combined Metrics Header Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Branch Sales Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <IndianRupee size={15} className="text-emerald-600" /> Total Branch Sales
            </span>
            <span className="text-[11px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
              Gross Revenue
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 pt-1">{formatMoney(totalMetrics.totalSales)}</p>
          <p className="text-[11px] text-gray-500 font-medium">{totalMetrics.totalOrders} total delivered orders</p>
        </div>

        {/* Estimated Net Profit & Margin */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-teal-800 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <TrendingUp size={15} className="text-teal-600" /> Net Profit & Margin
            </span>
            <span className="text-[11px] bg-teal-50 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200 font-bold">
              {totalMetrics.overallMargin}% Margin
            </span>
          </div>
          <p className="text-2xl font-extrabold text-teal-700 pt-1">{formatMoney(totalMetrics.netProfit)}</p>
          <p className="text-[11px] text-gray-500 font-medium">After product cost & logistics</p>
        </div>

        {/* Active Fleet Delivery Boys */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Truck size={15} className="text-emerald-600" /> Delivery Fleet
            </span>
            <span className="text-[11px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 pt-1">
            {totalMetrics.activeDeliveryBoys} <span className="text-xs text-slate-400 font-normal">/ {totalMetrics.totalDeliveryBoys} drivers</span>
          </p>
          <p className="text-[11px] text-gray-500 font-medium">Delivery personnel across hubs</p>
        </div>

        {/* Warehouses & Stock SKUs */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-sky-800 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Warehouse size={15} className="text-sky-600" /> Hubs & Stock Items
            </span>
            <span className="text-[11px] bg-sky-50 text-sky-800 px-2 py-0.5 rounded-full border border-sky-200 font-bold">
              {totalMetrics.totalWarehouses} Warehouses
            </span>
          </div>
          <p className="text-2xl font-extrabold text-sky-700 pt-1">{totalMetrics.totalItems} <span className="text-xs text-slate-400 font-normal">Stocked SKUs</span></p>
          <p className="text-[11px] text-gray-500 font-medium">Inventory items available</p>
        </div>
      </div>

      {/* ── Enterprise Filter & Controls ── */}
      <div className="bg-white rounded-2xl p-3 border border-gray-200/90 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: View Mode Switcher (Visual Analytics | Executive Table | Hub Cards) */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* View Switcher */}
          <div className="inline-flex h-9 rounded-xl bg-gray-100/90 p-1 border border-gray-200/80 items-center">
            <button
              type="button"
              onClick={() => setViewMode("charts")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded-lg transition-all ${
                viewMode === "charts"
                  ? "bg-white text-emerald-800 shadow-2xs border border-gray-200 font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <BarChart3 size={14} className="text-emerald-600" /> Visual Analytics
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded-lg transition-all ${
                viewMode === "table"
                  ? "bg-white text-emerald-800 shadow-2xs border border-gray-200 font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <TableIcon size={14} /> Executive Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded-lg transition-all ${
                viewMode === "grid"
                  ? "bg-white text-emerald-800 shadow-2xs border border-gray-200 font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <LayoutGrid size={14} /> Hub Cards
            </button>
          </div>

          {/* Days Range Tabs */}
          <div className="inline-flex h-9 rounded-xl bg-gray-100/90 p-1 border border-gray-200/80 items-center">
            {[
              { label: "7 Days", value: "7" },
              { label: "14 Days", value: "14" },
              { label: "30 Days", value: "30" },
              { label: "90 Days", value: "90" },
            ].map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDaysRange(d.value)}
                className={`h-7 px-3 text-xs font-semibold rounded-lg transition-all ${
                  daysRange === d.value
                    ? "bg-emerald-700 text-white shadow-2xs font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Branch Selector Dropdown */}
        {branchesList.length > 0 && (
          <div className="w-full md:w-64">
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full h-9 px-3 bg-gray-50 text-xs font-bold text-gray-800 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">All Branches (Combined Fleet)</option>
              {branchesList.map((b: any) => (
                <option key={b.branch_id || b.id} value={b.branch_id || b.id}>
                  {b.branch_name} {b.city ? `(${b.city})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Main Performance View ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      ) : analytics?.branches?.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 text-slate-400 space-y-2">
          <BarChart3 size={40} className="mx-auto text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No branch analytics data available</p>
          <p className="text-xs text-slate-400">Try selecting a different timeframe or branch.</p>
        </div>
      ) : viewMode === "table" ? (
        /* Executive Branch Performance Table with Downward Light Tooltips & Links */
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs space-y-4">
          <div className="overflow-x-auto min-h-[300px] pb-12">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-700 uppercase text-[10px] font-bold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3.5">Branch & Hub Location</th>
                  <th className="px-4 py-3.5 text-center">Delivery Boys (Hover for Names)</th>
                  <th className="px-4 py-3.5 text-center">Warehouses & SKUs (Hover for Names)</th>
                  <th className="px-4 py-3.5 text-center">Orders & Rate</th>
                  <th className="px-4 py-3.5 text-right">Total Sales</th>
                  <th className="px-4 py-3.5 text-right">Net Profit & Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium">
                {paginatedBranches.map((b: any) => {
                  const partners = b.partners_list || [];
                  const warehouses = b.warehouses_list || [];

                  return (
                    <tr key={b.branch_id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Branch Name & Hub */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 font-extrabold flex items-center justify-center text-xs text-white shadow-2xs">
                            <Building2 size={16} />
                          </div>
                          <div>
                            <Link href={`/admin/branches/${b.branch_id}`} className="font-extrabold text-slate-900 hover:text-emerald-700 transition-colors">
                              {b.branch_name}
                            </Link>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              {b.city || "Hub Region"} {b.state ? `• ${b.state}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Delivery Boys Count with Light Panel Popover (Opens Downward) */}
                      <td className="px-4 py-3.5 text-center relative">
                        <div
                          className="relative inline-block"
                          onMouseEnter={() => setActivePartnerPopover(b.branch_id)}
                          onMouseLeave={() => setActivePartnerPopover(null)}
                        >
                          <Link
                            href="/admin/delivery/partners"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-extrabold hover:bg-emerald-100 hover:border-emerald-300 transition-all cursor-pointer shadow-2xs group"
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{b.active_partners} Active</span>
                            <span className="text-[10px] text-emerald-600 font-normal">/ {b.total_partners}</span>
                            <ExternalLink size={12} className="text-emerald-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                          </Link>

                          {/* Light Panel Hover Tooltip */}
                          {activePartnerPopover === b.branch_id && (
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 p-3.5 bg-white text-slate-900 rounded-xl shadow-2xl z-[999] text-left border border-emerald-200/90 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5">
                              <div className="flex items-center justify-between border-b border-emerald-100 pb-2 mb-2 bg-emerald-50/80 p-2 rounded-lg">
                                <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                                  <Truck size={14} className="text-emerald-600" /> {b.branch_name} Drivers
                                </span>
                                <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                                  {partners.length} assigned
                                </span>
                              </div>

                              {partners.length === 0 ? (
                                <p className="text-xs text-slate-400 italic p-2">No partners assigned</p>
                              ) : (
                                <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                  {partners.map((p: any, idx: number) => (
                                    <li key={p.id || idx} className="text-xs flex items-center justify-between bg-slate-50 hover:bg-emerald-50/70 p-2 rounded-lg border border-slate-100 transition-colors">
                                      <Link
                                        href="/admin/delivery/partners"
                                        className="font-bold text-slate-800 hover:text-emerald-700 flex items-center gap-1.5 transition-colors"
                                      >
                                        <UserCheck size={13} className={p.is_active ? "text-emerald-600" : "text-slate-400"} />
                                        <span>{p.name}</span>
                                      </Link>
                                      {p.phone && (
                                        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 font-mono">
                                          <Phone size={10} className="text-slate-400" /> {p.phone}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}

                              <div className="mt-3 pt-2 border-t border-slate-100 text-center">
                                <Link
                                  href="/admin/delivery/partners"
                                  className="text-xs font-extrabold text-emerald-700 hover:text-emerald-800 flex items-center justify-center gap-1.5 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200/80 transition-colors"
                                >
                                  View Full Fleet Portfolio <ExternalLink size={12} />
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Warehouses Count with Light Panel Popover (Opens Downward) */}
                      <td className="px-4 py-3.5 text-center relative">
                        <div
                          className="relative inline-block"
                          onMouseEnter={() => setActiveWarehousePopover(b.branch_id)}
                          onMouseLeave={() => setActiveWarehousePopover(null)}
                        >
                          <Link
                            href="/admin/warehouse/list"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200/80 text-xs font-extrabold hover:bg-sky-100 hover:border-sky-300 transition-all cursor-pointer shadow-2xs group"
                          >
                            <Warehouse size={13} className="text-sky-600" />
                            <span>{b.warehouses_count} Warehouses</span>
                            <ExternalLink size={12} className="text-sky-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                          </Link>

                          {/* Light Panel Hover Tooltip */}
                          {activeWarehousePopover === b.branch_id && (
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 p-3.5 bg-white text-slate-900 rounded-xl shadow-2xl z-[999] text-left border border-sky-200/90 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5">
                              <div className="flex items-center justify-between border-b border-sky-100 pb-2 mb-2 bg-sky-50/80 p-2 rounded-lg">
                                <span className="font-bold text-xs text-sky-900 flex items-center gap-1.5">
                                  <Warehouse size={14} className="text-sky-600" /> {b.city || b.branch_name} Hubs
                                </span>
                                <span className="text-[11px] bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded-md">
                                  {warehouses.length} active
                                </span>
                              </div>

                              {warehouses.length === 0 ? (
                                <p className="text-xs text-slate-400 italic p-2">Central Storage Hub</p>
                              ) : (
                                <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                  {warehouses.map((w: any, idx: number) => (
                                    <li key={w.id || idx} className="text-xs bg-slate-50 hover:bg-sky-50/70 p-2 rounded-lg border border-slate-100 transition-colors">
                                      <Link
                                        href="/admin/warehouse/list"
                                        className="font-bold text-slate-800 hover:text-sky-700 flex items-center justify-between transition-colors"
                                      >
                                        <span>{w.name}</span>
                                        {w.code && (
                                          <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-mono font-bold">
                                            {w.code}
                                          </span>
                                        )}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              )}

                              <div className="mt-3 pt-2 border-t border-slate-100 text-center">
                                <Link
                                  href="/admin/warehouse/list"
                                  className="text-xs font-extrabold text-sky-700 hover:text-sky-800 flex items-center justify-center gap-1.5 py-1 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200/80 transition-colors"
                                >
                                  View Warehouse Inventory <ExternalLink size={12} />
                                </Link>
                              </div>
                            </div>
                          )}

                          <p className="text-[11px] text-slate-500 font-medium mt-1">
                            {b.total_items_count} Stocked SKUs
                          </p>
                        </div>
                      </td>

                      {/* Orders & Delivery Rate */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="space-y-0.5">
                          <p className="font-extrabold text-slate-900">
                            {b.delivered_orders} / {b.total_orders} Orders
                          </p>
                          <p className={`text-[11px] font-bold ${Number(b.delivery_rate) >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
                            {Number(b.delivery_rate ?? 0).toFixed(1)}% Success Rate
                          </p>
                        </div>
                      </td>

                      {/* Total Sales */}
                      <td className="px-4 py-3.5 text-right">
                        <p className="font-black text-slate-900 text-sm">{formatMoney(b.total_sales || b.revenue)}</p>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">Gross Revenue</p>
                      </td>

                      {/* Net Profit & Margin */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <p className="font-black text-teal-700 text-sm">{formatMoney(b.net_profit)}</p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                            <Percent size={10} />
                            {b.profit_margin}% Margin
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-slate-50/90 border-t border-gray-200/80 rounded-b-2xl text-xs font-medium text-slate-600">
            <div>
              Showing <span className="font-bold text-slate-900">{(tablePage - 1) * tablePageSize + 1}</span> to{" "}
              <span className="font-bold text-slate-900">{Math.min(tablePage * tablePageSize, analytics?.branches?.length || 0)}</span> of{" "}
              <span className="font-bold text-slate-900">{analytics?.branches?.length || 0}</span> branches
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                disabled={tablePage === 1}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors font-semibold"
              >
                <ChevronLeft size={14} /> Previous
              </button>

              <span className="px-3 py-1 bg-white rounded-lg text-slate-800 font-bold border border-gray-200">
                Page {tablePage} of {totalTablePages}
              </span>

              <button
                type="button"
                onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                disabled={tablePage >= totalTablePages}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors font-semibold"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* Executive Spacious Hub Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(analytics?.branches || []).map((b: any) => {
            const partners = b.partners_list || [];
            const warehouses = b.warehouses_list || [];
            const sales = Number(b.total_sales || b.revenue || 0);
            const profit = Number(b.net_profit || 0);

            return (
              <div key={b.branch_id} className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between space-y-5 group">
                <div className="space-y-4">
                  {/* Top Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 font-extrabold flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
                        <Building2 size={22} />
                      </div>
                      <div>
                        <Link href={`/admin/branches/${b.branch_id}`} className="font-extrabold text-slate-900 text-lg hover:text-emerald-700 transition-colors">
                          {b.branch_name}
                        </Link>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {b.city || "Hub Region"} {b.state ? `• ${b.state}` : ""}
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/admin/delivery/partners"
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{b.active_partners} Drivers</span>
                      <ExternalLink size={11} className="text-emerald-600" />
                    </Link>
                  </div>

                  {/* Operational Metrics Badges */}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <Link href="/admin/warehouse/list" className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-100 hover:border-sky-300 transition-all space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Warehouses</span>
                      <p className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                        <Warehouse size={15} className="text-sky-600" />
                        {b.warehouses_count} Warehouses
                      </p>
                    </Link>

                    <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-100 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Stock SKUs</span>
                      <p className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                        <PackageCheck size={15} className="text-emerald-600" />
                        {b.total_items_count} Items
                      </p>
                    </div>
                  </div>
                </div>

                {/* Financial Performance Section */}
                <div className="pt-4 border-t border-slate-100 space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-700">Total Branch Sales</span>
                    <span className="font-black text-slate-900 text-base">{formatMoney(sales)}</span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-teal-50/70 border border-teal-100">
                    <span className="font-bold text-teal-900">Net Profit</span>
                    <div className="text-right flex items-center gap-1.5">
                      <span className="font-black text-teal-800 text-base">{formatMoney(profit)}</span>
                      <span className="text-xs font-extrabold bg-teal-200/80 text-teal-900 px-2 py-0.5 rounded-lg border border-teal-300">
                        {b.profit_margin}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Visual Analytics Tab — Interactive Charts & Comparative Insights */
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Chart Row 1: Branch Sales & Revenue Comparison Bar Chart */}
          <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <BarChart3 size={18} className="text-emerald-600" /> Gross Sales & Net Profit by Branch
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Comparing sales revenue (₹) and estimated profit across hubs</p>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {analytics?.branches?.length || 0} Hubs
              </span>
            </div>

            {/* Custom Dynamic Bar Chart */}
            <div className="space-y-4 pt-2">
              {(analytics?.branches || []).map((b: any) => {
                const sales = Number(b.total_sales || b.revenue || 0);
                const profit = Number(b.net_profit || 0);
                const salesPercent = Math.min(100, Math.max(8, (sales / maxBranchSales) * 100));
                const profitPercent = Math.min(100, Math.max(4, (profit / maxBranchSales) * 100));

                return (
                  <div key={b.branch_id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-900 flex items-center gap-2">
                        <Building2 size={14} className="text-emerald-600" /> {b.branch_name} ({b.city || "Hub"})
                      </span>
                      <div className="flex items-center gap-4 text-xs font-extrabold">
                        <span className="text-slate-900">Sales: {formatMoney(sales)}</span>
                        <span className="text-teal-700">Profit: {formatMoney(profit)} ({b.profit_margin}%)</span>
                      </div>
                    </div>

                    {/* Progress Bar Track */}
                    <div className="space-y-1">
                      {/* Sales Bar */}
                      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-700 shadow-2xs"
                          style={{ width: `${salesPercent}%` }}
                        />
                      </div>
                      {/* Profit Sub-bar */}
                      <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-teal-500 rounded-full transition-all duration-700"
                          style={{ width: `${profitPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart Row 2: Grid of Fleet Allocation & Fulfillment Rate */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Delivery Drivers Allocation Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Truck size={16} className="text-emerald-600" /> Delivery Fleet Distribution
                </h3>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                  {totalMetrics.activeDeliveryBoys} Active Drivers
                </span>
              </div>

              <div className="space-y-3">
                {(analytics?.branches || []).map((b: any) => {
                  const activeDrivers = Number(b.active_partners || 0);
                  const totalDrivers = Number(b.total_partners || activeDrivers);

                  return (
                    <div key={b.branch_id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center">
                          <Truck size={15} />
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900">{b.branch_name}</p>
                          <p className="text-[11px] text-slate-500 font-medium">{b.city || "Hub Region"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href="/admin/delivery/partners"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-200 rounded-lg text-emerald-800 font-bold hover:bg-emerald-50 transition-colors shadow-2xs"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{activeDrivers} / {totalDrivers} Drivers</span>
                          <ExternalLink size={10} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Fulfillment & Delivery Success Percentage */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Percent size={16} className="text-teal-600" /> Order Fulfillment Success Rate
                </h3>
                <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                  {totalMetrics.totalOrders} Orders
                </span>
              </div>

              <div className="space-y-3">
                {(analytics?.branches || []).map((b: any) => {
                  const rate = Number(b.delivery_rate || 0);

                  return (
                    <div key={b.branch_id} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-900">{b.branch_name}</span>
                        <span className={rate >= 80 ? "text-emerald-600" : "text-amber-600"}>
                          {b.delivered_orders} / {b.total_orders} Orders ({rate.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${rate >= 80 ? "bg-emerald-500" : "bg-amber-500"}`}
                          style={{ width: `${Math.min(100, Math.max(5, rate))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Chart Row 3: Daily Revenue & Growth Trend Chart */}
          <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <TrendingUp size={18} className="text-emerald-600" /> Daily Revenue & Order Volume Timeline
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Sales trajectory over the selected {daysRange}-day timeframe</p>
              </div>
            </div>

            {/* Daily Trend Bars */}
            <div className="pt-4 flex items-end justify-between gap-2 h-44 border-b border-slate-200 pb-2 overflow-x-auto">
              {(analytics?.trend || []).length === 0 ? (
                <div className="w-full text-center py-10 text-xs text-slate-400 italic">No daily trend data</div>
              ) : (
                (analytics?.trend || []).map((t: any, idx: number) => {
                  const rev = Number(t.revenue || 0);
                  const maxRev = Math.max(...(analytics.trend.map((item: any) => Number(item.revenue || 0))), 1);
                  const barHeight = Math.min(100, Math.max(12, (rev / maxRev) * 100));

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group min-w-[28px]">
                      <div className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        ₹{rev}
                      </div>
                      <div className="w-full bg-slate-100 rounded-t-lg h-32 flex items-end">
                        <div
                          className="w-full bg-gradient-to-t from-emerald-600 to-teal-500 rounded-t-lg transition-all duration-500 group-hover:from-emerald-500 group-hover:to-teal-400"
                          style={{ height: `${barHeight}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 truncate w-full text-center">
                        {String(t.day || "").split("-").slice(1).join("/")}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
