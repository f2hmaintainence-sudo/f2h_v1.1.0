"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/services/api.client";
import {
  ArrowRightLeft,
  ArrowRight,
  Truck,
  Users,
  MapPin,
  GripVertical,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  Package,
  Calendar,
  Clock,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

interface AddressOrder {
  order_id: string;
  customer_id?: string;
  customer_name?: string;
  address_id?: string;
  address_line?: string;
  delivery_slot?: string;
  status?: string;
  run_sequence?: number;
  created_at?: string;
}

interface AddressStop {
  run_address_id?: string | number;
  sequence_no: number;
  address_id: string;
  customer_id: string;
  customer_name: string;
  address_line: string;
  delivery_status: string;
  orders: AddressOrder[];
}

interface DeliveryRunDetailed {
  id: string;
  run_id: string;
  run_number: string;
  run_date: string;
  delivery_slot: string;
  status: string;
  branch_id: string;
  branch_name: string;
  delivery_partner_id: string;
  partner_name: string;
  partner_phone: string;
  partner_active: boolean;
  total_addresses: number;
  completed_addresses: number;
  failed_addresses: number;
  created_at: string;
  orders: AddressOrder[];
  address_stops?: AddressStop[];
}

interface DeliveryPartnerDragBoardProps {
  runsList: DeliveryRunDetailed[];
  selectedDate: string;
  selectedBranch: string;
  selectedSlot: string;
  branches: Array<{ branch_id: string; branch_name: string }>;
  onRefresh: () => Promise<void> | void;
}

export default function DeliveryPartnerDragBoard({
  runsList,
  selectedDate,
  selectedBranch,
  selectedSlot,
  branches,
  onRefresh,
}: DeliveryPartnerDragBoardProps) {
  const [partnerAId, setPartnerAId] = useState<string>("");
  const [partnerBId, setPartnerBId] = useState<string>("");
  const [searchA, setSearchA] = useState<string>("");
  const [searchB, setSearchB] = useState<string>("");
  const [draggedStop, setDraggedStop] = useState<{
    stop: AddressStop;
    sourcePartnerId: string;
    sourceRunId: string;
  } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<"A" | "B" | null>(null);
  const [dragOverStopId, setDragOverStopId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Available runs for selection filtered by branch and slot
  const availableRuns = useMemo(() => {
    return runsList.filter((r) => {
      if (selectedBranch && r.branch_id !== selectedBranch) return false;
      if (selectedSlot && r.delivery_slot !== selectedSlot) return false;
      return true;
    });
  }, [runsList, selectedBranch, selectedSlot]);

  // Set default Partner A and Partner B if available and not set
  useEffect(() => {
    if (availableRuns.length > 0) {
      if (!partnerAId || !availableRuns.some((r) => r.delivery_partner_id === partnerAId)) {
        setPartnerAId(availableRuns[0].delivery_partner_id);
      }
      if (availableRuns.length > 1) {
        if (!partnerBId || partnerBId === partnerAId || !availableRuns.some((r) => r.delivery_partner_id === partnerBId)) {
          const second = availableRuns.find((r) => r.delivery_partner_id !== availableRuns[0].delivery_partner_id);
          if (second) setPartnerBId(second.delivery_partner_id);
        }
      }
    }
  }, [availableRuns, partnerAId, partnerBId]);

  const runA = useMemo(() => {
    return runsList.find((r) => r.delivery_partner_id === partnerAId) || null;
  }, [runsList, partnerAId]);

  const runB = useMemo(() => {
    return runsList.find((r) => r.delivery_partner_id === partnerBId) || null;
  }, [runsList, partnerBId]);

  const getStopsForRun = (run: DeliveryRunDetailed | null): AddressStop[] => {
    if (!run) return [];
    if (run.address_stops && run.address_stops.length > 0) {
      return run.address_stops;
    }
    // Fallback: group orders by address_id
    const stopMap = new Map<string, AddressStop>();
    (run.orders || []).forEach((ord, idx) => {
      const key = ord.address_id || `addr-${idx}`;
      if (!stopMap.has(key)) {
        stopMap.set(key, {
          sequence_no: ord.run_sequence || stopMap.size + 1,
          address_id: ord.address_id || key,
          customer_id: ord.customer_id || "",
          customer_name: ord.customer_name || "Customer",
          address_line: ord.address_line || "—",
          delivery_status: ord.status === "delivered" ? "delivered" : ord.status === "failed" ? "failed" : "pending",
          orders: [],
        });
      }
      stopMap.get(key)!.orders.push(ord);
    });
    return Array.from(stopMap.values());
  };

  const stopsA = useMemo(() => {
    const list = getStopsForRun(runA);
    if (!searchA.trim()) return list;
    const q = searchA.toLowerCase();
    return list.filter(
      (s) =>
        s.customer_name.toLowerCase().includes(q) ||
        s.address_line.toLowerCase().includes(q) ||
        s.orders.some((o) => o.order_id.toLowerCase().includes(q))
    );
  }, [runA, searchA]);

  const stopsB = useMemo(() => {
    const list = getStopsForRun(runB);
    if (!searchB.trim()) return list;
    const q = searchB.toLowerCase();
    return list.filter(
      (s) =>
        s.customer_name.toLowerCase().includes(q) ||
        s.address_line.toLowerCase().includes(q) ||
        s.orders.some((o) => o.order_id.toLowerCase().includes(q))
    );
  }, [runB, searchB]);

  // Handle Drag Start
  const handleDragStart = (
    e: React.DragEvent,
    stop: AddressStop,
    sourcePartnerId: string,
    sourceRunId: string
  ) => {
    const isPending = (stop.delivery_status || "pending") === "pending";
    if (!isPending) {
      e.preventDefault();
      showErrorToast("Only pending address stops can be moved or swapped.");
      return;
    }

    setDraggedStop({ stop, sourcePartnerId, sourceRunId });
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        addressId: stop.address_id,
        firstOrderId: stop.orders[0]?.order_id,
        sourcePartnerId,
        sourceRunId,
      })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedStop(null);
    setDragOverColumn(null);
    setDragOverStopId(null);
  };

  // Move Address Stop to Target Run
  const executeMove = async (targetPartnerId: string, targetRunId?: string) => {
    if (!draggedStop) return;
    const { stop, sourcePartnerId } = draggedStop;

    if (sourcePartnerId === targetPartnerId) {
      handleDragEnd();
      return;
    }

    const firstOrderId = stop.orders[0]?.order_id;
    if (!firstOrderId) {
      showErrorToast("Could not find order ID for this address stop");
      handleDragEnd();
      return;
    }

    setProcessing(true);
    setActionNotice(`Moving address stop for ${stop.customer_name}...`);

    try {
      const res = await api.post<any>("/admin/delivery/runs/orders/move", {
        order_id: firstOrderId,
        target_partner_id: targetPartnerId,
        target_run_id: targetRunId || undefined,
        reason: "Reassigned via Drag & Drop Partner Board",
      });

      if (res.data?.status) {
        showSuccessToast(res.data?.message || `Address stop moved to partner run!`);
        await onRefresh();
      } else {
        showErrorToast(res.data?.message || "Failed to move address stop");
      }
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || err?.message || "Failed to move address stop");
    } finally {
      setProcessing(false);
      setActionNotice(null);
      handleDragEnd();
    }
  };

  // Swap Address Stops Between Two Partners
  const executeSwap = async (targetStop: AddressStop) => {
    if (!draggedStop) return;
    const { stop: sourceStop, sourcePartnerId } = draggedStop;

    if (sourceStop.address_id === targetStop.address_id) {
      handleDragEnd();
      return;
    }

    const sourceStatus = sourceStop.delivery_status || "pending";
    const targetStatus = targetStop.delivery_status || "pending";

    if (sourceStatus !== "pending" || targetStatus !== "pending") {
      showErrorToast("Both address stops must be in 'pending' status to be swapped.");
      handleDragEnd();
      return;
    }

    const orderAId = sourceStop.orders[0]?.order_id;
    const orderBId = targetStop.orders[0]?.order_id;

    if (!orderAId || !orderBId) {
      showErrorToast("Could not resolve orders for both address stops");
      handleDragEnd();
      return;
    }

    setProcessing(true);
    setActionNotice(`Swapping ${sourceStop.customer_name} with ${targetStop.customer_name}...`);

    try {
      const res = await api.post<any>("/admin/delivery/runs/orders/swap", {
        order_a_id: orderAId,
        order_b_id: orderBId,
        reason: "Swapped via Drag & Drop Partner Board",
      });

      if (res.data?.status) {
        showSuccessToast(res.data?.message || "Address stops swapped successfully!");
        await onRefresh();
      } else {
        showErrorToast(res.data?.message || "Failed to swap address stops");
      }
    } catch (err: any) {
      showErrorToast(err?.response?.data?.message || err?.message || "Failed to swap address stops");
    } finally {
      setProcessing(false);
      setActionNotice(null);
      handleDragEnd();
    }
  };

  const handleDropOnColumn = (targetColumn: "A" | "B") => {
    if (!draggedStop) return;
    if (targetColumn === "A" && runA) {
      if (draggedStop.sourcePartnerId === runA.delivery_partner_id) return;
      executeMove(runA.delivery_partner_id, runA.run_id);
    } else if (targetColumn === "B" && runB) {
      if (draggedStop.sourcePartnerId === runB.delivery_partner_id) return;
      executeMove(runB.delivery_partner_id, runB.run_id);
    }
  };

  const handleDropOnStopCard = (e: React.DragEvent, targetStop: AddressStop) => {
    e.stopPropagation();
    if (!draggedStop) return;
    executeSwap(targetStop);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Guide */}
      <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-white p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/30">
            <ArrowRightLeft size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span>Interactive Two-Partner Address Swap & Move Board</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800">
                Live Drag & Drop
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
              Select two delivery partners below to compare their routes. Drag any <strong className="text-amber-700 font-bold">pending</strong> address card across to move it to the other partner, or drop directly onto another card to swap stops atomically.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={() => onRefresh()}
            disabled={processing}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <RefreshCw size={13} className={processing ? "animate-spin text-indigo-600" : "text-slate-500"} />
            <span>Refresh Board</span>
          </button>
        </div>
      </div>

      {/* Loading & Action Notification */}
      {processing && (
        <div className="p-3.5 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 animate-pulse">
          <Loader2 size={16} className="animate-spin" />
          <span>{actionNotice || "Processing delivery run update..."}</span>
        </div>
      )}

      {/* Main Drag-and-Drop Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT COLUMN: PARTNER A ── */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (draggedStop && draggedStop.sourcePartnerId !== partnerAId) {
              setDragOverColumn("A");
            }
          }}
          onDragLeave={() => setDragOverColumn(null)}
          onDrop={() => handleDropOnColumn("A")}
          className={`rounded-2xl border transition-all flex flex-col bg-white shadow-sm overflow-hidden ${
            dragOverColumn === "A"
              ? "border-indigo-600 ring-4 ring-indigo-500/20 bg-indigo-50/30"
              : "border-slate-200/80"
          }`}
        >
          {/* Column Header */}
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <Truck size={13} /> Partner A (Source / Target)
              </span>
              {runA && (
                <span className="font-mono text-xs font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {runA.run_id}
                </span>
              )}
            </div>

            {/* Partner Selector Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500">Select Partner A:</label>
              <select
                value={partnerAId}
                onChange={(e) => setPartnerAId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-indigo-600 shadow-2xs"
              >
                <option value="" disabled>
                  Select a delivery partner
                </option>
                {availableRuns.map((r) => (
                  <option key={r.delivery_partner_id} value={r.delivery_partner_id} disabled={r.delivery_partner_id === partnerBId}>
                    {r.partner_name} ({r.delivery_slot} • {r.total_addresses || r.orders?.length || 0} stops)
                  </option>
                ))}
              </select>
            </div>

            {/* Run Stats Ribbon */}
            {runA ? (
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2 text-slate-600">
                  <Users size={12} className="text-slate-400" />
                  <span className="font-bold text-slate-800">{runA.partner_name}</span>
                  {runA.partner_phone && <span className="text-slate-400 font-mono text-[11px]">• {runA.partner_phone}</span>}
                </div>
                <div className="flex items-center gap-2 font-bold">
                  <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full text-[10px]">
                    {stopsA.length} Stops
                  </span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                    {runA.completed_addresses || 0} Done
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Please select a delivery partner</p>
            )}

            {/* Search within stops */}
            {runA && stopsA.length > 3 && (
              <div className="relative pt-1">
                <Search size={13} className="absolute left-2.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchA}
                  onChange={(e) => setSearchA(e.target.value)}
                  placeholder="Filter address or customer..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>
            )}
          </div>

          {/* Column Body: Address Cards */}
          <div className="p-4 flex-1 space-y-2.5 min-h-[380px] max-h-[560px] overflow-y-auto bg-slate-50/30">
            {!runA ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                <Users size={32} className="stroke-1 text-slate-300" />
                <p className="text-xs font-semibold">Select Partner A to load assigned address stops.</p>
              </div>
            ) : stopsA.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-xl">
                <Package size={28} className="text-slate-300 stroke-1" />
                <p className="text-xs font-bold text-slate-500">No Address Stops Assigned</p>
                <p className="text-[11px] text-slate-400">
                  Drag an address stop from Partner B and drop it here to assign it to {runA.partner_name}.
                </p>
              </div>
            ) : (
              stopsA.map((stop, idx) => {
                const isPending = (stop.delivery_status || "pending") === "pending";
                const isDragOverThis = dragOverStopId === stop.address_id;
                const isBeingDragged = draggedStop?.stop.address_id === stop.address_id;

                return (
                  <div
                    key={stop.address_id || idx}
                    draggable={isPending && !processing}
                    onDragStart={(e) => handleDragStart(e, stop, runA.delivery_partner_id, runA.run_id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedStop && draggedStop.stop.address_id !== stop.address_id) {
                        setDragOverStopId(stop.address_id);
                      }
                    }}
                    onDragLeave={() => setDragOverStopId(null)}
                    onDrop={(e) => handleDropOnStopCard(e, stop)}
                    className={`p-3.5 rounded-xl border transition-all select-none ${
                      isBeingDragged
                        ? "opacity-40 border-indigo-400 bg-indigo-50/50"
                        : isDragOverThis
                        ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500/30 scale-[1.01]"
                        : isPending
                        ? "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-xs cursor-grab active:cursor-grabbing"
                        : "border-slate-200 bg-slate-50 opacity-75 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        {isPending ? (
                          <div className="text-slate-400 hover:text-indigo-600 cursor-grab">
                            <GripVertical size={16} />
                          </div>
                        ) : (
                          <div className="text-slate-400" title="Locked - Already completed or failed">
                            <Lock size={14} />
                          </div>
                        )}
                        <span className="font-mono text-xs font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                          #{stop.sequence_no ?? idx + 1}
                        </span>
                        <span className="text-xs font-black text-slate-900">{stop.customer_name}</span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          stop.delivery_status === "delivered"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : stop.delivery_status === "failed"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {stop.delivery_status || "pending"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-2 pl-6 line-clamp-2 leading-relaxed" title={stop.address_line}>
                      {stop.address_line}
                    </p>

                    <div className="mt-2.5 pl-6 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400">Orders ({stop.orders.length}):</span>
                      {stop.orders.map((ord) => (
                        <span
                          key={ord.order_id}
                          className="px-1.5 py-0.5 rounded bg-indigo-50/70 border border-indigo-100 font-mono text-[10px] font-bold text-indigo-700"
                        >
                          #{ord.order_id}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: PARTNER B ── */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (draggedStop && draggedStop.sourcePartnerId !== partnerBId) {
              setDragOverColumn("B");
            }
          }}
          onDragLeave={() => setDragOverColumn(null)}
          onDrop={() => handleDropOnColumn("B")}
          className={`rounded-2xl border transition-all flex flex-col bg-white shadow-sm overflow-hidden ${
            dragOverColumn === "B"
              ? "border-indigo-600 ring-4 ring-indigo-500/20 bg-indigo-50/30"
              : "border-slate-200/80"
          }`}
        >
          {/* Column Header */}
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <Truck size={13} /> Partner B (Target / Source)
              </span>
              {runB && (
                <span className="font-mono text-xs font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {runB.run_id}
                </span>
              )}
            </div>

            {/* Partner Selector Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500">Select Partner B:</label>
              <select
                value={partnerBId}
                onChange={(e) => setPartnerBId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-indigo-600 shadow-2xs"
              >
                <option value="" disabled>
                  Select a delivery partner
                </option>
                {availableRuns.map((r) => (
                  <option key={r.delivery_partner_id} value={r.delivery_partner_id} disabled={r.delivery_partner_id === partnerAId}>
                    {r.partner_name} ({r.delivery_slot} • {r.total_addresses || r.orders?.length || 0} stops)
                  </option>
                ))}
              </select>
            </div>

            {/* Run Stats Ribbon */}
            {runB ? (
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2 text-slate-600">
                  <Users size={12} className="text-slate-400" />
                  <span className="font-bold text-slate-800">{runB.partner_name}</span>
                  {runB.partner_phone && <span className="text-slate-400 font-mono text-[11px]">• {runB.partner_phone}</span>}
                </div>
                <div className="flex items-center gap-2 font-bold">
                  <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full text-[10px]">
                    {stopsB.length} Stops
                  </span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                    {runB.completed_addresses || 0} Done
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Please select a delivery partner</p>
            )}

            {/* Search within stops */}
            {runB && stopsB.length > 3 && (
              <div className="relative pt-1">
                <Search size={13} className="absolute left-2.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchB}
                  onChange={(e) => setSearchB(e.target.value)}
                  placeholder="Filter address or customer..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>
            )}
          </div>

          {/* Column Body: Address Cards */}
          <div className="p-4 flex-1 space-y-2.5 min-h-[380px] max-h-[560px] overflow-y-auto bg-slate-50/30">
            {!runB ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                <Users size={32} className="stroke-1 text-slate-300" />
                <p className="text-xs font-semibold">Select Partner B to load assigned address stops.</p>
              </div>
            ) : stopsB.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-xl">
                <Package size={28} className="text-slate-300 stroke-1" />
                <p className="text-xs font-bold text-slate-500">No Address Stops Assigned</p>
                <p className="text-[11px] text-slate-400">
                  Drag an address stop from Partner A and drop it here to assign it to {runB.partner_name}.
                </p>
              </div>
            ) : (
              stopsB.map((stop, idx) => {
                const isPending = (stop.delivery_status || "pending") === "pending";
                const isDragOverThis = dragOverStopId === stop.address_id;
                const isBeingDragged = draggedStop?.stop.address_id === stop.address_id;

                return (
                  <div
                    key={stop.address_id || idx}
                    draggable={isPending && !processing}
                    onDragStart={(e) => handleDragStart(e, stop, runB.delivery_partner_id, runB.run_id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedStop && draggedStop.stop.address_id !== stop.address_id) {
                        setDragOverStopId(stop.address_id);
                      }
                    }}
                    onDragLeave={() => setDragOverStopId(null)}
                    onDrop={(e) => handleDropOnStopCard(e, stop)}
                    className={`p-3.5 rounded-xl border transition-all select-none ${
                      isBeingDragged
                        ? "opacity-40 border-indigo-400 bg-indigo-50/50"
                        : isDragOverThis
                        ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500/30 scale-[1.01]"
                        : isPending
                        ? "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-xs cursor-grab active:cursor-grabbing"
                        : "border-slate-200 bg-slate-50 opacity-75 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        {isPending ? (
                          <div className="text-slate-400 hover:text-indigo-600 cursor-grab">
                            <GripVertical size={16} />
                          </div>
                        ) : (
                          <div className="text-slate-400" title="Locked - Already completed or failed">
                            <Lock size={14} />
                          </div>
                        )}
                        <span className="font-mono text-xs font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                          #{stop.sequence_no ?? idx + 1}
                        </span>
                        <span className="text-xs font-black text-slate-900">{stop.customer_name}</span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          stop.delivery_status === "delivered"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : stop.delivery_status === "failed"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {stop.delivery_status || "pending"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-2 pl-6 line-clamp-2 leading-relaxed" title={stop.address_line}>
                      {stop.address_line}
                    </p>

                    <div className="mt-2.5 pl-6 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400">Orders ({stop.orders.length}):</span>
                      {stop.orders.map((ord) => (
                        <span
                          key={ord.order_id}
                          className="px-1.5 py-0.5 rounded bg-indigo-50/70 border border-indigo-100 font-mono text-[10px] font-bold text-indigo-700"
                        >
                          #{ord.order_id}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
