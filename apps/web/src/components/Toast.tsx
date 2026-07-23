'use client';

import React, { useState } from 'react';
import { registerToastCallback } from '@/services/toast.service';
import { FaTimes, FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaBell } from 'react-icons/fa';

interface ToastState {
  id: string;
  message: string;
  visible: boolean;
  type: 'error' | 'success' | 'warning' | 'info';
  timeout?: NodeJS.Timeout;
}

let toastId = 0;
const activeToasts = new Map<string, ToastState>();
let updateCallback: (() => void) | null = null;

// Toast manager functions
export const showToast = (message: string, type: 'error' | 'success' | 'warning' | 'info' = 'error', duration = 5000) => {
  const id = `toast-${++toastId}`;
  
  // Clear existing toast for same message
  for (const [key, toast] of activeToasts.entries()) {
    if (toast.message === message) {
      clearTimeout(toast.timeout);
      activeToasts.delete(key);
    }
  }
  
  const toast: ToastState = { id, message, visible: true, type };
  
  toast.timeout = setTimeout(() => {
    toast.visible = false;
    updateCallback?.();
    setTimeout(() => {
      activeToasts.delete(id);
      updateCallback?.();
    }, 350);
  }, duration);
  
  activeToasts.set(id, toast);
  updateCallback?.();
  
  return id;
};

export const showErrorToast = (message: string, duration = 5000) => showToast(message, 'error', duration);
export const showSuccessToast = (message: string, duration = 3000) => showToast(message, 'success', duration);
export const showWarningToast = (message: string, duration = 4000) => showToast(message, 'warning', duration);
export const showInfoToast = (message: string, duration = 4000) => showToast(message, 'info', duration);

export const hideToast = (id: string) => {
  const toast = activeToasts.get(id);
  if (toast) {
    toast.visible = false;
    clearTimeout(toast.timeout);
    updateCallback?.();
    setTimeout(() => {
      activeToasts.delete(id);
      updateCallback?.();
    }, 350);
  }
};

export const clearAllToasts = () => {
  for (const [id, toast] of activeToasts.entries()) {
    clearTimeout(toast.timeout);
    activeToasts.delete(id);
  }
  updateCallback?.();
};

// Theme-aware styles — matches F2H dashboard palette (deep-green / fresh-green / gold)
const getToastStyles = (type: 'error' | 'success' | 'warning' | 'info') => {
  const styles = {
    error: {
      borderColor: '#dc2626',
      accentBar: '#dc2626',
      bgColor: '#ffffff',
      textColor: '#1a1a1a',
      labelColor: '#dc2626',
      Icon: FaExclamationCircle,
      label: 'Error',
    },
    success: {
      borderColor: '#2d8a45',   // fresh-green
      accentBar: '#2d8a45',
      bgColor: '#ffffff',
      textColor: '#1a1a1a',
      labelColor: '#2d8a45',
      Icon: FaCheckCircle,
      label: 'Success',
    },
    warning: {
      borderColor: '#f0a500',   // gold
      accentBar: '#f0a500',
      bgColor: '#ffffff',
      textColor: '#1a1a1a',
      labelColor: '#92600a',
      Icon: FaExclamationCircle,
      label: 'Warning',
    },
    info: {
      borderColor: '#0d3d1a',   // deep-green
      accentBar: '#0d3d1a',
      bgColor: '#ffffff',
      textColor: '#1a1a1a',
      labelColor: '#0d3d1a',
      Icon: FaBell,
      label: 'Notification',
    },
  };
  return styles[type];
};

// Toast Container Component
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  
  React.useEffect(() => {
    updateCallback = () => {
      setToasts(Array.from(activeToasts.values()));
    };

    const unregisterCallbacks = [
      registerToastCallback('success', (message, duration) => showToast(message, 'success', duration)),
      registerToastCallback('error', (message, duration) => showToast(message, 'error', duration)),
      registerToastCallback('info', (message, duration) => showToast(message, 'info', duration)),
      registerToastCallback('warning', (message, duration) => showToast(message, 'warning', duration)),
    ];
    
    return () => {
      unregisterCallbacks.forEach(unregister => unregister());
      for (const [id, toast] of activeToasts.entries()) {
        clearTimeout(toast.timeout);
        activeToasts.delete(id);
      }
      updateCallback = null;
    };
  }, []);
  
  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '28px',
        right: '24px',
        zIndex: 999999,
        pointerEvents: toasts.length === 0 ? 'none' : 'auto',
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '10px',
        maxWidth: '380px',
        width: '100%',
      }}
    >
      {toasts.length === 0 ? null : toasts.map(toast => {
        const { borderColor, accentBar, bgColor, textColor, labelColor, Icon, label } = getToastStyles(toast.type);
        
        return (
          <div
            key={toast.id}
            style={{
              background: bgColor,
              border: `1px solid #e5e7eb`,
              borderLeft: `4px solid ${accentBar}`,
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.10), 0 1px 4px rgba(0,0,0,0.06)',
              animation: toast.visible ? 'slideInToast 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'slideOutToast 0.25s ease-in forwards',
              fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
              pointerEvents: 'auto',
              minWidth: '300px',
            }}
          >
            {/* Icon */}
            <div
              style={{
                color: accentBar,
                fontSize: '18px',
                flexShrink: 0,
                marginTop: '1px',
              }}
            >
              <Icon />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: labelColor, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px' }}>
                {label}
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: '500', color: textColor, lineHeight: '1.45', wordBreak: 'break-word' }}>
                {toast.message}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => hideToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
                color: '#9ca3af',
                fontSize: '13px',
                transition: 'color 0.15s ease',
                flexShrink: 0,
                marginTop: '2px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#374151'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
            >
              <FaTimes />
            </button>
          </div>
        );
      })}
      
      <style>{`
        @keyframes slideInToast {
          from {
            opacity: 0;
            transform: translateX(60px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes slideOutToast {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(60px);
          }
        }
      `}</style>
    </div>
  );
}
