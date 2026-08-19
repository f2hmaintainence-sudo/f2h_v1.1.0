// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : ExportDropdown.tsx
// Description : Reusable dropdown button for Excel (.xlsx) and CSV export
// ============================================================================

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown, Loader2 } from 'lucide-react';

export interface ExportDropdownProps {
  onExportExcel: () => void;
  onExportCsv: () => void;
  isExporting?: boolean;
  count?: number;
  label?: string;
  className?: string;
}

export default function ExportDropdown({
  onExportExcel,
  onExportCsv,
  isExporting = false,
  count,
  label = 'Export',
  className = '',
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isExporting}
        className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all disabled:opacity-50 select-none cursor-pointer"
        title="Export options (Excel / CSV)"
      >
        {isExporting ? (
          <Loader2 size={14} className="animate-spin text-white" />
        ) : (
          <Download size={14} />
        )}
        <span>
          {isExporting ? 'Exporting...' : label}
          {count !== undefined && count !== null ? ` (${count})` : ''}
        </span>
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-white border border-gray-200 shadow-xl z-50 py-1.5 animate-in fade-in-50 zoom-in-95">
          <div className="px-3 py-1.5 border-b border-gray-100 mb-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
              Select Export Format
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onExportExcel();
            }}
            disabled={isExporting}
            className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-emerald-50 hover:text-emerald-900 transition-colors flex items-center gap-2.5 group"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <FileSpreadsheet size={15} />
            </div>
            <div>
              <p className="font-bold leading-tight">Export Excel (.xlsx)</p>
              <p className="text-[10px] text-gray-400 font-normal mt-0.5">Formatted spreadsheet</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onExportCsv();
            }}
            disabled={isExporting}
            className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-emerald-50 hover:text-emerald-900 transition-colors flex items-center gap-2.5 group"
          >
            <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <FileText size={15} />
            </div>
            <div>
              <p className="font-bold leading-tight">Export CSV (.csv)</p>
              <p className="text-[10px] text-gray-400 font-normal mt-0.5">Comma-separated values</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
