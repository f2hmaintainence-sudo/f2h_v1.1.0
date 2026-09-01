"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FiUser, FiMail, FiPhone, FiMapPin, FiCalendar, FiGlobe,
  FiBriefcase, FiBookOpen, FiEdit3, FiSave, FiX, FiHeart, FiLock, FiCamera,
} from "react-icons/fi";
import { Home, ChevronRight, Building2, Shield, Loader2 } from "lucide-react";
import Link from "next/link";
import { api } from "@/services/api.client";
import { showSuccessToast, showErrorToast } from "@/components/Toast";
import "./profile.css";

// ── Types ──
type ProfileData = {
  user_id: string; email: string; user_name: string;
  first_name: string; last_name: string; phone: string; profile: string;
  account_status: string; user_created_at: string;
  management_id: string; branch_id: string; department: string;
  designation: string; bio: string; gender: string; date_of_birth: string;
  marital_status: string; alt_phone: string;
  address_line1: string; address_line2: string; city: string;
  state: string; postal_code: string; education: string;
  staff_active: boolean; branch_name: string;
};

type Tab = "personal" | "location" | "professional";

// ── Helpers ──
const val = (v?: string | null) => v?.trim() || "—";
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const fmtDate = (raw?: string) => {
  if (!raw) return "—";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
};

const toInputDate = (raw?: string) => {
  if (!raw) return "";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const initials = (first?: string, last?: string) =>
  ((first?.[0] ?? "") + (last?.[0] ?? "")).toUpperCase() || "U";

const getBackendOrigin = () => {
  const envBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envBase) return envBase.replace(/\/api\/?$/, "").replace(/\/$/, "");
  if (typeof window !== "undefined") return `${window.location.protocol}//${window.location.host}`;
  return "";
};

const resolveProfileImage = (path?: string) => {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const backendOrigin = getBackendOrigin();
  const cleanPath = path.trim().replace(/^\//, '');
  const url = backendOrigin ? `${backendOrigin}/${cleanPath}` : `/${cleanPath}`;
  return `${url}?v=${Date.now()}`;
};

// ── View Field Component ──
const ViewField = ({ icon: Icon, label, value, accent = "#2e7d32" }: {
  icon: React.ElementType; label: string; value: string; accent?: string;
}) => (
  <div className="pv-field">
    <div className="pv-field-icon" style={{ "--accent": accent } as React.CSSProperties}>
      <Icon size={18} />
    </div>
    <div className="pv-field-body">
      <span className="pv-field-label">{label}</span>
      <span className={`pv-field-value${value === "—" ? " pv-empty" : ""}`}>{value}</span>
    </div>
  </div>
);

// ── Edit Field Component ──
const EditField = ({ icon: Icon, label, value, onChange, type = "text", options, placeholder, accent = "#2e7d32" }: {
  icon: React.ElementType; label: string; value: string;
  onChange: (v: string) => void; type?: string;
  options?: { value: string; label: string }[];
  placeholder?: string; accent?: string;
}) => (
  <div className="pv-field pv-field--edit">
    <div className="pv-field-icon" style={{ "--accent": accent } as React.CSSProperties}>
      <Icon size={18} />
    </div>
    <div className="pv-field-body" style={{ flex: 1 }}>
      <label className="pv-field-label">{label}</label>
      {options ? (
        <select className="pv-input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Select —</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea className="pv-input pv-textarea" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} rows={3} />
      ) : (
        <input className="pv-input" type={type} value={value}
          onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  </div>
);

// ── Section Card ──
const Section = ({ dot, title, children }: { dot: string; title: string; children: React.ReactNode }) => (
  <div className="card pv-card">
    <div className="card-header pv-card-header">
      <div className="pv-dot" style={{ background: dot }} />
      <span className="card-title mb-0">{title}</span>
    </div>
    <div className="card-body pv-card-body">{children}</div>
  </div>
);

// ── Tab Button ──
const TabBtn = ({ active, icon: Icon, label, onClick }: {
  active: boolean; icon: React.ElementType; label: string; onClick: () => void;
}) => (
  <button onClick={onClick} className={`pv-tab ${active ? "pv-tab--active" : ""}`}>
    <Icon size={16} /> {label}
  </button>
);

// ── Options ──
const genderOpts = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];
const maritalOpts = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
];

// ════════════════════════════════════════════════
// ── Main Component ──
// ════════════════════════════════════════════════
export default function AdminProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("personal");
  const [imageError, setImageError] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [branches, setBranches] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Image Upload Handler ──
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showErrorToast("Please select a valid image file (PNG, JPG, WEBP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showErrorToast("Image size must be less than 10MB");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadingImage(true);
    try {
      const res = await api.upload<any>("/admin/profile/photo", formData);
      if (res.error) {
        showErrorToast(res.error);
      } else if (res.data?.status || res.data?.success || res.status === 200) {
        showSuccessToast(res.data?.message || "Profile updated successfully");
        setImageError(false);
        await fetchProfile();
      } else {
        showErrorToast(res.data?.message || "Failed to upload profile picture");
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to upload profile picture");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Reset Password States ──
  const [showResetModal, setShowResetModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  // ── Email Change States ──
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [showEmailOtpModal, setShowEmailOtpModal] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false);
  const [emailResendTimer, setEmailResendTimer] = useState(0);

  // ── Fetch Profile ──
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<any>("/admin/profile/me");
      if (data?.status && data.data) setProfile(data.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  // ── Fetch Branches ──
  const fetchBranches = useCallback(async () => {
    try {
      const { data } = await api.get<any>("/admin/branches");
      if (data?.status && Array.isArray(data.data)) setBranches(data.data);
      else if (Array.isArray(data)) setBranches(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchProfile(); fetchBranches(); }, [fetchProfile, fetchBranches]);
  useEffect(() => { setImageError(false); }, [profile?.profile]);

  // ── Resend countdown ──
  useEffect(() => {
    if (emailResendTimer <= 0) return;
    const id = window.setTimeout(() => setEmailResendTimer(v => v - 1), 1000);
    return () => window.clearTimeout(id);
  }, [emailResendTimer]);

  // ── Reset Password ──
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { showErrorToast("Passwords do not match"); return; }
    if (newPassword.length < 8) { showErrorToast("Password must be at least 8 characters"); return; }
    setResetSaving(true);
    try {
      const { data, error } = await api.post<any>("/admin/profile/change-password", { currentPassword, newPassword });
      if (error) { showErrorToast(error); }
      else if (data?.status) {
        showSuccessToast("Password updated successfully");
        setShowResetModal(false);
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      } else { showErrorToast(data?.message || "Failed to update password"); }
    } catch { showErrorToast("An error occurred. Please try again."); }
    finally { setResetSaving(false); }
  };

  // ── Start Profile Edit ──
  const startEdit = () => {
    if (!profile) return;
    setForm({
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      phone: profile.phone || "",
      gender: profile.gender || "",
      date_of_birth: toInputDate(profile.date_of_birth),
      marital_status: profile.marital_status || "",
      bio: profile.bio || "",
      address_line1: profile.address_line1 || "",
      address_line2: profile.address_line2 || "",
      city: profile.city || "",
      state: profile.state || "",
      postal_code: profile.postal_code || "",
      department: profile.department || "",
      designation: profile.designation || "",
      education: profile.education || "",
      alt_phone: profile.alt_phone || "",
      branch_id: profile.branch_id || "",
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false); setForm({});
    setEmailEditing(false); setEmailDraft("");
  };

  const updateField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  // ── Save Profile ──
  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await api.put<any>("/admin/profile/me", form);
      const data = res.data;
      if (res.error) {
        showErrorToast(res.error);
      } else if (data?.status || res.status === 200) {
        showSuccessToast(data?.message || "Profile updated successfully");
        setEditing(false);
        fetchProfile();
      } else {
        showErrorToast(data?.message || "Failed to update profile");
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // ── Email Change Handlers ──
  const startEmailEdit = () => {
    setEmailDraft(profile?.email || "");
    setEmailEditing(true);
  };

  const cancelEmailEdit = () => {
    setEmailDraft(profile?.email || "");
    setEmailEditing(false);
    setShowEmailOtpModal(false);
    setEmailOtp("");
    setEmailResendTimer(0);
  };

  const requestEmailOtp = async (isResend = false) => {
    const nextEmail = emailDraft.trim().toLowerCase();
    if (!isValidEmail(nextEmail)) { showErrorToast("Please enter a valid email address"); return; }
    if (nextEmail === (profile?.email || "").toLowerCase().trim()) {
      showErrorToast("Enter a different email address"); return;
    }
    setEmailOtpSending(true);
    try {
      const { data, error } = await api.post<any>("/auth/send-otp", {
        email: nextEmail,
        purpose: "email_change",
      });
      if (error) { showErrorToast(error); return; }
      setEmailOtp("");
      setShowEmailOtpModal(true);
      setEmailResendTimer(60);
      showSuccessToast(data?.message || (isResend ? "OTP resent successfully" : "OTP sent to your new email"));
    } catch { showErrorToast("Failed to send OTP"); }
    finally { setEmailOtpSending(false); }
  };

  const verifyEmailOtpAndUpdate = async () => {
    const nextEmail = emailDraft.trim().toLowerCase();
    if (!/^\d{6}$/.test(emailOtp)) { showErrorToast("Enter the 6-digit OTP"); return; }
    setEmailOtpVerifying(true);
    try {
      const verify = await api.post<any>("/auth/verify-otp", {
        email: nextEmail, otp: emailOtp, purpose: "email_change",
      });
      if (verify.error) { showErrorToast(verify.error); return; }
      const verificationToken = verify.data?.verification_token;
      if (!verificationToken) {
        showErrorToast("OTP verified, but verification token was not returned"); return;
      }
      const update = await api.put<any>("/admin/profile/email", {
        email: nextEmail, verification_token: verificationToken,
      });
      if (update.error || update.data?.status === false) {
        showErrorToast(update.error || update.data?.message || "Failed to update email"); return;
      }
      setProfile(prev => prev ? { ...prev, email: nextEmail } : prev);
      setEmailEditing(false);
      setShowEmailOtpModal(false);
      setEmailOtp("");
      setEmailResendTimer(0);
      showSuccessToast(update.data?.message || "Email updated successfully");
      fetchProfile();
    } catch { showErrorToast("Failed to verify OTP or update email"); }
    finally { setEmailOtpVerifying(false); }
  };

  // ── Derived ──
  const p = profile;
  const fullName = p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || "—" : "—";
  const profileImage = resolveProfileImage(p?.profile);
  const branchOptions = branches.map((b: any) => ({ value: b.branch_id, label: b.branch_name || b.name }));

  // ── Skeleton ──
  if (loading) {
    return (
      <div className="pv-page-wrap">
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-5">
          <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={16} /> Dashboard</Link>
          <ChevronRight size={16} className="text-gray-300" />
          <span className="text-gray-800 font-semibold">My Profile</span>
        </nav>
        <div className="pv-layout">
          <div className="pv-skel" style={{ height: 340, borderRadius: 20 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="pv-skel" style={{ height: 48, borderRadius: 12 }} />
            <div className="pv-skel" style={{ height: 280, borderRadius: 16 }} />
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════
  return (
    <>
      <div className="pv-page-wrap">
        {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-5">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={16} /> Dashboard</Link>
        <ChevronRight size={16} className="text-gray-300" />
        <span className="text-gray-800 font-semibold">My Profile</span>
      </nav>

      {/* Page Header */}
      <div className="pv-page-head">
        <div>
          <span className="pv-page-eyebrow">Account Center</span>
          <h1 className="pv-page-title">My Profile</h1>
          <p className="pv-page-subtitle">
            Manage your personal details, branch assignment, and professional information from one clean workspace.
          </p>
        </div>
        <div className="pv-page-head-actions">
          <span className={`pv-status-chip ${p?.account_status !== "active" ? "pv-status-chip--inactive" : ""}`}>
            {val(p?.account_status)}
          </span>
          <span className="pv-date-chip">Joined {fmtDate(p?.user_created_at)}</span>
        </div>
      </div>

      <div className="pv-layout">
        {/* ── Left: Hero Card ── */}
        <div className="pv-hero-wrapper">
          <div className="pv-hero">
            {/* Banner — gradient background + name chip */}
            <div className="pv-hero-banner">
              {/* Name chip — bottom-right */}
              <div className="pv-hero-name-chip">
                <span className="pv-hero-name-chip-icon">🌿</span>
                <span>{fullName}</span>
              </div>
            </div>

            {/* Avatar — overlaps banner/content boundary */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleImageUpload}
            />
            <div
              className="pv-avatar group cursor-pointer relative overflow-hidden"
              onClick={() => !uploadingImage && fileInputRef.current?.click()}
              title="Click to change profile picture"
            >
              {uploadingImage && (
                <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center">
                  <Loader2 size={24} className="text-white animate-spin" />
                </div>
              )}
              {profileImage && !imageError
                ? <img src={profileImage} alt="avatar" onError={() => setImageError(true)} />
                : initials(p?.first_name, p?.last_name)
              }
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex flex-col items-center justify-center text-white gap-1">
                <FiCamera size={20} />
                <span style={{ fontSize: "10px", fontWeight: "600" }}>Upload</span>
              </div>
            </div>

            <div className="pv-hero-inner">
              {/* Name + Role left-aligned below banner */}
              <p className="pv-hero-name">{fullName}</p>
              {p?.designation && <p className="pv-hero-role">{p.designation}</p>}

              {/* Edit / Save Buttons */}
              <div className="pv-hero-actions">
                {editing ? (
                  <>
                    <button className="pv-btn pv-btn--save" onClick={saveProfile} disabled={saving}>
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <FiSave size={16} />}
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                    <button className="pv-btn pv-btn--cancel" onClick={cancelEdit} disabled={saving}>
                      <FiX size={16} /> Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button className="pv-btn pv-btn--edit" onClick={startEdit}>
                      <FiEdit3 size={16} /> Edit Profile
                    </button>
                    <button className="pv-btn pv-btn--edit" onClick={() => setShowResetModal(true)}>
                      <FiLock size={16} /> Reset Password
                    </button>
                  </>
                )}
              </div>

              <div className="pv-hero-hr" />

              {/* Quick Stats */}
              <div className="pv-hero-stats">
                <div className="pv-hero-stat">
                  <span className="pv-hero-stat-lbl">Department</span>
                  <span className="pv-hero-stat-val">{val(p?.department)}</span>
                </div>
                <div className="pv-hero-stat">
                  <span className="pv-hero-stat-lbl">Branch</span>
                  <span className="pv-hero-stat-val">{val(p?.branch_name)}</span>
                </div>
                <div className="pv-hero-stat">
                  <span className="pv-hero-stat-lbl">Status</span>
                  <span className="pv-hero-stat-val" style={{ color: p?.account_status === "active" ? "#15803d" : "#dc2626" }}>
                    {val(p?.account_status)}
                  </span>
                </div>
                <div className="pv-hero-stat">
                  <span className="pv-hero-stat-lbl">Member Since</span>
                  <span className="pv-hero-stat-val">{fmtDate(p?.user_created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Tabbed Sections ── */}
        <div className="pv-details-panel">
          {/* Tabs */}
          <div className="pv-tabs">
            <TabBtn active={activeTab === "personal"} icon={FiUser} label="Personal" onClick={() => setActiveTab("personal")} />
            <TabBtn active={activeTab === "location"} icon={FiMapPin} label="Location" onClick={() => setActiveTab("location")} />
            <TabBtn active={activeTab === "professional"} icon={FiBriefcase} label="Professional" onClick={() => setActiveTab("professional")} />
          </div>

          {/* ── Personal Tab ── */}
          {activeTab === "personal" && (
            <Section dot="#2e7d32" title="Personal Information">
              <div className="pv-fields-grid">
                {editing ? (
                  <>
                    <EditField icon={FiUser} label="First Name" value={form.first_name ?? ""} onChange={v => updateField("first_name", v)} placeholder="Enter first name" />
                    <EditField icon={FiUser} label="Last Name" value={form.last_name ?? ""} onChange={v => updateField("last_name", v)} placeholder="Enter last name" />

                    {/* ── Email — dedicated OTP flow ── */}
                    <div className="pv-field pv-field--edit" style={{ gridColumn: "1 / -1" }}>
                      <div className="pv-field-icon" style={{ "--accent": "#2e7d32" } as React.CSSProperties}>
                        <FiMail size={18} />
                      </div>
                      <div className="pv-field-body" style={{ flex: 1 }}>
                        <label className="pv-field-label">Email</label>
                        {emailEditing ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <input
                              className="pv-input"
                              type="email"
                              value={emailDraft}
                              onChange={e => setEmailDraft(e.target.value)}
                              placeholder="newemail@example.com"
                              style={{ flex: 1, minWidth: 180 }}
                            />
                            <button
                              type="button"
                              className="pv-btn pv-btn--save"
                              style={{ padding: "5px 12px", fontSize: 12 }}
                              onClick={() => requestEmailOtp(false)}
                              disabled={emailOtpSending}
                            >
                              {emailOtpSending ? <Loader2 size={12} className="animate-spin" /> : <FiMail size={12} />}
                              {emailOtpSending ? "Sending…" : "Send OTP"}
                            </button>
                            <button
                              type="button"
                              className="pv-btn pv-btn--cancel"
                              style={{ padding: "5px 10px", fontSize: 12 }}
                              onClick={cancelEmailEdit}
                              title="Cancel email change"
                            >
                              <FiX size={12} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span className="pv-input" style={{ flex: 1, cursor: "default", color: "#374151", background: "#f6f9fc" }}>
                              {p?.email || "—"}
                            </span>
                            <button
                              type="button"
                              className="pv-btn pv-btn--edit"
                              style={{ padding: "5px 12px", fontSize: 12 }}
                              onClick={startEmailEdit}
                            >
                              <FiEdit3 size={12} /> Change
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <EditField icon={FiPhone} label="Phone" value={form.phone ?? ""} onChange={v => updateField("phone", v)} type="tel" placeholder="+91..." />
                    <EditField icon={FiUser} label="Gender" value={form.gender ?? ""} onChange={v => updateField("gender", v)} options={genderOpts} />
                    <EditField icon={FiCalendar} label="Date of Birth" value={form.date_of_birth ?? ""} onChange={v => updateField("date_of_birth", v)} type="date" />
                    <EditField icon={FiHeart} label="Marital Status" value={form.marital_status ?? ""} onChange={v => updateField("marital_status", v)} options={maritalOpts} />
                  </>
                ) : (
                  <>
                    <ViewField icon={FiUser} label="First Name" value={val(p?.first_name)} />
                    <ViewField icon={FiUser} label="Last Name" value={val(p?.last_name)} accent="#388e3c" />

                    {/* ── Email view with Edit icon ── */}
                    <div className="pv-field">
                      <div className="pv-field-icon" style={{ "--accent": "#2e7d32" } as React.CSSProperties}>
                        <FiMail size={18} />
                      </div>
                      <div className="pv-field-body" style={{ flex: 1 }}>
                        <span className="pv-field-label">Email</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className={`pv-field-value${!p?.email ? " pv-empty" : ""}`}>{val(p?.email)}</span>
                          <button
                            type="button"
                            title="Change email"
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "#2e7d32", padding: "2px 4px", display: "flex", alignItems: "center",
                              borderRadius: 4, transition: "opacity .15s", flexShrink: 0,
                            }}
                            onClick={startEmailEdit}
                          >
                            <FiEdit3 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <ViewField icon={FiPhone} label="Phone" value={val(p?.phone)} accent="#388e3c" />
                    <ViewField icon={FiUser} label="Gender" value={val(p?.gender)} />
                    <ViewField icon={FiCalendar} label="Date of Birth" value={fmtDate(p?.date_of_birth)} accent="#388e3c" />
                    <ViewField icon={FiHeart} label="Marital Status" value={val(p?.marital_status)} />
                  </>
                )}
              </div>
              {/* Bio spans full width */}
              {editing ? (
                <div style={{ marginTop: 12 }}>
                  <EditField icon={FiBookOpen} label="Bio" value={form.bio ?? ""} onChange={v => updateField("bio", v)} type="textarea" placeholder="A short bio about yourself…" />
                </div>
              ) : p?.bio ? (
                <div className="pv-bio-block">
                  <FiBookOpen size={18} style={{ color: "#2e7d32", flexShrink: 0, marginTop: 2 }} />
                  <p>{p.bio}</p>
                </div>
              ) : null}
            </Section>
          )}

          {/* ── Location Tab ── */}
          {activeTab === "location" && (
            <Section dot="#1565c0" title="Location Details">
              <div className="pv-fields-grid">
                {editing ? (
                  <>
                    <EditField icon={FiMapPin} label="Address Line 1" value={form.address_line1 ?? ""} onChange={v => updateField("address_line1", v)} placeholder="Street address" accent="#1565c0" />
                    <EditField icon={FiMapPin} label="Address Line 2" value={form.address_line2 ?? ""} onChange={v => updateField("address_line2", v)} placeholder="Apartment, suite, etc." accent="#1976d2" />
                    <EditField icon={FiMapPin} label="City" value={form.city ?? ""} onChange={v => updateField("city", v)} placeholder="City" accent="#1565c0" />
                    <EditField icon={FiMapPin} label="State" value={form.state ?? ""} onChange={v => updateField("state", v)} placeholder="State" accent="#1976d2" />
                    <EditField icon={FiGlobe} label="Postal Code" value={form.postal_code ?? ""} onChange={v => updateField("postal_code", v)} placeholder="PIN code" accent="#1565c0" />
                  </>
                ) : (
                  <>
                    <ViewField icon={FiMapPin} label="Address Line 1" value={val(p?.address_line1)} accent="#1565c0" />
                    <ViewField icon={FiMapPin} label="Address Line 2" value={val(p?.address_line2)} accent="#1976d2" />
                    <ViewField icon={FiMapPin} label="City" value={val(p?.city)} accent="#1565c0" />
                    <ViewField icon={FiMapPin} label="State" value={val(p?.state)} accent="#1976d2" />
                    <ViewField icon={FiGlobe} label="Postal Code" value={val(p?.postal_code)} accent="#1565c0" />
                  </>
                )}
              </div>
            </Section>
          )}

          {/* ── Professional Tab ── */}
          {activeTab === "professional" && (
            <Section dot="#e65100" title="Professional Details">
              <div className="pv-fields-grid">
                {editing ? (
                  <>
                    <EditField icon={FiBriefcase} label="Department" value={form.department ?? ""} onChange={v => updateField("department", v)} placeholder="e.g. Operations" accent="#e65100" />
                    <EditField icon={Shield} label="Designation" value={form.designation ?? ""} onChange={v => updateField("designation", v)} placeholder="e.g. Manager" accent="#f57c00" />
                    <EditField icon={FiBookOpen} label="Education" value={form.education ?? ""} onChange={v => updateField("education", v)} placeholder="e.g. B.Tech" accent="#e65100" />
                    <EditField icon={FiPhone} label="Alt Phone" value={form.alt_phone ?? ""} onChange={v => updateField("alt_phone", v)} type="tel" placeholder="Alternate number" accent="#f57c00" />
                    <EditField icon={Building2} label="Branch" value={form.branch_id ?? ""} onChange={v => updateField("branch_id", v)} options={branchOptions} accent="#e65100" />
                  </>
                ) : (
                  <>
                    <ViewField icon={FiBriefcase} label="Department" value={val(p?.department)} accent="#e65100" />
                    <ViewField icon={Shield} label="Designation" value={val(p?.designation)} accent="#f57c00" />
                    <ViewField icon={FiBookOpen} label="Education" value={val(p?.education)} accent="#e65100" />
                    <ViewField icon={FiPhone} label="Alt Phone" value={val(p?.alt_phone)} accent="#f57c00" />
                    <ViewField icon={Building2} label="Branch" value={val(p?.branch_name)} accent="#e65100" />
                  </>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
      </div> {/* End pv-page-wrap */}

      {/* ══════════════════════════════════════════════
          Email OTP Verification Modal
      ══════════════════════════════════════════════ */}
      {showEmailOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 font-bold">
                <FiMail size={18} />
                <span>Verify New Email</span>
              </div>
              <button onClick={cancelEmailEdit} className="text-slate-400 hover:text-slate-600 transition-colors">
                <FiX size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-600 text-center leading-relaxed">
                We sent a 6-digit verification code to{" "}
                <span className="font-semibold text-emerald-700">{emailDraft}</span>.
                Enter it below to confirm your new email.
              </p>

              {/* OTP input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={emailOtp}
                  onChange={e => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] focus:border-emerald-500 focus:bg-white outline-none transition-all"
                  placeholder="······"
                  autoFocus
                />
              </div>

              {/* Verify button */}
              <button
                type="button"
                onClick={verifyEmailOtpAndUpdate}
                disabled={emailOtpVerifying || emailOtp.length < 6}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl text-sm font-bold shadow-md hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {emailOtpVerifying ? <Loader2 size={15} className="animate-spin" /> : <FiSave size={15} />}
                {emailOtpVerifying ? "Verifying…" : "Verify & Update Email"}
              </button>

              {/* Resend */}
              <div className="text-center">
                {emailResendTimer > 0 ? (
                  <span className="text-xs text-slate-500">
                    Resend OTP in{" "}
                    <span className="font-semibold text-emerald-700">{emailResendTimer}s</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => requestEmailOtp(true)}
                    disabled={emailOtpSending}
                    className="text-xs text-emerald-700 font-semibold hover:underline disabled:opacity-50"
                  >
                    {emailOtpSending ? "Sending…" : "Resend OTP"}
                  </button>
                )}
              </div>

              {/* Cancel */}
              <button
                type="button"
                onClick={cancelEmailEdit}
                className="w-full py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          Reset Password Modal
      ══════════════════════════════════════════════ */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 font-bold">
                <FiLock size={18} />
                <span>Reset Password</span>
              </div>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Current Password *</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:bg-white outline-none transition-all"
                  placeholder="Enter current password"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">New Password *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:bg-white outline-none transition-all"
                  placeholder="At least 8 chars, uppercase, lowercase, special char"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirm New Password *</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm focus:border-emerald-500 focus:bg-white outline-none transition-all"
                  placeholder="Confirm new password"
                  required
                />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSaving}
                  className="px-4 py-2 bg-gradient-to-r from-fresh-green to-deep-green text-white rounded-xl text-sm font-bold shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-70"
                >
                  {resetSaving ? <Loader2 size={14} className="animate-spin" /> : <FiSave size={14} />}
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
