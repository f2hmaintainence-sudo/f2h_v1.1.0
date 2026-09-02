'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Trash2,
  Eye,
  Pencil,
  Search,
  ChevronLeft,
  ChevronRight,
  Package,
  SlidersHorizontal,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import './SkeletonTable.css';
import FilterModal, { ColumnMeta, FilterState } from './FilterModal';

interface SkeletonCardProps {
  apiEndpoint: string;
  onAction?: (type: string, row: Record<string, any>) => void;
  initialPageSize?: number;
  className?: string;
}

export default function SkeletonCard({
  apiEndpoint,
  onAction,
  initialPageSize = 12,
  className = '',
}: SkeletonCardProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filter state
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    columns: {},
    dateRange: {},
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const url = new URL(apiEndpoint, baseUrl || window.location.origin);
      url.searchParams.append('page', String(page));
      url.searchParams.append('limit', String(initialPageSize));
      url.searchParams.append('search', debouncedSearch);

      // Add column filters
      for (const [col, vals] of Object.entries(filters.columns)) {
        if (vals && vals.length > 0) {
          vals.forEach(v => url.searchParams.append(`col_${col}[]`, v));
        }
      }

      // Add date range
      if (filters.dateRange.created_at) {
        url.searchParams.append('date_created_at_from', filters.dateRange.created_at.from);
        url.searchParams.append('date_created_at_to', filters.dateRange.created_at.to);
      }

      const res = await fetch(url.toString(), { credentials: 'include' });
      const result = await res.json();

      if (result.status || result.data) {
        const rawData = Array.isArray(result.data) ? result.data : [];
        const cleanData = rawData.filter(
          (row: Record<string, any>) => row.deleted_at === null || row.deleted_at === undefined || row.deleted_at === ''
        );
        setData(cleanData);
        // Normalize columns for FilterModal
        const normalizedCols = (result.columns || []).map((c: any) => ({
          ...c,
          visible: c.visible !== false,
          searchable: c.searchable !== false,
          orderable: c.orderable !== false,
        }));
        setColumns(normalizedCols);
        setTotal(result.recordsFiltered || result.recordsTotal || cleanData.length);
      }
    } catch (error) {
      console.error('Failed to fetch card data:', error);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, page, initialPageSize, debouncedSearch, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / initialPageSize);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    Object.values(filters.columns).forEach(v => { if (v && v.length > 0) count++; });
    if (filters.dateRange.created_at) count++;
    return count;
  }, [filters]);

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-1">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name, slug or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-fresh-green/10 focus:border-fresh-green transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setFilterModalOpen(true)}
            className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border transition-all font-bold text-sm ${activeFilterCount > 0 ? 'bg-fresh-green border-fresh-green text-white shadow-lg shadow-fresh-green/20' : 'bg-white border-gray-100 text-gray-600 hover:border-fresh-green hover:text-fresh-green shadow-sm'}`}
          >
            <SlidersHorizontal size={18} />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-fresh-green text-[10px] font-black">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            onClick={() => fetchData()}
            className="p-3 bg-white border border-gray-100 text-gray-400 hover:text-fresh-green hover:border-fresh-green/30 rounded-2xl transition-all shadow-sm group"
            title="Refresh"
          >
            <RefreshCw size={20} className={`${loading ? 'animate-spin text-fresh-green' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(initialPageSize)].map((_, i) => (
            <div key={i} className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm animate-pulse">
              <div className="h-48 bg-gray-50 rounded-3xl mb-6" />
              <div className="space-y-3">
                <div className="h-4 bg-gray-50 rounded-full w-2/3" />
                <div className="h-3 bg-gray-50 rounded-full w-1/2" />
                <div className="pt-4 flex gap-2">
                  <div className="h-8 bg-gray-50 rounded-xl flex-1" />
                  <div className="h-8 bg-gray-50 rounded-xl w-8" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-[40px] border border-gray-100 p-20 text-center shadow-sm">
          <div className="inline-flex items-center justify-center h-24 w-24 rounded-[32px] bg-fresh-green/5 text-fresh-green mb-6">
            <Package size={48} />
          </div>
          <h4 className="text-xl font-black text-gray-800 mb-2">No items found</h4>
          <p className="text-gray-500 max-w-xs mx-auto text-sm leading-relaxed">We couldn't find any results matching your current search or filters. Try adjusting them!</p>
          <button
            onClick={() => { setSearch(''); setFilters({ columns: {}, dateRange: {} }); }}
            className="mt-8 text-fresh-green font-black text-sm uppercase tracking-widest hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data.map((row, idx) => (
            <div
              key={`${row.id || idx}-${idx}`}
              className="group bg-white rounded-[32px] p-2 border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-gray-200/50 transition-all duration-500 relative flex flex-col"
            >
              <div className="relative" style={{ aspectRatio: '4/3', background: 'var(--color-background-secondary, #f5f5f5)', overflow: 'hidden' }}>

                {(() => {
                  // Categories use image_path, Products use image_url (raw string)
                  const rawUrl = row.image_url || row.image_path || (row.url && !row.url.startsWith('<') ? row.url : null);
                  if (!rawUrl) return null;

                  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
                  let fullUrl = rawUrl;

                  if (!rawUrl.startsWith('http') && !rawUrl.startsWith('data:')) {
                    // If it's a relative path (e.g., 'products/img.webp' or 'categories/img.webp')
                    // Ensure it has the /uploads/ prefix
                    const path = rawUrl.startsWith('uploads/') ? rawUrl : `uploads/${rawUrl.replace(/^\//, '')}`;
                    fullUrl = `${baseUrl.replace(/\/$/, '')}/${path}`;
                  }

                  return (
                    <img
                      src={fullUrl}
                      alt={row.name}
                      className="w-full h-full object-cover block"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  );
                })()}



                {/* Badges */}
                <div className="absolute top-2 left-2 right-2 flex justify-between items-center">
                  <span className="text-[11px] font-medium px-2 py-1 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}>
                    #{row.id}
                  </span>
                  <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${row.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-500'
                    }`}>
                    {row.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* View Button Overlay */}
                <button
                  onClick={() => onAction?.('view', row)}
                  className="absolute bottom-4 right-4 w-10 h-10 bg-white rounded-2xl shadow-lg flex items-center justify-center text-gray-800 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:bg-fresh-green hover:text-white"
                >
                  <ArrowUpRight size={20} />
                </button>
              </div>

              {/* Content Area */}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black text-fresh-green bg-fresh-green/5 px-2 py-0.5 rounded uppercase tracking-wider">
                    {row.category_name || 'Catalog'}
                  </span>
                </div>

                <h3 className="text-lg font-black text-gray-800 line-clamp-1 mb-1 group-hover:text-fresh-green transition-colors duration-300">
                  {row.name}
                </h3>
                <p className="text-xs text-gray-400 font-medium line-clamp-1 mb-4 italic">
                  {row.slug}
                </p>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6 pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-green-50 text-brand-blue flex items-center justify-center">
                      <Layers size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-gray-300 uppercase leading-none mb-1">Unit Type</span>
                      <span className="text-[11px] font-bold text-gray-700">{row.unit_type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold text-xs italic">
                      %
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-gray-300 uppercase leading-none mb-1">GST Rate</span>
                      <span className="text-[11px] font-bold text-gray-700">{row.gst_percentage}%</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-auto">
                  <button
                    onClick={() => onAction?.('edit', row)}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-12 bg-fresh-green/5 text-fresh-green rounded-2xl text-xs font-black hover:bg-fresh-green hover:text-white transition-all duration-300 uppercase tracking-widest"
                  >
                    <Pencil size={14} />
                    Edit Item
                  </button>
                  <button
                    onClick={() => onAction?.('delete', row)}
                    className="w-12 h-12 inline-flex items-center justify-center bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all duration-300"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1 mt-6">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
            Showing Page <span className="text-gray-800">{page}</span> of <span className="text-fresh-green">{totalPages}</span>
          </p>
          <div className="flex items-center gap-3">
            <button
              disabled={page === 1}
              onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="px-4 py-2 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-fresh-green hover:border-fresh-green/30 disabled:opacity-30 transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
            >
              <ChevronLeft size={18} />
              Prev
            </button>
            <div className="h-6 w-px bg-gray-100" />
            <button
              disabled={page === totalPages}
              onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="px-4 py-2 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-fresh-green hover:border-fresh-green/30 disabled:opacity-30 transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <FilterModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        columns={columns}
        currentFilters={filters}
        onApply={(f) => { setFilters(f); setPage(1); }}
      />
    </div>
  );
}
