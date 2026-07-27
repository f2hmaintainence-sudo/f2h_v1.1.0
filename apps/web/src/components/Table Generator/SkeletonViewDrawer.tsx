// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : SkeletonViewDrawer.tsx
// Description : Skeleton view drawer component for web panel
//
// ============================================================================

'use client';

import { getApiBaseUrl } from '@/lib/api-config';

import React, { useEffect, useState } from 'react';
import { X, FileText } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────

interface ColumnMeta {
  data: string;
  name?: string;
  title?: string;
  isDate?: boolean;
  renderHtml?: boolean;
  visible?: boolean;
}

interface SkeletonViewDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Title for the drawer header (e.g. "Order Details", "Customer Details") */
  title?: string;
  /** Subtitle shown below the title */
  subtitle?: string;
  /** Pre-loaded row data from the table (avoids extra API call) */
  rowData?: Record<string, any> | null;
  /** Optional: REST endpoint to fetch full record (e.g. "/v1/customers/orders/{id}/view") */
  viewEndpoint?: string;
  /** Column metadata from SkeletonTable — used for labels, date formatting, visibility */
  columns?: ColumnMeta[];
  /** Fields to exclude from display */
  excludeFields?: string[];
  /** API base URL */
  apiBaseUrl?: string;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Convert snake_case/camelCase to Title Case */
function toTitle(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Strip HTML tags from string */
function stripHtml(str: string, key?: string): string {
  let s = str;
  if (key === 'full_name') {
    s = s.replace(/<span class="badge[^>]*>.*?<\/span>/gi, '');
  }
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Format value for display */
function formatValue(key: string, value: any, isDate?: boolean): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === 'true' || (typeof value === 'string' && value.toLowerCase() === 'true')) return 'Yes';
  if (value === 'false' || (typeof value === 'string' && value.toLowerCase() === 'false')) return 'No';

  if ((key === 'postpaid_credit_limit' || key.includes('credit_limit')) && value !== '' && !isNaN(Number(value))) {
    return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const str = stripHtml(String(value), key).trim();
  if (!str) return '—';

  // Auto-detect or use column metadata for date formatting
  const looksLikeDate = isDate || key.includes('date') || key.endsWith('_at');
  if (looksLikeDate) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch { /* not a date */ }
  }
  return str;
}

/** Detect status-like values and return color */
function getStatusColor(value: string): string | null {
  const s = value.toLowerCase();
  if (s === 'active') return '#16a34a';
  if (s === 'completed' || s === 'complete') return '#2563eb';
  if (s === 'cancelled' || s === 'canceled' || s === 'failed') return '#dc2626';
  if (s === 'paused' || s === 'pending') return '#d97706';
  if (s === 'blocked' || s === 'rejected') return '#dc2626';
  if (s === 'dormant' || s === 'inactive') return '#6b7280';
  if (s === 'new') return '#8b5cf6';
  return null;
}

/** Default fields to exclude from display */
const DEFAULT_EXCLUDE = ['actions', 'id', 'sno', 'deleted_at'];

// ─── Component ───────────────────────────────────────────────

export default function SkeletonViewDrawer({
  isOpen,
  onClose,
  title = 'Record Details',
  subtitle,
  rowData,
  viewEndpoint,
  columns,
  excludeFields = [],
  apiBaseUrl,
}: SkeletonViewDrawerProps) {
  const API_URL = apiBaseUrl || getApiBaseUrl();
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Build exclusion set
  const excludeSet = new Set([...DEFAULT_EXCLUDE, ...excludeFields]);

  useEffect(() => {
    if (!isOpen) return;

    // Use pre-loaded row data if available
    if (rowData) {
      setData(rowData);
      setLoading(false);
      setError('');
      return;
    }

    // Otherwise fetch from API
    if (viewEndpoint) {
      setLoading(true);
      setError('');
      fetch(`${API_URL}${viewEndpoint}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((result) => {
          if (result.status && result.data) {
            setData(result.data);
          } else {
            setError(result.message || 'Record not found');
          }
        })
        .catch(() => setError('Failed to load details'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, rowData, viewEndpoint, API_URL]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build fields list from columns metadata or raw data keys
  const fieldsList: { key: string; label: string; isDate: boolean }[] = [];

  if (columns && columns.length > 0) {
    // Use column metadata for labels and ordering
    for (const col of columns) {
      if (col.data === 'actions' || excludeSet.has(col.data)) continue;
      if (col.visible === false) continue;
      fieldsList.push({
        key: col.data,
        label: col.title || toTitle(col.data),
        isDate: col.isDate ?? false,
      });
    }
  } else if (data) {
    // Fallback: generate fields from data keys
    for (const key of Object.keys(data)) {
      if (excludeSet.has(key)) continue;
      fieldsList.push({
        key,
        label: toTitle(key),
        isDate: key.includes('date') || key.endsWith('_at'),
      });
    }
  }

  // Find status-like field for badge rendering
  const statusField = data
    ? fieldsList.find((f) => f.key.includes('status'))
    : null;
  const statusValue = statusField ? stripHtml(String(data?.[statusField.key] ?? '')) : '';
  const statusColor = statusValue ? getStatusColor(statusValue) : null;

  // Auto-generate subtitle from first "id" field
  const autoSubtitle =
    subtitle ||
    (data
      ? data.order_id || data.customer_id || data.delivery_partner_id || data.enquiry_id || ''
      : '');

  return (
    <>
      {/* Backdrop */}
      <div className="svd-backdrop" onClick={onClose} />

      {/* Drawer */}
      <div className="svd-drawer">
        {/* Header */}
        <div className="svd-header">
          <div>
            <h3 className="svd-title">{title}</h3>
            {autoSubtitle && <span className="svd-subtitle">{autoSubtitle}</span>}
          </div>
          <button className="svd-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="svd-body">
          {loading ? (
            <div className="svd-loading">
              <div className="svd-spinner" />
            </div>
          ) : error ? (
            <div className="svd-error">{error}</div>
          ) : data ? (
            <div className="svd-fields">
              {/* Status Badge */}
              {statusColor && statusValue && (
                <div
                  className="svd-status-badge"
                  style={{
                    background: `${statusColor}15`,
                    color: statusColor,
                  }}
                >
                  <span
                    className="svd-status-dot"
                    style={{ background: statusColor }}
                  />
                  {statusValue}
                </div>
              )}

              {/* Dynamic Fields */}
              {(() => {
                const isPostpaidCustomer =
                  data?.is_postpaid_enabled === true ||
                  data?.is_postpaid_enabled === 'true' ||
                  data?.is_postpaid_enabled === 1 ||
                  data?.is_postpaid_enabled === '1' ||
                  String(data?.is_postpaid_enabled).toLowerCase() === 'true';

                return fieldsList.map((field, idx) => {
                  // Skip status field (shown as badge above)
                  if (statusColor && field.key === statusField?.key) return null;

                  // Skip postpaid_credit_limit if customer is not postpaid enabled
                  if (field.key === 'postpaid_credit_limit' && !isPostpaidCustomer) return null;

                  const rawValue = data[field.key];
                  const displayValue = formatValue(field.key, rawValue, field.isDate);
                  const isImageField = field.key === 'url' || field.key === 'image_url' || field.key.toLowerCase().includes('image');
                  const isHtmlImg = typeof rawValue === 'string' && rawValue.startsWith('<img');

                  return (
                    <div key={`${field.key}-${idx}`} className="svd-field">
                      <div className="svd-field-icon">
                        <FileText size={16} />
                      </div>
                      <div className="svd-field-content">
                        <div className="svd-field-label">{field.label}</div>
                        <div className="svd-field-value">
                          {isHtmlImg ? (
                            <div dangerouslySetInnerHTML={{ __html: rawValue }} className="svd-image-container" />
                          ) : isImageField && rawValue && typeof rawValue === 'string' ? (
                            <div className="svd-image-container">
                              <img
                                src={rawValue.startsWith('http') ? rawValue : `${API_URL.replace(/\/$/, '')}/${rawValue.replace(/^\//, '')}`}
                                alt={field.label}
                                style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'contain' }}
                              />
                            </div>
                          ) : (
                            displayValue
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="svd-footer">
          <button className="svd-btn svd-btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Scoped Styles */}
      <style jsx global>{`
        .svd-backdrop {
          position: fixed;
          inset: 0;
          margin-top: 0 !important;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          z-index: 9998;
          animation: svdFadeIn 0.2s ease;
        }

        .svd-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          margin-top: 0 !important;
          width: 460px;
          max-width: 90vw;
          background: #fff;
          box-shadow: -12px 0 32px rgba(0, 0, 0, 0.14);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          animation: svdSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          border-left: 1px solid #f1f5f9;
        }

        .svd-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
          background: rgba(248, 250, 252, 0.6);
          color: #1e293b;
        }

        .svd-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
        }

        .svd-subtitle {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
          display: block;
        }

        .svd-close-btn {
          background: transparent;
          border: none;
          border-radius: 8px;
          padding: 6px;
          cursor: pointer;
          color: #94a3b8;
          display: flex;
          align-items: center;
          transition: all 0.15s;
        }

        .svd-close-btn:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        .svd-body {
          flex: 1;
          overflow: auto;
          padding: 12px 24px 24px 24px;
        }

        .svd-loading {
          display: flex;
          justify-content: center;
          padding: 60px 0;
        }

        .svd-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid #e5e7eb;
          border-top-color: #2d8a4e;
          border-radius: 50%;
          animation: svdSpin 0.7s linear infinite;
        }

        .svd-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 16px;
          color: #dc2626;
          text-align: center;
          font-size: 14px;
        }

        .svd-fields {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .svd-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          width: fit-content;
          margin-bottom: 12px;
          text-transform: capitalize;
        }

        .svd-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .svd-field {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #f9fafb;
          border: 1px solid #f3f4f6;
          transition: background 0.15s;
        }

        .svd-field:hover {
          background: #f3f4f6;
        }

        .svd-field-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: #e8f5ec;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2d8a4e;
        }

        .svd-field-content {
          flex: 1;
          min-width: 0;
        }

        .svd-field-label {
          font-size: 11px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }

        .svd-field-value {
          font-size: 14px;
          font-weight: 500;
          color: #1f2937;
          word-break: break-word;
        }

        .svd-footer {
          padding: 16px 24px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: flex-end;
        }

        .svd-close-footer-btn {
          padding: 10px 24px;
          border-radius: 10px;
          border: 1px solid #d1d5db;
          background: #fff;
          color: #374151;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .svd-close-footer-btn:hover {
          background: #f3f4f6;
        }

        @keyframes svdSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes svdFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes svdSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
