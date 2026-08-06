"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Circle,
  Loader2,
  MapPin,
  Package,
  PauseCircle,
  PlusCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Truck,
  Users,
  X,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-config";

const API_URL = typeof window !== 'undefined' ? getApiBaseUrl() : 'http://localhost:5001/api/v1';
type ProductMode = string;

interface ProductModeOption {
  id: ProductMode;
  label: string;
}

interface CatalogProductRow {
  id?: string | number;
  product?: string;
  product_id?: string;
  name?: string;
  slug?: string;
}

interface CalendarDayRow {
  calendar_date: string;
  branch_id: string | null;
  zone_id: string | null;
  product_variant_id: string | null;
  total_m_qty: string;
  total_e_qty: string;
  total_daily_qty: string;
  total_pause_count: number;
  total_extra_count: number;
  total_custom_count: number;
  active_subscription_count: number;
  estimated_routes: number;
  capacity_warning: boolean;
}

interface CalendarResponse {
  month: string;
  source: "subscription_calendar_cache";
  days: CalendarDayRow[];
  totals: {
    total_m_qty: number;
    total_e_qty: number;
    total_daily_qty: number;
    paused_count: number;
    extra_count: number;
    custom_count: number;
    active_subscription_count: number;
    estimated_routes: number;
    capacity_warning_count: number;
  };
}

interface DayDetails {
  date: string;
  product_quantities: Array<{
    product_variant_id: string;
    morning_qty: string;
    evening_qty: string;
    total_qty: string;
    active_subscription_count: number;
    paused_count: number;
    extra_count: number;
    custom_count: number;
    estimated_routes: number;
    capacity_warning: boolean;
  }>;
  overrides: Array<{
    id: number | string;
    subscription_item_id: number | string;
    customer_id: string;
    product_variant_id: string;
    override_type: string;
    m_quantity: string;
    e_quantity: string;
    is_paid: boolean;
    notes: string | null;
  }>;
  pauses: Array<{
    id: number | string;
    subscription_item_id: number | string;
    subscription_id: number | string;
    customer_id: string;
    product_variant_id: string;
    start_date: string;
    end_date: string;
    reason: string | null;
  }>;
  custom_dates: Array<{
    id: number | string;
    subscription_item_id: number | string;
    customer_id: string;
    product_variant_id: string;
    delivery_date: string;
    m_quantity: string;
    e_quantity: string;
  }>;
  route_estimations: Array<{
    product_variant_id: string;
    estimated_routes: number;
    capacity_warning: boolean;
  }>;
  customer_count: number;
}

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildQuery(params: Record<string, string | boolean | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") search.set(key, String(value));
  });
  return search.toString();
}

function numberValue(value: string | number | undefined) {
  return Number(value || 0);
}

function formatQty(value: string | number | undefined) {
  const num = numberValue(value);
  return `${num.toLocaleString("en-IN", { maximumFractionDigits: 1 })}L`;
}

function tableRows(payload: unknown): CatalogProductRow[] {
  if (Array.isArray(payload)) return payload as CatalogProductRow[];
  if (!payload || typeof payload !== "object") return [];

  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data)) return data as CatalogProductRow[];
  if (data && typeof data === "object") {
    const nested = (data as { data?: unknown; rows?: unknown }).data || (data as { rows?: unknown }).rows;
    if (Array.isArray(nested)) return nested as CatalogProductRow[];
    return tableRows(data);
  }
  return [];
}

function toProductModes(rows: CatalogProductRow[]): ProductModeOption[] {
  const seen = new Set<string>();

  return rows.reduce<ProductModeOption[]>((acc, row) => {
    const id = String(row.slug || row.name || "").trim().toLowerCase();
    const label = String(row.name || row.slug || row.product || row.product_id || "").trim();
    if (!id || !label || seen.has(id)) return acc;

    seen.add(id);
    acc.push({ id, label });
    return acc;
  }, []);
}

function emptyDay(date: string): CalendarDayRow {
  return {
    calendar_date: date,
    branch_id: null,
    zone_id: null,
    product_variant_id: null,
    total_m_qty: "0",
    total_e_qty: "0",
    total_daily_qty: "0",
    total_pause_count: 0,
    total_extra_count: 0,
    total_custom_count: 0,
    active_subscription_count: 0,
    estimated_routes: 0,
    capacity_warning: false,
  };
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm">
      <div className="text-[11px] font-semibold uppercase text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-black text-deep-green">{value}</div>
    </div>
  );
}

function IndicatorLegend() {
  const items = [
    ["bg-emerald-500", "Extra"],
    ["bg-orange-500", "Pause"],
    ["bg-green-500", "Active"],
    ["bg-red-500", "Capacity"],
    ["bg-purple-500", "Custom"],
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-500">
      {items.map(([color, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <Circle size={8} className={`${color} rounded-full text-transparent`} fill="currentColor" />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function SubscriptionPlanningCalendar() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [product, setProduct] = useState<ProductMode>("");
  const [branchId, setBranchId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [productVariantId, setProductVariantId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [includePaused, setIncludePaused] = useState(true);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const [details, setDetails] = useState<DayDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autocomplete & Dropdowns lists states
  const [productModes, setProductModes] = useState<ProductModeOption[]>([]);
  const [productModesLoading, setProductModesLoading] = useState(false);
  const [branches, setBranches] = useState<Array<{ branch_id: string; branch_name: string }>>([]);
  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
  const [variants, setVariants] = useState<Array<{ id: string; variant_id: string; product_name: string; variant_name: string; unit_value: string; unit_type: string }>>([]);
  const [customerSearchText, setCustomerSearchText] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Modal active tab state
  const [activeTab, setActiveTab] = useState<"products" | "overrides" | "pauses" | "custom">("products");

  const month = toMonthValue(currentDate);

  const queryParams = useMemo(
    () => ({
      month,
      product,
      branch_id: branchId,
      zone_id: zoneId,
      product_variant_id: productVariantId,
      customer_id: customerId,
      include_paused: includePaused,
      start_date: rangeStart,
      end_date: rangeEnd,
    }),
    [branchId, customerId, includePaused, month, product, productVariantId, rangeEnd, rangeStart, zoneId],
  );

  const fetchCalendar = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/admin/subscriptions/calendar?${buildQuery(queryParams)}`, {
        credentials: "include",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Calendar API failed with ${res.status}`);
      setCalendar(await res.json());
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") setError(err.message);
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, [queryParams]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);


  useEffect(() => {
    async function loadSubscribableProducts() {
      setProductModesLoading(true);
      try {
        const params = new URLSearchParams({
          is_subscribable: "true",
          is_active: "true",
          limit: "100",
          sortBy: "name",
          sortDir: "ASC",
        });
        const res = await fetch(`${API_URL}/catalog/product/table?${params.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Product table API failed with ${res.status}`);

        const modes = toProductModes(tableRows(await res.json()));
        setProductModes(modes);
        setProduct((current) => (modes.some((mode) => mode.id === current) ? current : modes[0]?.id || ""));
      } catch (err) {
        console.error("Failed to load subscribable products", err);
        setProductModes([]);
        setProduct("");
      } finally {
        setProductModesLoading(false);
      }
    }

    loadSubscribableProducts();
  }, []);


  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await fetch(`${API_URL}/admin/zone/branches-list`, { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          if (json.status && Array.isArray(json.data)) {
            setBranches(json.data);
          }
        }
      } catch (e) {
        console.error("Failed to load branches", e);
      }
    }
    loadBranches();
  }, []);


  // Fetch customers for autocomplete search
  useEffect(() => {
    if (customerSearchText.length < 2) {
      setCustomerResults([]);
      return;
    }
    if (customerId && customerSearchText.includes(customerId)) {
      return;
    }

    const delay = setTimeout(async () => {
      setCustomerLoading(true);
      try {
        const res = await fetch(`${API_URL}/admin/customer/table?limit=15&search=${encodeURIComponent(customerSearchText)}`, {
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          const items = json.data?.data || json.data || [];
          if (Array.isArray(items)) {
            setCustomerResults(items);
          }
        }
      } catch (err) {
        console.error("Failed to fetch customers", err);
      } finally {
        setCustomerLoading(false);
      }
    }, 400);

    return () => clearTimeout(delay);
  }, [customerSearchText, customerId]);

  // Reset modal active tab when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setActiveTab("products");
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedDate) return;
    const detailDate = selectedDate;
    const controller = new AbortController();

    async function fetchDetails() {
      setDetailsLoading(true);
      setDetails(null);
      try {
        const res = await fetch(
          `${API_URL}/admin/subscriptions/calendar/day-details?${buildQuery({
            date: detailDate,
            product,
            branch_id: branchId,
            zone_id: zoneId,
            product_variant_id: productVariantId,
            customer_id: customerId,
          })}`,
          { credentials: "include", signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Day detail API failed with ${res.status}`);
        setDetails(await res.json());
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") setError(err.message);
      } finally {
        setDetailsLoading(false);
      }
    }

    fetchDetails();
    return () => controller.abort();
  }, [branchId, customerId, product, productVariantId, selectedDate, zoneId]);

  const daysByDate = useMemo(() => {
    const map = new Map<string, CalendarDayRow>();
    calendar?.days.forEach((day) => map.set(day.calendar_date, day));
    return map;
  }, [calendar]);

  const gridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const monthIndex = currentDate.getMonth();
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells: Array<{ date: string | null; row: CalendarDayRow | null }> = [];

    for (let index = 0; index < firstDay; index += 1) cells.push({ date: null, row: null });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ date, row: daysByDate.get(date) || emptyDay(date) });
    }
    return cells;
  }, [currentDate, daysByDate]);

  const selectedRow = selectedDate ? daysByDate.get(selectedDate) || emptyDay(selectedDate) : null;
  const title = currentDate.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const moveMonth = (step: number) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + step, 1));
    setSelectedDate(null);
  };

  return (
    <div className="min-h-screen p-1 font-sans text-gray-800 md:p-2">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-bold uppercase text-fresh-green">
              <CalendarDays size={14} />
              Planning Calendar
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-deep-green md:text-3xl">
              Subscription Execution Planning
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Product-wise monthly planning from weekly schedules, custom dates, overrides, pauses, and subscription calendar cache.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-2">
            <Metric label="Morning" value={formatQty(calendar?.totals.total_m_qty)} />
            <Metric label="Evening" value={formatQty(calendar?.totals.total_e_qty)} />
            {/* <Metric label="Routes" value={calendar?.totals.estimated_routes || 0} />
            <Metric label="Warnings" value={calendar?.totals.capacity_warning_count || 0} /> */}
          </div>
        </header>

        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-xs font-bold uppercase text-gray-500 block">
                Branch Filter
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="mt-1 block w-64 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium outline-none focus:border-fresh-green bg-white cursor-pointer transition-colors hover:border-gray-300"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.branch_id} value={b.branch_id}>
                      {b.branch_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-bold uppercase text-gray-500 block">
                Date (Month)
                <input
                  type="month"
                  value={month}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [year, mVal] = e.target.value.split("-");
                      setCurrentDate(new Date(parseInt(year), parseInt(mVal) - 1, 1));
                      setSelectedDate(null);
                    }
                  }}
                  className="mt-1 block w-48 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium outline-none focus:border-fresh-green bg-white cursor-pointer transition-colors hover:border-gray-300"
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchCalendar}
                className="inline-flex items-center gap-2 rounded-lg bg-deep-green px-4 py-2 text-sm font-bold text-white hover:bg-green-800 transition-colors shadow-sm"
              >
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>
          </div>
        </section>

        <main >
          <section className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm md:p-4 w-full min-w-0">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-fit items-center rounded-lg border border-gray-200 bg-gray-50 p-1">
                <button onClick={() => moveMonth(-1)} className="rounded-md p-2 text-gray-500 hover:bg-white hover:text-deep-green" aria-label="Previous month">
                  <ChevronLeft size={18} />
                </button>
                <div className="min-w-[170px] px-3 text-center text-base font-black text-deep-green">{title}</div>
                <button onClick={() => moveMonth(1)} className="rounded-md p-2 text-gray-500 hover:bg-white hover:text-deep-green" aria-label="Next month">
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {productModesLoading ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm font-bold text-gray-500">
                    <Loader2 size={15} className="animate-spin" />
                    Products
                  </span>
                ) : productModes.length > 0 ? (
                  productModes.map((mode) => (
                    <button key={mode.id} onClick={() => setProduct(mode.id)} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${product === mode.id ? "bg-fresh-green text-white shadow-sm" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
                      {mode.label}
                    </button>
                  ))
                ) : (
                  <span className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-bold text-gray-500">
                    No subscribable products
                  </span>
                )}
              </div>
            </div>

            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <IndicatorLegend />
              {/* <div className="text-xs font-semibold text-gray-400">Source: subscription_calendar_cache</div> */}
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-7 gap-1.5 md:gap-2">
              {weekdays.map((day) => (
                <div key={day} className="py-2 text-center text-xs font-black uppercase text-gray-400">
                  {day}
                </div>
              ))}

              {loading
                ? Array.from({ length: 35 }).map((_, index) => (
                  <div key={index} className="h-[142px] animate-pulse rounded-lg bg-gray-100" />
                ))
                : gridDays.map((cell, index) => {
                  if (!cell.date || !cell.row) return <div key={`blank-${index}`} className="h-[142px]" />;
                  const row = cell.row;
                  const dateObj = new Date(`${cell.date}T00:00:00`);
                  const isSelected = selectedDate === cell.date;
                  const isToday = cell.date === new Date().toISOString().slice(0, 10);

                  return (
                    <button
                      key={cell.date}
                      onClick={() => setSelectedDate(cell.date)}
                      className={` rounded-lg border p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md ${isSelected ? "border-fresh-green bg-green-50 ring-2 ring-green-100" : isToday ? "border-green-200 bg-white" : "border-gray-100 bg-white"}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${isToday ? "bg-deep-green text-white" : "text-deep-green"}`}>
                          {dateObj.getDate()}
                        </span>
                        {row.capacity_warning && <AlertTriangle size={16} className="text-red-500" />}
                      </div>

                      <div className="mt-2 space-y-1 text-[12px] font-bold">
                        <div className="flex justify-between text-deep-green"><span>M:</span><span>{formatQty(row.total_m_qty)}</span></div>
                        <div className="flex justify-between text-deep-green"><span>E:</span><span>{formatQty(row.total_e_qty)}</span></div>
                        <div className="flex justify-between border-t border-gray-100 pt-1 text-gray-700"><span>Total:</span><span>{formatQty(row.total_daily_qty)}</span></div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] font-semibold">
                        <span className="text-orange-600">Paused: {row.total_pause_count}</span>
                        <span className="text-emerald-600">Extra: {row.total_extra_count}</span>
                        <span className="text-green-700">Active: {row.active_subscription_count}</span>
                        <span className="text-purple-700">Routes: {row.estimated_routes}</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </section>


        </main>
        {selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">

            <div className="relative max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/20 bg-[#f8faf8] shadow-[0_25px_100px_rgba(0,0,0,0.35)]">

              {/* Header */}
              <div className="relative overflow-hidden bg-gradient-to-r from-[#0b3b2e] via-[#14532d] to-[#1f7a4d] px-8 py-7">

                {/* Glow */}
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

                <div className="relative flex items-start justify-between">

                  <div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-100 backdrop-blur">
                      <CalendarDays size={14} />
                      Subscription Planning
                    </div>

                    <h2 className="mt-4 text-4xl font-black tracking-tight text-white">
                      {selectedDate}
                    </h2>

                    {/* <p className="mt-2 max-w-2xl text-sm font-medium text-green-100">
                Daily execution summary including quantities, routes,
                pauses, custom schedules, and customer distribution.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">

                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-100">
                  Active Deliveries
                </span>

                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-100">
                  Route Optimized
                </span>

                <span className="rounded-full bg-orange-400/20 px-3 py-1 text-xs font-bold text-orange-100">
                  Smart Planning
                </span>

              </div> */}

                  </div>

                  <button
                    onClick={() => setSelectedDate(null)}
                    className="rounded-2xl border border-white/10 bg-white/10 p-3 text-white transition hover:scale-105 hover:bg-white/20"
                  >
                    <X size={20} />
                  </button>

                </div>
              </div>
              <div className="max-h-[calc(92vh-180px)] overflow-y-auto p-8">

                {/* Summary */}
                {selectedRow && (
                  <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

                    <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white shadow-lg">
                      <div className="text-sm font-semibold text-emerald-100">
                        Morning Quantity
                      </div>

                      <div className="mt-2 text-3xl font-black">
                        {formatQty(selectedRow.total_m_qty)}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-green-500 to-green-700 p-5 text-white shadow-lg">
                      <div className="text-sm font-semibold text-green-100">
                        Evening Quantity
                      </div>

                      <div className="mt-2 text-3xl font-black">
                        {formatQty(selectedRow.total_e_qty)}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 p-5 text-white shadow-lg">
                      <div className="text-sm font-semibold text-orange-100">
                        Paused Deliveries
                      </div>

                      <div className="mt-2 text-3xl font-black">
                        {selectedRow.total_pause_count}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 p-5 text-white shadow-lg">
                      <div className="text-sm font-semibold text-purple-100">
                        Estimated Routes
                      </div>

                      <div className="mt-2 text-3xl font-black">
                        {selectedRow.estimated_routes}
                      </div>
                    </div>

                  </div>
                )}

                {/* Loading */}
                {detailsLoading && (
                  <div className="flex items-center justify-center rounded-2xl bg-white py-16 shadow-sm">
                    <Loader2 size={26} className="mr-3 animate-spin text-green-700" />
                    <span className="text-lg font-bold text-gray-600">
                      Loading execution details...
                    </span>
                  </div>
                )}

                {/* Details */}
                {details && !detailsLoading && (
                  <div className="space-y-6">

                    {/* Stats */}
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

                      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="text-sm font-semibold text-gray-500">
                          Customers
                        </div>
                        <div className="mt-2 text-3xl font-black text-[#0f3d2e]">
                          {details.customer_count}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="text-sm font-semibold text-gray-500">
                          Overrides
                        </div>
                        <div className="mt-2 text-3xl font-black text-emerald-600">
                          {details.overrides.length}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="text-sm font-semibold text-gray-500">
                          Custom Dates
                        </div>
                        <div className="mt-2 text-3xl font-black text-violet-600">
                          {details.custom_dates.length}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="text-sm font-semibold text-gray-500">
                          Active Pauses
                        </div>
                        <div className="mt-2 text-3xl font-black text-orange-600">
                          {details.pauses.length}
                        </div>
                      </div>

                    </div>

                    {/* Tab Swifter */}
                    <div className="border-b border-gray-200">
                      <nav className="flex space-x-6" aria-label="Tabs">
                        <button
                          onClick={() => setActiveTab("products")}
                          className={`border-b-2 py-3 px-1 text-sm font-bold transition ${activeTab === "products"
                            ? "border-fresh-green text-deep-green"
                            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                            }`}
                        >
                          Product Summary ({details.product_quantities.length})
                        </button>
                        <button
                          onClick={() => setActiveTab("overrides")}
                          className={`border-b-2 py-3 px-1 text-sm font-bold transition ${activeTab === "overrides"
                            ? "border-fresh-green text-deep-green"
                            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                            }`}
                        >
                          Quantity Overrides ({details.overrides.length})
                        </button>
                        <button
                          onClick={() => setActiveTab("pauses")}
                          className={`border-b-2 py-3 px-1 text-sm font-bold transition ${activeTab === "pauses"
                            ? "border-fresh-green text-deep-green"
                            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                            }`}
                        >
                          Active Pauses ({details.pauses.length})
                        </button>
                        <button
                          onClick={() => setActiveTab("custom")}
                          className={`border-b-2 py-3 px-1 text-sm font-bold transition ${activeTab === "custom"
                            ? "border-fresh-green text-deep-green"
                            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                            }`}
                        >
                          Custom Schedules ({details.custom_dates.length})
                        </button>
                      </nav>
                    </div>

                    {/* Tab content */}
                    {activeTab === "products" && (
                      <section className="space-y-4">
                        <div>
                          <h3 className="text-lg font-black text-[#0f3d2e]">Product Quantities</h3>
                          <p className="text-xs text-gray-500">Daily distribution quantities based on active subscriptions</p>
                        </div>
                        {details.product_quantities.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-sm">
                            <Package size={40} className="stroke-[1.5] text-gray-300 mb-2" />
                            <p className="text-xs font-semibold">No product quantities computed for this day</p>
                          </div>
                        ) : (
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {details.product_quantities.map((item) => {
                              const productName =
                                item.product_variant_id
                                  ?.replace(/_/g, " ")
                                  ?.replace(/\b\w/g, (c) => c.toUpperCase()) || "Product";

                              return (
                                <div
                                  key={item.product_variant_id}
                                  className="group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                >
                                  <div className="bg-gradient-to-r from-[#14532d] to-[#1f7a4d] p-4 text-white">
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-green-100">Product</div>
                                        <h4 className="mt-0.5 text-base font-black truncate max-w-[180px]">{productName}</h4>
                                        <div className="text-[10px] text-green-100/70 truncate max-w-[180px]">{item.product_variant_id}</div>
                                      </div>
                                      {item.capacity_warning && (
                                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                                          Capacity Alert
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="p-4">
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="rounded-xl bg-emerald-50 p-2 text-center">
                                        <div className="text-[9px] font-bold uppercase text-emerald-600">Morning</div>
                                        <div className="mt-1 text-sm font-black text-emerald-700">{formatQty(item.morning_qty)}</div>
                                      </div>
                                      <div className="rounded-xl bg-green-50 p-2 text-center">
                                        <div className="text-[9px] font-bold uppercase text-[#0b3b2e]">Evening</div>
                                        <div className="mt-1 text-sm font-black text-[#14532d]">{formatQty(item.evening_qty)}</div>
                                      </div>
                                      <div className="rounded-xl bg-purple-50 p-2 text-center">
                                        <div className="text-[9px] font-bold uppercase text-purple-600">Total</div>
                                        <div className="mt-1 text-sm font-black text-purple-700">{formatQty(item.total_qty)}</div>
                                      </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-1">
                                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Active: {item.active_subscription_count}</span>
                                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">Pause: {item.paused_count}</span>
                                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-[#14532d]">Extra: {item.extra_count}</span>
                                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">Custom: {item.custom_count}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    )}

                    {activeTab === "overrides" && (
                      <section className="space-y-4">
                        <div>
                          <h3 className="text-lg font-black text-[#0f3d2e]">Quantity Overrides</h3>
                          <p className="text-xs text-gray-500">Direct modifications, additions or pauses on subscriptions for this day</p>
                        </div>
                        {details.overrides.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-sm">
                            <SlidersHorizontal size={40} className="stroke-[1.5] text-gray-300 mb-2" />
                            <p className="text-xs font-semibold">No overrides active on this date</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
                            <table className="w-full border-collapse text-left text-xs text-gray-500">
                              <thead className="bg-gray-50 text-[10px] font-bold uppercase text-gray-700 border-b border-gray-100">
                                <tr>
                                  <th className="px-4 py-3">Customer ID</th>
                                  <th className="px-4 py-3">Variant ID</th>
                                  <th className="px-4 py-3">Type</th>
                                  <th className="px-4 py-3">M Qty</th>
                                  <th className="px-4 py-3">E Qty</th>
                                  <th className="px-4 py-3">Payment</th>
                                  <th className="px-4 py-3">Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {details.overrides.map((ov: any) => (
                                  <tr key={ov.id} className="hover:bg-gray-50/55 transition-colors">
                                    <td className="px-4 py-3 font-bold text-gray-900">{ov.customer_id}</td>
                                    <td className="px-4 py-3 font-medium text-gray-600 truncate max-w-[120px]" title={ov.product_variant_id}>{ov.product_variant_id}</td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${ov.override_type === "pause"
                                        ? "bg-orange-50 text-orange-700 border border-orange-100"
                                        : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                        }`}>
                                        {ov.override_type}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-gray-800">{formatQty(ov.m_quantity)}</td>
                                    <td className="px-4 py-3 font-semibold text-gray-800">{formatQty(ov.e_quantity)}</td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${ov.is_paid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                        }`}>
                                        {ov.is_paid ? "Paid" : "Unpaid"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-[11px] italic text-gray-400 max-w-[150px] truncate" title={ov.notes || ""}>
                                      {ov.notes || "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    )}

                    {activeTab === "pauses" && (
                      <section className="space-y-4">
                        <div>
                          <h3 className="text-lg font-black text-[#0f3d2e]">Active Pauses</h3>
                          <p className="text-xs text-gray-500">Subscriptions paused due to holiday, vacation or user requests</p>
                        </div>
                        {details.pauses.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-sm">
                            <PauseCircle size={40} className="stroke-[1.5] text-gray-300 mb-2" />
                            <p className="text-xs font-semibold">No active pauses on this date</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
                            <table className="w-full border-collapse text-left text-xs text-gray-500">
                              <thead className="bg-gray-50 text-[10px] font-bold uppercase text-gray-700 border-b border-gray-100">
                                <tr>
                                  <th className="px-4 py-3">Customer ID</th>
                                  <th className="px-4 py-3">Variant ID</th>
                                  <th className="px-4 py-3">Start Date</th>
                                  <th className="px-4 py-3">End Date</th>
                                  <th className="px-4 py-3">Reason</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {details.pauses.map((pause: any) => (
                                  <tr key={pause.id} className="hover:bg-gray-50/55 transition-colors">
                                    <td className="px-4 py-3 font-bold text-gray-900">{pause.customer_id}</td>
                                    <td className="px-4 py-3 font-medium text-gray-600 truncate max-w-[120px]" title={pause.product_variant_id}>{pause.product_variant_id}</td>
                                    <td className="px-4 py-3 text-gray-600">{pause.start_date}</td>
                                    <td className="px-4 py-3 text-gray-600">{pause.end_date}</td>
                                    <td className="px-4 py-3 text-[11px] italic text-gray-400 max-w-[200px] truncate" title={pause.reason || ""}>
                                      {pause.reason || "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    )}

                    {activeTab === "custom" && (
                      <section className="space-y-4">
                        <div>
                          <h3 className="text-lg font-black text-[#0f3d2e]">Custom Schedules</h3>
                          <p className="text-xs text-gray-500">Custom delivery quantities scheduled explicitly for this date</p>
                        </div>
                        {details.custom_dates.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-sm">
                            <CalendarDays size={40} className="stroke-[1.5] text-gray-300 mb-2" />
                            <p className="text-xs font-semibold">No custom schedules active on this date</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
                            <table className="w-full border-collapse text-left text-xs text-gray-500">
                              <thead className="bg-gray-50 text-[10px] font-bold uppercase text-gray-700 border-b border-gray-100">
                                <tr>
                                  <th className="px-4 py-3">Customer ID</th>
                                  <th className="px-4 py-3">Variant ID</th>
                                  <th className="px-4 py-3">M Qty</th>
                                  <th className="px-4 py-3">E Qty</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {details.custom_dates.map((cd: any) => (
                                  <tr key={cd.id} className="hover:bg-gray-50/55 transition-colors">
                                    <td className="px-4 py-3 font-bold text-gray-900">{cd.customer_id}</td>
                                    <td className="px-4 py-3 font-medium text-gray-600 truncate max-w-[150px]" title={cd.product_variant_id}>{cd.product_variant_id}</td>
                                    <td className="px-4 py-3 font-semibold text-gray-800">{formatQty(cd.m_quantity)}</td>
                                    <td className="px-4 py-3 font-semibold text-gray-800">{formatQty(cd.e_quantity)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    )}

                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
