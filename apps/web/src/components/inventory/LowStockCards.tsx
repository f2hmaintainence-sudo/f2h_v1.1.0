"use client";

import React from "react";
import { Package, AlertTriangle, Plus } from "lucide-react";

interface LowStockItem {
  id: string | number;
  productName: string;
  sku: string;
  warehouse: string;
  availableQty: number;
  reorderLevel: number;
  status: "low" | "critical" | "healthy";
  imageUrl?: string;
}

interface LowStockCardsProps {
  items?: LowStockItem[];
  onRestock?: (item: LowStockItem) => void;
}

export default function LowStockCards({ items, onRestock }: LowStockCardsProps) {
  // ── No dummy data — show real items only ──────────────────────────────
  const displayItems = items && items.length > 0 ? items : [];

  // ── Empty state ───────────────────────────────────────────────────────
  if (displayItems.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4 h-full">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Low Stock Alerts
            </h3>
            <p className="text-xs text-slate-500 font-medium">Products requiring stock replenishment</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">All Stock Levels Healthy</h4>
          <p className="text-xs text-slate-500 font-medium text-center">
            No products are below reorder thresholds right now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Low Stock Alerts
          </h3>
          <p className="text-xs text-slate-500 font-medium">Products requiring stock replenishment</p>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
          {displayItems.length} Product{displayItems.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {displayItems.map((item) => {
          const isCritical = item.status === "critical" || item.availableQty <= 0;
          const badgeConfig = isCritical
            ? { label: "Critical", bg: "bg-rose-50 text-rose-700 border-rose-200" }
            : { label: "Low Stock", bg: "bg-amber-50 text-amber-700 border-amber-200" };

          return (
            <div
              key={item.id}
              className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/70 hover:border-emerald-400/50 hover:shadow-sm transition-all flex flex-col justify-between gap-2.5"
            >
              {/* Top — icon + name + badge */}
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center shrink-0">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <Package className="w-4 h-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <h5 className="text-xs font-extrabold text-slate-900 truncate leading-tight">
                      {item.productName}
                    </h5>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${badgeConfig.bg}`}>
                      {badgeConfig.label}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                    {item.sku}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    • <span className="font-semibold text-slate-600">{item.warehouse}</span>
                  </p>
                </div>
              </div>

              {/* Bottom — qty + restock */}
              <div className="flex items-end justify-between pt-2 border-t border-slate-200/50">
                <div>
                  <span className="text-[10px] text-slate-500 font-medium block leading-tight">
                    Available / Reorder
                  </span>
                  <span className="text-xs font-extrabold text-slate-900 leading-tight">
                    <strong className={isCritical ? "text-rose-600" : "text-amber-600"}>
                      {item.availableQty}
                    </strong>{" "}
                    / {item.reorderLevel} units
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRestock?.(item)}
                  className="px-3 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-3 h-3" />
                  <span>Restock</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
