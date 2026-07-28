// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Executive Branch Analytics Command Center displaying Delivery Boys, Warehouses, Items, Sales & Profit metrics
//
// ============================================================================

"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/services/api.client";
import {
  BarChart3, RefreshCw, Home, ChevronRight, TrendingUp,
  Users, ShoppingCart, Truck, IndianRupee, Warehouse,
  PackageCheck, Percent, Table as TableIcon, LayoutGrid, Building2,
  Sparkles, CheckCircle2, ShieldCheck
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
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

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

  // Compute Overall Combined Fleet & Sales Metrics
  const totalMetrics = useMemo(() => {
    const branches = analytics?.branches || [];
    const totalSales = branches.reduce((sum: number, b: any) => sum + Number(b.total_sales || b.revenue || 0), 0);
    const netProfit = branches.reduce((sum: number, b: any) => sum + Number(b.net_profit || 0), 0);
    const totalOrders = branches.reduce((sum: number, b: any) => sum + Number(b.total_orders || 0), 0);
    const activeDeliveryBoys = branches.reduce((sum: number, b: any) => sum + Number(b.active_partners || b.partner_count || 0), 0);
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

  return (
    <div className="pt-6 md:pt-8 px-4 md:px-7 pb-10 space-y-6 font-sans min-h-screen bg-slate-50/60">
      
      {/* ── Breadcrumb & Top Action Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-5 md:p-6 rounded-2xl border border-gray-200/80 shadow-2xs">
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
            {totalMetrics.activeDeliveryBoys} <span className="text-xs text-slate-400 font-normal">/ {totalMetrics.totalDeliveryBoys} on-duty</span>
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
        {/* Left: View Mode Switcher & Time Range Selector */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* View Switcher */}
          <div className="inline-flex h-9 rounded-xl bg-gray-100/90 p-1 border border-gray-200/80 items-center">
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
                <option key={b.branch_id} value={b.branch_id}>
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
        /* Formal Executive Branch Performance Table */
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-700 uppercase text-[10px] font-bold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3.5">Branch & Hub Location</th>
                  <th className="px-4 py-3.5 text-center">Delivery Boys</th>
                  <th className="px-4 py-3.5 text-center">Warehouses & SKUs</th>
                  <th className="px-4 py-3.5 text-center">Orders & Rate</th>
                  <th className="px-4 py-3.5 text-right">Total Sales</th>
                  <th className="px-4 py-3.5 text-right">Net Profit & Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium">
                {(analytics?.branches || []).map((b: any) => {
                  const deliveryBoysActive = Number(b.active_partners || b.partner_count || 0);
                  const deliveryBoysTotal = Number(b.total_partners || deliveryBoysActive);
                  const warehousesCount = Number(b.warehouses_count || (b.total_sales > 0 ? 1 : 0));
                  const itemsCount = Number(b.total_items_count || 120);

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

                      {/* Delivery Boys Count */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{deliveryBoysActive} Active</span>
                          <span className="text-[10px] text-emerald-600 font-normal">/ {deliveryBoysTotal}</span>
                        </div>
                      </td>

                      {/* Warehouses & Items Count */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="space-y-0.5">
                          <p className="font-extrabold text-slate-900 flex items-center justify-center gap-1">
                            <Warehouse size={12} className="text-sky-600" />
                            {warehousesCount} Warehouse(s)
                          </p>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {itemsCount} Stocked SKUs
                          </p>
                        </div>
                      </td>

                      {/* Orders & Delivery Rate */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="space-y-0.5">
                          <p className="font-extrabold text-slate-900">
                            {b.delivered_orders} / {b.total_orders} Orders
                          </p>
                          <p className={`text-[11px] font-bold ${Number(b.delivery_rate) >= 90 ? "text-emerald-600" : "text-amber-600"}`}>
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
        </div>
      ) : (
        /* Branch Hub Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(analytics?.branches || []).map((b: any) => {
            const deliveryBoysActive = Number(b.active_partners || b.partner_count || 0);
            const warehousesCount = Number(b.warehouses_count || 1);
            const itemsCount = Number(b.total_items_count || 120);

            return (
              <div key={b.branch_id} className="bg-white rounded-2xl p-4.5 border border-gray-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">{b.branch_name}</h3>
                      <p className="text-xs text-slate-500 font-medium">{b.city || "Hub Region"}</p>
                    </div>
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {deliveryBoysActive} Drivers
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3.5 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Warehouses</span>
                      <p className="font-extrabold text-slate-900 text-sm mt-0.5">{warehousesCount} Unit(s)</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Stock Items</span>
                      <p className="font-extrabold text-slate-900 text-sm mt-0.5">{itemsCount} SKUs</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Total Branch Sales:</span>
                    <span className="font-black text-slate-900">{formatMoney(b.total_sales || b.revenue)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold">Net Profit:</span>
                    <span className="font-black text-teal-700 flex items-center gap-1">
                      {formatMoney(b.net_profit)}
                      <span className="text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 px-1.5 py-0.5 rounded">
                        {b.profit_margin}%
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
