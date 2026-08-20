"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CalendarOff,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { api } from "@/services/api.client";

interface AvailabilityPartner {
  id: string;
  full_name: string;
  branch_id?: string | null;
  branch_name?: string | null;
  is_active?: boolean;
  is_online?: boolean;
  on_leave_today?: boolean;
  pending_leave_requests?: number;
}

interface PartnerAvailabilityResponse {
  status: boolean;
  data: AvailabilityPartner[];
  message?: string;
}

type AvailabilityStatus = "on_leave" | "online" | "offline";

function getAvailabilityStatus(
  partner: AvailabilityPartner,
): AvailabilityStatus {
  if (partner.on_leave_today) return "on_leave";
  return partner.is_online ? "online" : "offline";
}

function AvailabilityBadge({ partner }: { partner: AvailabilityPartner }) {
  const status = getAvailabilityStatus(partner);

  if (status === "on_leave") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">
        <CalendarOff size={13} /> On Leave
      </span>
    );
  }

  if (status === "online") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
        <Wifi size={13} /> Online
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
      <WifiOff size={13} /> Offline
    </span>
  );
}

function PendingLeaveBadge({ partner }: { partner: AvailabilityPartner }) {
  const pendingCount = partner.pending_leave_requests ?? 0;

  if (pendingCount === 0) {
    return <span className="text-xs text-slate-400">None</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
      <CalendarClock size={13} /> {pendingCount} Pending
    </span>
  );
}

export default function OnlinePartnersPanel({
  branchId,
}: {
  branchId?: string;
}) {
  const [partners, setPartners] = useState<AvailabilityPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const query = branchId
      ? `?branch_id=${encodeURIComponent(branchId)}`
      : "";

    try {
      const response = await api.get<PartnerAvailabilityResponse>(
        `/admin/delivery/partners/online${query}`,
      );
      const data = response.data?.data;

      if (!response.data?.status || !Array.isArray(data)) {
        throw new Error("Could not load partner availability");
      }

      setPartners(
        data.filter(
          (partner: AvailabilityPartner) => partner.is_active !== false,
        ),
      );
      setError(null);
    } catch {
      setError("Could not load partner availability");
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 45_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Active Partner Availability
          </h2>
          <p className="text-xs text-slate-500">
            Online, offline, approved leave, and pending leave requests
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <AlertCircle size={24} className="text-rose-600" />
          <p className="text-sm font-semibold text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700"
          >
            Try again
          </button>
        </div>
      ) : loading && partners.length === 0 ? (
        <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          Loading active partners...
        </div>
      ) : partners.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-slate-500">
          No active delivery partners found for this branch.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3 font-bold">
                  Partner
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Branch
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Pending Leave
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partners.map((partner) => (
                <tr key={partner.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900">
                    {partner.full_name || "Delivery Partner"}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {partner.branch_name ||
                      partner.branch_id ||
                      "Unassigned"}
                  </td>
                  <td className="px-5 py-3">
                    <AvailabilityBadge partner={partner} />
                  </td>
                  <td className="px-5 py-3">
                    <PendingLeaveBadge partner={partner} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
