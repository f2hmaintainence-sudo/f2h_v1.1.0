'use client';

import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { showErrorToast } from '@/components/Toast';

// ─── Types ───────────────────────────────────────────────────

export interface ColumnMeta {
  data: string;
  name: string;
  title: string;
  orderable: boolean;
  searchable: boolean;
  visible: boolean;
  renderHtml: boolean;
  isDate: boolean;
}

export interface FilterState {
  columns: Record<string, string[]>;
  dateRange: Record<string, { from: string; to: string }>;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnMeta[];
  currentFilters: FilterState;
  onApply: (filters: FilterState) => void;
}

// ─── Tag Input Sub-Component ─────────────────────────────────

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (trimmed && !values.includes(trimmed)) {
        onChange([...values, trimmed]);
      }
      setInputValue('');
    },
    [values, onChange]
  );

  const removeTag = useCallback(
    (idx: number) => {
      onChange(values.filter((_, i) => i !== idx));
    },
    [values, onChange]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && values.length > 0) {
      removeTag(values.length - 1);
    }
  };

  return (
    <div className="skl-tag-container" onClick={() => inputRef.current?.focus()}>
      {values.map((v, i) => (
        <span key={`${v}-${i}`} className="skl-tag">
          {v}
          <button type="button" className="skl-tag-remove" onClick={() => removeTag(i)}>
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="skl-tag-input"
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
        placeholder={values.length === 0 ? placeholder : ''}
      />
    </div>
  );
}

// ─── Main FilterModal Component ──────────────────────────────

export default function FilterModal({
  isOpen,
  onClose,
  columns,
  currentFilters,
  onApply,
}: FilterModalProps) {
  // Local state for editing (changes only committed on Apply)
  const [tempColumns, setTempColumns] = useState<Record<string, string[]>>(
    () => JSON.parse(JSON.stringify(currentFilters.columns ?? {}))
  );
  const [dateFrom, setDateFrom] = useState(
    currentFilters.dateRange?.created_at?.from ?? ''
  );
  const [dateTo, setDateTo] = useState(
    currentFilters.dateRange?.created_at?.to ?? ''
  );

  // Reset local state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTempColumns(JSON.parse(JSON.stringify(currentFilters.columns ?? {})));
      setDateFrom(currentFilters.dateRange?.created_at?.from ?? '');
      setDateTo(currentFilters.dateRange?.created_at?.to ?? '');
    }
  }, [isOpen, currentFilters]);

  if (!isOpen) return null;

  const searchableColumns = columns.filter(
    (col) =>
      col.searchable &&
      col.visible &&
      col.data !== 'selection' &&
      col.data !== 'actions' &&
      col.data !== 'created_at'
  );

  const handleApply = () => {
    const newFilters: FilterState = {
      columns: { ...tempColumns },
      dateRange: {},
    };

    // Only include non-empty column filters
    for (const key of Object.keys(newFilters.columns)) {
      if (!newFilters.columns[key] || newFilters.columns[key].length === 0) {
        delete newFilters.columns[key];
      }
    }

    // Date range
    if (dateFrom && dateTo) {
      if (new Date(dateFrom) > new Date(dateTo)) {
        showErrorToast('From date cannot be after To date');
        return;
      }
      newFilters.dateRange.created_at = { from: dateFrom, to: dateTo };
    }

    onApply(newFilters);
    onClose();
  };

  const handleClear = () => {
    setTempColumns({});
    setDateFrom('');
    setDateTo('');
    onApply({ columns: {}, dateRange: {} });
    onClose();
  };

  return (
    <div className="skl-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="skl-modal">
        {/* Header */}
        <div className="skl-modal-header">
          <h5 className="skl-modal-title">Apply Filters</h5>
          <button className="skl-modal-close" onClick={onClose} title="Close">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="skl-modal-body">
          {/* Date Range */}
          <div className="skl-date-range-section">
            <label>Date Range</label>
            <div className="skl-date-range-inputs">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From"
              />
              <span>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To"
              />
            </div>
          </div>

          {/* Column Filters with Tag Inputs */}
          <div className="skl-filter-grid">
            {searchableColumns.map((col, idx) => (
              <div key={`${col.data}-${idx}`} className="skl-filter-field">
                <label>{col.title}</label>
                <TagInput
                  values={tempColumns[col.data] ?? []}
                  onChange={(vals) =>
                    setTempColumns((prev) => ({ ...prev, [col.data]: vals }))
                  }
                  placeholder={col.title}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="skl-modal-footer">
          <button className="skl-btn skl-btn-secondary" onClick={handleClear}>
            Clear
          </button>
          <button className="skl-btn skl-btn-primary" onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
