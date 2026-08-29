// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : SkeletonForm.tsx
// Description : Skeleton form generator component for web panel
//
// ============================================================================

'use client';

import { getApiBaseUrl } from '@/lib/api-config';

import React, { useState, useEffect, useCallback } from 'react';
import { X, RotateCcw, RotateCw, Square, Circle, Check, UploadCloud } from 'lucide-react';
import './SkeletonForm.css';
import { api } from "../../services/api.client";
import { showErrorToast, showSuccessToast } from "@/components/Toast";

const RATIO_PRESETS: { id: string; label: string; ratio?: number }[] = [
  { id: 'free', label: 'Free Crop' },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '1:1', label: '1:1 Square', ratio: 1 },
  { id: '21:9', label: '21:9 Ultra', ratio: 21 / 9 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
];

// ─── Types ───────────────────────────────────────────────────

interface ValidationRule {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  message?: string;
}

interface FieldDef {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: { value: string; label: string }[];
  optionsEndpoint?: string;
  validation?: ValidationRule;
  width?: 'full' | 'half' | 'third' | 'quarter';
  disabled?: boolean;
  visible?: boolean;
  group?: string;
  description?: string;
  prefix?: string;
  allowNegative?: boolean;
  step?: string | number;
  toggleOptions?: { onLabel?: string; offLabel?: string; pill?: boolean };
  url?: string;
  action?: 'redirect';
  accept?: string;
  crop?: boolean;
  aspectRatio?: number;
  cropWidth?: number;
  cropHeight?: number;
  multiple?: boolean;
  /** Show this field only when another field equals a specific value */
  visibleWhen?: { field: string; value: any };
}

interface FormResponse {
  status: boolean;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  fields: any[];
  data: Record<string, any>;
  submitLabel: string;
  message: string;
  stepper?: boolean;
  script?: string;
  isStepperLayout?: boolean;
}

interface SkeletonFormProps {
  /** REST endpoint to fetch form config */
  apiEndpoint: string;
  /** REST endpoint to submit form data */
  submitEndpoint: string;
  /** API base URL */
  apiBaseUrl?: string;
  /** Whether the form is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Success callback */
  onSuccess?: (result: any) => void;
  /** Additional CSS class */
  className?: string;
}

// ─── Validation ──────────────────────────────────────────────

function validateField(field: FieldDef, value: any, formData?: Record<string, any>): string | null {
  const isEmpty = value === undefined || value === null || String(value).trim() === '';

  if (field.required && isEmpty) {
    return `${field.label} is required`;
  }
  if (isEmpty) return null;

  if (field.type === 'number') {
    const num = Number(value);
    if (isNaN(num)) return `${field.label} must be a number`;
    if (!field.allowNegative && num < 0) return `${field.label} cannot be negative`;
  }

  if (field.name === 'price' && formData && formData.original_price) {
    const orig = parseFloat(formData.original_price);
    const sell = parseFloat(value);
    if (!isNaN(orig) && !isNaN(sell) && orig > 0 && sell > orig) {
      return `Selling Price cannot exceed Original Price (MRP: ₹${orig})`;
    }
  }

  const v = field.validation;
  if (!v) return null;

  const strValue = String(value);

  if (v.minLength && strValue.length < v.minLength) {
    return v.message ?? `Minimum ${v.minLength} characters`;
  }
  if (v.maxLength && strValue.length > v.maxLength) {
    return v.message ?? `Maximum ${v.maxLength} characters`;
  }

  if (field.type === 'number') {
    const num = Number(value);
    if (v.min !== undefined && num < v.min) return v.message ?? `Minimum is ${v.min}`;
    if (v.max !== undefined && num > v.max) return v.message ?? `Maximum is ${v.max}`;
  }

  if (v.pattern) {
    try {
      if (!new RegExp(v.pattern).test(strValue)) {
        return v.message ?? `Invalid format`;
      }
    } catch { /* ignore bad regex */ }
  }

  return null;
}

const getCroppedBase64WithRotation = (
  src: string,
  zoom: number,
  panX: number,
  panY: number,
  rotate: number,
  cropWidth = 800,
  cropHeight = 800,
  cropBox: { x: number; y: number; w: number; h: number } = { x: 50, y: 50, w: 220, h: 220 }
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 1. Calculate base rendered size in the 320x320 container with object-fit: contain
      const containerSize = 320;
      const naturalWidth = img.naturalWidth || img.width || 800;
      const naturalHeight = img.naturalHeight || img.height || 800;
      const imgRatio = naturalWidth / naturalHeight;

      let baseW = containerSize;
      let baseH = containerSize;
      if (imgRatio >= 1) {
        baseW = containerSize;
        baseH = containerSize / imgRatio;
      } else {
        baseH = containerSize;
        baseW = containerSize * imgRatio;
      }

      // 2. Compute output dimensions based on cropBox aspect ratio
      const boxW = Math.max(10, cropBox.w);
      const boxH = Math.max(10, cropBox.h);
      const targetRatio = boxW / boxH;

      // Maintain crisp resolution (proportional to natural image size)
      const scaleMultiplier = Math.max(
        1.5,
        Math.min(4, Math.round(Math.max(naturalWidth, naturalHeight) / containerSize))
      );
      const outputW = Math.round(boxW * scaleMultiplier);
      const outputH = Math.round(outputW / targetRatio);

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(100, outputW);
      canvas.height = Math.max(100, outputH);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(src);
        return;
      }

      // Clean canvas background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      // Map cropBox rectangle [cropBox.x, cropBox.y, boxW, boxH] in container space to [0, 0, canvas.width, canvas.height]
      const scale = canvas.width / boxW;
      ctx.scale(scale, scale);
      ctx.translate(-cropBox.x, -cropBox.y);

      // In 320x320 container coordinates, image center is at (containerSize/2 + panX, containerSize/2 + panY)
      ctx.translate(containerSize / 2 + panX, containerSize / 2 + panY);
      if (rotate) {
        ctx.rotate((rotate * Math.PI) / 180);
      }
      ctx.scale(zoom, zoom);

      // Draw image centered at origin
      ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
      ctx.restore();

      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
};

// ─── Exported SkeletonImageUploader Component ────────────────
export interface SkeletonImageUploaderProps {
  value?: string | string[];
  onChange: (val: string | string[]) => void;
  aspectRatio?: number;
  cropWidth?: number;
  cropHeight?: number;
  crop?: boolean;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
  apiBaseUrl?: string;
  className?: string;
}

export function SkeletonImageUploader({
  value,
  onChange,
  aspectRatio = 1,
  cropWidth = 800,
  cropHeight = 800,
  crop = true,
  multiple = false,
  accept = 'image/*',
  disabled = false,
  apiBaseUrl,
  className = '',
}: SkeletonImageUploaderProps) {
  const [cropModal, setCropModal] = useState<{
    isOpen: boolean;
    src: string;
    rawSrc?: string;
    zoom: number;
    panX: number;
    panY: number;
    rotate: number;
  }>({
    isOpen: false,
    src: '',
    zoom: 1,
    panX: 0,
    panY: 0,
    rotate: 0,
  });

  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 50,
    y: 50,
    w: 220,
    h: 220,
  });
  const [selectedCropRatio, setSelectedCropRatio] = useState<string>('free');
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [dragStartBox, setDragStartBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [cropDrag, setCropDrag] = useState<{
    isDragging: boolean;
    startX: number;
    startY: number;
    initialPanX: number;
    initialPanY: number;
  }>({ isDragging: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });

  const cropContainerRef = React.useRef<HTMLDivElement | null>(null);

  const applyCropRatio = (ratioId: string) => {
    setSelectedCropRatio(ratioId);
    if (ratioId === 'free') return;
    const targetRatio = RATIO_PRESETS.find((r) => r.id === ratioId)?.ratio;
    if (!targetRatio) return;

    let w = 240;
    let h = 240;
    if (targetRatio >= 1) {
      w = 260;
      h = Math.min(260, Math.round(w / targetRatio));
    } else {
      h = 260;
      w = Math.min(260, Math.round(h * targetRatio));
    }
    const x = Math.max(10, Math.round((320 - w) / 2));
    const y = Math.max(10, Math.round((320 - h) / 2));
    setCropBox({ x, y, w, h });
  };

  const handleRotate = (dir: 'left' | 'right') => {
    setCropModal((prev) => ({
      ...prev,
      rotate: dir === 'left' ? (prev.rotate - 90 + 360) % 360 : (prev.rotate + 90) % 360,
    }));
  };

  const handleHandleMouseDown = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (handle === 'move') {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        setCropDrag({
          isDragging: true,
          startX: e.clientX,
          startY: e.clientY,
          initialPanX: cropModal.panX,
          initialPanY: cropModal.panY,
        });
        setActiveHandle(null);
        return;
      }
    }
    setActiveHandle(handle);
    setDragStartBox({ ...cropBox });
    setCropDrag({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: cropModal.panX,
      initialPanY: cropModal.panY,
    });
  };

  const handleHandleTouchStart = (handle: string, e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    e.stopPropagation();
    const touch = e.touches[0];
    if (handle === 'move') {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        setCropDrag({
          isDragging: true,
          startX: touch.clientX,
          startY: touch.clientY,
          initialPanX: cropModal.panX,
          initialPanY: cropModal.panY,
        });
        setActiveHandle(null);
        return;
      }
    }
    setActiveHandle(handle);
    setDragStartBox({ ...cropBox });
    setCropDrag({
      isDragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      initialPanX: cropModal.panX,
      initialPanY: cropModal.panY,
    });
  };

  const handleCropMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setCropDrag({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: cropModal.panX,
      initialPanY: cropModal.panY,
    });
  };

  const handleCropTouchStart = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    setCropDrag({
      isDragging: true,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      initialPanX: cropModal.panX,
      initialPanY: cropModal.panY,
    });
  };

  const handleCropMouseMove = useCallback((e: MouseEvent) => {
    if (!cropDrag.isDragging) return;
    const dx = e.clientX - cropDrag.startX;
    const dy = e.clientY - cropDrag.startY;

    if (activeHandle && dragStartBox) {
      setCropBox(() => {
        let { x, y, w, h } = dragStartBox;
        const containerSize = 320;
        const minSize = 40;

        if (activeHandle === 'move') {
          x = Math.max(0, Math.min(containerSize - w, x + dx));
          y = Math.max(0, Math.min(containerSize - h, y + dy));
          return { x, y, w, h };
        }

        if (activeHandle.includes('r')) {
          w = Math.max(minSize, Math.min(containerSize - x, dragStartBox.w + dx));
        }
        if (activeHandle.includes('b')) {
          h = Math.max(minSize, Math.min(containerSize - y, dragStartBox.h + dy));
        }
        if (activeHandle.includes('l')) {
          const maxLeft = dragStartBox.x + dragStartBox.w - minSize;
          const newX = Math.max(0, Math.min(maxLeft, dragStartBox.x + dx));
          w = dragStartBox.w - (newX - dragStartBox.x);
          x = newX;
        }
        if (activeHandle.includes('t')) {
          const maxTop = dragStartBox.y + dragStartBox.h - minSize;
          const newY = Math.max(0, Math.min(maxTop, dragStartBox.y + dy));
          h = dragStartBox.h - (newY - dragStartBox.y);
          y = newY;
        }

        return { x, y, w, h };
      });
    } else {
      setCropModal((prev) => ({
        ...prev,
        panX: cropDrag.initialPanX + dx,
        panY: cropDrag.initialPanY + dy,
      }));
    }
  }, [cropDrag, activeHandle, dragStartBox]);

  const handleCropTouchMove = useCallback((e: TouchEvent) => {
    if (!cropDrag.isDragging || !e.touches[0]) return;
    const touch = e.touches[0];
    const dx = touch.clientX - cropDrag.startX;
    const dy = touch.clientY - cropDrag.startY;

    if (activeHandle && dragStartBox) {
      setCropBox(() => {
        let { x, y, w, h } = dragStartBox;
        const containerSize = 320;
        const minSize = 40;

        if (activeHandle === 'move') {
          x = Math.max(0, Math.min(containerSize - w, x + dx));
          y = Math.max(0, Math.min(containerSize - h, y + dy));
          return { x, y, w, h };
        }

        if (activeHandle.includes('r')) {
          w = Math.max(minSize, Math.min(containerSize - x, dragStartBox.w + dx));
        }
        if (activeHandle.includes('b')) {
          h = Math.max(minSize, Math.min(containerSize - y, dragStartBox.h + dy));
        }
        if (activeHandle.includes('l')) {
          const maxLeft = dragStartBox.x + dragStartBox.w - minSize;
          const newX = Math.max(0, Math.min(maxLeft, dragStartBox.x + dx));
          w = dragStartBox.w - (newX - dragStartBox.x);
          x = newX;
        }
        if (activeHandle.includes('t')) {
          const maxTop = dragStartBox.y + dragStartBox.h - minSize;
          const newY = Math.max(0, Math.min(maxTop, dragStartBox.y + dy));
          h = dragStartBox.h - (newY - dragStartBox.y);
          y = newY;
        }

        return { x, y, w, h };
      });
    } else {
      setCropModal((prev) => ({
        ...prev,
        panX: cropDrag.initialPanX + dx,
        panY: cropDrag.initialPanY + dy,
      }));
    }
  }, [cropDrag, activeHandle, dragStartBox]);

  const handleCropMouseUp = useCallback(() => {
    setCropDrag((prev) => ({ ...prev, isDragging: false }));
    setActiveHandle(null);
    setDragStartBox(null);
  }, []);

  useEffect(() => {
    if (cropDrag.isDragging) {
      window.addEventListener('mousemove', handleCropMouseMove);
      window.addEventListener('mouseup', handleCropMouseUp);
      window.addEventListener('touchmove', handleCropTouchMove, { passive: false });
      window.addEventListener('touchend', handleCropMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleCropMouseMove);
      window.removeEventListener('mouseup', handleCropMouseUp);
      window.removeEventListener('touchmove', handleCropTouchMove);
      window.removeEventListener('touchend', handleCropMouseUp);
    };
  }, [cropDrag.isDragging, handleCropMouseMove, handleCropMouseUp, handleCropTouchMove]);

  // Set up wheel listener for zooming inside modal
  const setCropContainerRef = useCallback((el: HTMLDivElement | null) => {
    cropContainerRef.current = el;
    if (el) {
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCropModal((prev) => ({
          ...prev,
          zoom: Math.max(0.2, Math.min(5, prev.zoom + (e.deltaY < 0 ? 0.1 : -0.1))),
        }));
      };
      el.addEventListener('wheel', handleWheel, { passive: false });
    }
  }, []);

  const handleApplyCrop = async () => {
    const cropped = await getCroppedBase64WithRotation(
      cropModal.src,
      cropModal.zoom,
      cropModal.panX,
      cropModal.panY,
      cropModal.rotate,
      cropWidth,
      cropHeight,
      cropBox
    );

    if (multiple) {
      const currentArr = Array.isArray(value) ? value : value ? [value] : [];
      onChange([...currentArr, cropped]);
    } else {
      onChange(cropped);
    }
    setCropModal((prev) => ({ ...prev, isOpen: false }));
  };

  let previews: string[] = [];
  if (multiple) {
    const raw = Array.isArray(value) ? value : value ? [value] : [];
    previews = ([] as any[]).concat(...raw).filter((v: any) => v && typeof v === 'string' && v.trim() !== '') as string[];
  } else {
    if (value && typeof value === 'string' && value.trim() !== '') {
      previews = [value];
    }
  }

  return (
    <div className={`skf-file-wrap ${className}`}>
      <div className="skf-multiple-previews" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {previews.map((previewSrc, idx) => {
          let fullUrl = previewSrc;
          if (previewSrc && !previewSrc.startsWith('http') && !previewSrc.startsWith('data:')) {
            const apiBase = apiBaseUrl || getApiBaseUrl();
            const rootHost = apiBase.replace(/\/api(?:\/v\d+)?\/?$/, '');
            let path = previewSrc.startsWith('/') ? previewSrc : `/${previewSrc}`;
            if (!path.startsWith('/uploads/')) path = `/uploads${path}`;
            fullUrl = `${rootHost}${path}`;
          }

          return (
            <div key={idx} className="skf-image-editor" style={{ width: multiple ? '150px' : '100%' }}>
              <div
                className="skf-crop-preview"
                style={{
                  aspectRatio: aspectRatio || 1,
                  position: 'relative',
                  overflow: 'hidden',
                  width: '100%',
                }}
              >
                <img
                  src={fullUrl}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div className="skf-crop-controls">
                {!multiple && crop && (
                  <button
                    type="button"
                    className="skf-reset-crop"
                    onClick={() => {
                      setCropModal({
                        isOpen: true,
                        src: previewSrc,
                        rawSrc: previewSrc,
                        zoom: 1,
                        panX: 0,
                        panY: 0,
                        rotate: 0,
                      });
                      setSelectedCropRatio('free');
                      setCropBox({ x: 50, y: 50, w: 220, h: 220 });
                    }}
                  >
                    Crop
                  </button>
                )}
                <button
                  type="button"
                  className="skf-reset-crop"
                  style={{ borderColor: '#ef4444', color: '#ef4444' }}
                  onClick={() => {
                    if (multiple) {
                      const newArr = [...previews];
                      newArr.splice(idx, 1);
                      onChange(newArr);
                    } else {
                      onChange('');
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}

        {(!previews.length || multiple) && (
          <label className="skf-file-picker" style={{ width: multiple && previews.length ? '150px' : '100%', alignSelf: 'stretch' }}>
            <UploadCloud size={32} style={{ color: '#94a3b8', marginBottom: '4px' }} />
            <span style={{ textAlign: 'center' }}>{multiple && previews.length ? '+ Add Image' : 'Click to upload image'}</span>
            <input
              type="file"
              accept={accept}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const src = reader.result as string;
                  if (crop) {
                    setCropModal({
                      isOpen: true,
                      src,
                      rawSrc: src,
                      zoom: 1,
                      panX: 0,
                      panY: 0,
                      rotate: 0,
                    });
                    setSelectedCropRatio('free');
                    setCropBox({ x: 50, y: 50, w: 220, h: 220 });
                  } else {
                    if (multiple) {
                      const currentArr = Array.isArray(value) ? value : value ? [value] : [];
                      onChange([...currentArr, src]);
                    } else {
                      onChange(src);
                    }
                  }
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }}
              disabled={disabled}
            />
          </label>
        )}
      </div>

      {/* ── Image Crop & Rotate Modal ── */}
      {cropModal.isOpen && (
        <div className="skf-crop-modal-overlay">
          <div className="skf-crop-modal" style={{ maxWidth: '540px' }}>
            <div className="skf-crop-modal-header">
              <h3 className="skf-crop-modal-title">Image Crop &amp; Rotate</h3>
              <button
                type="button"
                className="skf-close-btn"
                onClick={() => setCropModal((prev) => ({ ...prev, isOpen: false }))}
                style={{ padding: 0 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Aspect Ratio Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginRight: '4px', whiteSpace: 'nowrap' }}>Aspect Ratio:</span>
              {RATIO_PRESETS.map((preset) => {
                const isSelected = selectedCropRatio === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyCropRatio(preset.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: isSelected ? '1px solid #16a34a' : '1px solid #cbd5e1',
                      background: isSelected ? '#16a34a' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="skf-crop-modal-body">
              <div
                ref={setCropContainerRef}
                className="skf-crop-container-outer"
                onMouseDown={handleCropMouseDown}
                onTouchStart={handleCropTouchStart}
                style={{
                  cursor: cropDrag.isDragging ? 'grabbing' : 'grab',
                }}
              >
                <img
                  src={cropModal.src}
                  alt="Crop Source"
                  draggable="false"
                  className="skf-crop-image-under"
                  style={{
                    transform: `translate(${cropModal.panX}px, ${cropModal.panY}px) scale(${cropModal.zoom}) rotate(${cropModal.rotate}deg)`,
                    transformOrigin: 'center',
                    transition: cropDrag.isDragging ? 'none' : 'transform 0.1s ease-out',
                  }}
                />

                <div
                  className="skf-crop-window-overlay"
                  style={{
                    left: `${cropBox.x}px`,
                    top: `${cropBox.y}px`,
                    width: `${cropBox.w}px`,
                    height: `${cropBox.h}px`,
                    transform: 'none',
                    borderRadius: '8px',
                    pointerEvents: 'auto',
                    cursor: activeHandle === 'move' ? 'grabbing' : 'grab',
                  }}
                  onMouseDown={(e) => handleHandleMouseDown('move', e)}
                  onTouchStart={(e) => handleHandleTouchStart('move', e)}
                >
                  <div className="skf-crop-window-grid" />

                  <span className="skf-crop-handle skf-crop-handle-tl" onMouseDown={(e) => handleHandleMouseDown('tl', e)} onTouchStart={(e) => handleHandleTouchStart('tl', e)} style={{ cursor: 'nwse-resize', pointerEvents: 'auto' }} />
                  <span className="skf-crop-handle skf-crop-handle-tr" onMouseDown={(e) => handleHandleMouseDown('tr', e)} onTouchStart={(e) => handleHandleTouchStart('tr', e)} style={{ cursor: 'nesw-resize', pointerEvents: 'auto' }} />
                  <span className="skf-crop-handle skf-crop-handle-bl" onMouseDown={(e) => handleHandleMouseDown('bl', e)} onTouchStart={(e) => handleHandleTouchStart('bl', e)} style={{ cursor: 'nesw-resize', pointerEvents: 'auto' }} />
                  <span className="skf-crop-handle skf-crop-handle-br" onMouseDown={(e) => handleHandleMouseDown('br', e)} onTouchStart={(e) => handleHandleTouchStart('br', e)} style={{ cursor: 'nwse-resize', pointerEvents: 'auto' }} />
                  <span className="skf-crop-handle skf-crop-handle-t" onMouseDown={(e) => handleHandleMouseDown('t', e)} onTouchStart={(e) => handleHandleTouchStart('t', e)} style={{ cursor: 'ns-resize', pointerEvents: 'auto' }} />
                  <span className="skf-crop-handle skf-crop-handle-b" onMouseDown={(e) => handleHandleMouseDown('b', e)} onTouchStart={(e) => handleHandleTouchStart('b', e)} style={{ cursor: 'ns-resize', pointerEvents: 'auto' }} />
                  <span className="skf-crop-handle skf-crop-handle-l" onMouseDown={(e) => handleHandleMouseDown('l', e)} onTouchStart={(e) => handleHandleTouchStart('l', e)} style={{ cursor: 'ew-resize', pointerEvents: 'auto' }} />
                  <span className="skf-crop-handle skf-crop-handle-r" onMouseDown={(e) => handleHandleMouseDown('r', e)} onTouchStart={(e) => handleHandleTouchStart('r', e)} style={{ cursor: 'ew-resize', pointerEvents: 'auto' }} />
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-3 text-center">
                Drag image to reposition, or crop window to adjust. Scroll to zoom.
              </div>
            </div>

            <div className="skf-crop-modal-footer">
              <div className="skf-crop-actions-left">
                <button
                  type="button"
                  title="Rotate Left"
                  className="skf-crop-btn-icon"
                  onClick={() => handleRotate('left')}
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  type="button"
                  title="Rotate Right"
                  className="skf-crop-btn-icon"
                  onClick={() => handleRotate('right')}
                >
                  <RotateCw size={16} />
                </button>
              </div>

              <div className="skf-crop-actions-right">
                <button
                  type="button"
                  className="skf-btn skf-btn-cancel"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                  onClick={() => setCropModal((prev) => ({ ...prev, isOpen: false }))}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="skf-btn skf-btn-submit"
                  style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={handleApplyCrop}
                >
                  <Check size={14} />
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────

export default function SkeletonForm({
  apiEndpoint,
  submitEndpoint,
  apiBaseUrl,
  isOpen,
  onClose,
  onSuccess,
  className,
}: SkeletonFormProps) {

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [maxWidth, setMaxWidth] = useState('');
  const [submitLabel, setSubmitLabel] = useState('Save');
  const [fields, setFields] = useState<any[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [isStepper, setIsStepper] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [scriptToRun, setScriptToRun] = useState<string>('');
  const [fileStates, setFileStates] = useState<Record<string, {
    src: string;
    rawSrc?: string;
    zoom: number;
    panX: number;
    panY: number;
    rotate?: number;
    isNew: boolean;
  }>>({});

  const [dragState, setDragState] = useState<{
    fieldName: string | null;
    startX: number;
    startY: number;
    initialPanX: number;
    initialPanY: number;
  }>({ fieldName: null, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });

  const fileStatesRef = React.useRef(fileStates);
  useEffect(() => {
    fileStatesRef.current = fileStates;
  }, [fileStates]);

  const previewRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const wheelListeners = React.useRef<Record<string, (e: WheelEvent) => void>>({});

  const setPreviewRef = useCallback((name: string, el: HTMLDivElement | null) => {
    if (!el) {
      const oldEl = previewRefs.current[name];
      const listener = wheelListeners.current[name];
      if (oldEl && listener) {
        oldEl.removeEventListener('wheel', listener);
      }
      previewRefs.current[name] = null;
      delete wheelListeners.current[name];
      return;
    }

    if (el && !wheelListeners.current[name]) {
      previewRefs.current[name] = el;
      const handleDOMWheel = (e: WheelEvent) => {
        e.preventDefault();
        const fileState = fileStatesRef.current[name];
        if (!fileState) return;
        const zoomStep = 0.05;
        const dir = e.deltaY < 0 ? 1 : -1;
        const newZoom = Math.max(1, Math.min(3, fileState.zoom + dir * zoomStep));
        setFileStates((prev) => ({
          ...prev,
          [name]: { ...prev[name], zoom: newZoom },
        }));
      };
      el.addEventListener('wheel', handleDOMWheel, { passive: false });
      wheelListeners.current[name] = handleDOMWheel;
    }
  }, []);

  // ── Crop & Rotate Modal States & Handlers ──
  const [cropModal, setCropModal] = useState<{
    isOpen: boolean;
    fieldName: string;
    src: string;
    zoom: number;
    panX: number;
    panY: number;
    rotate: number;
    aspectRatio: number;
    cropWidth: number;
    cropHeight: number;
    isMultiple?: boolean;
  }>({
    isOpen: false,
    fieldName: '',
    src: '',
    zoom: 1,
    panX: 0,
    panY: 0,
    rotate: 0,
    aspectRatio: 1,
    cropWidth: 800,
    cropHeight: 800,
  });

  const [cropDrag, setCropDrag] = useState<{
    isDragging: boolean;
    startX: number;
    startY: number;
    initialPanX: number;
    initialPanY: number;
  }>({ isDragging: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });

  const [cropBox, setCropBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  }>({ x: 50, y: 50, w: 220, h: 220 });

  const [selectedCropRatio, setSelectedCropRatio] = useState<string>('free');
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [dragStartBox, setDragStartBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const applyCropRatio = (ratioId: string) => {
    setSelectedCropRatio(ratioId);
    if (ratioId === 'free') return;
    const targetRatio = RATIO_PRESETS.find((r) => r.id === ratioId)?.ratio;
    if (!targetRatio) return;

    let w = 240;
    let h = 240;
    if (targetRatio >= 1) {
      w = 260;
      h = Math.min(260, Math.round(w / targetRatio));
    } else {
      h = 260;
      w = Math.min(260, Math.round(h * targetRatio));
    }
    const x = Math.max(10, Math.round((320 - w) / 2));
    const y = Math.max(10, Math.round((320 - h) / 2));
    setCropBox({ x, y, w, h });
  };

  const handleHandleMouseDown = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (handle === 'move') {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        // Clicked outside the actual crop window bounds (on the box shadow backdrop)
        // Delegate to panning the image
        setCropDrag({
          isDragging: true,
          startX: e.clientX,
          startY: e.clientY,
          initialPanX: cropModal.panX,
          initialPanY: cropModal.panY,
        });
        setActiveHandle(null);
        return;
      }
    }

    setActiveHandle(handle);
    setDragStartBox({ ...cropBox });
    setCropDrag({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: cropModal.panX,
      initialPanY: cropModal.panY,
    });
  };

  const handleHandleTouchStart = (handle: string, e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    e.stopPropagation();
    const touch = e.touches[0];

    if (handle === 'move') {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        // Delegate to panning the image
        setCropDrag({
          isDragging: true,
          startX: touch.clientX,
          startY: touch.clientY,
          initialPanX: cropModal.panX,
          initialPanY: cropModal.panY,
        });
        setActiveHandle(null);
        return;
      }
    }

    setActiveHandle(handle);
    setDragStartBox({ ...cropBox });
    setCropDrag({
      isDragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      initialPanX: cropModal.panX,
      initialPanY: cropModal.panY,
    });
  };

  const handleCropMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setCropDrag({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: cropModal.panX,
      initialPanY: cropModal.panY,
    });
  };

  const handleCropTouchStart = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    setCropDrag({
      isDragging: true,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      initialPanX: cropModal.panX,
      initialPanY: cropModal.panY,
    });
  };

  const handleCropMouseMove = useCallback((e: MouseEvent) => {
    if (!cropDrag.isDragging) return;
    const dx = e.clientX - cropDrag.startX;
    const dy = e.clientY - cropDrag.startY;

    if (activeHandle && dragStartBox) {
      setCropBox((prev) => {
        let { x, y, w, h } = dragStartBox;
        const containerSize = 320;

        if (activeHandle === 'move') {
          x = Math.max(0, Math.min(containerSize - w, x + dx));
          y = Math.max(0, Math.min(containerSize - h, y + dy));
        } else {
          if (activeHandle.includes('l')) {
            const newW = w - dx;
            if (newW >= 40) {
              x = x + dx;
              w = newW;
            }
          }
          if (activeHandle.includes('r')) {
            w = Math.max(40, w + dx);
          }
          if (activeHandle.includes('t')) {
            const newH = h - dy;
            if (newH >= 40) {
              y = y + dy;
              h = newH;
            }
          }
          if (activeHandle.includes('b')) {
            h = Math.max(40, h + dy);
          }

          if (cropModal.aspectRatio) {
            if (activeHandle.includes('t') || activeHandle.includes('b')) {
              w = h * cropModal.aspectRatio;
            } else {
              h = w / cropModal.aspectRatio;
            }
          }

          if (x < 0) x = 0;
          if (y < 0) y = 0;
          if (x + w > containerSize) w = containerSize - x;
          if (y + h > containerSize) h = containerSize - y;
        }

        return { x, y, w, h };
      });
    } else {
      setCropModal((prev) => ({
        ...prev,
        panX: cropDrag.initialPanX + dx,
        panY: cropDrag.initialPanY + dy,
      }));
    }
  }, [cropDrag, activeHandle, dragStartBox, cropModal.aspectRatio]);

  const handleCropTouchMove = useCallback((e: TouchEvent) => {
    if (!cropDrag.isDragging || !e.touches[0]) return;
    const dx = e.touches[0].clientX - cropDrag.startX;
    const dy = e.touches[0].clientY - cropDrag.startY;

    if (activeHandle && dragStartBox) {
      setCropBox((prev) => {
        let { x, y, w, h } = dragStartBox;
        const containerSize = 320;

        if (activeHandle === 'move') {
          x = Math.max(0, Math.min(containerSize - w, x + dx));
          y = Math.max(0, Math.min(containerSize - h, y + dy));
        } else {
          if (activeHandle.includes('l')) {
            const newW = w - dx;
            if (newW >= 40) {
              x = x + dx;
              w = newW;
            }
          }
          if (activeHandle.includes('r')) {
            w = Math.max(40, w + dx);
          }
          if (activeHandle.includes('t')) {
            const newH = h - dy;
            if (newH >= 40) {
              y = y + dy;
              h = newH;
            }
          }
          if (activeHandle.includes('b')) {
            h = Math.max(40, h + dy);
          }

          if (cropModal.aspectRatio) {
            if (activeHandle.includes('t') || activeHandle.includes('b')) {
              w = h * cropModal.aspectRatio;
            } else {
              h = w / cropModal.aspectRatio;
            }
          }

          if (x < 0) x = 0;
          if (y < 0) y = 0;
          if (x + w > containerSize) w = containerSize - x;
          if (y + h > containerSize) h = containerSize - y;
        }

        return { x, y, w, h };
      });
    } else {
      setCropModal((prev) => ({
        ...prev,
        panX: cropDrag.initialPanX + dx,
        panY: cropDrag.initialPanY + dy,
      }));
    }
  }, [cropDrag, activeHandle, dragStartBox, cropModal.aspectRatio]);

  const handleCropMouseUp = useCallback(() => {
    setCropDrag((prev) => ({ ...prev, isDragging: false }));
    setActiveHandle(null);
    setDragStartBox(null);
  }, []);

  useEffect(() => {
    if (!cropDrag.isDragging) return;
    const onMouseMove = (e: MouseEvent) => handleCropMouseMove(e);
    const onMouseUp = () => handleCropMouseUp();
    const onTouchMove = (e: TouchEvent) => handleCropTouchMove(e);
    const onTouchEnd = () => handleCropMouseUp();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [cropDrag, handleCropMouseMove, handleCropTouchMove, handleCropMouseUp]);

  const cropContainerRef = React.useRef<HTMLDivElement | null>(null);
  const cropWheelListener = React.useRef<((e: WheelEvent) => void) | null>(null);

  const setCropContainerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      if (cropContainerRef.current && cropWheelListener.current) {
        cropContainerRef.current.removeEventListener('wheel', cropWheelListener.current);
      }
      cropContainerRef.current = null;
      cropWheelListener.current = null;
      return;
    }

    if (el && !cropWheelListener.current) {
      cropContainerRef.current = el;
      const handleDOMWheel = (e: WheelEvent) => {
        e.preventDefault();
        const zoomStep = 0.05;
        const dir = e.deltaY < 0 ? 1 : -1;
        setCropModal((prev) => ({
          ...prev,
          zoom: Math.max(1, Math.min(4, prev.zoom + dir * zoomStep)),
        }));
      };
      el.addEventListener('wheel', handleDOMWheel, { passive: false });
      cropWheelListener.current = handleDOMWheel;
    }
  }, []);

  const handleRotate = (direction: 'left' | 'right') => {
    setCropModal((prev) => {
      let nextRotate = prev.rotate + (direction === 'right' ? 90 : -90);
      if (nextRotate >= 360) nextRotate -= 360;
      if (nextRotate < 0) nextRotate += 360;
      return { ...prev, rotate: nextRotate };
    });
  };

  const handleApplyCrop = async () => {
    const { src, zoom, panX, panY, rotate, fieldName, cropWidth, cropHeight } = cropModal;
    setSubmitting(true);
    const cropped = await getCroppedBase64WithRotation(
      src,
      zoom,
      panX,
      panY,
      rotate,
      cropWidth,
      cropHeight,
      cropBox
    );

    if (cropModal.isMultiple) {
      const currentArr = Array.isArray(formData[fieldName]) ? formData[fieldName] : (formData[fieldName] ? [formData[fieldName]] : []);
      handleChange(fieldName, [...currentArr, cropped]);
    } else {
      setFileStates((prev) => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          src: cropped,
          isNew: true,
        },
      }));
      handleChange(fieldName, cropped);
    }

    setCropModal((prev) => ({ ...prev, isOpen: false }));
    setSubmitting(false);
  };

  const handleMouseDown = (name: string, e: React.MouseEvent) => {
    e.preventDefault();
    const fileState = fileStates[name];
    if (!fileState) return;
    setDragState({
      fieldName: name,
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: fileState.panX,
      initialPanY: fileState.panY,
    });
  };

  const handleTouchStart = (name: string, e: React.TouchEvent) => {
    const fileState = fileStates[name];
    if (!fileState || !e.touches[0]) return;
    setDragState({
      fieldName: name,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      initialPanX: fileState.panX,
      initialPanY: fileState.panY,
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.fieldName) return;
    const name = dragState.fieldName;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    setFileStates((prev) => {
      const state = prev[name];
      if (!state) return prev;
      return {
        ...prev,
        [name]: {
          ...state,
          panX: dragState.initialPanX + dx,
          panY: dragState.initialPanY + dy,
        },
      };
    });
  }, [dragState]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!dragState.fieldName || !e.touches[0]) return;
    const name = dragState.fieldName;
    const dx = e.touches[0].clientX - dragState.startX;
    const dy = e.touches[0].clientY - dragState.startY;
    setFileStates((prev) => {
      const state = prev[name];
      if (!state) return prev;
      return {
        ...prev,
        [name]: {
          ...state,
          panX: dragState.initialPanX + dx,
          panY: dragState.initialPanY + dy,
        },
      };
    });
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    setDragState({ fieldName: null, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });
  }, []);

  useEffect(() => {
    if (!dragState.fieldName) return;
    const onMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const onMouseUp = () => handleMouseUp();
    const onTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const onTouchEnd = () => handleMouseUp();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [dragState, handleMouseMove, handleTouchMove, handleMouseUp]);

  // Removed duplicate handleWheel method - wheel behavior is handled by setPreviewRef callback

  // ── Fetch form config when opened ──────────────────────────
  const fetchFormConfig = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setErrors({});
    setGlobalError('');

    try {
      const res = await api.get<FormResponse>(apiEndpoint);
      if (res.error || !res.data) {
        setGlobalError(res.error || 'Failed to load form');
        setLoading(false);
        return;
      }
      const result = res.data;
      setTitle(result.title);
      setSubtitle(result.subtitle || '');
      setMaxWidth(result.maxWidth || '');
      setSubmitLabel(result.submitLabel);
      setFields(result.fields);

      const isStepperLayout = result.fields.length > 0 && Array.isArray(result.fields[0]);
      setIsStepper(isStepperLayout);
      setCurrentStep(0);

      if (result.script) {
        setScriptToRun(result.script);
      } else {
        setScriptToRun('');
      }

      // Initialize form data with defaults/pre-filled values
      const initial: Record<string, any> = {};
      const initialFileStates: Record<string, any> = {};
      const flatFields = isStepperLayout ? result.fields.flat() : result.fields;
      for (const field of flatFields) {
        if (result.data?.[field.name] !== undefined) {
          initial[field.name] = result.data[field.name];
          if (field.type === 'file' && result.data[field.name]) {
            initialFileStates[field.name] = {
              src: result.data[field.name],
              zoom: 1,
              panX: 0,
              panY: 0,
              isNew: false,
            };
          }
        } else if (field.defaultValue !== undefined) {
          initial[field.name] = field.defaultValue;
          if (field.type === 'file' && field.defaultValue) {
            initialFileStates[field.name] = {
              src: field.defaultValue,
              zoom: 1,
              panX: 0,
              panY: 0,
              isNew: false,
            };
          }
        } else {
          initial[field.name] = field.type === 'toggle' ? false : '';
        }
      }
      // Auto-calculate discount / discount_percent on initial load if original_price & price exist
      if (initial.original_price && initial.price) {
        const orig = parseFloat(initial.original_price);
        const sell = parseFloat(initial.price);
        if (!isNaN(orig) && !isNaN(sell) && orig > 0 && orig >= sell) {
          const calculatedDisc = Math.round(((orig - sell) / orig) * 100 * 10) / 10;
          if (!initial.discount_percent && initial.discount_percent !== 0) {
            initial.discount_percent = calculatedDisc;
          }
          if (!initial.discount && initial.discount !== 0) {
            initial.discount = calculatedDisc;
          }
        }
      }

      setFormData(initial);
      setFileStates(initialFileStates);

      // Fetch dynamic options for select fields with optionsEndpoint
      for (const field of flatFields) {
        if (field.optionsEndpoint && (!field.options || field.options.length === 0)) {
          api.get<{ status: boolean; data: any[] }>(field.optionsEndpoint)
            .then((optRes) => {
              const optResult = optRes.data;
              if (optResult?.status && Array.isArray(optResult.data)) {
                setFields((prev) => {
                  if (isStepperLayout) {
                    return prev.map((step: any[]) =>
                      step.map((f: FieldDef) =>
                        f.name === field.name
                          ? {
                            ...f,
                            options: optResult.data.map((opt: any) => ({
                              value: opt.value,
                              label: opt.view || opt.label || opt.value,
                            })),
                          }
                          : f
                      )
                    );
                  } else {
                    return prev.map((f: FieldDef) =>
                      f.name === field.name
                        ? {
                          ...f,
                          options: optResult.data.map((opt: any) => ({
                            value: opt.value,
                            label: opt.view || opt.label || opt.value,
                          })),
                        }
                        : f
                    );
                  }
                });
              }
            })
            .catch(() => { });
        }
      }
    } catch {
      setGlobalError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [isOpen, apiEndpoint]);

  useEffect(() => {
    fetchFormConfig();
  }, [fetchFormConfig]);

  // ── Execute script if provided ─────────────────────────────
  useEffect(() => {
    if (scriptToRun && !loading) {
      const timer = setTimeout(() => {
        try {
          const fn = new Function(scriptToRun);
          fn();
        } catch (e) {
          console.error("Error executing form script:", e);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scriptToRun, loading, currentStep]);

  // ── Field change handler ───────────────────────────────────
  const handleChange = (name: string, rawValue: any) => {
    const flatList: FieldDef[] = isStepper ? (fields as any[]).flat() : (fields as FieldDef[]);
    const fieldDef = flatList.find((f: FieldDef) => f.name === name);
    const isNumField = fieldDef?.type === 'number';

    let value = rawValue;
    // Strip minus signs and exponential notation on all number fields
    if ((isNumField || (!isNaN(Number(rawValue)) && rawValue !== '')) && !fieldDef?.allowNegative) {
      if (typeof value === 'string') {
        value = value.replace(/-/g, '').replace(/[eE]/g, '');
      } else if (typeof value === 'number' && value < 0) {
        value = Math.max(0, value);
      }
    }

    setFormData((prev) => {
      const next = { ...prev, [name]: value };

      // When product changes, reset variant and batch selections
      if (name === 'product_id') {
        next.variant_id = '';
        next.product_variant_id = '';
        next.batch_id = '';
      }

      // Selling price <= Original Price (MRP) enforcement & realtime discount calculation
      if (name === 'price') {
        const orig = parseFloat(next.original_price);
        const sell = parseFloat(value);
        if (isNaN(sell) || sell < 0) {
          next.discount_percent = 0;
          next.discount = 0;
        } else if (!isNaN(orig) && !isNaN(sell) && orig > 0 && sell > orig) {
          next.price = orig;
          next.discount_percent = 0;
          next.discount = 0;
          setTimeout(() => {
            setErrors((prevErr) => ({
              ...prevErr,
              price: `Selling Price cannot exceed Original Price (MRP: ₹${orig})`,
            }));
          }, 0);
        } else if (!isNaN(orig) && !isNaN(sell) && orig > 0 && orig >= sell && sell >= 0) {
          const disc = Math.min(100, Math.max(0, Math.round(((orig - sell) / orig) * 100 * 10) / 10));
          next.discount_percent = disc;
          next.discount = disc;
        } else {
          next.discount_percent = 0;
          next.discount = 0;
        }
      } else if (name === 'original_price') {
        const orig = parseFloat(value);
        const sell = parseFloat(next.price);
        if (isNaN(orig) || orig < 0) {
          next.discount_percent = 0;
          next.discount = 0;
        } else if (!isNaN(orig) && !isNaN(sell) && orig > 0 && sell > orig) {
          next.price = orig;
          next.discount_percent = 0;
          next.discount = 0;
          setTimeout(() => {
            setErrors((prevErr) => ({
              ...prevErr,
              price: `Selling Price adjusted to match Original Price (MRP: ₹${orig})`,
            }));
          }, 0);
        } else if (!isNaN(orig) && !isNaN(sell) && orig > 0 && orig >= sell && sell >= 0) {
          const disc = Math.min(100, Math.max(0, Math.round(((orig - sell) / orig) * 100 * 10) / 10));
          next.discount_percent = disc;
          next.discount = disc;
        } else {
          next.discount_percent = 0;
          next.discount = 0;
        }
      }

      return next;
    });

    // Clear error on change
    if (errors[name] && name !== 'price') {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  // ── Step handlers ──────────────────────────────────────────
  const handleNext = () => {
    const currentFields = isStepper ? fields[currentStep] : fields;
    const newErrors: Record<string, string> = {};
    for (const field of currentFields) {
      if (field.visible === false) continue;
      const err = validateField(field, formData[field.name]);
      if (err) newErrors[field.name] = err;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return;
    }

    setCurrentStep((prev) => prev + 1);
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  // ── Submit handler ─────────────────────────────────────────
  const handleSubmit = async () => {
    // Sync inputs from the HTML fields
    const mergedData = { ...formData };
    document.querySelectorAll('.skf-html-content input').forEach((input: Element) => {
      const el = input as HTMLInputElement;
      if (el.name) {
        mergedData[el.name] = el.value;
      }
    });

    // Process file fields - images are already cropped on Apply, so we do not crop them again.
    const flatFields = isStepper ? fields.flat() : fields;

    // Client-side validation
    const newErrors: Record<string, string> = {};
    let firstErrorStep = -1;

    const stepCount = isStepper ? fields.length : 1;
    for (let i = 0; i < stepCount; i++) {
      const stepFields = isStepper ? fields[i] : fields;
      for (const field of stepFields) {
        if (field.visible === false) continue;
        const err = validateField(field, mergedData[field.name]);
        if (err) {
          newErrors[field.name] = err;
          if (firstErrorStep === -1) firstErrorStep = i;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (isStepper && firstErrorStep !== -1 && firstErrorStep !== currentStep) {
        setCurrentStep(firstErrorStep);
      }
      return;
    }

    setSubmitting(true);
    setGlobalError('');

    try {
      const res = await api.post<Record<string, any>>(submitEndpoint, mergedData);

      if (res.error || !res.data) {
        setGlobalError(res.error || 'Save failed');
        setSubmitting(false);
        return;
      }

      const result = res.data;

      if (result.status === false) {
        // Server returned field-level errors
        if (result.errors && typeof result.errors === 'object') {
          setErrors(result.errors);
        }
        setGlobalError(result.message || 'Save failed');
        setSubmitting(false);
        return;
      }
      showSuccessToast(result.message || 'Saved successfully', 3000);
      onSuccess?.(result);
    } catch {
      const msg = 'Network error — please try again';
      setGlobalError(msg);
      showErrorToast(msg, 3000);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Don't render if closed ─────────────────────────────────
  if (!isOpen) return null;

  // ── Render field by type ───────────────────────────────────
  const renderField = (field: FieldDef) => {
    if (field.visible === false && field.type !== 'hidden') return null;
    if (field.name === 'subscription_price') {
      const allFields: any[] = isStepper ? fields.flat() : fields;
      const productField = allFields.find((f: any) => f.name === 'product_id');
      const selectedProductOpt = productField?.options?.find((o: any) => String(o.value) === String(formData.product_id));
      if (selectedProductOpt && selectedProductOpt.is_subscribable === false) {
        return null;
      }
    }
    if (field.type === 'hidden') {
      return <input key={field.name} type="hidden" name={field.name} value={formData[field.name] ?? ''} />;
    }

    const hasError = !!errors[field.name];
    const errorClass = hasError ? ' skf-error' : '';

    let input: React.ReactNode;

    switch (field.type) {
      case 'textarea':
        input = (
          <textarea
            className={`skf-textarea${errorClass}`}
            placeholder={field.placeholder}
            value={formData[field.name] ?? ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            disabled={field.disabled}
          />
        );
        break;

      case 'select': {
        const isVariantField =
          field.name === 'variant_id' ||
          field.name === 'product_variant_id' ||
          field.name === 'variant';

        let availableOptions = (field.options ?? []) as any[];

        if (isVariantField) {
          const selectedProductId = formData.product_id ? String(formData.product_id).trim() : '';

          if (selectedProductId) {
            const allFormFields: any[] = isStepper ? fields.flat() : fields;
            const productField = allFormFields.find((f: any) => f.name === 'product_id');
            const selectedProductOpt = productField?.options?.find(
              (o: any) => String(o.value).trim() === selectedProductId
            );
            const selectedProductName = selectedProductOpt?.label?.trim()?.toLowerCase() || '';

            availableOptions = availableOptions.filter((opt: any) => {
              if (!opt.value || opt.value === '') return true;

              // 1. Direct product_id or parent_id match
              if (opt.product_id !== undefined && opt.product_id !== null && String(opt.product_id).trim() !== '') {
                return String(opt.product_id).trim() === selectedProductId;
              }
              if (opt.parent_id !== undefined && opt.parent_id !== null && String(opt.parent_id).trim() !== '') {
                return String(opt.parent_id).trim() === selectedProductId;
              }

              // 2. Fallback matching: if option label contains product name or matches prefix
              if (selectedProductName && opt.label) {
                const optLabelLower = opt.label.toLowerCase();
                const prefixPart = optLabelLower.split('-')[0]?.trim();
                if (optLabelLower.includes(selectedProductName) || (prefixPart && selectedProductName.includes(prefixPart))) {
                  return true;
                }
              }

              return false;
            });
          } else {
            // No product selected -> show only empty option
            availableOptions = availableOptions.filter((opt: any) => !opt.value || opt.value === '');
          }
        }

        const uniqueOptions = Array.from(
          new Map(availableOptions.map((opt) => [String(opt.value), opt])).values()
        );

        input = (
          <select
            className={`skf-select${errorClass}`}
            value={formData[field.name] ?? ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            disabled={field.disabled || (isVariantField && !formData.product_id)}
          >
            <option value="">
              {isVariantField && !formData.product_id ? '— Select Product first —' : '— Select —'}
            </option>
            {uniqueOptions
              .filter((opt) => opt.value !== '')
              .map((opt, idx) => (
                <option key={`${opt.value}-${idx}`} value={opt.value}>
                  {opt.label}
                </option>
              ))}
          </select>
        );
        break;
      }

      case 'radio':
        input = (
          <div className="flex items-center gap-3 py-1">
            {(field.options ?? []).map((opt, idx) => {
              const currentVal = formData[field.name] ?? field.defaultValue ?? '';
              const isChecked = String(currentVal) === String(opt.value);
              return (
                <label
                  key={`${opt.value}-${idx}`}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-emerald-50 text-[#16a34a] border-emerald-300 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={opt.value}
                    checked={isChecked}
                    onChange={() => handleChange(field.name, opt.value)}
                    disabled={field.disabled}
                    className="w-3.5 h-3.5 text-[#16a34a] focus:ring-emerald-500 accent-[#16a34a]"
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        );
        break;

      case 'toggle': {
        const isOn = Boolean(formData[field.name]);
        const onLabel = field.toggleOptions?.onLabel || (field.description ? 'ACTIVE' : 'Yes');
        const offLabel = field.toggleOptions?.offLabel || (field.description ? 'INACTIVE' : 'No');
        const isPillStyle = Boolean(field.description || field.toggleOptions?.pill);

        if (isPillStyle) {
          input = (
            <div className="!flex !flex-row !items-center !justify-between gap-4 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3.5 my-1 w-full text-left">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-slate-800 block mb-0.5">{field.label}</span>
                {field.description && <p className="text-[11px] text-slate-500 font-medium leading-tight m-0">{field.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleChange(field.name, !isOn)}
                disabled={field.disabled}
                className={`shrink-0 group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-200 shadow-sm cursor-pointer border ${isOn ? 'bg-[#00B074] text-white border-emerald-600 shadow-emerald-500/20' : 'bg-[#F59E0B] text-white border-amber-600 shadow-amber-500/20'}`}
              >
                <div className={`w-6 h-3.5 rounded-full p-0.5 flex items-center transition-colors duration-300 ${isOn ? 'bg-emerald-700/40' : 'bg-amber-700/40'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full bg-white shadow transform transition-transform duration-300 ${isOn ? 'translate-x-2.5' : 'translate-x-0'}`} />
                </div>
                <span>{isOn ? onLabel : offLabel}</span>
              </button>
            </div>
          );
        } else {
          input = (
            <div className="skf-toggle-wrap">
              <button
                type="button"
                className={`skf-toggle${isOn ? ' skf-toggle-on' : ''}`}
                onClick={() => handleChange(field.name, !isOn)}
                disabled={field.disabled}
              >
                <span className="skf-toggle-knob" />
              </button>
              <span className="skf-toggle-label">
                {isOn ? 'Yes' : 'No'}
              </span>
            </div>
          );
        }
        break;
      }

      case 'html':
        input = (
          <div
            className="skf-html-content"
            dangerouslySetInnerHTML={{ __html: formData[field.name] ?? field.defaultValue ?? '' }}
          />
        );
        break;

      case 'file': {
        input = (
          <SkeletonImageUploader
            value={formData[field.name]}
            onChange={(val) => handleChange(field.name, val)}
            aspectRatio={field.aspectRatio}
            cropWidth={field.cropWidth}
            cropHeight={field.cropHeight}
            crop={field.crop}
            multiple={field.multiple}
            accept={field.accept}
            disabled={field.disabled}
            apiBaseUrl={apiBaseUrl}
            className={errorClass}
          />
        );
        break;
      }


      default: {
        const isFile = field.type === 'file';
        const isNumber = field.type === 'number';
        const minVal = field.validation?.min !== undefined ? (field.allowNegative ? field.validation.min : Math.max(0, field.validation.min)) : (isNumber && !field.allowNegative ? 0 : undefined);
        const maxVal = field.validation?.max;
        const stepVal = field.step || (isNumber ? 'any' : undefined);

        const inputElement = (
          <input
            className={`skf-input${errorClass}${field.prefix ? ' !pl-8' : ''}`}
            type={field.type === 'phone' ? 'tel' : field.type}
            placeholder={field.placeholder}
            min={minVal}
            max={maxVal}
            step={stepVal}
            onKeyDown={(e) => {
              if (isNumber && !field.allowNegative && (e.key === '-' || e.key === 'Subtract' || e.key === 'Minus' || e.key === 'e' || e.key === 'E')) {
                e.preventDefault();
              }
            }}
            onPaste={(e) => {
              if (isNumber && !field.allowNegative) {
                const pasted = e.clipboardData.getData('text');
                if (pasted.includes('-') || pasted.includes('e') || pasted.includes('E')) {
                  e.preventDefault();
                  const sanitized = pasted.replace(/[-eE]/g, '');
                  handleChange(field.name, sanitized);
                }
              }
            }}
            // File inputs cannot have a 'value' prop (except empty string)
            value={isFile ? undefined : (formData[field.name] ?? '')}
            accept={field.accept}
            onChange={(e) => {
              if (isFile) {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    // Send the base64 string to form data!
                    handleChange(field.name, reader.result);
                  };
                  reader.readAsDataURL(file);
                } else {
                  handleChange(field.name, null);
                }
              } else {
                let val = e.target.value;
                if (isNumber && !field.allowNegative && typeof val === 'string') {
                  val = val.replace(/[-eE]/g, '');
                }
                handleChange(
                  field.name,
                  val
                );
              }
            }}
            disabled={field.disabled}
          />
        );

        if (field.prefix) {
          input = (
            <div className="relative flex items-center w-full">
              <span className="absolute left-3 text-slate-500 font-bold text-sm pointer-events-none">{field.prefix}</span>
              {inputElement}
            </div>
          );
        } else {
          input = inputElement;
        }
        break;
      }
    }

    // ── Conditional visibility ──────────────────────────────────
    if (field.visibleWhen) {
      const watchedValue = formData[field.visibleWhen.field];
      const expectedValue = field.visibleWhen.value;
      // Normalise booleans: backend sends true/false, toggle stores true/false
      const normalise = (v: any) =>
        v === true || v === 'true' || v === 1 || v === '1' ? true
          : v === false || v === 'false' || v === 0 || v === '0' ? false
            : v;
      if (normalise(watchedValue) !== normalise(expectedValue)) return null;
    }

    const isPillToggle = field.type === 'toggle' && Boolean(field.description || field.toggleOptions?.pill);

    return (
      <div
        key={field.name}
        className={`skf-field ${field.width === 'half' ? 'skf-half' : field.width === 'third' ? 'skf-third' : field.width === 'quarter' ? 'skf-quarter' : 'skf-full'}`}
      >
        {!isPillToggle && (
          <label className="skf-label">
            {field.label}
            {field.required && <span className="skf-required">*</span>}
          </label>
        )}
        {input}
        {hasError && <span className="skf-error-msg">{errors[field.name]}</span>}
      </div>
    );
  };

  // ── Group fields by group name ─────────────────────────────
  const renderFields = () => {
    const currentFieldsToRender = isStepper ? fields[currentStep] : fields;
    if (!currentFieldsToRender) return null;

    const groups: Map<string, FieldDef[]> = new Map();
    const ungrouped: FieldDef[] = [];

    for (const field of currentFieldsToRender) {
      if (field.group) {
        if (!groups.has(field.group)) groups.set(field.group, []);
        groups.get(field.group)!.push(field);
      } else {
        ungrouped.push(field);
      }
    }

    const elements: React.ReactNode[] = [];

    // Render ungrouped fields first
    for (const field of ungrouped) {
      elements.push(renderField(field));
    }

    // Render grouped fields with section headers
    for (const [groupName, groupFields] of groups) {
      elements.push(
        <div key={`group-${groupName}`} className="skf-group-header">
          {groupName}
        </div>,
      );
      for (const field of groupFields) {
        elements.push(renderField(field));
      }
    }

    return elements;
  };

  if (!isOpen) return null;

  return (
    <div
      className="skf-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`skf-modal ${className ?? ''}`} style={{ maxWidth: maxWidth || (fields.length <= 3 ? '480px' : undefined) }}>
        {/* Header */}
        <div className="skf-header">
          <div>
            <h3 className="skf-title">{title || 'Form'}</h3>
            {subtitle && <p className="text-xs text-slate-500 font-semibold mt-0.5 mb-0">{subtitle}</p>}
          </div>
          <button className="skf-close-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="skf-body">
          {loading ? (
            <div className="skf-loading">
              <div className="skf-spinner" />
            </div>
          ) : (
            <>
              {globalError && (
                <div className="skf-global-error">{globalError}</div>
              )}
              {isStepper && fields.length > 1 && (
                <div className="skf-stepper-indicator">
                  {fields.map((_, index) => (
                    <div
                      key={index}
                      className={`skf-step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                    >
                      <div className="skf-step-circle">
                        {index < currentStep ? '✓' : index + 1}
                      </div>
                      {index < fields.length - 1 && <div className="skf-step-line"></div>}
                    </div>
                  ))}
                </div>
              )}
              <div className="skf-grid">{renderFields()}</div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="skf-footer">
            <button
              type="button"
              className="skf-btn skf-btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="skf-btn skf-btn-submit"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : submitLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
