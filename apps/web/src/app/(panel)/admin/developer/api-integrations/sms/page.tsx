// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Developer API Integrations - SMS Management & DLT Templates Page
// Website     : https://www.chronosparksolutions.com/
// Copyright   : https://www.chronosparksolutions.com/copyright
// ============================================================================

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { ApiIntegrationsHeader } from "@/components/developer/ApiIntegrationsHeader";
import { SmsConfigModal } from "@/components/developer/SmsConfigModal";
import { SmsTemplateModal } from "@/components/developer/SmsTemplateModal";
import {
  MessageSquare,
  Plus,
  Search,
  Edit2,
  Trash2,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

export default function SmsIntegrationsPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateSearch, setTemplateSearch] = useState("");

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any | null>(null);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, templateRes] = await Promise.all([
        api.get("/admin/developer/api-integrations/sms"),
        api.get("/admin/developer/api-integrations/sms/templates"),
      ]);

      const cfgList = Array.isArray(configRes.data)
        ? configRes.data
        : Array.isArray((configRes.data as any)?.data)
        ? (configRes.data as any).data
        : [];
      setConfigs(cfgList);

      const tplList = Array.isArray(templateRes.data)
        ? templateRes.data
        : Array.isArray((templateRes.data as any)?.data)
        ? (templateRes.data as any).data
        : [];
      setTemplates(tplList);
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to load SMS settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save SMS Config
  const handleSaveConfig = async (formData: any) => {
    try {
      if (formData.id) {
        const res = await api.put(
          `/admin/developer/api-integrations/sms/${formData.id}`,
          formData
        );
        if (res.status) {
          showSuccessToast("SMS configuration updated successfully");
          fetchData();
        } else {
          showErrorToast(res.message || "Failed to update configuration");
        }
      } else {
        const res = await api.post(
          "/admin/developer/api-integrations/sms",
          formData
        );
        if (res.status) {
          showSuccessToast("SMS configuration saved successfully");
          fetchData();
        } else {
          showErrorToast(res.message || "Failed to save configuration");
        }
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to save configuration");
    }
  };

  // Delete SMS Config
  const handleDeleteConfig = async (id: string) => {
    if (!confirm("Are you sure you want to delete this SMS configuration?"))
      return;
    try {
      const res = await api.delete(
        `/admin/developer/api-integrations/sms/${id}`
      );
      if (res.status) {
        showSuccessToast("SMS configuration deleted");
        fetchData();
      } else {
        showErrorToast(res.message || "Failed to delete configuration");
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to delete configuration");
    }
  };

  // Save SMS Template
  const handleSaveTemplate = async (formData: any) => {
    try {
      if (formData.id) {
        const res = await api.put(
          `/admin/developer/api-integrations/sms/templates/${formData.id}`,
          formData
        );
        if (res.status) {
          showSuccessToast("SMS template updated successfully");
          fetchData();
        } else {
          showErrorToast(res.message || "Failed to update template");
        }
      } else {
        const res = await api.post(
          "/admin/developer/api-integrations/sms/templates",
          formData
        );
        if (res.status) {
          showSuccessToast("SMS template created successfully");
          fetchData();
        } else {
          showErrorToast(res.message || "Failed to create template");
        }
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to save template");
    }
  };

  // Delete SMS Template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this SMS template?")) return;
    try {
      const res = await api.delete(
        `/admin/developer/api-integrations/sms/templates/${id}`
      );
      if (res.status) {
        showSuccessToast("SMS template deleted");
        fetchData();
      } else {
        showErrorToast(res.message || "Failed to delete template");
      }
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to delete template");
    }
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.name?.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.template_key?.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.dlt_template_id?.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.body?.toLowerCase().includes(templateSearch.toLowerCase())
  );

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
      <ApiIntegrationsHeader
        categoryName="SMS"
        subtitle="Configure and manage sms service integrations, templates, types and delivery settings."
        configCount={configs.length}
        secondaryTitle="TOTAL TEMPLATES"
        secondaryCount={templates.length}
        secondarySubtext="Configured notification layouts"
        dispatchedCount={0}
        reliabilityValue="N/A"
      />

      {/* Section 1: SMS Configurations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">
            SMS Configurations
          </h2>
          <button
            onClick={() => {
              setEditingConfig(null);
              setConfigModalOpen(true);
            }}
            className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm shadow-emerald-600/20"
          >
            <Plus size={15} />
            Add SMS Config
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="animate-spin text-[#16a34a]" size={24} />
          </div>
        ) : configs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
            No SMS Provider configured. Click &quot;Add SMS Config&quot; to set up your primary gateway.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configs.map((config) => {
              const data = config.config_data || {};
              return (
                <div
                  key={config.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[#16a34a]" />
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-[10px] font-bold text-[#16a34a] uppercase bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          {config.provider || "Gateway"}
                        </span>
                        <h3 className="text-sm font-bold text-slate-800 mt-1">
                          {config.name}
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        {config.config_key}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-600 bg-slate-50/50 p-3 rounded-xl border border-slate-100 font-mono mt-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Sender ID:</span>
                        <span className="font-semibold text-slate-700">
                          {data.sender_id || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Route:</span>
                        <span className="font-semibold text-slate-700">
                          {data.route_channel || "Transactional"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setEditingConfig(config);
                        setConfigModalOpen(true);
                      }}
                      className="p-1.5 text-slate-500 hover:text-[#16a34a] hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold px-2.5"
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteConfig(config.id)}
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
      </div>

      {/* Section 2: SMS Message Templates & DLT Registrations */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              SMS Message Templates &amp; DLT Registrations
            </h2>
            <p className="text-xs text-slate-500">
              Manage text body layouts and DLT template IDs mapped to gateway routes.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search templates..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] bg-slate-50/50"
              />
            </div>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setTemplateModalOpen(true);
              }}
              className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm shadow-emerald-600/20 whitespace-nowrap"
            >
              <Plus size={15} />
              Add Template
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8 bg-white rounded-2xl border border-slate-200">
            <Loader2 className="animate-spin text-[#16a34a]" size={24} />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
            No SMS DLT Templates found. Click &quot;Add Template&quot; to register your first layout.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                        {tpl.template_key}
                      </span>
                      <h3 className="text-sm font-bold text-slate-800 mt-1">
                        {tpl.name}
                      </h3>
                    </div>
                    {tpl.dlt_template_id && (
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        DLT: {tpl.dlt_template_id}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-mono text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {tpl.body}
                    </p>
                  </div>

                  {Array.isArray(tpl.placeholders) && tpl.placeholders.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-slate-400 font-medium self-center">
                        Variables:
                      </span>
                      {tpl.placeholders.map((p: string, i: number) => (
                        <span
                          key={i}
                          className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-mono border border-blue-100"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setEditingTemplate(tpl);
                      setTemplateModalOpen(true);
                    }}
                    className="p-1.5 text-slate-500 hover:text-[#16a34a] hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold px-2.5"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold px-2.5"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <SmsConfigModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onSave={handleSaveConfig}
        initialData={editingConfig}
      />

      <SmsTemplateModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSave={handleSaveTemplate}
        initialData={editingTemplate}
      />
    </div>
  );
}
