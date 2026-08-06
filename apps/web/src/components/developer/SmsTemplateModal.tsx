// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : SmsTemplateModal.tsx
// Description : Modal for creating & editing SMS DLT templates
//
// ============================================================================

"use client";

import React, { useState, useEffect } from "react";
import { X, FileText, RotateCw } from "lucide-react";

interface SmsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

export function SmsTemplateModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: SmsTemplateModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    template_key: "",
    name: "",
    dlt_template_id: "",
    dlt_sender_id: "",
    placeholders: "",
    body: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        template_key: initialData.template_key || "",
        name: initialData.name || "",
        dlt_template_id: initialData.dlt_template_id || "",
        dlt_sender_id: initialData.dlt_sender_id || "",
        placeholders: Array.isArray(initialData.placeholders)
          ? initialData.placeholders.join(", ")
          : initialData.placeholders || "",
        body: initialData.body || "",
      });
    } else {
      setFormData({
        template_key: "",
        name: "",
        dlt_template_id: "",
        dlt_sender_id: "",
        placeholders: "",
        body: "",
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
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/50 shadow-xs">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {initialData ? "Edit SMS Message Template" : "Add SMS Message Template"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure text body layouts mapped to DLT configs.
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
                Template Identifier Key <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ASSOCIATE_LOGIN_OTP"
                value={formData.template_key}
                onChange={(e) => setFormData({ ...formData, template_key: e.target.value })}
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
                placeholder="e.g. Associate Login OTP"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Linked DLT Template ID (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 1707177960186833245"
                value={formData.dlt_template_id}
                onChange={(e) => setFormData({ ...formData, dlt_template_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                DLT Sender ID Signature (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. STPL"
                value={formData.dlt_sender_id}
                onChange={(e) => setFormData({ ...formData, dlt_sender_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Placeholders List
            </label>
            <input
              type="text"
              placeholder="Comma-separated e.g. otp, expiry"
              value={formData.placeholders}
              onChange={(e) => setFormData({ ...formData, placeholders: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
            />
            <p className="text-[10px] text-slate-400 mt-1">Comma-separated placeholders e.g. otp, expiry</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Message Content Body <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Your OTP for F2H Fresh associate login is {#var#}. Valid for 10 minutes."
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30 resize-none font-mono text-[11px]"
            />
            <p className="text-[10px] text-slate-400 mt-1">Use {"{#var#}"} for variables e.g. Your OTP is {"{#var#}"}</p>
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
              Save Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
