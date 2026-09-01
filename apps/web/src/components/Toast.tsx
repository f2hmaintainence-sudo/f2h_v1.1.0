'use client';

import React, { useState, useEffect } from 'react';
import { registerToastCallback } from '@/services/toast.service';
import { FaTimes, FaCheckCircle, FaExclamationCircle, FaBell } from 'react-icons/fa';

export interface ToastState {
  id: string;
  message: string;
  visible: boolean;
  type: 'error' | 'success' | 'warning' | 'info';
  timeout?: NodeJS.Timeout;
}

let toastId = 0;
const activeToasts = new Map<string, ToastState>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
}

// Toast manager functions
export const showToast = (
  message: string,
  type: 'error' | 'success' | 'warning' | 'info' = 'error',
  duration = 4000
) => {
  const id = `toast-${++toastId}`;

  // Clear existing toast for same message
  for (const [key, toast] of activeToasts.entries()) {
    if (toast.message === message) {
      if (toast.timeout) clearTimeout(toast.timeout);
      activeToasts.delete(key);
    }
  }

  const toast: ToastState = { id, message, visible: true, type };

  toast.timeout = setTimeout(() => {
    toast.visible = false;
    notifyListeners();
    setTimeout(() => {
      activeToasts.delete(id);
      notifyListeners();
    }, 300);
  }, duration);

  activeToasts.set(id, toast);
  notifyListeners();

  return id;
};

export const showErrorToast = (message: string, duration = 4500) =>
  showToast(message, 'error', duration);
export const showSuccessToast = (message: string, duration = 3500) =>
  showToast(message, 'success', duration);
export const showWarningToast = (message: string, duration = 4000) =>
  showToast(message, 'warning', duration);
export const showInfoToast = (message: string, duration = 4000) =>
  showToast(message, 'info', duration);

export const hideToast = (id: string) => {
  const toast = activeToasts.get(id);
  if (toast) {
    toast.visible = false;
    if (toast.timeout) clearTimeout(toast.timeout);
    notifyListeners();
    setTimeout(() => {
      activeToasts.delete(id);
      notifyListeners();
    }, 300);
  }
};

export const clearAllToasts = () => {
  for (const [id, toast] of activeToasts.entries()) {
    if (toast.timeout) clearTimeout(toast.timeout);
    activeToasts.delete(id);
  }
  notifyListeners();
};

const getToastStyles = (type: 'error' | 'success' | 'warning' | 'info') => {
  const styles = {
    error: {
      accentBar: '#dc2626',
      labelColor: '#dc2626',
      Icon: FaExclamationCircle,
      label: 'ERROR',
    },
    success: {
      accentBar: '#16a34a',
      labelColor: '#16a34a',
      Icon: FaCheckCircle,
      label: 'SUCCESS',
    },
    warning: {
      accentBar: '#f59e0b',
      labelColor: '#d97706',
      Icon: FaExclamationCircle,
      label: 'WARNING',
    },
    info: {
      accentBar: '#2563eb',
      labelColor: '#2563eb',
      Icon: FaBell,
      label: 'INFO',
    },
  };
  return styles[type] || styles.info;
};

// Toast Container Component
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  useEffect(() => {
    const update = () => {
      setToasts(Array.from(activeToasts.values()));
    };

    listeners.add(update);
    update();

    const unregisterCallbacks = [
      registerToastCallback('success', (message, duration) =>
        showToast(message, 'success', duration)
      ),
      registerToastCallback('error', (message, duration) =>
        showToast(message, 'error', duration)
      ),
      registerToastCallback('info', (message, duration) =>
        showToast(message, 'info', duration)
      ),
      registerToastCallback('warning', (message, duration) =>
        showToast(message, 'warning', duration)
      ),
    ];

    return () => {
      unregisterCallbacks.forEach((unregister) => unregister());
      listeners.delete(update);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '10px',
        maxWidth: '420px',
        width: 'calc(100% - 48px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const { accentBar, labelColor, Icon, label } = getToastStyles(toast.type);

        return (
          <div
            key={toast.id}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderLeft: `4px solid ${accentBar}`,
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow:
                '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.06)',
              opacity: toast.visible ? 1 : 0,
              transform: toast.visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.96)',
              transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: 'auto',
            }}
          >
            {/* Left circular icon badge */}
            <div
              style={{
                color: accentBar,
                fontSize: '20px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon />
            </div>

            {/* Content Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '800',
                  color: labelColor,
                  letterSpacing: '0.5px',
                  lineHeight: '1.2',
                  marginBottom: '2px',
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: '13.5px',
                  fontWeight: '500',
                  color: '#1e293b',
                  lineHeight: '1.4',
                  wordBreak: 'break-word',
                }}
              >
                {toast.message}
              </div>
            </div>

            {/* Right Close Button */}
            <button
              onClick={() => hideToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '14px',
                borderRadius: '6px',
                flexShrink: 0,
                transition: 'color 0.15s ease, background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#475569';
                e.currentTarget.style.backgroundColor = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <FaTimes />
            </button>
          </div>
        );
      })}
    </div>
  );
}
