// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : OrderFilterBar.tsx
// Description : Filter bar — no view toggle, responsive date filters
//
// ============================================================================

'use client';

import React from 'react';
import {
  Search,
  ShoppingCart,
  Repeat,
  BarChart3,
  Sun,
  Moon,
  AlertTriangle,
  AlertOctagon,
  X,
  Calendar,
} from 'lucide-react';

export type ViewMode = 'grid' | 'table';
export type OrderTypeTab = 'all' | 'one-time' | 'subscription' | 'undelivered';
export type DeliverySlotFilter = 'all' | 'morning' | 'evening';

interface OrderFilterBarProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  orderType: OrderTypeTab;
  onOrderTypeChange: (type: OrderTypeTab) => void;
  fixedTab?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  slotFilter: DeliverySlotFilter;
  onSlotFilterChange: (slot: DeliverySlotFilter) => void;
  urgentOnly: boolean;
  onUrgentToggle: () => void;
  selectedDate?: string;
  onSelectedDateChange?: (date: string) => void;
  fromDate?: string;
  onFromDateChange?: (date: string) => void;
  toDate?: string;
  onToDateChange?: (date: string) => void;
  onClearDates?: () => void;
}

export default function OrderFilterBar({
  orderType,
  onOrderTypeChange,
  fixedTab = false,
  searchQuery,
  onSearchChange,
  slotFilter,
  onSlotFilterChange,
  urgentOnly,
  onUrgentToggle,
  selectedDate = '',
  onSelectedDateChange,
  fromDate = '',
  onFromDateChange,
  toDate = '',
  onToDateChange,
  onClearDates,
}: OrderFilterBarProps) {
  return (
    <div className="bg-white rounded-2xl p-3 border border-gray-200/90 shadow-2xs">
      {/* Row 1: Order Type Tabs + Search + Slot + Urgent */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Order Type Selector Pills */}
        {!fixedTab && (
          <div className="inline-flex h-9 rounded-xl bg-gray-100/90 p-1 border border-gray-200/80 items-center shrink-0">
            {([
              { key: 'all',          label: 'All Orders',   icon: BarChart3    },
              { key: 'one-time',     label: 'One-Time',     icon: ShoppingCart  },
              { key: 'subscription', label: 'Subscription', icon: Repeat        },
              { key: 'undelivered',  label: 'Undelivered',  icon: AlertOctagon  },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => onOrderTypeChange(key)}
                className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  orderType === key
                    ? key === 'undelivered'
                      ? 'bg-amber-600 text-white shadow-2xs font-bold'
                      : 'bg-emerald-700 text-white shadow-2xs font-bold'
                    : key === 'undelivered'
                      ? 'text-amber-700 hover:text-amber-900 hover:bg-amber-50'
                      : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Search Box */}
        <div className="relative h-9 min-w-[200px] flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search Order ID, Customer, Phone..."
            className="w-full h-9 pl-9 pr-8 bg-gray-50 text-xs font-medium text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Delivery Slot Filter */}
        <div className="inline-flex h-9 rounded-xl bg-gray-100/90 border border-gray-200 p-1 items-center shrink-0">
          <button
            type="button"
            onClick={() => onSlotFilterChange('all')}
            className={`h-7 px-3 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              slotFilter === 'all'
                ? 'bg-white text-gray-900 shadow-2xs border border-gray-200 font-bold'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            All Slots
          </button>
          <button
            type="button"
            onClick={() => onSlotFilterChange('morning')}
            className={`inline-flex items-center gap-1 h-7 px-3 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              slotFilter === 'morning'
                ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs font-bold'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <Sun size={13} /> Morning
          </button>
          <button
            type="button"
            onClick={() => onSlotFilterChange('evening')}
            className={`inline-flex items-center gap-1 h-7 px-3 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              slotFilter === 'evening'
                ? 'bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-2xs font-bold'
                : 'text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            <Moon size={13} /> Evening
          </button>
        </div>

        {/* Urgent Filter */}
        <button
          type="button"
          onClick={onUrgentToggle}
          className={`inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-xl border transition-all whitespace-nowrap shrink-0 ${
            urgentOnly
              ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-300 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-600 hover:border-rose-200 hover:text-rose-600'
          }`}
        >
          <AlertTriangle size={14} className={urgentOnly ? 'text-rose-600 animate-pulse' : 'text-gray-400'} />
          <span>Urgent</span>
        </button>
      </div>

      {/* Row 2: Date Filters — always on a new row so they never overflow */}
      <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-gray-100">
        {/* Particular Date */}
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200/90 rounded-xl px-2.5 h-9 shrink-0">
          <Calendar size={13} className="text-emerald-600 shrink-0" />
          <span className="text-[10px] font-bold text-gray-500 uppercase shrink-0">Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onSelectedDateChange?.(e.target.value)}
            className="bg-transparent text-xs font-semibold text-gray-800 outline-none cursor-pointer w-[130px]"
            title="Filter by Particular Date"
          />
        </div>

        {/* Range: From → To */}
        <div className="flex items-center gap-1 bg-gray-50 border border-gray-200/90 rounded-xl px-2.5 h-9 shrink-0">
          <span className="text-[10px] font-bold text-gray-500 uppercase shrink-0">From:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange?.(e.target.value)}
            className="bg-transparent text-xs font-semibold text-gray-800 outline-none cursor-pointer w-[130px]"
            title="From Date"
          />
          <span className="text-[10px] font-bold text-gray-500 uppercase shrink-0 ml-1">To:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange?.(e.target.value)}
            className="bg-transparent text-xs font-semibold text-gray-800 outline-none cursor-pointer w-[130px]"
            title="To Date"
          />
        </div>

        {/* Clear Dates */}
        {(selectedDate || fromDate || toDate) && (
          <button
            type="button"
            onClick={onClearDates}
            className="h-9 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0"
            title="Clear Date Filters"
          >
            <X size={13} />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
