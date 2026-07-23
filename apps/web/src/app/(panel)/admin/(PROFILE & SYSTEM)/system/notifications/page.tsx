"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api.client";
import { Bell, RefreshCw, Home, ChevronRight, ToggleLeft, ToggleRight, Save } from "lucide-react";
import Link from "next/link";
import { showSuccessToast } from "@/components/Toast";

const defaultSettings = [
  { key: "order_placed", label: "Order Placed", desc: "Notify when a new order is placed" },
  { key: "order_confirmed", label: "Order Confirmed", desc: "Notify when an order is confirmed" },
  { key: "delivery_completed", label: "Delivery Completed", desc: "Notify on successful delivery" },
  { key: "delivery_failed", label: "Delivery Failed", desc: "Notify when delivery fails" },
  { key: "low_stock_alert", label: "Low Stock Alert", desc: "Notify when stock falls below threshold" },
  { key: "subscription_created", label: "Subscription Created", desc: "Notify on new subscription" },
  { key: "subscription_cancelled", label: "Subscription Cancelled", desc: "Notify on subscription cancellation" },
  { key: "payment_received", label: "Payment Received", desc: "Notify on payment confirmation" },
  { key: "refund_processed", label: "Refund Processed", desc: "Notify when a refund is processed" },
  { key: "daily_summary", label: "Daily Summary", desc: "Send daily business summary" },
];

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/admin/system/notifications");
      if (res.data?.data && res.data.data.length > 0) {
        setSettings(res.data.data);
        const states: Record<string, boolean> = {};
        res.data.data.forEach((s: any) => { states[s.setting_key || s.id] = s.is_active; });
        setToggleStates(states);
      } else {
        // Use defaults
        setSettings(defaultSettings.map(d => ({ setting_key: d.key, description: d.desc, is_active: true })));
        const states: Record<string, boolean> = {};
        defaultSettings.forEach(d => { states[d.key] = true; });
        setToggleStates(states);
      }
    } catch {
      setSettings(defaultSettings.map(d => ({ setting_key: d.key, description: d.desc, is_active: true })));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleToggle = async (key: string) => {
    const newVal = !toggleStates[key];
    setToggleStates(prev => ({ ...prev, [key]: newVal }));
    try {
      const setting = settings.find(s => (s.setting_key || s.id) === key);
      if (setting?.id) {
        await api.patch<any>(`/admin/system/notifications/${setting.id}`, { is_active: newVal });
      } else {
        const label = defaultSettings.find(d => d.key === key);
        await api.post<any>("/admin/system/notifications", {
          setting_key: key, setting_value: {}, description: label?.desc || "", is_active: newVal,
        });
      }
      showSuccessToast(`${key.replace(/_/g, " ")} ${newVal ? "enabled" : "disabled"}`);
    } catch { setToggleStates(prev => ({ ...prev, [key]: !newVal })); }
  };

  return (
    <div className="space-y-5 p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-emerald-600"><Home size={14} /> Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="font-semibold text-slate-800">Notification Settings</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2"><Bell size={24} className="text-amber-500" /> Notification Settings</h1>
          <p className="text-xs text-slate-400 mt-1">Configure which events trigger notifications</p>
        </div>
        <button onClick={fetchSettings} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50"><RefreshCw size={14} /> Refresh</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-[3px] border-amber-100 border-t-amber-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50">
          {defaultSettings.map(ds => {
            const isEnabled = toggleStates[ds.key] ?? true;
            return (
              <div key={ds.key} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Bell size={16} className={isEnabled ? "text-amber-500" : "text-slate-300"} />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{ds.label}</p>
                    <p className="text-[10px] text-slate-400">{ds.desc}</p>
                  </div>
                </div>
                <button onClick={() => handleToggle(ds.key)} className="transition-colors">
                  {isEnabled
                    ? <ToggleRight size={28} className="text-amber-500" />
                    : <ToggleLeft size={28} className="text-slate-300" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
