"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Warehouse as WarehouseIcon,
  Tag,
  Clock,
  Eye,
  Edit2,
  GitCommitHorizontal,
} from "lucide-react";
import { StockMovementItem } from "./StockMovementSummaryCards";

interface StockMovementTimelineViewProps {
  movements: StockMovementItem[];
  loading?: boolean;
  onView?: (movement: StockMovementItem) => void;
  onEdit?: (movement: StockMovementItem) => void;
}

export default function StockMovementTimelineView({
  movements,
  loading = false,
  onView,
  onEdit,
}: StockMovementTimelineViewProps) {
  if (loading) {
    return (
      <div className="space-y-4 p-4 bg-white rounded-2xl border border-slate-200/80 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-slate-200 rounded-md" />
              <div className="h-12 bg-slate-100 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
        <div className="p-4 rounded-2xl bg-[#E8F5E9] text-[#2E7D32]">
          <GitCommitHorizontal size={36} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          No Timeline Events
        </h3>
        <p className="text-xs text-slate-500 max-w-md">
          There are no stock movements recorded for the current filter criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 md:p-6 shadow-xs">
      <div className="relative border-l-2 border-slate-200 ml-4 md:ml-6 space-y-6">
        <AnimatePresence mode="popLayout">
          {movements.map((movement, idx) => {
            const dir = String(movement.direction || "").toUpperCase();
            const isIngress =
              dir === "1" ||
              dir === "IN" ||
              dir.includes("SUCCESS") ||
              dir.includes("IN");

            const qty = Number(movement.quantity || 0);

            const formattedDate = movement.created_at
              ? new Date(movement.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "N/A";

            return (
              <motion.div
                key={movement.id || movement.movement_id || idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
                className="relative pl-6 md:pl-8 group"
              >
                {/* Node Icon on Timeline Line */}
                <div
                  className={`absolute -left-[17px] top-1.5 w-8 h-8 rounded-full border-2 flex items-center justify-center text-white shadow-xs transition-transform duration-300 group-hover:scale-110 ${
                    isIngress
                      ? "bg-[#2E7D32] border-white ring-4 ring-[#2E7D32]/10"
                      : "bg-amber-600 border-white ring-4 ring-amber-500/10"
                  }`}
                >
                  {isIngress ? (
                    <ArrowDownLeft size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}
                </div>

                {/* Timeline Card Payload */}
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 transition-all duration-200 hover:border-[#2E7D32]/40 hover:bg-white shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md ${
                          isIngress
                            ? "bg-[#2E7D32] text-white"
                            : "bg-amber-600 text-white"
                        }`}
                      >
                        {isIngress ? "Stock IN" : "Stock OUT"}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {movement.movement_id || `#${movement.id}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <Clock size={12} />
                        <span>{formattedDate}</span>
                      </span>
                      <div className="flex items-center gap-1">
                        {onView && (
                          <button
                            onClick={() => onView(movement)}
                            className="p-1 text-slate-500 hover:text-[#2E7D32] rounded-md hover:bg-[#E8F5E9] transition-colors"
                            title="View"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(movement)}
                            className="p-1 text-slate-500 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="pt-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {movement.product_name || "Product Item"}
                      </h4>
                      {movement.variant_name && (
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          {movement.variant_name}
                        </p>
                      )}
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      {movement.warehouse_name && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#E8F5E9] text-[#2E7D32] px-2.5 py-1 rounded-lg border border-[#C8E6C9]">
                          <span className="text-[10px] font-bold text-[#2E7D32]/70 uppercase tracking-wide mr-0.5">Warehouse :</span>
                          <WarehouseIcon size={12} />
                          <span>{movement.warehouse_name}</span>
                        </span>
                      )}
                      {movement.batch_id && (
                        <span className="inline-flex items-center gap-1 text-xs font-mono bg-slate-200/70 text-slate-700 px-2.5 py-1 rounded-lg">
                          <Tag size={12} />
                          <span>Batch: {movement.batch_id}</span>
                        </span>
                      )}

                      {/* Quantity Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl ${
                          isIngress
                            ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]"
                            : "bg-amber-100 text-amber-800 border border-amber-200/60"
                        }`}
                      >
                        <span className="font-semibold opacity-70">Quantity :</span>
                        <span className="font-black tracking-tight">{Math.abs(qty)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
