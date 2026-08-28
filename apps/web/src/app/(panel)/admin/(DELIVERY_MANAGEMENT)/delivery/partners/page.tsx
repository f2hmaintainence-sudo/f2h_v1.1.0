// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Formal Executive Fleet Management UI for Delivery Partners
//
// ============================================================================

"use client";

import { getApiBaseUrl } from "@/lib/api-config";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/services/api.client";
import {
  Truck, Users, ChevronRight, ChevronLeft, Home, RefreshCw, CheckCircle2, XCircle, MapPin,
  Phone, ShieldCheck, ShieldAlert, Eye, Loader2, Edit2, X, Search, LayoutGrid, Table as TableIcon,
  Activity, Award, UserCheck, UserX, FileText
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";
import "@/components/Table Generator/SkeletonForm.css";
import SkeletonForm from "@/components/Table Generator/SkeletonForm";

// --- Helpers ---
const getImageUrl = (pathString?: string): string | null => {
  if (!pathString) return null;
  if (pathString.startsWith("http")) return pathString;
  const baseUrl = getApiBaseUrl();
  return `${baseUrl.replace(/\/$/, "")}/${pathString.replace(/^\//, "")}`;
};

const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const el = e.currentTarget;
  el.style.display = "none";
  if (el.parentElement && !el.parentElement.querySelector(".img-error-badge")) {
    const div = document.createElement("div");
    div.className = "img-error-badge absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 bg-slate-50 font-medium p-1 text-center";
    div.innerText = "Document Not Found";
    el.parentElement.appendChild(div);
  }
};

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="bg-slate-50/80 rounded-lg py-1.5 px-2.5 border border-slate-100 flex items-center justify-between truncate text-[11px]">
    <span className="text-slate-400 font-medium mr-1.5">{label}</span>
    <span className="font-bold text-slate-700 truncate">{value || "N/A"}</span>
  </div>
);

const DocPreviewBox = ({ url, title, label, onPreview }: { url?: string; title: string; label: string; onPreview: (u: string, t: string) => void }) =>
  url ? (
    <div onClick={() => onPreview(getImageUrl(url)!, title)} className="block relative group bg-slate-100 rounded-lg overflow-hidden h-24 border border-slate-200 flex items-center justify-center shadow-inner cursor-pointer">
      <img src={getImageUrl(url)!} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" onError={handleImageError} />
      <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold gap-1"><Eye size={12} /> {label}</span>
    </div>
  ) : (
    <div className="h-24 bg-slate-50 rounded-lg flex items-center justify-center text-[10px] text-slate-400 border border-slate-100">No {label}</div>
  );

const VerifyActionButtons = ({ status, onVerify }: { status?: string; onVerify: (status: "verified" | "rejected") => void }) => (
  <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
    <button type="button" onClick={() => onVerify("verified")} className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${status === "verified" ? "bg-emerald-600 text-white ring-2 ring-emerald-600/30" : "bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200/80 hover:border-emerald-200"}`}>
      <CheckCircle2 size={15} className={status === "verified" ? "text-white" : "text-emerald-600"} />
      <span>{status === "verified" ? "Approved" : "Approve"}</span>
    </button>
    <button type="button" onClick={() => onVerify("rejected")} className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${status === "rejected" ? "bg-rose-600 text-white ring-2 ring-rose-600/30" : "bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200/80 hover:border-rose-200"}`}>
      <XCircle size={15} className={status === "rejected" ? "text-white" : "text-rose-600"} />
      <span>Not Approved</span>
    </button>
  </div>
);

// --- Memoized Partner Card ---
const PartnerCard = React.memo(({ partner: p, leaveInfo, onOpenEditModal, onOpenDocsModal }: { partner: any; leaveInfo: any; onOpenEditModal: (p: any) => void; onOpenDocsModal: (p: any) => void }) => {
  const isHalfDay = leaveInfo?.leave_type === 'half_day';
  const shift = leaveInfo?.half_day_shift;
  const shiftLabel = shift ? (shift.charAt(0).toUpperCase() + shift.slice(1)) : '';
  const pillLabel = isHalfDay ? `Leave (${shiftLabel || 'Shift'})` : 'On Leave';

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group/card">
      <div>
        <div className="flex items-start justify-between gap-2.5">
          <Link href={`/admin/delivery/partners/${p.delivery_partner_id || p.id}`} className="flex items-center gap-3 min-w-0 group/link cursor-pointer">
            <div className={`w-10 h-10 shrink-0 rounded-xl font-extrabold flex items-center justify-center text-xs text-white shadow-2xs ${p.is_active ? "bg-gradient-to-br from-emerald-600 to-teal-700" : "bg-slate-400"}`}>
              {(p.full_name || "D")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900 truncate group-hover/link:text-emerald-700 transition-colors">{p.full_name || "Delivery Partner"}</p>
              <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1 truncate mt-0.5"><MapPin size={11} className="shrink-0 text-slate-400" /><span className="truncate">{p.branch_name || p.branch_id || "Main Hub"}</span></p>
            </div>
          </Link>
          <button type="button" onClick={() => onOpenEditModal(p)} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-600 hover:text-white font-bold text-[11px] transition-colors shadow-2xs" title="Edit Partner Profile">
            <Edit2 size={11} /><span>Edit</span>
          </button>
        </div>

        <div className="bg-slate-50/80 rounded-xl p-3 my-3 border border-slate-100 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 min-w-0 truncate"><Phone size={12} className="text-slate-400 shrink-0" /><span className="truncate">{p.phone || "N/A"}</span></div>
            <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${leaveInfo ? "bg-amber-50 text-amber-800 border border-amber-200" : p.is_online ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-slate-200/80 text-slate-600 border border-slate-300"}`}>
              {leaveInfo ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>{pillLabel}</span>
                </>
              ) : (
                <>
                  {p.is_online && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  <span>{p.is_online ? "Online" : "Offline"}</span>
                </>
              )}
            </span>
          </div>
        <div>
          <button type="button" onClick={() => onOpenDocsModal(p)} className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all border ${p.is_verified ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-2xs" : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-2xs animate-pulse"}`}>
            {p.is_verified ? <ShieldCheck size={13} className="text-emerald-600 shrink-0" /> : <ShieldAlert size={13} className="text-amber-600 shrink-0" />}
            <span className="truncate">{p.is_verified ? "Verified Docs" : "Review Docs"}</span>
          </button>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="flex flex-col items-center justify-center py-2 px-2 rounded-xl bg-slate-50 border border-slate-100"><span className="text-sm font-extrabold text-slate-900">{p.today_assigned ?? 0}</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Assigned</span></div>
      <div className="flex flex-col items-center justify-center py-2 px-2 rounded-xl bg-emerald-50/70 border border-emerald-200/50"><span className="text-sm font-extrabold text-emerald-700">{p.today_delivered ?? 0}</span><span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mt-0.5">Delivered</span></div>
    </div>
  </div>
)
});
PartnerCard.displayName = "PartnerCard";

// --- Memoized KYC Sub-Cards ---
const BankCard = React.memo(({ bank, onPreview, onVerify }: { bank: any; onPreview: (img: string, t: string) => void; onVerify: (id: number, s: "verified" | "rejected") => void }) => (
  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3.5">
    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase bg-teal-50 text-teal-700 border border-teal-100">BANK ACCOUNT • {bank.bank_name || "BANK"}</span>
        {bank.is_primary && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-600 border border-blue-100">Primary</span>}
      </div>
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${bank.verification_status === "verified" ? "bg-emerald-100 text-emerald-700" : bank.verification_status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{bank.verification_status || "pending"}</span>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
      <div className="lg:col-span-8 grid grid-cols-2 gap-2.5">
        <InfoRow label="Bank Name:" value={bank.bank_name} />
        <InfoRow label="Holder Name:" value={bank.account_holder_name} />
        <InfoRow label="Account No:" value={bank.account_number} />
        <InfoRow label="IFSC & Branch:" value={`${bank.ifsc_code || "NA"} ${bank.branch_name ? `(${bank.branch_name})` : ""}`} />
      </div>
      <div className="lg:col-span-4"><DocPreviewBox url={bank.cancelled_cheque_image} title="Cancelled Cheque" label="Cheque" onPreview={onPreview} /></div>
    </div>
    <VerifyActionButtons status={bank.verification_status} onVerify={(s) => onVerify(bank.id, s)} />
  </div>
));
BankCard.displayName = "BankCard";

const DocumentCard = React.memo(({ doc, onPreview, onVerify }: { doc: any; onPreview: (img: string, t: string) => void; onVerify: (id: number, s: "verified" | "rejected") => void }) => (
  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
    <div className="flex items-start justify-between">
      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">{doc.document_type || "Document"}</span>
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${doc.verification_status === "verified" ? "bg-emerald-100 text-emerald-700" : doc.verification_status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{doc.verification_status || "pending"}</span>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <InfoRow label="Doc ID:" value={doc.document_number} />
      <InfoRow label="Uploaded:" value={doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "N/A"} />
    </div>
    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
      <DocPreviewBox url={doc.front_image} title={`${doc.document_type || "ID"} (Front)`} label="Front" onPreview={onPreview} />
      <DocPreviewBox url={doc.back_image} title={`${doc.document_type || "ID"} (Back)`} label="Back" onPreview={onPreview} />
    </div>
    <VerifyActionButtons status={doc.verification_status} onVerify={(s) => onVerify(doc.id, s)} />
  </div>
));
DocumentCard.displayName = "DocumentCard";

const VehicleCard = React.memo(({ veh, onPreview, onVerify }: { veh: any; onPreview: (img: string, t: string) => void; onVerify: (id: number, s: "verified" | "rejected") => void }) => (
  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3.5">
    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-100">VEHICLE • {veh.vehicle_type || "BIKE"}</span>
        {veh.registration_number && <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">{veh.registration_number}</span>}
      </div>
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${veh.verification_status === "verified" ? "bg-emerald-100 text-emerald-700" : veh.verification_status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{veh.verification_status || "pending"}</span>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
      <div className="lg:col-span-6 grid grid-cols-2 gap-2.5">
        <InfoRow label="Vehicle:" value={`${veh.brand || ""} ${veh.model || ""} ${veh.color ? `(${veh.color})` : ""}`} />
        <InfoRow label="Reg No:" value={veh.registration_number} />
        <InfoRow label="Insurance No:" value={veh.insurance_number} />
        <InfoRow label="Expiry Date:" value={veh.insurance_expiry ? veh.insurance_expiry.toString().split("T")[0] : "N/A"} />
      </div>
      <div className="lg:col-span-6 grid grid-cols-3 gap-2">
        <DocPreviewBox url={veh.rc_front_image} title={`${veh.vehicle_type || "Vehicle"} RC (Front)`} label="RC Front" onPreview={onPreview} />
        <DocPreviewBox url={veh.rc_back_image} title={`${veh.vehicle_type || "Vehicle"} RC (Back)`} label="RC Back" onPreview={onPreview} />
        <DocPreviewBox url={veh.insurance_image} title={`${veh.vehicle_type || "Vehicle"} Insurance Policy`} label="Insurance" onPreview={onPreview} />
      </div>
    </div>
    <VerifyActionButtons status={veh.verification_status} onVerify={(s) => onVerify(veh.id, s)} />
  </div>
));
VehicleCard.displayName = "VehicleCard";

// -----------------------------------------------------------------------------
// Main Formal Delivery Partners Page
// -----------------------------------------------------------------------------
export default function DeliveryPartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "on_leave">("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [verificationFilter, setVerificationFilter] = useState<"all" | "verified" | "pending">("all");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [branches, setBranches] = useState<any[]>([]);
  const [selectedPartnerForEdit, setSelectedPartnerForEdit] = useState<any | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  const [selectedPartnerForDocs, setSelectedPartnerForDocs] = useState<any | null>(null);
  const [docsModalVerifiedToggle, setDocsModalVerifiedToggle] = useState<boolean>(false);
  const [docsData, setDocsData] = useState<{ partner: any; documents: any[]; vehicles: any[]; bank_accounts?: any[] } | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const apiStatus = (filter !== "all" && filter !== "on_leave") ? filter : "";
      const qParams = new URLSearchParams();
      if (apiStatus) qParams.set('status', apiStatus);
      qParams.set('page', String(page));
      qParams.set('limit', String(pageSize));

      const [partnersRes, leavesRes] = await Promise.all([
        api.get<any>(`/admin/delivery/partners?${qParams.toString()}`),
        api.get<any>("/admin/delivery/leave-requests")
      ]);
      if (partnersRes.data?.data) { 
        setPartners(partnersRes.data.data); 
        setTotal(partnersRes.data.total ?? partnersRes.data.data.length); 
      }
      if (leavesRes.data?.data) {
        setLeaveRequests(leavesRes.data.data);
      } else if (Array.isArray(leavesRes.data)) {
        setLeaveRequests(leavesRes.data);
      }
    } catch { } finally { setLoading(false); }
  }, [filter, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filter, verificationFilter, searchQuery]);

  const getPartnerLeaveInfo = useCallback((partner: any) => {
    if (!partner) return null;
    
    // Offset local timezone to get the correct local YYYY-MM-DD
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    const todayStr = localDate.toISOString().split('T')[0];

    return leaveRequests.find((lr) => {
      const lrPartnerId = String(lr.delivery_partner_id || lr.partner_id || '').toLowerCase();
      const pId = String(partner.delivery_partner_id || partner.id || '').toLowerCase();
      const pUserId = String(partner.user_id || '').toLowerCase();

      // Check ID match or Fallback to phone matching
      const idMatch = lrPartnerId && (lrPartnerId === pId || lrPartnerId === pUserId);
      const phoneMatch = partner.phone && lr.partner_phone && String(partner.phone).trim() === String(lr.partner_phone).trim();
      
      if (!idMatch && !phoneMatch) return false;
      
      const status = String(lr.status || '').toUpperCase();
      if (!status.includes('APPROV')) return false;
      
      const startStr = lr.leave_date ? lr.leave_date.split('T')[0] : '';
      const endStr = lr.end_date ? lr.end_date.split('T')[0] : startStr;
      
      if (!startStr) return false;
      return todayStr >= startStr && todayStr <= endStr;
    }) || null;
  }, [leaveRequests]);

  useEffect(() => {
    fetchPartners();
    api.get<any>("/admin/zone/branches-list?all=true").then((res) => {
      if (res.data?.data) setBranches(res.data.data);
      else if (Array.isArray(res.data)) setBranches(res.data);
    }).catch(() => {
      api.get<any>("/admin/branches").then((res) => {
        if (res.data?.data) setBranches(res.data.data);
        else if (Array.isArray(res.data)) setBranches(res.data);
      }).catch(() => { });
    });
  }, [fetchPartners]);

  // Executive Fleet Metrics
  const metrics = useMemo(() => {
    const activeCount = partners.filter((p) => p.is_active).length;
    const verifiedCount = partners.filter((p) => p.is_verified).length;
    const totalDelivered = partners.reduce((sum, p) => sum + Number(p.today_delivered || 0), 0);
    const complianceRate = partners.length ? Math.round((verifiedCount / partners.length) * 100) : 100;

    return {
      total: partners.length,
      active: activeCount,
      inactive: partners.length - activeCount,
      verified: verifiedCount,
      complianceRate,
      totalDelivered,
    };
  }, [partners]);

  // Filtered partners
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      // 1. On Leave local filter
      if (filter === "on_leave") {
        const leave = getPartnerLeaveInfo(p);
        if (!leave) return false;
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = String(p.full_name || "").toLowerCase();
        const phone = String(p.phone || "").toLowerCase();
        const branch = String(p.branch_name || p.branch_id || "").toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !branch.includes(q)) return false;
      }

      // 3. Verification Filter
      if (verificationFilter === "verified" && !p.is_verified) return false;
      if (verificationFilter === "pending" && p.is_verified) return false;

      return true;
    });
  }, [partners, searchQuery, verificationFilter, filter, getPartnerLeaveInfo]);

  const handleOpenDocsModal = useCallback(async (partner: any) => {
    setSelectedPartnerForDocs(partner);
    setDocsModalVerifiedToggle(Boolean(partner.is_verified));
    setDocsLoading(true);
    setDocsData(null);
    const partnerId = partner.delivery_partner_id || partner.id;
    try {
      const res = await api.get<any>(`/admin/delivery/partners/${partnerId}/documents`);
      if (res?.data?.data) setDocsData(res.data.data);
    } catch {
      showSuccessToast("Failed to load documents");
    } finally { setDocsLoading(false); }
  }, []);

  const handlePreviewImage = useCallback((url: string, title: string) => setPreviewImage({ url, title }), []);

  const hasAnyUploadedProof = Boolean(
    docsData &&
    ((docsData.documents?.some((d: any) => d.front_image || d.back_image || d.document_number)) ||
      (docsData.vehicles?.some((v: any) => v.rc_front_image || v.rc_back_image || v.registration_number)) ||
      (docsData.bank_accounts?.some((b: any) => b.cancelled_cheque_image)))
  );

  const handleVerifyPartner = async (isVerified: boolean) => {
    if (!selectedPartnerForDocs) return;
    const partnerId = selectedPartnerForDocs.delivery_partner_id || selectedPartnerForDocs.id;
    setVerifying(true);
    try {
      const res = await api.patch<any>(`/admin/delivery/partners/${partnerId}/verify`, { is_verified: isVerified });
      if (res?.data?.status || res?.status === 200 || res?.data) {
        setPartners((prev) => prev.map((p) => (p.delivery_partner_id || p.id) === partnerId ? { ...p, is_verified: isVerified } : p));
        showSuccessToast(`Partner marked as ${isVerified ? "Verified" : "Not Verified"}`);
        setSelectedPartnerForDocs(null);
      }
    } catch (error: any) {
      alert(error?.response?.data?.message || "Failed to update partner verification status");
    } finally { setVerifying(false); }
  };

  const handleVerifyDocItem = useCallback(async (docId: number, status: "verified" | "rejected") => {
    if (!selectedPartnerForDocs) return;
    const partnerId = selectedPartnerForDocs.delivery_partner_id || selectedPartnerForDocs.id;
    try {
      await api.patch<any>(`/admin/delivery/partners/${partnerId}/verify`, { document_id: docId, document_status: status });
      setDocsData((prev) => prev ? { ...prev, documents: prev.documents.map((d) => (d.id === docId ? { ...d, verification_status: status } : d)) } : null);
      showSuccessToast(`Document marked as ${status}`);
    } catch { alert("Failed to update document"); }
  }, [selectedPartnerForDocs]);

  const handleVerifyVehicleItem = useCallback(async (vehId: number, status: "verified" | "rejected") => {
    if (!selectedPartnerForDocs) return;
    const partnerId = selectedPartnerForDocs.delivery_partner_id || selectedPartnerForDocs.id;
    try {
      await api.patch<any>(`/admin/delivery/partners/${partnerId}/verify`, { vehicle_id: vehId, vehicle_status: status });
      setDocsData((prev) => prev ? { ...prev, vehicles: prev.vehicles.map((v) => (v.id === vehId ? { ...v, verification_status: status } : v)) } : null);
      showSuccessToast(`Vehicle marked as ${status}`);
    } catch { alert("Failed to update vehicle"); }
  }, [selectedPartnerForDocs]);

  const handleVerifyBankItem = useCallback(async (bankId: number, status: "verified" | "rejected") => {
    if (!selectedPartnerForDocs) return;
    const partnerId = selectedPartnerForDocs.delivery_partner_id || selectedPartnerForDocs.id;
    try {
      await api.patch<any>(`/admin/delivery/partners/${partnerId}/verify`, { bank_account_id: bankId, bank_status: status });
      setDocsData((prev) => prev ? { ...prev, bank_accounts: prev.bank_accounts?.map((b: any) => (b.id === bankId ? { ...b, verification_status: status } : b)) || [] } : null);
      showSuccessToast(`Bank Account marked as ${status}`);
    } catch { alert("Failed to update bank account"); }
  }, [selectedPartnerForDocs]);

  const handleOpenEditModal = useCallback((p: any) => {
    setSelectedPartnerForEdit(p);
  }, []);

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
            <span className="font-bold text-emerald-800">Delivery Fleet Partners</span>
          </nav>
          <div className="mt-1 flex items-center gap-2">
            <Truck size={22} className="text-emerald-600" />
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Delivery Fleet Partners</h1>
            <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
              {filteredPartners.length} Total Partners
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPartners}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 bg-white text-slate-800 text-xs font-bold rounded-xl border border-gray-200 shadow-2xs hover:border-emerald-500 hover:text-emerald-700 transition-colors"
          >
            <RefreshCw size={15} />
            Refresh Fleet
          </button>
        </div>
      </div>

      {/* ── Executive Fleet Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Total Fleet */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Users size={15} className="text-emerald-600" /> Registered Fleet
                </span>
                <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200 font-mono">
                  Total
                </span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 pt-1">{metrics.total}</p>
              <p className="text-[11px] text-gray-500 font-medium">All onboarded delivery personnel</p>
            </div>

            {/* Active On-Duty */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <UserCheck size={15} className="text-emerald-600" /> Active On-Duty
                </span>
                <span className="text-[11px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                </span>
              </div>
              <p className="text-2xl font-extrabold text-emerald-700 pt-1">{metrics.active}</p>
              <p className="text-[11px] text-gray-500 font-medium">Currently online for fulfillment</p>
            </div>

            {/* KYC Compliance Rate */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-teal-800 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-teal-600" /> KYC Compliance
                </span>
                <span className="text-[11px] bg-teal-50 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200 font-bold">
                  {metrics.complianceRate}% Rate
                </span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 pt-1">{metrics.verified} <span className="text-xs text-slate-400 font-normal">/ {metrics.total} verified</span></p>
              <p className="text-[11px] text-gray-500 font-medium">Identity & vehicle document verified</p>
            </div>

            {/* Today Completed Deliveries */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-sky-800 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Award size={15} className="text-sky-600" /> Today Deliveries
                </span>
                <span className="text-[11px] bg-sky-50 text-sky-800 px-2 py-0.5 rounded-full border border-sky-200 font-bold">
                  Completed
                </span>
              </div>
              <p className="text-2xl font-extrabold text-sky-700 pt-1">{metrics.totalDelivered}</p>
              <p className="text-[11px] text-gray-500 font-medium">Successfully delivered today</p>
            </div>
          </div>

          {/* ── Corporate Filter & View Mode Control Toolbar ── */}
          <div className="bg-white rounded-2xl p-3 border border-gray-200/90 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Left: View Mode Switcher & Status Filter */}
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              {/* View Switcher */}
              <div className="inline-flex h-9 rounded-xl bg-gray-100/90 p-1 border border-gray-200/80 items-center">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded-lg transition-all ${
                    viewMode === "table"
                      ? "bg-white text-emerald-800 shadow-2xs border border-gray-200 font-bold"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <TableIcon size={14} /> Executive Table
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded-lg transition-all ${
                    viewMode === "grid"
                      ? "bg-white text-emerald-800 shadow-2xs border border-gray-200 font-bold"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <LayoutGrid size={14} /> Cards Grid
                </button>
              </div>

              {/* Status Tabs */}
              <div className="inline-flex h-9 rounded-xl bg-gray-100/90 p-1 border border-gray-200/80 items-center">
                {(["all", "active", "inactive", "on_leave"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`h-7 px-3 text-xs font-semibold capitalize rounded-lg transition-all ${
                      filter === f
                        ? "bg-emerald-700 text-white shadow-2xs font-bold"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {f === "on_leave" ? "On Leave" : f}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Search Input & Verification Filter */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              {/* Search Box */}
              <div className="relative flex-1 md:w-64 h-9">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Partner Name, Phone, Hub..."
                  className="w-full h-9 pl-9 pr-3 bg-gray-50 text-xs font-medium text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-all"
                />
              </div>

              {/* Verification Dropdown */}
              <div className="inline-flex h-9 rounded-xl bg-gray-100/90 border border-gray-200 p-1 items-center">
                <button
                  type="button"
                  onClick={() => setVerificationFilter("all")}
                  className={`h-7 px-2.5 text-xs font-semibold rounded-lg transition-all ${
                    verificationFilter === "all" ? "bg-white text-slate-900 shadow-2xs font-bold border border-gray-200" : "text-gray-500"
                  }`}
                >
                  All Docs
                </button>
                <button
                  type="button"
                  onClick={() => setVerificationFilter("verified")}
                  className={`h-7 px-2.5 text-xs font-semibold rounded-lg transition-all ${
                    verificationFilter === "verified" ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs font-bold" : "text-emerald-700"
                  }`}
                >
                  Verified
                </button>
                <button
                  type="button"
                  onClick={() => setVerificationFilter("pending")}
                  className={`h-7 px-2.5 text-xs font-semibold rounded-lg transition-all ${
                    verificationFilter === "pending" ? "bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs font-bold" : "text-amber-700"
                  }`}
                >
                  Pending
                </button>
              </div>
            </div>
          </div>

          {/* ── Main View Container ── */}
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 size={32} className="text-emerald-600 animate-spin" /></div>
          ) : filteredPartners.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 text-slate-400 space-y-2">
              <Users size={40} className="mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No delivery partners found</p>
              <p className="text-xs text-slate-400">Try refining your search or filter parameters.</p>
            </div>
          ) : viewMode === "table" ? (
            /* Formal Corporate Executive Table View */
            <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 uppercase text-[10px] font-bold border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3.5">Delivery Partner</th>
                      <th className="px-4 py-3.5">Assigned Hub / Branch</th>
                      <th className="px-4 py-3.5 text-center">Shift Status</th>
                      <th className="px-4 py-3.5 text-center">KYC Verification</th>
                      <th className="px-4 py-3.5 text-center">Assigned Today</th>
                      <th className="px-4 py-3.5 text-center">Delivered Today</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium">
                    {filteredPartners.map((p) => {
                      const partnerId = p.delivery_partner_id || p.id;
                      const initial = (p.full_name || "D")[0].toUpperCase();

                      return (
                        <tr key={partnerId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/admin/delivery/partners/${partnerId}`} className="flex items-center gap-3 group/link">
                              <div className={`w-9 h-9 shrink-0 rounded-xl font-extrabold flex items-center justify-center text-xs text-white shadow-2xs ${p.is_active ? "bg-gradient-to-br from-emerald-600 to-teal-700" : "bg-slate-400"}`}>
                                {initial}
                              </div>
                              <div>
                                <p className="font-extrabold text-slate-900 group-hover/link:text-emerald-700 transition-colors">{p.full_name || "Delivery Partner"}</p>
                                <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                  <Phone size={10} className="text-slate-400" /> {p.phone || "N/A"}
                                </p>
                              </div>
                            </Link>
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            <div className="flex items-center gap-1 font-semibold">
                              <MapPin size={12} className="text-slate-400" />
                              <span>{p.branch_name || p.branch_id || "Main Hub"}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-center">
                            {(() => {
                              const leave = getPartnerLeaveInfo(p);
                              if (leave) {
                                const isHalfDay = leave.leave_type === 'half_day';
                                const shift = leave.half_day_shift;
                                const shiftLabel = shift ? (shift.charAt(0).toUpperCase() + shift.slice(1)) : '';
                                const pillLabel = isHalfDay ? `Leave (${shiftLabel || 'Shift'})` : 'On Leave';

                                return (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse animate-duration-1000">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    {pillLabel}
                                  </span>
                                );
                              }
                              return (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                  p.is_online ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}>
                                  {p.is_online && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                  {p.is_online ? "Online" : "Offline"}
                                </span>
                              );
                            })()}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenDocsModal(p)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                                p.is_verified
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 animate-pulse"
                              }`}
                            >
                              {p.is_verified ? <ShieldCheck size={13} className="text-emerald-600" /> : <ShieldAlert size={13} className="text-amber-600" />}
                              <span>{p.is_verified ? "Verified Docs" : "Review Docs"}</span>
                            </button>
                          </td>

                          <td className="px-4 py-3 text-center font-bold text-slate-900">
                            {p.today_assigned ?? 0}
                          </td>

                          <td className="px-4 py-3 text-center font-extrabold text-emerald-700">
                            {p.today_delivered ?? 0}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-600 hover:text-white font-bold text-[11px] transition-colors shadow-2xs"
                                title="Edit Partner Profile & Salary"
                              >
                                <Edit2 size={11} /> <span>Edit</span>
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
            /* Executive Cards Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPartners.map((p) => (
                <PartnerCard key={p.delivery_partner_id || p.id} partner={p} leaveInfo={getPartnerLeaveInfo(p)} onOpenEditModal={handleOpenEditModal} onOpenDocsModal={handleOpenDocsModal} />
              ))}
            </div>
          )}

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-200/90 shadow-2xs text-xs font-medium text-slate-600">
            <div>
              Showing <span className="font-bold text-slate-900">{filteredPartners.length}</span> partners on this page &nbsp;·&nbsp; Total <span className="font-bold text-slate-900">{total}</span> registered &nbsp;·&nbsp; Page <span className="font-bold text-slate-900">{page}</span> of <span className="font-bold text-slate-900">{Math.max(1, Math.ceil(total / pageSize))}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-xl border border-gray-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold shadow-2xs"
              >
                <ChevronLeft size={14} /> Prev
              </button>

              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: Math.max(1, Math.ceil(total / pageSize)) }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => setPage(pg)}
                    className={`h-8 w-8 rounded-xl text-xs font-bold transition-colors ${
                      pg === page
                        ? "bg-emerald-700 text-white border border-emerald-700 shadow-2xs"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {pg}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(total / pageSize)), p + 1))}
                disabled={page >= Math.max(1, Math.ceil(total / pageSize))}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-xl border border-gray-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold shadow-2xs"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>

      {/* KYC Verification Modal */}
      {selectedPartnerForDocs && (
        <div className="skf-overlay !m-0 !p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedPartnerForDocs(null); }}>
          <div className="skf-modal !m-auto" style={{ maxWidth: "820px" }}>
            <div className="skf-header">
              <h3 className="skf-title">Document & KYC Verification</h3>
              <button type="button" className="skf-close-btn" onClick={() => setSelectedPartnerForDocs(null)} title="Close"><X size={16} /></button>
            </div>

            <div className="skf-body space-y-6">
              {docsLoading ? (
                <div className="skf-loading py-16 flex flex-col items-center justify-center gap-3"><Loader2 className="w-8 h-8 text-emerald-600 animate-spin" /><p className="text-xs font-semibold text-slate-400">Fetching partner documents and verification details...</p></div>
              ) : docsData ? (
                <>
                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-slate-700 tracking-wider">Delivery Partner Profile</span>
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${!hasAnyUploadedProof ? "bg-rose-100 text-rose-700 border border-rose-200" : docsModalVerifiedToggle ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {!hasAnyUploadedProof ? "No Proofs Uploaded" : docsModalVerifiedToggle ? "Overall Verified" : "Overall Pending"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="skf-field"><label className="text-xs font-semibold text-slate-600">Full Name</label><div className="px-3 py-2 bg-slate-50/80 rounded-lg border border-slate-200/60 text-sm font-semibold text-slate-800">{docsData.partner?.full_name || selectedPartnerForDocs.full_name || "NA"}</div></div>
                      <div className="skf-field"><label className="text-xs font-semibold text-slate-600">Phone Number</label><div className="px-3 py-2 bg-slate-50/80 rounded-lg border border-slate-200/60 text-sm font-semibold text-slate-800">{docsData.partner?.phone || selectedPartnerForDocs.phone || "NA"}</div></div>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <div className="!flex !flex-row !items-center !justify-between gap-4 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3.5 w-full text-left shadow-2xs">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-bold text-slate-800 block mb-0.5">Partner Verification Status</span>
                          <p className="text-[11px] text-slate-500 font-medium leading-tight m-0">Toggle whether this delivery partner is approved and verified for active deliveries</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDocsModalVerifiedToggle(!docsModalVerifiedToggle)}
                          className={`shrink-0 group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-200 shadow-sm cursor-pointer border ${docsModalVerifiedToggle ? 'bg-[#00B074] text-white border-emerald-600 shadow-emerald-500/20' : 'bg-[#F59E0B] text-white border-amber-600 shadow-amber-500/20'}`}
                        >
                          <div className={`w-6 h-3.5 rounded-full p-0.5 flex items-center transition-colors duration-300 ${docsModalVerifiedToggle ? 'bg-emerald-700/40' : 'bg-amber-700/40'}`}>
                            <div className={`w-2.5 h-2.5 rounded-full bg-white shadow transform transition-transform duration-300 ${docsModalVerifiedToggle ? 'translate-x-2.5' : 'translate-x-0'}`} />
                          </div>
                          <span>{docsModalVerifiedToggle ? 'ACTIVE' : 'INACTIVE'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="skf-group-header"><span>Bank Accounts & Cheque Verification ({docsData.bank_accounts?.length || 0})</span></div>
                    <div className="mt-3">
                      {!docsData.bank_accounts || docsData.bank_accounts.length === 0 ? (
                        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
                          <div className="flex items-start justify-between"><span className="px-2.5 py-1 rounded text-[10px] font-black uppercase bg-teal-50 text-teal-700 border border-teal-100">PRIMARY BANK ACCOUNT DETAILS</span><span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">PENDING</span></div>
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                            <div className="lg:col-span-8 grid grid-cols-2 gap-2 text-[11px]"><InfoRow label="Account No:" value={docsData.partner?.bank_account_number} /><InfoRow label="IFSC Code:" value={docsData.partner?.bank_ifsc} /></div>
                            <div className="lg:col-span-4 h-24 bg-slate-50 rounded-lg flex items-center justify-center text-[11px] text-slate-400 border border-slate-100">No Cancelled Cheque Uploaded</div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">{docsData.bank_accounts.map((bank: any) => <BankCard key={bank.id} bank={bank} onPreview={handlePreviewImage} onVerify={handleVerifyBankItem} />)}</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="skf-group-header"><span>Identity Documents ({docsData.documents.length})</span></div>
                    <div className="mt-3">
                      {docsData.documents.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">No identity documents uploaded yet</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{docsData.documents.map((doc: any) => <DocumentCard key={doc.id} doc={doc} onPreview={handlePreviewImage} onVerify={handleVerifyDocItem} />)}</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="skf-group-header"><span>Vehicle & Insurance ({docsData.vehicles.length})</span></div>
                    <div className="mt-3">
                      {docsData.vehicles.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">No vehicle details uploaded yet</div>
                      ) : (
                        <div className="space-y-4">{docsData.vehicles.map((veh: any) => <VehicleCard key={veh.id} veh={veh} onPreview={handlePreviewImage} onVerify={handleVerifyVehicleItem} />)}</div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">Failed to load documents</div>
              )}
            </div>

            <div className="skf-footer">
              <button type="button" onClick={() => setSelectedPartnerForDocs(null)} className="skf-btn skf-btn-cancel">Cancel</button>
              <button type="button" disabled={verifying} onClick={() => handleVerifyPartner(docsModalVerifiedToggle)} title="Save verification status" className="skf-btn skf-btn-submit flex items-center gap-1.5">
                {verifying && <Loader2 size={14} className="animate-spin" />}<span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="skf-overlay !m-0 !p-4" style={{ zIndex: 100000 }} onClick={(e) => { if (e.target === e.currentTarget) setPreviewImage(null); }}>
          <div className="skf-modal !m-auto bg-white overflow-hidden shadow-2xl border border-slate-200" style={{ maxWidth: "750px", width: "100%" }}>
            <div className="skf-header">
              <div className="flex items-center gap-2"><span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-teal-50 text-teal-700 border border-teal-100">Document Preview</span><h3 className="skf-title text-sm font-bold text-slate-800 truncate">{previewImage.title}</h3></div>
              <button type="button" className="skf-close-btn" onClick={() => setPreviewImage(null)} title="Close Preview"><X size={16} /></button>
            </div>
            <div className="p-6 bg-slate-900/5 flex items-center justify-center min-h-[350px] max-h-[70vh] overflow-auto">
              <img src={previewImage.url} alt={previewImage.title} className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md border border-slate-200 bg-white" onError={(e) => { const el = e.currentTarget; el.style.display = "none"; if (el.parentElement && !el.parentElement.querySelector(".preview-error")) { const div = document.createElement("div"); div.className = "preview-error py-12 px-6 text-center text-slate-400 font-bold text-sm bg-white rounded-xl border border-slate-200 shadow-sm"; div.innerText = "Unable to load image preview."; el.parentElement.appendChild(div); } }} />
            </div>
          </div>
        </div>
      )}

      {/* Add Partner Form */}
      <SkeletonForm
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        apiEndpoint="/admin/delivery/partners/showAdd"
        submitEndpoint="/admin/delivery/partners/saveAdd"
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchPartners();
        }}
      />

      {/* Edit Partner Form */}
      {selectedPartnerForEdit && (
        <SkeletonForm
          isOpen={Boolean(selectedPartnerForEdit)}
          onClose={() => setSelectedPartnerForEdit(null)}
          apiEndpoint={`/admin/delivery/partners/${selectedPartnerForEdit.delivery_partner_id || selectedPartnerForEdit.id}/showEdit`}
          submitEndpoint={`/admin/delivery/partners/${selectedPartnerForEdit.delivery_partner_id || selectedPartnerForEdit.id}/saveEdit`}
          onSuccess={() => {
            setSelectedPartnerForEdit(null);
            fetchPartners();
          }}
        />
      )}
    </div>
  );
}
