"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import StockMovementCard from "./StockMovementCard";
import { StockMovementItem } from "./StockMovementSummaryCards";
import { PackageSearch, RefreshCw } from "lucide-react";

interface StockMovementCardsViewProps {
  movements: StockMovementItem[];
  loading?: boolean;
  onView?: (movement: StockMovementItem) => void;
  onEdit?: (movement: StockMovementItem) => void;
  onResetFilters?: () => void;
}

export default function StockMovementCardsView({
  movements,
  loading = false,
  onView,
  onEdit,
  onResetFilters,
}: StockMovementCardsViewProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-4 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-6 w-24 bg-slate-200 rounded-lg" />
              <div className="h-6 w-12 bg-slate-200 rounded-lg" />
            </div>
            <div className="h-5 w-3/4 bg-slate-200 rounded-md" />
            <div className="h-4 w-1/2 bg-slate-200 rounded-md" />
            <div className="h-10 bg-slate-100 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 shadow-xs"
      >
        <div className="p-4 rounded-2xl bg-[#E8F5E9] text-[#2E7D32]">
          <PackageSearch size={36} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          No Stock Movements Found
        </h3>
        <p className="text-xs text-slate-500 max-w-md">
          No stock movement audit records match your selected warehouse or search filters.
        </p>
        {onResetFilters && (
          <button
            onClick={onResetFilters}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
          >
            <RefreshCw size={14} />
            <span>Reset Search & Filters</span>
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence mode="popLayout">
        {movements.map((movement) => (
          <StockMovementCard
            key={movement.id || movement.movement_id}
            movement={movement}
            onView={onView}
            onEdit={onEdit}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
