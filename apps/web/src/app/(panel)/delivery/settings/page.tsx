"use client";
import { useState, useRef, useEffect } from "react";
import { BsWindows, BsAndroid2, BsApple } from "react-icons/bs";
import {
  FiLock, FiKey, FiX, FiSmartphone, FiMail,
  FiSettings, FiActivity, FiEye, FiRefreshCw, FiLogOut,
  FiAlertTriangle, FiTrash2, FiInfo, FiClock, FiMapPin, FiHome, FiTag, FiEdit2, FiMonitor, FiFilter, FiUser, FiGlobe, FiEyeOff,
} from "react-icons/fi";
import { MdPowerSettingsNew, MdPersonOff, MdLightbulb, MdNewspaper } from "react-icons/md";
import { MdOutlineDeviceUnknown } from "react-icons/md";
import { Home as HomeIcon } from "lucide-react";
import { api } from "@/services/api.client";
import { showErrorToast, showSuccessToast } from "@/components/Toast";
import { fingerprintService } from "@/services/fingerprint.service";
import Breadcrumb from "@/components/Breadcrumbs";
import "./settings.css";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProfileData = {
  user_id?: string | number;
  first_name: string; last_name: string; email: string;
  gender: string; date_of_birth: string; nationality: string; marital_status: string;
  alt_email: string; phone: string; alt_phone: string;
  address: string; city: string; state: string;
  postal_code: string; country: string; avatar?: string;
  session_timeout?: number;
  session_warning?: number;
  max_logins?: number;
  profile?: string;
  '2fa'?: boolean | number;
  '2fa_secret'?: string;
  '2fa_codes'?: string;
  password_changed_at?: string | null;
};

type DeviceRow = {
  id: number;
  device_id: string;
  device_name: string;
  device_info: DeviceInfo | null;
  ip_address: string;
  is_active: boolean | number;
  created_at: string;
  last_used: string;
  revoked_at: string | null;
};

type SessionsData = {
  current_device: DeviceRow | null;
  device_history: DeviceRow[];
  session_history: DeviceRow[];
};

type Tab = "profile" | "security" | "sessions";
type EditCard = "personal" | "address" | "additional" | "social" | "change_password" | "deactivate_account" | "delete_account" | null;

// ─── Constants ────────────────────────────────────────────────────────────────
const navItems: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile Settings" },
  { key: "security", label: "Security Settings" },
  { key: "sessions", label: "Sessions" },
];

const pageMeta: Record<Tab, { title: string; sub: string }> = {
  profile: { title: "My Profile", sub: "Upload your photo & personal details here" },
  security: { title: "Security Settings", sub: "Manage your account security preferences" },
  sessions: { title: "Sessions", sub: "View and manage all devices currently logged into your account." },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (value: string): string => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const toDateInputValue = (value: string): string => (!value ? "" : value.split("T")[0]);

const formatDateTime = (value: string): string => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const timeAgo = (value: string): string => {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  const months = Math.floor(days / 30);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  return `${months} month${months > 1 ? "s" : ""} ago`;
};

const getBackendOrigin = () => {
  const envBase = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envBase) return envBase.replace(/\/api\/?$/, "").replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return "";
};

const resolveProfileImage = (path?: string, cacheBuster?: string) => {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;

  const trimmedPath = path.trim();
  
  // Build the correct API endpoint path
  let apiPath = `/api/profile/image/${trimmedPath}`;
  
  const backendOrigin = getBackendOrigin();
  const url = backendOrigin ? `${backendOrigin}${apiPath}` : apiPath;
  
  // Add cache busting parameter to force fresh image load
  const cacheBustParam = cacheBuster || Date.now();
  return `${url}?v=${cacheBustParam}`;
};

type DeviceInfo = {
  os: string;
  browser: string;
  browser_version: string;
  device: string;
  platform: string;
  timezone: string;
  user_agent: string;
  screen_resolution: string;
};

const parseDeviceInfo = (raw: DeviceInfo | null): DeviceInfo => {
  const empty: DeviceInfo = { os: "", browser: "", browser_version: "", device: "", platform: "", timezone: "", user_agent: "", screen_resolution: "" };
  if (!raw || typeof raw !== "object") return empty;
  return {
    os: raw.os || "",
    browser: raw.browser || "",
    browser_version: raw.browser_version || "",
    device: raw.device || "",
    platform: raw.platform || "",
    timezone: raw.timezone || "",
    user_agent: raw.user_agent || "",
    screen_resolution: raw.screen_resolution || "",
  };
};

const DeviceIcon = ({ device, size = 18 }: { device: DeviceRow; size?: number }) => {
  const info = parseDeviceInfo(device.device_info);
  const os = (info.os || device.device_name || "").toLowerCase();
  if (os.includes("android")) return <BsAndroid2 size={size} color="#3ddc84" />;
  if (os.includes("ios") || os.includes("mac") || os.includes("iphone") || os.includes("ipad"))
    return <BsApple size={size} color="#555" />;
  if (os.includes("windows")) return <BsWindows size={size} color="#0078d4" />;
  return <MdOutlineDeviceUnknown size={size} color="#94a3b8" />;
};

const BtnSpinner = () => (
  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"
    style={{ animation: "ps-spin 0.7s linear infinite", flexShrink: 0 }}>
    <path d="M12 2a10 10 0 0 1 10 10" />
    <style>{`@keyframes ps-spin{to{transform:rotate(360deg)}}`}</style>
  </svg>
);

// ─── ProfileView ──────────────────────────────────────────────────────────────
const ProfileView = ({ profile, onRefresh }: { profile: ProfileData | null; onRefresh: () => void }) => {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [savedFile, setSavedFile] = useState<File | null>(null);
  const [loadingCard, setLoadingCard] = useState<EditCard>(null);
  const [activeModal, setActiveModal] = useState<EditCard>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fields, setFields] = useState({
    first_name: "", last_name: "", email: "",
    phone: "", gender: "", date_of_birth: "",
    city: "", country: "", state: "", pincode: "",
  });
  const [draft, setDraft] = useState(fields);

  useEffect(() => {
    if (profile) {
      setFields({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        gender:
          profile.gender === "Male"
            ? "male"
            : profile.gender === "Female"
              ? "female"
              : profile.gender === "Other"
                ? "other"
                : profile.gender === "Prefer not to say"
                  ? "prefer_not_to_say"
                  : "",
        date_of_birth: toDateInputValue(profile.date_of_birth || ""),
        state: profile.state || "",
        pincode: profile.postal_code || "",
        city: profile.city || "",
        country: profile.country || "",
      });
      const avatarPath = profile.avatar || profile.profile;
      // Only load server image if we don't have a local file preview
      if (avatarPath && savedFile) {
        // Keep the local file preview visible
        return;
      }
      if (avatarPath) {
        // Add timestamp to force cache refresh on server updates
        const newAvatarUrl = resolveProfileImage(avatarPath, Date.now().toString());
        setAvatarSrc(newAvatarUrl);
      } else {
        // No avatar - show default icon
        setAvatarSrc(null);
      }
    }
  }, [profile, savedFile]);

  const handleFile = (file: File) => {
    const r = new FileReader();
    r.onload = (e) => setAvatarSrc(e.target?.result as string);
    r.readAsDataURL(file);
    setSavedFile(file);
  };

  const saveProfileImage = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("profile", file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/profile/settings/profile-image`,
        {
          method: "PUT",
          credentials: "include",
          body: formData,
        }
      );
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Failed to save");
      showSuccessToast("Profile photo updated successfully", 2500);
      setSavedFile(null);
      onRefresh();
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : "Failed to save photo", 4000);
    }
  };

  const deleteProfileImage = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/profile/settings/profile-image`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Failed to delete");
      showSuccessToast("Profile photo deleted successfully", 2500);
      setAvatarSrc(null);
      setSavedFile(null);
      onRefresh();
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : "Failed to delete photo", 4000);
    }
  };

  const openPopup = async (card: EditCard) => {
    if (!card || loadingCard) return;
    setLoadingCard(card);
    setDraft(fields);
    setActiveModal(card);
    setTimeout(() => setLoadingCard(null), 150);
  };

  // ── Direct REST save — same pattern as customers api.put() ─────────────────
  const saveProfile = async (
    section: "personal" | "address",
    payload: Record<string, unknown>
  ) => {
    const { data, error } = await api.put<any>(
      `/profile/settings/${section}`,
      payload
    );
    if (error || !data?.success) {
      throw new Error(data?.message || error || "Failed to save");
    }
    return data;
  };

  const EditBtn = ({ card, label = "Edit" }: { card: EditCard; label?: string }) => {
    const isLoading = loadingCard === card;
    const isDisabled = loadingCard !== null;
    return (
      <button className="ps-btn-edit" onClick={() => openPopup(card)} disabled={isDisabled}
        style={{ opacity: isDisabled && !isLoading ? 0.5 : 1 }}>
        {isLoading ? <BtnSpinner /> : <FiEdit2 size={12} />}
        {isLoading ? "Loading..." : label}
      </button>
    );
  };

  return (
    <>
      <div className="ps-view-header">
        <div>
          <div className="ps-card-title" style={{ fontSize: 16 }}>Profile Settings</div>
          <p className="ps-subtitle">Upload your photo &amp; personal details here</p>
        </div>
      </div>

      <div className="ps-pg">
        {/* ── Left: Photo ── */}
        <div>
          <div className="ps-card ps-profile-photo-card">
            <div className="ps-card-body ps-profile-photo-body">
              <div className="ps-profile-photo-banner" />
              <div className="ps-avatar-row">
                <div className="ps-avatar">
                  {avatarSrc ? (
                    <>
                      <img 
                        src={avatarSrc} 
                        alt="avatar" 
                        onError={() => setAvatarSrc(null)}
                        onLoad={() => setImageLoading(false)}
                        onLoadStart={() => setImageLoading(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {imageLoading && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.5)' }}>
                          <div style={{ width: 20, height: 20, border: '2px solid #e5e7eb', borderTop: '2px solid #22c55e', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#e5e7eb', borderRadius: '50%' }}>
                      <FiUser size={36} color="#6b7280" />
                    </div>
                  )}
                </div>
                <div className="ps-profile-photo-name">
                  {[fields.first_name, fields.last_name].filter(Boolean).join(" ") || "—"}
                </div>
                <div className="ps-profile-photo-divider" />
                <div className="ps-avatar-actions">
                  <h6>Edit Your Photo</h6>
                  <div className="ps-avatar-links">
                    <a href="#" className="ps-link-danger" onClick={(e) => { e.preventDefault(); deleteProfileImage(); }}>Delete</a>
                    <a href="#" className="ps-link-update" onClick={(e) => { e.preventDefault(); fileRef.current?.click(); }}>Update</a>
                    {savedFile && (
                      <a href="#" className="ps-link-update" style={{ color: "#22c55e" }}
                        onClick={(e) => { e.preventDefault(); saveProfileImage(savedFile); }}>
                        Save Photo
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className={`ps-dropzone${isDragging ? " dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  style={{ display: "none" }} />
                <div className="ps-upload-icon">↑</div>
                <p className="ps-upload-text"><span>Click to upload</span> or drag &amp; drop</p>
                <p className="ps-upload-hint">JPG · PNG · Max 450×450px</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Cards ── */}
        <div>
          {/* Personal */}
          <div className="ps-card">
            <div className="ps-card-header">
              <div className="ps-card-header-left">
                <div className="ps-card-dot" />
                <span className="ps-card-title">Personal Information</span>
              </div>
              <EditBtn card="personal" />
            </div>
            <div className="ps-card-body">
              <div className="ps-row">
                <div className="ps-field"><label className="ps-label">First Name</label><input className="ps-input" type="text" value={fields.first_name} readOnly /></div>
                <div className="ps-field"><label className="ps-label">Last Name</label><input className="ps-input" type="text" value={fields.last_name} readOnly /></div>
              </div>
              <div className="ps-row">
                <div className="ps-field"><label className="ps-label">Email Address</label><input className="ps-input" type="email" value={fields.email} readOnly /></div>
                <div className="ps-field"><label className="ps-label">Phone</label><input className="ps-input" type="tel" value={fields.phone} readOnly /></div>
              </div>
              <div className="ps-row">
                <div className="ps-field"><label className="ps-label">Gender</label><input className="ps-input" type="text" value={fields.gender} readOnly /></div>
                <div className="ps-field"><label className="ps-label">Date of Birth</label><input className="ps-input" type="text" value={formatDate(fields.date_of_birth)} readOnly /></div>
              </div>
            </div>
          </div>

          {/* Additional */}
          <div className="ps-card">
            <div className="ps-card-header">
              <div className="ps-card-header-left">
                <div className="ps-card-dot" style={{ background: "#22c55e" }} />
                <span className="ps-card-title">Additional Information</span>
              </div>
              <EditBtn card="additional" />
            </div>
            <div className="ps-card-body">
              <div className="ps-row">
                <div className="ps-field"><label className="ps-label">City</label><input className="ps-input" type="text" value={fields.city} readOnly /></div>
                <div className="ps-field"><label className="ps-label">Country</label><input className="ps-input" type="text" value={fields.country} readOnly /></div>
              </div>
              <div className="ps-row">
                <div className="ps-field"><label className="ps-label">State</label><input className="ps-input" type="text" value={fields.state} readOnly /></div>
                <div className="ps-field"><label className="ps-label">Pincode</label><input className="ps-input" type="text" value={fields.pincode} readOnly /></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {activeModal && (activeModal === "personal" || activeModal === "additional") && (
        <ProfileEditModal
          card={activeModal}
          draft={draft}
          setDraft={setDraft}
          onClose={() => setActiveModal(null)}
          onSave={async () => {
            try {
              if (activeModal === "personal") {
                // PUT /profile/settings/personal — mirrors PUT /f2h/customers/:id
                await saveProfile("personal", {
                  first_name: draft.first_name,
                  last_name: draft.last_name,
                  email: draft.email,
                  phone: draft.phone,
                  gender: draft.gender,
                  date_of_birth: draft.date_of_birth,
                });
                // Optimistic local update — same pattern as customers
                setFields(prev => ({
                  ...prev,
                  first_name: draft.first_name,
                  last_name: draft.last_name,
                  email: draft.email,
                  phone: draft.phone,
                  gender: draft.gender,
                  date_of_birth: draft.date_of_birth,
                }));
              } else {
                // PUT /profile/settings/address
                await saveProfile("address", {
                  city: draft.city,
                  country: draft.country,
                  state: draft.state,
                  postal_code: draft.pincode,
                });
                // Optimistic local update
                setFields(prev => ({
                  ...prev,
                  city: draft.city,
                  country: draft.country,
                  state: draft.state,
                  pincode: draft.pincode,
                }));
              }

              setActiveModal(null);
              showSuccessToast("Profile updated successfully", 2500);
              onRefresh();
            } catch (e) {
              showErrorToast(e instanceof Error ? e.message : "Failed to save changes", 4000);
            }
          }}
        />
      )}
    </>
  );
};

// ─── ProfileEditModal ─────────────────────────────────────────────────────────
function ProfileEditModal({
  card,
  draft,
  setDraft,
  onClose,
  onSave,
}: {
  card: EditCard;
  draft: {
    first_name: string; last_name: string; email: string;
    phone: string; gender: string; date_of_birth: string;
    city: string; country: string; state: string; pincode: string;
  };
  setDraft: React.Dispatch<React.SetStateAction<{
    first_name: string; last_name: string; email: string;
    phone: string; gender: string; date_of_birth: string;
    city: string; country: string; state: string; pincode: string;
  }>>;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const isPersonal = card === "personal";
  const title = isPersonal ? "Edit Personal Information" : "Edit Additional Information";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-deep-green">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX size={20} />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();

            setIsSaving(true);
            try {
              await onSave();
              showSuccessToast("Profile updated successfully", 2500);
            } catch {
              showErrorToast("Failed to save changes", 4000);
            }
            setIsSaving(false);
          }}
          className="p-6 space-y-4"
        >
          {isPersonal ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    required
                    value={draft.first_name}
                    onChange={(e) => setDraft((d) => ({ ...d, first_name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    value={draft.last_name}
                    onChange={(e) => setDraft((d) => ({ ...d, last_name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    value={draft.phone}
                    onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={draft.gender}
                    onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={toDateInputValue(draft.date_of_birth)}
                    onChange={(e) => setDraft((d) => ({ ...d, date_of_birth: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    value={draft.city}
                    onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    value={draft.country}
                    onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    value={draft.state}
                    onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <input
                    value={draft.pincode}
                    onChange={(e) => setDraft((d) => ({ ...d, pincode: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20"
                  />
                </div>
              </div>
            </>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-fresh-green text-white text-sm font-semibold shadow-sm hover:bg-fresh-green/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── PasswordModal ──────────────────────────────────────────────────────────
function PasswordModal({
  values,
  setValues,
  onClose,
  onSave,
}: {
  values: { current_password: string; new_password: string; confirm_password: string };
  setValues: React.Dispatch<React.SetStateAction<{ current_password: string; new_password: string; confirm_password: string }>>;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-deep-green">Change Password</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX size={20} />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsSaving(true);
            await onSave();
            setIsSaving(false);
          }}
          className="p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={values.current_password}
                onChange={(e) => setValues((v) => ({ ...v, current_password: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20 pr-12"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showCurrent ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={values.new_password}
                  onChange={(e) => setValues((v) => ({ ...v, new_password: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20 pr-12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={values.confirm_password}
                  onChange={(e) => setValues((v) => ({ ...v, confirm_password: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20 pr-12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Min 8 chars · uppercase · lowercase · number or special symbol
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-fresh-green text-white text-sm font-semibold shadow-sm hover:bg-fresh-green/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── SessionsView ─────────────────────────────────────────────────────────────
const SessionsView = ({
  sessions,
  userId,
  sessionSettings,
  onRefresh,
}: {
  sessions: SessionsData | null;
  userId: string | null;
  sessionSettings: { session_timeout?: number; session_warning?: number; max_logins?: number } | null;
  onRefresh: () => void;
}) => {
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ expires_at: string | null; expires_in_seconds: number } | null>(null);
  const [savingSessionSettings, setSavingSessionSettings] = useState(false);

  const current = sessions?.current_device ?? null;
  const deviceHistory = sessions?.device_history ?? [];
  const sessionHistory = sessions?.session_history ?? [];
  const currentDeviceId = current?.device_id || null;
  const timeoutMins = sessionSettings?.session_timeout ?? 120;
  const warningMins = sessionSettings?.session_warning ?? 5;
  const maxLogins = sessionSettings?.max_logins ?? 2;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await api.get<any>("/auth/session-info");
      if (!mounted) return;
      if (data?.authenticated) {
        setSessionInfo({ expires_at: data.expires_at ?? null, expires_in_seconds: data.expires_in_seconds ?? 0 });
      } else {
        setSessionInfo(null);
      }
    })().catch(() => setSessionInfo(null));
    return () => { mounted = false; };
  }, []);

  const logoutAllDevices = async () => {
    if (logoutAllLoading) return;
    setLogoutAllLoading(true);
    try {
      const fingerprintData = await fingerprintService.generateFingerprint();
      const { data, error } = await api.post<any>("/auth/logout-all-devices", { fingerprintData });
      if (error) throw new Error(error);
      showSuccessToast(data?.message || "Logged out from other devices", 3000);
      await onRefresh();
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : "Failed to logout all devices", 5000);
    } finally {
      setLogoutAllLoading(false);
    }
  };

  const logoutSingleDevice = async (deviceRecordId: number) => {
    try {
      const { data, error } = await api.post<any>("/auth/revoke-device", { deviceRecordId });
      if (error) throw new Error(error);
      showSuccessToast(data?.message || "Device revoked", 3000);
      await onRefresh();
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : "Failed to revoke device", 5000);
    }
  };

  const filtered = sessionHistory.filter((d) => {
    const info = parseDeviceInfo(d.device_info);
    const hay = [d.device_name, d.ip_address, info.browser, info.browser_version, info.os, info.device, info.platform]
      .join(" ").toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div className="ps-card-title" style={{ fontSize: 16 }}>Sessions</div>
        <p className="ps-subtitle">View and manage all devices currently logged into your account.</p>
      </div>

      {/* Current session */}
      <div className="ps-card">
        <div className="ps-card-header">
          <div className="ps-card-header-left"><div className="ps-card-dot" /><span className="ps-card-title">Current &amp; Active Sessions</span></div>
        </div>
        <div className="ps-card-body">
          <p className="ps-section-hint"><FiInfo size={13} /> These are devices that are currently logged in using your account.</p>
          {sessionInfo?.expires_at ? (
            <p className="ps-section-hint" style={{ marginTop: 6 }}>
              <FiClock size={11} /> Session expires at: <span className="ps-mono">{formatDateTime(sessionInfo.expires_at)}</span>
            </p>
          ) : null}
          <div className="ps-section-divider" />
          <p className="ps-section-label">Current Logins</p>
          {current ? (() => {
            const info = parseDeviceInfo(current.device_info);
            return (
              <div className="ps-device-current">
                <div className="ps-device-current-left">
                  <div className="ps-device-os-icon"><DeviceIcon device={current} size={22} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div className="ps-device-name">
                      {[info.browser, info.os].filter(Boolean).join(" on ") || "Unknown Device"}
                    </div>
                    <div className="ps-device-meta">
                      <span><FiMapPin size={11} /> {current.ip_address || "—"}</span>
                      <span><FiClock size={11} /> Last active: {timeAgo(current.last_used)}</span>
                      {info.device && <span><FiMonitor size={11} /> {info.device}</span>}
                      {info.browser_version && <span><FiGlobe size={11} /> v{info.browser_version}</span>}
                    </div>
                  </div>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="ps-active-badge"><span className="ps-active-dot" />Active</span>
                  <span className="ps-active-badge" style={{ background: "#eef2ff", color: "#3730a3" }}>This device</span>
                </span>
              </div>
            );
          })() : (
            <p className="ps-section-hint" style={{ color: "#94a3b8" }}>No active session found.</p>
          )}
        </div>
      </div>

      {/* Logout all */}
      <div className="ps-card">
        <div className="ps-card-header">
          <div className="ps-card-header-left"><div className="ps-card-dot" style={{ background: "#ef4444" }} /><span className="ps-card-title">Logout from All Devices</span></div>
        </div>
        <div className="ps-card-body">
          <div className="ps-logout-row">
            <p className="ps-section-hint"><FiInfo size={13} /> This will end all active sessions across all devices except the current one.</p>
            <button className="ps-btn-logout" disabled={logoutAllLoading} onClick={logoutAllDevices}
              style={{ opacity: logoutAllLoading ? 0.75 : 1 }}>
              {logoutAllLoading ? <BtnSpinner /> : <FiLogOut size={14} />}
              {logoutAllLoading ? "Logging out..." : "Logout from All Devices"}
            </button>
          </div>
        </div>
      </div>

      {/* Session settings */}
      <div className="ps-card">
        <div className="ps-card-header">
          <div className="ps-card-header-left"><div className="ps-card-dot" style={{ background: "#f59e0b" }} /><span className="ps-card-title">Session Settings</span></div>
        </div>
        <div className="ps-card-body">
          <p className="ps-section-hint" style={{ marginBottom: 16 }}><FiInfo size={13} /> Manage how long your session stays active and control how many devices can be logged in at the same time.</p>
          <div className="ps-session-settings-row">
            <div className="ps-select-wrap">
              <label className="ps-select-label">Session Timeout</label>
              <select className="ps-select" value={String(timeoutMins)} disabled>
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes</option>
                <option value="60">1 Hour</option>
                <option value="120">2 Hours</option>
              </select>
            </div>
            <div className="ps-select-wrap">
              <label className="ps-select-label">Session Warning</label>
              <select className="ps-select" value={String(warningMins)} disabled>
                <option value="3">3 Minutes</option>
                <option value="5">5 Minutes</option>
                <option value="10">10 Minutes</option>
              </select>
            </div>
            <div className="ps-select-wrap">
              <label className="ps-select-label">Max Logins</label>
              <input className="ps-input" type="number" value={maxLogins} readOnly style={{ width: 100 }} />
            </div>
            <button
              className="ps-btn-gradient btn"
              style={{ alignSelf: "flex-end", padding: "9px 22px" }}
              disabled={!userId || savingSessionSettings}
              onClick={async () => {
                if (!userId || savingSessionSettings) return;
                setSavingSessionSettings(true);
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {savingSessionSettings ? <BtnSpinner /> : null}
                <span>Update</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Device history */}
      <div className="ps-card">
        <div className="ps-card-header">
          <div className="ps-card-header-left"><div className="ps-card-dot" style={{ background: "#22c55e" }} /><span className="ps-card-title">Device History</span></div>
        </div>
        <div className="ps-card-body">
          <p className="ps-section-hint" style={{ marginBottom: 16 }}><FiInfo size={13} /> These are the devices you've previously logged in from.</p>
          {deviceHistory.length === 0 ? (
            <p className="ps-section-hint" style={{ color: "#94a3b8" }}>No device history found.</p>
          ) : (
            <div className="ps-device-grid">
              {deviceHistory.map((d) => {
                const info = parseDeviceInfo(d.device_info);
                return (
                  <div key={d.id} className="ps-device-card" style={{ minWidth: 0, overflow: "hidden" }}>
                    <div className="ps-device-os-icon ps-device-os-icon-sm" style={{ flexShrink: 0 }}><DeviceIcon device={d} size={18} /></div>
                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                      <div className="ps-device-name" style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {[info.browser, info.os].filter(Boolean).join(" on ") || "Unknown Device"}
                      </div>
                      <div className="ps-device-meta">
                        <span><FiMapPin size={11} /> {d.ip_address || "—"}</span>
                        <span><FiClock size={11} /> {timeAgo(d.last_used)}</span>
                        {info.device && <span><FiMonitor size={11} /> {info.device}</span>}
                      </div>
                    </div>
                    <div className="ps-device-used" style={{ flexShrink: 0 }}>
                      <span className="ps-used-label">First login</span>
                      <span className="ps-used-first">{formatDateTime(d.created_at)}</span>
                      <span className="ps-used-first" style={{ color: d.revoked_at ? "#ef4444" : "#22c55e" }}>
                        {d.revoked_at ? `Revoked ${formatDate(d.revoked_at)}` : "Active"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Session history table */}
      <div className="ps-card">
        <div className="ps-card-header">
          <div className="ps-card-header-left"><div className="ps-card-dot" style={{ background: "#a855f7" }} /><span className="ps-card-title">Session History</span></div>
        </div>
        <div className="ps-card-body">
          <p className="ps-section-hint" style={{ marginBottom: 16 }}><FiInfo size={13} /> Complete log of all device sessions for your account.</p>
          <div className="ps-table-controls">
            <div className="ps-table-left">
              <span style={{ fontSize: 13, color: "#6b7692" }}>Showing</span>
              <select className="ps-select-sm" value={perPage} onChange={(e) => setPerPage(+e.target.value)}>
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
              </select>
              <span style={{ fontSize: 13, color: "#6b7692" }}>entries per page</span>
            </div>
            <div className="ps-table-right">
              <input className="ps-search-input" type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="ps-icon-btn" onClick={() => setSearch("")}><FiRefreshCw size={14} /></button>
              <button className="ps-icon-btn"><FiFilter size={14} /></button>
            </div>
          </div>
          <div className="ps-table-wrap">
            <table className="ps-session-table">
              <thead>
                <tr><th>Id ↕</th><th>Device</th><th>IP Address</th><th>First Login ↕</th><th>Last Used ↕</th><th>Status</th><th>Actions</th><th>Device Info</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>No sessions found.</td></tr>
                ) : filtered.slice(0, perPage).map((d) => {
                  const info = parseDeviceInfo(d.device_info);
                  const revoked = !!d.revoked_at;
                  const active = !revoked && (d.is_active === 1 || d.is_active === true);
                  const isThisDevice = !!currentDeviceId && d.device_id === currentDeviceId;
                  return (
                    <tr key={d.id}>
                      <td>{d.id}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <DeviceIcon device={d} size={14} />
                          <span style={{ fontSize: 12 }}>{d.device_name || info.browser || "Unknown"}</span>
                          {isThisDevice ? <span className="ps-active-badge" style={{ marginLeft: 6, background: "#eef2ff", color: "#3730a3" }}>This device</span> : null}
                        </div>
                      </td>
                      <td className="ps-mono">{d.ip_address || "—"}</td>
                      <td className="ps-mono" style={{ fontSize: 11 }}>{formatDateTime(d.created_at)}</td>
                      <td className="ps-mono" style={{ fontSize: 11 }}>{formatDateTime(d.last_used)}</td>
                      <td>
                        <span className={`ps-event-badge ps-event-${active ? "login" : "logout"}`}>
                          {active ? "active" : revoked ? "revoked" : "inactive"}
                        </span>
                      </td>
                      <td>
                        {!revoked && !isThisDevice ? (
                          <button className="ps-btn-outline-danger" style={{ padding: "6px 10px", fontSize: 12 }}
                            onClick={() => logoutSingleDevice(d.id)}>
                            Logout
                          </button>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        <div className="ps-device-info">
                          {info.browser && <span><FiMonitor size={11} color="#6366f1" /> <strong>Browser:</strong> {info.browser} {info.browser_version}</span>}
                          {info.os && <span><BsWindows size={11} color="#0078d4" /> <strong>OS:</strong> {info.os}</span>}
                          {info.device && <span><FiSettings size={11} color="#f59e0b" /> <strong>Device:</strong> {info.device}</span>}
                          {info.platform && <span><FiSmartphone size={11} color="#a855f7" /> <strong>Platform:</strong> {info.platform}</span>}
                          {info.timezone && <span><FiClock size={11} color="#22c55e" /> <strong>TZ:</strong> {info.timezone}</span>}
                          {info.screen_resolution && <span><FiMonitor size={11} color="#94a3b8" /> <strong>Screen:</strong> {info.screen_resolution}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Account Activity */}
      <div className="ps-card">
        <div className="ps-card-header">
          <div className="ps-card-header-left"><div className="ps-card-dot" style={{ background: "#ec4899" }} /><span className="ps-card-title">Account Activity Log</span></div>
        </div>
        <div className="ps-card-body">
          <p className="ps-section-hint" style={{ marginBottom: 16 }}><FiInfo size={13} /> Review recent activity and security events on your account.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { time: "2 hours ago", event: "Login", desc: "Successful login from Chrome on Windows", ip: "203.0.113.45", status: "success" },
              { time: "5 hours ago", event: "Password Changed", desc: "Account password was changed", ip: "203.0.113.45", status: "warning" },
              { time: "1 day ago", event: "2FA Disabled", desc: "Two-Factor Authentication was disabled", ip: "192.0.2.89", status: "warning" },
              { time: "2 days ago", event: "Device Added", desc: "New device registered: Safari on iPhone", ip: "198.51.100.23", status: "info" },
              { time: "5 days ago", event: "Login", desc: "Successful login from Firefox on Linux", ip: "203.0.113.12", status: "success" },
            ].map((activity, idx) => (
              <div key={idx} style={{ padding: "12px", borderLeft: "3px solid", borderLeftColor: activity.status === "success" ? "#22c55e" : activity.status === "warning" ? "#f59e0b" : "#3b82f6", backgroundColor: activity.status === "success" ? "#f0fdf4" : activity.status === "warning" ? "#fffbeb" : "#eff6ff", borderRadius: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontSize: "13px", color: "#1f2937" }}>{activity.event}</strong>
                    <span style={{ fontSize: "11px", color: "#6b7280", backgroundColor: "white", padding: "2px 6px", borderRadius: "3px" }}>{activity.status === "success" ? "✓" : activity.status === "warning" ? "⚠" : "ℹ"}</span>
                  </div>
                  <span style={{ fontSize: "11px", color: "#6b7280" }}>{activity.time}</span>
                </div>
                <p style={{ fontSize: "12px", color: "#4b5563", margin: "4px 0" }}>{activity.desc}</p>
                <span style={{ fontSize: "11px", color: "#6b7280" }}>IP: {activity.ip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── SecurityView ─────────────────────────────────────────────────────────────
const SecurityView = ({
  profile,
  onRefresh,
  onTabChange,
}: {
  profile: ProfileData | null;
  onRefresh: () => void;
  onTabChange?: (tab: Tab) => void;
}) => {
  const [autoLogout, setAutoLogout] = useState(true);
  const [logoutAllDevices, setLogoutAllDevices] = useState(true);
  const [loadingCard, setLoadingCard] = useState<EditCard>(null);
  const [activeModal, setActiveModal] = useState<EditCard>(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const openPopup = async (card: EditCard) => {
    if (!card || loadingCard) return;
    setLoadingCard(card);
    if (card === "change_password") {
      setActiveModal(card);
    }
    setTimeout(() => setLoadingCard(null), 600);
  };

  const BtnSpinner = () => (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"
      style={{ animation: "ps-spin 0.7s linear infinite", flexShrink: 0 }}>
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div className="ps-card-title" style={{ fontSize: 16 }}>Security Settings</div>
        <p className="ps-subtitle">Manage your password and other security settings to protect your account.</p>
      </div>

      <div className="ps-card">
        <div className="ps-card-header">
          <div className="ps-card-header-left">
            <div className="ps-card-dot" style={{ background: "#8b5cf6" }} />
            <span className="ps-card-title">Account Security</span>
          </div>
        </div>
        <div className="ps-pref-body">
          <div className="ps-sec-row">
            <div className="ps-pref-icon ps-pref-icon--purple"><FiLock size={17} color="#8b5cf6" /></div>
            <div className="ps-pref-text">
              <div className="ps-pref-title">Password</div>
              <div className="ps-pref-desc">
                Last Changed:{" "}
                <strong>
                  {profile?.password_changed_at
                    ? formatDateTime(profile.password_changed_at)
                    : "Never"}
                </strong>
              </div>
            </div>
            <div className="ps-pref-control">
              <button className="ps-btn-outline ps-btn-sm" onClick={() => openPopup("change_password")} disabled={loadingCard !== null} style={{ opacity: loadingCard !== null && loadingCard !== "change_password" ? 0.5 : 1 }}>
                {loadingCard === "change_password" ? <><BtnSpinner /> Loading...</> : <><FiKey size={13} /> Change Password</>}
              </button>
            </div>
          </div>
          <div className="ps-sec-row">
            <div className="ps-pref-icon ps-pref-icon--green"><FiSmartphone size={17} color="#22c55e" /></div>
            <div className="ps-pref-text">
              <div className="ps-pref-title">Phone Number</div>
              <div className="ps-pref-desc">The phone number associated with the account</div>
            </div>
            <div className="ps-pref-control">
              <span className="ps-sec-value">{profile?.phone || "—"}</span>
              {profile?.phone && <span className="ps-badge-success"><span className="ps-badge-dot" /> Verified</span>}
            </div>
          </div>
          <div className="ps-sec-row">
            <div className="ps-pref-icon ps-pref-icon--yellow"><FiMail size={17} color="#f59e0b" /></div>
            <div className="ps-pref-text">
              <div className="ps-pref-title">Email Address</div>
              <div className="ps-pref-desc">The email address associated with the account</div>
            </div>
            <div className="ps-pref-control">
              <span className="ps-sec-value">{profile?.email || "—"}</span>
              {profile?.email && <span className="ps-badge-success"><span className="ps-badge-dot" /> Verified</span>}
            </div>
          </div>
          <div className="ps-sec-row">
            <div className="ps-pref-icon ps-pref-icon--pink"><FiMonitor size={17} color="#ec4899" /></div>
            <div className="ps-pref-text">
              <div className="ps-pref-title">Device Management</div>
              <div className="ps-pref-desc">The devices associated with the account</div>
            </div>
            <div className="ps-pref-control">
              <button className="ps-btn-outline ps-btn-sm" onClick={() => onTabChange?.('sessions')}>
                <FiSettings size={13} /> Manage
              </button>
            </div>
          </div>
          <div className="ps-sec-row">
            <div className="ps-pref-icon ps-pref-icon--blue"><FiActivity size={17} color="#3b82f6" /></div>
            <div className="ps-pref-text">
              <div className="ps-pref-title">Account Activity</div>
              <div className="ps-pref-desc">Review recent activity on your account</div>
            </div>
            <div className="ps-pref-control">
              <button className="ps-btn-outline ps-btn-sm" onClick={() => onTabChange?.('sessions')}>
                <FiEye size={13} /> View
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="ps-card">
        <div className="ps-card-header">
          <div className="ps-card-header-left">
            <div className="ps-card-dot" style={{ background: "#f59e0b" }} />
            <span className="ps-card-title">Authentication Settings</span>
          </div>
        </div>
        <div className="ps-pref-body">
          <p className="ps-section-hint" style={{ marginBottom: 14 }}><FiInfo size={13} /> Customize account security and session behaviour.</p>
          <div className="ps-sec-row ps-sec-row--toggle">
            <div className="ps-pref-icon ps-pref-icon--yellow"><FiRefreshCw size={17} color="#f59e0b" /></div>
            <div className="ps-pref-text">
              <div className="ps-pref-title">Auto Logout on Password Change</div>
              <div className="ps-pref-desc">Log out from all devices when password changes</div>
            </div>
            <div className="ps-pref-control">
              <label className="ps-switch">
                <input type="checkbox" checked={autoLogout} onChange={e => setAutoLogout(e.target.checked)} />
                <span className="ps-switch-slider" />
              </label>
            </div>
          </div>
          <div className="ps-sec-row ps-sec-row--toggle">
            <div className="ps-pref-icon ps-pref-icon--pink"><FiLogOut size={17} color="#ec4899" /></div>
            <div className="ps-pref-text">
              <div className="ps-pref-title">Allow Logout from All Devices</div>
              <div className="ps-pref-desc">Enable manual logout from all sessions</div>
            </div>
            <div className="ps-pref-control">
              <label className="ps-switch">
                <input type="checkbox" checked={logoutAllDevices} onChange={e => setLogoutAllDevices(e.target.checked)} />
                <span className="ps-switch-slider" />
              </label>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button className="ps-btn-gradient btn" style={{ padding: "9px 24px" }}>Save Preferences</button>
          </div>
        </div>
      </div>

      <div className="ps-card ps-card--danger">
        <div className="ps-card-header">
          <div className="ps-card-header-left">
            <div className="ps-card-dot" style={{ background: "#ef4444" }} />
            <span className="ps-card-title">Danger Zone</span>
          </div>
        </div>
        <div className="ps-pref-body">
          <div className="ps-sec-row ps-sec-row--warning">
            <div className="ps-pref-icon ps-pref-icon--yellow"><MdPersonOff size={17} color="#f59e0b" /></div>
            <div className="ps-pref-text">
              <div className="ps-pref-title">Deactivate Account</div>
              <div className="ps-pref-desc">This will immediately disable the user's access to the system.</div>
              <div className="ps-danger-warning"><FiAlertTriangle size={12} /> The user will no longer be able to log in, perform actions, or use any assigned roles.</div>
            </div>
            <div className="ps-pref-control">
              <button className="ps-btn-outline ps-btn-sm ps-btn-outline--warning" onClick={() => openPopup('deactivate_account')} disabled={loadingCard !== null} style={{ opacity: loadingCard !== null && loadingCard !== 'deactivate_account' ? 0.5 : 1 }}>
                {loadingCard === 'deactivate_account' ? <><BtnSpinner /> Loading...</> : <><MdPowerSettingsNew size={13} /> Deactivate</>}
              </button>
            </div>
          </div>
          <div className="ps-section-divider" />
          <div className="ps-sec-row ps-sec-row--danger">
            <div className="ps-pref-icon ps-pref-icon--red"><FiTrash2 size={17} color="#ef4444" /></div>
            <div className="ps-pref-text">
              <div className="ps-pref-title ps-pref-title--danger">Delete Account</div>
              <div className="ps-pref-desc">Permanently delete account and all associated data.</div>
              <div className="ps-danger-warning"><FiAlertTriangle size={12} /> This action is irreversible.</div>
            </div>
            <div className="ps-pref-control">
              <button className="ps-btn-outline-danger ps-btn-sm" onClick={() => openPopup('delete_account')} disabled={loadingCard !== null} style={{ opacity: loadingCard !== null && loadingCard !== 'delete_account' ? 0.5 : 1 }}>
                {loadingCard === 'delete_account' ? <><BtnSpinner /> Loading...</> : <><FiTrash2 size={13} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeModal === "change_password" && (
        <PasswordModal
          values={passwordForm}
          setValues={setPasswordForm}
          onClose={() => setActiveModal(null)}
          onSave={async () => {
            try {
              const { data, error } = await api.put<any>("/profile/settings/password", passwordForm);
              if (error || !data?.success) {
                throw new Error(data?.message || error || "Failed to update password");
              }
              setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
              setActiveModal(null);
              showSuccessToast(data?.message || "Password updated successfully", 2500);
              onRefresh();
            } catch (e) {
              showErrorToast(e instanceof Error ? e.message : "Failed to update password", 4000);
            }
          }}
        />
      )}
    </>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const GeneralSettingsPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [sessions, setSessions] = useState<SessionsData | null>(null);

  const fetchProfile = async () => {
    const { data, error } = await api.get<any>("/profile/settings");
    if (error || !data?.status) return;
    const p = data?.data?.profile;
    const s = data?.data?.sessions;
    if (p) setProfile(p);
    if (s) setSessions(s);
  };

  useEffect(() => {
    if (activeTab === "profile" || activeTab === "sessions" || activeTab === "security") {
      fetchProfile();
    }
  }, [activeTab]);

  return (
    <div className="page-wrapper">
      <div className="content">
        <div style={{ marginBottom: 16 }}>
          <Breadcrumb
            title="Settings"
            items={[
              { icon: <HomeIcon size={13} /> },
              { label: "Delivery" },
              { label: "Settings" },
            ]}
          />
        </div>
        <div className="ps-layout">
          <aside className="ps-sidebar">
            <div className="ps-nav-label">Settings</div>
            {navItems.map((item) => (
              <button key={item.key} className={`ps-nav-item${activeTab === item.key ? " ps-active" : ""}`} onClick={() => setActiveTab(item.key)}>
                {item.label}
              </button>
            ))}
          </aside>
          <main className="ps-main">
            <div className="ps-mobile-tabs">
              <a href="#" className="ps-mb-home-tab"><FiHome size={14} /></a>
              <span className="ps-mb-arrow">›</span>
              {navItems.map((item) => (
                <button key={item.key} className={`ps-mobile-tab${activeTab === item.key ? " ps-active" : ""}`} onClick={() => setActiveTab(item.key)}>
                  {item.label}
                </button>
              ))}
            </div>
            {activeTab === "profile" && <ProfileView profile={profile} onRefresh={fetchProfile} />}
            {activeTab === "security" && <SecurityView profile={profile} onRefresh={fetchProfile} onTabChange={setActiveTab} />}
            {activeTab === "sessions" && (
              <SessionsView
                sessions={sessions}
                userId={profile?.user_id ? String(profile.user_id) : null}
                sessionSettings={profile}
                onRefresh={fetchProfile}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default GeneralSettingsPage;
