'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  X,
  FileText,
  Search,
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Database,
  Filter,
} from 'lucide-react';
import { api } from '@/services/api.client';

interface SubscriptionLog {
  id: string | number;
  subscription_id?: string;
  subscription_item_id?: string;
  action: string;
  old_data?: Record<string, any> | string | null;
  new_data?: Record<string, any> | string | null;
  created_by?: string;
  created_at?: string;
}

interface SubscriptionLogsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filterSubscriptionId?: string | null;
}

export default function SubscriptionLogsDrawer({
  isOpen,
  onClose,
  filterSubscriptionId,
}: SubscriptionLogsDrawerProps) {
  const [logs, setLogs] = useState<SubscriptionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | number | null>(null);

  const pageSize = 10;

  const fetchLogs = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const params: any = {
        page: currentPage,
        limit: pageSize,
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      if (filterSubscriptionId) {
        params.search = filterSubscriptionId;
      }

      if (selectedAction !== 'all') {
        params.action = selectedAction;
      }

      const res = await api.get<any>('/subscriptions/logs/table', { params });
      if (res.data) {
        let items: SubscriptionLog[] = [];
        let total = 0;

        if (Array.isArray(res.data.data?.data)) {
          items = res.data.data.data;
          total = res.data.data.total ?? res.data.data.recordsTotal ?? items.length;
        } else if (Array.isArray(res.data.data)) {
          items = res.data.data;
          total = res.data.recordsTotal ?? res.data.total ?? items.length;
        } else if (Array.isArray(res.data)) {
          items = res.data;
          total = items.length;
        }

        setLogs(items);
        setTotalCount(total);
      }
    } catch (err) {
      console.error('Failed to load subscription logs:', err);
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [isOpen, currentPage, searchQuery, selectedAction, filterSubscriptionId]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [fetchLogs, isOpen]);

  // Reset page on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedAction, filterSubscriptionId]);

  if (!isOpen) return null;

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getActionBadgeColor = (action: string) => {
    const act = (action || '').toLowerCase();
    if (act.includes('created') || act.includes('insert') || act.includes('order_created')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (act.includes('pause') || act.includes('vacation')) {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    if (act.includes('resume') || act.includes('renew') || act.includes('override')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (act.includes('cancel') || act.includes('delete') || act.includes('fail') || act.includes('expired')) {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const parseDataPayload = (data: any) => {
    if (!data) return null;
    if (typeof data === 'object') return data;
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black shrink-0 shadow-xs border border-emerald-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">Subscriptions Audit &amp; Execution Logs</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {totalCount} Total Logs
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                History of subscription events, pause/resume cycles, and order generation activities.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/subscriptions/logs"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold transition-all shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Full Table View</span>
            </Link>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-200/70 transition-colors cursor-pointer"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Sub ID, Item ID, or Actor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-600 font-medium"
              />
            </div>

            {/* Quick Action Category Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedAction('all')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedAction === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedAction('order_created')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedAction === 'order_created'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                Orders Generated
              </button>
              <button
                onClick={() => setSelectedAction('pause')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedAction === 'pause'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                Paused
              </button>
              <button
                onClick={() => setSelectedAction('resume')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedAction === 'resume'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                Resumed
              </button>
              <button
                onClick={() => setSelectedAction('status_updated')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedAction === 'status_updated'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
                }`}
              >
                Status Changes
              </button>
            </div>
          </div>
        </div>

        {/* Logs List / Table Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {loading ? (
            <div className="py-20 text-center text-xs font-bold text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
              Loading subscription logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 font-semibold bg-white rounded-2xl border border-dashed border-slate-200 p-8">
              <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No subscription log records found matching your filters.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const oldParsed = parseDataPayload(log.old_data);
                const newParsed = parseDataPayload(log.new_data);
                const hasPayload = Boolean(oldParsed || newParsed);

                return (
                  <div
                    key={log.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>

                        {log.subscription_id && (
                          <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            Sub: {log.subscription_id}
                          </span>
                        )}

                        {log.subscription_item_id && (
                          <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                            Item: {log.subscription_item_id}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDateDisplay(log.created_at)}
                        </span>
                        {log.created_by && (
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            By: {log.created_by}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expandable Payload Viewer */}
                    {hasPayload && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>{isExpanded ? 'Hide Data Payload' : 'Inspect Data Payload'}</span>
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            {oldParsed && (
                              <div className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[11px] overflow-x-auto">
                                <div className="text-[10px] font-bold uppercase text-amber-400 mb-1 border-b border-slate-700 pb-1 flex items-center gap-1">
                                  <Layers size={11} /> Previous State (old_data)
                                </div>
                                <pre className="whitespace-pre-wrap">{JSON.stringify(oldParsed, null, 2)}</pre>
                              </div>
                            )}

                            {newParsed && (
                              <div className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[11px] overflow-x-auto">
                                <div className="text-[10px] font-bold uppercase text-emerald-400 mb-1 border-b border-slate-700 pb-1 flex items-center gap-1">
                                  <Layers size={11} /> Updated State (new_data)
                                </div>
                                <pre className="whitespace-pre-wrap">{JSON.stringify(newParsed, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Footer with Pagination */}
        <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Page <span className="font-bold text-slate-900">{currentPage}</span> of{' '}
            <span className="font-bold text-slate-900">{totalPages}</span> ({totalCount} entries)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronLeft size={14} /> Previous
            </button>

            <button
              type="button"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Next <ChevronRight size={14} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer ml-2"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
