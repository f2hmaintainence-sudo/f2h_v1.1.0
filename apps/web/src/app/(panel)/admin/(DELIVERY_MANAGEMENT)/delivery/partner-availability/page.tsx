// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : partner-availability/page.tsx
// Description : Dedicated Delivery Partner Availability View
//               Displays real-time online status, shift metrics, GPS pings,
//               approved leave standing, and pending leave requests.
// ============================================================================

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronRight, Home, PieChart, Building2
} from "lucide-react";
import OnlinePartnersPanel from "@/components/delivery/OnlinePartnersPanel";
import { api } from "@/services/api.client";

export default function PartnerAvailabilityPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  useEffect(() => {
    api.get<any>("/admin/zone/branches-list?all=true")
      .then((res) => {
        if (res.data?.data) setBranches(res.data.data);
        else if (Array.isArray(res.data)) setBranches(res.data);
      })
      .catch(() => {
        api.get<any>("/admin/branches")
          .then((res) => {
            if (res.data?.data) setBranches(res.data.data);
          })
          .catch(() => {});
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-300">
      {/* ── Top Header & Breadcrumbs ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <Link href="/admin/dashboard" className="hover:text-emerald-700 flex items-center gap-1 transition-colors">
              <Home size={13} className="text-emerald-600" /> Dashboard
            </Link>
            <ChevronRight size={13} className="text-slate-400" />
            <span className="text-slate-400">Deliveries Partners</span>
            <ChevronRight size={13} className="text-slate-400" />
            <span className="font-bold text-emerald-800">Partner Availability</span>
          </nav>
          <div className="flex items-center gap-2.5 mt-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-sm shadow-emerald-600/20">
              <PieChart size={20} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Partner Availability
              </h1>
              <p className="text-xs text-slate-500">
                Active delivery partners by branch with their current availability status.
              </p>
            </div>
          </div>
        </div>

        {/* Branch Filter Dropdown */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-2xl px-3 py-2 shadow-2xs">
            <Building2 size={14} className="text-slate-400 shrink-0" />
            <select
              aria-label="Filter by branch"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.branch_id || b.id} value={b.branch_id || b.id}>
                  {b.branch_name || b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Main Live Online Delivery Partners Section ── */}
      <OnlinePartnersPanel branchId={selectedBranchId || undefined} />
    </div>
  );
}
