"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import {
  Globe, Save, RefreshCw, Phone, Mail, MapPin,
  Instagram, Youtube, Facebook, MessageCircle, CheckCircle, Loader2, ChevronRight, Home
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";

interface SiteForm {
  phone: string;
  phone_url: string;
  whatsapp: string;
  whatsapp_url: string;
  email: string;
  address: string;
  instagram_url: string;
  facebook_url: string;
  youtube_url: string;
}

const EMPTY_FORM: SiteForm = {
  phone: "",
  phone_url: "",
  whatsapp: "",
  whatsapp_url: "",
  email: "",
  address: "",
  instagram_url: "",
  facebook_url: "",
  youtube_url: "",
};

const FIELD_META: {
  key: keyof SiteForm;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  hint?: string;
  type?: string;
}[] = [
    {
      key: "phone",
      label: "Phone Number",
      placeholder: "+91 91487 73591",
      icon: <Phone className="w-4 h-4" />,
      hint: "Displayed as the call link label (e.g. +91 91487 73591)",
    },
    {
      key: "phone_url",
      label: "Phone URL",
      placeholder: "tel:+919148773591",
      icon: <Phone className="w-4 h-4" />,
      hint: "tel: link for call button — auto-generated from phone if left blank",
    },
    {
      key: "whatsapp",
      label: "WhatsApp Number",
      placeholder: "+91 91487 73591",
      icon: <MessageCircle className="w-4 h-4" />,
      hint: "Displayed as WhatsApp label (can be same as phone)",
    },
    {
      key: "whatsapp_url",
      label: "WhatsApp URL",
      placeholder: "https://wa.me/919148773591",
      icon: <MessageCircle className="w-4 h-4" />,
      hint: "Full wa.me link — auto-generated if left blank",
    },
    {
      key: "email",
      label: "Email Address",
      placeholder: "support@f2hfresh.com",
      icon: <Mail className="w-4 h-4" />,
      type: "email",
    },
    {
      key: "address",
      label: "Physical Address",
      placeholder: "1st Cross, SJP Layout, Nagondanahalli, Whitefield, Bangalore – 560066",
      icon: <MapPin className="w-4 h-4" />,
      hint: "Shown in footer address line",
    },
    {
      key: "instagram_url",
      label: "Instagram URL",
      placeholder: "https://instagram.com/f2hfresh",
      icon: <Instagram className="w-4 h-4" />,
      type: "url",
    },
    {
      key: "facebook_url",
      label: "Facebook URL",
      placeholder: "https://facebook.com/f2hfresh",
      icon: <Facebook className="w-4 h-4" />,
      type: "url",
    },
    {
      key: "youtube_url",
      label: "YouTube URL",
      placeholder: "https://youtube.com/@f2hfresh",
      icon: <Youtube className="w-4 h-4" />,
      type: "url",
    },
  ];

export default function SiteSettingsPage() {
  const [form, setForm] = useState<SiteForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/system/site-settings");
      if (res.data?.status && res.data.data) {
        const d = res.data.data as Partial<SiteForm>;
        setForm((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(d).filter(([, v]) => v !== undefined && v !== null)
          ),
        }));
      }
    } catch {
      // silently use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleChange = (key: keyof SiteForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      // Auto-fill phone_url / whatsapp_url if left blank
      const payload: SiteForm = { ...form };
      if (!payload.phone_url && payload.phone) {
        payload.phone_url = `tel:${payload.phone.replace(/\s/g, "")}`;
      }
      if (!payload.whatsapp_url && (payload.whatsapp || payload.phone)) {
        const raw = (payload.whatsapp || payload.phone).replace(/[^0-9]/g, "");
        payload.whatsapp_url = `https://wa.me/${raw}`;
      }

      await api.post<any>("/admin/system/site-settings", payload);
      setForm(payload);
      setSaved(true);
      showSuccessToast("Site settings saved successfully!");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // TODO: error toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <Link href="/admin" className="flex items-center gap-1 hover:text-gray-700 transition-colors">
              <Home className="w-3.5 h-3.5" /> Admin
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-400">System</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-700 font-medium">Site Settings</span>
          </nav>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fresh-green/10 text-fresh-green ring-1 ring-fresh-green/20">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">Site Settings</h1>
                <p className="text-xs text-gray-500">Footer & Contact info shown on the landing page</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchSettings}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white bg-fresh-green hover:bg-deep-green transition-all duration-200 disabled:opacity-50 shadow-sm"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : saved ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mr-3 text-fresh-green" />
            Loading settings…
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Info banner */}
            <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <Globe className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
              <p>
                These settings control the <strong>Footer</strong> and <strong>Contact section</strong> of the public landing page.
                Changes are reflected in real-time — no code deployment needed.
              </p>
            </div>

            {/* Fields */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="text-sm font-bold text-gray-800">Contact & Social Information</h2>
                <p className="text-xs text-gray-500 mt-0.5">Displayed in the website footer and Contact Us section</p>
              </div>
              <div className="divide-y divide-gray-100">
                {FIELD_META.map(({ key, label, placeholder, icon, hint, type }) => (
                  <div key={key} className="px-6 py-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fresh-green/8 text-fresh-green ring-1 ring-fresh-green/15 mt-0.5">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <label htmlFor={`field-${key}`} className="block text-sm font-semibold text-gray-800 mb-1">
                          {label}
                        </label>
                        {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
                        <input
                          id={`field-${key}`}
                          type={type || "text"}
                          value={form[key]}
                          onChange={(e) => handleChange(key, e.target.value)}
                          placeholder={placeholder}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-fresh-green/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fresh-green/10 transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save button (bottom) */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white bg-fresh-green hover:bg-deep-green transition-all duration-200 disabled:opacity-50 shadow-md shadow-fresh-green/20"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? "Saving…" : saved ? "Saved!" : "Save All Settings"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
