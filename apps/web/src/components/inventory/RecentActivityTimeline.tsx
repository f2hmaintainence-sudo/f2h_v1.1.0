"use client";

import React, { useEffect, useRef } from "react";
import { PackagePlus, Truck, AlertTriangle, RefreshCw, Clock, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface RawMovement {
  movement_id: string;
  movement_type: string;
  direction: number;
  quantity: number;
  warehouse_name: string;
  product_name: string;
  variant_name: string;
  created_at: string;
}

interface RecentActivityTimelineProps {
  movements?: RawMovement[];
  isLoading?: boolean;
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return "";
  }
}

function getIconConfig(movement_type: string, direction: number) {
  if (direction === 1) {
    return { icon: ArrowUpCircle, bg: "bg-emerald-50 text-emerald-600 border-emerald-100" };
  }
  if (movement_type === "dispatch") {
    return { icon: Truck, bg: "bg-[#16a34a]/10 text-[#16a34a] border-emerald-100" };
  }
  if (movement_type === "stock_transfer" || movement_type === "transfer") {
    return { icon: RefreshCw, bg: "bg-purple-50 text-purple-600 border-purple-100" };
  }
  if (movement_type === "damage" || movement_type === "expiry") {
    return { icon: AlertTriangle, bg: "bg-red-50 text-red-600 border-red-100" };
  }
  return { icon: ArrowDownCircle, bg: "bg-amber-50 text-amber-600 border-amber-100" };
}

function getActionLabel(m: RawMovement): string {
  const qty = Number(m.quantity);
  const product = m.product_name || m.variant_name || "Product";
  const typeLabels: Record<string, string> = {
    stock_in:      "Added to Stock",
    stock_out:     "Removed from Stock",
    purchase:      "Purchase Received",
    production:    "Production Added",
    dispatch:      "Dispatched",
    stock_transfer:"Transferred",
    delivery_return:"Delivery Return",
    customer_return:"Customer Return",
    stock_adjustment: "Stock Adjusted",
    damage:        "Damage Written Off",
    expiry:        "Expiry Written Off",
    opening_stock: "Opening Stock Set",
    closing_stock: "Closing Stock Set",
  };
  const label = typeLabels[m.movement_type] ?? m.movement_type;
  return `${qty} × ${product} — ${label}`;
}

export default function RecentActivityTimeline({ movements, isLoading }: RecentActivityTimelineProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  // Flash-animate new items when movements list grows
  useEffect(() => {
    if (movements && movements.length > prevCount.current && listRef.current) {
      const firstItem = listRef.current.firstElementChild as HTMLElement;
      if (firstItem) {
        firstItem.style.animation = "none";
        firstItem.offsetHeight; // reflow
        firstItem.style.animation = "fadeSlideIn 0.4s ease";
      }
    }
    prevCount.current = movements?.length ?? 0;
  }, [movements?.length]);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            Recent Inventory Activity
          </h3>
          <p className="text-xs text-slate-500 font-medium">Real-time log of stock actions &amp; events</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live Stream
        </span>
      </div>

      {isLoading && (!movements || movements.length === 0) ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-slate-100 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-slate-100 rounded w-3/4" />
                <div className="h-2.5 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : !movements || movements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
          <Clock className="w-8 h-8 opacity-30" />
          <span className="text-xs font-medium">No recent activity</span>
        </div>
      ) : (
        <div ref={listRef} className="space-y-3 relative before:absolute before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-100">
          {movements.slice(0, 8).map((m) => {
            const config = getIconConfig(m.movement_type, m.direction);
            const IconComp = config.icon;
            return (
              <div key={m.movement_id} className="flex items-center justify-between gap-3 relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl border ${config.bg} flex items-center justify-center shrink-0 shadow-xs`}>
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-slate-800 truncate">{getActionLabel(m)}</h5>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Facility: <span className="font-semibold text-slate-700">{m.warehouse_name || "—"}</span>
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-semibold text-slate-400 shrink-0">
                  {formatTime(m.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
