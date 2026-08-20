"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  Facebook,
  FileText,
  Globe2,
  Home,
  ImageIcon,
  Instagram,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Save,
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
}

interface SectionConfig {
  title: string;
  description: string;
  icon: LucideIcon;
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
    title: "Brand & identity",
    description: "Public company name and logo used across the website.",
    icon: Building2,
    fields: [
      { key: "name", label: "Company name", placeholder: "F2H Fresh", autoComplete: "organization", maxLength: 200, required: true },
      { key: "logo_url", label: "Logo URL", placeholder: "https://example.com/logo.png", type: "url", inputMode: "url", autoComplete: "url", maxLength: 500, hint: "Use a public HTTPS image URL." },
    ],
  },
  {
    title: "Legal & tax",
    description: "Registered identity used for business administration.",
    icon: FileText,
    fields: [
      { key: "legal_name", label: "Legal name", placeholder: "Registered company name", autoComplete: "organization", maxLength: 200, wide: true },
      { key: "gst_number", label: "GST number", placeholder: "29ABCDE1234F1Z5", maxLength: 20 },
      { key: "pan_number", label: "PAN number", placeholder: "ABCDE1234F", maxLength: 15 },
    ],
  },
  {
    title: "Public contact",
    description: "Customer contact channels shown in the footer and Contact Us section.",
    icon: Phone,
    fields: [
      { key: "email", label: "Support email", placeholder: "support@example.com", type: "email", inputMode: "email", autoComplete: "email", maxLength: 254 },
      { key: "phone", label: "Primary phone", placeholder: "+91 91487 73591", type: "tel", inputMode: "tel", autoComplete: "tel", maxLength: 20 },
      { key: "secondary_phone", label: "Secondary phone", placeholder: "+91 79893 68142", type: "tel", inputMode: "tel", autoComplete: "tel", maxLength: 20 },
      { key: "whatsapp", label: "WhatsApp number", placeholder: "+91 91487 73591", type: "tel", inputMode: "tel", autoComplete: "tel", maxLength: 20 },
    ],
  },
  {
    title: "Registered address",
    description: "Address displayed publicly and used for company correspondence.",
    icon: MapPin,
    fields: [
      { key: "address", label: "Street address", placeholder: "Building, street, area and landmark", autoComplete: "street-address", maxLength: 1000, textarea: true, wide: true },
      { key: "city", label: "City", placeholder: "Bengaluru", autoComplete: "address-level2", maxLength: 100 },
      { key: "state", label: "State", placeholder: "Karnataka", autoComplete: "address-level1", maxLength: 100 },
      { key: "pincode", label: "Pincode", placeholder: "560066", inputMode: "numeric", autoComplete: "postal-code", maxLength: 6 },
    ],
  },
  {
    title: "Website & social channels",
    description: "Official links shown with your public company information.",
    icon: Globe2,
    fields: [
      { key: "website", label: "Website URL", placeholder: "https://f2hfresh.com", type: "url", inputMode: "url", autoComplete: "url", maxLength: 500, wide: true },
      { key: "instagram_url", label: "Instagram URL", placeholder: "https://instagram.com/f2hfresh", type: "url", inputMode: "url", maxLength: 500 },
      { key: "facebook_url", label: "Facebook URL", placeholder: "https://facebook.com/f2hfresh", type: "url", inputMode: "url", maxLength: 500 },
      { key: "youtube_url", label: "YouTube URL", placeholder: "https://youtube.com/@f2hfresh", type: "url", inputMode: "url", maxLength: 500, wide: true },
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

  if (field === "pincode" && value && !/^\d{6}$/.test(value)) return "Enter a 6-digit pincode.";

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
  const controlClass = error
    ? "w-full rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
    : "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-fresh-green/40 focus:bg-white focus:ring-2 focus:ring-fresh-green/10";

  return (
    <div className={config.wide ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">
        {config.label}
        {config.required ? <span className="ml-1 text-red-500" aria-hidden="true">*</span> : null}
      </label>
      {config.hint ? <p id={`${id}-hint`} className="mb-2 text-xs text-slate-500">{config.hint}</p> : null}
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
          rows={4}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`${controlClass} resize-y`}
        />
      ) : (
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
      )}
      {error ? <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

function SectionCard({ section, children }: { section: SectionConfig; children: ReactNode }) {
  const Icon = section.icon;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fresh-green/10 text-fresh-green ring-1 ring-fresh-green/20">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">{section.title}</h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{section.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 sm:p-6">{children}</div>
    </section>
  );
}

function SaveButton({ saving, saved, disabled }: { saving: boolean; saved: boolean; disabled: boolean }) {
  return (
    <button
      type="submit"
      form="company-profile-form"
      disabled={disabled}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-fresh-green px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-deep-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fresh-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : saved ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
      {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
    </button>
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
      const message = "Check the highlighted fields before saving.";
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
    showSuccessToast("Company profile saved successfully!");
    setSaving(false);
  };

  const addressPreview = formattedAddress(form);
  const logoPreview = isHttpUrl(form.logo_url.trim()) ? form.logo_url.trim() : "";
  const socialLinks = [
    { label: "Instagram", value: form.instagram_url, icon: <Instagram className="h-4 w-4" aria-hidden="true" /> },
    { label: "Facebook", value: form.facebook_url, icon: <Facebook className="h-4 w-4" aria-hidden="true" /> },
    { label: "YouTube", value: form.youtube_url, icon: <Youtube className="h-4 w-4" aria-hidden="true" /> },
  ].filter((link) => isHttpUrl(link.value.trim()));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Link href="/admin" className="flex items-center gap-1 transition hover:text-slate-800">
              <Home className="h-3.5 w-3.5" aria-hidden="true" /> Admin
            </Link>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <span className="text-slate-400">Profile</span>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <span className="font-medium text-slate-700" aria-current="page">Company</span>
          </nav>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fresh-green/10 text-fresh-green ring-1 ring-fresh-green/20">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight text-slate-900 sm:text-xl">Company Profile</h1>
                <p className="mt-0.5 text-xs text-slate-500">Manage public brand, contact and registered business details.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchProfile()}
                disabled={loading || saving}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fresh-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden="true" />
                {loading && loaded ? "Refreshing…" : "Refresh"}
              </button>
              <SaveButton saving={saving} saved={saved} disabled={saving || loading || !loaded} />
            </div>
          </div>
        </div>
      </header>

      <p className="sr-only" role="status" aria-live="polite">{statusMessage}</p>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {loading && !loaded ? (
          <div className="flex min-h-80 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 shadow-sm" role="status">
            <Loader2 className="mr-3 h-6 w-6 animate-spin text-fresh-green" aria-hidden="true" /> Loading company profile…
          </div>
        ) : !loaded ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm" role="alert">
            <AlertCircle className="mx-auto h-9 w-9 text-red-600" aria-hidden="true" />
            <h2 className="mt-4 text-base font-bold text-slate-900">Company profile could not be loaded</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{loadError || "Please check your connection and try again."}</p>
            <button type="button" onClick={() => void fetchProfile()} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-fresh-green px-4 py-2 text-sm font-bold text-white hover:bg-deep-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fresh-green focus-visible:ring-offset-2">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
            </button>
          </div>
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <form id="company-profile-form" noValidate onSubmit={handleSave} className="grid min-w-0 gap-6">
              <div className={loadError ? "flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" : "flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"} role={loadError ? "alert" : undefined}>
                {loadError ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-fresh-green" aria-hidden="true" />}
                <p>{loadError ? `Refresh failed; your current values were kept. ${loadError}` : "Public brand and contact details saved here are used by the landing page footer and contact section."}</p>
              </div>

              {saved ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800" role="status">
                  <CheckCircle2 className="h-4 w-4 text-fresh-green" aria-hidden="true" /> Changes saved and ready for public use.
                </div>
              ) : null}

              {SECTIONS.map((section) => (
                <SectionCard key={section.title} section={section}>
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

              <div className="flex flex-col-reverse gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-xs text-slate-500">Fields marked with <span className="font-bold text-red-500">*</span> are required.</p>
                <SaveButton saving={saving} saved={saved} disabled={saving || loading} />
              </div>
            </form>

            <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-40" aria-label="Public company preview">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-fresh-green">Public preview</p>
                  <h2 className="mt-1 text-sm font-bold text-slate-900">Customer-facing details</h2>
                </div>
                <BadgeCheck className="h-5 w-5 text-fresh-green" aria-hidden="true" />
              </div>
              <div className="space-y-5 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 text-fresh-green">
                    {logoPreview ? <img src={logoPreview} alt="Company logo preview" className="h-full w-full object-contain p-1" referrerPolicy="no-referrer" /> : <ImageIcon className="h-6 w-6" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-900">{form.name.trim() || "Company name"}</p>
                    <p className="truncate text-xs text-slate-500">{form.website.trim() || "Website not added"}</p>
                  </div>
                </div>

                <div className="space-y-3 border-y border-slate-100 py-4 text-sm">
                  <PreviewLine icon={<Phone className="h-4 w-4" />} value={form.phone.trim() || "Primary phone not added"} secondary={form.secondary_phone.trim()} />
                  <PreviewLine icon={<Mail className="h-4 w-4" />} value={form.email.trim() || "Email not added"} />
                  <PreviewLine icon={<MessageCircle className="h-4 w-4" />} value={form.whatsapp.trim() || "WhatsApp not added"} />
                  <PreviewLine icon={<MapPin className="h-4 w-4" />} value={addressPreview || "Address not added"} />
                </div>

                {socialLinks.length ? (
                  <div className="flex flex-wrap gap-2">
                    {socialLinks.map((link) => (
                      <span key={link.label} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">{link.icon}{link.label}</span>
                    ))}
                  </div>
                ) : null}
                <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500">Preview updates while you type. Public pages change only after you save.</p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function PreviewLine({ icon, value, secondary }: { icon: ReactNode; value: string; secondary?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-fresh-green" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="break-words leading-5 text-slate-700">{value}</p>
        {secondary ? <p className="mt-0.5 text-xs text-slate-500">{secondary}</p> : null}
      </div>
    </div>
  );
}
