"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Facebook,
  FileCheck,
  FileText,
  Globe,
  Globe2,
  Home,
  ImageIcon,
  Instagram,
  Layers,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Receipt,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/components/Toast";
import { api } from "@/services/api.client";

interface CompanyProfileForm {
  name: string;
  legal_name: string;
  gst_number: string;
  pan_number: string;
  email: string;
  phone: string;
  secondary_phone: string;
  whatsapp: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  logo_url: string;
  website: string;
  instagram_url: string;
  facebook_url: string;
  youtube_url: string;
}

interface CompanyProfileResponse {
  status: boolean;
  message?: string;
  data?: Partial<CompanyProfileForm> | null;
}

type ProfileField = keyof CompanyProfileForm;
type FieldErrors = Partial<Record<ProfileField, string>>;

interface FieldConfig {
  key: ProfileField;
  label: string;
  placeholder: string;
  type?: "text" | "email" | "tel" | "url";
  inputMode?: "email" | "numeric" | "tel" | "url";
  autoComplete?: string;
  hint?: string;
  maxLength?: number;
  required?: boolean;
  textarea?: boolean;
  wide?: boolean;
  icon?: LucideIcon;
}

interface SectionConfig {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  fields: FieldConfig[];
}

const EMPTY_FORM: CompanyProfileForm = {
  name: "",
  legal_name: "",
  gst_number: "",
  pan_number: "",
  email: "",
  phone: "",
  secondary_phone: "",
  whatsapp: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  logo_url: "",
  website: "",
  instagram_url: "",
  facebook_url: "",
  youtube_url: "",
};

const SECTIONS: SectionConfig[] = [
  {
    id: "brand",
    title: "Brand & Identity",
    description: "Public company name, logo, and primary portal URL used across customer apps and storefront.",
    icon: Building2,
    badge: "Public Brand",
    fields: [
      {
        key: "name",
        label: "Company / Brand Name",
        placeholder: "e.g. F2H Fresh",
        autoComplete: "organization",
        maxLength: 200,
        required: true,
        icon: Building2,
        hint: "Displayed in navbar, customer headers, emails, and footers.",
      },
      {
        key: "website",
        label: "Primary Portal Website URL",
        placeholder: "https://f2hfresh.com",
        type: "url",
        inputMode: "url",
        autoComplete: "url",
        maxLength: 500,
        icon: Globe,
        hint: "Official website domain link for customers.",
      },
      {
        key: "logo_url",
        label: "Brand Logo Image URL",
        placeholder: "https://f2hfresh.com/assets/logo.png",
        type: "url",
        inputMode: "url",
        autoComplete: "url",
        maxLength: 500,
        wide: true,
        icon: ImageIcon,
        hint: "Provide a public HTTPS image URL (PNG, WEBP, or SVG). Will display in navbar, footer, and invoices.",
      },
    ],
  },
  {
    id: "legal",
    title: "Legal & Taxation",
    description: "Registered enterprise name, GSTIN, and tax identifiers printed on customer invoices and receipts.",
    icon: FileText,
    badge: "Official Registry",
    fields: [
      {
        key: "legal_name",
        label: "Registered Legal Entity Name",
        placeholder: "e.g. F2H Fresh Agro Private Limited",
        autoComplete: "organization",
        maxLength: 200,
        wide: true,
        icon: FileCheck,
        hint: "Official incorporated company name used for formal compliance.",
      },
      {
        key: "gst_number",
        label: "GSTIN Number",
        placeholder: "29ABCDE1234F1Z5",
        maxLength: 20,
        icon: ShieldCheck,
        hint: "15-digit GST identification number.",
      },
      {
        key: "pan_number",
        label: "Permanent Account Number (PAN)",
        placeholder: "ABCDE1234F",
        maxLength: 15,
        icon: Receipt,
        hint: "10-digit Indian Income Tax PAN.",
      },
    ],
  },
  {
    id: "contact",
    title: "Public Support & Contact Channels",
    description: "Customer service touchpoints displayed in the footer, Contact Us section, and help screens.",
    icon: Phone,
    badge: "Customer Help",
    fields: [
      {
        key: "email",
        label: "Customer Support Email",
        placeholder: "support@f2hfresh.com",
        type: "email",
        inputMode: "email",
        autoComplete: "email",
        maxLength: 254,
        icon: Mail,
        hint: "Primary email address for customer tickets and inquiries.",
      },
      {
        key: "phone",
        label: "Primary Support Phone",
        placeholder: "+91 91487 73591",
        type: "tel",
        inputMode: "tel",
        autoComplete: "tel",
        maxLength: 20,
        icon: Phone,
        hint: "Direct customer hotline.",
      },
      {
        key: "secondary_phone",
        label: "Secondary / Alternate Helpline",
        placeholder: "+91 79893 68142",
        type: "tel",
        inputMode: "tel",
        autoComplete: "tel",
        maxLength: 20,
        icon: Phone,
        hint: "Backup contact phone number.",
      },
      {
        key: "whatsapp",
        label: "WhatsApp Support Number",
        placeholder: "+91 91487 73591",
        type: "tel",
        inputMode: "tel",
        autoComplete: "tel",
        maxLength: 20,
        icon: MessageCircle,
        hint: "Enables one-tap WhatsApp chat on storefront and app.",
      },
    ],
  },
  {
    id: "address",
    title: "Registered Office Address",
    description: "Physical location rendered in footer, Contact Us cards, and legal terms.",
    icon: MapPin,
    badge: "Physical Location",
    fields: [
      {
        key: "address",
        label: "Complete Street / Building Address",
        placeholder: "1st Cross, SJP Layout, Nagondanahalli, Whitefield",
        autoComplete: "street-address",
        maxLength: 1000,
        textarea: true,
        wide: true,
        icon: MapPin,
        hint: "Building number, street, area, and landmark.",
      },
      {
        key: "city",
        label: "City / District",
        placeholder: "Bangalore",
        autoComplete: "address-level2",
        maxLength: 100,
      },
      {
        key: "state",
        label: "State / Province",
        placeholder: "Karnataka",
        autoComplete: "address-level1",
        maxLength: 100,
      },
      {
        key: "pincode",
        label: "Postal PIN Code",
        placeholder: "560066",
        inputMode: "numeric",
        autoComplete: "postal-code",
        maxLength: 6,
      },
    ],
  },
  {
    id: "socials",
    title: "Social Media Channels",
    description: "Official social profile links shown in footer icons and marketing materials.",
    icon: Globe2,
    badge: "Social Media",
    fields: [
      {
        key: "instagram_url",
        label: "Instagram Profile URL",
        placeholder: "https://instagram.com/f2hfresh",
        type: "url",
        inputMode: "url",
        maxLength: 500,
        icon: Instagram,
        hint: "Full Instagram profile link.",
      },
      {
        key: "facebook_url",
        label: "Facebook Page URL",
        placeholder: "https://facebook.com/f2hfresh",
        type: "url",
        inputMode: "url",
        maxLength: 500,
        icon: Facebook,
        hint: "Official Facebook page URL.",
      },
      {
        key: "youtube_url",
        label: "YouTube Channel URL",
        placeholder: "https://youtube.com/@f2hfresh",
        type: "url",
        inputMode: "url",
        maxLength: 500,
        wide: true,
        icon: Youtube,
        hint: "Official YouTube video channel URL.",
      },
    ],
  },
];

const PROFILE_FIELDS = SECTIONS.flatMap((section) => section.fields.map((field) => field.key));

function normalizeProfile(profile?: Partial<CompanyProfileForm> | null): CompanyProfileForm {
  return {
    name: profile?.name ?? "",
    legal_name: profile?.legal_name ?? "",
    gst_number: profile?.gst_number ?? "",
    pan_number: profile?.pan_number ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    secondary_phone: profile?.secondary_phone ?? "",
    whatsapp: profile?.whatsapp ?? "",
    address: profile?.address ?? "",
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    pincode: profile?.pincode ?? "",
    logo_url: profile?.logo_url ?? "",
    website: profile?.website ?? "",
    instagram_url: profile?.instagram_url ?? "",
    facebook_url: profile?.facebook_url ?? "",
    youtube_url: profile?.youtube_url ?? "",
  };
}

function trimProfile(profile: CompanyProfileForm): CompanyProfileForm {
  return {
    name: profile.name.trim(),
    legal_name: profile.legal_name.trim(),
    gst_number: profile.gst_number.trim(),
    pan_number: profile.pan_number.trim(),
    email: profile.email.trim(),
    phone: profile.phone.trim(),
    secondary_phone: profile.secondary_phone.trim(),
    whatsapp: profile.whatsapp.trim(),
    address: profile.address.trim(),
    city: profile.city.trim(),
    state: profile.state.trim(),
    pincode: profile.pincode.trim(),
    logo_url: profile.logo_url.trim(),
    website: profile.website.trim(),
    instagram_url: profile.instagram_url.trim(),
    facebook_url: profile.facebook_url.trim(),
    youtube_url: profile.youtube_url.trim(),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateField(field: ProfileField, rawValue: string): string | undefined {
  const value = rawValue.trim();
  if (field === "name" && !value) return "Company name is required.";
  if (field === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";

  if (["phone", "secondary_phone", "whatsapp"].includes(field) && value) {
    const digits = value.replace(/\D/g, "").length;
    if (!/^[+\d\s().-]+$/.test(value) || digits < 7 || digits > 15) {
      return "Enter a valid phone number with 7 to 15 digits.";
    }
  }

  if (field === "pincode" && value && !/^\d{6}$/.test(value)) return "Enter a 6-digit postal pincode.";

  const urlFields: ProfileField[] = ["logo_url", "website", "instagram_url", "facebook_url", "youtube_url"];
  if (urlFields.includes(field) && value && !isHttpUrl(value)) {
    return "Enter a full URL beginning with http:// or https://.";
  }

  return undefined;
}

function validateProfile(profile: CompanyProfileForm): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of PROFILE_FIELDS) {
    const error = validateField(field, profile[field]);
    if (error) errors[field] = error;
  }
  return errors;
}

function formattedAddress(profile: CompanyProfileForm): string {
  return [profile.address, profile.city, profile.state, profile.pincode]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
}

function FieldControl({
  config,
  value,
  error,
  onChange,
  onBlur,
}: {
  config: FieldConfig;
  value: string;
  error?: string;
  onChange: (field: ProfileField, value: string) => void;
  onBlur: (field: ProfileField) => void;
}) {
  const id = `company-${config.key}`;
  const describedBy = error ? `${id}-error` : config.hint ? `${id}-hint` : undefined;
  const IconComp = config.icon;

  const controlClass = error
    ? "w-full rounded-2xl border border-rose-300 bg-rose-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 font-medium"
    : "w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 font-medium";

  return (
    <div className={`space-y-1.5 ${config.wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          {IconComp && <IconComp size={13} className="text-slate-400" />}
          {config.label}
          {config.required ? <span className="text-rose-500 font-bold" aria-hidden="true">*</span> : null}
        </label>
        {config.maxLength && (
          <span className="text-[10px] text-slate-400 font-mono">
            {value.length}/{config.maxLength}
          </span>
        )}
      </div>

      {config.hint ? <p id={`${id}-hint`} className="text-[11px] text-slate-400 leading-tight">{config.hint}</p> : null}

      {config.textarea ? (
        <textarea
          id={id}
          name={config.key}
          value={value}
          onChange={(event) => onChange(config.key, event.target.value)}
          onBlur={() => onBlur(config.key)}
          placeholder={config.placeholder}
          autoComplete={config.autoComplete}
          maxLength={config.maxLength}
          rows={3}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`${controlClass} resize-y min-h-[84px]`}
        />
      ) : (
        <div className="relative">
          <input
            id={id}
            name={config.key}
            type={config.type ?? "text"}
            value={value}
            onChange={(event) => onChange(config.key, event.target.value)}
            onBlur={() => onBlur(config.key)}
            placeholder={config.placeholder}
            autoComplete={config.autoComplete}
            inputMode={config.inputMode}
            maxLength={config.maxLength}
            required={config.required}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={controlClass}
          />
        </div>
      )}
      {error ? <p id={`${id}-error`} className="text-xs font-bold text-rose-600 flex items-center gap-1 mt-1"><AlertCircle size={12} /> {error}</p> : null}
    </div>
  );
}

function SectionCard({
  section,
  children,
}: {
  section: SectionConfig;
  children: ReactNode;
}) {
  const Icon = section.icon;
  return (
    <section id={section.id} className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs transition duration-200">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 shadow-2xs">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900">{section.title}</h2>
              {section.badge && (
                <span className="px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 text-[10px] font-bold">
                  {section.badge}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{section.description}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 sm:p-6">{children}</div>
    </section>
  );
}

export default function CompanyProfilePage() {
  const [form, setForm] = useState<CompanyProfileForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [previewMode, setPreviewMode] = useState<"footer" | "contact" | "receipt">("footer");

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setStatusMessage("Loading company profile.");

    const response = await api.get<CompanyProfileResponse>("/admin/profile/company");
    if (response.error || response.data?.status === false) {
      const message = response.error || response.data?.message || "Unable to load the company profile.";
      setLoadError(message);
      setStatusMessage(message);
      showErrorToast(message);
      setLoading(false);
      return;
    }

    setForm(normalizeProfile(response.data?.data));
    setFieldErrors({});
    setSaved(false);
    setLoaded(true);
    setStatusMessage("Company profile loaded.");
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleChange = (field: ProfileField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSaved(false);
    setStatusMessage("");
  };

  const handleBlur = (field: ProfileField) => {
    setFieldErrors((current) => ({ ...current, [field]: validateField(field, form[field]) }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const errors = validateProfile(form);
    setFieldErrors(errors);
    const firstInvalidField = PROFILE_FIELDS.find((field) => errors[field]);
    if (firstInvalidField) {
      const message = "Please check highlighted fields before saving.";
      setStatusMessage(message);
      showErrorToast(message);
      requestAnimationFrame(() => document.getElementById(`company-${firstInvalidField}`)?.focus());
      return;
    }

    const payload = trimProfile(form);
    setSaving(true);
    setSaved(false);
    setStatusMessage("Saving company profile.");

    const response = await api.put<CompanyProfileResponse>("/admin/profile/company", payload);
    if (response.error || response.data?.status === false) {
      const message = response.error || response.data?.message || "Unable to save the company profile.";
      setStatusMessage(message);
      showErrorToast(message);
      setSaving(false);
      return;
    }

    setForm(normalizeProfile(response.data?.data ?? payload));
    setSaved(true);
    setStatusMessage("Company profile saved successfully.");
    showSuccessToast("Company profile saved! Changes are now live on storefront, footer & receipts.");
    setSaving(false);
  };

  // Completion calculation
  const completionPercentage = useMemo(() => {
    const totalFields = PROFILE_FIELDS.length;
    const filledCount = PROFILE_FIELDS.filter((f) => Boolean(form[f]?.trim())).length;
    return Math.round((filledCount / totalFields) * 100);
  }, [form]);

  const addressPreview = formattedAddress(form);
  const logoPreview = isHttpUrl(form.logo_url.trim()) ? form.logo_url.trim() : "";
  const socialLinks = [
    { label: "Instagram", value: form.instagram_url, icon: <Instagram className="h-3.5 w-3.5" /> },
    { label: "Facebook", value: form.facebook_url, icon: <Facebook className="h-3.5 w-3.5" /> },
    { label: "YouTube", value: form.youtube_url, icon: <Youtube className="h-3.5 w-3.5" /> },
  ].filter((link) => isHttpUrl(link.value.trim()));

  const filteredSections = activeTab === "all" ? SECTIONS : SECTIONS.filter((s) => s.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-2xs">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
            <Link href="/admin" className="flex items-center gap-1 transition hover:text-slate-800">
              <Home className="h-3.5 w-3.5" aria-hidden="true" /> Admin
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-400" aria-hidden="true" />
            <span className="text-slate-400">Settings</span>
            <ChevronRight className="h-3 w-3 text-slate-400" aria-hidden="true" />
            <span className="font-semibold text-slate-800" aria-current="page">Company Profile</span>
          </nav>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
                <Building2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                    Company &amp; Brand Profile
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold tracking-wide">
                    Live Dynamic Sync
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Changes made here dynamically reflect on the storefront footer, Contact Us section, and invoice receipts.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
              >
                <ExternalLink size={13} className="text-slate-500" />
                <span>View Live Site</span>
              </a>

              <button
                type="button"
                onClick={() => void fetchProfile()}
                disabled={loading || saving}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin text-emerald-600" : "h-3.5 w-3.5"} />
                <span>{loading && loaded ? "Refreshing…" : "Refresh"}</span>
              </button>

              <button
                type="submit"
                form="company-profile-form"
                disabled={saving || loading || !loaded}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98]"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{saving ? "Saving Changes…" : saved ? "Saved Live!" : "Save Profile"}</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation Filter */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80"
              }`}
            >
              <Layers size={13} />
              All Sections ({SECTIONS.length})
            </button>
            {SECTIONS.map((sec) => {
              const SecIcon = sec.icon;
              const isSelected = activeTab === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveTab(sec.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80"
                  }`}
                >
                  <SecIcon size={13} />
                  {sec.title}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {loading && !loaded ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white text-sm text-slate-500 shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <span className="font-semibold text-slate-700">Loading company profile details…</span>
          </div>
        ) : !loaded ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
            <h2 className="mt-4 text-base font-bold text-slate-900">Company profile could not be loaded</h2>
            <p className="mt-2 text-sm text-slate-600">{loadError || "Please check your network and try again."}</p>
            <button
              type="button"
              onClick={() => void fetchProfile()}
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <RefreshCw className="h-4 w-4" /> Retry Loading
            </button>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            {/* Left Form Column */}
            <div className="space-y-6">
              {/* Dynamic Notification Banner */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-white border border-emerald-200 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">Dynamic Storefront Sync is Active</h4>
                    <p className="text-[11px] text-emerald-800">
                      When you save, the landing footer, Contact Us page, and invoice header instantly update with these values.
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end shrink-0">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Profile Health</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-24 h-2 bg-emerald-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${completionPercentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-extrabold text-emerald-900">{completionPercentage}%</span>
                  </div>
                </div>
              </div>

              {saved ? (
                <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3.5 text-sm font-bold text-emerald-900 shadow-2xs animate-in fade-in duration-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
                  <span>Company profile updated successfully! Values are now active across public endpoints.</span>
                </div>
              ) : null}

              <form id="company-profile-form" noValidate onSubmit={handleSave} className="space-y-6">
                {filteredSections.map((section) => (
                  <SectionCard key={section.id} section={section}>
                    {section.fields.map((field) => (
                      <FieldControl
                        key={field.key}
                        config={field}
                        value={form[field.key]}
                        error={fieldErrors[field.key]}
                        onChange={handleChange}
                        onBlur={handleBlur}
                      />
                    ))}
                  </SectionCard>
                ))}

                {/* Bottom Action Footer */}
                <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 p-5 bg-white rounded-3xl border border-slate-200/90 shadow-sm">
                  <p className="text-xs text-slate-500">
                    Fields marked with <span className="font-bold text-rose-500">*</span> are required for business identity.
                  </p>
                  <button
                    type="submit"
                    disabled={saving || loading}
                    className="w-full sm:w-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>{saving ? "Saving Changes…" : "Save All Changes"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Interactive Live Previews Column (Sticky) */}
            <aside className="space-y-4 lg:sticky lg:top-36" aria-label="Live Storefront Previews">
              <div className="rounded-3xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
                {/* Preview Type Selector Tabs */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Live Preview</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("footer")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                        previewMode === "footer"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Footer
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("contact")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                        previewMode === "contact"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Contact Us
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("receipt")}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                        previewMode === "receipt"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Invoice
                    </button>
                  </div>
                </div>

                {/* Preview Body */}
                <div className="p-5">
                  {/* PREVIEW 1: LANDING FOOTER MOCK */}
                  {previewMode === "footer" && (
                    <div
                      className="rounded-2xl p-4 text-white space-y-4 shadow-inner"
                      style={{
                        background: "linear-gradient(180deg, #0a3015 0%, #0d3714 60%, #071e0b 100%)",
                      }}
                    >
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
                            {logoPreview ? (
                              <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                            ) : (
                              <Building2 size={16} className="text-emerald-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-xs leading-tight">{form.name.trim() || "Company Name"}</p>
                            <p className="text-[9px] text-emerald-400 font-mono">Fresh Daily</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-white/50">Footer Mode</span>
                      </div>

                      <div className="space-y-2 text-[11px] text-white/70">
                        <div className="flex items-start gap-2">
                          <MapPin size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                          <p className="line-clamp-2 leading-relaxed">{addressPreview || "Address not provided"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone size={12} className="text-emerald-400 shrink-0" />
                          <span>{form.phone.trim() || "+91 91487 73591"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail size={12} className="text-emerald-400 shrink-0" />
                          <span>{form.email.trim() || "support@f2hfresh.com"}</span>
                        </div>
                      </div>

                      {/* Social Pills */}
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {socialLinks.length ? (
                            socialLinks.map((s) => (
                              <span
                                key={s.label}
                                className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/70 text-[10px]"
                                title={s.label}
                              >
                                {s.icon}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-white/40 italic">No social links configured</span>
                          )}
                        </div>
                        <span className="text-[10px] text-emerald-400 font-bold">© {new Date().getFullYear()}</span>
                      </div>
                    </div>
                  )}

                  {/* PREVIEW 2: CONTACT US CARD MOCK */}
                  {previewMode === "contact" && (
                    <div className="rounded-2xl p-4 bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                      <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                          Get In Touch Screen
                        </span>
                        <BadgeCheck size={14} className="text-emerald-700" />
                      </div>

                      <div className="space-y-2">
                        <div className="p-2.5 rounded-xl bg-white border border-emerald-100 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                            <Phone size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase text-slate-400">Primary Phone</p>
                            <p className="text-xs font-bold text-slate-800 truncate">{form.phone.trim() || "+91 91487 73591"}</p>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-emerald-100 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-green-50 text-green-700 flex items-center justify-center shrink-0">
                            <MessageCircle size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase text-slate-400">WhatsApp Support</p>
                            <p className="text-xs font-bold text-slate-800 truncate">{form.whatsapp.trim() || form.phone.trim() || "+91 91487 73591"}</p>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-emerald-100 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                            <Mail size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase text-slate-400">Email Support</p>
                            <p className="text-xs font-bold text-slate-800 truncate">{form.email.trim() || "support@f2hfresh.com"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-100/60 to-white border border-emerald-200 text-xs">
                        <p className="text-[9px] font-bold uppercase text-emerald-800 mb-1 flex items-center gap-1">
                          <MapPin size={10} /> Registered Office
                        </p>
                        <p className="text-[11px] text-slate-700 leading-snug">{addressPreview || "Address not provided"}</p>
                      </div>
                    </div>
                  )}

                  {/* PREVIEW 3: INVOICE & RECEIPT HEADER MOCK */}
                  {previewMode === "receipt" && (
                    <div className="rounded-2xl p-4 bg-slate-50 border border-slate-200 space-y-3 font-mono">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-[10px] font-bold uppercase text-slate-600">Tax Invoice Header</span>
                        <Receipt size={14} className="text-slate-500" />
                      </div>

                      <div className="space-y-1 text-xs">
                        <p className="font-extrabold text-slate-900">{form.legal_name.trim() || form.name.trim() || "F2H FRESH"}</p>
                        <p className="text-[10px] text-slate-600 leading-snug">{addressPreview || "Registered Address"}</p>
                        <div className="pt-1 text-[10px] text-slate-600 space-y-0.5">
                          <p>GSTIN: <strong className="text-slate-900">{form.gst_number.trim() || "NOT SPECIFIED"}</strong></p>
                          <p>PAN: <strong className="text-slate-900">{form.pan_number.trim() || "NOT SPECIFIED"}</strong></p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-500 flex justify-between">
                        <span>Helpline: {form.phone.trim() || "N/A"}</span>
                        <span>{form.website.trim() || "f2hfresh.com"}</span>
                      </div>
                    </div>
                  )}

                  <p className="mt-4 text-[11px] text-slate-400 text-center leading-relaxed">
                    Live preview updates as you type. Click <strong className="text-emerald-700 font-semibold">Save Profile</strong> to publish changes across the storefront and APIs.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
