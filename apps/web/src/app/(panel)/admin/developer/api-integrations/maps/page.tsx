// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Developer API Integrations - Google Maps API Key Management Page
//
// ============================================================================

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { ApiIntegrationsHeader } from "@/components/developer/ApiIntegrationsHeader";
import {
  MapPin,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Eye,
  EyeOff,
  Key,
  Globe,
} from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

// ── Inline Modal ────────────────────────────────────────────────────────────

interface MapsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any | null;
}

function MapsConfigModal({ isOpen, onClose, onSave, initialData }: MapsModalProps) {
  const [form, setForm] = useState({
    id: "",
    config_key: "google_maps",
    name: "",
    provider: "google",
    is_active: true,
    apiKey: "",
  });
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const d = initialData.config_data || {};
        setForm({
          id: initialData.id || "",
          config_key: initialData.config_key || "google_maps",
          name: initialData.name || "",
          provider: initialData.provider || "google",
          is_active: initialData.is_active !== false,
          apiKey: d.apiKey || "",
        });
      } else {
        setForm({ id: "", config_key: "google_maps", name: "Google Maps", provider: "google", is_active: true, apiKey: "" });
      }
      setShowKey(false);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return showErrorToast("Config name is required");
    if (!form.apiKey.trim()) return showErrorToast("Google Maps API key is required");
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <MapPin size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {initialData ? "Edit Maps Configuration" : "Add Google Maps API Key"}
              </h2>
              <p className="text-[11px] text-slate-400">Stored in api_integrations_config (category: maps)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Config Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Config Name <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Google Maps Web"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
            />
          </div>

          {/* Config Key — read-only */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Config Key</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-400">
              <Key size={13} />
              <span className="font-mono text-xs">google_maps</span>
              <span className="ml-auto text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded">auto</span>
            </div>
          </div>

          {/* Google Maps API Key */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Google Maps API Key <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showKey ? "text" : "password"}
                value={form.apiKey}
                onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                placeholder="AIzaSy..."
                className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
              />
              <button
                type="button"
                onClick={() => setShowKey(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Get your key from{" "}
              <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-emerald-600 underline underline-offset-2">
                Google Cloud Console
              </a>
              {" "}→ APIs & Services → Maps JavaScript API
            </p>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-700">Active</p>
              <p className="text-[11px] text-slate-400">Enable Google Maps tiles on the delivery tracking page</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${form.is_active ? "bg-emerald-600" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${form.is_active ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-60"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
              {saving ? "Saving…" : initialData ? "Update Config" : "Save API Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MapsIntegrationsPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/developer/api-integrations/maps");
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray((res.data as any)?.data)
          ? (res.data as any).data
          : [];
      setConfigs(list);
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to load Maps configurations");
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const handleSave = async (formData: any) => {
    try {
      const payload = {
        id: formData.id || undefined,
        config_key: "google_maps",
        name: formData.name,
        provider: "google",
        is_active: formData.is_active,
        apiKey: formData.apiKey,
      };

      if (formData.id) {
        const res = await api.put(`/admin/developer/api-integrations/maps/${formData.id}`, payload);
        if ((res as any).status || (res as any).data?.status) {
          showSuccessToast("Google Maps configuration updated successfully");
          fetchConfigs();
          setModalOpen(false);
        } else {
          showErrorToast((res as any).message || "Failed to update configuration");
        }
      } else {
        const res = await api.post("/admin/developer/api-integrations/maps", payload);
        if ((res as any).status || (res as any).data?.status) {
          showSuccessToast("Google Maps API key saved successfully");
          fetchConfigs();
          setModalOpen(false);
        } else {
          showErrorToast((res as any).message || "Failed to save configuration");
        }
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to save configuration");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Maps configuration?")) return;
    try {
      const res = await api.delete(`/admin/developer/api-integrations/maps/${id}`);
      if ((res as any).status || (res as any).data?.status) {
        showSuccessToast("Configuration deleted successfully");
        fetchConfigs();
      } else {
        showErrorToast((res as any).message || "Failed to delete");
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to delete configuration");
    }
  };

  const handleToggleActive = async (config: any) => {
    try {
      await api.put(`/admin/developer/api-integrations/maps/${config.id}`, {
        ...config,
        is_active: !config.is_active,
      });
      showSuccessToast(`Configuration ${!config.is_active ? "activated" : "deactivated"}`);
      fetchConfigs();
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to toggle status");
    }
  };

  const filteredConfigs = configs.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.config_key?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <ApiIntegrationsHeader
        categoryName="Maps"
        subtitle="Configure Google Maps API keys for live delivery tracking, route visualization, and geocoding on the admin dashboard."
        configCount={configs.filter(c => c.is_active).length}
        secondaryTitle="CONFIGS SAVED"
        secondaryCount={configs.length}
        secondarySubtext="Google Maps API key entries"
        dispatchedCount={0}
        reliabilityValue="—"
      />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <MapPin size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Google Maps Configurations</h2>
            <p className="text-xs text-slate-500">API keys used for delivery tracking map tiles</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search configs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-slate-50/50"
            />
          </div>
          <button
            onClick={() => { setEditingConfig(null); setModalOpen(true); }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm shadow-emerald-600/20 whitespace-nowrap"
          >
            <Plus size={15} /> Add Maps Key
          </button>
        </div>
      </div>

      {/* Tip Banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <Globe size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 leading-relaxed">
          <strong>How to get a Google Maps API Key:</strong> Go to{" "}
          <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="underline font-semibold">
            console.cloud.google.com
          </a>{" "}
          → Create a project → APIs & Services → Enable{" "}
          <strong>Maps JavaScript API</strong> → Create credentials → API Key.
          The active key here will automatically be used for the{" "}
          <strong>Live Delivery Tracking</strong> map.
        </div>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="animate-spin text-emerald-600" size={28} />
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 mx-auto flex items-center justify-center border border-slate-100">
            <MapPin size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-700">No Google Maps API Key configured</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click &quot;Add Maps Key&quot; to configure your Google Maps API key. Without it, the delivery tracking map uses the free CartoDB tile layer.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredConfigs.map((config) => {
            const data = config.config_data || {};
            const maskedKey = data.apiKey
              ? `${data.apiKey.substring(0, 8)}${"•".repeat(20)}${data.apiKey.slice(-4)}`
              : "N/A";

            return (
              <div
                key={config.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 ${config.is_active ? "bg-emerald-600" : "bg-slate-300"}`} />

                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/50">
                        {config.config_key}
                      </span>
                      <h3 className="text-sm font-bold text-slate-800 mt-1">{config.name}</h3>
                    </div>
                    <button
                      onClick={() => handleToggleActive(config)}
                      className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                        config.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-50 text-slate-400 border-slate-200"
                      }`}
                    >
                      {config.is_active ? <><CheckCircle2 size={12} /> Active</> : <><XCircle size={12} /> Inactive</>}
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Provider:</span>
                      <span className="font-semibold text-slate-700 capitalize">{config.provider || "Google"}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-400 shrink-0">API Key:</span>
                      <span className="font-mono font-semibold text-slate-700 text-[10px] truncate">{maskedKey}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Updated:</span>
                      <span className="font-semibold text-slate-700">
                        {config.updated_at ? new Date(config.updated_at).toLocaleDateString("en-IN") : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => { setEditingConfig(config); setModalOpen(true); }}
                    className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold px-2.5"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold px-2.5"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MapsConfigModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialData={editingConfig}
      />
    </div>
  );
}
