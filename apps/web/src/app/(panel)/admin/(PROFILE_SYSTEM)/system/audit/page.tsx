"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/services/api.client";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  Home,
  Layers3,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 50;

interface AuditLog {
  id: number | string;
  admin_id: string;
  admin_name?: string | null;
  action: string;
  target_type: string;
  target_id?: string | null;
  details?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string | null;
}

interface AuditActionBreakdown {
  action: string;
  count: number;
}

interface AuditInsights {
  total_events: number;
  events_today: number;
  delete_events: number;
  active_admins: number;
  affected_resources: number;
  action_breakdown: AuditActionBreakdown[];
}

interface AuditAdminOption {
  admin_id: string;
  admin_name: string;
}

interface AuditFilterOptions {
  actions: string[];
  target_types: string[];
  admins: AuditAdminOption[];
}

interface AuditLogResponse {
  status: boolean;
  data: AuditLog[];
  total: number;
  insights: AuditInsights;
  filter_options?: AuditFilterOptions;
  message?: string;
}

interface AuditFilters {
  search: string;
  action: string;
  admin_id: string;
  target_type: string;
  from_date: string;
  to_date: string;
}

const EMPTY_INSIGHTS: AuditInsights = {
  total_events: 0,
  events_today: 0,
  delete_events: 0,
  active_admins: 0,
  affected_resources: 0,
  action_breakdown: [],
};

const EMPTY_FILTER_OPTIONS: AuditFilterOptions = {
  actions: [],
  target_types: [],
  admins: [],
};

function createEmptyFilters(): AuditFilters {
  return {
    search: "",
    action: "",
    admin_id: "",
    target_type: "",
    from_date: "",
    to_date: "",
  };
}

function formatLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAdministratorDisplayName(
  adminName?: string | null,
  adminId?: string | null,
): string {
  const normalizedName = adminName?.trim();
  return normalizedName && normalizedName !== adminId
    ? normalizedName
    : "Unknown administrator";
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDetails(details: unknown): string {
  if (details === null || details === undefined)
    return "No detail payload recorded.";
  if (typeof details === "string")
    return details || "No detail payload recorded.";

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return "The detail payload could not be formatted.";
  }
}

function summarizeDetails(details: unknown): string {
  return formatDetails(details).replace(/\s+/g, " ");
}

function getActionClasses(action: string): string {
  const normalized = action.toLowerCase();
  if (normalized.includes("delete") || normalized.includes("remove")) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  if (
    normalized.includes("create") ||
    normalized.includes("add") ||
    normalized.includes("stock_in")
  ) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (normalized.includes("update") || normalized.includes("edit")) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (normalized.includes("assign")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
}

interface AuditDetailsDialogProps {
  log: AuditLog;
  onClose: () => void;
}

function AuditDetailsDialog({ log, onClose }: AuditDetailsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousBodyOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-detail-title"
        onKeyDown={trapFocus}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Audit event #{log.id}
            </p>
            <h2
              id="audit-detail-title"
              className="mt-1 text-lg font-black text-slate-900"
            >
              Full audit details
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close audit details"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500/30"
          >
            <X size={17} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Time
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {formatTimestamp(log.created_at)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Action
              </p>
              <span
                className={
                  "mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold " +
                  getActionClasses(log.action)
                }
              >
                {formatLabel(log.action)}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Administrator
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {getAdministratorDisplayName(log.admin_name, log.admin_id)}
              </p>
              <p className="mt-0.5 break-all font-mono text-[10px] text-slate-400">
                Actor ID: {log.admin_id || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Resource
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {formatLabel(log.target_type || "Unknown")}
              </p>
              <p className="mt-0.5 break-all font-mono text-[10px] text-slate-400">
                {log.target_id || "No target ID"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                IP address
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">
                {log.ip_address || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                User agent
              </p>
              <p className="mt-1 break-words text-xs leading-relaxed text-slate-600">
                {log.user_agent || "—"}
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-600">
              Recorded payload
            </h3>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
              {formatDetails(log.details)}
            </pre>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/30"
          >
            Close details
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [insights, setInsights] = useState<AuditInsights>(EMPTY_INSIGHTS);
  const [filterOptions, setFilterOptions] =
    useState<AuditFilterOptions>(EMPTY_FILTER_OPTIONS);
  const [draftFilters, setDraftFilters] = useState<AuditFilters>(() =>
    createEmptyFilters(),
  );
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>(() =>
    createEmptyFilters(),
  );
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const filterOptionsLoadedRef = useRef(false);

  useEffect(() => {
    let ignore = false;

    const fetchLogs = async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        include_filter_options: String(!filterOptionsLoadedRef.current),
      });
      for (const [key, value] of Object.entries(appliedFilters)) {
        if (value) params.set(key, value);
      }

      const response = await api.get<AuditLogResponse>(
        "/admin/system/audit?" + params.toString(),
      );
      if (ignore) return;

      if (response.error || !response.data?.status) {
        setLogs([]);
        setTotal(0);
        setInsights(EMPTY_INSIGHTS);
        setError("Audit activity could not be loaded. Please try again.");
        setLoading(false);
        return;
      }

      const payload = response.data;
      const nextTotal = Number(payload.total ?? 0);
      const lastPage = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }

      setLogs(Array.isArray(payload.data) ? payload.data : []);
      setTotal(nextTotal);
      setInsights(payload.insights ?? EMPTY_INSIGHTS);
      if (payload.filter_options) {
        setFilterOptions(payload.filter_options);
        filterOptionsLoadedRef.current = true;
      }
      setLoading(false);
    };

    void fetchLogs();
    return () => {
      ignore = true;
    };
  }, [appliedFilters, page, refreshVersion]);

  const closeDetails = useCallback(() => setSelectedLog(null), []);

  const updateDraftFilter = (field: keyof AuditFilters, value: string) => {
    setDraftFilters((current) => ({ ...current, [field]: value }));
  };

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      draftFilters.from_date &&
      draftFilters.to_date &&
      draftFilters.from_date > draftFilters.to_date
    ) {
      setFilterError("From date cannot be after To date.");
      return;
    }

    setFilterError("");
    setPage(1);
    setSelectedLog(null);
    setAppliedFilters({
      ...draftFilters,
      search: draftFilters.search.trim(),
    });
    setRefreshVersion((version) => version + 1);
  };

  const clearFilters = () => {
    const emptyFilters = createEmptyFilters();
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setFilterError("");
    setPage(1);
    setSelectedLog(null);
    setRefreshVersion((version) => version + 1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startResult = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endResult = Math.min(page * PAGE_SIZE, total);
  const activeFilterCount =
    Object.values(appliedFilters).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">
      <nav
        className="flex items-center gap-1.5 text-sm text-gray-500"
        aria-label="Breadcrumb"
      >
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-1 hover:text-emerald-600"
        >
          <Home size={14} /> Dashboard
        </Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Audit Log</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <FileText size={24} className="text-slate-600" /> Audit Log
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Track admin activity with complete event details and filtered
            insights.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshVersion((version) => version + 1)}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <section
        aria-label="Audit insights"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-indigo-600">
            <Activity size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Matching events
            </p>
            <p className="mt-0.5 text-2xl font-black text-slate-900">
              {loading ? "—" : insights.total_events.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-slate-400">
              Across {insights.affected_resources} resource type(s)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-600">
            <CalendarDays size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Today&apos;s events
            </p>
            <p className="mt-0.5 text-2xl font-black text-slate-900">
              {loading ? "—" : insights.events_today.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-slate-400">
              Based on India Standard Time
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-rose-600">
            <Trash2 size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Delete events
            </p>
            <p className="mt-0.5 text-2xl font-black text-slate-900">
              {loading ? "—" : insights.delete_events.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-slate-400">
              Within the current filters
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-600">
            <Users size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active admins
            </p>
            <p className="mt-0.5 text-2xl font-black text-slate-900">
              {loading ? "—" : insights.active_admins.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] text-slate-400">
              Contributors in matching activity
            </p>
          </div>
        </div>
      </section>

      {insights.action_breakdown.length > 0 && (
        <section
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center"
          aria-label="Top audit actions"
        >
          <div className="flex shrink-0 items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600">
            <Layers3 size={15} className="text-indigo-500" /> Top actions
          </div>
          <div className="flex flex-wrap gap-2">
            {insights.action_breakdown.map((item) => (
              <span
                key={item.action}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
              >
                {formatLabel(item.action)}{" "}
                <strong className="ml-1 text-slate-900">{item.count}</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      <section
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        aria-labelledby="audit-filter-heading"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2
            id="audit-filter-heading"
            className="flex items-center gap-2 text-sm font-black text-slate-800"
          >
            <Filter size={16} className="text-indigo-500" /> Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">
                {activeFilterCount} active
              </span>
            )}
          </h2>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900"
            >
              <RotateCcw size={13} /> Clear filters
            </button>
          )}
        </div>

        <form onSubmit={applyFilters} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="xl:col-span-2">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Search
              </span>
              <span className="relative block">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={draftFilters.search}
                  onChange={(event) =>
                    updateDraftFilter("search", event.target.value)
                  }
                  placeholder="Admin, action, resource, target ID or IP..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
                />
              </span>
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Action
              </span>
              <select
                value={draftFilters.action}
                onChange={(event) =>
                  updateDraftFilter("action", event.target.value)
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
              >
                <option value="">All actions</option>
                {filterOptions.actions.map((action) => (
                  <option key={action} value={action}>
                    {formatLabel(action)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Administrator
              </span>
              <select
                value={draftFilters.admin_id}
                onChange={(event) =>
                  updateDraftFilter("admin_id", event.target.value)
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
              >
                <option value="">All administrators</option>
                {filterOptions.admins.map((admin) => (
                  <option key={admin.admin_id} value={admin.admin_id}>
                    {getAdministratorDisplayName(admin.admin_name, admin.admin_id)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Resource
              </span>
              <select
                value={draftFilters.target_type}
                onChange={(event) =>
                  updateDraftFilter("target_type", event.target.value)
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
              >
                <option value="">All resources</option>
                {filterOptions.target_types.map((targetType) => (
                  <option key={targetType} value={targetType}>
                    {formatLabel(targetType)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                From date
              </span>
              <input
                type="date"
                value={draftFilters.from_date}
                max={draftFilters.to_date || undefined}
                onChange={(event) =>
                  updateDraftFilter("from_date", event.target.value)
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                To date
              </span>
              <input
                type="date"
                value={draftFilters.to_date}
                min={draftFilters.from_date || undefined}
                onChange={(event) =>
                  updateDraftFilter("to_date", event.target.value)
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/30"
              >
                Apply filters
              </button>
              <button
                type="button"
                onClick={clearFilters}
                aria-label="Reset audit filters"
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </div>
          {filterError && (
            <p role="alert" className="text-xs font-semibold text-rose-600">
              {filterError}
            </p>
          )}
        </form>
      </section>

      <div aria-live="polite" className="sr-only">
        {loading
          ? "Loading audit events"
          : error || total + " audit events found"}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-12 text-center">
          <FileText size={42} className="mx-auto mb-3 text-rose-300" />
          <p className="text-sm font-bold text-rose-800">{error}</p>
          <button
            type="button"
            onClick={() => setRefreshVersion((version) => version + 1)}
            className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div
          className="flex justify-center rounded-2xl border border-slate-100 bg-white py-20"
          aria-hidden="true"
        >
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white py-20 text-center">
          <FileText size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-bold text-slate-500">
            No audit logs match these filters
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Adjust the filters or clear them to see more activity.
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <section
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          aria-label="Audit events"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Admin</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Resource</th>
                  <th className="px-4 py-3 text-left">Details</th>
                  <th className="px-4 py-3 text-left">IP</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const detailSummary = summarizeDetails(log.details);
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-[10px] text-slate-500">
                        <Clock size={10} className="mr-1 inline" />{" "}
                        {formatTimestamp(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-slate-800">
                          {getAdministratorDisplayName(log.admin_name, log.admin_id)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold " +
                            getActionClasses(log.action)
                          }
                        >
                          {formatLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-600">
                          {formatLabel(log.target_type || "Unknown")}
                        </p>
                        <p className="max-w-40 truncate font-mono text-[9px] text-slate-400">
                          {log.target_id || ""}
                        </p>
                      </td>
                      <td className="max-w-64 px-4 py-3">
                        <p className="truncate text-[10px] text-slate-500">
                          {detailSummary}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-slate-400">
                        {log.ip_address || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          aria-label={"View full audit event " + log.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-bold text-indigo-700 transition-colors hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                        >
                          <Eye size={12} /> View more
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t bg-slate-50/60 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {startResult}–{endResult} of{" "}
              {total.toLocaleString("en-IN")} events
            </span>
            <nav
              className="flex items-center gap-2"
              aria-label="Audit log pagination"
            >
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={13} /> Previous
              </button>
              <span className="min-w-20 text-center font-semibold text-slate-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight size={13} />
              </button>
            </nav>
          </div>
        </section>
      )}

      {selectedLog && (
        <AuditDetailsDialog log={selectedLog} onClose={closeDetails} />
      )}
    </div>
  );
}
