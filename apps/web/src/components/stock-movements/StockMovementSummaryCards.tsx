"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Boxes,
} from "lucide-react";

export interface StockMovementItem {
  id: string | number;
  movement_id: string;
  movement_type: string;
  direction: number | string;
  warehouse_name?: string;
  product_name?: string;
  variant_name?: string;
  batch_id?: string;
  quantity: number | string;
  quantity_before?: number | string;
  quantity_after?: number | string;
  created_by?: string;
  created_at?: string;
}

interface StockMovementSummaryCardsProps {
  movements: StockMovementItem[];
  loading?: boolean;
}

export default function StockMovementSummaryCards({
  movements,
  loading = false,
}: StockMovementSummaryCardsProps) {
  const stats = React.useMemo(() => {
    let stockInCount = 0;
    let stockOutCount = 0;
    let totalInQty = 0;
    let totalOutQty = 0;
    const variantsSet = new Set<string>();

    movements.forEach((m) => {
      const dir = String(m.direction).toUpperCase();
      const isIngress =
        dir === "1" ||
        dir === "IN" ||
        dir.includes("SUCCESS") ||
        dir.includes("IN");

      const qty = Math.abs(Number(m.quantity) || 0);

      if (isIngress) {
        stockInCount++;
        totalInQty += qty;
      } else {
        stockOutCount++;
        totalOutQty += qty;
      }

      if (m.variant_name || m.product_name) {
        variantsSet.add(`${m.product_name || ""}-${m.variant_name || ""}`);
      }
    });

    return {
      total: movements.length,
      stockInCount,
      stockOutCount,
      totalInQty,
      totalOutQty,
      uniqueVariants: variantsSet.size,
    };
  }, [movements]);

  const cards = [
    {
      title: "Total Movements",
      value: stats.total,
      description: `${stats.uniqueVariants} unique product variant${stats.uniqueVariants === 1 ? "" : "s"} logged`,
      icon: ArrowRightLeft,
      accentStyle: { background: "linear-gradient(to right, #2E7D32, #1B5E20)" },
      iconStyle: { backgroundColor: "#E8F5E9", color: "#2E7D32", borderColor: "#C8E6C9" },
    },
    {
      title: "Stock In Ingress",
      value: stats.stockInCount,
      description: `${stats.totalInQty.toLocaleString()} units added into stock`,
      icon: ArrowDownLeft,
      accentStyle: { background: "linear-gradient(to right, #2E7D32, #43A047)" },
      iconStyle: { backgroundColor: "#E8F5E9", color: "#2E7D32", borderColor: "#C8E6C9" },
    },
    {
      title: "Stock Out / Dispatch",
      value: stats.stockOutCount,
      description: `${stats.totalOutQty.toLocaleString()} units removed or dispatched`,
      icon: ArrowUpRight,
      accentStyle: { background: "linear-gradient(to right, #ED6C02, #E65100)" },
      iconStyle: { backgroundColor: "#FFF3E0", color: "#ED6C02", borderColor: "#FFE0B2" },
    },
    {
      title: "Active Facilities",
      value: stats.total > 0 ? "Operational" : "Idle",
      description: `Audit logs synced in real-time`,
      icon: Boxes,
      accentStyle: { background: "linear-gradient(to right, #0288D1, #01579B)" },
      iconStyle: { backgroundColor: "#E1F5FE", color: "#0288D1", borderColor: "#B3E5FC" },
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
            className="relative overflow-hidden bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-all group"
          >
            {/* Top Accent Line with #2E7D32 theme */}
            <div
              className="absolute top-0 left-0 right-0 h-1 opacity-90 group-hover:opacity-100 transition-opacity"
              style={card.accentStyle}
            />

            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                {card.title}
              </span>
              <div
                className="p-2 rounded-xl border shrink-0 group-hover:scale-105 transition-transform"
                style={card.iconStyle}
              >
                <IconComponent className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3">
              {loading ? (
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
