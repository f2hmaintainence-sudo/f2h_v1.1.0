// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx (Partner Onboarding Requests)
// Description : Executive Admin UI for managing delivery partner applications & inquiries
// ============================================================================

"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  UserPlus,
  Search,
  RefreshCw,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  Bike,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building,
} from "lucide-react";

interface PartnerRequest {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  city: string;
  area: string;
  vehicle_type: string;
  vehicle_number: string | null;
  driving_license_number: string | null;
  preferred_shift: string;
  experience_years: string;
  status: "PENDING" | "CONTACTED" | "APPROVED" | "REJECTED";
  admin_notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

interface SummaryCounts {
  pending: number;
  contacted: number;
  approved: number;
  rejected: number;
  total: number;
}

export default function PartnerRequestsPage() {
  const [requests, setRequests] = useState<PartnerRequest[]>([]);
  const [summary, setSummary] = useState<SummaryCounts>({
    pending: 0,
    contacted: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [shiftFilter, setShiftFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notesModal, setNotesModal] = useState<{ id: string; name: string; notes: string; status: string } | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (shiftFilter !== "ALL") params.set("shift", shiftFilter);
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/v1/admin/delivery/partner-requests?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setRequests(data.data || []);
        setSummary(data.summary || { pending: 0, contacted: 0, approved: 0, rejected: 0, total: 0 });
        setTotalPages(data.meta?.totalPages || 1);
      }
    } catch (err) {
      console.error("Failed to load partner requests:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, shiftFilter, search, page]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleUpdateStatus = async (id: string, newStatus: string, notes?: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/v1/admin/delivery/partner-requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus, notes }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, status: newStatus as any, admin_notes: notes !== undefined ? notes : r.admin_notes }
              : r
          )
        );
        if (notesModal) setNotesModal(null);
        fetchRequests();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the application from ${name}?`)) return;
    try {
      const res = await fetch(`/api/v1/admin/delivery/partner-requests/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        fetchRequests();
      }
    } catch (err) {
      console.error("Failed to delete request:", err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Pending</span>;
      case "CONTACTED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">Contacted</span>;
      case "APPROVED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Approved</span>;
      case "REJECTED":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Rejected</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              <UserPlus size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Partner Onboarding Inquiries</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Review candidate applications submitted from the landing website and mobile app onboarding.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchRequests()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Stat Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => { setStatusFilter("ALL"); setPage(1); }}
          className={`cursor-pointer p-4 rounded-xl border transition ${
            statusFilter === "ALL" ? "bg-slate-900 text-white border-slate-900 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${statusFilter === "ALL" ? "text-slate-300" : "text-slate-500"}`}>
            Total Inquiries
          </p>
          <p className="text-2xl font-black mt-1">{summary.total || 0}</p>
        </div>

        <div
          onClick={() => { setStatusFilter("PENDING"); setPage(1); }}
          className={`cursor-pointer p-4 rounded-xl border transition ${
            statusFilter === "PENDING" ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400" : "bg-white border-slate-200 hover:border-amber-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Pending Review</p>
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
          </div>
          <p className="text-2xl font-black text-amber-900 mt-1">{summary.pending || 0}</p>
        </div>

        <div
          onClick={() => { setStatusFilter("CONTACTED"); setPage(1); }}
          className={`cursor-pointer p-4 rounded-xl border transition ${
            statusFilter === "CONTACTED" ? "bg-blue-50 border-blue-300 ring-2 ring-blue-400" : "bg-white border-slate-200 hover:border-blue-200"
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Contacted</p>
          <p className="text-2xl font-black text-blue-900 mt-1">{summary.contacted || 0}</p>
        </div>

        <div
          onClick={() => { setStatusFilter("APPROVED"); setPage(1); }}
          className={`cursor-pointer p-4 rounded-xl border transition ${
            statusFilter === "APPROVED" ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400" : "bg-white border-slate-200 hover:border-emerald-200"
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Approved</p>
          <p className="text-2xl font-black text-emerald-900 mt-1">{summary.approved || 0}</p>
        </div>

        <div
          onClick={() => { setStatusFilter("REJECTED"); setPage(1); }}
          className={`cursor-pointer p-4 rounded-xl border transition ${
            statusFilter === "REJECTED" ? "bg-rose-50 border-rose-300 ring-2 ring-rose-400" : "bg-white border-slate-200 hover:border-rose-200"
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Rejected</p>
          <p className="text-2xl font-black text-rose-900 mt-1">{summary.rejected || 0}</p>
        </div>
      </div>

      {/* ── Filter & Search Bar ── */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, phone, area..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter size={14} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONTACTED">Contacted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Clock size={14} className="text-slate-400" />
            <select
              value={shiftFilter}
              onChange={(e) => { setShiftFilter(e.target.value); setPage(1); }}
              className="text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
            >
              <option value="ALL">All Shifts</option>
              <option value="Morning">Morning (5:30 - 7:30 AM)</option>
              <option value="Evening">Evening (5:00 - 7:30 PM)</option>
              <option value="Both">Both Shifts</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Candidate</th>
                <th className="py-3.5 px-4">Contact Channels</th>
                <th className="py-3.5 px-4">Locality / City</th>
                <th className="py-3.5 px-4">Vehicle &amp; Experience</th>
                <th className="py-3.5 px-4">Shift Preference</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading partner applications...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No partner inquiries found matching your filters.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{r.full_name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Applied: {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      {r.admin_notes && (
                        <div className="mt-1 text-[11px] bg-amber-50 border border-amber-200 rounded px-2 py-0.5 text-amber-800 max-w-xs truncate">
                          Note: {r.admin_notes}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-800 font-medium">{r.phone}</span>
                        <a
                          href={`tel:${r.phone}`}
                          title="Call Candidate"
                          className="p-1 rounded bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-600 transition"
                        >
                          <Phone size={12} />
                        </a>
                        <a
                          href={`https://wa.me/91${r.phone.replace(/[^0-9]/g, "")}?text=Hi%20${encodeURIComponent(r.full_name)},%20this%20is%20F2H%20Fresh%20Delivery%20Operations%20team%20regarding%20your%20partner%20application.`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Message on WhatsApp"
                          className="p-1 rounded bg-emerald-50 hover:bg-emerald-200 text-emerald-700 transition"
                        >
                          <MessageSquare size={12} />
                        </a>
                      </div>
                      {r.email && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                          <Mail size={11} /> {r.email}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 text-slate-900 font-medium">
                        <MapPin size={12} className="text-emerald-600 shrink-0" />
                        {r.area}
                      </div>
                      <div className="text-[11px] text-slate-400 ml-4">{r.city || "Bengaluru"}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 font-medium text-slate-800">
                        <Bike size={13} className="text-slate-500" />
                        {r.vehicle_type}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Exp: {r.experience_years || "Fresher"}
                        {r.driving_license_number && ` • DL: ${r.driving_license_number}`}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                        <Clock size={10} /> {r.preferred_shift}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {getStatusBadge(r.status)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.status === "PENDING" && (
                          <button
                            onClick={() => handleUpdateStatus(r.id, "CONTACTED")}
                            disabled={updatingId === r.id}
                            title="Mark as Contacted"
                            className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition"
                          >
                            Contacted
                          </button>
                        )}
                        {r.status !== "APPROVED" && (
                          <button
                            onClick={() => handleUpdateStatus(r.id, "APPROVED")}
                            disabled={updatingId === r.id}
                            title="Approve Candidate"
                            className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition"
                          >
                            Approve
                          </button>
                        )}
                        {r.status !== "REJECTED" && (
                          <button
                            onClick={() => handleUpdateStatus(r.id, "REJECTED")}
                            disabled={updatingId === r.id}
                            title="Reject Candidate"
                            className="px-2.5 py-1 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition"
                          >
                            Reject
                          </button>
                        )}
                        <button
                          onClick={() => setNotesModal({ id: r.id, name: r.full_name, notes: r.admin_notes || "", status: r.status })}
                          title="Add Note"
                          className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                        >
                          Notes
                        </button>
                        <button
                          onClick={() => handleDelete(r.id, r.full_name)}
                          title="Delete Application"
                          className="p-1 text-slate-400 hover:text-rose-600 transition rounded"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-100 text-xs text-slate-500">
            <div>
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Notes Modal ── */}
      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Admin Notes for {notesModal.name}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select
                value={notesModal.status}
                onChange={(e) => setNotesModal({ ...notesModal, status: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="PENDING">PENDING</option>
                <option value="CONTACTED">CONTACTED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / Remarks</label>
              <textarea
                rows={4}
                value={notesModal.notes}
                onChange={(e) => setNotesModal({ ...notesModal, notes: e.target.value })}
                placeholder="e.g. Spoke on phone, ready for Whitefield cluster morning shift starting Monday..."
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setNotesModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus(notesModal.id, notesModal.status, notesModal.notes)}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
