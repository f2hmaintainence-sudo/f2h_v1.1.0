"use client";

import React from "react";
import { HardDrive, Thermometer } from "lucide-react";

interface WarehouseStatsProps {
  capacity?: number | string;
  capacityUnit?: string;
  temperature?: string;
  isColdStorage?: boolean;
}

export default function WarehouseStats({
  capacity,
  capacityUnit = "ltr",
  temperature,
  isColdStorage = false,
}: WarehouseStatsProps) {
  // Format capacity display cleanly
  const formattedCapacity = (() => {
    if (capacity === undefined || capacity === null || capacity === "") {
      return "N/A";
    }
    const num = typeof capacity === "number" ? capacity : parseFloat(String(capacity));
    if (isNaN(num)) return String(capacity);
    return `${num.toLocaleString()} ${capacityUnit || ""}`.trim();
  })();

  // Short clean temperature label
  const formattedTemp = (() => {
    if (temperature) {
      const t = temperature.toLowerCase();
      if (t === "frozen") return "Frozen (-18°C)";
      if (t === "chilled") return "Chilled (2-8°C)";
      if (t === "ambient") return "Ambient (15-25°C)";
      return temperature.charAt(0).toUpperCase() + temperature.slice(1);
    }
    return isColdStorage ? "Chilled (2-8°C)" : "Ambient";
  })();

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="px-2.5 py-1.5 rounded-lg bg-purple-50/60 border border-purple-100 flex items-center justify-between">
        <span className="text-[10px] font-medium text-purple-700 uppercase tracking-wider flex items-center gap-1">
          <HardDrive className="w-3 h-3 text-purple-600 shrink-0" />
          Capacity
        </span>
        <span className="text-xs font-medium text-purple-900 truncate">
          {formattedCapacity}
        </span>
      </div>

      <div className="px-2.5 py-1.5 rounded-lg bg-cyan-50/60 border border-cyan-100 flex items-center justify-between">
        <span className="text-[10px] font-medium text-cyan-700 uppercase tracking-wider flex items-center gap-1">
          <Thermometer className="w-3 h-3 text-cyan-600 shrink-0" />
          Temp
        </span>
        <span className="text-xs font-medium text-cyan-900 truncate" title={formattedTemp}>
          {formattedTemp}
        </span>
      </div>
    </div>
  );
}
