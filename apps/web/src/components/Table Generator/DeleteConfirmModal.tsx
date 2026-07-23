'use client';

import { Trash2 } from 'lucide-react';

type DeleteConfirmModalProps = {
  isOpen: boolean;
  title?: string;
  message?: string;
  itemName?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function DeleteConfirmModal({
  isOpen,
  title = 'Delete Record?',
  message = 'Are you sure you want to delete this record? This action cannot be undone.',
  itemName,
  loading = false,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 !m-0">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
        <div className="p-8 text-center">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
            <Trash2 className="h-10 w-10 text-red-600" />
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {title}
          </h2>

          {/* Message */}
          <p className="text-lg leading-8 text-gray-600">
            {message}
          </p>

          {/* Optional item name */}
          {itemName && (
            <p className="mt-3 text-sm font-semibold text-gray-900 break-all">
              {itemName}
            </p>
          )}

          {/* Buttons */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-14 rounded-2xl border border-gray-300 bg-white text-lg font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="h-14 rounded-2xl bg-red-600 text-lg font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}