"use client";

import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

interface InventoryHealthChartProps {
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

export default function InventoryHealthChart({
  inStock,
  lowStock,
  outOfStock,
}: InventoryHealthChartProps) {
  const data = [
    { name: "In Stock", value: inStock, color: "#16a34a" },
    { name: "Low Stock", value: lowStock, color: "#f59e0b" },
    { name: "Out of Stock", value: outOfStock, color: "#ef4444" },
  ];

  const total = inStock + lowStock + outOfStock;

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-emerald-600" />
            Inventory Health
          </h3>
          <p className="text-xs text-slate-500 font-medium">Stock status distribution ratio</p>
        </div>
        <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">
          {total} Total
        </span>
      </div>

      <div className="h-56 w-full relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderRadius: "12px",
                border: "none",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "600",
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              formatter={(value) => (
                <span className="text-xs font-semibold text-slate-700">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
