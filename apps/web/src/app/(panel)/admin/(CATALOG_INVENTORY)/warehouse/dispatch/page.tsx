"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  DispatchPlanningService,
  DeliveryPartnerPlan,
  WarehouseTotalItem
} from "@/services/dispatch-planning.service";
import {
  ClipboardList, RefreshCw, Home, ChevronRight,
  Truck, Package, Users, Zap, CheckCircle2,
  ChevronDown, ChevronUp, Printer, FileDown, Search,
  Calendar, ShoppingBag, Eye, EyeOff, Check, Loader2,
  X, Trash2, Plus, Sparkles, MapPin, Phone, Clock,
  BarChart3, ArrowRight, Filter, SlidersHorizontal,
  AlertCircle, Boxes, RotateCcw, History, AlertTriangle,
  ArrowUpFromLine, TrendingDown
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

// ─────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────

function todayIST(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function getPastWeekDates() {
  const dates = [];
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const labelFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata", month: "short", day: "numeric",
  });
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const parts = formatter.formatToParts(d);
    const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const dateStr = `${pick("year")}-${pick("month")}-${pick("day")}`;
    let label = labelFormatter.format(d);
    if (i === 0) label = `Today (${label})`;
    else if (i === 1) label = `Yesterday (${label})`;
    dates.push({ value: dateStr, label });
  }
  return dates;
}

const SLOT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  morning: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  evening: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-400" },
  default: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
};

function SlotBadge({ slot }: { slot: string }) {
  const c = SLOT_COLORS[slot?.toLowerCase()] ?? SLOT_COLORS.default;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {slot}
    </span>
  );
}

function StatusBadge({ dispatched, dispatchStatus }: { dispatched: boolean; dispatchStatus?: string | null }) {
  // Show the actual delivery_dispatch.status when available
  const statusMap: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    loaded:    { cls: "bg-emerald-50 text-emerald-700 border-emerald-200/60", label: "Loaded",    icon: <CheckCircle2 size={10} /> },
    collected: { cls: "bg-sky-50 text-sky-700 border-sky-200/60",             label: "Collected", icon: <CheckCircle2 size={10} /> },
    short:     { cls: "bg-orange-50 text-orange-700 border-orange-200/60",   label: "Short",     icon: <AlertTriangle size={10} /> },
    returned:  { cls: "bg-violet-50 text-violet-700 border-violet-200/60",   label: "Returned",  icon: <RotateCcw size={10} /> },
  };
  if (dispatchStatus && statusMap[dispatchStatus]) {
    const s = statusMap[dispatchStatus];
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${s.cls}`}>
        {s.icon} {s.label}
      </span>
    );
  }
  return dispatched ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
      <CheckCircle2 size={10} /> Dispatched
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200/60">
      <Clock size={10} /> Pending
    </span>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    in_progress: { cls: "bg-sky-50 text-sky-700 border-sky-200", label: "In Progress" },
    completed: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Completed" },
    pending: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Pending" },
    assigned: { cls: "bg-violet-50 text-violet-700 border-violet-200", label: "Assigned" },
    cancelled: { cls: "bg-rose-50 text-rose-700 border-rose-200", label: "Cancelled" },
  };
  const s = map[status] ?? { cls: "bg-slate-100 text-slate-600 border-slate-200", label: status };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${s.cls}`}>
      {s.label}
    </span>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
      <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
        <Icon size={26} className="text-slate-300" />
      </div>
      <div>
        <p className="text-sm font-black text-slate-500">{title}</p>
        {desc && <p className="text-xs text-slate-400 mt-1 max-w-xs">{desc}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tab 1: Dispatch Requirements
// ─────────────────────────────────────────────────────────

/**
 * Consolidated pick list for a day's runs — what the warehouse must pull from
 * the shelves. Lives alongside the dispatch requirements because both answer
 * "what has to leave the warehouse today".
 */
function WarehousePickList({ date }: { date: string }) {
  const [plans, setPlans] = useState<DeliveryPartnerPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickSearchQuery, setPickSearchQuery] = useState("");

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoading(true);
    DispatchPlanningService.fetchDispatchPlan(date)
      .then((data) => { if (!cancelled) setPlans(data); })
      .catch(() => { if (!cancelled) setPlans([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  const warehouseTotals = useMemo(() => DispatchPlanningService.compileWarehouseTotals(plans), [plans]);

  const filteredPickList = useMemo(() =>
    Object.values(warehouseTotals).filter((item) => {
      const q = pickSearchQuery.toLowerCase();
      return (item.product_name || "").toLowerCase().includes(q) || (item.variant_name || "").toLowerCase().includes(q);
    }),
    [warehouseTotals, pickSearchQuery]
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {loading ? (
        <div className="p-10 text-center text-xs font-bold text-slate-400">Loading pick list…</div>
      ) : (
            <div className="animate-in fade-in duration-200">
              <div className="flex items-center justify-between p-4 border-b border-slate-50 bg-slate-50/40">
                <div>
                  <h2 className="text-sm font-black text-slate-800">Consolidated Warehouse Pick List</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Pull these quantities from the shelves to fulfil all today's runs</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input type="text" placeholder="Search product..." value={pickSearchQuery} onChange={(e) => setPickSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all w-56 font-medium" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="px-5 py-3.5">#</th>
                      <th className="px-5 py-3.5">Product Name</th>
                      <th className="px-5 py-3.5">Variant / Size</th>
                      <th className="px-5 py-3.5 text-center">Qty to Pull</th>
                      <th className="px-5 py-3.5 text-center">Orders</th>
                      <th className="px-5 py-3.5 text-center">Runs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredPickList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-14 text-center">
                          <Package size={32} className="mx-auto text-slate-200 mb-2" />
                          <p className="text-sm font-bold text-slate-400">No items in pick list</p>
                        </td>
                      </tr>
                    ) : filteredPickList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors group">
                        <td className="px-5 py-4 text-slate-400 font-bold text-[11px]">{idx + 1}</td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-slate-800 group-hover:text-emerald-800 transition-colors">{item.product_name}</span>
                        </td>
                        <td className="px-5 py-4 text-slate-500 font-medium">{item.variant_name || "—"}</td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-black text-[12px]">×{item.quantity}</span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="px-2.5 py-1 bg-sky-50 text-sky-700 font-bold text-[11px] rounded-lg border border-sky-100">{item.orderCount || 1}</span>
                        </td>
                        <td className="px-5 py-4 text-center text-slate-400 font-medium text-[11px]">
                          {plans.filter((p) => Object.values(p.totals || {}).some((t) => t.product_variant_id === (item as any).product_variant_id)).length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredPickList.length > 0 && (
                <div className="px-5 py-3 bg-slate-50/40 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
                  {filteredPickList.length} product variants · {filteredPickList.reduce((s, i) => s + i.quantity, 0)} total units to pull
                </div>
              )}
            </div>
      )}
    </div>
  );
}

function DispatchRequirementsTab({ warehouses }: { warehouses: any[] }) {
  const [date, setDate] = useState(todayIST);
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [slotFilter, setSlotFilter] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedWarehouses, setExpandedWarehouses] = useState<Record<string, boolean>>({});
  const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { date };
      if (warehouseFilter) params.warehouse_id = warehouseFilter;
      if (slotFilter) params.delivery_slot = slotFilter;
      const res = await api.get<any>("/admin/delivery/dispatch/requirements", { params });
      const rows: any[] = res.data?.data ?? [];
      setData(rows);
      // auto-expand all by default
      const wExp: Record<string, boolean> = {};
      const sExp: Record<string, boolean> = {};
      rows.forEach((wh) => {
        wExp[wh.warehouse_id] = true;
        (wh.slots ?? []).forEach((sl: any) => {
          sExp[`${wh.warehouse_id}::${sl.delivery_slot}`] = true;
        });
      });
      setExpandedWarehouses(wExp);
      setExpandedSlots(sExp);
    } catch {
      showErrorToast("Failed to load dispatch requirements");
    } finally {
      setLoading(false);
    }
  }, [date, warehouseFilter, slotFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-4 bg-slate-50/60 border border-slate-100 rounded-2xl">
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs">
          <Calendar size={13} className="text-emerald-500 shrink-0" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="outline-none bg-transparent font-bold text-slate-800 cursor-pointer" />
        </div>

        <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}
          className="py-2 px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-semibold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 shadow-xs">
          <option value="">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w.warehouse_id || w.id} value={w.warehouse_id || w.id}>{w.name}</option>
          ))}
        </select>

        <select value={slotFilter} onChange={(e) => setSlotFilter(e.target.value)}
          className="py-2 px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-semibold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 shadow-xs">
          <option value="">All Slots</option>
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
        </select>

        {(warehouseFilter || slotFilter) && (
          <button onClick={() => { setWarehouseFilter(""); setSlotFilter(""); }}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
            <X size={12} /> Clear
          </button>
        )}

        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 ml-auto disabled:opacity-60">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="h-4 w-48 bg-slate-100 rounded mb-4" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => <div key={j} className="h-8 bg-slate-50 rounded-xl" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && data.length === 0 && (
        <EmptyState icon={ClipboardList} title="No requirements found" desc="No orders scheduled for the selected date and filters." />
      )}

      {!loading && data.map((warehouse) => {
        const wExpanded = !!expandedWarehouses[warehouse.warehouse_id];
        const allItems = (warehouse.slots ?? []).flatMap((s: any) => s.items ?? []);
        const totalQty = allItems.reduce((s: number, i: any) => s + (i.required_qty ?? 0), 0);
        const shortfalls = allItems.filter((i: any) => i.shortfall > 0).length;

        return (
          <div key={warehouse.warehouse_id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Warehouse header */}
            <button
              onClick={() => setExpandedWarehouses((p) => ({ ...p, [warehouse.warehouse_id]: !wExpanded }))}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Boxes size={18} className="text-emerald-700" />
                </div>
                <div className="text-left">
                  <p className="font-black text-slate-900 text-sm">{warehouse.warehouse_name}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                    <span>{(warehouse.slots ?? []).length} slot{(warehouse.slots ?? []).length !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span className="font-bold text-slate-600">{totalQty} units required</span>
                    {shortfalls > 0 && (
                      <span className="flex items-center gap-1 text-rose-600 font-bold">
                        <AlertTriangle size={10} /> {shortfalls} shortfall{shortfalls !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {wExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {wExpanded && (
              <div className="border-t border-slate-100 divide-y divide-slate-50">
                {(warehouse.slots ?? []).map((slot: any) => {
                  const slotKey = `${warehouse.warehouse_id}::${slot.delivery_slot}`;
                  const slotExpanded = expandedSlots[slotKey] !== false; // default open
                  const c = SLOT_COLORS[slot.delivery_slot?.toLowerCase()] ?? SLOT_COLORS.default;

                  return (
                    <div key={slot.delivery_slot}>
                      <button
                        onClick={() => setExpandedSlots((p) => ({ ...p, [slotKey]: !slotExpanded }))}
                        className={`w-full flex items-center justify-between px-5 py-3 ${c.bg} hover:opacity-90 transition-opacity`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                          <span className={`font-black text-xs capitalize ${c.text}`}>{slot.delivery_slot} Slot</span>
                          <span className={`text-[10px] font-medium ${c.text} opacity-70`}>
                            · {slot.total_qty} units · {slot.total_orders} order{slot.total_orders !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {slotExpanded ? <ChevronUp size={14} className={c.text} /> : <ChevronDown size={14} className={c.text} />}
                      </button>

                      {slotExpanded && (
                        <div className="overflow-x-auto animate-in fade-in duration-200">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50/40 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                <th className="px-5 py-3">#</th>
                                <th className="px-5 py-3">Product</th>
                                <th className="px-5 py-3">Variant</th>
                                <th className="px-5 py-3 text-center">Required Qty</th>
                                <th className="px-5 py-3 text-center">Orders</th>
                                <th className="px-5 py-3 text-center">Stock</th>
                                <th className="px-5 py-3 text-center">Shortfall</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {(slot.items ?? []).map((item: any, idx: number) => (
                                <tr key={item.product_variant_id} className="hover:bg-slate-50/60 transition-colors group">
                                  <td className="px-5 py-3.5 text-slate-400 font-bold text-[11px]">{idx + 1}</td>
                                  <td className="px-5 py-3.5 font-bold text-slate-800 group-hover:text-emerald-800 transition-colors">{item.product_name}</td>
                                  <td className="px-5 py-3.5 text-slate-500 font-medium">{item.variant_name || "—"}</td>
                                  <td className="px-5 py-3.5 text-center">
                                    <span className="inline-flex items-center justify-center px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-black text-[11px]">
                                      ×{item.required_qty}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 text-center">
                                    <span className="px-2 py-0.5 bg-sky-50 text-sky-700 font-bold text-[11px] rounded-lg border border-sky-100">{item.total_orders}</span>
                                  </td>
                                  <td className="px-5 py-3.5 text-center">
                                    <span className={`px-2 py-0.5 rounded-lg font-bold text-[11px] border ${item.warehouse_stock >= item.required_qty ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"}`}>
                                      {item.warehouse_stock}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 text-center">
                                    {item.shortfall > 0 ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg font-black text-[11px]">
                                        <TrendingDown size={9} /> -{item.shortfall}
                                      </span>
                                    ) : (
                                      <span className="text-emerald-600 font-black text-[11px]">✓ OK</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Consolidated pick list for the same day */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <ClipboardList size={14} className="text-emerald-600" />
          <h2 className="text-sm font-black text-slate-800">Consolidated Warehouse Pick List</h2>
        </div>
        <WarehousePickList date={date} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tab 3: Returns
// ─────────────────────────────────────────────────────────

function ReturnsTab({ warehouses }: { warehouses: any[] }) {
  const [date, setDate] = useState(todayIST);
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [slotFilter, setSlotFilter] = useState("");
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [returnPreview, setReturnPreview] = useState<any | null>(null);
  const [returnQtys, setReturnQtys] = useState<Record<string, { returned_qty: number; damaged_qty: number; delivered_qty: number; remarks: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { date };
      if (warehouseFilter) params.warehouse_id = warehouseFilter;
      if (slotFilter) params.delivery_slot = slotFilter;
      const res = await api.get<any>("/admin/delivery/dispatch/returns", { params });
      setRuns(res.data?.data ?? []);
    } catch {
      showErrorToast("Failed to load returns");
    } finally {
      setLoading(false);
    }
  }, [date, warehouseFilter, slotFilter]);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const openReturnModal = async (run: any) => {
    setSelectedRun(run);
    setReturnPreview(null);
    setReturnQtys({});
    try {
      const res = await api.get<any>(`/admin/delivery/dispatch/${run.id || run.run_id}/return-preview`);
      const preview = res.data?.data ?? null;
      setReturnPreview(preview);
      if (preview?.items) {
        const init: typeof returnQtys = {};
        preview.items.forEach((item: any) => {
          init[item.product_variant_id] = {
            delivered_qty: Number(item.delivered_qty),
            returned_qty: Number(item.returnable_qty),
            damaged_qty: 0,
            remarks: "",
          };
        });
        setReturnQtys(init);
      }
    } catch {
      showErrorToast("Failed to load return preview");
    }
  };

  const submitReturn = async () => {
    if (!selectedRun || !returnPreview) return;
    setSubmitting(true);
    try {
      const items = returnPreview.items.map((item: any) => {
        const q = returnQtys[item.product_variant_id] ?? {};
        return {
          product_variant_id: item.product_variant_id,
          delivered_qty: q.delivered_qty ?? item.delivered_qty,
          returned_qty: q.returned_qty ?? 0,
          damaged_qty: q.damaged_qty ?? 0,
          remarks: q.remarks ?? "",
        };
      });
      await api.post<any>(`/admin/delivery/dispatch/${selectedRun.id || selectedRun.run_id}/return`, { items });
      showSuccessToast("Return processed successfully!");
      setSelectedRun(null);
      setReturnPreview(null);
      loadRuns();
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || "Failed to process return");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-4 bg-slate-50/60 border border-slate-100 rounded-2xl">
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs">
          <Calendar size={13} className="text-emerald-500 shrink-0" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="outline-none bg-transparent font-bold text-slate-800 cursor-pointer" />
        </div>
        <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}
          className="py-2 px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-semibold outline-none focus:border-emerald-400 shadow-xs">
          <option value="">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w.warehouse_id || w.id} value={w.warehouse_id || w.id}>{w.name}</option>
          ))}
        </select>
        <select value={slotFilter} onChange={(e) => setSlotFilter(e.target.value)}
          className="py-2 px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-semibold outline-none focus:border-emerald-400 shadow-xs">
          <option value="">All Slots</option>
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
        </select>
        {(warehouseFilter || slotFilter) && (
          <button onClick={() => { setWarehouseFilter(""); setSlotFilter(""); }}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
            <X size={12} /> Clear
          </button>
        )}
        <button onClick={loadRuns} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 ml-auto disabled:opacity-60">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {loading && (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white rounded-2xl border border-slate-200" />)}
        </div>
      )}

      {!loading && runs.length === 0 && (
        <EmptyState icon={RotateCcw} title="No returns pending" desc="No dispatched runs found for the selected filters." />
      )}

      {!loading && runs.length > 0 && (
        <div className="space-y-3">
          {runs.map((run) => {
            const pendingQty = Number(run.pending_return_qty ?? 0);
            return (
              <div key={run.id || run.run_id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
                  {/* Partner info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm border ${pendingQty > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                      {(run.delivery_partner_name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{run.delivery_partner_name ?? "Unknown"}</span>
                        {run.run_number && <code className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-mono">{run.run_number}</code>}
                        <SlotBadge slot={run.delivery_slot} />
                        <RunStatusBadge status={run.run_status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1"><Boxes size={10} /> {run.warehouse_name}</span>
                        <span className="flex items-center gap-1"><Package size={10} /> {run.total_items} items</span>
                        <span className="flex items-center gap-1 font-bold text-emerald-600">Loaded: {Number(run.total_loaded)}</span>
                        <span className="flex items-center gap-1 font-bold text-sky-600">Delivered: {Number(run.total_delivered)}</span>
                        <span className="flex items-center gap-1 font-bold text-rose-600">Returned: {Number(run.total_returned)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-auto">
                    {pendingQty > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-black text-amber-700">
                        <AlertTriangle size={11} /> {pendingQty} pending
                      </div>
                    )}
                    <button
                      onClick={() => openReturnModal(run)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow-md shadow-[#2E7D32]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <RotateCcw size={12} /> Process Return
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Return Modal */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 to-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Process Return</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                      <Truck size={9} /> {selectedRun.delivery_partner_name}
                    </span>
                    <SlotBadge slot={selectedRun.delivery_slot} />
                    <span className="text-[10px] text-slate-400 font-medium">{selectedRun.warehouse_name}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => { setSelectedRun(null); setReturnPreview(null); }}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!returnPreview ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="animate-spin text-emerald-500" />
                </div>
              ) : returnPreview.items?.length === 0 ? (
                <EmptyState icon={Package} title="No dispatch items found" />
              ) : (
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs bg-white">
                  <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Item Return Quantities</h4>
                    <span className="text-[10px] text-slate-400">{returnPreview.items?.length} items · stock will return to <strong>{returnPreview.run?.warehouse_name}</strong></span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/40 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3 text-center w-20">Loaded</th>
                          <th className="px-4 py-3 text-center w-28">Delivered</th>
                          <th className="px-4 py-3 text-center w-28">Returned</th>
                          <th className="px-4 py-3 text-center w-28">Damaged</th>
                          <th className="px-4 py-3 w-32">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {returnPreview.items.map((item: any) => {
                          const q = returnQtys[item.product_variant_id] ?? {};
                          const update = (field: string, val: number | string) =>
                            setReturnQtys((p) => ({ ...p, [item.product_variant_id]: { ...p[item.product_variant_id], [field]: typeof val === "number" ? Math.max(0, val) : val } }));
                          return (
                            <tr key={item.product_variant_id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-3.5">
                                <p className="font-bold text-slate-800 leading-tight">{item.product_name}</p>
                                <p className="text-[10px] text-slate-400 leading-tight">{item.variant_name}</p>
                              </td>
                              <td className="px-4 py-3.5 text-center font-black text-slate-500">{item.loaded_qty}</td>
                              <td className="px-4 py-3.5 text-center">
                                <input type="number" min="0" max={item.loaded_qty} value={q.delivered_qty ?? item.delivered_qty}
                                  onChange={(e) => update("delivered_qty", parseInt(e.target.value) || 0)}
                                  className="w-20 text-center px-2 py-1.5 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <input type="number" min="0" max={item.loaded_qty} value={q.returned_qty ?? item.returnable_qty}
                                  onChange={(e) => update("returned_qty", parseInt(e.target.value) || 0)}
                                  className="w-20 text-center px-2 py-1.5 border border-emerald-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 text-emerald-700" />
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <input type="number" min="0" max={item.loaded_qty} value={q.damaged_qty ?? 0}
                                  onChange={(e) => update("damaged_qty", parseInt(e.target.value) || 0)}
                                  className="w-20 text-center px-2 py-1.5 border border-rose-200 rounded-xl text-xs font-bold outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 text-rose-700" />
                              </td>
                              <td className="px-4 py-3.5">
                                <input type="text" placeholder="optional…" value={q.remarks ?? ""}
                                  onChange={(e) => update("remarks", e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-xl text-[10px] outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {returnPreview && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>Returned items will be credited back to <strong>{returnPreview.run?.warehouse_name ?? "the source warehouse"}</strong>. This action cannot be undone.</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
              <button onClick={() => { setSelectedRun(null); setReturnPreview(null); }}
                className="px-4 py-2.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all">
                Cancel
              </button>
              <button onClick={submitReturn} disabled={submitting || !returnPreview}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#2E7D32]/20 disabled:opacity-60">
                {submitting ? <><Loader2 size={12} className="animate-spin" /> Processing…</> : <><Check size={12} /> Confirm Return</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tab 4: Dispatched Items History
// ─────────────────────────────────────────────────────────

function DispatchedItemsHistoryTab({ warehouses }: { warehouses: any[] }) {
  const today = todayIST();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(today);
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [slotFilter, setSlotFilter] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const LIMIT = 50;

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { date_from: dateFrom, date_to: dateTo, page: pg, limit: LIMIT };
      if (warehouseFilter) params.warehouse_id = warehouseFilter;
      if (slotFilter) params.delivery_slot = slotFilter;
      const res = await api.get<any>("/admin/delivery/dispatch/history/items", { params });
      setData(res.data?.data ?? []);
      setTotal(res.data?.total ?? 0);
      setPage(pg);
    } catch {
      showErrorToast("Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, warehouseFilter, slotFilter]);

  useEffect(() => { load(1); }, [load]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2 p-4 bg-slate-50/60 border border-slate-100 rounded-2xl">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-xs">
          <Calendar size={13} className="text-emerald-500" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="outline-none bg-transparent font-semibold text-slate-700 cursor-pointer" />
          <span className="text-slate-300">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="outline-none bg-transparent font-semibold text-slate-700 cursor-pointer" />
        </div>
        <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}
          className="py-2 px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-semibold outline-none focus:border-emerald-400 shadow-xs">
          <option value="">All Warehouses</option>
          {warehouses.map((w) => <option key={w.warehouse_id || w.id} value={w.warehouse_id || w.id}>{w.name}</option>)}
        </select>
        <select value={slotFilter} onChange={(e) => setSlotFilter(e.target.value)}
          className="py-2 px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-semibold outline-none focus:border-emerald-400 shadow-xs">
          <option value="">All Slots</option>
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
        </select>
        {(warehouseFilter || slotFilter) && (
          <button onClick={() => { setWarehouseFilter(""); setSlotFilter(""); }}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
            <X size={12} /> Clear
          </button>
        )}
        <button onClick={() => load(1)} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 ml-auto disabled:opacity-60">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-slate-500 font-medium">{total} records found</p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => load(page - 1)}
                className="px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all">← Prev</button>
              <span className="text-[11px] font-bold text-slate-500">Page {page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => load(page + 1)}
                className="px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all">Next →</button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="animate-pulse p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-slate-50 rounded-xl" />)}
          </div>
        ) : data.length === 0 ? (
          <EmptyState icon={History} title="No dispatch history found" desc="Adjust the date range or filters to find records." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Run</th>
                  <th className="px-4 py-3">Slot</th>
                  <th className="px-4 py-3">Warehouse</th>
                  <th className="px-4 py-3">Partner</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-center">Loaded</th>
                  <th className="px-4 py-3 text-center">Delivered</th>
                  <th className="px-4 py-3 text-center">Returned</th>
                  <th className="px-4 py-3 text-center">Damaged</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-slate-600 whitespace-nowrap">{row.run_date ? new Date(row.run_date).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-4 py-3.5">
                      <code className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{row.run_number || row.run_id || "—"}</code>
                    </td>
                    <td className="px-4 py-3.5"><SlotBadge slot={row.delivery_slot} /></td>
                    <td className="px-4 py-3.5 text-slate-500 font-medium whitespace-nowrap">{row.warehouse_name}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-700 whitespace-nowrap">{row.delivery_partner_name ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-800 leading-tight">{row.product_name}</p>
                      <p className="text-[10px] text-slate-400">{row.variant_name}</p>
                    </td>
                    <td className="px-4 py-3.5 text-center"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg font-black text-[11px]">{Number(row.loaded_qty)}</span></td>
                    <td className="px-4 py-3.5 text-center"><span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-100 rounded-lg font-bold text-[11px]">{Number(row.delivered_qty)}</span></td>
                    <td className="px-4 py-3.5 text-center"><span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg font-bold text-[11px]">{Number(row.returned_qty)}</span></td>
                    <td className="px-4 py-3.5 text-center"><span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg font-bold text-[11px]">{Number(row.damaged_qty)}</span></td>
                    <td className="px-4 py-3.5 text-center"><RunStatusBadge status={row.run_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tab 5: Partner Dispatch History
// ─────────────────────────────────────────────────────────

function PartnerDispatchHistoryTab({ warehouses }: { warehouses: any[] }) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(todayIST);
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [slotFilter, setSlotFilter] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  const LIMIT = 50;

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { date_from: dateFrom, date_to: dateTo, page: pg, limit: LIMIT };
      if (warehouseFilter) params.warehouse_id = warehouseFilter;
      if (slotFilter) params.delivery_slot = slotFilter;
      const res = await api.get<any>("/admin/delivery/dispatch/history/partners", { params });
      setData(res.data?.data ?? []);
      setTotal(res.data?.total ?? 0);
      setPage(pg);
    } catch {
      showErrorToast("Failed to load partner dispatch history");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, warehouseFilter, slotFilter]);

  useEffect(() => { load(1); }, [load]);

  // group by partner name for accordion display
  const grouped = useMemo(() => {
    const map: Record<string, { partner_name: string; partner_phone: string; runs: any[] }> = {};
    data.forEach((row) => {
      const key = row.delivery_partner_id ?? row.delivery_partner_name ?? "unknown";
      if (!map[key]) map[key] = { partner_name: row.delivery_partner_name ?? "Unknown", partner_phone: row.delivery_partner_phone ?? "", runs: [] };
      map[key].runs.push(row);
    });
    return Object.values(map);
  }, [data]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2 p-4 bg-slate-50/60 border border-slate-100 rounded-2xl">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-xs">
          <Calendar size={13} className="text-emerald-500" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="outline-none bg-transparent font-semibold text-slate-700 cursor-pointer" />
          <span className="text-slate-300">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="outline-none bg-transparent font-semibold text-slate-700 cursor-pointer" />
        </div>
        <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}
          className="py-2 px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-semibold outline-none focus:border-emerald-400 shadow-xs">
          <option value="">All Warehouses</option>
          {warehouses.map((w) => <option key={w.warehouse_id || w.id} value={w.warehouse_id || w.id}>{w.name}</option>)}
        </select>
        <select value={slotFilter} onChange={(e) => setSlotFilter(e.target.value)}
          className="py-2 px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-semibold outline-none focus:border-emerald-400 shadow-xs">
          <option value="">All Slots</option>
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
        </select>
        {(warehouseFilter || slotFilter) && (
          <button onClick={() => { setWarehouseFilter(""); setSlotFilter(""); }}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
            <X size={12} /> Clear
          </button>
        )}
        <button onClick={() => load(1)} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 ml-auto disabled:opacity-60">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-slate-500 font-medium">{total} dispatch records found</p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => load(page - 1)}
                className="px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">← Prev</button>
              <span className="text-[11px] font-bold text-slate-500">Page {page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => load(page + 1)}
                className="px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Next →</button>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white rounded-2xl border border-slate-200" />)}
        </div>
      )}

      {!loading && grouped.length === 0 && (
        <EmptyState icon={Users} title="No partner dispatch history" desc="Adjust the date range or filters to find records." />
      )}

      {!loading && grouped.map((partner) => {
        const key = partner.partner_name;
        const isOpen = expandedPartner === key;
        const totalLoaded = partner.runs.reduce((s, r) => s + Number(r.total_qty ?? 0), 0);
        const totalDelivered = partner.runs.reduce((s, r) => s + Number(r.delivered_qty ?? 0), 0);
        const totalReturned = partner.runs.reduce((s, r) => s + Number(r.returned_qty ?? 0), 0);

        return (
          <div key={key} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <button
              onClick={() => setExpandedPartner(isOpen ? null : key)}
              className="w-full flex items-center gap-4 p-4 md:p-5 hover:bg-slate-50/60 transition-colors"
            >
              <div className="h-11 w-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center font-black text-sm text-emerald-700 shrink-0">
                {partner.partner_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-black text-slate-900 text-sm">{partner.partner_name}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5 text-[11px] text-slate-400">
                  {partner.partner_phone && <span className="flex items-center gap-1"><Phone size={10} /> {partner.partner_phone}</span>}
                  <span className="font-bold text-slate-600">{partner.runs.length} dispatch run{partner.runs.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <div className="flex items-stretch divide-x divide-slate-100 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden text-xs shrink-0">
                {[
                  { label: "Loaded", value: totalLoaded, cls: "text-slate-700" },
                  { label: "Delivered", value: totalDelivered, cls: "text-sky-700" },
                  { label: "Returned", value: totalReturned, cls: "text-amber-700" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex flex-col items-center justify-center px-3 py-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                    <span className={`font-black mt-0.5 ${cls}`}>{value}</span>
                  </div>
                ))}
              </div>
              {isOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200 overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/40 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Run</th>
                      <th className="px-4 py-3">Slot</th>
                      <th className="px-4 py-3">Warehouse</th>
                      <th className="px-4 py-3 text-center">Items</th>
                      <th className="px-4 py-3 text-center">Loaded</th>
                      <th className="px-4 py-3 text-center">Delivered</th>
                      <th className="px-4 py-3 text-center">Returned</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {partner.runs.map((run, idx) => (
                      <tr key={`${run.dispatch_id}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-slate-600 whitespace-nowrap">{run.run_date ? new Date(run.run_date).toLocaleDateString("en-IN") : "—"}</td>
                        <td className="px-4 py-3.5"><code className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{run.run_number || run.run_id || "—"}</code></td>
                        <td className="px-4 py-3.5"><SlotBadge slot={run.delivery_slot} /></td>
                        <td className="px-4 py-3.5 text-slate-500 font-medium whitespace-nowrap">{run.warehouse_name}</td>
                        <td className="px-4 py-3.5 text-center font-bold text-slate-600">{run.items_count}</td>
                        <td className="px-4 py-3.5 text-center"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg font-black text-[11px]">{Number(run.total_qty)}</span></td>
                        <td className="px-4 py-3.5 text-center"><span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-100 rounded-lg font-bold text-[11px]">{Number(run.delivered_qty)}</span></td>
                        <td className="px-4 py-3.5 text-center"><span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg font-bold text-[11px]">{Number(run.returned_qty)}</span></td>
                        <td className="px-4 py-3.5 text-center"><RunStatusBadge status={run.run_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Tab 2: Handover (existing DispatchPlanningDashboard)
// ─────────────────────────────────────────────────────────

function HandoverTab({ warehouses }: { warehouses: any[] }) {
  const [isGenerated, setIsGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<DeliveryPartnerPlan[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");


  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [showOrderBreakdowns, setShowOrderBreakdowns] = useState<Record<string, boolean>>({});
  const [approvingRuns, setApprovingRuns] = useState<Record<string, boolean>>({});
  const [pendingAccordionOpen, setPendingAccordionOpen] = useState(true);
  const [dispatchedAccordionOpen, setDispatchedAccordionOpen] = useState(false);
  const [ordersPage, setOrdersPage] = useState<Record<string, number>>({});

  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [activePlanForModal, setActivePlanForModal] = useState<DeliveryPartnerPlan | null>(null);
  const [modalItems, setModalItems] = useState<any[]>([]);
  const [availableVariants, setAvailableVariants] = useState<any[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [selectedVariantToAdd, setSelectedVariantToAdd] = useState("");
  const [qtyToAdd, setQtyToAdd] = useState(1);
  const [searchQueryVariant, setSearchQueryVariant] = useState("");
  const [isSearchingVariantDropdownOpen, setIsSearchingVariantDropdownOpen] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [riderFilter, setRiderFilter] = useState("");

  const [targetDate, setTargetDate] = useState(() => todayIST());
  const [availableDates, setAvailableDates] = useState<{ value: string; label: string }[]>(() => getPastWeekDates());

  useEffect(() => {
    api.get<any>("/admin/delivery/dispatch/requirements/dates")
      .then((res) => {
        if (res.data?.status && Array.isArray(res.data.data)) {
          const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", month: "short", day: "numeric" });
          const todayStr = todayIST();
          const datesSet = new Set<string>(res.data.data);
          datesSet.add(todayStr);
          const sortedDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));
          const mapped = sortedDates.map((dateStr) => {
            const parts = dateStr.split("-");
            const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            let label = formatter.format(dateObj);
            if (dateStr === todayStr) label = `Today (${label})`;
            return { value: dateStr, label };
          });
          setAvailableDates(mapped);
        }
      })
      .catch(() => {});
  }, [isGenerated]);

  useEffect(() => {
    if (warehouses.length > 0) setSelectedWarehouse(warehouses[0].warehouse_id || warehouses[0].id || "");
  }, [warehouses]);

  // Stock on offer is whatever the run's own warehouse holds, so the picker
  // cannot suggest something that is not on the shelf.
  const modalWarehouseId = activePlanForModal?.warehouse_id || selectedWarehouse || "";

  useEffect(() => {
    if (!isApproveModalOpen) return;
    let cancelled = false;
    setAvailableVariants([]);
    setLoadingVariants(true);
    const params: Record<string, string> = {};
    if (modalWarehouseId) params.warehouse_id = modalWarehouseId;
    else if (activePlanForModal?.run_id) params.run_id = activePlanForModal.run_id;
    api.get<any>("/admin/delivery/dispatch/available-variants", { params })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.status && Array.isArray(res.data.data)) setAvailableVariants(res.data.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingVariants(false); });
    return () => { cancelled = true; };
  }, [isApproveModalOpen, modalWarehouseId, activePlanForModal?.run_id]);

  const loadPlan = async (date: string, quiet = false) => {
    if (!date) return;
    setLoading(true);
    try {
      const data = await DispatchPlanningService.fetchDispatchPlan(date);
      setPlans(data);
      if (data.length > 0) {
        setIsGenerated(true);
        const initialExpanded: Record<string, boolean> = {};
        data.slice(0, 2).forEach((p) => { initialExpanded[p.run_id] = true; });
        setExpandedCards(initialExpanded);
        if (!quiet) showSuccessToast("Dispatch plan loaded!");
      } else {
        setIsGenerated(false);
        if (!quiet) showSuccessToast("No runs found for this date. Please assign routes first.");
      }
    } catch {
      if (!quiet) showErrorToast("Failed to load dispatch plan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlan(targetDate, true); }, [targetDate]);

  const warehouseTotals = useMemo(() => DispatchPlanningService.compileWarehouseTotals(plans), [plans]);

  const statistics = useMemo(() => {
    let totalOrders = 0;
    const uniqueCustomers = new Set<string>();
    let totalRiders = 0;
    let totalQty = 0;
    plans.forEach((p) => {
      totalOrders += p.orders.length;
      p.orders.forEach((o) => uniqueCustomers.add(o.customer_name));
      if (p.delivery_partner_id) totalRiders++;
      totalQty += p.totalQuantity;
    });
    const dispatched = plans.filter((p) => Boolean(p.isDispatched ?? p.hasActualDispatch)).length;
    const pending = plans.length - dispatched;
    return { totalOrders, totalCustomers: uniqueCustomers.size, totalRiders, totalProducts: Object.keys(warehouseTotals).length, totalQty, dispatched, pending };
  }, [plans, warehouseTotals]);

  const filteredPlans = useMemo(() =>
    plans.filter((p) => {
      const q = activeSearch.toLowerCase();
      const matchSearch = !q ||
        p.delivery_partner_name.toLowerCase().includes(q) ||
        p.orders.some((o) => o.customer_name.toLowerCase().includes(q)) ||
        p.orders.some((o) => String(o.order_id || "").includes(q));
      const matchSlot = !selectedSlot || p.delivery_slot === selectedSlot;
      const matchRider = !riderFilter || p.delivery_partner_name === riderFilter;
      return matchSearch && matchSlot && matchRider;
    }),
    [plans, activeSearch, selectedSlot, riderFilter]
  );

  const matchingVariants = useMemo(() => {
    const q = searchQueryVariant.toLowerCase();
    return availableVariants.filter((v) =>
      `${v.product_name} ${v.variant_name} ${v.unit_value || ""} ${v.unit_type || ""}`.toLowerCase().includes(q),
    );
  }, [availableVariants, searchQueryVariant]);

  /** Units on hand for the row currently chosen in the picker. */
  const selectedVariantStock = useMemo(() => {
    const v = availableVariants.find((x) => x.product_variant_id === selectedVariantToAdd);
    return v ? Number(v.available_quantity ?? 0) : 0;
  }, [availableVariants, selectedVariantToAdd]);

  const handleApproveDispatch = async (plan: DeliveryPartnerPlan) => {
    if (!plan.warehouse_id && !selectedWarehouse) {
      showErrorToast("This run's branch has no warehouse — select a source warehouse first.");
      return;
    }
    setActivePlanForModal(plan);
    setModalItems(
      Object.values(plan.totals || {}).map((item) => {
        const planned = item.planned_qty !== undefined ? Number(item.planned_qty) : (item.orderCount === 0 ? 0 : Number(item.quantity || 0));
        const loaded = item.loaded_qty !== undefined ? Number(item.loaded_qty) : Number(item.quantity || 0);
        return {
          ...item,
          planned_qty: planned,
          loaded_qty: loaded,
        };
      })
    );
    setSelectedVariantToAdd("");
    setQtyToAdd(1);
    setSearchQueryVariant("");
    setIsApproveModalOpen(true);
  };

  const handleConfirmModalApproval = async () => {
    if (!activePlanForModal || !selectedWarehouse) return;
    setApprovingRuns((prev) => ({ ...prev, [activePlanForModal.run_id]: true }));
    setIsApproveModalOpen(false);
    try {
      const updatedTotals: Record<string, any> = {};
      modalItems.forEach((item) => {
        const key = `${item.product_name.trim()}::${item.variant_name.trim()}`;
        const planned = Number(item.planned_qty || 0);
        const loaded = Number(item.loaded_qty || 0);
        const extra = Math.max(0, loaded - planned);
        updatedTotals[key] = {
          ...item,
          planned_qty: planned,
          loaded_qty: loaded,
          extra_qty: extra,
          quantity: loaded,
        };
      });
      const res = await DispatchPlanningService.approveDispatch(
        activePlanForModal.id,
        activePlanForModal.warehouse_id || selectedWarehouse,
        updatedTotals,
      );
      if (res && res.error) { showErrorToast(res.error); return; }
      showSuccessToast(`Dispatch approved for ${activePlanForModal.delivery_partner_name}!`);
      setPlans((prev) => prev.map((p) => p.run_id === activePlanForModal.run_id
        ? {
            ...p,
            status: "dispatched",
            totals: updatedTotals,
            totalQuantity: modalItems.reduce((s, i) => s + Number(i.loaded_qty || 0), 0),
            totalPlannedQty: modalItems.reduce((s, i) => s + Number(i.planned_qty || 0), 0),
            totalExtraQty: modalItems.reduce((s, i) => s + Math.max(0, Number(i.loaded_qty || 0) - Number(i.planned_qty || 0)), 0),
            totalProducts: modalItems.length,
          }
        : p
      ));
    } catch (err: any) {
      showErrorToast(err.response?.data?.message || err.message || "Failed to approve dispatch.");
    } finally {
      setApprovingRuns((prev) => ({ ...prev, [activePlanForModal.run_id]: false }));
      setActivePlanForModal(null);
    }
  };

  const exportToCSV = () => {
    if (!plans.length) return;
    let csv = "data:text/csv;charset=utf-8,Delivery Boy,Branch,Slot,Product,Variant,Quantity,Orders\n";
    plans.forEach((plan) => Object.values(plan.totals).forEach((t) => {
      csv += `"${plan.delivery_partner_name}","${plan.branch_name}","${plan.delivery_slot}","${t.product_name}","${t.variant_name}",${t.quantity},${t.orderCount || 1}\n`;
    }));
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `dispatch_plan_${targetDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccessToast("CSV exported!");
  };

  const printSingleRider = (plan: DeliveryPartnerPlan) => {
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = Object.values(plan.totals).map((t) => `<tr><td style="padding:10px;border-bottom:1px solid #eee"><strong>${t.product_name}</strong><br/><span style="font-size:11px;color:#64748b">${t.variant_name || ""}</span></td><td style="padding:10px;text-align:center;font-weight:bold;font-size:15px">×${t.quantity}</td><td style="padding:10px;text-align:center">${t.orderCount || 1}</td></tr>`).join("");
    const orders = plan.orders.map((o) => `<div style="border:1px solid #e2e8f0;padding:10px;margin-bottom:8px;border-radius:6px"><strong>#${o.order_id} – ${o.customer_name}</strong><br/><span style="font-size:12px;color:#64748b">${o.address_line}</span><ul style="margin:6px 0 0;padding-left:18px">${o.items.map((i) => `<li>${i.product_name}${i.variant_name && i.variant_name !== i.product_name ? ` (${i.variant_name})` : ""} ×${i.quantity}</li>`).join("")}</ul></div>`).join("");
    w.document.write(`<html><head><title>Dispatch – ${plan.delivery_partner_name}</title><style>body{font-family:sans-serif;padding:30px;color:#1e293b}table{width:100%;border-collapse:collapse}th{background:#f1f5f9;padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#475569}h2{color:#047857;border-bottom:2px solid #10b981;padding-bottom:8px}</style></head><body><h2>F2H Rider Dispatch Sheet – ${targetDate}</h2><p><strong>Rider:</strong> ${plan.delivery_partner_name} | <strong>Phone:</strong> ${plan.phone} | <strong>Branch:</strong> ${plan.branch_name} | <strong>Slot:</strong> ${plan.delivery_slot}</p><h3>Items to Dispatch</h3><table><thead><tr><th>Product/Variant</th><th>Qty</th><th>Orders</th></tr></thead><tbody>${rows}</tbody></table><h3>Customer Orders (${plan.orders.length})</h3>${orders}<script>window.onload=()=>{window.print();window.close()}</script></body></html>`);
    w.document.close();
  };

  const uniqueRiders = useMemo(() => Array.from(new Set(plans.map((p) => p.delivery_partner_name))).filter(Boolean), [plans]);

  return (
    <div className="space-y-5 p-2 md:p-4">
      <style dangerouslySetInnerHTML={{ __html: `@media print{.no-print{display:none!important}.print-full{width:100%!important;display:block!important}.print-card-break{page-break-inside:avoid!important}}` }} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-800 shadow-xs hover:bg-emerald-100 transition-colors cursor-pointer">
          <Calendar size={13} className="text-emerald-500 shrink-0" />
          <select value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="outline-none bg-transparent cursor-pointer font-bold text-emerald-900 max-w-[160px]">
            {availableDates.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        {warehouses.length > 0 && (
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-800 shadow-xs hover:bg-emerald-100 transition-colors cursor-pointer">
            <Package size={13} className="text-emerald-500 shrink-0" />
            <select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)} className="outline-none bg-transparent cursor-pointer font-bold text-emerald-900 max-w-[140px]">
              {warehouses.map((w) => <option key={w.warehouse_id || w.id} value={w.warehouse_id || w.id}>{w.name}</option>)}
            </select>
          </div>
        )}

        {isGenerated && (
          <>
            <button onClick={() => loadPlan(targetDate, false)} disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-all border border-emerald-200 shadow-xs disabled:opacity-60">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button onClick={exportToCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-all border border-emerald-200 shadow-xs">
              <FileDown size={13} /> Export
            </button>
          </>
        )}

        {!isGenerated && !loading && (
          <button onClick={() => loadPlan(targetDate, false)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow-md shadow-[#2E7D32]/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
            <Zap size={14} /> Generate Plan
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse no-print">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="h-3 w-20 bg-slate-100 rounded mb-4" />
                <div className="h-8 w-12 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-xl" />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isGenerated && !loading && (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200/80 shadow-sm text-center gap-4 no-print">
          <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
            <ClipboardList size={28} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-base font-black text-slate-800">No dispatch data for this date</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">Select a date with assigned delivery runs, or generate a new plan to start dispatching.</p>
          </div>
          <button onClick={() => loadPlan(targetDate, false)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm font-bold rounded-xl shadow-md shadow-[#2E7D32]/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
            <Zap size={14} /> Generate Dispatch Plan
          </button>
        </div>
      )}

      {/* Main Dashboard */}
      {isGenerated && !loading && (
        <div className="space-y-5 print-full">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
            {[
              { label: "Total Orders", value: statistics.totalOrders, icon: ShoppingBag, colors: "bg-sky-50 text-sky-700 border-sky-100" },
              { label: "Customers", value: statistics.totalCustomers, icon: Users, colors: "bg-violet-50 text-violet-700 border-violet-100" },
              { label: "Delivery Partners", value: statistics.totalRiders, icon: Truck, colors: "bg-emerald-50 text-emerald-700 border-emerald-100" },
              { label: "Unique Products", value: statistics.totalProducts, icon: Package, colors: "bg-amber-50 text-amber-700 border-amber-100" },
              { label: "Dispatched Runs", value: statistics.dispatched, icon: CheckCircle2, colors: "bg-green-50 text-green-700 border-green-100" },
              { label: "Pending Runs", value: statistics.pending, icon: Clock, colors: "bg-rose-50 text-rose-700 border-rose-100" },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className={`bg-white rounded-2xl border p-4 flex items-center gap-3 shadow-xs hover:shadow-md transition-shadow duration-300 ${stat.colors.split(" ")[2]}`}>
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${stat.colors.split(" ")[0]} ${stat.colors.split(" ")[1]}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{stat.label}</p>
                    <p className="text-2xl font-black text-slate-800 leading-none mt-0.5">{stat.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sub-tabs: Bulk | Riders */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden no-print">
            <div className="flex border-b border-slate-100">
              <div className="flex items-center gap-2 px-6 py-4 text-sm font-bold text-[#2E7D32] relative">
                <Truck size={15} />
                Rider Handover Dispatches
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2E7D32] rounded-t-full" />
              </div>
            </div>

            {/* Rider Dispatches */}
            {(
              <div className="animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center gap-2 p-4 border-b border-slate-100 bg-slate-50/40">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input type="text" placeholder="Search rider, customer, order..." value={searchInput}
                      onChange={(e) => { setSearchInput(e.target.value); setActiveSearch(e.target.value); }}
                      className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all w-56 font-medium" />
                  </div>
                  <select value={riderFilter} onChange={(e) => setRiderFilter(e.target.value)}
                    className="py-2 px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-semibold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                    <option value="">All Riders</option>
                    {uniqueRiders.map((r, i) => <option key={i} value={r}>{r}</option>)}
                  </select>
                  <select value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)}
                    className="py-2 px-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-semibold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                    <option value="">All Slots</option>
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                  </select>
                  {(searchInput || riderFilter || selectedSlot) && (
                    <button onClick={() => { setSearchInput(""); setActiveSearch(""); setRiderFilter(""); setSelectedSlot(""); }}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                      <X size={12} /> Clear
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">{filteredPlans.length} runs</span>
                    <button onClick={() => { const e: Record<string, boolean> = {}; plans.forEach((p) => { e[p.run_id] = true; }); setExpandedCards(e); }}
                      className="px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all">Expand All</button>
                    <button onClick={() => setExpandedCards({})}
                      className="px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all">Collapse</button>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {filteredPlans.length === 0 ? (
                    <div className="text-center py-16">
                      <Truck size={40} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-sm font-bold text-slate-400">No delivery runs match your filters</p>
                    </div>
                  ) : (() => {
                    const pendingPlans = filteredPlans.filter((p) => !Boolean(p.isDispatched ?? p.hasActualDispatch));
                    const dispatchedPlans = filteredPlans.filter((p) => Boolean(p.isDispatched ?? p.hasActualDispatch));

                    const renderCard = (plan: DeliveryPartnerPlan) => {
                      const isExpanded = !!expandedCards[plan.run_id];
                      const showBreakdown = !!showOrderBreakdowns[plan.run_id];
                      const isDispatched = Boolean(plan.isDispatched ?? plan.hasActualDispatch);
                      const isApproving = !!approvingRuns[plan.run_id];

                      return (
                        <div key={plan.run_id} id={`rider-card-${plan.run_id}`}
                          className={`bg-white rounded-2xl border shadow-xs overflow-hidden print-card-break transition-all duration-300 hover:shadow-md ${isDispatched ? "border-emerald-200/70" : "border-amber-200/60"}`}>
                          <div onClick={() => setExpandedCards((prev) => ({ ...prev, [plan.run_id]: !prev[plan.run_id] }))}
                            className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center gap-4 cursor-pointer hover:bg-slate-50/50 select-none transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm border ${isDispatched ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                {plan.delivery_partner_name?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-black text-slate-900 text-sm">{plan.delivery_partner_name}</span>
                                  <code className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-mono">{plan.run_number}</code>
                                  <SlotBadge slot={plan.delivery_slot} />
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-slate-500">
                                  <span className="flex items-center gap-1"><Phone size={10} /> {plan.phone}</span>
                                  <span className="flex items-center gap-1"><MapPin size={10} /> {plan.branch_name}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
                              <div className="flex items-stretch divide-x divide-slate-100 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden text-xs">
                                {[
                                  { label: "Orders", value: plan.totalOrders },
                                  { label: "Customers", value: plan.totalCustomers },
                                  { label: "Products", value: plan.totalProducts },
                                  ...((plan.totalExtraQty || 0) > 0 ? [
                                    { label: "Planned", value: plan.totalPlannedQty ?? plan.totalQuantity },
                                    { label: "Extra", value: `+${plan.totalExtraQty}`, highlight: true },
                                    { label: "Total Qty", value: plan.totalQuantity },
                                  ] : [
                                    { label: "Qty", value: plan.totalQuantity },
                                  ]),
                                ].map(({ label, value, highlight }: any) => (
                                  <div key={label} className={`flex flex-col items-center justify-center px-3 py-2 ${highlight ? "bg-amber-50" : ""}`}>
                                    <span className={`text-[9px] font-black uppercase tracking-wider ${highlight ? "text-amber-700" : "text-slate-400"}`}>{label}</span>
                                    <span className={`font-black mt-0.5 ${highlight ? "text-amber-900" : "text-slate-700"}`}>{value}</span>
                                  </div>
                                ))}
                              </div>
                              <StatusBadge dispatched={isDispatched} dispatchStatus={plan.dispatchStatus} />
                              {!isDispatched && (
                                <button onClick={(e) => { e.stopPropagation(); if (!isApproving) handleApproveDispatch(plan); }} disabled={isApproving}
                                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all no-print shadow-sm ${
                                    isApproving ? "bg-emerald-50 text-emerald-600 cursor-wait border border-emerald-200" : "bg-[#2E7D32] hover:bg-[#1B5E20] text-white shadow-[#2E7D32]/20 hover:scale-[1.02] active:scale-[0.98]"
                                  }`}>
                                  {isApproving ? <><Loader2 size={12} className="animate-spin" /> Approving…</> : <>Approve Handover <ArrowRight size={12} /></>}
                                </button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); printSingleRider(plan); }}
                                className="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 border border-slate-200 transition-all no-print" title="Print Sheet">
                                <Printer size={14} />
                              </button>
                              <div className="text-slate-400 no-print">{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-slate-100 bg-slate-50/30 p-4 md:p-5 animate-in fade-in slide-in-from-top-1 duration-200 space-y-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Handover Items</h4>
                                  {(plan.totalExtraQty || 0) > 0 && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300/80 shadow-2xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                      +{plan.totalExtraQty} Extra Units Loaded
                                    </span>
                                  )}
                                </div>
                                <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
                                  <table className="w-full text-xs text-left">
                                    <thead>
                                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                        <th className="px-4 py-3">Product</th>
                                        <th className="px-4 py-3">Variant</th>
                                        <th className="px-4 py-3 text-center w-20">Planned</th>
                                        <th className="px-4 py-3 text-center w-24">Extra Load</th>
                                        <th className="px-4 py-3 text-center w-24">Total Loaded</th>
                                        <th className="px-4 py-3 text-center w-16">Orders</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {Object.values(plan.totals).map((t, idx) => {
                                        const hasExtra = (t.extra_qty || 0) > 0;
                                        const plannedVal = t.planned_qty !== undefined ? t.planned_qty : t.quantity;
                                        return (
                                          <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${hasExtra ? "bg-amber-50/20" : ""}`}>
                                            <td className="px-4 py-3 font-semibold text-slate-800">
                                              <div className="flex items-center gap-1.5">
                                                <span>{t.product_name}</span>
                                                {hasExtra && (
                                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-200 text-amber-900 uppercase">
                                                    Extra
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 font-medium">{t.variant_name || "—"}</td>
                                            <td className="px-4 py-3 text-center font-bold text-slate-600">
                                              {plannedVal}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              {hasExtra ? (
                                                <span className="inline-flex px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-black text-[11px]">
                                                  +{t.extra_qty}
                                                </span>
                                              ) : (
                                                <span className="text-slate-300 font-bold">—</span>
                                              )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              <span className="inline-flex px-2.5 py-0.5 bg-emerald-600 text-white rounded-lg font-black text-[11px] shadow-2xs">
                                                ×{t.quantity}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-slate-500">{t.orderCount || (hasExtra && plannedVal === 0 ? 0 : 1)}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Customer Orders ({plan.orders.length})</h4>
                                  <button onClick={() => setShowOrderBreakdowns((prev) => ({ ...prev, [plan.run_id]: !prev[plan.run_id] }))}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-100 transition-all no-print cursor-pointer">
                                    {showBreakdown ? <><EyeOff size={10} /> Hide Orders</> : <><Eye size={10} /> View Orders</>}
                                  </button>
                                </div>
                                {showBreakdown ? (() => {
                                  const pageSize = 6;
                                  const currentPage = ordersPage[plan.run_id] ?? 1;
                                  const totalPages = Math.ceil(plan.orders.length / pageSize);
                                  const paginatedOrders = plan.orders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                                  return (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in duration-200">
                                        {paginatedOrders.map((order, idx) => {
                                          const overallIdx = (currentPage - 1) * pageSize + idx;
                                          return (
                                            <div key={order.order_id} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-emerald-200 transition-all duration-200">
                                              <div className="flex items-start gap-3 p-3.5 pb-3 border-b border-slate-50">
                                                <div className="shrink-0 h-8 w-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black text-xs">{overallIdx + 1}</div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                                    <span className="font-mono text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded leading-none">#{String(order.order_id).slice(-8)}</span>
                                                    <SlotBadge slot={order.delivery_slot} />
                                                  </div>
                                                  <p className="font-black text-xs text-slate-900 leading-tight truncate">{order.customer_name}</p>
                                                  <p className="text-[10px] text-slate-400 leading-tight line-clamp-2 mt-0.5">{order.address_line}</p>
                                                </div>
                                              </div>
                                              <div className="p-3 space-y-1.5">
                                                {order.items.map((item: any, i: number) => (
                                                  <div key={i} className="flex items-center justify-between gap-2">
                                                    <span className="text-[11px] text-slate-600 font-medium leading-snug flex-1 min-w-0 truncate">
                                                      {item.product_name}{item.variant_name && item.variant_name !== item.product_name ? <span className="text-slate-400"> · {item.variant_name}</span> : null}
                                                    </span>
                                                    <span className="shrink-0 inline-flex px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg font-black text-[10px]">×{item.quantity}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {totalPages > 1 && (
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 bg-white/50 px-2 py-1.5 rounded-xl no-print">
                                          <button disabled={currentPage === 1} onClick={() => setOrdersPage(prev => ({ ...prev, [plan.run_id]: Math.max(1, currentPage - 1) }))}
                                            className="px-2.5 py-1 text-[10px] font-black text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Previous</button>
                                          <span className="text-[10px] font-bold text-slate-500">Page {currentPage} of {totalPages}</span>
                                          <button disabled={currentPage === totalPages} onClick={() => setOrdersPage(prev => ({ ...prev, [plan.run_id]: Math.min(totalPages, currentPage + 1) }))}
                                            className="px-2.5 py-1 text-[10px] font-black text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Next</button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })() : null}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <>
                        {/* Pending */}
                        {pendingPlans.length > 0 && (
                          <div className="rounded-2xl border border-amber-200/80 overflow-hidden shadow-xs">
                            <button onClick={() => setPendingAccordionOpen((o) => !o)}
                              className="w-full flex items-center justify-between px-5 py-4 bg-amber-50 hover:bg-amber-100/60 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center">
                                  <Clock size={15} className="text-amber-600" />
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-black text-amber-900">Pending Handover</p>
                                  <p className="text-[11px] text-amber-600 font-medium">{pendingPlans.length} run{pendingPlans.length !== 1 ? "s" : ""} awaiting approval</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center h-6 px-3 bg-transparent text-amber-700 rounded-full text-[10px] font-black tracking-wider border border-amber-300 transition-all select-none">
                                  {pendingPlans.length} PENDING
                                </span>
                                {pendingAccordionOpen ? <ChevronUp size={16} className="text-amber-600" /> : <ChevronDown size={16} className="text-amber-600" />}
                              </div>
                            </button>
                            {pendingAccordionOpen && (
                              <div className="p-4 bg-amber-50/30 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                {pendingPlans.map(renderCard)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Dispatched by shift */}
                        <div className="space-y-3">
                          <h3 className="text-xs font-black uppercase tracking-wider text-emerald-800/80 px-1 mt-2">Dispatched Runs</h3>
                          {dispatchedPlans.length === 0 ? (
                            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-emerald-200 shadow-xs">
                              <Truck size={28} className="mx-auto text-slate-300 mb-2" />
                              <p className="text-xs text-slate-400 font-semibold">No dispatched runs yet.</p>
                            </div>
                          ) : (() => {
                            const shiftsMap: Record<string, DeliveryPartnerPlan[]> = {};
                            dispatchedPlans.forEach((plan) => {
                              const shiftName = plan.delivery_slot ? plan.delivery_slot.charAt(0).toUpperCase() + plan.delivery_slot.slice(1).toLowerCase() : "Other";
                              if (!shiftsMap[shiftName]) shiftsMap[shiftName] = [];
                              shiftsMap[shiftName].push(plan);
                            });

                            return Object.entries(shiftsMap).map(([shiftName, shiftPlans]) => {
                              const riderGroups: Record<string, DeliveryPartnerPlan[]> = {};
                              shiftPlans.forEach((plan) => {
                                const riderKey = plan.delivery_partner_name || "Unknown Rider";
                                if (!riderGroups[riderKey]) riderGroups[riderKey] = [];
                                riderGroups[riderKey].push(plan);
                              });

                              const consolidatedRiderPlans: DeliveryPartnerPlan[] = Object.entries(riderGroups).map(([, plansList]) => {
                                const first = plansList[0];
                                const runNumbers = Array.from(new Set(plansList.map(p => p.run_number).filter(Boolean)));
                                const runIds = Array.from(new Set(plansList.map(p => p.run_id).filter(Boolean)));
                                const totalOrders = plansList.reduce((sum, p) => sum + (p.totalOrders || 0), 0);
                                const totalCustomers = plansList.reduce((sum, p) => sum + (p.totalCustomers || 0), 0);
                                const totalProducts = plansList.reduce((sum, p) => sum + (p.totalProducts || 0), 0);
                                const totalQuantity = plansList.reduce((sum, p) => sum + (p.totalQuantity || 0), 0);
                                const mergedTotals: Record<string, any> = {};
                                plansList.forEach((p) => {
                                  if (p.totals) {
                                    Object.entries(p.totals).forEach(([variantId, item]: [string, any]) => {
                                      if (!mergedTotals[variantId]) { mergedTotals[variantId] = { ...item }; }
                                      else { mergedTotals[variantId].quantity += item.quantity; mergedTotals[variantId].orderCount = (mergedTotals[variantId].orderCount || 0) + (item.orderCount || 0); }
                                    });
                                  }
                                });
                                const mergedOrders: any[] = [];
                                plansList.forEach((p) => { if (p.orders) mergedOrders.push(...p.orders); });
                                return { ...first, run_number: runNumbers.join(" / "), run_id: runIds.join("_"), totalOrders, totalCustomers, totalProducts, totalQuantity, totals: mergedTotals, orders: mergedOrders };
                              });

                              const totalRuns = shiftPlans.length;
                              const totalOrders = shiftPlans.reduce((sum, p) => sum + (p.totalOrders || 0), 0);
                              const totalCustomers = shiftPlans.reduce((sum, p) => sum + (p.totalCustomers || 0), 0);
                              const totalProducts = shiftPlans.reduce((sum, p) => sum + (p.totalProducts || 0), 0);
                              const totalQuantity = shiftPlans.reduce((sum, p) => sum + (p.totalQuantity || 0), 0);
                              const stateKey = `shift-${shiftName.toLowerCase()}`;
                              const isShiftOpen = !!expandedCards[stateKey];

                              return (
                                <div key={shiftName} className="rounded-2xl border border-emerald-200/80 overflow-hidden shadow-xs">
                                  <button onClick={() => setExpandedCards((prev) => ({ ...prev, [stateKey]: !prev[stateKey] }))}
                                    className="w-full flex flex-col md:flex-row md:items-center justify-between px-5 py-4 bg-emerald-50 hover:bg-emerald-100/60 transition-colors gap-3">
                                    <div className="flex items-center gap-3">
                                      <div className="h-8 w-8 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
                                        <CheckCircle2 size={15} className="text-emerald-600" />
                                      </div>
                                      <div className="text-left">
                                        <p className="text-sm font-black text-emerald-900">{shiftName} Shift</p>
                                        <p className="text-[11px] text-emerald-600 font-medium">{totalRuns} run{totalRuns !== 1 ? "s" : ""} dispatched</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="flex items-stretch divide-x divide-emerald-200 bg-emerald-100/40 border border-emerald-200/60 rounded-xl overflow-hidden text-[10px]">
                                        {[
                                          { label: "Orders", value: totalOrders },
                                          { label: "Customers", value: totalCustomers },
                                          { label: "Products", value: totalProducts },
                                          { label: "Qty", value: totalQuantity },
                                        ].map(({ label, value }) => (
                                          <div key={label} className="flex flex-col items-center justify-center px-2.5 py-1">
                                            <span className="text-[8px] font-black uppercase tracking-wider text-emerald-700/70">{label}</span>
                                            <span className="font-black text-emerald-800 mt-0.5">{value}</span>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center justify-center h-6 px-3 bg-transparent text-emerald-700 rounded-full text-[10px] font-black tracking-wider border border-emerald-300 transition-all select-none">
                                          {totalRuns} DISPATCHED
                                        </span>
                                        {isShiftOpen ? <ChevronUp size={16} className="text-emerald-600" /> : <ChevronDown size={16} className="text-emerald-600" />}
                                      </div>
                                    </div>
                                  </button>
                                  {isShiftOpen && (
                                    <div className="p-4 bg-emerald-50/20 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                      {consolidatedRiderPlans.map(renderCard)}
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approve / Verify Handover Modal */}
      {isApproveModalOpen && activePlanForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 no-print animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/60 to-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl"><CheckCircle2 size={18} /></div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Verify Dispatch Handover</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                      <Truck size={9} /> {activePlanForModal.delivery_partner_name}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono font-bold rounded-full">
                      {activePlanForModal.run_id}
                    </span>
                    <SlotBadge slot={activePlanForModal.delivery_slot} />
                  </div>
                </div>
              </div>
              <button onClick={() => { setIsApproveModalOpen(false); setActivePlanForModal(null); }}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Handover Quantities</h4>
                  <span className="text-[10px] text-slate-400 font-medium">{modalItems.length} items</span>
                </div>
                {modalItems.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Package size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-400">No items. Add products below.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs bg-white">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">Variant</th>
                          <th className="px-4 py-3 text-center w-24">Required</th>
                          <th className="px-4 py-3 text-center w-36">Loaded Qty</th>
                          <th className="px-4 py-3 text-center w-28">Extra Stock</th>
                          <th className="px-4 py-3 w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {modalItems.map((item, idx) => {
                          const planned = Number(item.planned_qty || 0);
                          const loaded = Number(item.loaded_qty || 0);
                          const extra = loaded - planned;
                          const hasExtra = extra > 0;
                          const isShort = extra < 0;

                          return (
                            <tr key={item.product_variant_id || idx} className={`hover:bg-slate-50/40 transition-colors ${hasExtra ? "bg-amber-50/30" : isShort ? "bg-rose-50/30" : ""}`}>
                              <td className="px-4 py-3.5 font-semibold text-slate-800">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{item.product_name}</span>
                                  {planned === 0 && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-200 uppercase">
                                      Extra Added
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-slate-500 font-medium">{item.variant_name || "—"}</td>
                              <td className="px-4 py-3.5 text-center font-black text-slate-600">
                                {planned > 0 ? (
                                  <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md font-bold">
                                    {planned}
                                  </span>
                                ) : (
                                  <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-400 font-semibold rounded-md text-[10px]">
                                    0 (None)
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                                  <button type="button" onClick={() => setModalItems((prev) => prev.map((mi) => mi.product_variant_id === item.product_variant_id ? { ...mi, loaded_qty: Math.max(0, (mi.loaded_qty || 0) - 1) } : mi))}
                                    className="w-8 h-8 flex items-center justify-center text-slate-600 font-black hover:bg-slate-100 border-r border-slate-200 text-sm active:scale-90 transition-all">−</button>
                                  <input type="number" min="0" value={item.loaded_qty}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                      setModalItems((prev) => prev.map((mi) => mi.product_variant_id === item.product_variant_id ? { ...mi, loaded_qty: val } : mi));
                                    }}
                                    className="w-12 h-8 text-center font-black text-slate-800 bg-white outline-none text-sm border-none" />
                                  <button type="button" onClick={() => setModalItems((prev) => prev.map((mi) => mi.product_variant_id === item.product_variant_id ? { ...mi, loaded_qty: (mi.loaded_qty || 0) + 1 } : mi))}
                                    className="w-8 h-8 flex items-center justify-center text-slate-600 font-black hover:bg-slate-100 border-l border-slate-200 text-sm active:scale-90 transition-all">+</button>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                {hasExtra ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-black text-[11px] shadow-2xs">
                                    +{extra} Extra
                                  </span>
                                ) : isShort ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-200 rounded-xl font-black text-[11px]">
                                    {extra} Short
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 text-slate-400 font-bold text-[11px]">
                                    Exact
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <button onClick={() => setModalItems((prev) => prev.filter((mi) => mi.product_variant_id !== item.product_variant_id))}
                                  className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-xl transition-all hover:scale-110 active:scale-90">
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-slate-50/60 border border-slate-200/60 rounded-2xl p-4 space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Plus size={12} /> Add Extra Stock to Handover
                </h4>
                <div className="flex flex-col md:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Search product or variant to add…" value={searchQueryVariant}
                      onChange={(e) => { setSearchQueryVariant(e.target.value); setIsSearchingVariantDropdownOpen(true); }}
                      onFocus={() => setIsSearchingVariantDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsSearchingVariantDropdownOpen(false), 200)}
                      className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-xs outline-none bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 font-medium transition-all" />
                    {searchQueryVariant && (
                      <button type="button" onClick={() => { setSearchQueryVariant(""); setSelectedVariantToAdd(""); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X size={13} />
                      </button>
                    )}
                    {isSearchingVariantDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-50">
                        {loadingVariants && (
                          <div className="px-4 py-3 text-xs text-slate-400 text-center">Loading stock…</div>
                        )}
                        {!loadingVariants && matchingVariants.map((v) => {
                          const size = v.unit_value && v.unit_type ? ` (${v.unit_value} ${v.unit_type})` : "";
                          const vn = v.variant_name && v.variant_name !== v.product_name ? ` – ${v.variant_name}` : "";
                          const label = `${v.product_name}${vn}${size}`;
                          const inStock = Number(v.available_quantity ?? 0);
                          return (
                            <div key={v.product_variant_id} onMouseDown={() => { setSelectedVariantToAdd(v.product_variant_id); setSearchQueryVariant(label); setQtyToAdd(1); setIsSearchingVariantDropdownOpen(false); }}
                              className="px-4 py-2.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer font-medium transition-colors flex items-center justify-between gap-3">
                              <span className="truncate">{label}</span>
                              <span className="shrink-0 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-0.5">
                                {inStock} in stock
                              </span>
                            </div>
                          );
                        })}
                        {!loadingVariants && matchingVariants.length === 0 && (
                          <div className="px-4 py-3 text-xs text-slate-400 text-center">
                            {availableVariants.length === 0 ? "No stock available at this warehouse" : "No results"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <input type="number" min="1" max={selectedVariantStock || undefined} value={qtyToAdd}
                    onChange={(e) => {
                      const wanted = Math.max(1, parseInt(e.target.value) || 1);
                      setQtyToAdd(selectedVariantStock ? Math.min(wanted, selectedVariantStock) : wanted);
                    }}
                    className="w-24 shrink-0 px-3 py-2.5 border border-slate-200 rounded-xl text-xs outline-none bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 font-black text-center transition-all"
                    placeholder="Qty" />
                  <button type="button" onClick={() => {
                    if (!selectedVariantToAdd) { showErrorToast("Select a product first."); return; }
                    const v = availableVariants.find((x) => x.product_variant_id === selectedVariantToAdd);
                    if (!v) return;
                    const onHand = Number(v.available_quantity ?? 0);
                    const alreadyAdded = modalItems.find((mi) => mi.product_variant_id === selectedVariantToAdd)?.loaded_qty ?? 0;
                    if (onHand && alreadyAdded + qtyToAdd > onHand) {
                      showErrorToast(`Only ${onHand} in stock at this warehouse${alreadyAdded ? ` (${alreadyAdded} already on this handover)` : ""}.`);
                      return;
                    }
                    const exists = modalItems.find((mi) => mi.product_variant_id === selectedVariantToAdd);
                    if (exists) {
                      setModalItems((prev) => prev.map((mi) => mi.product_variant_id === selectedVariantToAdd ? { ...mi, loaded_qty: mi.loaded_qty + qtyToAdd } : mi));
                    } else {
                      const size = v.unit_value && v.unit_type ? ` (${v.unit_value} ${v.unit_type})` : "";
                      const vn = v.variant_name && v.variant_name !== v.product_name ? ` – ${v.variant_name}` : "";
                      setModalItems((prev) => [...prev, {
                        product_variant_id: v.product_variant_id, product_name: v.product_name,
                        variant_name: v.unit_value && v.unit_type ? `${v.unit_value} ${v.unit_type}` : (v.variant_name || ""),
                        unit_value: v.unit_value ? Number(v.unit_value) : null, unit_type: v.unit_type || "pcs",
                        planned_qty: 0, loaded_qty: qtyToAdd, displayLabel: `${v.product_name}${vn}${size} ×${qtyToAdd}`, orderCount: 0,
                      }]);
                    }
                    setSelectedVariantToAdd(""); setSearchQueryVariant(""); setQtyToAdd(1);
                    showSuccessToast("Added to handover list!");
                  }}
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-[#2E7D32]/20 active:scale-95">
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-xs text-slate-500 font-medium">
                  <strong>{modalItems.reduce((s, i) => s + Number(i.planned_qty || 0), 0)}</strong> required · <strong className="text-emerald-700">{modalItems.reduce((s, i) => s + Number(i.loaded_qty || 0), 0)}</strong> total to issue
                </p>
                {(() => {
                  const totalExtra = modalItems.reduce((s, i) => s + Math.max(0, Number(i.loaded_qty || 0) - Number(i.planned_qty || 0)), 0);
                  return totalExtra > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[11px] font-black shadow-2xs">
                      <Sparkles size={11} className="text-amber-700" /> +{totalExtra} Extra Loaded
                    </span>
                  ) : null;
                })()}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={() => { setIsApproveModalOpen(false); setActivePlanForModal(null); }}
                  className="px-4 py-2.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95">
                  Cancel
                </button>
                <button onClick={handleConfirmModalApproval}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#2E7D32]/20 hover:scale-[1.02] active:scale-[0.98]">
                  <CheckCircle2 size={13} /> Approve &amp; Issue Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main Page — 2 top-level tabs (TODAY / HISTORY)
// ─────────────────────────────────────────────────────────

type TopTab = "today" | "history";
type TodaySubTab = "requirements" | "handover" | "returns";
type HistorySubTab = "items" | "partners";

export default function DispatchManagementPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [topTab, setTopTab] = useState<TopTab>("today");
  const [todaySubTab, setTodaySubTab] = useState<TodaySubTab>("requirements");
  const [historySubTab, setHistorySubTab] = useState<HistorySubTab>("items");

  useEffect(() => {
    api.get<any>("/admin/warehouses/active/list")
      .then((res) => { if (res.data?.data) setWarehouses(res.data.data); })
      .catch(() => {});
  }, []);

  const TOP_TABS: { key: TopTab; label: string; icon: any }[] = [
    { key: "today", label: "Today", icon: Zap },
    { key: "history", label: "History", icon: History },
  ];

  const TODAY_TABS: { key: TodaySubTab; label: string; icon: any }[] = [
    { key: "requirements", label: "Dispatch Requirements", icon: ClipboardList },
    { key: "handover", label: "Handover", icon: Truck },
    { key: "returns", label: "Returns", icon: RotateCcw },
  ];

  const HISTORY_TABS: { key: HistorySubTab; label: string; icon: any }[] = [
    { key: "items", label: "Dispatched Items", icon: Package },
    { key: "partners", label: "Partner Dispatches", icon: Users },
  ];

  return (
    <div className="space-y-5 p-2 md:p-4 font-sans min-h-screen bg-slate-50/60 pb-16">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1 hover:text-emerald-700 transition-colors">
          <Home size={14} /><span>Dashboard</span>
        </Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-400">Warehouse</span>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-emerald-800">Dispatch Management</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#E8F5E9] text-[#2E7D32] rounded-xl border border-[#C8E6C9] shadow-sm">
            <Boxes size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Dispatch Management <Sparkles size={16} className="text-[#2E7D32]" />
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Requirements · Handover · Returns · History</p>
          </div>
        </div>
      </div>

      {/* Top Level Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* TODAY / HISTORY tab bar */}
        <div className="flex border-b border-slate-100 bg-slate-50/60 px-2 pt-2 gap-1">
          {TOP_TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTopTab(key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-t-xl transition-all duration-200 relative ${
                topTab === key
                  ? "bg-white text-[#2E7D32] shadow-sm border border-b-white border-slate-200"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
              }`}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* TODAY sub-tabs */}
        {topTab === "today" && (
          <div>
            <div className="flex border-b border-slate-100 px-4">
              {TODAY_TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setTodaySubTab(key)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold transition-all duration-200 relative border-b-2 ${
                    todaySubTab === key
                      ? "text-[#2E7D32] border-[#2E7D32]"
                      : "text-slate-400 border-transparent hover:text-slate-700"
                  }`}>
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
            <div className="animate-in fade-in duration-200">
              {todaySubTab === "requirements" && <DispatchRequirementsTab warehouses={warehouses} />}
              {todaySubTab === "handover" && <HandoverTab warehouses={warehouses} />}
              {todaySubTab === "returns" && <ReturnsTab warehouses={warehouses} />}
            </div>
          </div>
        )}

        {/* HISTORY sub-tabs */}
        {topTab === "history" && (
          <div>
            <div className="flex border-b border-slate-100 px-4">
              {HISTORY_TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setHistorySubTab(key)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold transition-all duration-200 relative border-b-2 ${
                    historySubTab === key
                      ? "text-[#2E7D32] border-[#2E7D32]"
                      : "text-slate-400 border-transparent hover:text-slate-700"
                  }`}>
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
            <div className="animate-in fade-in duration-200">
              {historySubTab === "items" && <DispatchedItemsHistoryTab warehouses={warehouses} />}
              {historySubTab === "partners" && <PartnerDispatchHistoryTab warehouses={warehouses} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
