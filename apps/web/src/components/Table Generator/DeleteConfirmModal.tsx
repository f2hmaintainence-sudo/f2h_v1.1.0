'use client';

import React from 'react';
import { Trash2, AlertTriangle, ShieldAlert, Package, Tag, Loader2, ArrowRight } from 'lucide-react';

export type BlockingItem = {
  id: string | number;
  identifier?: string;
  name: string;
  extra?: string;
};

type DeleteConfirmModalProps = {
  isOpen: boolean;
  title?: string;
  message?: string;
  itemName?: string;
  loading?: boolean;
  isChecking?: boolean;
  canDelete?: boolean;
  blockingMessage?: string;
  blockingItems?: BlockingItem[];
  onClose: () => void;
  onConfirm: () => void;
};

export default function DeleteConfirmModal({
  isOpen,
  title = 'Delete Record?',
  message = 'Are you sure you want to delete this record? This action cannot be undone.',
  itemName,
  loading = false,
  isChecking = false,
  canDelete = true,
  blockingMessage,
  blockingItems = [],
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  const isBlocked = canDelete === false;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 !m-0 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
        <div className="p-6 md:p-8 text-center">
          {/* Icon */}
          <div
            className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl transition-colors ${
              isBlocked ? 'bg-amber-50 border border-amber-200/60' : 'bg-red-50 border border-red-200/60'
            }`}
          >
            {isChecking ? (
              <Loader2 className="h-9 w-9 text-amber-600 animate-spin" />
            ) : isBlocked ? (
              <ShieldAlert className="h-10 w-10 text-amber-600" />
            ) : (
              <Trash2 className="h-10 w-10 text-red-600" />
            )}
          </div>

          {/* Badge */}
          {isBlocked && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/80 text-amber-900 text-xs font-bold uppercase tracking-wider mb-3">
              <AlertTriangle size={13} className="text-amber-700" />
              Active Dependencies Detected
            </div>
          )}

          {/* Title */}
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isBlocked ? 'Cannot Delete Record' : title}
          </h2>

          {/* Item Name */}
          {itemName && (
            <p className="mt-1 text-sm font-bold text-slate-800 bg-slate-50 py-1 px-3 rounded-lg inline-block border border-slate-200/60 max-w-full truncate">
              {itemName}
            </p>
          )}

          {/* Description */}
          <p className="mt-3 text-sm leading-relaxed text-slate-600 text-balance">
            {isBlocked
              ? blockingMessage ||
                'This item cannot be deleted because it currently has active items under it. Please delete or reassign them first.'
              : message}
          </p>

          {/* Checking Loader State */}
          {isChecking && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
              <Loader2 size={14} className="animate-spin text-emerald-600" />
              Verifying dependencies...
            </div>
          )}

          {/* Blocking items list */}
          {isBlocked && blockingItems.length > 0 && (
            <div className="mt-5 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Existing Active Items ({blockingItems.length})
                </span>
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                  Must be deleted first
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/50 p-2 space-y-1.5 divide-y divide-slate-100">
                {blockingItems.map((item, idx) => (
                  <div
                    key={item.id ?? idx}
                    className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        {item.extra?.toLowerCase().includes('product') ? (
                          <Package size={14} />
                        ) : (
                          <Tag size={14} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {item.name}
                        </p>
                        {item.identifier && (
                          <p className="text-[10px] text-slate-400 font-mono">
                            {item.identifier}
                          </p>
                        )}
                      </div>
                    </div>
                    {item.extra && (
                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                        {item.extra}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-7">
            {isBlocked ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-sm font-bold text-white transition-all shadow-md shadow-slate-900/10 cursor-pointer flex items-center justify-center gap-2"
              >
                Understood, Keep Record
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="h-12 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={loading || isChecking}
                  className="h-12 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-bold text-white transition-all shadow-md shadow-red-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}