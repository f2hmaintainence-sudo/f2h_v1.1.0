"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Package,
  Warehouse,
} from "lucide-react";

interface SummaryData {
  total: number;
  active: number;
  inactive: number;
  productsStored: number;
}

interface WarehouseSummaryCardsProps {
  summary: SummaryData;
  isLoading?: boolean;
}

export default function WarehouseSummaryCards({
  summary,
  isLoading = false,
}: WarehouseSummaryCardsProps) {
  const cards = [
    {
      title: "Total Warehouses",
      value: summary.total,
      description: "Registered facilities across regions",
      icon: Warehouse,
      accent: "from-emerald-500 to-teal-600",
      bgLight: "bg-emerald-50/70 text-emerald-600 border-emerald-100",
    },
    {
      title: "Active Warehouses",
      value: summary.active,
      description: "Fully operational & receiving stock",
      icon: CheckCircle2,
      accent: "from-green-500 to-emerald-600",
      bgLight: "bg-green-50/70 text-green-600 border-green-100",
    },
    {
      title: "Inactive Warehouses",
      value: summary.inactive,
      description: "Under maintenance or offline",
      icon: XCircle,
      accent: "from-rose-500 to-red-600",
      bgLight: "bg-rose-50/70 text-rose-600 border-rose-100",
    },
    {
      title: "Products Stored",
      value: summary.productsStored.toLocaleString(),
      description: "Total items currently in stock",
      icon: Package,
      accent: "from-blue-500 to-indigo-600",
      bgLight: "bg-blue-50/70 text-blue-600 border-blue-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const IconComponent = card.icon;

        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="relative overflow-hidden bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-500/30 transition-all group"
          >
            {/* Top Accent Line */}
            <div
              className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.accent} opacity-80 group-hover:opacity-100 transition-opacity`}
            />

            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                {card.title}
              </span>
              <div
                className={`p-2 rounded-xl border ${card.bgLight} shrink-0 group-hover:scale-105 transition-transform`}
              >
                <IconComponent className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3">
              {isLoading ? (
                <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {card.value}
                </div>
              )}
              <p className="mt-1 text-[11px] text-slate-500 font-medium line-clamp-1">
                {card.description}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
