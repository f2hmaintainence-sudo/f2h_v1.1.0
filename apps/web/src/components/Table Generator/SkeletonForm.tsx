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
import { showErrorToast, showSuccessToast } from "@/components/Toast"

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
    if (isNaN(num)) return `${field.label} must be a number`;
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
      const canvas = document.createElement('canvas');
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(src);
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cropWidth, cropHeight);

      const cx = cropWidth / 2;
      const cy = cropHeight / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rotate * Math.PI) / 180);

      const boxCenterX = cropBox.x + cropBox.w / 2;
      const boxCenterY = cropBox.y + cropBox.h / 2;
      const offX = boxCenterX - 160;
      const offY = boxCenterY - 160;

      const scaleFactor = cropWidth / cropBox.w;
      ctx.translate((panX - offX) * scaleFactor, (panY - offY) * scaleFactor);

      const imgRatio = img.width / img.height;
      const cropRatio = cropWidth / cropHeight;

      let drawWidth = cropWidth;
      let drawHeight = cropHeight;
      if (imgRatio > cropRatio) {
        drawWidth = cropHeight * imgRatio;
      } else {
        drawHeight = cropWidth / imgRatio;
      }

      const containerScale = 320 / cropBox.w;
      drawWidth *= zoom * containerScale;
      drawHeight *= zoom * containerScale;

      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
};

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

  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [dragStartBox, setDragStartBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

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
      // Auto-calculate discount_percent on initial load if original_price & price exist
      if (initial.original_price && initial.price) {
        const orig = parseFloat(initial.original_price);
        const sell = parseFloat(initial.price);
        if (!isNaN(orig) && !isNaN(sell) && orig > 0 && orig >= sell) {
          const calculatedDisc = Math.round(((orig - sell) / orig) * 100 * 10) / 10;
          if (!initial.discount_percent && initial.discount_percent !== 0) {
            initial.discount_percent = calculatedDisc;
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
  const handleChange = (name: string, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [name]: value };

      // Selling price <= Original Price (MRP) enforcement & realtime discount calculation
      if (name === 'price') {
        const orig = parseFloat(next.original_price);
        const sell = parseFloat(value);
        if (!isNaN(orig) && !isNaN(sell) && orig > 0 && sell > orig) {
          next.price = orig;
          next.discount_percent = 0;
          setTimeout(() => {
            setErrors((prevErr) => ({
              ...prevErr,
              price: `Selling Price cannot exceed Original Price (MRP: ₹${orig})`,
            }));
          }, 0);
        } else if (!isNaN(orig) && !isNaN(sell) && orig > 0 && orig >= sell) {
          next.discount_percent = Math.round(((orig - sell) / orig) * 100 * 10) / 10;
        }
      } else if (name === 'original_price') {
        const orig = parseFloat(value);
        const sell = parseFloat(next.price);
        if (!isNaN(orig) && !isNaN(sell) && orig > 0 && sell > orig) {
          next.price = orig;
          next.discount_percent = 0;
          setTimeout(() => {
            setErrors((prevErr) => ({
              ...prevErr,
              price: `Selling Price adjusted to match Original Price (MRP: ₹${orig})`,
            }));
          }, 0);
        } else if (!isNaN(orig) && !isNaN(sell) && orig > 0 && orig >= sell) {
          next.discount_percent = Math.round(((orig - sell) / orig) * 100 * 10) / 10;
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

      case 'select':
        input = (
          <select
            className={`skf-select${errorClass}`}
            value={formData[field.name] ?? ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            disabled={field.disabled}
          >
            <option value="">— Select —</option>
            {Array.from(new Map((field.options ?? []).map((opt) => [String(opt.value), opt])).values()).map((opt, idx) => (
              <option key={`${opt.value}-${idx}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
        break;

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
        const isMultiple = !!field.multiple;
        let previews: string[] = [];

        if (isMultiple) {
          const raw = Array.isArray(formData[field.name])
            ? formData[field.name]
            : formData[field.name]
            ? [formData[field.name]]
            : [];
          // Flatten one level (in case of nested arrays), filter to non-empty strings only
          previews = ([] as any[])
            .concat(...raw)
            .filter((v: any) => v && typeof v === 'string' && v.trim() !== '') as string[];
        } else {
          const fileState = fileStates[field.name];
          const singleSrc = fileState?.src || formData[field.name] || '';
          if (singleSrc && typeof singleSrc === 'string') previews = [singleSrc];
        }

        input = (
          <div className={`skf-file-wrap${errorClass}`}>
            <div className="skf-multiple-previews" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {previews.map((previewSrc, idx) => {
                // previewSrc is guaranteed to be a non-empty string at this point
                let fullUrl = previewSrc;
                if (previewSrc && !previewSrc.startsWith('http') && !previewSrc.startsWith('data:')) {
                  const apiBase = apiBaseUrl || getApiBaseUrl();
                  const rootHost = apiBase.replace(/\/api(?:\/v\d+)?\/?$/, '');
                  let path = previewSrc.startsWith('/') ? previewSrc : `/${previewSrc}`;
                  if (!path.startsWith('/uploads/')) path = `/uploads${path}`;
                  fullUrl = `${rootHost}${path}`;
                }

                return (
                  <div key={idx} className="skf-image-editor" style={{ width: isMultiple ? '150px' : '100%' }}>
                    <div
                      className="skf-crop-preview"
                      style={{
                        aspectRatio: field.aspectRatio || 1,
                        position: 'relative',
                        overflow: 'hidden',
                        width: '100%'
                      }}
                    >
                      <img
                        src={fullUrl}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div className="skf-crop-controls">
                      {!isMultiple && field.crop && (
                        <button
                          type="button"
                          className="skf-reset-crop"
                          onClick={() => {
                            const raw = fileStates[field.name]?.rawSrc || previewSrc;
                            if (raw) {
                              setCropModal({
                                isOpen: true,
                                fieldName: field.name,
                                src: raw,
                                zoom: fileStates[field.name]?.zoom || 1,
                                panX: fileStates[field.name]?.panX || 0,
                                panY: fileStates[field.name]?.panY || 0,
                                rotate: 0,
                                aspectRatio: field.aspectRatio || 1,
                                cropWidth: field.cropWidth || 800,
                                cropHeight: field.cropHeight || 800,
                                isMultiple: false,
                              });
                            }
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
                          if (isMultiple) {
                            const newArray = [...previews];
                            newArray.splice(idx, 1);
                            handleChange(field.name, newArray);
                          } else {
                            setFileStates((prev) => {
                              const copy = { ...prev };
                              delete copy[field.name];
                              return copy;
                            });
                            handleChange(field.name, '');
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              {(!previews.length || isMultiple) && (
                <label className="skf-file-picker" style={{ width: isMultiple && previews.length ? '150px' : '100%', alignSelf: 'stretch' }}>
                  <UploadCloud size={32} style={{ color: '#94a3b8', marginBottom: '4px' }} />
                  <span style={{ textAlign: 'center' }}>{isMultiple && previews.length ? '+ Add Image' : 'Click to upload image'}</span>
                  <input
                    type="file"
                    accept={field.accept || 'image/*'}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const src = reader.result as string;
                        setCropModal({
                          isOpen: true,
                          fieldName: field.name,
                          src,
                          zoom: 1,
                          panX: 0,
                          panY: 0,
                          rotate: 0,
                          aspectRatio: field.aspectRatio || 1,
                          cropWidth: field.cropWidth || 800,
                          cropHeight: field.cropHeight || 800,
                          isMultiple: isMultiple,
                        });
                        if (!isMultiple) {
                          setFileStates((prev) => ({
                            ...prev,
                            [field.name]: {
                              src: '',
                              rawSrc: src,
                              zoom: 1,
                              panX: 0,
                              panY: 0,
                              isNew: true,
                            },
                          }));
                        }
                      };
                      reader.readAsDataURL(file);
                      // Reset file input so same file can be selected again
                      e.target.value = '';
                    }}
                    disabled={field.disabled}
                  />
                </label>
              )}
            </div>
          </div>
        );
        break;
      }


      default: {
        const isFile = field.type === 'file';
        const inputElement = (
          <input
            className={`skf-input${errorClass}${field.prefix ? ' !pl-8' : ''}`}
            type={field.type === 'phone' ? 'tel' : field.type}
            placeholder={field.placeholder}
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
                handleChange(
                  field.name,
                  e.target.value
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

      {/* ── Image Crop & Rotate Modal ── */}
      {cropModal.isOpen && (
        <div className="skf-crop-modal-overlay">
          <div className="skf-crop-modal">
            <div className="skf-crop-modal-header">
              <h3 className="skf-crop-modal-title">Image Crop & Rotate</h3>
              <button
                type="button"
                className="skf-close-btn"
                onClick={() => setCropModal((prev) => ({ ...prev, isOpen: false }))}
                style={{ padding: 0 }}
              >
                <X size={16} />
              </button>
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
