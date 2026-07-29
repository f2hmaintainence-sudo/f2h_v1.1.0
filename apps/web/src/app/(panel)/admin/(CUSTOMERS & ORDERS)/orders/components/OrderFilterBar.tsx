// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : OrderFilterBar.tsx
// Description : Advanced filter control bar with uniform heights & light theme
//
// ============================================================================

'use client';

import React from 'react';
import {
  LayoutGrid,
  Table as TableIcon,
  Search,
  ShoppingCart,
  Repeat,
  BarChart3,
  Sun,
  Moon,
  AlertTriangle,
  X,
} from 'lucide-react';

export type ViewMode = 'grid' | 'table';
export type OrderTypeTab = 'all' | 'one-time' | 'subscription';
export type DeliverySlotFilter = 'all' | 'morning' | 'evening';

interface OrderFilterBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  orderType: OrderTypeTab;
  onOrderTypeChange: (type: OrderTypeTab) => void;
  fixedTab?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  slotFilter: DeliverySlotFilter;
  onSlotFilterChange: (slot: DeliverySlotFilter) => void;
  urgentOnly: boolean;
  onUrgentToggle: () => void;
}

export default function OrderFilterBar({
  viewMode,
  onViewModeChange,
  orderType,
  onOrderTypeChange,
  fixedTab = false,
  searchQuery,
  onSearchChange,
  slotFilter,
  onSlotFilterChange,
  urgentOnly,
  onUrgentToggle,
}: OrderFilterBarProps) {
  return (
    <div className="bg-white rounded-2xl p-3 border border-gray-200/90 shadow-2xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        
        {/* Left: View Switcher & Order Type Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle (Cards vs Table) */}
          <div className="inline-flex h-9 rounded-xl bg-gray-100/90 p-1 border border-gray-200/80 items-center">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                viewMode === 'grid'
                  ? 'bg-white text-emerald-800 shadow-2xs border border-gray-200 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Cards View"
            >
              <LayoutGrid size={14} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                viewMode === 'table'
                  ? 'bg-white text-emerald-800 shadow-2xs border border-gray-200 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Table View"
            >
              <TableIcon size={14} />
              <span>Table</span>
            </button>
          </div>

          {/* Order Type Selector Pills */}
          {!fixedTab && (
            <div className="inline-flex h-9 rounded-xl bg-gray-100/90 p-1 border border-gray-200/80 items-center">
              {([
                { key: 'all', label: 'All Orders', icon: BarChart3 },
                { key: 'one-time', label: 'One-Time', icon: ShoppingCart },
                { key: 'subscription', label: 'Subscription', icon: Repeat },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onOrderTypeChange(key)}
                  className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                    orderType === key
                      ? 'bg-emerald-700 text-white shadow-2xs font-bold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Search, Slot Filter, & Urgent Filter (Uniform Height h-9) */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Search Box (h-9) */}
          <div className="relative flex-1 min-w-[220px] h-9">
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

          {/* Delivery Slot Filter (h-9) */}
          <div className="inline-flex h-9 rounded-xl bg-gray-100/90 border border-gray-200 p-1 items-center">
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
              title="Morning Slot (6:00 AM - 9:00 AM)"
            >
              <Sun size={13} />
              Morning
            </button>
            <button
              type="button"
              onClick={() => onSlotFilterChange('evening')}
              className={`inline-flex items-center gap-1 h-7 px-3 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                slotFilter === 'evening'
                  ? 'bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-2xs font-bold'
                  : 'text-indigo-700 hover:bg-indigo-50'
              }`}
              title="Evening Slot (5:00 PM - 8:00 PM)"
            >
              <Moon size={13} />
              Evening
            </button>
          </div>

          {/* Urgent / Delayed Filter Toggle (h-9) */}
          <button
            type="button"
            onClick={onUrgentToggle}
            className={`inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-xl border transition-all whitespace-nowrap ${
              urgentOnly
                ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-300 shadow-2xs font-bold'
                : 'bg-white border-gray-200 text-gray-600 hover:border-rose-200 hover:text-rose-600'
            }`}
          >
            <AlertTriangle size={14} className={urgentOnly ? 'text-rose-600 animate-pulse' : 'text-gray-400'} />
            <span>Urgent</span>
          </button>
        </div>
      </div>
    </div>
  );
}
