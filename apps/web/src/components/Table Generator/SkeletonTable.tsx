// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : SkeletonTable.tsx
// Description : Skeleton table generator component for web panel
//
// ============================================================================

'use client';

import { getApiBaseUrl } from '@/lib/api-config';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Settings, RefreshCw, Trash2, X, Eye, Pencil } from 'lucide-react';
import Pagination from './Pagination';
import FilterModal, { ColumnMeta, FilterState } from './FilterModal';
import './SkeletonTable.css';

// ─── Types ───────────────────────────────────────────────────

interface Filters {
  search: string;
  dateRange: Record<string, { from: string; to: string }>;
  columns: Record<string, string[]>;
  sort: Record<string, 'asc' | 'desc'>;
  pagination: { page: number; limit: number };
}

interface TableState {
  loading: boolean;
  error: string | null;
  data: Record<string, any>[];
  columns: ColumnMeta[];
  recordsTotal: number;
  recordsFiltered: number;
  selectedRows: Set<string>;
  filters: Filters;
}

interface SkeletonTableProps {
  /**
   * Skeleton token identifying the table configuration.
   * Supports:
   * - logical key token: "central_skeleton_items_t"
   * - generated token token: "<generatedToken>_t"
   */
  token?: string;
  /**
   * Popup-style token inputs (same pattern as TokenContext):
   * metaKey -> resolves base token from /tokenForKeys, then sends "<baseToken>_<action>".
   * Example: metaKey="central_skeleton_items", action="t"
   */
  metaKey?: string;
  /** Action suffix like "t", "a", "e", "c" */
  action?: string;
  /**
   * Direct REST API endpoint (bypasses token system entirely).
   * Example: "/api/v1/customers/table"
   * When provided, uses GET with query params instead of POST /token.
   */
  apiEndpoint?: string;
  /** API base URL for backend requests */
  apiBaseUrl?: string;
  /** Callback when action buttons (view/edit/delete) are clicked */
  onAction?: (type: string, row: Record<string, any>) => void;
  /** Callback when row selection changes */
  onSelectionChange?: (ids: string[]) => void;
  /** Default number of rows per page */
  initialPageSize?: number;
  /** Additional CSS class for wrapper */
  className?: string;
  /** Show bulk action buttons */
  showBulkActions?: boolean;
  /** Visible row action buttons when onAction is provided */
  actionTypes?: Array<'view' | 'edit' | 'delete'>;
  /** Pass static data to bypass API layer completely */
  staticData?: Record<string, any>[];
  /** Pass static columns to bypass API layer completely */
  staticColumns?: ColumnMeta[];
}

// ─── Helpers ─────────────────────────────────────────────────

function sanitize(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toTitle(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as unknown as T;
}

const STORAGE_KEY = (token: string) => `skeleton-state-${token}`;

// ─── Skeleton Loader ─────────────────────────────────────────

function SkeletonLoader({ cols = 5, rows = 8 }: { cols?: number; rows?: number }) {
  return (
    <table className="skl-skeleton-table">
      <thead>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i}><div className="skl-skeleton-bar" /></th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c}><div className="skl-skeleton-bar" /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Memoized Table Row (prevents re-render of all rows on state changes) ────

interface TableRowProps {
  row: Record<string, any>;
  rowId: string;
  isSelected: boolean;
  visibleColumns: ColumnMeta[];
  hasCheckbox: boolean;
  hasActions: boolean;
  actionTypes: Array<'view' | 'edit' | 'delete'>;
  onRowSelect: (id: string, checked: boolean) => void;
  onAction?: (type: string, row: Record<string, any>) => void;
}

const TableRow = React.memo(function TableRow({
  row,
  rowId,
  isSelected,
  visibleColumns,
  hasCheckbox,
  hasActions,
  actionTypes,
  onRowSelect,
  onAction,
}: TableRowProps) {
  return (
    <tr style={isSelected ? { background: '#f0fdf4' } : undefined}>
      {/* Checkbox cell */}
      {hasCheckbox && (
        <td className="skl-checkbox-cell">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onRowSelect(rowId, e.target.checked)}
          />
        </td>
      )}

      {/* Data cells */}
      {visibleColumns.map(col => {
        const value = row[col.data];
        const isEmpty = value === null || value === undefined || value === '';

        return (
          <td
            key={col.data}
            data-column={col.data.toLowerCase()}
            className={isEmpty ? 'skl-empty-cell' : ''}
            title={typeof value === 'string' ? value.replace(/<[^>]*>/g, '') : String(value ?? '')}
          >
            {isEmpty ? '—' :
              col.renderHtml && typeof value === 'string' && value.includes('<') ?
                <span dangerouslySetInnerHTML={{ __html: value }} /> :
                String(value)
            }
          </td>
        );
      })}

      {/* Action cells */}
      {hasActions && (
        <td className="skl-actions-cell">
          {onAction ? (
            <div className="skl-actions-group">
              {actionTypes.includes('view') && (
                <button className="view" onClick={() => onAction('view', row)} title="View">
                  <Eye size={16} />
                </button>
              )}
              {actionTypes.includes('edit') && (
                <button className="edit" onClick={() => onAction('edit', row)} title="Edit">
                  <Pencil size={16} />
                </button>
              )}
              {actionTypes.includes('delete') && (
                <button className="delete" onClick={() => onAction('delete', row)} title="Delete">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ) : row.actions ? (
            <span dangerouslySetInnerHTML={{ __html: row.actions }} />
          ) : (
            <div className="skl-actions-group">—</div>
          )}
        </td>
      )}
    </tr>
  );
});

// ─── Main Component ──────────────────────────────────────────

export default function SkeletonTable({
  token,
  metaKey,
  action,
  apiEndpoint,
  apiBaseUrl = '',
  onAction,
  onSelectionChange,
  initialPageSize = 10,
  className = '',
  showBulkActions = false,
  actionTypes = ['view', 'edit', 'delete'],
  staticData,
  staticColumns,
}: SkeletonTableProps) {
  // ── State ────────────────────────────────────────────────
  const [state, setState] = useState<TableState>({
    loading: true,
    error: null,
    data: [],
    columns: [],
    recordsTotal: 0,
    recordsFiltered: 0,
    selectedRows: new Set(),
    filters: {
      search: '',
      dateRange: {},
      columns: {},
      sort: {},
      pagination: { page: 1, limit: initialPageSize },
    },
  });

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const [effectiveToken, setEffectiveToken] = useState<string | null>(token ?? null);

  // Ref to always access latest filters (avoids stale closures in handlers)
  const filtersRef = useRef(state.filters);
  filtersRef.current = state.filters;

  // AbortController: cancel stale API requests when new ones start
  const abortRef = useRef<AbortController | null>(null);

  // Prevent duplicate fetches when filters haven't actually changed
  const prevFiltersRef = useRef('');

  // ── Persist / Restore state from localStorage (debounced to avoid blocking) ─
  const stateKey = token ?? (metaKey && action ? `${metaKey}_${action}` : '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveState = useCallback(
    debounce((filters: Filters) => {
      try {
        if (!stateKey) return;
        localStorage.setItem(STORAGE_KEY(stateKey), JSON.stringify(filters));
      } catch { /* ignore */ }
    }, 1000),
    [stateKey]
  );

  const loadState = useCallback((): Partial<Filters> => {
    try {
      if (!stateKey) return {};
      const saved = localStorage.getItem(STORAGE_KEY(stateKey));
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {};
  }, [stateKey]);

  // ── Resolve popup-style token (metaKey + action) ───────────
  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (token) {
        setState(prev => ({ ...prev, error: null }));
        setEffectiveToken(token);
        return;
      }
      if (!metaKey || !action) {
        setEffectiveToken(null);
        return;
      }
      try {
        const apiUrl = apiBaseUrl || getApiBaseUrl();
        const resp = await fetch(`${apiUrl}/tokenForKeys`, {
          method: 'GET',
          credentials: 'include',
        });
        if (!resp.ok) throw new Error(`Failed to load tokens (${resp.status})`);
        const list = await resp.json();
        const found = Array.isArray(list)
          ? list.find((row: any) => Array.isArray(row) && row[1]?.key === metaKey)
          : null;
        const base = found?.[0];
        if (!base) {
          if (!cancelled) {
            setEffectiveToken(null);
            setState(prev => ({
              ...prev,
              loading: false,
              error: `Token base not found for metaKey: ${metaKey}`,
            }));
          }
          return;
        }
        const nextToken = `${base}_${action}`;
        if (!cancelled) {
          setState(prev => ({ ...prev, error: null }));
          setEffectiveToken(nextToken);
        }
      } catch (e: any) {
        if (!cancelled) {
          setEffectiveToken(null);
          setState(prev => ({ ...prev, loading: false, error: e?.message || 'Token resolution failed' }));
        }
      }
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [token, metaKey, action, apiBaseUrl]);

  // ── Fetch data from backend ──────────────────────────────
  const fetchData = useCallback(async (filters: Filters) => {
    // Cancel any in-flight request to prevent stale data
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiUrl = apiBaseUrl || getApiBaseUrl();

      // ─── REST Mode: Direct API endpoint (no tokens) ───────────
      if (apiEndpoint) {
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        if (filters.pagination?.page) params.set('page', String(filters.pagination.page));
        if (filters.pagination?.limit) params.set('limit', String(filters.pagination.limit));
        const sortEntries = Object.entries(filters.sort || {});
        if (sortEntries.length > 0) {
          params.set('sortBy', sortEntries[0][0]);
          params.set('sortDir', sortEntries[0][1].toUpperCase());
        }
        for (const [col, values] of Object.entries(filters.columns || {})) {
          const arr = Array.isArray(values) ? values : [values];
          arr.forEach(v => params.append(`col_${col}`, v));
        }
        for (const [col, range] of Object.entries(filters.dateRange || {})) {
          if (range?.from) params.set(`date_${col}_from`, range.from);
          if (range?.to) params.set(`date_${col}_to`, range.to);
        }

        const separator = apiEndpoint.includes('?') ? '&' : '?';
        const url = `${apiUrl}${apiEndpoint}${params.toString() ? separator + params.toString() : ''}`;

        const response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errData = await response.json();
            errorMsg = errData.message || errData.error || errorMsg;
          } catch { /* not json */ }
          throw new Error(errorMsg);
        }

        const result = await response.json();
        if (result.status === false && !Array.isArray(result.columns)) {
          throw new Error(result.message || 'Failed to fetch table data');
        }
        return result;
      }

      // ─── Token Mode: Legacy /token POST endpoint ──────────────
      // Token may still be resolving (metaKey/action flow). Treat as "no-op" until available.
      if (!effectiveToken) return null;
      const response = await fetch(`${apiUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // httpOnly cookie auth
        signal: controller.signal, // abort signal for cancellation
        body: JSON.stringify({
          token: effectiveToken,
          // Align with popup request shape: backend expects { token, data }
          data: {
            filters: {
              search: filters.search || '',
              dateRange: filters.dateRange || {},
              columns: filters.columns || {},
              sort: filters.sort || {},
              pagination: { type: 'offset', ...(filters.pagination || { page: 1, limit: 10 }) },
            },
          },
        }),
      });

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errData = await response.json();
          errorMsg = errData.message || errData.error || errorMsg;
          console.error("Backend Error Data:", errData);
        } catch { /* not json */ }
        throw new Error(errorMsg);
      }

      const result = await response.json();

      if (result.status === false) {
        throw new Error(result.message || 'Failed to fetch table data');
      }

      return result;
    } catch (err: any) {
      // Don't throw on abort — it's intentional cancellation
      if (err.name === 'AbortError') return null;
      throw err;
    }
  }, [effectiveToken, apiEndpoint, apiBaseUrl]);

  // ── Load data (initial + on filter change) ───────────────
  const loadData = useCallback(async (filters: Filters) => {
    if (!mountedRef.current) return;

    // Bypass fetch if static data is supplied
    if (staticData && staticColumns) {
      setState(prev => ({ ...prev, loading: prev.data.length === 0, error: null }));
      setRefreshing(true);

      const filterKey = JSON.stringify(filters);
      if (filterKey === prevFiltersRef.current) {
        setRefreshing(false);
        return;
      }
      prevFiltersRef.current = filterKey;

      try {
        let processedData = [...staticData];

        // Apply Search
        if (filters.search) {
          const lowerQ = filters.search.toLowerCase();
          processedData = processedData.filter(item =>
            Object.values(item).some(v => String(v).toLowerCase().includes(lowerQ))
          );
        }

        // Apply Column Filters
        for (const [col, values] of Object.entries(filters.columns)) {
          const arr = Array.isArray(values) ? values : [values];
          if (arr.length > 0) {
            processedData = processedData.filter(item => arr.includes(String(item[col])));
          }
        }

        // Sort
        const sortEntries = Object.entries(filters.sort);
        if (sortEntries.length > 0) {
          const [sortCol, dir] = sortEntries[0];
          processedData.sort((a, b) => {
            const av = a[sortCol];
            const bv = b[sortCol];
            if (av < bv) return dir === 'asc' ? -1 : 1;
            if (av > bv) return dir === 'asc' ? 1 : -1;
            return 0;
          });
        }

        const filteredCount = processedData.length;

        // Pagination
        const { page, limit } = filters.pagination;
        const start = (page - 1) * limit;
        const end = start + limit;
        processedData = processedData.slice(start, end);

        setState(prev => ({
          ...prev,
          loading: false,
          error: null,
          data: processedData,
          columns: staticColumns,
          recordsTotal: staticData.length,
          recordsFiltered: filteredCount,
          filters,
        }));
        saveState(filters);
      } finally {
        setRefreshing(false);
      }
      return;
    }

    if (!effectiveToken && !apiEndpoint) return;

    // Skip duplicate fetches if filters haven't changed
    const filterKey = JSON.stringify(filters);
    if (filterKey === prevFiltersRef.current) return;
    prevFiltersRef.current = filterKey;

    // Stale-while-revalidate: only show full loading skeleton on first load (no data yet)
    // On subsequent loads (pagination, sort, filter), keep old data visible with overlay
    setState(prev => ({ ...prev, loading: prev.data.length === 0, error: null }));
    setRefreshing(true);

    try {
      const result = await fetchData(filters);

      // result is null when request was aborted (stale request cancelled)
      if (!result || !mountedRef.current) return;

      setState(prev => ({
        ...prev,
        loading: false,
        error: null,
        data: Array.isArray(result.data) ? result.data : [],
        columns: Array.isArray(result.columns) ? result.columns : prev.columns,
        recordsTotal: result.recordsTotal ?? 0,
        recordsFiltered: result.recordsFiltered ?? 0,
        filters,
      }));

      saveState(filters);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setState(prev => ({
        ...prev,
        loading: false,
        error: err?.message || 'Unknown error',
      }));
    } finally {
      setRefreshing(false);
    }
  }, [fetchData, saveState, staticData, staticColumns]);

  // ── Initial load ─────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    // Wait until token is resolved (metaKey/action mode) before first fetch.
    // Skip this check if apiEndpoint is provided (REST mode, no token needed).
    if (!effectiveToken && !staticData && !apiEndpoint) {
      setState(prev => ({ ...prev, loading: prev.data.length === 0, error: prev.error }));
      return () => { mountedRef.current = false; };
    }

    // Reset duplicate-fetch guard when token changes
    prevFiltersRef.current = '';

    const savedFilters = loadState();
    const initialFilters: Filters = {
      search: '',
      dateRange: {},
      columns: {},
      sort: {},
      pagination: { page: 1, limit: initialPageSize },
      ...savedFilters,
    };
    loadData(initialFilters);
    return () => { mountedRef.current = false; };
  }, [effectiveToken, apiEndpoint, loadState, loadData, initialPageSize]);

  // ── Notify selection changes ─────────────────────────────
  useEffect(() => {
    onSelectionChange?.(Array.from(state.selectedRows));
  }, [state.selectedRows, onSelectionChange]);

  // ── Filter handlers (loadData called OUTSIDE setState to avoid stale closures) ──

  // Helper: update filters in state + trigger server fetch
  const applyFilters = useCallback((newFilters: Filters) => {
    setState(prev => ({ ...prev, filters: newFilters }));
    loadData(newFilters);
  }, [loadData]);

  // Debounced search (250ms for faster perceived responsiveness)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((searchValue: string) => {
      const newFilters = {
        ...filtersRef.current,
        search: searchValue,
        pagination: { ...filtersRef.current.pagination, page: 1 },
      };
      applyFilters(newFilters);
    }, 250),
    [applyFilters]
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  const handleSort = (colData: string) => {
    const current = filtersRef.current.sort[colData];
    const newDir: 'asc' | 'desc' = current === 'asc' ? 'desc' : 'asc';
    const newFilters = {
      ...filtersRef.current,
      sort: { [colData]: newDir },
    };
    applyFilters(newFilters);
  };

  const handlePageChange = (page: number) => {
    const newFilters = {
      ...filtersRef.current,
      pagination: { ...filtersRef.current.pagination, page },
    };
    applyFilters(newFilters);
  };

  const handleLimitChange = (limit: number) => {
    const newFilters = {
      ...filtersRef.current,
      pagination: { page: 1, limit },
    };
    applyFilters(newFilters);
  };

  const handleRefresh = async () => {
    if (refreshing) return; // prevent double-click
    // Clear prevFiltersRef so refresh always fetches fresh data
    prevFiltersRef.current = '';
    setRefreshing(true);
    try {
      const [result] = await Promise.all([
        fetchData(filtersRef.current),
        new Promise(r => setTimeout(r, 400)), // minimum visible spin duration
      ]);
      if (!result || !mountedRef.current) return;
      setState(prev => ({
        ...prev,
        loading: false,
        error: null,
        data: Array.isArray(result.data) ? result.data : [],
        columns: Array.isArray(result.columns) ? result.columns : prev.columns,
        recordsTotal: result.recordsTotal ?? 0,
        recordsFiltered: result.recordsFiltered ?? 0,
        filters: filtersRef.current,
      }));
      saveState(filtersRef.current);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setState(prev => ({ ...prev, loading: false, error: err?.message || 'Refresh failed' }));
    } finally {
      setRefreshing(false);
    }
  };

  const handleFilterApply = (filterState: FilterState) => {
    const newFilters: Filters = {
      ...filtersRef.current,
      columns: filterState.columns,
      dateRange: filterState.dateRange,
      pagination: { ...filtersRef.current.pagination, page: 1 },
    };
    applyFilters(newFilters);
  };

  const handleClearAll = () => {
    const newFilters: Filters = {
      search: '',
      dateRange: {},
      columns: {},
      sort: {},
      pagination: { page: 1, limit: filtersRef.current.pagination.limit },
    };
    if (searchInputRef.current) searchInputRef.current.value = '';
    setState(prev => ({ ...prev, filters: newFilters, selectedRows: new Set() }));
    loadData(newFilters);
  };

  // ── Selection handlers ───────────────────────────────────
  const handleRowSelect = (id: string, checked: boolean) => {
    setState(prev => {
      const next = new Set(prev.selectedRows);
      if (checked) next.add(id); else next.delete(id);
      return { ...prev, selectedRows: next };
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setState(prev => {
      if (checked) {
        const allIds = new Set(prev.data.map(row =>
          String(row.user_id || row.id || row._id || '')
        ).filter(Boolean));
        return { ...prev, selectedRows: allIds };
      }
      return { ...prev, selectedRows: new Set() };
    });
  };

  // ── Build filter pills ───────────────────────────────────
  const pills: { label: string; onRemove: () => void }[] = [];

  if (state.filters.search) {
    pills.push({
      label: `Search: ${state.filters.search}`,
      onRemove: () => {
        if (searchInputRef.current) searchInputRef.current.value = '';
        const newFilters = { ...state.filters, search: '' };
        loadData(newFilters);
        setState(prev => ({ ...prev, filters: newFilters }));
      },
    });
  }

  for (const [col, values] of Object.entries(state.filters.columns)) {
    const colDef = state.columns.find(c => c.data === col);
    const colTitle = colDef?.title || toTitle(col);
    (Array.isArray(values) ? values : [values]).forEach(val => {
      pills.push({
        label: `${colTitle}: ${val}`,
        onRemove: () => {
          const newCols = { ...state.filters.columns };
          const arr = Array.isArray(newCols[col]) ? newCols[col] : [newCols[col]];
          const filtered = arr.filter(v => v !== val);
          if (filtered.length === 0) delete newCols[col]; else newCols[col] = filtered;
          const newFilters = { ...state.filters, columns: newCols, pagination: { ...state.filters.pagination, page: 1 } };
          loadData(newFilters);
          setState(prev => ({ ...prev, filters: newFilters }));
        },
      });
    });
  }

  for (const [col, range] of Object.entries(state.filters.dateRange)) {
    if (range?.from && range?.to) {
      pills.push({
        label: `Date: ${range.from} to ${range.to}`,
        onRemove: () => {
          const newDateRange = { ...state.filters.dateRange };
          delete newDateRange[col];
          const newFilters = { ...state.filters, dateRange: newDateRange, pagination: { ...state.filters.pagination, page: 1 } };
          loadData(newFilters);
          setState(prev => ({ ...prev, filters: newFilters }));
        },
      });
    }
  }

  // ── Memoized Computed values (avoid recomputation on unrelated state changes) ──
  const visibleColumns = useMemo(() =>
    state.columns.filter(
      col => col.visible !== false && col.data !== 'selection' && col.data !== 'actions'
    ),
    [state.columns]
  );
  const hasActions = useMemo(() => state.columns.some(c => c.data === 'actions'), [state.columns]);
  const hasCheckbox = useMemo(() => state.columns.some(c => c.data === 'selection'), [state.columns]);
  const { page, limit } = state.filters.pagination;
  const totalPages = Math.ceil(state.recordsFiltered / limit);
  const startRecord = state.data.length > 0 ? (page - 1) * limit + 1 : 0;
  const endRecord = Math.min(page * limit, state.recordsFiltered);
  const allSelected = state.data.length > 0 && state.selectedRows.size === state.data.length;

  // ── Render ───────────────────────────────────────────────

  // Loading state
  if (state.loading && state.data.length === 0) {
    return (
      <div className={`skl-table-container ${className}`}>
        <SkeletonLoader cols={5} rows={8} />
      </div>
    );
  }

  // Error state
  if (state.error && state.data.length === 0) {
    return (
      <div className={`skl-table-container ${className}`}>
        <div className="skl-alert skl-alert-danger">
          <strong>Error: </strong>{state.error}
        </div>
      </div>
    );
  }

  return (
    <div className={`skl-table-container ${className}`}>
      {/* ── Toolbar ────────────────────────────────────────── */}
      <div className="skl-toolbar">
        <div className="skl-toolbar-left">
          {/* Length menu */}
          <div className="skl-length-menu">
            <span>Showing</span>
            <select
              className="skl-length-select"
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
            <span>entries per page</span>
          </div>

        </div>

        <div className="skl-toolbar-right">
          {/* Bulk actions */}
          {(showBulkActions || hasCheckbox) && state.selectedRows.size > 0 && (
            <div className="skl-action-icons">
              <button
                className="skl-btn-delete"
                title="Delete Selected"
                onClick={() => onAction?.('bulk-delete', { ids: Array.from(state.selectedRows) })}
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}

          {/* Search */}
          <input
            ref={searchInputRef}
            type="search"
            className="skl-filter-search"
            placeholder="Search..."
            defaultValue={state.filters.search}
            onChange={handleSearch}
          />

          {/* Refresh */}
          <button
            className={`skl-icon-btn ${refreshing ? 'text-green-500' : ''}`}
            title="Refresh Table"
            onClick={handleRefresh}
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>

          {/* Filter modal toggle */}
          <button
            className={`skl-icon-btn${pills.length > 0 ? ' active' : ''}`}
            title="Filter Table"
            onClick={() => setFilterModalOpen(true)}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* ── Filter Pills ──────────────────────────────────── */}
      {pills.length > 0 && (
        <div className="skl-pill-row">
          <div className="skl-pill-container">
            {pills.map((pill, i) => (
              <span key={i} className="skl-pill">
                {pill.label}
                <button className="skl-pill-close" onClick={pill.onRemove} title="Remove"><X size={12} strokeWidth={3} /></button>
              </span>
            ))}
          </div>
          <button className="skl-clear-all" onClick={handleClearAll}>
            Clear all filters
          </button>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="skl-table-wrapper">
        {/* Loading overlay for page transitions */}
        {refreshing && state.data.length > 0 && (
          <div className="skl-loading-overlay">
            <div className="skl-loading-spinner" />
          </div>
        )}
        <table className="skl-table">
          <thead>
            <tr>
              {/* Checkbox header */}
              {hasCheckbox && (
                <th className="skl-checkbox-cell">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    title="Select all"
                  />
                </th>
              )}

              {/* Data headers */}
              {visibleColumns.map(col => (
                <th
                  key={col.data}
                  data-column={col.data.toLowerCase()}
                  className={col.orderable ? 'sortable' : ''}
                  onClick={() => col.orderable && handleSort(col.data)}
                >
                  {col.title}
                  {col.orderable && (
                    <span className={`skl-sort-icon${state.filters.sort[col.data] ? ' active' : ''}`}>
                      {state.filters.sort[col.data] === 'asc' ? ' ↑' :
                        state.filters.sort[col.data] === 'desc' ? ' ↓' : ' ↕'}
                    </span>
                  )}
                </th>
              ))}

              {/* Actions header */}
              {hasActions && (
                <th className="skl-actions-cell">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {state.data.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (hasCheckbox ? 1 : 0) + (hasActions ? 1 : 0)}
                  style={{ textAlign: 'center', padding: '30px', color: '#999' }}
                >
                  No records available
                </td>
              </tr>
            ) : (
              state.data.map((row, index) => {
                const rowId = String(row.user_id || row.id || row._id || index);
                const isSelected = state.selectedRows.has(rowId);

                return (
                  <TableRow
                    key={`${rowId}-${index}`}
                    row={row}
                    rowId={rowId}
                    isSelected={isSelected}
                    visibleColumns={visibleColumns}
                    hasCheckbox={hasCheckbox}
                    hasActions={hasActions}
                    actionTypes={actionTypes}
                    onRowSelect={handleRowSelect}
                    onAction={onAction}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination Bar ─────────────────────────────────── */}
      <div className="skl-pagination-bar">
        <div className="skl-info">
          Showing {startRecord} to {endRecord} of {state.recordsFiltered} entries
          {state.recordsTotal !== state.recordsFiltered && (
            <span className="skl-info-filtered"> (Total: {state.recordsTotal})</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            className="skl-length-select"
            value={limit}
            onChange={(e) => handleLimitChange(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
          </select>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* ── Filter Modal ──────────────────────────────────── */}
      <FilterModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        columns={state.columns}
        currentFilters={{
          columns: state.filters.columns,
          dateRange: state.filters.dateRange,
        }}
        onApply={handleFilterApply}
      />
    </div>
  );
}
