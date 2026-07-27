// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : SmsConfigModal.tsx
// Description : Modal for creating & editing SMS Gateway configurations
//
// ============================================================================

"use client";

import React, { useState, useEffect } from "react";
import { X, MessageSquare, RotateCw } from "lucide-react";

interface SmsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

export function SmsConfigModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: SmsConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    config_key: "",
    name: "",
    provider: "Custom REST Gateway",
    auth_token: "",
    endpoint_url: "",
    sender_id: "",
    route_channel: "Transactional / Alerts",
    enable_unicode: false,
    apply_dnd: false,
  });

  useEffect(() => {
    if (initialData) {
      const cfg = initialData.config_data || {};
      setFormData({
        config_key: initialData.config_key || "",
        name: initialData.name || "",
        provider: initialData.provider || "Custom REST Gateway",
        auth_token: cfg.auth_token || "",
        endpoint_url: cfg.endpoint_url || "",
        sender_id: cfg.sender_id || "",
        route_channel: cfg.route_channel || "Transactional / Alerts",
        enable_unicode: Boolean(cfg.enable_unicode),
        apply_dnd: Boolean(cfg.apply_dnd),
      });
    } else {
      setFormData({
        config_key: "",
        name: "",
        provider: "Custom REST Gateway",
        auth_token: "",
        endpoint_url: "",
        sender_id: "",
        route_channel: "Transactional / Alerts",
        enable_unicode: false,
        apply_dnd: false,
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        id: initialData?.id,
        ...formData,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/50 shadow-xs">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {initialData ? "Edit SMS Provider Config" : "Add SMS Provider Config"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure custom gateway API credentials for dispatching SMS and OTPs.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Configuration Identifier Key <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. twilio_primary"
                value={formData.config_key}
                onChange={(e) => setFormData({ ...formData, config_key: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Display Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Primary SMS Route"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Gateway Provider <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 bg-slate-50/30"
              >
                <option value="Custom REST Gateway">Custom REST Gateway</option>
                <option value="Twilio">Twilio</option>
                <option value="DLT / Fast2SMS">DLT / Fast2SMS</option>
                <option value="Msg91">Msg91</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                API Authorization Key / Token <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Auth key or SID"
                value={formData.auth_token}
                onChange={(e) => setFormData({ ...formData, auth_token: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30 font-mono text-[11px]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Gateway Endpoint URL
            </label>
            <input
              type="text"
              placeholder="https://instantalerts.in/api/smsapi"
              value={formData.endpoint_url}
              onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Sender ID / Signature Header <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. F2HFRESH"
                value={formData.sender_id}
                onChange={(e) => setFormData({ ...formData, sender_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Route / Channel <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.route_channel}
                onChange={(e) => setFormData({ ...formData, route_channel: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 bg-slate-50/30"
              >
                <option value="Transactional / Alerts">Transactional / Alerts</option>
                <option value="Promotional">Promotional</option>
                <option value="OTP">OTP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.enable_unicode}
                onChange={(e) => setFormData({ ...formData, enable_unicode: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-[#16a34a] focus:ring-[#16a34a]"
              />
              <span className="text-slate-700 font-medium">Enable Unicode (Non-English characters)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.apply_dnd}
                onChange={(e) => setFormData({ ...formData, apply_dnd: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-[#16a34a] focus:ring-[#16a34a]"
              />
              <span className="text-slate-700 font-medium">Apply DND (Do Not Disturb) Filters</span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition-colors text-xs"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold transition-all shadow-md shadow-emerald-600/20 text-xs flex items-center gap-2"
            >
              {loading && <RotateCw className="animate-spin" size={14} />}
              Save SMS Config
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
