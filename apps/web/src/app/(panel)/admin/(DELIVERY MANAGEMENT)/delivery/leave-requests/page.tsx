// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Executive Leave Requests Command Center with instant approval workflow
//
// ============================================================================

'use client';

import { getApiBaseUrl } from '@/lib/api-config';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '@/services/api.client';
import {
  CalendarDays,
  ChevronRight,
  Home,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  Search,
  Table as TableIcon,
  LayoutGrid,
  Loader2,
  FileText,
  User,
  Plus,
  Edit2,
  X,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { showSuccessToast } from '@/components/Toast';
import SkeletonForm from '@/components/Table Generator/SkeletonForm';

export interface LeaveRequestItem {
  id: string | number;
  delivery_partner_id?: string;
  partner_name?: string;
  partner_phone?: string;
  leave_date?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  leave_type?: string;
  status?: string;
  admin_remarks?: string;
  created_at?: string;
}

function normalizeLeaveStatus(stRaw?: string): 'PENDING' | 'APPROVED' | 'REJECTED' {
  if (!stRaw) return 'PENDING';
  const str = stRaw.trim().toUpperCase();
  if (str.includes('APPROV')) return 'APPROVED';
  if (str.includes('REJECT')) return 'REJECTED';
  return 'PENDING';
}

function getStatusBadge(stRaw?: string) {
  const norm = normalizeLeaveStatus(stRaw);
  if (norm === 'APPROVED') {
    return { label: 'Approved', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 };
  }
  if (norm === 'REJECTED') {
    return { label: 'Rejected', bg: 'bg-rose-50 text-rose-800 border-rose-200', icon: XCircle };
  }
  return { label: 'Pending Review', bg: 'bg-amber-50 text-amber-800 border-amber-300', icon: Clock };
}

export default function LeaveRequestsPage() {
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modal / Action states
  const [actionTarget, setActionTarget] = useState<{ item: LeaveRequestItem; targetStatus: 'APPROVED' | 'REJECTED' } | null>(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Add / Edit form via SkeletonForm
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRequestForEdit, setSelectedRequestForEdit] = useState<LeaveRequestItem | null>(null);

  const fetchLeaveRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/admin/delivery/leave-requests');
      if (res?.data?.data && Array.isArray(res.data.data)) {
        setRequests(res.data.data);
      } else if (Array.isArray(res.data)) {
        setRequests(res.data);
      } else {
        setRequests([]);
      }
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests]);

  // Compute Metrics Summary
  const metrics = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => normalizeLeaveStatus(r.status) === 'PENDING').length;
    const approved = requests.filter((r) => normalizeLeaveStatus(r.status) === 'APPROVED').length;
    const rejected = requests.filter((r) => normalizeLeaveStatus(r.status) === 'REJECTED').length;

    return { total, pending, approved, rejected };
  }, [requests]);

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return requests.filter((item) => {
      const norm = normalizeLeaveStatus(item.status);
      if (statusFilter !== 'ALL' && norm !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = String(item.partner_name || '').toLowerCase();
        const phone = String(item.partner_phone || '').toLowerCase();
        const reason = String(item.reason || item.leave_type || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !reason.includes(q)) return false;
      }

      return true;
    });
  }, [requests, searchQuery, statusFilter]);

  // Handle Quick Status Change
  const handleConfirmStatusChange = async () => {
    if (!actionTarget) return;
    setSubmittingAction(true);
    try {
      const { item, targetStatus } = actionTarget;
      const apiStatus = targetStatus === 'APPROVED' ? 'approved' : 'rejected';
      
      const res = await api.patch<any>(`/admin/delivery/leave-requests/${item.id}/status`, {
        status: apiStatus,
        admin_remarks: adminRemarks.trim() || undefined,
      });

      if (res?.data?.success || res?.status === 200 || res?.data) {
        showSuccessToast(`Leave request marked as ${targetStatus}`);
        setActionTarget(null);
        setAdminRemarks('');
        fetchLeaveRequests();
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update leave request status');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="pt-6 md:pt-8 px-4 md:px-7 pb-10 space-y-6 font-sans min-h-screen bg-slate-50/60">
      
      {/* ── Breadcrumb & Top Action Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-5 md:p-6 rounded-2xl border border-gray-200/80 shadow-2xs">
        <div>
          <nav className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100/90 rounded-lg border border-slate-200/70 text-xs text-slate-500 mb-2 font-medium" aria-label="Breadcrumb">
            <Link href="/admin/dashboard" className="inline-flex items-center gap-1 hover:text-emerald-700 transition-colors font-semibold text-slate-600">
              <Home size={13} className="text-emerald-600" /> Dashboard
            </Link>
            <ChevronRight size={13} className="text-slate-400" />
            <span className="text-slate-500 font-medium">Delivery Operations</span>
            <ChevronRight size={13} className="text-slate-400" />
            <span className="font-bold text-emerald-800">Leave Requests</span>
          </nav>

          <div className="mt-1 flex items-center gap-2">
            <CalendarDays size={22} className="text-emerald-600" />
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Delivery Leave Requests</h1>
            <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              {metrics.total} Applications
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchLeaveRequests}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 bg-white text-slate-800 text-xs font-bold rounded-xl border border-gray-200 shadow-2xs hover:border-emerald-500 hover:text-emerald-700 transition-colors"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Executive Summary Metrics Bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Applications */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <FileText size={15} className="text-emerald-600" /> Total Applications
            </span>
            <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200 font-mono">
              All
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 pt-1">{metrics.total}</p>
          <p className="text-[11px] text-gray-500 font-medium">Recorded leave requests</p>
        </div>

        {/* Pending Review */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-amber-800 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Clock size={15} className="text-amber-600" /> Pending Review
            </span>
            <span className="text-[11px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Action Needed
            </span>
          </div>
          <p className="text-2xl font-extrabold text-amber-700 pt-1">{metrics.pending}</p>
          <p className="text-[11px] text-gray-500 font-medium">Awaiting admin review</p>
        </div>

        {/* Approved Absences */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-600" /> Approved Absences
            </span>
            <span className="text-[11px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
              Approved
            </span>
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 pt-1">{metrics.approved}</p>
          <p className="text-[11px] text-gray-500 font-medium">Orders auto-unassigned</p>
        </div>

        {/* Rejected Applications */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-rose-800 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <XCircle size={15} className="text-rose-600" /> Rejected Applications
            </span>
            <span className="text-[11px] bg-rose-50 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200 font-bold">
              Rejected
            </span>
          </div>
          <p className="text-2xl font-extrabold text-rose-700 pt-1">{metrics.rejected}</p>
          <p className="text-[11px] text-gray-500 font-medium">Applications turned down</p>
        </div>
      </div>

      {/* ── Filter & Control Bar ── */}
      <div className="bg-white rounded-2xl p-3 border border-gray-200/90 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: View Mode Switcher & Status Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* View Switcher */}
          <div className="inline-flex h-9 rounded-xl bg-gray-100/90 p-1 border border-gray-200/80 items-center">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-emerald-800 shadow-2xs border border-gray-200 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TableIcon size={14} /> Executive Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-emerald-800 shadow-2xs border border-gray-200 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid size={14} /> Cards Grid
            </button>
          </div>

          {/* Status Tabs */}
          <div className="inline-flex h-9 rounded-xl bg-gray-100/90 p-1 border border-gray-200/80 items-center">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`h-7 px-3 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === st
                    ? 'bg-emerald-700 text-white shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {st === 'ALL' ? 'All Status' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search Box */}
        <div className="relative w-full md:w-72 h-9">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Partner Name, Phone, Reason..."
            className="w-full h-9 pl-9 pr-3 bg-gray-50 text-xs font-medium text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-all"
          />
        </div>
      </div>

      {/* ── Main View Section ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="text-emerald-600 animate-spin" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 text-slate-400 space-y-2">
          <CalendarDays size={40} className="mx-auto text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No leave requests found</p>
          <p className="text-xs text-slate-400">There are currently no records matching your query.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* Formal Executive Table View */
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-700 uppercase text-[10px] font-bold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3.5">Delivery Partner</th>
                  <th className="px-4 py-3.5">Leave Period</th>
                  <th className="px-4 py-3.5">Reason / Type</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5">Admin Remarks</th>
                  <th className="px-4 py-3.5 text-right">Approval Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium">
                {filteredRequests.map((item) => {
                  const normStatus = normalizeLeaveStatus(item.status);
                  const badge = getStatusBadge(item.status);
                  const StatusIcon = badge.icon;
                  const initial = (item.partner_name || 'D')[0].toUpperCase();
                  const leaveDateStr = item.leave_date
                    ? new Date(item.leave_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : item.start_date
                    ? new Date(item.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'Date N/A';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 font-extrabold flex items-center justify-center text-xs text-white shadow-2xs">
                            {initial}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900">{item.partner_name || 'Delivery Partner'}</p>
                            <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                              <Phone size={10} className="text-slate-400" /> {item.partner_phone || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-800 font-bold">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays size={13} className="text-emerald-600" />
                          <span>{leaveDateStr}</span>
                          {item.end_date && item.end_date !== item.leave_date && (
                            <span className="text-slate-500 font-normal">
                              ➔ {new Date(item.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                        <span className="font-semibold text-slate-900 block truncate">
                          {item.reason || item.leave_type || 'Personal Leave'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border ${badge.bg}`}>
                          <StatusIcon size={12} />
                          {badge.label}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-500 text-[11px] max-w-xs truncate">
                        {item.admin_remarks || '-'}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {normStatus === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setActionTarget({ item, targetStatus: 'APPROVED' })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors shadow-2xs"
                              >
                                <CheckCircle2 size={12} /> Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => setActionTarget({ item, targetStatus: 'REJECTED' })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white font-bold text-[11px] transition-colors shadow-2xs"
                              >
                                <XCircle size={12} /> Reject
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedRequestForEdit(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-[11px] transition-colors border border-slate-200"
                            title="Edit Record"
                          >
                            <Edit2 size={11} /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Executive Grid Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((item) => {
            const normStatus = normalizeLeaveStatus(item.status);
            const badge = getStatusBadge(item.status);
            const StatusIcon = badge.icon;
            const initial = (item.partner_name || 'D')[0].toUpperCase();

            return (
              <div key={item.id} className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 font-extrabold flex items-center justify-center text-xs text-white shadow-2xs">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 truncate">{item.partner_name || 'Delivery Partner'}</p>
                        <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 truncate mt-0.5">
                          <Phone size={10} className="text-slate-400" /> {item.partner_phone || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
                      <StatusIcon size={11} /> {badge.label}
                    </span>
                  </div>

                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="text-slate-400 font-medium">Leave Date:</span>
                      <span className="font-extrabold text-slate-900">{item.leave_date || item.start_date || 'N/A'}</span>
                    </div>
                    <div className="text-slate-600 pt-1 border-t border-slate-200/60">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Reason:</span>
                      <p className="text-xs font-semibold text-slate-800 mt-0.5 leading-snug">{item.reason || item.leave_type || 'Personal Leave'}</p>
                    </div>
                    {item.admin_remarks && (
                      <div className="text-slate-500 text-[11px] pt-1">
                        <span className="font-bold text-slate-400">Admin Remarks:</span> {item.admin_remarks}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  {normStatus === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setActionTarget({ item, targetStatus: 'APPROVED' })}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                      >
                        <CheckCircle2 size={13} /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setActionTarget({ item, targetStatus: 'REJECTED' })}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                      >
                        <XCircle size={13} /> Reject
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedRequestForEdit(item)}
                    className="py-1.5 px-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs border border-slate-200"
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Status Change Confirmation Modal ── */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${actionTarget.targetStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  <Sparkles size={18} />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {actionTarget.targetStatus === 'APPROVED' ? 'Approve Leave Request' : 'Reject Leave Request'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActionTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <p>
                Partner: <strong className="text-slate-900">{actionTarget.item.partner_name || 'Delivery Partner'}</strong>
              </p>
              <p>
                Leave Date: <strong className="text-slate-900">{actionTarget.item.leave_date || actionTarget.item.start_date || 'N/A'}</strong>
              </p>
              {actionTarget.targetStatus === 'APPROVED' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-semibold flex items-start gap-2 mt-2">
                  <AlertCircle size={15} className="shrink-0 text-emerald-600 mt-0.5" />
                  <span>Approving this request will automatically unassign any active orders for this partner during their leave window.</span>
                </div>
              )}
            </div>

            {/* Optional Admin Remarks */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Admin Remarks (Optional)</label>
              <textarea
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                placeholder="Enter remarks for the partner..."
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActionTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleConfirmStatusChange}
                className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors ${
                  actionTarget.targetStatus === 'APPROVED' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submittingAction && <Loader2 size={14} className="animate-spin" />}
                <span>Confirm {actionTarget.targetStatus === 'APPROVED' ? 'Approval' : 'Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Partner Leave Form via SkeletonForm */}
      <SkeletonForm
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        apiEndpoint="/admin/delivery/leave-requests/showAdd"
        submitEndpoint="/admin/delivery/leave-requests"
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchLeaveRequests();
        }}
      />

      {/* Edit Partner Leave Form via SkeletonForm */}
      {selectedRequestForEdit && (
        <SkeletonForm
          isOpen={Boolean(selectedRequestForEdit)}
          onClose={() => setSelectedRequestForEdit(null)}
          apiEndpoint={`/admin/delivery/leave-requests/${selectedRequestForEdit.id}/showEdit`}
          submitEndpoint={`/admin/delivery/leave-requests/${selectedRequestForEdit.id}/saveEdit`}
          onSuccess={() => {
            setSelectedRequestForEdit(null);
            fetchLeaveRequests();
          }}
        />
      )}
    </div>
  );
}
