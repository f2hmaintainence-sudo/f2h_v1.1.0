// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : ApiIntegrationsHeader.tsx
// Description : Header component for developer API integrations pages
//
// ============================================================================

"use client";

import React from "react";
import { Sliders, Layers, Send, CheckCircle2 } from "lucide-react";

interface HeaderProps {
  categoryName: string;
  subtitle: string;
  configCount: number;
  secondaryTitle?: string;
  secondaryCount?: number | string;
  secondarySubtext?: string;
  dispatchedCount?: number | string;
  reliabilityValue?: string;
}

export function ApiIntegrationsHeader({
  categoryName,
  subtitle,
  configCount,
  secondaryTitle = "WEBHOOKS CONFIGURED",
  secondaryCount = 0,
  secondarySubtext = "Configured notification layouts",
  dispatchedCount = 0,
  reliabilityValue = "99.98%",
}: HeaderProps) {
  return (
    <div className="space-y-6 mb-6">
      {/* Breadcrumbs & Title */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
          <span>Developer</span>
          <span>&rsaquo;</span>
          <span>API Integrations</span>
          <span>&rsaquo;</span>
          <span className="text-slate-700 font-semibold">{categoryName}</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
          API Integrations – {categoryName}
        </h1>
        <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#16a34a]" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {categoryName.toUpperCase()} CONFIGURATIONS
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#16a34a] flex items-center justify-center">
              <Sliders size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-800">{configCount}</div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">Active integrations</p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {secondaryTitle}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-800">{secondaryCount}</div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">{secondarySubtext}</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              DISPATCHED (30 DAYS)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Send size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-800">{dispatchedCount}</div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">Total delivered volume</p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-teal-500" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              SYSTEM RELIABILITY
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-800">{reliabilityValue}</div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">Optimal performance status</p>
          </div>
        </div>
      </div>
    </div>
  );
}
