'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Clock3,
  Globe,
  Home,
  Package,
  PauseCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/services/api.client';
import SkeletonForm from '@/components/Table Generator/SkeletonForm';

type BillingCycle = 'weekly' | 'monthly' | 'custom';
type FrequencyType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

interface SubscriptionConfig {
  pauses_allowed: boolean;
  skips_allowed: boolean;
  modifications_allowed: boolean;
  auto_renew_allowed: boolean;
  billing_cycles: BillingCycle[];
  default_billing_cycle: BillingCycle;
  min_subscription_days: number;
  max_pause_days_per_request: number;
  max_pauses_per_month: number;
  max_pauses_per_year: number;
  pause_notice_hours: number;
  modification_notice_hours: number;
  billing_cutoff_day: number;
  renewal_grace_days: number;
  trial_allowed: boolean;
  trial_days: number;
  admin_notes: string;
}

interface GlobalConfig {
  id?: number;
  subscriptions_enabled: boolean;
  pauses_allowed: boolean;
  skips_allowed: boolean;
  modifications_allowed: boolean;
  auto_renew_allowed: boolean;
  daily_cutoff_time: string;
  cutoff_timezone: string;
  minimum_start_notice_hours: number;
  reserve_inventory_for_subscriptions: boolean;
  auto_pause_on_payment_failure: boolean;
}

interface DeliverySlot {
  id?: number;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  updated_by?: string;
}

interface ProductSubscriptionRule {
  id?: number;
  product_id: number;
  subscription_allowed: boolean;
  subscription_only: boolean;
  min_quantity: number;
  max_quantity: number;
  quantity_step: number;
  default_quantity: number;
  default_frequency: FrequencyType;
  morning_slot_allowed: boolean;
  evening_slot_allowed: boolean;
  inventory_reserved: boolean;
  is_active: boolean;
}

interface ApiResponse<T = any> {
  status?: boolean;
  data?: T;
  message?: string;
  error?: string;
}

type TabType = 'billing' | 'global' | 'slots' | 'products';

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'UTC',
];

const FREQUENCY_OPTIONS: FrequencyType[] = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'custom',
];

const cycleOptions: { value: BillingCycle; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
];

const DEFAULT_CONFIG: SubscriptionConfig = {
  pauses_allowed: true,
  skips_allowed: true,
  modifications_allowed: true,
  auto_renew_allowed: true,
  billing_cycles: ['monthly', 'weekly'],
  default_billing_cycle: 'monthly',
  min_subscription_days: 7,
  max_pause_days_per_request: 14,
  max_pauses_per_month: 2,
  max_pauses_per_year: 12,
  pause_notice_hours: 24,
  modification_notice_hours: 12,
  billing_cutoff_day: 25,
  renewal_grace_days: 3,
  trial_allowed: false,
  trial_days: 0,
  admin_notes: '',
};

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  subscriptions_enabled: true,
  pauses_allowed: true,
  skips_allowed: true,
  modifications_allowed: true,
  auto_renew_allowed: true,
  daily_cutoff_time: '23:59',
  cutoff_timezone: 'Asia/Kolkata',
  minimum_start_notice_hours: 12,
  reserve_inventory_for_subscriptions: true,
  auto_pause_on_payment_failure: true,
};

const DEFAULT_PRODUCT_RULE: ProductSubscriptionRule = {
  product_id: 0,
  subscription_allowed: false,
  subscription_only: false,
  min_quantity: 1,
  max_quantity: 10,
  quantity_step: 1,
  default_quantity: 1,
  default_frequency: 'monthly',
  morning_slot_allowed: true,
  evening_slot_allowed: false,
  inventory_reserved: true,
  is_active: true,
};

function ToggleRow({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition-all duration-200 ${checked
          ? 'border-fresh-green/30 bg-fresh-green/5 shadow-sm shadow-fresh-green/5'
          : 'border-gray-100 bg-white hover:border-gray-200'
        }`}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold text-gray-800">{label}</span>
        <span className="text-xs text-gray-500 leading-relaxed">{description}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-fresh-green' : 'bg-gray-200'
          }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'
            }`}
        />
      </button>
    </div>
  );
}



function NumberField({
  disabled,
  label,
  min = 0,
  max,
  suffix,
  value,
  onChange,
}: {
  disabled?: boolean;
  label: string;
  min?: number;
  max?: number;
  suffix: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 transition-all hover:border-fresh-green/30 hover:shadow-sm">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="number"
            min={min}
            max={max}
            disabled={disabled}
            value={Number.isFinite(value) ? value : 0}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-11 w-full rounded-xl border border-gray-100 bg-gray-50/50 px-4 text-sm font-bold text-gray-800 outline-none transition-all focus:border-fresh-green focus:bg-white focus:ring-4 focus:ring-fresh-green/5 disabled:opacity-50"
          />
        </div>
        <span className="text-xs font-bold text-fresh-green bg-fresh-green/10 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
          {suffix}
        </span>
      </div>
    </div>
  );
}



// Tab Button
function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-2.5 px-6 py-4 text-sm font-bold transition-all relative ${active
          ? 'text-fresh-green'
          : 'text-gray-500 hover:text-gray-700'
        }`}
    >
      <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-fresh-green/10 text-fresh-green' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
        <Icon size={18} />
      </div>
      {label}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-fresh-green rounded-t-full shadow-[0_-2px_10px_rgba(34,197,94,0.3)]" />
      )}
    </button>
  );
}

export default function CatalogSubscriptionConfigPage() {
  const [activeTab, setActiveTab] = useState<TabType>('billing');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [billingConfig, setBillingConfig] = useState<SubscriptionConfig>(DEFAULT_CONFIG);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(DEFAULT_GLOBAL_CONFIG);
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [isSlotEditModalOpen, setIsSlotEditModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<DeliverySlot | undefined>();

  const [rules, setRules] = useState<ProductSubscriptionRule[]>([]);
  const [isProductRuleModalOpen, setIsProductRuleModalOpen] = useState(false);
  const [isProductRuleEditModalOpen, setIsProductRuleEditModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ProductSubscriptionRule | undefined>();

  const selectedCycleLabels = useMemo(
    () =>
      cycleOptions
        .filter((cycle) => billingConfig.billing_cycles.includes(cycle.value))
        .map((cycle) => cycle.label)
        .join(', '),
    [billingConfig.billing_cycles]
  );

  const loadAllConfigs = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [billingRes, globalRes, slotsRes, rulesRes] = await Promise.all([
        api.get<ApiResponse<SubscriptionConfig>>('/api/v1/catalog/subscription-config'),
        api.get<ApiResponse<GlobalConfig>>('/api/v1/catalog/subscription-config/global'),
        api.get<ApiResponse<DeliverySlot[]>>('/api/v1/catalog/subscription-config/delivery-slots'),
        api.get<ApiResponse<ProductSubscriptionRule[]>>('/api/v1/catalog/subscription-config/product-rules'),
      ]);

      if (billingRes.data?.status) {
        setBillingConfig({ ...DEFAULT_CONFIG, ...billingRes.data.data });
      }
      if (globalRes.data?.status) {
        setGlobalConfig({ ...DEFAULT_GLOBAL_CONFIG, ...globalRes.data.data });
      }
      if (slotsRes.data?.status) {
        setSlots(Array.isArray(slotsRes.data.data) ? slotsRes.data.data : []);
      }
      if (rulesRes.data?.status) {
        setRules(Array.isArray(rulesRes.data.data) ? rulesRes.data.data : []);
      }
    } catch (err) {
      setError('Failed to load configurations');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAllConfigs();
  }, [loadAllConfigs]);

  const saveBillingConfig = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await api.post<ApiResponse<any>>('/api/v1/catalog/subscription-config', billingConfig);
      if (response.error || !response.data?.status) {
        setError(response.data?.message || response.error || 'Failed to save billing config');
      } else {
        setMessage('Billing configuration saved');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setError('Failed to save billing config');
    }
    setSaving(false);
  };

  const saveGlobalConfig = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await api.post<ApiResponse<any>>('/api/v1/catalog/subscription-config/global', globalConfig);
      if (response.error || !response.data?.status) {
        setError(response.data?.message || response.error || 'Failed to save global config');
      } else {
        setMessage('Global configuration saved');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setError('Failed to save global config');
    }
    setSaving(false);
  };


  const handleDeleteSlot = async (slotId: number | undefined) => {
    if (!slotId) return;
    setError('');
    try {
      const response = await api.delete(`/api/v1/catalog/subscription-config/delivery-slots/${slotId}`);
      const res = response as ApiResponse;
      if (res.error) {
        setError(res.error);
      } else {
        setMessage('Delivery slot deleted');
        await loadAllConfigs();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setError('Failed to delete slot');
    }
  };


  const handleDeleteProductRule = async (productId: number) => {
    setError('');
    try {
      const response = await api.delete(`/api/v1/catalog/subscription-config/product-rules/${productId}`);
      const res = response as ApiResponse;
      if (res.error) {
        setError(res.error);
      } else {
        setMessage('Product rule deleted');
        await loadAllConfigs();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setError('Failed to delete product rule');
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f6ef] p-3 font-sans md:p-4">
      <div className="space-y-4">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-white p-6 rounded-3xl border border-gray-100 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Settings size={120} />
          </div>

          <div className="flex flex-col gap-1.5 z-10">
            <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400" aria-label="Breadcrumb">
              <Link href="/admin/dashboard" className="hover:text-fresh-green transition-colors">Dashboard</Link>
              <ChevronRight size={12} />
              <span>Catalog</span>
              <ChevronRight size={12} />
              <span className="text-fresh-green">Subscription Config</span>
            </nav>
            <h1 className="text-3xl font-black text-gray-800 tracking-tight">
              Subscription <span className="text-fresh-green">Hub</span>
            </h1>
            <p className="text-sm text-gray-500 font-medium max-w-xl">
              Fine-tune your subscription logic, delivery cycles, and product-specific rules from one central dashboard.
            </p>
          </div>

          <div className="flex items-center gap-3 z-10">
            <button
              type="button"
              onClick={loadAllConfigs}
              disabled={loading || saving}
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-500 shadow-sm transition hover:border-fresh-green hover:text-fresh-green disabled:opacity-60"
              title="Refresh Configuration"
            >
              <RotateCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {message && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={16} />
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-gray-100 bg-white p-8 text-center text-sm font-semibold text-gray-500 shadow-sm">
            Loading subscription configuration...
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-1.5 overflow-x-auto no-scrollbar">
              <div className="flex items-center">
                <TabButton
                  icon={Globe}
                  label="Global Config"
                  active={activeTab === 'global'}
                  onClick={() => setActiveTab('global')}
                />
                <TabButton
                  icon={Clock}
                  label="Delivery Slots"
                  active={activeTab === 'slots'}
                  onClick={() => setActiveTab('slots')}
                />
                <TabButton
                  icon={Package}
                  label="Product Rules"
                  active={activeTab === 'products'}
                  onClick={() => setActiveTab('products')}
                />
                <TabButton
                  icon={SlidersHorizontal}
                  label="Billing Rules"
                  active={activeTab === 'billing'}
                  onClick={() => setActiveTab('billing')}
                />
              </div>
            </div>

            {/* GLOBAL CONFIG TAB */}
            {activeTab === 'global' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-black text-gray-800">Global Settings</h2>
                    <p className="text-sm text-gray-500 font-medium">Control the core behavior of your subscription system.</p>
                  </div>
                  <button
                    onClick={saveGlobalConfig}
                    disabled={saving}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-fresh-green px-8 text-sm font-bold text-white shadow-lg shadow-fresh-green/20 hover:bg-deep-green hover:shadow-xl transition-all disabled:opacity-60"
                  >
                    {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                    Save Changes
                  </button>
                </div>

                <div className="grid gap-6">
                  {/* Master Controls */}
                  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <SlidersHorizontal size={20} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">Master Controls</h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <ToggleRow
                        checked={globalConfig.subscriptions_enabled}
                        label="Subscriptions Enabled"
                        description="Toggle the entire subscription engine on or off."
                        onChange={(value) =>
                          setGlobalConfig((current) => ({
                            ...current,
                            subscriptions_enabled: value,
                          }))
                        }
                      />
                      <ToggleRow
                        checked={globalConfig.reserve_inventory_for_subscriptions}
                        label="Reserve Inventory"
                        description="Automatically set aside stock for recurring orders."
                        onChange={(value) =>
                          setGlobalConfig((current) => ({
                            ...current,
                            reserve_inventory_for_subscriptions: value,
                          }))
                        }
                      />
                      <ToggleRow
                        checked={globalConfig.auto_pause_on_payment_failure}
                        label="Auto-Pause on Failure"
                        description="Stop delivery automatically if payment fails."
                        onChange={(value) =>
                          setGlobalConfig((current) => ({
                            ...current,
                            auto_pause_on_payment_failure: value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Feature Permissions */}
                  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                        <CheckCircle2 size={20} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">Customer Permissions</h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {[
                        { key: 'pauses_allowed', label: 'Allow Pauses', desc: 'Allow customers to temporarily halt deliveries.' },
                        { key: 'skips_allowed', label: 'Allow Skips', desc: 'Allow skipping specific upcoming deliveries.' },
                        { key: 'modifications_allowed', label: 'Allow Modifications', desc: 'Allow changing quantity or frequency.' },
                        { key: 'auto_renew_allowed', label: 'Allow Auto-Renew', desc: 'Allow subscriptions to renew automatically.' }
                      ].map((item) => (
                        <ToggleRow
                          key={item.key}
                          checked={globalConfig[item.key as keyof GlobalConfig] as boolean}
                          label={item.label}
                          description={item.desc}
                          onChange={(value) =>
                            setGlobalConfig((current) => ({
                              ...current,
                              [item.key]: value,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>

                  {/* Operational Settings */}
                  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                        <Clock3 size={20} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">Operational Windows</h3>
                    </div>
                    <div className="grid gap-6 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Daily Cutoff Time</label>
                        <input
                          type="time"
                          value={globalConfig.daily_cutoff_time}
                          onChange={(e) =>
                            setGlobalConfig((current) => ({
                              ...current,
                              daily_cutoff_time: e.target.value,
                            }))
                          }
                          className="h-12 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 text-sm font-bold text-gray-800 outline-none focus:border-fresh-green focus:bg-white transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Cutoff Timezone</label>
                        <select
                          value={globalConfig.cutoff_timezone}
                          onChange={(e) =>
                            setGlobalConfig((current) => ({
                              ...current,
                              cutoff_timezone: e.target.value,
                            }))
                          }
                          className="h-12 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 text-sm font-bold text-gray-800 outline-none focus:border-fresh-green focus:bg-white transition-all"
                        >
                          {TIMEZONES.map((tz) => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">Min Start Notice (Hrs)</label>
                        <input
                          type="number"
                          min={0}
                          value={globalConfig.minimum_start_notice_hours}
                          onChange={(e) =>
                            setGlobalConfig((current) => ({
                              ...current,
                              minimum_start_notice_hours: Number(e.target.value),
                            }))
                          }
                          className="h-12 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 text-sm font-bold text-gray-800 outline-none focus:border-fresh-green focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DELIVERY SLOTS TAB */}
            {activeTab === 'slots' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-black text-gray-800">Delivery Slots</h2>
                    <p className="text-sm text-gray-500 font-medium">Define time windows for subscription deliveries.</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsSlotModalOpen(true);
                    }}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-fresh-green px-8 text-sm font-bold text-white shadow-lg shadow-fresh-green/20 hover:bg-deep-green hover:shadow-xl transition-all"
                  >
                    <Plus size={18} />
                    Add New Slot
                  </button>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  {slots.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gray-50 text-gray-400 mb-4">
                        <Clock3 size={32} />
                      </div>
                      <p className="text-sm font-bold text-gray-500">No delivery slots configured yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50/50">
                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider text-gray-400">Code</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider text-gray-400">Name</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider text-gray-400">Window</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider text-gray-400">Status</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-wider text-gray-400">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {slots.map((slot) => (
                            <tr
                              key={slot.id}
                              className="group transition-colors hover:bg-fresh-green/[0.02]"
                            >
                              <td className="px-6 py-5">
                                <span className="text-sm font-black text-gray-800 bg-gray-100 px-2.5 py-1 rounded-lg uppercase tracking-tight">
                                  {slot.code}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-sm font-bold text-gray-700">{slot.name}</td>
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-600 bg-fresh-green/5 w-fit px-3 py-1.5 rounded-xl">
                                  <Clock size={14} className="text-fresh-green" />
                                  <span>{slot.start_time}</span>
                                  <span className="text-gray-300">→</span>
                                  <span>{slot.end_time}</span>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${slot.is_active
                                      ? 'bg-fresh-green/10 text-fresh-green'
                                      : 'bg-gray-100 text-gray-500'
                                    }`}
                                >
                                  <div className={`h-1.5 w-1.5 rounded-full ${slot.is_active ? 'bg-fresh-green animate-pulse' : 'bg-gray-400'}`} />
                                  {slot.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingSlot(slot);
                                      setIsSlotEditModalOpen(true);
                                    }}
                                    className="p-2 text-gray-400 hover:text-fresh-green hover:bg-fresh-green/10 rounded-xl transition-all"
                                    title="Edit Slot"
                                  >
                                    <SlidersHorizontal size={18} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSlot(slot.id)}
                                    className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                    title="Delete Slot"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PRODUCT RULES TAB */}
            {activeTab === 'products' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-black text-gray-800">Product Subscription Rules</h2>
                    <p className="text-sm text-gray-500 font-medium">Specific subscription constraints per product.</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsProductRuleModalOpen(true);
                    }}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-fresh-green px-8 text-sm font-bold text-white shadow-lg shadow-fresh-green/20 hover:bg-deep-green hover:shadow-xl transition-all"
                  >
                    <Plus size={18} />
                    Add Product Rule
                  </button>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  {rules.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gray-50 text-gray-400 mb-4">
                        <Package size={32} />
                      </div>
                      <p className="text-sm font-bold text-gray-500">No product rules defined yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50/50">
                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider text-gray-400">Product</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider text-gray-400">Settings</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider text-gray-400">Quantity Rules</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-wider text-gray-400">Status</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-wider text-gray-400">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rules.map((rule) => (
                            <tr
                              key={rule.id}
                              className="group transition-colors hover:bg-fresh-green/[0.02]"
                            >
                              <td className="px-6 py-5">
                                <div className="flex flex-col gap-1">
                                  <span className="text-sm font-black text-gray-800">#{rule.product_id}</span>
                                  <span className="text-xs font-medium text-gray-500">Product Identity</span>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-wrap gap-1.5">
                                  {rule.subscription_allowed && (
                                    <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm">Allowed</span>
                                  )}
                                  {rule.subscription_only && (
                                    <span className="bg-amber-50 text-amber-600 text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm">Sub-Only</span>
                                  )}
                                  {rule.inventory_reserved && (
                                    <span className="bg-blue-50 text-blue-600 text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm">Reserved</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="text-xs font-bold text-gray-600 space-y-1">
                                  <div>Qty: {rule.min_quantity}-{rule.max_quantity} (Step {rule.quantity_step})</div>
                                  <div className="text-[10px] text-gray-400 uppercase tracking-tight font-black">Freq: {rule.default_frequency}</div>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${rule.is_active
                                      ? 'bg-fresh-green/10 text-fresh-green'
                                      : 'bg-gray-100 text-gray-500'
                                    }`}
                                >
                                  <div className={`h-1.5 w-1.5 rounded-full ${rule.is_active ? 'bg-fresh-green animate-pulse' : 'bg-gray-400'}`} />
                                  {rule.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingRule(rule);
                                      setIsProductRuleEditModalOpen(true);
                                    }}
                                    className="p-2 text-gray-400 hover:text-fresh-green hover:bg-fresh-green/10 rounded-xl transition-all"
                                  >
                                    <SlidersHorizontal size={18} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProductRule(rule.product_id)}
                                    className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* BILLING RULES TAB */}
            {activeTab === 'billing' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-black text-gray-800">Billing & Lifecycle Rules</h2>
                    <p className="text-sm text-gray-500 font-medium">Fine-tune financial cycles and customer flexibility.</p>
                  </div>
                  <button
                    onClick={saveBillingConfig}
                    disabled={saving}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-fresh-green px-8 text-sm font-bold text-white shadow-lg shadow-fresh-green/20 hover:bg-deep-green hover:shadow-xl transition-all disabled:opacity-60"
                  >
                    {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                    Save Billing Rules
                  </button>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: 'Monthly Pauses', value: billingConfig.max_pauses_per_month, color: 'bg-indigo-50 text-indigo-600' },
                    { label: 'Notice Period', value: `${billingConfig.pause_notice_hours}h`, color: 'bg-amber-50 text-amber-600' },
                    { label: 'Billing Day', value: billingConfig.billing_cutoff_day, color: 'bg-sky-50 text-sky-600' },
                    { label: 'Active Cycles', value: billingConfig.billing_cycles.length, color: 'bg-emerald-50 text-emerald-600' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">{stat.label}</span>
                      <span className={`text-xl font-black ${stat.color.split(' ')[1]}`}>{stat.value}</span>
                    </div>
                  ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
                  <div className="space-y-6">
                    {/* Customer Actions */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-fresh-green/10 text-fresh-green rounded-xl">
                          <PauseCircle size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Customer Flexibility</h3>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {[
                          { key: 'pauses_allowed', label: 'Allow Pauses', desc: 'Customers can pause for a date range.' },
                          { key: 'skips_allowed', label: 'Allow Skips', desc: 'Customers can skip individual dates.' },
                          { key: 'modifications_allowed', label: 'Allow Edits', desc: 'Customers can change qty or schedule.' },
                          { key: 'auto_renew_allowed', label: 'Auto-Renew', desc: 'Enable automatic renewal after cycle.' }
                        ].map((item) => (
                          <ToggleRow
                            key={item.key}
                            checked={billingConfig[item.key as keyof SubscriptionConfig] as boolean}
                            label={item.label}
                            description={item.desc}
                            onChange={(value) =>
                              setBillingConfig((current) => ({
                                ...current,
                                [item.key]: value,
                              }))
                            }
                          />
                        ))}
                      </div>
                    </div>

                    {/* Operational Limits */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                          <SlidersHorizontal size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Operational Limits</h3>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <NumberField
                          label="Min Subscription"
                          value={billingConfig.min_subscription_days}
                          suffix="days"
                          onChange={(value) =>
                            setBillingConfig((current) => ({
                              ...current,
                              min_subscription_days: Math.max(0, Math.floor(value)),
                            }))
                          }
                        />
                        <NumberField
                          disabled={!billingConfig.pauses_allowed}
                          label="Max Pause / Req"
                          value={billingConfig.max_pause_days_per_request}
                          suffix="days"
                          onChange={(value) =>
                            setBillingConfig((current) => ({
                              ...current,
                              max_pause_days_per_request: Math.max(0, Math.floor(value)),
                            }))
                          }
                        />
                        <NumberField
                          disabled={!billingConfig.pauses_allowed}
                          label="Monthly Pauses"
                          value={billingConfig.max_pauses_per_month}
                          suffix="times"
                          onChange={(value) =>
                            setBillingConfig((current) => ({
                              ...current,
                              max_pauses_per_month: Math.max(0, Math.floor(value)),
                            }))
                          }
                        />
                        <NumberField
                          disabled={!billingConfig.pauses_allowed}
                          label="Yearly Pauses"
                          value={billingConfig.max_pauses_per_year}
                          suffix="times"
                          onChange={(value) =>
                            setBillingConfig((current) => ({
                              ...current,
                              max_pauses_per_year: Math.max(0, Math.floor(value)),
                            }))
                          }
                        />
                        <NumberField
                          disabled={!billingConfig.pauses_allowed}
                          label="Pause Notice"
                          value={billingConfig.pause_notice_hours}
                          suffix="hours"
                          onChange={(value) =>
                            setBillingConfig((current) => ({
                              ...current,
                              pause_notice_hours: Math.max(0, Math.floor(value)),
                            }))
                          }
                        />
                        <NumberField
                          disabled={!billingConfig.modifications_allowed}
                          label="Change Notice"
                          value={billingConfig.modification_notice_hours}
                          suffix="hours"
                          onChange={(value) =>
                            setBillingConfig((current) => ({
                              ...current,
                              modification_notice_hours: Math.max(0, Math.floor(value)),
                            }))
                          }
                        />
                      </div>
                    </div>

                    {/* Cycles & Billing */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                          <CalendarClock size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Billing Cycles</h3>
                      </div>
                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-1">Allowed Cycles</label>
                          <div className="flex flex-wrap gap-2">
                            {cycleOptions.map((cycle) => {
                              const selected = billingConfig.billing_cycles.includes(cycle.value);
                              return (
                                <button
                                  key={cycle.value}
                                  type="button"
                                  onClick={() => {
                                    const exists = billingConfig.billing_cycles.includes(cycle.value);
                                    const billing_cycles = exists
                                      ? billingConfig.billing_cycles.filter((item) => item !== cycle.value)
                                      : [...billingConfig.billing_cycles, cycle.value];
                                    const safeCycles = billing_cycles.length ? billing_cycles : [cycle.value];

                                    setBillingConfig((current) => ({
                                      ...current,
                                      billing_cycles: safeCycles,
                                      default_billing_cycle: safeCycles.includes(current.default_billing_cycle)
                                        ? current.default_billing_cycle
                                        : safeCycles[0],
                                    }));
                                  }}
                                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selected
                                      ? 'bg-fresh-green text-white shadow-md shadow-fresh-green/20'
                                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                    }`}
                                >
                                  {cycle.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-1">Default Cycle</label>
                          <select
                            value={billingConfig.default_billing_cycle}
                            onChange={(event) =>
                              setBillingConfig((current) => ({
                                ...current,
                                default_billing_cycle: event.target.value as BillingCycle,
                              }))
                            }
                            className="h-12 w-full rounded-2xl border border-gray-100 bg-gray-50/50 px-4 text-sm font-bold text-gray-800 outline-none focus:border-fresh-green focus:bg-white transition-all"
                          >
                            {billingConfig.billing_cycles.map((cycle) => (
                              <option key={cycle} value={cycle}>
                                {cycleOptions.find((item) => item.value === cycle)?.label || cycle}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3 mt-6">
                        <NumberField
                          label="Cutoff Day"
                          min={1}
                          max={31}
                          value={billingConfig.billing_cutoff_day}
                          suffix="of month"
                          onChange={(value) =>
                            setBillingConfig((current) => ({
                              ...current,
                              billing_cutoff_day: Math.max(1, Math.min(31, Math.floor(value))),
                            }))
                          }
                        />
                        <NumberField
                          label="Grace Period"
                          value={billingConfig.renewal_grace_days}
                          suffix="days"
                          onChange={(value) =>
                            setBillingConfig((current) => ({
                              ...current,
                              renewal_grace_days: Math.max(0, Math.floor(value)),
                            }))
                          }
                        />
                        <ToggleRow
                          checked={billingConfig.trial_allowed}
                          label="Enable Trial"
                          description="Allow new users to try."
                          onChange={(value) =>
                            setBillingConfig((current) => ({
                              ...current,
                              trial_allowed: value,
                              trial_days: value ? current.trial_days : 0,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <aside className="space-y-6">
                    {/* Trial Settings */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                          <CheckCircle2 size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Trial & Notes</h3>
                      </div>
                      <div className="space-y-6">
                        <NumberField
                          disabled={!billingConfig.trial_allowed}
                          label="Trial Duration"
                          value={billingConfig.trial_days}
                          suffix="days"
                          onChange={(value) =>
                            setBillingConfig((current) => ({
                              ...current,
                              trial_days: Math.max(0, Math.floor(value)),
                            }))
                          }
                        />
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-1">Internal Notes</label>
                          <textarea
                            value={billingConfig.admin_notes}
                            onChange={(event) =>
                              setBillingConfig((current) => ({
                                ...current,
                                admin_notes: event.target.value,
                              }))
                            }
                            rows={6}
                            className="w-full resize-none rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-sm font-medium text-gray-700 outline-none focus:border-fresh-green focus:bg-white transition-all"
                            placeholder="Add administrative context..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Visual Summary Card */}
                    <div className="bg-gray-900 rounded-3xl p-6 text-white shadow-2xl shadow-gray-900/20 overflow-hidden relative">
                      <div className="absolute -top-10 -right-10 h-40 w-40 bg-fresh-green/20 blur-3xl rounded-full" />
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <AlertCircle size={18} className="text-fresh-green" />
                        Active Logic
                      </h3>
                      <div className="space-y-4">
                        {[
                          { label: 'Pausing', val: billingConfig.pauses_allowed },
                          { label: 'Skipping', val: billingConfig.skips_allowed },
                          { label: 'Editing', val: billingConfig.modifications_allowed },
                          { label: 'Auto-Renew', val: billingConfig.auto_renew_allowed },
                          { label: 'Trials', val: billingConfig.trial_allowed }
                        ].map((logic, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-400">{logic.label}</span>
                            <span className={`text-xs font-black uppercase tracking-widest ${logic.val ? 'text-fresh-green' : 'text-rose-500'}`}>
                              {logic.val ? 'Active' : 'Blocked'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-8 pt-6 border-t border-white/10">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Default Cycle</span>
                          <span className="text-sm font-black text-white capitalize">{billingConfig.default_billing_cycle}</span>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <SkeletonForm
        isOpen={isSlotModalOpen}
        onClose={() => setIsSlotModalOpen(false)}
        apiEndpoint="/api/v1/catalog/subscription-config/delivery-slots/showAdd"
        submitEndpoint="/api/v1/catalog/subscription-config/delivery-slots"
        onSuccess={() => {
          setIsSlotModalOpen(false);
          loadAllConfigs();
          setMessage('Delivery slot added successfully');
          setTimeout(() => setMessage(''), 3000);
        }}
      />

      <SkeletonForm
        isOpen={isSlotEditModalOpen}
        onClose={() => {
          setIsSlotEditModalOpen(false);
          setEditingSlot(undefined);
        }}
        apiEndpoint={editingSlot ? `/api/v1/catalog/subscription-config/delivery-slots/showEdit/${editingSlot.id}` : ''}
        submitEndpoint="/api/v1/catalog/subscription-config/delivery-slots"
        onSuccess={() => {
          setIsSlotEditModalOpen(false);
          setEditingSlot(undefined);
          loadAllConfigs();
          setMessage('Delivery slot updated successfully');
          setTimeout(() => setMessage(''), 3000);
        }}
      />

      <SkeletonForm
        isOpen={isProductRuleModalOpen}
        onClose={() => setIsProductRuleModalOpen(false)}
        apiEndpoint="/api/v1/catalog/subscription-config/product-rules/showAdd"
        submitEndpoint="/api/v1/catalog/subscription-config/product-rules"
        onSuccess={() => {
          setIsProductRuleModalOpen(false);
          loadAllConfigs();
          setMessage('Product rule added successfully');
          setTimeout(() => setMessage(''), 3000);
        }}
      />

      <SkeletonForm
        isOpen={isProductRuleEditModalOpen}
        onClose={() => {
          setIsProductRuleEditModalOpen(false);
          setEditingRule(undefined);
        }}
        apiEndpoint={editingRule ? `/api/v1/catalog/subscription-config/product-rules/showEdit/${editingRule.product_id}` : ''}
        submitEndpoint="/api/v1/catalog/subscription-config/product-rules"
        onSuccess={() => {
          setIsProductRuleEditModalOpen(false);
          setEditingRule(undefined);
          loadAllConfigs();
          setMessage('Product rule updated successfully');
          setTimeout(() => setMessage(''), 3000);
        }}
      />
    </div>
  );
}
