// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Branch partner allocation page formatted to match F2H theme
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { Users, RefreshCw, Home, ChevronRight, Star, Building, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";

export default function BranchPartnersPage() {
  const [data, setData] = useState<any[]>([]);
  const [totalPartners, setTotalPartners] = useState(0);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<any[]>([]);
  const [allocating, setAllocating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/branch-config/partners");
      if (res.data?.data) setData(res.data.data);
      if (res.data?.total_partners) setTotalPartners(res.data.total_partners);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    api.get<any>("/admin/dashboard/branch-performance?days=1").then(res => {
      if (res.data?.data) setBranches(res.data.data);
    }).catch(() => { });
  }, []);

  const handleAllocate = async (partnerId: string, branchId: string) => {
    setAllocating(partnerId);
    try {
      await api.patch<any>(`/admin/branch-config/partners/${partnerId}/allocate`, { branch_id: branchId });
      showSuccessToast("Partner successfully re-allocated");
      fetchData();
    } catch { alert("Failed to allocate partner"); } finally { setAllocating(null); }
  };

  const totalAvailable = data.reduce((acc: number, group: any) => {
    return acc + (group.partners || []).filter((p: any) => p.is_available).length;
  }, 0);

  const totalOffline = Math.max(0, totalPartners - totalAvailable);

  return (
    <div className="space-y-6 p-4 md:p-6 animate-in fade-in duration-300">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-[#16a34a] transition-colors">
          <Home size={13} /> Dashboard
        </Link>
        <ChevronRight size={12} className="text-slate-400" />
        <Link href="/admin/branches" className="hover:text-[#16a34a] transition-colors">
          Branch Management
        </Link>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="font-semibold text-slate-800">Partner Allocation</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/60 shadow-xs shrink-0">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Branch Partner Allocation</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign and re-allocate active delivery partners to operational hub branches.
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200/80 transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-[#16a34a]" : "text-slate-500"} />
          Refresh
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Partners</p>
            <h3 className="text-lg font-bold text-slate-800">{totalPartners}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center shrink-0">
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Available / Duty</p>
            <h3 className="text-lg font-bold text-[#16a34a]">{totalAvailable}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <UserX size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Offline</p>
            <h3 className="text-lg font-bold text-slate-700">{totalOffline}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center shrink-0">
            <Building size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Active Branches</p>
            <h3 className="text-lg font-bold text-slate-800">{data.length}</h3>
          </div>
        </div>
      </div>

      {/* Branch Partner List Groups */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100">
          <div className="w-10 h-10 border-4 border-emerald-100 border-t-[#16a34a] rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading partner allocations...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.map((group: any) => (
            <div key={group.branch_id || "unassigned"} className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
              {/* Group Header */}
              <div className="px-6 py-4 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Building size={16} className="text-[#16a34a]" />
                  <h3 className="text-sm font-bold text-slate-800">{group.branch_name}</h3>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-[#16a34a] text-xs font-semibold border border-emerald-100/60">
                  {group.partners?.length || 0} partners assigned
                </span>
              </div>

              {/* Partners List */}
              <div className="divide-y divide-slate-100">
                {(group.partners || []).map((p: any) => (
                  <div key={p.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                    {/* Left: User Info */}
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#16a34a] border border-emerald-100/50 flex items-center justify-center text-sm font-bold shadow-2xs shrink-0">
                        {(p.full_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-800">{p.full_name}</p>
                          {p.average_rating && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100">
                              <Star size={9} className="fill-amber-400 text-amber-400" /> {Number(p.average_rating).toFixed(1)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{p.phone || "No phone registered"}</p>
                      </div>
                    </div>

                    {/* Right: Status & Allocation Action */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden md:block">
                        <p className="text-xs font-medium text-slate-600">
                          {p.total_runs ?? 0} runs <span className="text-slate-300">•</span> {p.total_deliveries ?? 0} deliveries
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                        <span className={`w-2 h-2 rounded-full ${p.is_available ? "bg-[#16a34a] shadow-xs" : "bg-slate-400"}`} />
                        <span className="text-xs font-semibold text-slate-700">{p.is_available ? "Available" : "Offline"}</span>
                      </div>

                      {/* Custom Form Select */}
                      <div className="relative">
                        <select
                          onChange={e => { if (e.target.value) handleAllocate(p.id, e.target.value); }}
                          disabled={allocating === p.id}
                          value=""
                          className="px-3.5 py-2 text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:border-[#16a34a] focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <option value="">Reassign Hub...</option>
                          {branches.filter((b: any) => b.branch_id !== p.branch_id).map((b: any) => (
                            <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                {(!group.partners || group.partners.length === 0) && (
                  <div className="px-6 py-8 text-center text-xs text-slate-400 font-medium">
                    No delivery partners assigned to this branch.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
