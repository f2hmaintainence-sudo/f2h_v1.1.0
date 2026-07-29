"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Package,
  ShieldCheck,
  AlertTriangle,
  PackageX,
  IndianRupee,
  TrendingUp,
} from "lucide-react";

interface Stats {
  total_variants: number;
  out_of_stock: number;
  low_stock: number;
  total_stock_value: number;
  in_stock: number;
}

interface InventorySummaryCardsProps {
  stats: Stats | null;
  isLoading?: boolean;
}

export default function InventorySummaryCards({
  stats,
  isLoading = false,
}: InventorySummaryCardsProps) {
  const totalVariants = stats?.total_variants || 0;
  const inStock = stats?.in_stock || 0;
  const lowStock = stats?.low_stock || 0;
  const outOfStock = stats?.out_of_stock || 0;
  const totalValue = stats?.total_stock_value || 0;

  // Calculate Accuracy
  const accuracy = totalVariants > 0
    ? (( (totalVariants - outOfStock) / totalVariants) * 100).toFixed(1)
    : "100.0";

  const cards = [
    {
      title: "Total Products",
      value: totalVariants.toLocaleString(),
      description: "Active catalog variants",
      icon: Package,
      badge: "Catalog",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200/80",
      iconBg: "bg-blue-50 text-blue-600 border-blue-100",
      accent: "from-blue-500 to-indigo-500",
    },
    {
      title: "In Stock",
      value: inStock.toLocaleString(),
      description: "Available for dispatch",
      icon: ShieldCheck,
      badge: "Optimal",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
      iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100",
      accent: "from-emerald-500 to-teal-500",
    },
    {
      title: "Low Stock",
      value: lowStock.toLocaleString(),
      description: "Below reorder threshold",
      icon: AlertTriangle,
      badge: lowStock > 0 ? "Attention" : "Healthy",
      badgeColor: lowStock > 0 ? "bg-amber-50 text-amber-700 border-amber-200/80" : "bg-slate-100 text-slate-600 border-slate-200/80",
      iconBg: "bg-amber-50 text-amber-600 border-amber-100",
      accent: "from-amber-500 to-orange-500",
    },
    {
      title: "Out of Stock",
      value: outOfStock.toLocaleString(),
      description: "Immediate restock needed",
      icon: PackageX,
      badge: outOfStock > 0 ? "Critical" : "Clear",
      badgeColor: outOfStock > 0 ? "bg-rose-50 text-rose-700 border-rose-200/80" : "bg-slate-100 text-slate-600 border-slate-200/80",
      iconBg: "bg-rose-50 text-rose-600 border-rose-100",
      accent: "from-rose-500 to-red-500",
    },
    {
      title: "Inventory Value",
      value: `₹${Number(totalValue).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
      description: "Total stock valuation",
      icon: IndianRupee,
      badge: "Valuation",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200/80",
      iconBg: "bg-purple-50 text-purple-600 border-purple-100",
      accent: "from-purple-500 to-violet-500",
    },
    {
      title: "Inventory Accuracy",
      value: `${accuracy}%`,
      description: "Audit availability score",
      icon: TrendingUp,
      badge: "Verified",
      badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200/80",
      iconBg: "bg-cyan-50 text-cyan-600 border-cyan-100",
      accent: "from-cyan-500 to-blue-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, idx) => {
        const IconComponent = card.icon;

        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.04 }}
            whileHover={{ y: -2, transition: { duration: 0.15 } }}
            className="relative overflow-hidden bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
          >
            {/* Top Accent Line */}
            <div
              className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.accent} opacity-80 group-hover:opacity-100 transition-opacity`}
            />

            {/* Header with Title & Icon */}
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 tracking-wide uppercase">
                {card.title}
              </span>
              <div
                className={`p-2 rounded-xl border ${card.iconBg} shrink-0 group-hover:scale-105 transition-transform`}
              >
                <IconComponent className="w-4 h-4" />
              </div>
            </div>

            {/* Metric & Description */}
            <div className="mt-3 space-y-1">
              {isLoading ? (
                <div className="h-7 w-20 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <div className="text-xl font-black text-slate-900 tracking-tight">
                  {card.value}
                </div>
              )}

              <div className="flex items-center justify-between gap-1 pt-1">
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  {card.description}
                </p>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${card.badgeColor} shrink-0`}
                >
                  {card.badge}
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
