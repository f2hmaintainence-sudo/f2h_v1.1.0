// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Developer API Integrations - Email Management Page
//
// ============================================================================

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { ApiIntegrationsHeader } from "@/components/developer/ApiIntegrationsHeader";
import { EmailConfigModal } from "@/components/developer/EmailConfigModal";
import {
  Mail,
  Plus,
  Search,
  Edit2,
  Trash2,
  Sliders,
  CheckCircle2,
  XCircle,
  Loader2,
  Layers,
} from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

export default function EmailIntegrationsPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/developer/api-integrations/email");
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray((res.data as any)?.data)
          ? (res.data as any).data
          : [];
      setConfigs(list);
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to load Email configurations");
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleSave = async (formData: any) => {
    try {
      if (formData.id) {
        const res = await api.put(
          `/admin/developer/api-integrations/email/${formData.id}`,
          formData
        );
        if (res.status) {
          showSuccessToast("Email SMTP configuration updated successfully");
          fetchConfigs();
        } else {
          showErrorToast(res.message || "Failed to update configuration");
        }
      } else {
        const res = await api.post(
          "/admin/developer/api-integrations/email",
          formData
        );
        if (res.status) {
          showSuccessToast("Email SMTP configuration saved successfully");
          fetchConfigs();
        } else {
          showErrorToast(res.message || "Failed to save configuration");
        }
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to save configuration");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Email configuration?"))
      return;
    try {
      const res = await api.delete(
        `/admin/developer/api-integrations/email/${id}`
      );
      if (res.status) {
        showSuccessToast("Configuration deleted successfully");
        fetchConfigs();
      } else {
        showErrorToast(res.message || "Failed to delete configuration");
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to delete configuration");
    }
  };

  const handleToggleActive = async (config: any) => {
    try {
      const res = await api.put(
        `/admin/developer/api-integrations/email/${config.id}`,
        {
          ...config,
          is_active: !config.is_active,
        }
      );
      if (res.status) {
        showSuccessToast(
          `Configuration ${!config.is_active ? "activated" : "deactivated"}`
        );
        fetchConfigs();
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to toggle status");
    }
  };

  const filteredConfigs = configs.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.config_key?.toLowerCase().includes(search.toLowerCase()) ||
      c.provider?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <ApiIntegrationsHeader
        categoryName="Email"
        subtitle="Configure and manage SMTP gateways, SendGrid, Mailgun, and custom email delivery services."
        configCount={configs.filter((c) => c.is_active).length}
        secondaryTitle="ACTIVE ROUTING"
        secondaryCount={configs.length}
        secondarySubtext="Configured email integrations"
        dispatchedCount={1240}
        reliabilityValue="99.95%"
      />

      {/* Section Header with Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100">
            <Mail size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Email Configurations
            </h2>
            <p className="text-xs text-slate-500">
              Active SMTP servers and delivery credentials
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search configs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] bg-slate-50/50"
            />
          </div>
          <button
            onClick={() => {
              setEditingConfig(null);
              setModalOpen(true);
            }}
            className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm shadow-emerald-600/20 whitespace-nowrap"
          >
            <Plus size={15} />
            Add Email Config
          </button>
        </div>
      </div>

      {/* Content List / Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="animate-spin text-[#16a34a]" size={28} />
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 mx-auto flex items-center justify-center border border-slate-100">
            <Mail size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-700">
            No Email Provider configured
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click &quot;Add Email Config&quot; to set up your primary SMTP or cloud email gateway.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredConfigs.map((config) => {
            const data = config.config_data || {};
            return (
              <div
                key={config.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${config.is_active ? "bg-[#16a34a]" : "bg-slate-300"
                    }`}
                />
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[10px] font-bold text-[#16a34a] uppercase bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/50">
                        {config.config_key}
                      </span>
                      <h3 className="text-sm font-bold text-slate-800 mt-1">
                        {config.name}
                      </h3>
                    </div>
                    <button
                      onClick={() => handleToggleActive(config)}
                      className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${config.is_active
                          ? "bg-emerald-50 text-[#16a34a] border-emerald-200"
                          : "bg-slate-50 text-slate-400 border-slate-200"
                        }`}
                    >
                      {config.is_active ? (
                        <>
                          <CheckCircle2 size={12} /> Active
                        </>
                      ) : (
                        <>
                          <XCircle size={12} /> Inactive
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50/50 p-3 rounded-xl border border-slate-100 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Host:</span>
                      <span className="font-semibold text-slate-700">
                        {data.smtp_host || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Port:</span>
                      <span className="font-semibold text-slate-700">
                        {data.smtp_port || "587"} ({data.encryption_type || "STARTTLS"})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-sans">Sender:</span>
                      <span className="font-semibold text-slate-700 truncate max-w-[150px]">
                        {data.sender_email || data.smtp_user || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setEditingConfig(config);
                      setModalOpen(true);
                    }}
                    className="p-1.5 text-slate-500 hover:text-[#16a34a] hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold px-2.5"
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

      {/* Email Config Modal */}
      <EmailConfigModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialData={editingConfig}
      />
    </div>
  );
}
