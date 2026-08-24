'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  Calendar,
  Package,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  CreditCard,
  Tag,
  Sun,
  Moon,
  RotateCw,
  History,
  Clock,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/services/api.client';
import SubscriptionResumeModal from '@/components/f2h/SubscriptionResumeModal';

interface SubscriptionDetailDrawerProps {
  subscriptionId: string | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function SubscriptionDetailDrawer({
  subscriptionId,
  onClose,
  onRefresh,
}: SubscriptionDetailDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [subData, setSubData] = useState<any>(null);
  const [subItems, setSubItems] = useState<any[]>([]);
  const [pauseHistory, setPauseHistory] = useState<any[]>([]);
  const [pausing, setPausing] = useState(false);
  const [pauseFrom, setPauseFrom] = useState('');
  const [pauseTo, setPauseTo] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [togglingAutoRenew, setTogglingAutoRenew] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);

  const now = new Date();
  const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const tomorrowObj = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = tomorrowObj.toISOString().slice(0, 10);

  useEffect(() => {
    if (!subscriptionId) return;
    fetchSubscriptionDetails(subscriptionId);
  }, [subscriptionId]);

  const fetchSubscriptionDetails = async (id: string) => {
    setLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      const [resView, resItems, resHistory] = await Promise.all([
        api.get<any>(`/subscriptions/subscriptions/${id}/view`).catch(() => null),
        api.get<any>(`/subscriptions/subscriptions/${id}/items`).catch(() => null),
        api.get<any>(`/subscriptions/subscriptions/${id}/pause-history`).catch(() => null),
      ]);

      // View details parsing
      if (resView?.data?.data && typeof resView.data.data === 'object' && !Array.isArray(resView.data.data)) {
        setSubData(resView.data.data);
      } else if (resView?.data && typeof resView.data === 'object' && !Array.isArray(resView.data)) {
        setSubData(resView.data);
      }

      // Items array parsing
      let itemsList: any[] = [];
      if (Array.isArray(resItems?.data?.data)) {
        itemsList = resItems.data.data;
      } else if (Array.isArray(resItems?.data)) {
        itemsList = resItems.data;
      }
      setSubItems(itemsList);

      // Pause history
      if (Array.isArray(resHistory?.data?.data)) {
        setPauseHistory(resHistory.data.data);
      } else if (Array.isArray(resHistory?.data)) {
        setPauseHistory(resHistory.data);
      }
    } catch (err) {
      console.error('Failed to load subscription details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!subscriptionId) return null;

  const cleanPFrom = subData?.pause_from_date ? String(subData.pause_from_date).slice(0, 10) : null;
  const cleanPTo = subData?.pause_to_date ? String(subData.pause_to_date).slice(0, 10) : null;
  const isCurrentlyPaused = Boolean(cleanPTo && cleanPTo >= todayStr);

  const handlePauseSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pauseFrom || !pauseTo) {
      setActionError('Start and End dates are required to pause subscription');
      return;
    }
    if (pauseFrom < tomorrowStr) {
      setActionError(`Pause start date must be tomorrow (${tomorrowStr}) or later`);
      return;
    }
    if (pauseTo < pauseFrom) {
      setActionError('Pause end date cannot be before pause start date');
      return;
    }

    setPausing(true);
    setActionError('');
    setActionSuccess('');
    try {
      await api.post(`/subscriptions/subscriptions/${subscriptionId}/pause`, {
        start_date: pauseFrom,
        end_date: pauseTo,
        reason: pauseReason || 'Admin vacation pause',
      });
      setActionSuccess('Subscription paused successfully');
      setPauseFrom('');
      setPauseTo('');
      setPauseReason('');
      fetchSubscriptionDetails(subscriptionId);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to pause subscription');
    } finally {
      setPausing(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (!subData) return;
    const nextVal = !subData.auto_renew;
    setTogglingAutoRenew(true);
    setActionError('');
    setActionSuccess('');
    try {
      await api.patch(`/subscriptions/subscriptions/${subscriptionId}/auto-renew`, {
        auto_renew: nextVal,
      });
      setSubData((prev: any) => ({ ...prev, auto_renew: nextVal }));
      setActionSuccess(`Auto Renew ${nextVal ? 'Enabled' : 'Disabled'} successfully`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to update auto renew');
    } finally {
      setTogglingAutoRenew(false);
    }
  };

  const formatDateDisplay = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="fixed top-16 right-0 bottom-0 left-0 z-40 bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300 border-l border-slate-200">
        {/* Drawer Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-50/90 via-teal-50/80 to-emerald-50/90 border-b border-emerald-100 text-slate-900 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black tracking-tight text-slate-900">
                  Subscription #{subData?.subscription_number || subData?.id || subscriptionId}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    isCurrentlyPaused
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : subData?.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : subData?.status === 'cancelled'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {isCurrentlyPaused ? 'Paused' : (subData?.status || 'Active')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Schedule Type: <span className="capitalize text-emerald-800 font-bold">{subData?.schedule_type || 'Daily'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-emerald-100/60 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-emerald-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto bg-white">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold text-slate-500">Loading subscription details...</span>
            </div>
          ) : (
            <>
              {actionError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{actionError}</span>
                </div>
              )}

              {actionSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {/* Pause Status Alert Banner if paused */}
              {isCurrentlyPaused && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-amber-900">
                        Paused until {formatDateDisplay(cleanPTo)}
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Pause period: {formatDateDisplay(cleanPFrom)} &rarr; {formatDateDisplay(cleanPTo)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsResumeModalOpen(true)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <PlayCircle className="w-3.5 h-3.5" /> Resume
                  </button>
                </div>
              )}

              {/* Subscription Core & Auto-Renew Card */}
              <div className="p-4 bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-emerald-50/50 border border-emerald-100 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" /> Subscription Settings
                  </span>

                  {/* Auto Renew Toggle Switch */}
                  <div className="flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs">
                    <span className="text-xs font-extrabold text-slate-700">Auto Renew:</span>
                    <button
                      type="button"
                      onClick={handleToggleAutoRenew}
                      disabled={togglingAutoRenew}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                        subData?.auto_renew ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          subData?.auto_renew ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className={`text-[11px] font-black uppercase ${subData?.auto_renew ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {subData?.auto_renew ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Start Date</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">{formatDateDisplay(subData?.start_date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">End Date</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">{formatDateDisplay(subData?.end_date) || 'Ongoing'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Payment Mode</span>
                    <span className="font-bold text-slate-800 uppercase flex items-center gap-1 mt-0.5">
                      <CreditCard className="w-3 h-3 text-emerald-600" /> {subData?.payment_type || 'Prepaid'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Renewal Status</span>
                    <span className={`font-bold mt-0.5 block ${subData?.auto_renew ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {subData?.auto_renew ? 'Auto-renews' : 'Ends on Expiry'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer & Branch Details Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-slate-900 font-bold">
                    <User className="w-4 h-4 text-emerald-600" /> Customer Details
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 font-mono">ID: {subData?.customer_id}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Customer Name</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">{subData?.customer_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Mobile Number</span>
                    <span className="font-bold text-slate-900 mt-0.5 block font-mono">📞 {subData?.phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Branch / Zone</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{subData?.branch_name || subData?.branch_id || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Wallet Balance</span>
                    <span className="font-bold text-emerald-700 mt-0.5 block">
                      ₹{Number(subData?.wallet_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Delivery Address if available */}
                {subData?.address_line && (
                  <div className="pt-2 border-t border-slate-200/60 text-xs">
                    <span className="text-slate-400 block text-[11px]">Delivery Address</span>
                    <p className="font-semibold text-slate-700 mt-0.5 text-[11px] leading-relaxed">
                      {[subData.flat_no, subData.building_name, subData.address_line, subData.landmark, subData.address_city, subData.address_pincode].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}
              </div>

              {/* Subscribed Product Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-600" /> Subscribed Product Items ({subItems.length})
                  </h3>
                  {subData?.frequency_label && (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {subData.frequency_label}
                    </span>
                  )}
                </div>

                {subItems.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-semibold">
                    No items found for this subscription
                  </div>
                ) : (
                  <div className="space-y-3">
                    {subItems.map((item, idx) => {
                      const dailyMQty = Number(item.daily_m_quantity || item.m_quantity || 0);
                      const dailyEQty = Number(item.daily_e_quantity || item.e_quantity || 0);
                      const unitTypeStr = (item.unit_type || 'L').toLowerCase().includes('l') ? 'Liter' : (item.unit_type || 'Unit');
                      const unitValueStr = item.unit_value ? `${parseFloat(item.unit_value)} ${unitTypeStr}` : '';
                      const itemTitle = item.variant_name || item.product_name || 'Subscribed Item';

                      return (
                        <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 hover:border-emerald-200 transition-colors">
                          <div className="flex items-start justify-between border-b border-slate-100 pb-2.5 gap-3">
                            <div className="flex items-center gap-3">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={itemTitle}
                                  className="w-11 h-11 object-cover rounded-xl border border-slate-100 shrink-0 shadow-2xs"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold text-xs shrink-0">
                                  <Package className="w-5 h-5" />
                                </div>
                              )}
                              <div>
                                <span className="text-xs font-black text-slate-900 block">{itemTitle}</span>
                                {unitValueStr && (
                                  <span className="text-[11px] font-semibold text-slate-500">Unit Size: {unitValueStr}</span>
                                )}
                                {item.frequency_label && (
                                  <span className="inline-block mt-0.5 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                    {item.frequency_label}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-black text-emerald-700 shrink-0">₹{Number(item.final_price || item.unit_price || 0).toFixed(2)} / unit</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 text-xs">
                            <div className="p-3 bg-amber-50/80 border border-amber-200/60 rounded-xl space-y-1">
                              <span className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1">
                                <Sun className="w-3.5 h-3.5 text-amber-600" /> Morning Delivery
                              </span>
                              <span className="text-xs font-black text-amber-950 block">
                                {dailyMQty > 0 ? `${dailyMQty} ${unitTypeStr}${dailyMQty > 1 ? 's' : ''} / day` : 'No morning delivery'}
                              </span>
                            </div>

                            <div className="p-3 bg-indigo-50/80 border border-indigo-200/60 rounded-xl space-y-1">
                              <span className="text-[10px] font-bold text-indigo-800 uppercase flex items-center gap-1">
                                <Moon className="w-3.5 h-3.5 text-indigo-600" /> Evening Delivery
                              </span>
                              <span className="text-xs font-black text-indigo-950 block">
                                {dailyEQty > 0 ? `${dailyEQty} ${unitTypeStr}${dailyEQty > 1 ? 's' : ''} / day` : 'No evening delivery'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Weekly Delivery Schedule Matrix */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" /> Weekly Delivery Schedule Matrix
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500">
                    {subData?.frequency_label || (subData?.schedule_type ? `${subData.schedule_type.toUpperCase()} Schedule` : 'Active Schedule')}
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {(
                    subData?.weekly_schedule && subData.weekly_schedule.length === 7
                      ? subData.weekly_schedule
                      : subItems.length > 0 && subItems[0].weekly_schedule && subItems[0].weekly_schedule.length === 7
                      ? subItems[0].weekly_schedule
                      : daysOfWeek.map((day, idx) => ({
                          day_of_week: idx,
                          day_name: day,
                          short_day: day,
                          m_quantity: 1,
                          e_quantity: 0,
                          total_quantity: 1,
                          is_active: true,
                        }))
                  ).map((daySchedule: any, idx: number) => {
                    const isActive = Boolean(daySchedule.is_active || daySchedule.total_quantity > 0);
                    const mQty = Number(daySchedule.m_quantity || 0);
                    const eQty = Number(daySchedule.e_quantity || 0);

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl text-center border transition-all ${
                          isActive
                            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <span className={`block text-[10px] font-black uppercase ${isActive ? 'text-emerald-800' : 'text-slate-400'}`}>
                          {daySchedule.short_day || daysOfWeek[idx]}
                        </span>
                        <span
                          className={`block text-[11px] font-black mt-1 ${
                            isActive ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {isActive ? 'Active' : 'Off'}
                        </span>
                        {isActive && (mQty > 0 || eQty > 0) && (
                          <div className="mt-1 flex flex-col gap-0.5 text-[9px] font-bold">
                            {mQty > 0 && <span className="text-amber-700">☀️ {mQty}M</span>}
                            {eQty > 0 && <span className="text-indigo-700">🌙 {eQty}E</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pause Controls Section (Rules compliant) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <PauseCircle className="w-4 h-4 text-amber-600" /> Vacation & Pause Management
                  </span>
                  {isCurrentlyPaused && (
                    <span className="text-[11px] font-bold text-amber-800 px-2.5 py-0.5 bg-amber-100 border border-amber-200 rounded-full">
                      Paused until {formatDateDisplay(cleanPTo)}
                    </span>
                  )}
                </div>

                {isCurrentlyPaused ? (
                  /* Disabled Pause State with prominent resume action */
                  <div className="p-4 bg-white border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-extrabold text-slate-900">Pause Subscription</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Subscription is paused until <strong className="text-amber-800">{formatDateDisplay(cleanPTo)}</strong>.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled
                          className="px-3 py-1.5 bg-slate-100 text-slate-400 text-xs font-bold rounded-xl border border-slate-200 cursor-not-allowed"
                        >
                          Pause Disabled
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsResumeModalOpen(true)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Resume Deliveries
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Pause Form when NOT currently paused */
                  <form onSubmit={handlePauseSubscription} className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pause From</label>
                        <input
                          type="date"
                          min={tomorrowStr}
                          value={pauseFrom}
                          onChange={(e) => setPauseFrom(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pause To</label>
                        <input
                          type="date"
                          min={pauseFrom || tomorrowStr}
                          value={pauseTo}
                          onChange={(e) => setPauseTo(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Reason for pause (e.g. Vacation / Out of station)"
                        value={pauseReason}
                        onChange={(e) => setPauseReason(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={pausing || !pauseFrom || !pauseTo}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      {pausing ? 'Applying Pause...' : 'Apply Vacation Pause'}
                    </button>
                  </form>
                )}
              </div>

              {/* Pause History Widget (Immutable Timeline) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-600" /> Pause &amp; Vacation History ({pauseHistory.length})
                </h3>

                {pauseHistory.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-400 font-semibold">
                    No past pause records for this subscription.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pauseHistory.map((item, idx) => {
                      const isLatestActive = idx === 0 && item.status === 'paused';
                      return (
                        <div
                          key={item.id || idx}
                          className={`p-3.5 rounded-2xl border transition-colors flex items-center justify-between gap-3 ${
                            isLatestActive
                              ? 'bg-amber-50/70 border-amber-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900">
                                {formatDateDisplay(item.start_date)} &rarr; {formatDateDisplay(item.end_date)}
                              </span>
                              <span
                                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                  item.status === 'paused'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {item.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {item.reason || 'Customer vacation pause'} • Logged: {formatDateDisplay(item.created_at)}
                            </p>
                          </div>

                          {/* Resume Button on Latest Active Record */}
                          {isLatestActive ? (
                            <button
                              onClick={() => setIsResumeModalOpen(true)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <PlayCircle className="w-3 h-3" /> Resume
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">
                              Read-only
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>

      {/* Subscription Resume Modal */}
      <SubscriptionResumeModal
        isOpen={isResumeModalOpen}
        onClose={() => setIsResumeModalOpen(false)}
        subscriptionId={String(subData?.subscription_id || subData?.id || subscriptionId)}
        subscriptionNumber={subData?.subscription_number}
        pauseFromDate={subData?.pause_from_date}
        pauseToDate={subData?.pause_to_date}
        onSuccess={() => {
          fetchSubscriptionDetails(subscriptionId);
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}
