// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx (Partner Requests & Support Tickets Hub)
// Description : Executive Admin UI for managing delivery partner onboarding inquiries & support tickets
// ============================================================================

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api as apiClient } from "@/services/api.client";
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
  AlertTriangle,
  Trash2,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building,
  Ticket,
  LifeBuoy,
  Eye,
  FileText,
  Image as ImageIcon,
  Check,
  Send,
  X,
  Flame,
  ArrowUpRight,
  Sparkles,
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

interface SupportTicket {
  ticket_id: string;
  user_id: string;
  user_type: string;
  category: string;
  subject: string;
  description: string | null;
  priority: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  attachments: string[];
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  partner_name: string;
  partner_phone: string;
  partner_email: string;
  vehicle_type: string | null;
  vehicle_number: string | null;
  branch_id: string | null;
}

interface RequestSummaryCounts {
  pending: number;
  contacted: number;
  approved: number;
  rejected: number;
  total: number;
}

interface TicketSummaryCounts {
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  total: number;
}

export default function PartnerRequestsPage() {
  const [activeTab, setActiveTab] = useState<"tickets" | "inquiries">("tickets");

  // ── Support Tickets State ──
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketSummary, setTicketSummary] = useState<TicketSummaryCounts>({
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    total: 0,
  });
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("ALL");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("ALL");
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState("ALL");
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketTotalPages, setTicketTotalPages] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketNotesInput, setTicketNotesInput] = useState("");
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // ── Onboarding Inquiries State ──
  const [requests, setRequests] = useState<PartnerRequest[]>([]);
  const [requestSummary, setRequestSummary] = useState<RequestSummaryCounts>({
    pending: 0,
    contacted: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState("ALL");
  const [shiftFilter, setShiftFilter] = useState("ALL");
  const [requestPage, setRequestPage] = useState(1);
  const [requestTotalPages, setRequestTotalPages] = useState(1);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [notesModal, setNotesModal] = useState<{ id: string; name: string; notes: string; status: string } | null>(null);

  // ── Fetch Support Tickets ──
  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const params = new URLSearchParams();
      if (ticketStatusFilter !== "ALL") params.set("status", ticketStatusFilter);
      if (ticketPriorityFilter !== "ALL") params.set("priority", ticketPriorityFilter);
      if (ticketCategoryFilter !== "ALL") params.set("category", ticketCategoryFilter);
      if (ticketSearch.trim()) params.set("search", ticketSearch.trim());
      params.set("page", String(ticketPage));
      params.set("limit", "20");

      const res = await apiClient.get<any>(`/admin/delivery/support-tickets?${params.toString()}`);

      if (res.data) {
        setTickets(res.data.data || []);
        setTicketSummary(res.data.summary || { open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0 });
        setTicketTotalPages(res.data.meta?.totalPages || 1);
      }
    } catch (err) {
      console.error("Failed to load partner support tickets:", err);
    } finally {
      setTicketsLoading(false);
    }
  }, [ticketStatusFilter, ticketPriorityFilter, ticketCategoryFilter, ticketSearch, ticketPage]);

  // ── Fetch Onboarding Requests ──
  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const params = new URLSearchParams();
      if (requestStatusFilter !== "ALL") params.set("status", requestStatusFilter);
      if (shiftFilter !== "ALL") params.set("shift", shiftFilter);
      if (requestSearch.trim()) params.set("search", requestSearch.trim());
      params.set("page", String(requestPage));
      params.set("limit", "20");

      const res = await apiClient.get<any>(`/admin/delivery/partner-requests?${params.toString()}`);

      if (res.data) {
        setRequests(res.data.data || []);
        setRequestSummary(res.data.summary || { pending: 0, contacted: 0, approved: 0, rejected: 0, total: 0 });
        setRequestTotalPages(res.data.meta?.totalPages || 1);
      }
    } catch (err) {
      console.error("Failed to load partner requests:", err);
    } finally {
      setRequestsLoading(false);
    }
  }, [requestStatusFilter, shiftFilter, requestSearch, requestPage]);

  useEffect(() => {
    if (activeTab === "tickets") {
      fetchTickets();
    } else {
      fetchRequests();
    }
  }, [activeTab, fetchTickets, fetchRequests]);

  // ── Ticket Status Handler ──
  const handleUpdateTicketStatus = async (ticketId: string, newStatus: string, notes?: string) => {
    setUpdatingTicketId(ticketId);
    try {
      const res = await apiClient.patch<any>(`/admin/delivery/support-tickets/${ticketId}/status`, {
        status: newStatus,
        admin_notes: notes,
      });
      if (!res.error && res.data) {
        setTickets((prev) =>
          prev.map((t) =>
            t.ticket_id === ticketId
              ? { ...t, status: newStatus as any, admin_notes: notes !== undefined ? notes : t.admin_notes }
              : t
          )
        );
        if (selectedTicket && selectedTicket.ticket_id === ticketId) {
          setSelectedTicket((prev) =>
            prev ? { ...prev, status: newStatus as any, admin_notes: notes !== undefined ? notes : prev.admin_notes } : null
          );
        }
        fetchTickets();
      } else if (res.error) {
        alert(`Failed to update ticket: ${res.error}`);
      }
    } catch (err) {
      console.error("Failed to update ticket status:", err);
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!window.confirm(`Are you sure you want to delete support ticket #${ticketId}?`)) return;
    try {
      const res = await apiClient.delete<any>(`/admin/delivery/support-tickets/${ticketId}`);
      if (!res.error) {
        setTickets((prev) => prev.filter((t) => t.ticket_id !== ticketId));
        if (selectedTicket?.ticket_id === ticketId) setSelectedTicket(null);
        fetchTickets();
      } else {
        alert(`Failed to delete ticket: ${res.error}`);
      }
    } catch (err) {
      console.error("Failed to delete ticket:", err);
    }
  };

  // ── Onboarding Status Handler ──
  const handleUpdateRequestStatus = async (id: string, newStatus: string, notes?: string) => {
    setUpdatingRequestId(id);
    try {
      const res = await apiClient.patch<any>(`/admin/delivery/partner-requests/${id}/status`, {
        status: newStatus,
        notes,
      });
      if (!res.error && res.data) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, status: newStatus as any, admin_notes: notes !== undefined ? notes : r.admin_notes }
              : r
          )
        );
        if (notesModal) setNotesModal(null);
        fetchRequests();
      } else if (res.error) {
        alert(`Failed to update application: ${res.error}`);
      }
    } catch (err) {
      console.error("Failed to update request status:", err);
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const handleDeleteRequest = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the application from ${name}?`)) return;
    try {
      const res = await apiClient.delete<any>(`/admin/delivery/partner-requests/${id}`);
      if (!res.error) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        fetchRequests();
      } else {
        alert(`Failed to delete application: ${res.error}`);
      }
    } catch (err) {
      console.error("Failed to delete request:", err);
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category?.toLowerCase()) {
      case "payout":
        return "💰 Payout / Salary";
      case "app_bug":
        return "🐛 App Issue / Bug";
      case "customer":
        return "👤 Customer Behavior";
      case "inventory":
        return "📦 Stock / Handover";
      default:
        return "ℹ️ General Support";
    }
  };

  const getTicketStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "open":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Open
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            In Progress
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Resolved
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
            <Flame size={11} className="text-rose-600" /> CRITICAL
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
            <AlertTriangle size={11} className="text-orange-600" /> HIGH
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            MEDIUM
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            LOW
          </span>
        );
      default:
        return <span className="text-xs text-slate-500 font-medium">{priority}</span>;
    }
  };

  const getRequestStatusBadge = (status: string) => {
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
      {/* ── Header Card ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              <LifeBuoy size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Delivery Partner Operations Hub</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Manage partner support tickets, grievances, and candidate onboarding inquiries.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => (activeTab === "tickets" ? fetchTickets() : fetchRequests())}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <RefreshCw size={14} className={ticketsLoading || requestsLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Main Navigation Tabs ── */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200 max-w-md">
        <button
          onClick={() => setActiveTab("tickets")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition ${
            activeTab === "tickets"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Ticket size={16} className={activeTab === "tickets" ? "text-emerald-600" : "text-slate-400"} />
          <span>Partner Support Tickets</span>
          {ticketSummary.open > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-amber-500 text-white">
              {ticketSummary.open}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("inquiries")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition ${
            activeTab === "inquiries"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <UserPlus size={16} className={activeTab === "inquiries" ? "text-emerald-600" : "text-slate-400"} />
          <span>Onboarding Inquiries</span>
          {requestSummary.pending > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-emerald-600 text-white">
              {requestSummary.pending}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1: PARTNER SUPPORT TICKETS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "tickets" && (
        <div className="space-y-6">
          {/* ── Stat Summary Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div
              onClick={() => { setTicketStatusFilter("ALL"); setTicketPage(1); }}
              className={`cursor-pointer p-4 rounded-xl border transition ${
                ticketStatusFilter === "ALL"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${ticketStatusFilter === "ALL" ? "text-slate-300" : "text-slate-500"}`}>
                Total Tickets
              </p>
              <p className="text-2xl font-black mt-1">{ticketSummary.total || 0}</p>
            </div>

            <div
              onClick={() => { setTicketStatusFilter("open"); setTicketPage(1); }}
              className={`cursor-pointer p-4 rounded-xl border transition ${
                ticketStatusFilter === "open"
                  ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400"
                  : "bg-white border-slate-200 hover:border-amber-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Open Tickets</p>
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
              </div>
              <p className="text-2xl font-black text-amber-900 mt-1">{ticketSummary.open || 0}</p>
            </div>

            <div
              onClick={() => { setTicketStatusFilter("in_progress"); setTicketPage(1); }}
              className={`cursor-pointer p-4 rounded-xl border transition ${
                ticketStatusFilter === "in_progress"
                  ? "bg-blue-50 border-blue-300 ring-2 ring-blue-400"
                  : "bg-white border-slate-200 hover:border-blue-200"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">In Progress</p>
              <p className="text-2xl font-black text-blue-900 mt-1">{ticketSummary.in_progress || 0}</p>
            </div>

            <div
              onClick={() => { setTicketStatusFilter("resolved"); setTicketPage(1); }}
              className={`cursor-pointer p-4 rounded-xl border transition ${
                ticketStatusFilter === "resolved"
                  ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400"
                  : "bg-white border-slate-200 hover:border-emerald-200"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Resolved</p>
              <p className="text-2xl font-black text-emerald-900 mt-1">{ticketSummary.resolved || 0}</p>
            </div>

            <div
              onClick={() => { setTicketStatusFilter("closed"); setTicketPage(1); }}
              className={`cursor-pointer p-4 rounded-xl border transition ${
                ticketStatusFilter === "closed"
                  ? "bg-slate-100 border-slate-400 ring-2 ring-slate-400"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">Closed</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{ticketSummary.closed || 0}</p>
            </div>
          </div>

          {/* ── Filter & Search Bar ── */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search ticket ID, subject, partner, phone..."
                value={ticketSearch}
                onChange={(e) => { setTicketSearch(e.target.value); setTicketPage(1); }}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5">
                <select
                  value={ticketCategoryFilter}
                  onChange={(e) => { setTicketCategoryFilter(e.target.value); setTicketPage(1); }}
                  className="text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
                >
                  <option value="ALL">All Categories</option>
                  <option value="payout">💰 Payout / Salary</option>
                  <option value="app_bug">🐛 App Bug</option>
                  <option value="customer">👤 Customer Behavior</option>
                  <option value="inventory">📦 Stock / Handover</option>
                  <option value="other">ℹ️ Other</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div className="flex items-center gap-1.5">
                <select
                  value={ticketPriorityFilter}
                  onChange={(e) => { setTicketPriorityFilter(e.target.value); setTicketPage(1); }}
                  className="text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="critical">🚨 Critical</option>
                  <option value="high">🔥 High</option>
                  <option value="medium">⚡ Medium</option>
                  <option value="low">🌱 Low</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <select
                  value={ticketStatusFilter}
                  onChange={(e) => { setTicketStatusFilter(e.target.value); setTicketPage(1); }}
                  className="text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Tickets Table ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">Ticket</th>
                    <th className="py-3.5 px-4">Delivery Partner</th>
                    <th className="py-3.5 px-4">Issue Details</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {ticketsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-emerald-600" />
                        Loading partner support tickets...
                      </td>
                    </tr>
                  ) : tickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                        No support tickets found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    tickets.map((t) => (
                      <tr key={t.ticket_id} className="hover:bg-slate-50/50 transition">
                        {/* Ticket & Category */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">#{t.ticket_id}</div>
                          <div className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                            {getCategoryLabel(t.category)}
                          </div>
                          <div className="text-[10.5px] text-slate-400 mt-0.5">
                            {new Date(t.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>

                        {/* Partner Info */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{t.partner_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">ID: {t.user_id}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-slate-700 font-medium">{t.partner_phone}</span>
                            {t.partner_phone && (
                              <>
                                <a
                                  href={`tel:${t.partner_phone}`}
                                  title="Call Partner"
                                  className="p-1 rounded bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-600 transition"
                                >
                                  <Phone size={11} />
                                </a>
                                <a
                                  href={`https://wa.me/91${t.partner_phone.replace(/[^0-9]/g, "")}?text=Hi%20${encodeURIComponent(t.partner_name)},%20regarding%20your%20support%20ticket%20%23${t.ticket_id}:%20`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="WhatsApp Partner"
                                  className="p-1 rounded bg-emerald-50 hover:bg-emerald-200 text-emerald-700 transition"
                                >
                                  <MessageSquare size={11} />
                                </a>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Issue Details */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-bold text-slate-900 truncate">{t.subject}</div>
                          {t.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{t.description}</p>
                          )}
                          {t.attachments && t.attachments.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {t.attachments.map((url, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setPreviewImage(url.startsWith("http") ? url : `/${url}`)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10.5px] font-semibold border border-emerald-200 transition"
                                >
                                  <ImageIcon size={11} /> Photo {idx + 1}
                                </button>
                              ))}
                            </div>
                          )}
                          {t.admin_notes && (
                            <div className="mt-1 text-[10.5px] bg-slate-100 border border-slate-200 rounded px-2 py-0.5 text-slate-700 truncate">
                              Admin Note: {t.admin_notes}
                            </div>
                          )}
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-4">{getPriorityBadge(t.priority)}</td>

                        {/* Status */}
                        <td className="py-3.5 px-4">{getTicketStatusBadge(t.status)}</td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedTicket(t);
                                setTicketNotesInput(t.admin_notes || "");
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition inline-flex items-center gap-1"
                            >
                              <Eye size={12} /> View &amp; Resolve
                            </button>
                            <button
                              onClick={() => handleDeleteTicket(t.ticket_id)}
                              title="Delete Ticket"
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

            {/* Pagination */}
            {ticketTotalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-100 text-xs text-slate-500">
                <div>
                  Page {ticketPage} of {ticketTotalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={ticketPage <= 1}
                    onClick={() => setTicketPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={ticketPage >= ticketTotalPages}
                    onClick={() => setTicketPage((p) => Math.min(ticketTotalPages, p + 1))}
                    className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2: ONBOARDING INQUIRIES
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "inquiries" && (
        <div className="space-y-6">
          {/* Stat Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div
              onClick={() => { setRequestStatusFilter("ALL"); setRequestPage(1); }}
              className={`cursor-pointer p-4 rounded-xl border transition ${
                requestStatusFilter === "ALL" ? "bg-slate-900 text-white border-slate-900 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${requestStatusFilter === "ALL" ? "text-slate-300" : "text-slate-500"}`}>
                Total Inquiries
              </p>
              <p className="text-2xl font-black mt-1">{requestSummary.total || 0}</p>
            </div>

            <div
              onClick={() => { setRequestStatusFilter("PENDING"); setRequestPage(1); }}
              className={`cursor-pointer p-4 rounded-xl border transition ${
                requestStatusFilter === "PENDING" ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400" : "bg-white border-slate-200 hover:border-amber-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Pending Review</p>
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
              </div>
              <p className="text-2xl font-black text-amber-900 mt-1">{requestSummary.pending || 0}</p>
            </div>

            <div
              onClick={() => { setRequestStatusFilter("CONTACTED"); setRequestPage(1); }}
              className={`cursor-pointer p-4 rounded-xl border transition ${
                requestStatusFilter === "CONTACTED" ? "bg-blue-50 border-blue-300 ring-2 ring-blue-400" : "bg-white border-slate-200 hover:border-blue-200"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Contacted</p>
              <p className="text-2xl font-black text-blue-900 mt-1">{requestSummary.contacted || 0}</p>
            </div>

            <div
              onClick={() => { setRequestStatusFilter("APPROVED"); setRequestPage(1); }}
              className={`cursor-pointer p-4 rounded-xl border transition ${
                requestStatusFilter === "APPROVED" ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400" : "bg-white border-slate-200 hover:border-emerald-200"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Approved</p>
              <p className="text-2xl font-black text-emerald-900 mt-1">{requestSummary.approved || 0}</p>
            </div>

            <div
              onClick={() => { setRequestStatusFilter("REJECTED"); setRequestPage(1); }}
              className={`cursor-pointer p-4 rounded-xl border transition ${
                requestStatusFilter === "REJECTED" ? "bg-rose-50 border-rose-300 ring-2 ring-rose-400" : "bg-white border-slate-200 hover:border-rose-200"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Rejected</p>
              <p className="text-2xl font-black text-rose-900 mt-1">{requestSummary.rejected || 0}</p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, phone, area..."
                value={requestSearch}
                onChange={(e) => { setRequestSearch(e.target.value); setRequestPage(1); }}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter size={14} className="text-slate-400" />
                <select
                  value={requestStatusFilter}
                  onChange={(e) => { setRequestStatusFilter(e.target.value); setRequestPage(1); }}
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
                  onChange={(e) => { setShiftFilter(e.target.value); setRequestPage(1); }}
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

          {/* Inquiries Table */}
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
                  {requestsLoading ? (
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

                        <td className="py-3.5 px-4">{getRequestStatusBadge(r.status)}</td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.status === "PENDING" && (
                              <button
                                onClick={() => handleUpdateRequestStatus(r.id, "CONTACTED")}
                                disabled={updatingRequestId === r.id}
                                title="Mark as Contacted"
                                className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition"
                              >
                                Contacted
                              </button>
                            )}
                            {r.status !== "APPROVED" && (
                              <button
                                onClick={() => handleUpdateRequestStatus(r.id, "APPROVED")}
                                disabled={updatingRequestId === r.id}
                                title="Approve Candidate"
                                className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition"
                              >
                                Approve
                              </button>
                            )}
                            {r.status !== "REJECTED" && (
                              <button
                                onClick={() => handleUpdateRequestStatus(r.id, "REJECTED")}
                                disabled={updatingRequestId === r.id}
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
                              onClick={() => handleDeleteRequest(r.id, r.full_name)}
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

            {/* Pagination */}
            {requestTotalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-100 text-xs text-slate-500">
                <div>
                  Page {requestPage} of {requestTotalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={requestPage <= 1}
                    onClick={() => setRequestPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={requestPage >= requestTotalPages}
                    onClick={() => setRequestPage((p) => Math.min(requestTotalPages, p + 1))}
                    className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TICKET DETAILS & RESOLUTION MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 space-y-6 my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                    #{selectedTicket.ticket_id}
                  </span>
                  {getTicketStatusBadge(selectedTicket.status)}
                  {getPriorityBadge(selectedTicket.priority)}
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-2">{selectedTicket.subject}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Raised on {new Date(selectedTicket.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Partner Info Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Delivery Partner</span>
                <h4 className="font-bold text-slate-900 text-sm mt-0.5">{selectedTicket.partner_name}</h4>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Partner ID: <span className="font-semibold text-slate-800">{selectedTicket.user_id}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${selectedTicket.partner_phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition shadow-sm"
                >
                  <Phone size={13} className="text-emerald-600" />
                  {selectedTicket.partner_phone || "No Phone"}
                </a>
                {selectedTicket.partner_phone && (
                  <a
                    href={`https://wa.me/91${selectedTicket.partner_phone.replace(/[^0-9]/g, "")}?text=Hi%20${encodeURIComponent(selectedTicket.partner_name)},%20regarding%20your%20support%20ticket%20%23${selectedTicket.ticket_id}:%20`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition shadow-sm"
                  >
                    <MessageSquare size={13} />
                    WhatsApp
                  </a>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Issue Description
              </label>
              <div className="bg-slate-50/75 border border-slate-200 rounded-2xl p-4 text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {selectedTicket.description || "No detailed description provided by partner."}
              </div>
            </div>

            {/* Attachments */}
            {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Photo Proof &amp; Attachments ({selectedTicket.attachments.length})
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedTicket.attachments.map((url, idx) => {
                    const fullUrl = url.startsWith("http") ? url : `/${url}`;
                    return (
                      <div
                        key={idx}
                        onClick={() => setPreviewImage(fullUrl)}
                        className="group relative cursor-pointer rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video hover:ring-2 hover:ring-emerald-500 transition"
                      >
                        <img src={fullUrl} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                          <Eye size={20} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Admin Resolution Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Resolution &amp; Internal Notes
              </label>
              <textarea
                rows={3}
                value={ticketNotesInput}
                onChange={(e) => setTicketNotesInput(e.target.value)}
                placeholder="e.g. Reviewed shift payout discrepancy, credited ₹250 manual adjustment into partner settlement ledger..."
                className="w-full text-xs sm:text-sm rounded-2xl border border-slate-200 p-3.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Quick Status Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {selectedTicket.status !== "in_progress" && (
                  <button
                    onClick={() => handleUpdateTicketStatus(selectedTicket.ticket_id, "in_progress", ticketNotesInput)}
                    disabled={updatingTicketId === selectedTicket.ticket_id}
                    className="px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
                  >
                    Mark In Progress
                  </button>
                )}
                {selectedTicket.status !== "resolved" && (
                  <button
                    onClick={() => handleUpdateTicketStatus(selectedTicket.ticket_id, "resolved", ticketNotesInput)}
                    disabled={updatingTicketId === selectedTicket.ticket_id}
                    className="px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition inline-flex items-center gap-1.5"
                  >
                    <Check size={14} /> Mark Resolved
                  </button>
                )}
                {selectedTicket.status !== "closed" && (
                  <button
                    onClick={() => handleUpdateTicketStatus(selectedTicket.ticket_id, "closed", ticketNotesInput)}
                    disabled={updatingTicketId === selectedTicket.ticket_id}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    Close Ticket
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleUpdateTicketStatus(selectedTicket.ticket_id, selectedTicket.status, ticketNotesInput)}
                  disabled={updatingTicketId === selectedTicket.ticket_id}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-sm"
                >
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          IMAGE PREVIEW LIGHTBOX
      ══════════════════════════════════════════════════════════════════════ */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/20 hover:bg-white/40 text-white transition backdrop-blur-md"
            >
              <X size={20} />
            </button>
            <img
              src={previewImage}
              alt="Attachment Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONBOARDING NOTES MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Admin Notes for {notesModal.name}</h3>
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
                onClick={() => handleUpdateRequestStatus(notesModal.id, notesModal.status, notesModal.notes)}
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
