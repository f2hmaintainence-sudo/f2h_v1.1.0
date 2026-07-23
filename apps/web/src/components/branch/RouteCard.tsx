'use client';

import React, { useState } from 'react';
import {
  Route, Users, UserCheck, AlertTriangle, ChevronDown, ChevronUp,
  Trash2, Sun, Moon, GripVertical, Loader2
} from 'lucide-react';

interface RouteCardProps {
  route: {
    id: string;
    route_name: string;
    shift_type: 'morning' | 'evening';
    delivery_partner_id: string | null;
    delivery_partner_name: string | null;
    customer_count: number;
    max_stops: number;
    sector_index: number;
  };
  deliveryPartners: { id: string; full_name: string }[];
  isSelected: boolean;
  onSelect: () => void;
  onAssignBoy: (routeId: string, boyId: string) => void;
  onDelete: (routeId: string) => void;
  onViewRunSheet: (routeId: string) => void;
  assigning?: boolean;
}

const SECTOR_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

export default function RouteCard({
  route,
  deliveryPartners,
  isSelected,
  onSelect,
  onAssignBoy,
  onDelete,
  onViewRunSheet,
  assigning = false,
}: RouteCardProps) {
  const [showAssign, setShowAssign] = useState(false);
  const [selectedBoyId, setSelectedBoyId] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const color = SECTOR_COLORS[route.sector_index % SECTOR_COLORS.length];
  const loadPercent = route.max_stops > 0 ? Math.min(100, (route.customer_count / route.max_stops) * 100) : 0;

  return (
    <div
      className={`rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'border-gray-800 bg-gray-50 shadow-sm'
          : 'border-gray-100 hover:border-gray-200 bg-white'
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="font-semibold text-sm text-gray-800 truncate">
              {route.route_name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Shift Badge */}
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              route.shift_type === 'morning'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-indigo-50 text-indigo-700'
            }`}>
              {route.shift_type === 'morning' ? (
                <span className="flex items-center gap-0.5"><Sun size={10} /> AM</span>
              ) : (
                <span className="flex items-center gap-0.5"><Moon size={10} /> PM</span>
              )}
            </span>
            {/* Customer Count */}
            <span className="text-xs text-gray-400">
              {route.customer_count}/{route.max_stops}
            </span>
          </div>
        </div>

        {/* Load bar */}
        <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${loadPercent}%`,
              backgroundColor: loadPercent > 80 ? '#ef4444' : loadPercent > 50 ? '#f59e0b' : '#22c55e',
            }}
          />
        </div>
      </div>

      {/* Delivery Boy Info */}
      <div className="px-3.5 pb-2 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {route.delivery_partner_name ? (
            <span className="flex items-center gap-1">
              <UserCheck size={12} className="text-green-500" />
              {route.delivery_partner_name}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle size={12} /> No delivery boy
            </span>
          )}
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => { setShowAssign(!showAssign); setShowDelete(false); }}
            className="text-[11px] font-semibold text-brand-blue hover:text-brand-dark"
          >
            {route.delivery_partner_name ? 'Reassign' : 'Assign'}
          </button>
          <span className="text-gray-200">|</span>
          <button
            onClick={() => onViewRunSheet(route.id)}
            className="text-[11px] font-semibold text-green-600 hover:text-green-800"
          >
            Run Sheet
          </button>
          <span className="text-gray-200">|</span>
          <button
            onClick={() => { setShowDelete(!showDelete); setShowAssign(false); }}
            className="text-[11px] font-semibold text-red-500 hover:text-red-700"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Inline Assignment */}
      {showAssign && (
        <div
          className="px-3.5 pb-3 pt-1 border-t border-gray-50 flex items-center gap-2"
          onClick={e => e.stopPropagation()}
        >
          <select
            value={selectedBoyId}
            onChange={e => setSelectedBoyId(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none"
          >
            <option value="">Select delivery boy...</option>
            {deliveryPartners.map(db => (
              <option key={db.id} value={db.id}>{db.full_name}</option>
            ))}
          </select>
          <button
            onClick={() => {
              if (selectedBoyId) {
                onAssignBoy(route.id, selectedBoyId);
                setShowAssign(false);
                setSelectedBoyId('');
              }
            }}
            disabled={!selectedBoyId || assigning}
            className="px-2.5 py-1.5 bg-fresh-green text-white text-xs font-semibold rounded-md disabled:opacity-40"
          >
            {assigning ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
          </button>
        </div>
      )}

      {/* Inline Delete Confirmation */}
      {showDelete && (
        <div
          className="px-3.5 pb-3 pt-1 border-t border-red-50 flex items-center gap-2"
          onClick={e => e.stopPropagation()}
        >
          <span className="text-xs text-red-600 flex-1">Delete this route? Customers will go back to unrouted pool.</span>
          <button
            onClick={() => { onDelete(route.id); setShowDelete(false); }}
            className="px-2.5 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-md"
          >
            Confirm
          </button>
          <button
            onClick={() => setShowDelete(false)}
            className="px-2.5 py-1.5 bg-gray-100 text-gray-500 text-xs rounded-md"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
