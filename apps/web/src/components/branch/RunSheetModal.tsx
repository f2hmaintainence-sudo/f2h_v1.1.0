// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : RunSheetModal.tsx
// Description : Run sheet modal component for branch management
//
// ============================================================================

'use client';

import { getApiBaseUrl } from '@/lib/api-config';

import React, { useState, useEffect } from 'react';
import {
  X, Printer, Sun, Moon, MapPin, Phone, User,
  Package, Loader2, Calendar, ClipboardList
} from 'lucide-react';

const API = getApiBaseUrl();

interface RunSheetModalProps {
  routeId: string;
  onClose: () => void;
}

export default function RunSheetModal({ routeId, onClose }: RunSheetModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!routeId) return;
    setLoading(true);
    fetch(`${API}/api/zone/routes/${routeId}/runsheet?date=${date}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.status) setData(d.data);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [routeId, date]);

  const handlePrint = () => {
    const printArea = document.getElementById('runsheet-print-area');
    if (!printArea) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
      <head>
        <title>Run Sheet - ${data?.route?.route_name || ''}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          .meta { font-size: 12px; color: #666; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #f5f5f5; text-align: left; padding: 8px; border: 1px solid #ddd; font-weight: 600; }
          td { padding: 8px; border: 1px solid #ddd; }
          tr:nth-child(even) { background: #fafafa; }
          .seq { font-weight: bold; text-align: center; width: 40px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${printArea.innerHTML}
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/50 shadow-xs">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {data?.route?.route_name || 'Run Sheet'}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>Dispatch manifest &amp; customer order sequence layout</span>
                <span>•</span>
                {data?.route?.shift_type === 'morning' ? (
                  <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium"><Sun size={11} /> Morning</span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-indigo-600 font-medium"><Moon size={11} /> Evening</span>
                )}
                {data?.route?.delivery_partner_name && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-0.5 font-medium text-slate-700">
                      <User size={11} /> {data.route.delivery_partner_name}
                    </span>
                  </>
                )}
                <span>•</span>
                <span className="font-semibold text-slate-700">{data?.total_stops || 0} stops</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none"
            />
            <button
              onClick={handlePrint}
              className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              title="Print"
            >
              <Printer size={16} className="text-gray-600" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-lg">
              <X size={16} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4" id="runsheet-print-area">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-gray-400" />
            </div>
          ) : !data?.customers?.length ? (
            <div className="text-center py-12">
              <Package size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No customers in this route yet.</p>
              <p className="text-gray-300 text-xs mt-1">Assign customers from the unrouted pool.</p>
            </div>
          ) : (
            <>
              <h1 style={{ display: 'none' }} className="print-only">
                {data.route.route_name} — {date}
              </h1>
              <div className="meta" style={{ display: 'none' }}>
                Boy: {data.route.delivery_partner_name || 'Unassigned'} | Shift: {data.route.shift_type === 'M' ? 'Morning' : 'Evening'} | Stops: {data.total_stops}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 w-12">#</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Customer</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Address</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Phone</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers.map((c: any, i: number) => (
                    <tr key={c.customer_id} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="text-center px-3 py-2.5 font-bold text-gray-400">{c.sequence_number || i + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-gray-800">{c.full_name || '—'}</div>
                        {c.apartment_name && (
                          <div className="text-[11px] text-gray-400 mt-0.5">{c.apartment_name}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[200px] truncate">
                        {c.apartment_name || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">{c.phone || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs">{c.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Footer */}
        {data?.customers?.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>Total stops: <strong className="text-gray-600">{data.total_stops}</strong></span>
            <span>Generated: {new Date().toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
