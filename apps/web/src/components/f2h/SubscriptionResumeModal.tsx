'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  PlayCircle,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Info,
  Clock,
} from 'lucide-react';
import { api } from '@/services/api.client';

interface SubscriptionResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionId: string;
  subscriptionNumber?: string;
  pauseFromDate?: string | null;
  pauseToDate?: string | null;
  onSuccess: () => void;
}

export default function SubscriptionResumeModal({
  isOpen,
  onClose,
  subscriptionId,
  subscriptionNumber,
  pauseFromDate,
  pauseToDate,
  onSuccess,
}: SubscriptionResumeModalProps) {
  const [resumeDate, setResumeDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const now = new Date();
  const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const tomorrowObj = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = tomorrowObj.toISOString().slice(0, 10);

  const cleanPFrom = pauseFromDate ? String(pauseFromDate).slice(0, 10) : null;
  const cleanPTo = pauseToDate ? String(pauseToDate).slice(0, 10) : null;

  // Scenario 1 check: Is today before the pause start date?
  const isBeforePauseStarts = Boolean(cleanPFrom && todayStr < cleanPFrom);

  // Min and Max allowed selectable dates
  const minSelectableDate = tomorrowStr;
  const maxSelectableDate = cleanPTo || '2099-12-31';

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      // Default to tomorrow if within valid range, else pauseToDate
      if (cleanPTo && tomorrowStr <= cleanPTo) {
        setResumeDate(tomorrowStr);
      } else if (cleanPTo) {
        setResumeDate(cleanPTo);
      } else {
        setResumeDate(tomorrowStr);
      }
    }
  }, [isOpen, cleanPFrom, cleanPTo, tomorrowStr]);

  if (!isOpen) return null;

  const handleResumeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Validation for during-pause resumption
    if (!isBeforePauseStarts) {
      if (!resumeDate) {
        setErrorMsg('Please select a valid resume date.');
        return;
      }
      if (resumeDate < tomorrowStr) {
        setErrorMsg(`Resume date must be tomorrow (${tomorrowStr}) or later. Today's delivery cut-off has passed.`);
        return;
      }
      if (cleanPTo && resumeDate > cleanPTo) {
        setErrorMsg(`Resume date cannot be after the current pause end date (${cleanPTo}).`);
        return;
      }
    }

    setSubmitting(true);
    try {
      // Send payload; if before pause starts, resume_date is optional
      const payload = isBeforePauseStarts ? {} : { resume_date: resumeDate };

      // Support customer and admin endpoints with fallback
      let res: any;
      try {
        res = await api.post(`/subscriptions/subscriptions/${subscriptionId}/resume`, payload);
      } catch {
        res = await api.post(`/customer/subscriptions/${subscriptionId}/resume`, payload);
      }

      const resData = res?.data as any;
      if (resData?.status !== false) {
        setSuccessMsg(resData?.message || 'Subscription resumed successfully!');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setErrorMsg(resData?.message || 'Failed to resume subscription');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to resume subscription');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Resume Subscription</h2>
              <p className="text-xs text-slate-500 font-medium">
                #{subscriptionNumber || subscriptionId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Pause Status Banner */}
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Currently Paused Range</span>
          </div>
          <p className="text-xs text-amber-800 font-semibold pl-6">
            {formatDateDisplay(cleanPFrom)} &rarr; {formatDateDisplay(cleanPTo)}
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-2xl">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-2xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleResumeSubmit} className="space-y-4">
          {isBeforePauseStarts ? (
            /* Scenario 1: Resume before pause starts */
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
              <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-emerald-600" /> Upcoming Pause Cancellation
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                This pause has not started yet (scheduled for {formatDateDisplay(cleanPFrom)}).
                Resuming will cancel the upcoming pause and regular deliveries will continue uninterrupted.
              </p>
            </div>
          ) : (
            /* Scenario 2 & 3: Resume during pause */
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Resume Date (Delivery Restart Date) *
              </label>
              <div className="relative">
                <input
                  type="date"
                  min={minSelectableDate}
                  max={maxSelectableDate}
                  value={resumeDate}
                  onChange={(e) => setResumeDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm p-3 rounded-2xl font-bold focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  required
                />
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 space-y-1">
                <p>• <strong>Earliest selectable:</strong> Tomorrow ({formatDateDisplay(tomorrowStr)})</p>
                <p>• <strong>Latest selectable:</strong> Current pause end ({formatDateDisplay(cleanPTo)})</p>
                <p className="text-slate-400 italic">Deliveries will start again from the selected resume date.</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-2xl transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  {isBeforePauseStarts ? 'Cancel Pause & Resume' : 'Resume Deliveries'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
