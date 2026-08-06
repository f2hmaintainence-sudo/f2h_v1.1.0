// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : EmailConfigModal.tsx
// Description : Modal for creating & editing Email SMTP configuration
//
// ============================================================================

"use client";

import React, { useState, useEffect } from "react";
import { X, Mail, RotateCw } from "lucide-react";

interface EmailConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

export function EmailConfigModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: EmailConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    config_key: "",
    name: "",
    smtp_host: "",
    smtp_port: "587",
    encryption_type: "STARTTLS",
    smtp_user: "",
    smtp_pass: "",
    sender_display_name: "",
    sender_email: "",
    reply_to: "",
  });

  useEffect(() => {
    if (initialData) {
      const cfg = initialData.config_data || {};
      setFormData({
        config_key: initialData.config_key || "",
        name: initialData.name || "",
        smtp_host: cfg.smtp_host || "",
        smtp_port: cfg.smtp_port || "587",
        encryption_type: cfg.encryption_type || "STARTTLS",
        smtp_user: cfg.smtp_user || "",
        smtp_pass: cfg.smtp_pass || "",
        sender_display_name: cfg.sender_display_name || "",
        sender_email: cfg.sender_email || "",
        reply_to: cfg.reply_to || "",
      });
    } else {
      setFormData({
        config_key: "",
        name: "",
        smtp_host: "",
        smtp_port: "587",
        encryption_type: "STARTTLS",
        smtp_user: "",
        smtp_pass: "",
        sender_display_name: "",
        sender_email: "",
        reply_to: "",
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
              <Mail size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {initialData ? "Edit Email SMTP Configuration" : "Add Email SMTP Configuration"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure custom SMTP details for sending email.
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
                placeholder="e.g. primary_smtp"
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
                placeholder="e.g. Primary Company SMTP"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block font-semibold text-slate-700 mb-1">
                SMTP Host Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. smtp.gmail.com"
                value={formData.smtp_host}
                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                SMTP Port <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 587 or 465"
                value={formData.smtp_port}
                onChange={(e) => setFormData({ ...formData, smtp_port: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Encryption Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.encryption_type}
                onChange={(e) => setFormData({ ...formData, encryption_type: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 bg-slate-50/30"
              >
                <option value="STARTTLS">STARTTLS</option>
                <option value="SSL/TLS">SSL/TLS</option>
                <option value="None">None</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                SMTP Username <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Email address or username"
                value={formData.smtp_user}
                onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                SMTP Password / Token <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                placeholder="Use app password or token"
                value={formData.smtp_pass}
                onChange={(e) => setFormData({ ...formData, smtp_pass: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Sender Display Name
              </label>
              <input
                type="text"
                placeholder="e.g. F2H Solutions Support"
                value={formData.sender_display_name}
                onChange={(e) => setFormData({ ...formData, sender_display_name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Sender Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="e.g. support@company.com"
                value={formData.sender_email}
                onChange={(e) => setFormData({ ...formData, sender_email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Reply-To Address
            </label>
            <input
              type="email"
              placeholder="Optional reply-to target"
              value={formData.reply_to}
              onChange={(e) => setFormData({ ...formData, reply_to: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] text-slate-800 placeholder:text-slate-400 bg-slate-50/30"
            />
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
              Save SMTP Config
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
