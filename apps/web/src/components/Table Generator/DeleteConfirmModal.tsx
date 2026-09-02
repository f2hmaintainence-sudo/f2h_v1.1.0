'use client';

import { Trash2, AlertTriangle, X } from 'lucide-react';

type DeleteConfirmModalProps = {
  isOpen: boolean;
  title?: string;
  message?: string;
  itemName?: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export default function DeleteConfirmModal({
  isOpen,
  title = 'Delete Record?',
  message = 'Are you sure you want to delete this record? This action cannot be undone.',
  itemName,
  loading = false,
  error = null,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 !m-0 transition-opacity">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-8 text-center relative">
          {/* Close X Button */}
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Icon */}
          <div
            className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${
              error ? 'bg-amber-100 text-amber-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {error ? (
              <AlertTriangle className="h-10 w-10 text-amber-600" />
            ) : (
              <Trash2 className="h-10 w-10 text-red-600" />
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            {error ? 'Cannot Delete Record' : title}
          </h2>

          {/* Optional item name */}
          {itemName && (
            <p className="mb-3 text-sm font-bold text-gray-700 bg-gray-100 py-1.5 px-3 rounded-lg inline-block break-all max-w-full">
              {itemName}
            </p>
          )}

          {/* Message or Error Alert */}
          {error ? (
            <div className="mt-2 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-left text-sm leading-relaxed font-medium">
              <p className="font-semibold text-amber-950 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                Deletion Blocked
              </p>
              <p className="text-amber-900">{error}</p>
            </div>
          ) : (
            <p className="text-base md:text-lg leading-7 text-gray-600">
              {message}
            </p>
          )}

          {/* Buttons */}
          <div className="mt-8">
            {error ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full h-14 rounded-2xl bg-gray-900 text-lg font-semibold text-white hover:bg-gray-800 transition-all shadow-md"
              >
                Close
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="h-14 rounded-2xl border border-gray-300 bg-white text-lg font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-all"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={loading}
                  className="h-14 rounded-2xl bg-red-600 text-lg font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-all shadow-md shadow-red-600/20"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}