"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";

interface InventoryStatusBannerProps {
  lowStockCount: number;
  outOfStockCount: number;
}

export default function InventoryStatusBanner({
  lowStockCount,
  outOfStockCount,
}: InventoryStatusBannerProps) {
  const totalAttention = lowStockCount + outOfStockCount;

  if (totalAttention === 0) {
    return (
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
              Inventory Healthy
              <span className="px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
                Optimal Status
              </span>
            </h4>
            <p className="text-xs text-emerald-700 font-medium mt-0.5">
              All warehouses are above reorder thresholds. 0 products require immediate attention.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isCritical = outOfStockCount > 0;

  return (
    <div
      className={`border rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xs ${
        isCritical
          ? "bg-rose-50/80 border-rose-200/80"
          : "bg-amber-50/80 border-amber-200/80"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs ${
            isCritical ? "bg-rose-500" : "bg-amber-500"
          }`}
        >
          {isCritical ? (
            <ShieldAlert className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
        </div>
        <div>
          <h4
            className={`text-sm font-extrabold flex items-center gap-2 ${
              isCritical ? "text-rose-950" : "text-amber-950"
            }`}
          >
            Inventory Attention Required
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                isCritical
                  ? "bg-rose-200/70 text-rose-900"
                  : "bg-amber-200/70 text-amber-900"
              }`}
            >
              {totalAttention} Alert{totalAttention > 1 ? "s" : ""}
            </span>
          </h4>
          <p
            className={`text-xs font-medium mt-0.5 ${
              isCritical ? "text-rose-800" : "text-amber-800"
            }`}
          >
            {totalAttention} product{totalAttention > 1 ? "s" : ""} ({outOfStockCount} out of stock, {lowStockCount} low stock) require restocking across selected facilities.
          </p>
        </div>
      </div>
    </div>
  );
}
