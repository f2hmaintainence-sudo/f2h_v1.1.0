"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface MovementPoint {
  day: string;
  stockIn: number;
  stockOut: number;
}

interface StockMovementChartProps {
  data?: MovementPoint[];
  isLoading?: boolean;
}

// Labeled day indices — only these 7 ticks show on the X-axis
const LABELED_INDICES = [0, 4, 9, 14, 19, 24, 29];

export default function StockMovementChart({ data, isLoading }: StockMovementChartProps) {
  // Add a numeric index field so XAxis can use it as a stable coordinate key
  const chartData = (data && data.length > 0 ? data : []).map((d, i) => ({
    ...d,
    index: i,
  }));

  const hasRealData = chartData.some((d) => d.stockIn > 0 || d.stockOut > 0);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Stock Movement
          </h3>
          <p className="text-xs text-slate-500 font-medium">Inbound vs outbound velocity (Last 30 Days)</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Stock In
          </span>
          <span className="flex items-center gap-1.5 text-amber-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Stock Out
          </span>
        </div>
      </div>

      <div className="h-56 w-full">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorStockIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorStockOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

              {/* Use numeric index as the axis key — ticks are stable numbers, labels mapped back via tickFormatter */}
              <XAxis
                dataKey="index"
                type="number"
                domain={[0, 29]}
                ticks={LABELED_INDICES}
                tickFormatter={(idx: number) => chartData[idx]?.day ?? ""}
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderRadius: "12px",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
                labelFormatter={(idx: number) => {
                  const label = chartData[idx]?.day;
                  return label ? `📅 ${label}` : `📅 Day ${idx + 1}`;
                }}
                formatter={(value, name) => [
                  value ?? 0,
                  name === "Stock In" ? "Stock In" : "Stock Out",
                ]}
              />
              <Area
                type="monotone"
                dataKey="stockIn"
                name="Stock In"
                stroke="#16a34a"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorStockIn)"
                dot={false}
                activeDot={{ r: 4, fill: "#16a34a" }}
              />
              <Area
                type="monotone"
                dataKey="stockOut"
                name="Stock Out"
                stroke="#f59e0b"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorStockOut)"
                dot={false}
                activeDot={{ r: 4, fill: "#f59e0b" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {!isLoading && !hasRealData && (
        <p className="text-center text-[11px] text-slate-400 font-medium -mt-2">
          No movements recorded in the last 30 days yet — chart will populate as stock actions occur.
        </p>
      )}
    </div>
  );
}
