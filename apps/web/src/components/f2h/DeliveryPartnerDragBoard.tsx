"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  ArrowRightLeft,
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
  Sun,
  Moon,
  ShieldCheck,
  PlusCircle,
} from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

// A stop stays reassignable until the partner has actually acted on it at the door.
// Both `pending` and `in_transit` stops are transferable/swappable mid-route.
// Terminal outcomes ('delivered', 'failed', 'cancelled') lock a stop.
const REASSIGNABLE_STOP_STATUSES = ["pending", "in_transit", "in-transit"];

const canReassign = (stop: { delivery_status?: string }) => {
  const status = (stop.delivery_status || "pending").toLowerCase();
  return REASSIGNABLE_STOP_STATUSES.includes(status);
};

export function getShiftInfo(slot?: string, runId?: string): {
  shift: "morning" | "evening" | "any";
  code: string;
  label: string;
  badgeClass: string;
} {
  const s = (slot || "").toLowerCase();
  const r = (runId || "").toUpperCase();
  if (s === "morning" || r.includes("-MOR-") || s.startsWith("mor")) {
    return {
      shift: "morning",
      code: "MOR",
      label: "Morning Shift",
      badgeClass: "bg-amber-100 text-amber-900 border border-amber-300/80",
    };
  }
  if (s === "evening" || r.includes("-EVE-") || s.startsWith("eve")) {
    return {
      shift: "evening",
      code: "EVE",
      label: "Evening Shift",
      badgeClass: "bg-teal-100 text-teal-900 border border-teal-300/80",
    };
  }
  return {
    shift: "any",
    code: "ALL",
    label: "Flexible Shift",
    badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
  };
}

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

export interface PartnerWithStops {
  delivery_partner_id: string;
  partner_name: string;
  partner_phone: string;
  branch_id: string;
  branch_name: string;
  is_active: boolean;
  is_available: boolean;
  run_db_id?: string | number;
  run_id?: string;
  run_number?: string;
  run_date?: string;
  delivery_slot?: string;
  run_status?: string;
  total_addresses: number;
  completed_addresses: number;
  failed_addresses: number;
  address_stops?: AddressStop[];
}

interface DeliveryPartnerDragBoardProps {
  selectedDate: string;
  selectedBranch: string;
  selectedSlot: string;
  branches: Array<{ branch_id: string; branch_name: string }>;
  onRefreshParent?: () => Promise<void> | void;
}

export default function DeliveryPartnerDragBoard({
  selectedDate,
  selectedBranch,
  selectedSlot,
  branches,
  onRefreshParent,
}: DeliveryPartnerDragBoardProps) {
  const [loading, setLoading] = useState(true);
  const [allPartners, setAllPartners] = useState<PartnerWithStops[]>([]);
  const [partnerAKey, setPartnerAKey] = useState<string>("");
  const [partnerBKey, setPartnerBKey] = useState<string>("");
  const [searchA, setSearchA] = useState<string>("");
  const [searchB, setSearchB] = useState<string>("");
  const [draggedStop, setDraggedStop] = useState<{
    stop: AddressStop;
    sourcePartner: PartnerWithStops;
  } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<"A" | "B" | null>(null);
  const [dragOverStopId, setDragOverStopId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Helper to build a unique key for every partner run item
  const getRunKey = (p: PartnerWithStops) =>
    `${p.delivery_partner_id}::${p.run_id || "no_run"}`;

  // Fetch all partners with their runs & stops
  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { date: selectedDate };
      if (selectedBranch) params.branch_id = selectedBranch;
      if (selectedSlot) params.slot = selectedSlot;

      const res = await api.get<any>("/admin/delivery/runs/partners-with-stops", { params });
      if (res.data?.status && Array.isArray(res.data.data)) {
        // Strict deduplication by runKey
        const seen = new Set<string>();
        const uniquePartners: PartnerWithStops[] = [];
        for (const item of res.data.data) {
          const key = `${item.delivery_partner_id}::${item.run_id || "no_run"}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniquePartners.push(item);
          }
        }
        setAllPartners(uniquePartners);
      }
    } catch (err) {
      console.error("fetchPartners error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedBranch, selectedSlot]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  // Determine Partner A data
  const partnerA = useMemo(() => {
    return allPartners.find((p) => getRunKey(p) === partnerAKey) || null;
  }, [allPartners, partnerAKey]);

  // Determine Partner B data
  const partnerB = useMemo(() => {
    return allPartners.find((p) => getRunKey(p) === partnerBKey) || null;
  }, [allPartners, partnerBKey]);

  // Get active shift of partner
  const shiftA = useMemo(() => {
    if (!partnerA) return "any";
    return getShiftInfo(partnerA.delivery_slot, partnerA.run_id).shift;
  }, [partnerA]);

  const shiftB = useMemo(() => {
    if (!partnerB) return "any";
    return getShiftInfo(partnerB.delivery_slot, partnerB.run_id).shift;
  }, [partnerB]);

  // Eligible partners for A:
  // - Filter to same branch if Partner B is chosen
  // - Match shift (morning vs evening) if Partner B has a run with a specific shift
  // - Cannot be the exact same runKey as Partner B
  const eligiblePartnersForA = useMemo(() => {
    return allPartners.filter((p) => {
      if (partnerBKey && getRunKey(p) === partnerBKey) return false;
      if (partnerB && partnerB.branch_id && p.branch_id && p.branch_id !== partnerB.branch_id) {
        return false;
      }
      if (partnerB?.run_id && shiftB !== "any") {
        const pShift = getShiftInfo(p.delivery_slot, p.run_id).shift;
        // Allow same shift OR partners who don't have a run yet
        if (p.run_id && pShift !== shiftB) return false;
      }
      return true;
    });
  }, [allPartners, partnerB, partnerBKey, shiftB]);

  // Eligible partners for B:
  // - Filter to same branch if Partner A is chosen
  // - Match shift (morning vs evening) if Partner A has a run with a specific shift
  // - Cannot be the exact same runKey as Partner A
  const eligiblePartnersForB = useMemo(() => {
    return allPartners.filter((p) => {
      if (partnerAKey && getRunKey(p) === partnerAKey) return false;
      if (partnerA && partnerA.branch_id && p.branch_id && p.branch_id !== partnerA.branch_id) {
        return false;
      }
      if (partnerA?.run_id && shiftA !== "any") {
        const pShift = getShiftInfo(p.delivery_slot, p.run_id).shift;
        // Allow same shift OR partners who don't have a run yet
        if (p.run_id && pShift !== shiftA) return false;
      }
      return true;
    });
  }, [allPartners, partnerA, partnerAKey, shiftA]);

  // Auto-select initial defaults only once when data first arrives and neither is set
  useEffect(() => {
    if (allPartners.length > 0 && !partnerAKey && !partnerBKey) {
      // Pick first partner with an active run (or first partner)
      const withRun = allPartners.find((p) => p.run_id) || allPartners[0];
      const keyA = getRunKey(withRun);
      setPartnerAKey(keyA);

      const withRunShift = getShiftInfo(withRun.delivery_slot, withRun.run_id).shift;

      // Find another partner in the same branch matching shift
      const sameBranch = allPartners.filter(
        (p) =>
          getRunKey(p) !== keyA &&
          (!withRun.branch_id || p.branch_id === withRun.branch_id) &&
          (!p.run_id || withRunShift === "any" || getShiftInfo(p.delivery_slot, p.run_id).shift === withRunShift)
      );
      if (sameBranch.length > 0) {
        const bWithRun = sameBranch.find((p) => p.run_id) || sameBranch[0];
        setPartnerBKey(getRunKey(bWithRun));
      }
    }
  }, [allPartners, partnerAKey, partnerBKey]);

  // Handler for Partner A Selection
  const handleSelectPartnerA = (newKey: string) => {
    setPartnerAKey(newKey);
    if (!newKey) return;

    const selected = allPartners.find((p) => getRunKey(p) === newKey);
    if (!selected) return;

    const selShift = getShiftInfo(selected.delivery_slot, selected.run_id).shift;

    // Check if Partner B is now invalid (different branch or cross-shift mismatch)
    if (partnerB) {
      const isSameKey = getRunKey(partnerB) === newKey;
      const isBranchMismatch =
        partnerB.branch_id && selected.branch_id && partnerB.branch_id !== selected.branch_id;
      const isShiftMismatch =
        selected.run_id &&
        partnerB.run_id &&
        selShift !== "any" &&
        shiftB !== "any" &&
        selShift !== shiftB;

      if (isSameKey || isBranchMismatch || isShiftMismatch) {
        // Find a matching alternative for Partner B in same branch and shift
        const candidate = allPartners.find(
          (p) =>
            getRunKey(p) !== newKey &&
            (!selected.branch_id || p.branch_id === selected.branch_id) &&
            (!p.run_id || selShift === "any" || getShiftInfo(p.delivery_slot, p.run_id).shift === selShift)
        );
        setPartnerBKey(candidate ? getRunKey(candidate) : "");
      }
    }
  };

  // Handler for Partner B Selection
  const handleSelectPartnerB = (newKey: string) => {
    setPartnerBKey(newKey);
    if (!newKey) return;

    const selected = allPartners.find((p) => getRunKey(p) === newKey);
    if (!selected) return;

    const selShift = getShiftInfo(selected.delivery_slot, selected.run_id).shift;

    // Check if Partner A is now invalid (different branch or cross-shift mismatch)
    if (partnerA) {
      const isSameKey = getRunKey(partnerA) === newKey;
      const isBranchMismatch =
        partnerA.branch_id && selected.branch_id && partnerA.branch_id !== selected.branch_id;
      const isShiftMismatch =
        selected.run_id &&
        partnerA.run_id &&
        selShift !== "any" &&
        shiftA !== "any" &&
        selShift !== shiftA;

      if (isSameKey || isBranchMismatch || isShiftMismatch) {
        // Find a matching alternative for Partner A in same branch and shift
        const candidate = allPartners.find(
          (p) =>
            getRunKey(p) !== newKey &&
            (!selected.branch_id || p.branch_id === selected.branch_id) &&
            (!p.run_id || selShift === "any" || getShiftInfo(p.delivery_slot, p.run_id).shift === selShift)
        );
        setPartnerAKey(candidate ? getRunKey(candidate) : "");
      }
    }
  };

  const getStops = (partner: PartnerWithStops | null): AddressStop[] => {
    if (!partner || !partner.address_stops) return [];
    return partner.address_stops;
  };

  const stopsA = useMemo(() => {
    const list = getStops(partnerA);
    if (!searchA.trim()) return list;
    const q = searchA.toLowerCase();
    return list.filter(
      (s) =>
        s.customer_name.toLowerCase().includes(q) ||
        s.address_line.toLowerCase().includes(q) ||
        s.orders.some((o) => o.order_id.toLowerCase().includes(q))
    );
  }, [partnerA, searchA]);

  const stopsB = useMemo(() => {
    const list = getStops(partnerB);
    if (!searchB.trim()) return list;
    const q = searchB.toLowerCase();
    return list.filter(
      (s) =>
        s.customer_name.toLowerCase().includes(q) ||
        s.address_line.toLowerCase().includes(q) ||
        s.orders.some((o) => o.order_id.toLowerCase().includes(q))
    );
  }, [partnerB, searchB]);

  // Handle Drag Start
  const handleDragStart = (e: React.DragEvent, stop: AddressStop, sourcePartner: PartnerWithStops) => {
    if (!canReassign(stop)) {
      e.preventDefault();
      showErrorToast(
        `This address stop is already '${stop.delivery_status}' and is locked from transfer.`
      );
      return;
    }

    setDraggedStop({ stop, sourcePartner });
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        addressId: stop.address_id,
        firstOrderId: stop.orders[0]?.order_id,
        sourcePartnerId: sourcePartner.delivery_partner_id,
        sourceRunId: sourcePartner.run_id,
      })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedStop(null);
    setDragOverColumn(null);
    setDragOverStopId(null);
  };

  // Move Address Stop to Target Partner
  const executeMove = async (targetPartner: PartnerWithStops) => {
    if (!draggedStop) return;
    const { stop, sourcePartner } = draggedStop;

    if (sourcePartner.delivery_partner_id === targetPartner.delivery_partner_id && sourcePartner.run_id === targetPartner.run_id) {
      handleDragEnd();
      return;
    }

    if (!stop.address_id) {
      showErrorToast("Could not find address ID for this stop");
      handleDragEnd();
      return;
    }

    setProcessing(true);
    setActionNotice(`Moving address stop to ${targetPartner.partner_name}...`);

    try {
      const res = await api.post<any>("/admin/delivery/runs/orders/move", {
        address_id: stop.address_id,
        order_id: stop.orders[0]?.order_id || undefined,
        source_partner_id: sourcePartner.delivery_partner_id,
        source_run_id: sourcePartner.run_id || undefined,
        target_partner_id: targetPartner.delivery_partner_id,
        target_run_id: targetPartner.run_id || undefined,
        reason: "Reassigned via 2-Partner Drag & Drop Board",
      });

      if (res.data?.status) {
        showSuccessToast(res.data?.message || `Address stop moved to ${targetPartner.partner_name}!`);
        await fetchPartners();
        if (onRefreshParent) onRefreshParent();
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

  // Swap Address Stops Between Partner A and Partner B
  const executeSwap = async (targetStop: AddressStop, targetPartner: PartnerWithStops) => {
    if (!draggedStop) return;
    const { stop: sourceStop, sourcePartner } = draggedStop;

    if (sourceStop.address_id === targetStop.address_id) {
      handleDragEnd();
      return;
    }

    if (sourcePartner.delivery_partner_id === targetPartner.delivery_partner_id && sourcePartner.run_id === targetPartner.run_id) {
      showErrorToast("Both address stops already belong to the same delivery run.");
      handleDragEnd();
      return;
    }

    if (!canReassign(sourceStop) || !canReassign(targetStop)) {
      const blocked = !canReassign(sourceStop) ? sourceStop : targetStop;
      showErrorToast(
        `Address stop is already '${blocked.delivery_status}' and cannot be swapped.`
      );
      handleDragEnd();
      return;
    }

    if (!sourceStop.address_id || !targetStop.address_id) {
      showErrorToast("Could not resolve address IDs for both stops");
      handleDragEnd();
      return;
    }

    setProcessing(true);
    setActionNotice(`Swapping stops between ${sourcePartner.partner_name} and ${targetPartner.partner_name}...`);

    try {
      const res = await api.post<any>("/admin/delivery/runs/orders/swap", {
        address_a_id: sourceStop.address_id,
        address_b_id: targetStop.address_id,
        order_a_id: sourceStop.orders[0]?.order_id || undefined,
        order_b_id: targetStop.orders[0]?.order_id || undefined,
        reason: "Swapped via 2-Partner Drag & Drop Board",
      });

      if (res.data?.status) {
        showSuccessToast(res.data?.message || "Address stops swapped successfully!");
        await fetchPartners();
        if (onRefreshParent) onRefreshParent();
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
    if (targetColumn === "A" && partnerA) {
      if (draggedStop.sourcePartner.delivery_partner_id === partnerA.delivery_partner_id && draggedStop.sourcePartner.run_id === partnerA.run_id) return;
      executeMove(partnerA);
    } else if (targetColumn === "B" && partnerB) {
      if (draggedStop.sourcePartner.delivery_partner_id === partnerB.delivery_partner_id && draggedStop.sourcePartner.run_id === partnerB.run_id) return;
      executeMove(partnerB);
    }
  };

  const handleDropOnStopCard = (e: React.DragEvent, targetStop: AddressStop, targetPartner: PartnerWithStops) => {
    e.stopPropagation();
    if (!draggedStop) return;
    executeSwap(targetStop, targetPartner);
  };

  const shiftInfoA = partnerA ? getShiftInfo(partnerA.delivery_slot, partnerA.run_id) : null;
  const shiftInfoB = partnerB ? getShiftInfo(partnerB.delivery_slot, partnerB.run_id) : null;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Banner Guide - Enterprise F2H Emerald Theme */}
      <div className="rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-white p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/30">
            <ArrowRightLeft size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-black text-slate-900">
                Interactive Two-Partner Address Swap & Move Board
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200/60">
                Live Drag & Drop
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                <ShieldCheck size={11} className="text-emerald-600" /> Transferable in Pending & Transit
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Select either <strong className="text-slate-800 font-bold">Partner A</strong> or <strong className="text-teal-800 font-bold">Partner B</strong>. Dropdowns automatically align delivery partners from the <strong className="text-emerald-700 font-bold">same branch</strong> and matching shift (<strong className="text-amber-800 font-bold">Morning ☀️</strong> or <strong className="text-teal-800 font-bold">Evening 🌙</strong>). Drag any <strong className="text-amber-700 font-bold">pending</strong> or <strong className="text-sky-700 font-bold">in-transit</strong> stop across to reassign.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={() => fetchPartners()}
            disabled={loading || processing}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer hover:border-emerald-300"
          >
            <RefreshCw size={13} className={loading || processing ? "animate-spin text-emerald-600" : "text-slate-500"} />
            <span>Refresh Board</span>
          </button>
        </div>
      </div>

      {/* Loading & Action Notification */}
      {processing && (
        <div className="p-3.5 rounded-xl bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 animate-pulse">
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
            if (draggedStop && (draggedStop.sourcePartner.delivery_partner_id !== partnerA?.delivery_partner_id || draggedStop.sourcePartner.run_id !== partnerA?.run_id)) {
              setDragOverColumn("A");
            }
          }}
          onDragLeave={() => setDragOverColumn(null)}
          onDrop={() => handleDropOnColumn("A")}
          className={`rounded-2xl border transition-all flex flex-col bg-white shadow-sm overflow-hidden ${
            dragOverColumn === "A"
              ? "border-emerald-600 ring-4 ring-emerald-500/20 bg-emerald-50/40"
              : "border-slate-200/90"
          }`}
        >
          {/* Column Header */}
          <div className="p-4 bg-slate-50/90 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-emerald-200/60">
                  <Truck size={13} className="text-emerald-700" /> Partner A
                </span>
                {shiftInfoA && partnerA?.run_id && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${shiftInfoA.badgeClass}`}>
                    {shiftInfoA.shift === "morning" ? <Sun size={11} className="text-amber-600" /> : <Moon size={11} className="text-teal-700" />}
                    <span>{shiftInfoA.code}</span>
                  </span>
                )}
              </div>

              {partnerA?.run_id ? (
                <span className="font-mono text-xs font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                  {partnerA.run_id}
                </span>
              ) : partnerA ? (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                  No Run Assigned
                </span>
              ) : null}
            </div>

            {/* Partner A Selector Dropdown (Bidirectional: filtered by branch & shift) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                  <span>Select Partner A:</span>
                  {partnerB && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                      {partnerB.branch_name} {shiftB !== "any" ? `• ${shiftB.toUpperCase()}` : ""}
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-500">
                    {eligiblePartnersForA.length} Option{eligiblePartnersForA.length === 1 ? "" : "s"}
                  </span>
                  {partnerAKey && (
                    <button
                      type="button"
                      onClick={() => setPartnerAKey("")}
                      className="text-[10px] text-rose-500 hover:text-rose-700 font-bold underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <select
                value={partnerAKey}
                onChange={(e) => handleSelectPartnerA(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs"
              >
                <option value="">
                  {partnerB
                    ? `-- Select Partner in ${partnerB.branch_name} (${eligiblePartnersForA.length}) --`
                    : "-- Select any Delivery Partner A --"}
                </option>
                {eligiblePartnersForA.map((p) => {
                  const key = getRunKey(p);
                  const hasRun = Boolean(p.run_id);
                  const stopsCount = p.address_stops?.length || 0;
                  const shift = getShiftInfo(p.delivery_slot, p.run_id);
                  return (
                    <option key={key} value={key}>
                      {p.partner_name} ({p.branch_name || "No Branch"}) {hasRun ? `• [${shift.code}] ${stopsCount} stops (${p.run_id})` : "• No run (Ready for Drop)"}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Partner A Info Ribbon */}
            {partnerA ? (
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2 text-slate-600">
                  <Users size={12} className="text-slate-400" />
                  <span className="font-bold text-slate-800">{partnerA.partner_name}</span>
                  <span className="text-slate-400">• {partnerA.branch_name}</span>
                  {partnerA.partner_phone && (
                    <span className="text-slate-400 font-mono text-[11px]">• {partnerA.partner_phone}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] border border-emerald-200/50">
                    {stopsA.length} Stops
                  </span>
                  {partnerA.run_id && (
                    <span className="text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full text-[10px] border border-teal-200/50">
                      {partnerA.completed_addresses || 0} Done
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Please select a delivery partner</p>
            )}

            {/* Search within stops */}
            {partnerA && stopsA.length > 3 && (
              <div className="relative pt-1">
                <Search size={13} className="absolute left-2.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchA}
                  onChange={(e) => setSearchA(e.target.value)}
                  placeholder="Filter address or customer..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>
            )}
          </div>

          {/* Column Body: Address Cards */}
          <div className="p-4 flex-1 space-y-2.5 min-h-[380px] max-h-[560px] overflow-y-auto bg-slate-50/30">
            {!partnerA ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                <Users size={32} className="stroke-1 text-slate-300" />
                <p className="text-xs font-semibold">Select Partner A to load assigned address stops.</p>
              </div>
            ) : !partnerA.run_id ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-xl bg-white/60">
                <PlusCircle size={28} className="text-emerald-500 stroke-1" />
                <p className="text-xs font-bold text-slate-700">No Run Assigned to {partnerA.partner_name}</p>
                <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                  Drag any pending or in-transit stop from Partner B and drop it here to automatically generate a new delivery run for {partnerA.partner_name}!
                </p>
              </div>
            ) : stopsA.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-xl">
                <Package size={28} className="text-slate-300 stroke-1" />
                <p className="text-xs font-bold text-slate-500">No Address Stops in Run</p>
                <p className="text-[11px] text-slate-400">
                  Drag an address stop from Partner B and drop it here to assign it to {partnerA.partner_name}.
                </p>
              </div>
            ) : (
              stopsA.map((stop, idx) => {
                const isMovable = canReassign(stop);
                const isDragOverThis = dragOverStopId === stop.address_id;
                const isBeingDragged = draggedStop?.stop.address_id === stop.address_id;
                const normStatus = (stop.delivery_status || "pending").toLowerCase();

                return (
                  <div
                    key={stop.address_id || idx}
                    draggable={isMovable && !processing}
                    onDragStart={(e) => handleDragStart(e, stop, partnerA)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedStop && draggedStop.stop.address_id !== stop.address_id) {
                        setDragOverStopId(stop.address_id);
                      }
                    }}
                    onDragLeave={() => setDragOverStopId(null)}
                    onDrop={(e) => handleDropOnStopCard(e, stop, partnerA)}
                    className={`p-3.5 rounded-xl border transition-all select-none ${
                      isBeingDragged
                        ? "opacity-40 border-emerald-400 bg-emerald-50/50"
                        : isDragOverThis
                        ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/30 scale-[1.01]"
                        : isMovable
                        ? "border-slate-200 bg-white hover:border-emerald-400 hover:shadow-xs cursor-grab active:cursor-grabbing"
                        : "border-slate-200 bg-slate-50 opacity-75 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        {isMovable ? (
                          <div className="text-slate-400 hover:text-emerald-600 cursor-grab">
                            <GripVertical size={16} />
                          </div>
                        ) : (
                          <div className="text-slate-400" title={`Locked - stop is already ${stop.delivery_status}`}>
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
                          normStatus === "delivered"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : normStatus === "failed"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : normStatus === "in_transit" || normStatus === "in-transit"
                            ? "bg-sky-50 text-sky-800 border border-sky-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {normStatus === "in_transit" || normStatus === "in-transit" ? "In Transit" : normStatus}
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
                          className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] font-bold text-slate-700"
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
            if (draggedStop && (draggedStop.sourcePartner.delivery_partner_id !== partnerB?.delivery_partner_id || draggedStop.sourcePartner.run_id !== partnerB?.run_id)) {
              setDragOverColumn("B");
            }
          }}
          onDragLeave={() => setDragOverColumn(null)}
          onDrop={() => handleDropOnColumn("B")}
          className={`rounded-2xl border transition-all flex flex-col bg-white shadow-sm overflow-hidden ${
            dragOverColumn === "B"
              ? "border-teal-600 ring-4 ring-teal-500/20 bg-teal-50/40"
              : "border-slate-200/90"
          }`}
        >
          {/* Column Header */}
          <div className="p-4 bg-slate-50/90 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-teal-100 text-teal-900 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-teal-200/60">
                  <Truck size={13} className="text-teal-700" /> Partner B
                </span>
                {shiftInfoB && partnerB?.run_id && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${shiftInfoB.badgeClass}`}>
                    {shiftInfoB.shift === "morning" ? <Sun size={11} className="text-amber-600" /> : <Moon size={11} className="text-teal-700" />}
                    <span>{shiftInfoB.code}</span>
                  </span>
                )}
              </div>

              {partnerB?.run_id ? (
                <span className="font-mono text-xs font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                  {partnerB.run_id}
                </span>
              ) : partnerB ? (
                <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60">
                  Ready for Drop / New Run
                </span>
              ) : null}
            </div>

            {/* Partner B Selector Dropdown (Bidirectional: filtered by branch & shift) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                  <span>Select Partner B:</span>
                  {partnerA && (
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/60">
                      {partnerA.branch_name} {shiftA !== "any" ? `• ${shiftA.toUpperCase()}` : ""}
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-500">
                    {eligiblePartnersForB.length} Option{eligiblePartnersForB.length === 1 ? "" : "s"}
                  </span>
                  {partnerBKey && (
                    <button
                      type="button"
                      onClick={() => setPartnerBKey("")}
                      className="text-[10px] text-rose-500 hover:text-rose-700 font-bold underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <select
                value={partnerBKey}
                onChange={(e) => handleSelectPartnerB(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 shadow-2xs"
              >
                <option value="">
                  {partnerA
                    ? `-- Select Partner in ${partnerA.branch_name} (${eligiblePartnersForB.length}) --`
                    : "-- Select any Delivery Partner B --"}
                </option>
                {eligiblePartnersForB.map((p) => {
                  const key = getRunKey(p);
                  const hasRun = Boolean(p.run_id);
                  const stopsCount = p.address_stops?.length || 0;
                  const shift = getShiftInfo(p.delivery_slot, p.run_id);
                  return (
                    <option key={key} value={key}>
                      {p.partner_name} ({p.branch_name || "No Branch"}) {hasRun ? `• [${shift.code}] ${stopsCount} stops (${p.run_id})` : "• No run (Ready for Drop)"}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Partner B Info Ribbon */}
            {partnerB ? (
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2 text-slate-600">
                  <Users size={12} className="text-slate-400" />
                  <span className="font-bold text-slate-800">{partnerB.partner_name}</span>
                  <span className="text-slate-400">• {partnerB.branch_name}</span>
                  {partnerB.partner_phone && (
                    <span className="text-slate-400 font-mono text-[11px]">• {partnerB.partner_phone}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full text-[10px] border border-teal-200/50">
                    {stopsB.length} Stops
                  </span>
                  {partnerB.run_id && (
                    <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] border border-emerald-200/50">
                      {partnerB.completed_addresses || 0} Done
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                {partnerA ? `Please select a delivery partner from ${partnerA.branch_name}` : "Select any Partner B or Partner A"}
              </p>
            )}

            {/* Search within stops */}
            {partnerB && stopsB.length > 3 && (
              <div className="relative pt-1">
                <Search size={13} className="absolute left-2.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchB}
                  onChange={(e) => setSearchB(e.target.value)}
                  placeholder="Filter address or customer..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </div>
            )}
          </div>

          {/* Column Body: Address Cards */}
          <div className="p-4 flex-1 space-y-2.5 min-h-[380px] max-h-[560px] overflow-y-auto bg-slate-50/30">
            {!partnerB ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                <Users size={32} className="stroke-1 text-slate-300" />
                <p className="text-xs font-semibold">
                  {partnerA ? `Select Partner B from ${partnerA.branch_name} to compare runs.` : "Select Partner B to load assigned address stops."}
                </p>
              </div>
            ) : !partnerB.run_id ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2 border-2 border-dashed border-teal-200 rounded-xl bg-teal-50/20">
                <PlusCircle size={28} className="text-teal-600 stroke-1" />
                <p className="text-xs font-bold text-slate-700">Ready for New Run Creation</p>
                <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                  {partnerB.partner_name} does not have a run yet. Drag any pending or in-transit stop from {partnerA?.partner_name} and drop it here to automatically generate a new delivery run!
                </p>
              </div>
            ) : stopsB.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-xl">
                <Package size={28} className="text-slate-300 stroke-1" />
                <p className="text-xs font-bold text-slate-500">No Address Stops in Run</p>
                <p className="text-[11px] text-slate-400">
                  Drag an address stop from Partner A and drop it here to assign it to {partnerB.partner_name}.
                </p>
              </div>
            ) : (
              stopsB.map((stop, idx) => {
                const isMovable = canReassign(stop);
                const isDragOverThis = dragOverStopId === stop.address_id;
                const isBeingDragged = draggedStop?.stop.address_id === stop.address_id;
                const normStatus = (stop.delivery_status || "pending").toLowerCase();

                return (
                  <div
                    key={stop.address_id || idx}
                    draggable={isMovable && !processing}
                    onDragStart={(e) => handleDragStart(e, stop, partnerB)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedStop && draggedStop.stop.address_id !== stop.address_id) {
                        setDragOverStopId(stop.address_id);
                      }
                    }}
                    onDragLeave={() => setDragOverStopId(null)}
                    onDrop={(e) => handleDropOnStopCard(e, stop, partnerB)}
                    className={`p-3.5 rounded-xl border transition-all select-none ${
                      isBeingDragged
                        ? "opacity-40 border-teal-400 bg-teal-50/50"
                        : isDragOverThis
                        ? "border-teal-600 bg-teal-50 ring-2 ring-teal-500/30 scale-[1.01]"
                        : isMovable
                        ? "border-slate-200 bg-white hover:border-teal-400 hover:shadow-xs cursor-grab active:cursor-grabbing"
                        : "border-slate-200 bg-slate-50 opacity-75 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        {isMovable ? (
                          <div className="text-slate-400 hover:text-teal-600 cursor-grab">
                            <GripVertical size={16} />
                          </div>
                        ) : (
                          <div className="text-slate-400" title={`Locked - stop is already ${stop.delivery_status}`}>
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
                          normStatus === "delivered"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : normStatus === "failed"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : normStatus === "in_transit" || normStatus === "in-transit"
                            ? "bg-sky-50 text-sky-800 border border-sky-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {normStatus === "in_transit" || normStatus === "in-transit" ? "In Transit" : normStatus}
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
                          className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] font-bold text-slate-700"
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
