// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : page.tsx
// Description : Full-featured Promotions, Coupons & Category-Based Offers / Popup Banners Management
// ============================================================================

"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/services/api.client";
import {
  Tag, Percent, Ticket, Plus, CheckCircle2, Clock, AlertCircle,
  Search, RefreshCw, Layers, ChevronRight, Home, Trash2, Edit3,
  Calendar, Check, X, ShieldAlert, Sparkles, ArrowUpRight, Copy,
  Users, ShoppingBag, Eye, DollarSign, ArrowRight, CheckCheck,
  Package, Boxes, Info, ToggleLeft, ToggleRight, Image as ImageIcon,
  ExternalLink, Palette, Smartphone, MonitorSmartphone, FolderTree,
  SlidersHorizontal, CheckSquare, Upload, Crop, RotateCw, Maximize, Move
} from "lucide-react";
import Link from "next/link";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

interface Promotion {
  id: number;
  promotion_id: string;
  name: string;
  description: string;
  promotion_type: "percentage" | "fixed_amount";
  discount_value: number;
  max_discount_amount?: number;
  minimum_order_amount: number;
  status: "draft" | "active" | "paused" | "expired";
  first_order_only: boolean;
  auto_apply: boolean;
  stackable: boolean;
  apply_to_all_products: boolean;
  allow_subscription_orders: boolean;
  usage_limit?: number;
  usage_limit_per_customer: number;
  total_redemptions: number;
  products_count: number;
  targeted_products?: Array<{ variant_id: string; product_name: string; variant_name: string; price: number }>;
  start_at?: string;
  end_at?: string;
  created_at: string;
}

interface Coupon {
  id: number;
  coupon_id: string;
  promotion_id: string;
  code: string;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "expired";
  usage_limit?: number;
  usage_limit_per_customer: number;
  used_count: number;
  promotion_name: string;
  promotion_type: "percentage" | "fixed_amount";
  discount_value: number;
  minimum_order_amount: number;
  max_discount_amount?: number;
  start_at?: string;
  end_at?: string;
  created_at: string;
}

interface OfferBanner {
  id: number;
  title: string;
  discount_text?: string;
  description?: string;
  image_url: string;
  action_type: string;
  action_value?: string;
  cta_label?: string;
  background_color?: string;
  banner_type?: "home_carousel" | "category_slide" | "popup" | string;
  category_id?: string;
  is_popup?: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

interface CatalogProduct {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_name: string;
  price: number;
  original_price: number;
  category?: string;
}

interface CategoryOption {
  category_id: string;
  name: string;
  slug?: string;
}

function BannerVisualPreview({
  title,
  discount_text,
  description,
  image_url,
  banner_type,
  cta_label,
  background_color,
  category_name,
}: {
  title: string;
  discount_text?: string;
  description?: string;
  image_url?: string;
  banner_type?: string;
  cta_label?: string;
  background_color?: string;
  category_name?: string;
}) {
  const bg = background_color || "#16a34a";
  const cta = cta_label || "Shop Now";

  if (banner_type === "popup") {
    return (
      <div className="mx-auto max-w-[280px] bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-200 animate-in zoom-in-95 duration-200">
        <div style={{ backgroundColor: bg }} className="h-32 w-full flex items-center justify-center p-3 relative">
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 text-slate-700 flex items-center justify-center text-[10px] font-bold shadow-xs">
            ✕
          </div>
          {image_url ? (
            <img src={image_url} alt="" className="max-h-24 max-w-full object-contain drop-shadow" />
          ) : (
            <Smartphone size={36} className="text-white/70" />
          )}
        </div>
        <div className="p-4 text-center space-y-2">
          {discount_text && (
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[10px] tracking-wide">
              {discount_text.toUpperCase()}
            </span>
          )}
          <h4 className="font-extrabold text-sm text-slate-900 leading-tight">{title || "Offer Headline"}</h4>
          {description && <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{description}</p>}
          <div className="pt-1">
            <button
              type="button"
              style={{ backgroundColor: bg }}
              className="w-full py-2.5 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
            >
              <span>{cta}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (banner_type === "category_slide") {
    return (
      <div
        style={{ backgroundColor: bg }}
        className="rounded-2xl p-4 text-white relative overflow-hidden flex items-center justify-between min-h-[96px] shadow-sm"
      >
        <div className="space-y-1.5 z-10 max-w-[65%]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-black/25 text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <FolderTree size={10} /> Category Slide
            </span>
            {discount_text && (
              <span className="px-2 py-0.5 rounded-md bg-white text-slate-900 font-extrabold text-[9px]">
                {discount_text}
              </span>
            )}
          </div>
          <h4 className="font-extrabold text-sm leading-tight line-clamp-1">{title || "Category Offer Title"}</h4>
          <p className="text-[10px] text-white/85 line-clamp-1">
            {description || (category_name ? `Target Category: ${category_name}` : "Targeted category promotional slide")}
          </p>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white text-slate-900 px-2.5 py-1 rounded-lg mt-0.5 shadow-xs">
            {cta} <ArrowRight size={11} />
          </span>
        </div>
        <div className="z-10 w-20 h-20 shrink-0 flex items-center justify-center">
          {image_url ? (
            <img src={image_url} alt="" className="max-h-20 max-w-full object-contain drop-shadow" />
          ) : (
            <FolderTree size={36} className="text-white/60" />
          )}
        </div>
      </div>
    );
  }

  if (banner_type === "checkout_banner") {
    return (
      <div className="rounded-2xl p-3.5 bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-amber-500/10 border-2 border-dashed border-emerald-500/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div style={{ backgroundColor: bg }} className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs">
            <Percent size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs text-slate-900 truncate">{title || "Checkout Promotion"}</span>
              {discount_text && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase">
                  {discount_text}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 truncate">{description || "Applied automatically at checkout"}</p>
          </div>
        </div>
        <button
          type="button"
          style={{ backgroundColor: bg }}
          className="px-3 py-1.5 text-white font-bold text-[10px] rounded-lg shrink-0 shadow-xs flex items-center gap-1"
        >
          <span>{cta}</span>
        </button>
      </div>
    );
  }

  // Default: home_carousel
  return (
    <div
      style={{ backgroundColor: bg }}
      className="rounded-2xl p-4 text-white relative overflow-hidden flex items-center justify-between min-h-[105px] shadow-sm"
    >
      <div className="space-y-1.5 z-10 max-w-[65%]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-md bg-black/25 text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1">
            <Tag size={10} /> Home Carousel
          </span>
          {discount_text && (
            <span className="px-2 py-0.5 rounded-md bg-white text-slate-900 font-extrabold text-[9px]">
              {discount_text}
            </span>
          )}
        </div>
        <h4 className="font-extrabold text-sm leading-snug line-clamp-1">{title || "Home Carousel Title"}</h4>
        <p className="text-[10px] text-white/85 line-clamp-1">{description || "Discover fresh organic harvest & daily essentials"}</p>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white text-slate-900 px-3 py-1 rounded-lg mt-0.5 shadow-xs">
          {cta} <ArrowRight size={11} />
        </span>
      </div>
      <div className="z-10 w-24 h-24 shrink-0 flex items-center justify-center">
        {image_url ? (
          <img src={image_url} alt="" className="max-h-24 max-w-full object-contain drop-shadow" />
        ) : (
          <ImageIcon size={38} className="text-white/60" />
        )}
      </div>
    </div>
  );
}

// ─── Inline Banner Image Cropper Modal ──────────────────────
const BANNER_RATIO_PRESETS: { id: "free" | "16:9" | "4:3" | "1:1" | "21:9" | "3:2"; label: string; ratio?: number }[] = [
  { id: "free", label: "Free Crop" },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "1:1", label: "1:1 Square", ratio: 1 },
  { id: "21:9", label: "21:9 Ultra", ratio: 21 / 9 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
];

function BannerCropperModal({
  isOpen,
  imageUrl,
  onClose,
  onCropComplete,
}: {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
}) {
  const [selectedRatio, setSelectedRatio] = useState<"free" | "16:9" | "4:3" | "1:1" | "21:9" | "3:2">("16:9");
  const [rotation, setRotation] = useState<number>(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = React.useRef<HTMLImageElement>(null);

  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0.05,
    y: 0.05,
    w: 0.9,
    h: 0.9,
  });

  const dragRef = React.useRef<{
    mode: "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | null;
    startX: number;
    startY: number;
    startCrop: { x: number; y: number; w: number; h: number };
    rectWidth: number;
    rectHeight: number;
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    startCrop: { x: 0, y: 0, w: 0, h: 0 },
    rectWidth: 0,
    rectHeight: 0,
  });

  const applyRatioCrop = React.useCallback(
    (ratioId: "free" | "16:9" | "4:3" | "1:1" | "21:9" | "3:2") => {
      setSelectedRatio(ratioId);
      if (!imageRef.current) return;

      const imgWidth = imageRef.current.clientWidth;
      const imgHeight = imageRef.current.clientHeight;
      if (!imgWidth || !imgHeight) return;

      if (ratioId === "free") {
        setCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
        return;
      }

      const targetRatio = BANNER_RATIO_PRESETS.find((r) => r.id === ratioId)?.ratio || 16 / 9;
      const imageDisplayRatio = imgWidth / imgHeight;

      let w = 0.85;
      let h = 0.85;

      if (targetRatio > imageDisplayRatio) {
        w = 0.9;
        const targetHeightPx = (w * imgWidth) / targetRatio;
        h = Math.min(0.95, targetHeightPx / imgHeight);
      } else {
        h = 0.85;
        const targetWidthPx = h * imgHeight * targetRatio;
        w = Math.min(0.95, targetWidthPx / imgWidth);
      }

      const x = (1 - w) / 2;
      const y = (1 - h) / 2;
      setCrop({ x: Math.max(0, x), y: Math.max(0, y), w, h });
    },
    []
  );

  React.useEffect(() => {
    if (isOpen) {
      setImageLoaded(false);
      setRotation(0);
    }
  }, [isOpen, imageUrl]);

  const handlePointerDown = (
    e: React.PointerEvent,
    mode: "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w"
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();

    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
      rectWidth: rect.width,
      rectHeight: rect.height,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const { mode, startX, startY, startCrop, rectWidth, rectHeight } = dragRef.current;
    if (!mode || !rectWidth || !rectHeight) return;

    const deltaX = (e.clientX - startX) / rectWidth;
    const deltaY = (e.clientY - startY) / rectHeight;

    let newCrop = { ...startCrop };
    const activeRatio = BANNER_RATIO_PRESETS.find((r) => r.id === selectedRatio)?.ratio;

    if (mode === "move") {
      newCrop.x = Math.min(Math.max(0, startCrop.x + deltaX), 1 - startCrop.w);
      newCrop.y = Math.min(Math.max(0, startCrop.y + deltaY), 1 - startCrop.h);
    } else {
      if (mode.includes("e")) {
        newCrop.w = Math.min(Math.max(0.1, startCrop.w + deltaX), 1 - startCrop.x);
      }
      if (mode.includes("s")) {
        newCrop.h = Math.min(Math.max(0.1, startCrop.h + deltaY), 1 - startCrop.y);
      }
      if (mode.includes("w")) {
        const potentialW = Math.max(0.1, startCrop.w - deltaX);
        if (startCrop.x + startCrop.w - potentialW >= 0) {
          newCrop.w = potentialW;
          newCrop.x = startCrop.x + startCrop.w - potentialW;
        }
      }
      if (mode.includes("n")) {
        const potentialH = Math.max(0.1, startCrop.h - deltaY);
        if (startCrop.y + startCrop.h - potentialH >= 0) {
          newCrop.h = potentialH;
          newCrop.y = startCrop.y + startCrop.h - potentialH;
        }
      }

      if (activeRatio && activeRatio > 0 && imageRef.current) {
        const imgRatio = rectWidth / rectHeight;
        const currentBoxRatio = (newCrop.w * imgRatio) / newCrop.h;
        if (Math.abs(currentBoxRatio - activeRatio) > 0.01) {
          const adjustedH = (newCrop.w * imgRatio) / activeRatio;
          if (newCrop.y + adjustedH <= 1) {
            newCrop.h = adjustedH;
          } else {
            newCrop.h = 1 - newCrop.y;
            newCrop.w = (newCrop.h * activeRatio) / imgRatio;
          }
        }
      }
    }

    setCrop(newCrop);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.mode) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      dragRef.current.mode = null;
    }
  };

  const handleApplyCrop = () => {
    if (!imageRef.current) return;

    const naturalImg = new Image();
    naturalImg.crossOrigin = "anonymous";
    naturalImg.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const natW = naturalImg.naturalWidth;
      const natH = naturalImg.naturalHeight;

      const cropX = Math.round(crop.x * natW);
      const cropY = Math.round(crop.y * natH);
      const cropW = Math.round(crop.w * natW);
      const cropH = Math.round(crop.h * natH);

      const isRotated90or270 = rotation % 180 !== 0;
      canvas.width = isRotated90or270 ? cropH : cropW;
      canvas.height = isRotated90or270 ? cropW : cropH;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      const drawW = isRotated90or270 ? canvas.height : canvas.width;
      const drawH = isRotated90or270 ? canvas.width : canvas.height;

      ctx.drawImage(naturalImg, cropX, cropY, cropW, cropH, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const croppedDataUrl = canvas.toDataURL("image/webp", 0.92);
      onCropComplete(croppedDataUrl);
      onClose();
    };
    naturalImg.src = imageUrl;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 my-auto overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Crop size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Crop &amp; Adjust Banner Image</h3>
              <p className="text-xs text-slate-500">Select free crop or standard aspect ratios for mobile &amp; web placement</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <X size={18} />
          </button>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="p-3 sm:px-6 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto shrink-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap mr-1 flex items-center gap-1">
            <Maximize size={12} /> Aspect Ratio:
          </span>
          {BANNER_RATIO_PRESETS.map((opt) => {
            const isSelected = selectedRatio === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => applyRatioCrop(opt.id)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 ring-2 ring-emerald-600/20"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80"
                }`}
              >
                {isSelected && <CheckCircle2 size={13} />}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Canvas Area */}
        <div
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative flex-1 bg-slate-900 flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none min-h-[340px]"
        >
          {imageUrl && (
            <div className="relative inline-block max-h-[50vh] max-w-full">
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Crop Target"
                onLoad={() => {
                  setImageLoaded(true);
                  applyRatioCrop(selectedRatio);
                }}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  maxHeight: "50vh",
                  maxWidth: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
                className="pointer-events-none rounded-lg shadow-lg"
              />

              {imageLoaded && (
                <div
                  style={{
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.w * 100}%`,
                    height: `${crop.h * 100}%`,
                  }}
                  onPointerDown={(e) => handlePointerDown(e, "move")}
                  className="absolute cursor-move border-2 border-white/95 rounded-sm shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] z-20"
                >
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                    <div className="border-r border-b border-white/70" />
                    <div className="border-r border-b border-white/70" />
                    <div className="border-b border-white/70" />
                    <div className="border-r border-b border-white/70" />
                    <div className="border-r border-b border-white/70" />
                    <div className="border-b border-white/70" />
                    <div className="border-r border-b border-white/70" />
                    <div className="border-r border-b border-white/70" />
                    <div />
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
                    <div className="p-1.5 rounded-full bg-black/40 text-white">
                      <Move size={16} />
                    </div>
                  </div>

                  <div onPointerDown={(e) => handlePointerDown(e, "nw")} className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-xs cursor-nwse-resize shadow-md hover:scale-125 transition-transform" />
                  <div onPointerDown={(e) => handlePointerDown(e, "ne")} className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-xs cursor-nesw-resize shadow-md hover:scale-125 transition-transform" />
                  <div onPointerDown={(e) => handlePointerDown(e, "sw")} className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-xs cursor-nesw-resize shadow-md hover:scale-125 transition-transform" />
                  <div onPointerDown={(e) => handlePointerDown(e, "se")} className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-xs cursor-nwse-resize shadow-md hover:scale-125 transition-transform" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <RotateCw size={14} />
              <span>Rotate 90°</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRotation(0);
                applyRatioCrop(selectedRatio);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <RefreshCw size={14} />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition text-xs">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/25 transition flex items-center gap-2 text-xs"
            >
              <Check size={16} />
              Apply Cropped Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PromotionsCouponsOffersPage() {
  const [activeTab, setActiveTab] = useState<"promotions" | "coupons" | "offers">("promotions");
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [offers, setOffers] = useState<OfferBanner[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Offer Placement Sub-filter (All, Home Carousel, Category Slide, Popup Banner)
  const [offerPlacementFilter, setOfferPlacementFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Modals state
  const [isCreatePromoOpen, setIsCreatePromoOpen] = useState(false);
  const [isCreateCouponOpen, setIsCreateCouponOpen] = useState(false);
  const [isCreateOfferOpen, setIsCreateOfferOpen] = useState(false);

  // Edit Modals state
  const [isEditPromoOpen, setIsEditPromoOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  const [isEditCouponOpen, setIsEditCouponOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  const [isEditOfferOpen, setIsEditOfferOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<OfferBanner | null>(null);

  const [isManageProductsOpen, setIsManageProductsOpen] = useState(false);
  const [selectedPromoForProducts, setSelectedPromoForProducts] = useState<Promotion | null>(null);
  const [isRedemptionsOpen, setIsRedemptionsOpen] = useState(false);
  const [redemptionsData, setRedemptionsData] = useState<any[]>([]);
  const [redemptionsTitle, setRedemptionsTitle] = useState("");
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);
  const [popupPreviewModalOpen, setPopupPreviewModalOpen] = useState(false);
  const [previewOffer, setPreviewOffer] = useState<OfferBanner | null>(null);

  // Image Cropper Modal State
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState("");
  const [cropperTarget, setCropperTarget] = useState<"create" | "edit">("create");

  // Form State - Create Promotion
  const [promoForm, setPromoForm] = useState({
    name: "",
    description: "",
    promotion_type: "percentage" as "percentage" | "fixed_amount",
    discount_value: 20,
    max_discount_amount: 100,
    minimum_order_amount: 100,
    status: "active" as "active" | "draft" | "paused",
    first_order_only: false,
    auto_apply: true,
    stackable: false,
    apply_to_all_products: true,
    allow_subscription_orders: false,
    usage_limit: 1000,
    usage_limit_per_customer: 1,
    start_at: "",
    end_at: "",
  });

  // Form State - Edit Promotion
  const [editPromoForm, setEditPromoForm] = useState({ ...promoForm });

  // Form State - Create Coupon
  const [couponForm, setCouponForm] = useState({
    code: "",
    name: "",
    description: "",
    promotion_id: "",
    status: "active" as "active" | "draft" | "paused",
    usage_limit: 1000,
    usage_limit_per_customer: 1,
    start_at: "",
    end_at: "",
  });

  // Form State - Edit Coupon
  const [editCouponForm, setEditCouponForm] = useState({ ...couponForm });

  // Form State - Create Offer Banner (with Category, Product & Popup Support)
  const [offerForm, setOfferForm] = useState({
    title: "",
    discount_text: "FLAT 50% OFF",
    description: "",
    image_url: "https://f2hfresh.com/uploads/app_assets/images/milk_bottle.png",
    banner_image: "",
    banner_type: "home_carousel" as "home_carousel" | "category_slide" | "popup",
    category_id: "",
    is_popup: false,
    action_type: "CATEGORY",
    action_value: "",
    cta_label: "Shop Now",
    background_color: "#16a34a",
    display_order: 0,
    is_active: true,
  });

  // Form State - Edit Offer Banner
  const [editOfferForm, setEditOfferForm] = useState({ ...offerForm });

  // Product Selection for Target Modal
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes, prodRes, catRes, offerRes] = await Promise.all([
        api.get<any>("/admin/promotions-coupons/promotions").catch(() => ({ data: [] } as any)),
        api.get<any>("/admin/promotions-coupons/coupons").catch(() => ({ data: [] } as any)),
        api.get<any>("/customer/products").catch(() => ({ data: [] } as any)),
        api.get<any>("/customer/categories").catch(() => ({ data: [] } as any)),
        api.get<any>("/admin/catalog/offers/table").catch(() => ({ data: [] } as any)),
      ]);

      const extractArray = (res: any, fallbackKey?: string) => {
        if (!res) return [];
        const payload = res.data !== undefined ? res.data : res;
        if (Array.isArray(payload)) return payload;
        if (fallbackKey && Array.isArray(payload?.[fallbackKey])) return payload[fallbackKey];
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.rows)) return payload.rows;
        return [];
      };

      const promos = extractArray(pRes, "promotions");
      const cpns = extractArray(cRes, "coupons");
      const prods = extractArray(prodRes, "products");
      const cats = extractArray(catRes, "categories");

      // Parse offers response
      let offerList: OfferBanner[] = [];
      const offerData = (offerRes as any)?.data;
      if (offerData?.data && Array.isArray(offerData.data)) {
        offerList = offerData.data;
      } else if (offerData?.rows && Array.isArray(offerData.rows)) {
        offerList = offerData.rows;
      } else if (Array.isArray(offerData)) {
        offerList = offerData;
      }

      setPromotions(promos);
      setCoupons(cpns);
      setCatalogProducts(prods);
      setCategories(cats);
      setOffers(offerList);

      if (promos.length > 0 && !couponForm.promotion_id) {
        setCouponForm((prev) => ({ ...prev, promotion_id: promos[0].promotion_id }));
      }
      if (cats.length > 0 && !offerForm.category_id) {
        setOfferForm((prev) => ({ ...prev, category_id: cats[0].category_id }));
      }
    } catch (e: any) {
      showErrorToast(e.message || "Failed to load promotions/coupons/offers");
    } finally {
      setLoading(false);
    }
  }, [couponForm.promotion_id, offerForm.category_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Status toggle handlers
  const togglePromoStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    try {
      await api.patch(`/admin/promotions-coupons/promotions/${id}/status`, { status: nextStatus });
      showSuccessToast(`Promotion status set to ${nextStatus}`);
      fetchData();
    } catch (e: any) {
      showErrorToast(e.message || "Failed to update status");
    }
  };

  const toggleCouponStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    try {
      await api.patch(`/admin/promotions-coupons/coupons/${id}/status`, { status: nextStatus });
      showSuccessToast(`Coupon status set to ${nextStatus}`);
      fetchData();
    } catch (e: any) {
      showErrorToast(e.message || "Failed to update status");
    }
  };

  const toggleOfferStatus = async (id: number, currentActive: boolean) => {
    try {
      await api.post<any>(`/admin/catalog/offers/${id}/saveEdit`, { is_active: !currentActive });
      showSuccessToast(`Offer banner ${!currentActive ? "activated" : "deactivated"}`);
      fetchData();
    } catch (e: any) {
      showErrorToast(e.message || "Failed to update offer banner");
    }
  };

  const togglePopupStatus = async (id: number, currentIsPopup: boolean) => {
    try {
      await api.post<any>(`/admin/catalog/offers/${id}/saveEdit`, {
        is_popup: !currentIsPopup,
        banner_type: !currentIsPopup ? "popup" : "home_carousel",
      });
      showSuccessToast(!currentIsPopup ? "Banner set as App Launch Popup!" : "Banner removed from App Launch Popup");
      fetchData();
    } catch (e: any) {
      showErrorToast(e.message || "Failed to toggle popup status");
    }
  };

  const deletePromotion = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete promotion "${name}"? Linked coupons will also be deleted.`)) return;
    try {
      await api.delete<any>(`/admin/promotions-coupons/promotions/${id}`);
      showSuccessToast("Promotion deleted successfully");
      fetchData();
    } catch (e: any) {
      showErrorToast(e.message || "Failed to delete promotion");
    }
  };

  const deleteCoupon = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete coupon code "${code}"?`)) return;
    try {
      await api.delete<any>(`/admin/promotions-coupons/coupons/${id}`);
      showSuccessToast("Coupon deleted successfully");
      fetchData();
    } catch (e: any) {
      showErrorToast(e.message || "Failed to delete coupon");
    }
  };

  const deleteOffer = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete offer banner "${title}"?`)) return;
    try {
      await api.delete<any>(`/admin/catalog/offers/${id}/delete`);
      showSuccessToast("Offer banner deleted successfully");
      fetchData();
    } catch (e: any) {
      showErrorToast(e.message || "Failed to delete offer");
    }
  };

  // Submit Create Promotion
  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoForm.name.trim()) {
      showErrorToast("Please enter a promotion name");
      return;
    }

    try {
      await api.post<any>("/admin/promotions-coupons/promotions", {
        name: promoForm.name.trim(),
        description: promoForm.description.trim() || undefined,
        promotion_type: promoForm.promotion_type,
        discount_value: Number(promoForm.discount_value),
        max_discount_amount: promoForm.promotion_type === "percentage" && promoForm.max_discount_amount ? Number(promoForm.max_discount_amount) : undefined,
        minimum_order_amount: Number(promoForm.minimum_order_amount) || 0,
        status: promoForm.status,
        first_order_only: promoForm.first_order_only,
        auto_apply: promoForm.auto_apply,
        stackable: promoForm.stackable,
        apply_to_all_products: promoForm.apply_to_all_products,
        allow_subscription_orders: promoForm.allow_subscription_orders,
        usage_limit: promoForm.usage_limit ? Number(promoForm.usage_limit) : undefined,
        usage_limit_per_customer: Number(promoForm.usage_limit_per_customer) || 1,
        start_at: promoForm.start_at || undefined,
        end_at: promoForm.end_at || undefined,
      });

      showSuccessToast("🎉 Promotion created successfully!");
      setIsCreatePromoOpen(false);
      fetchData();
    } catch (e: any) {
      showErrorToast(e.response?.data?.message || e.message || "Failed to create promotion");
    }
  };

  // Submit Create Coupon
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.code.trim()) {
      showErrorToast("Please enter a coupon code");
      return;
    }
    if (!couponForm.promotion_id) {
      showErrorToast("Please select a linked promotion");
      return;
    }

    try {
      await api.post<any>("/admin/promotions-coupons/coupons", {
        code: couponForm.code.trim().toUpperCase(),
        name: couponForm.name.trim() || undefined,
        description: couponForm.description.trim() || undefined,
        promotion_id: couponForm.promotion_id,
        status: couponForm.status,
        usage_limit: couponForm.usage_limit ? Number(couponForm.usage_limit) : undefined,
        usage_limit_per_customer: Number(couponForm.usage_limit_per_customer) || 1,
        start_at: couponForm.start_at || undefined,
        end_at: couponForm.end_at || undefined,
      });

      showSuccessToast(`🎉 Coupon "${couponForm.code.toUpperCase()}" created successfully!`);
      setIsCreateCouponOpen(false);
      fetchData();
    } catch (e: any) {
      showErrorToast(e.response?.data?.message || e.message || "Failed to create coupon");
    }
  };

  // Handle banner image file upload (converts to base64)
  const handleOfferImageUpload = (file: File, isEdit = false) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (isEdit) {
        setEditOfferForm((prev) => ({ ...prev, banner_image: base64, image_url: prev.image_url || file.name }));
      } else {
        setOfferForm((prev) => ({ ...prev, banner_image: base64, image_url: prev.image_url || file.name }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Open Image Cropper Modal with chosen image
  const handleOpenCropper = (imageSrc: string, target: "create" | "edit") => {
    if (!imageSrc) {
      showErrorToast("No image selected to crop");
      return;
    }
    setCropperImageSrc(imageSrc);
    setCropperTarget(target);
    setCropperOpen(true);
  };

  // Handle Cropped Image Result from Canvas Cropper
  const handleCropComplete = (croppedDataUrl: string) => {
    if (cropperTarget === "create") {
      setOfferForm((prev) => ({
        ...prev,
        banner_image: croppedDataUrl,
        image_url: prev.image_url || "cropped_banner.webp",
      }));
    } else {
      setEditOfferForm((prev) => ({
        ...prev,
        banner_image: croppedDataUrl,
        image_url: prev.image_url || "cropped_banner.webp",
      }));
    }
    showSuccessToast("🎉 Banner image cropped successfully!");
  };

  // Open Edit Promotion Modal
  const openEditPromo = (p: Promotion) => {
    setEditingPromo(p);
    setEditPromoForm({
      name: p.name || "",
      description: p.description || "",
      promotion_type: p.promotion_type || "percentage",
      discount_value: p.discount_value || 0,
      max_discount_amount: p.max_discount_amount || 0,
      minimum_order_amount: p.minimum_order_amount || 0,
      status: (p.status as any) || "active",
      first_order_only: Boolean(p.first_order_only),
      auto_apply: Boolean(p.auto_apply),
      stackable: Boolean(p.stackable),
      apply_to_all_products: Boolean(p.apply_to_all_products),
      allow_subscription_orders: Boolean(p.allow_subscription_orders),
      usage_limit: p.usage_limit || 0,
      usage_limit_per_customer: p.usage_limit_per_customer || 1,
      start_at: p.start_at ? p.start_at.substring(0, 10) : "",
      end_at: p.end_at ? p.end_at.substring(0, 10) : "",
    });
    setIsEditPromoOpen(true);
  };

  // Submit Update Promotion
  const handleUpdatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPromo) return;
    if (!editPromoForm.name.trim()) {
      showErrorToast("Please enter a promotion name");
      return;
    }
    try {
      await api.put(`/admin/promotions-coupons/promotions/${editingPromo.promotion_id}`, {
        name: editPromoForm.name.trim(),
        description: editPromoForm.description.trim() || undefined,
        promotion_type: editPromoForm.promotion_type,
        discount_value: Number(editPromoForm.discount_value),
        max_discount_amount:
          editPromoForm.promotion_type === "percentage" && editPromoForm.max_discount_amount
            ? Number(editPromoForm.max_discount_amount)
            : undefined,
        minimum_order_amount: Number(editPromoForm.minimum_order_amount) || 0,
        status: editPromoForm.status,
        first_order_only: editPromoForm.first_order_only,
        auto_apply: editPromoForm.auto_apply,
        stackable: editPromoForm.stackable,
        apply_to_all_products: editPromoForm.apply_to_all_products,
        allow_subscription_orders: editPromoForm.allow_subscription_orders,
        usage_limit: editPromoForm.usage_limit ? Number(editPromoForm.usage_limit) : undefined,
        usage_limit_per_customer: Number(editPromoForm.usage_limit_per_customer) || 1,
        start_at: editPromoForm.start_at || undefined,
        end_at: editPromoForm.end_at || undefined,
      });
      showSuccessToast("Promotion updated successfully!");
      setIsEditPromoOpen(false);
      fetchData();
    } catch (e: any) {
      showErrorToast(e.response?.data?.message || e.message || "Failed to update promotion");
    }
  };

  // Open Edit Coupon Modal
  const openEditCoupon = (c: Coupon) => {
    setEditingCoupon(c);
    setEditCouponForm({
      code: c.code || "",
      name: c.name || "",
      description: c.description || "",
      promotion_id: c.promotion_id || "",
      status: (c.status as any) || "active",
      usage_limit: c.usage_limit || 0,
      usage_limit_per_customer: c.usage_limit_per_customer || 1,
      start_at: c.start_at ? c.start_at.substring(0, 10) : "",
      end_at: c.end_at ? c.end_at.substring(0, 10) : "",
    });
    setIsEditCouponOpen(true);
  };

  // Submit Update Coupon
  const handleUpdateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;
    try {
      await api.put(`/admin/promotions-coupons/coupons/${editingCoupon.coupon_id}`, {
        name: editCouponForm.name.trim() || undefined,
        description: editCouponForm.description.trim() || undefined,
        promotion_id: editCouponForm.promotion_id,
        status: editCouponForm.status,
        usage_limit: editCouponForm.usage_limit ? Number(editCouponForm.usage_limit) : undefined,
        usage_limit_per_customer: Number(editCouponForm.usage_limit_per_customer) || 1,
        start_at: editCouponForm.start_at || undefined,
        end_at: editCouponForm.end_at || undefined,
      });
      showSuccessToast(`Coupon "${editingCoupon.code}" updated successfully!`);
      setIsEditCouponOpen(false);
      fetchData();
    } catch (e: any) {
      showErrorToast(e.response?.data?.message || e.message || "Failed to update coupon");
    }
  };

  // Open Edit Offer Banner Modal
  const openEditOffer = (o: OfferBanner) => {
    setEditingOffer(o);
    setEditOfferForm({
      title: o.title || "",
      discount_text: o.discount_text || "",
      description: o.description || "",
      image_url: o.image_url || "",
      banner_image: "",
      banner_type: (o.banner_type as any) || "home_carousel",
      category_id: o.category_id || "",
      is_popup: Boolean(o.is_popup || o.banner_type === "popup"),
      action_type: o.action_type || "CATEGORY",
      action_value: o.action_value || "",
      cta_label: o.cta_label || "Shop Now",
      background_color: o.background_color || "#16a34a",
      display_order: o.display_order ?? 0,
      is_active: o.is_active ?? true,
    });
    setIsEditOfferOpen(true);
  };

  // Submit Update Offer Banner
  const handleUpdateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOffer) return;
    if (!editOfferForm.title.trim()) {
      showErrorToast("Please enter an offer banner title");
      return;
    }
    try {
      await api.post(`/admin/catalog/offers/${editingOffer.id}/saveEdit`, {
        title: editOfferForm.title.trim(),
        discount_text: editOfferForm.discount_text.trim() || null,
        description: editOfferForm.description.trim() || null,
        image_url: editOfferForm.image_url.trim() || undefined,
        banner_image: editOfferForm.banner_image || undefined,
        banner_type: editOfferForm.banner_type,
        category_id: editOfferForm.action_type === "CATEGORY" ? editOfferForm.category_id : editOfferForm.category_id || null,
        action_type: editOfferForm.action_type,
        action_value: editOfferForm.action_type === "CATEGORY" ? editOfferForm.category_id : editOfferForm.action_value,
        is_popup: editOfferForm.is_popup || editOfferForm.banner_type === "popup",
        cta_label: editOfferForm.cta_label.trim() || "Shop Now",
        background_color: editOfferForm.background_color || "#16a34a",
        display_order: Number(editOfferForm.display_order) || 0,
        is_active: editOfferForm.is_active,
      });
      showSuccessToast("Offer banner updated successfully!");
      setIsEditOfferOpen(false);
      fetchData();
    } catch (e: any) {
      showErrorToast(e.response?.data?.message || e.message || "Failed to update offer banner");
    }
  };

  // Submit Create Offer Banner (with Category & Popup Type)
  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerForm.title.trim()) {
      showErrorToast("Please enter an offer banner title");
      return;
    }
    if (!offerForm.image_url.trim() && !offerForm.banner_image) {
      showErrorToast("Please provide an image URL or upload an image for the banner");
      return;
    }

    try {
      await api.post<any>("/admin/catalog/offers/saveAdd", {
        title: offerForm.title.trim(),
        discount_text: offerForm.discount_text.trim() || null,
        description: offerForm.description.trim() || null,
        image_url: offerForm.image_url.trim() || "banner_upload",
        banner_image: offerForm.banner_image || undefined,
        banner_type: offerForm.banner_type,
        category_id: offerForm.action_type === "CATEGORY" ? offerForm.category_id : offerForm.category_id || null,
        is_popup: offerForm.is_popup || offerForm.banner_type === "popup",
        action_type: offerForm.action_type,
        action_value: offerForm.action_type === "CATEGORY" ? offerForm.category_id : offerForm.action_value,
        cta_label: offerForm.cta_label.trim() || "Shop Now",
        background_color: offerForm.background_color || "#16a34a",
        display_order: Number(offerForm.display_order) || 0,
        is_active: offerForm.is_active,
      });

      showSuccessToast("🎉 Offer banner created successfully!");
      setIsCreateOfferOpen(false);
      fetchData();
    } catch (e: any) {
      showErrorToast(e.response?.data?.message || e.message || "Failed to create offer banner");
    }
  };

  // Open Manage Products Modal
  const openManageProducts = async (promo: Promotion) => {
    setSelectedPromoForProducts(promo);
    setSelectedVariantIds([]);
    setIsManageProductsOpen(true);

    try {
      const res = await api.get<any>(`/admin/promotions-coupons/promotions/${promo.promotion_id}`);
      if (res.data?.data) {
        setSelectedPromoForProducts(res.data.data);
      }
    } catch (_) {}
  };

  // Add Product to Promotion
  const handleAddProductsToPromo = async () => {
    if (!selectedPromoForProducts || selectedVariantIds.length === 0) return;
    try {
      await api.post<any>(`/admin/promotions-coupons/promotions/${selectedPromoForProducts.promotion_id}/products`, {
        variant_ids: selectedVariantIds,
      });
      showSuccessToast("Product variants linked successfully!");
      setSelectedVariantIds([]);
      const res = await api.get<any>(`/admin/promotions-coupons/promotions/${selectedPromoForProducts.promotion_id}`);
      if (res.data?.data) setSelectedPromoForProducts(res.data.data);
      fetchData();
    } catch (e: any) {
      showErrorToast(e.message || "Failed to add products");
    }
  };

  // Remove Product from Promotion
  const handleRemoveProductFromPromo = async (variantId: string) => {
    if (!selectedPromoForProducts) return;
    try {
      await api.delete<any>(`/admin/promotions-coupons/promotions/${selectedPromoForProducts.promotion_id}/products/${variantId}`);
      showSuccessToast("Variant unlinked from promotion");
      const res = await api.get<any>(`/admin/promotions-coupons/promotions/${selectedPromoForProducts.promotion_id}`);
      if (res.data?.data) setSelectedPromoForProducts(res.data.data);
      fetchData();
    } catch (e: any) {
      showErrorToast(e.message || "Failed to remove variant");
    }
  };

  // View Redemptions
  const openRedemptionsModal = async (type: "promo" | "coupon", id: string, name: string) => {
    setRedemptionsTitle(name);
    setRedemptionsData([]);
    setLoadingRedemptions(true);
    setIsRedemptionsOpen(true);

    try {
      const path = type === "promo" ? `/admin/promotions-coupons/promotions/${id}/redemptions` : `/admin/promotions-coupons/coupons/${id}/redemptions`;
      const res = await api.get<any>(path);
      setRedemptionsData(res.data?.data || res.data || []);
    } catch (e: any) {
      showErrorToast("Failed to load redemptions");
    } finally {
      setLoadingRedemptions(false);
    }
  };

  const getCategoryName = (catId?: string) => {
    if (!catId) return "—";
    const found = categories.find((c) => c.category_id === catId);
    return found ? found.name : catId;
  };

  // Filtered lists
  const filteredPromotions = useMemo(() => {
    return promotions.filter((p) => {
      const matchSearch =
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.promotion_id?.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [promotions, search, statusFilter]);

  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      const matchSearch =
        c.code?.toLowerCase().includes(search.toLowerCase()) ||
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.promotion_name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [coupons, search, statusFilter]);

  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      const matchSearch =
        o.title?.toLowerCase().includes(search.toLowerCase()) ||
        o.discount_text?.toLowerCase().includes(search.toLowerCase()) ||
        o.description?.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && o.is_active) ||
        (statusFilter === "paused" && !o.is_active);

      const matchPlacement =
        offerPlacementFilter === "all" ||
        (offerPlacementFilter === "popup" && (o.is_popup || o.banner_type === "popup")) ||
        (offerPlacementFilter === "category_slide" && o.banner_type === "category_slide") ||
        (offerPlacementFilter === "home_carousel" && (o.banner_type === "home_carousel" || !o.banner_type));

      const matchCategory =
        selectedCategoryFilter === "all" ||
        o.category_id === selectedCategoryFilter;

      return matchSearch && matchStatus && matchPlacement && matchCategory;
    });
  }, [offers, search, statusFilter, offerPlacementFilter, selectedCategoryFilter]);

  return (
    <div className="space-y-6 p-2 md:p-4 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link href="/admin/dashboard" className="flex items-center gap-1 hover:text-[#16a34a] transition-colors">
          <Home size={13} /> Dashboard
        </Link>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="text-slate-500 font-medium">Catalog &amp; Inventory</span>
        <ChevronRight size={12} className="text-slate-400" />
        <span className="font-semibold text-slate-800">Promotions, Coupons &amp; Offers</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#16a34a] flex items-center justify-center border border-emerald-100/60 shadow-xs shrink-0">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Promotions, Coupons &amp; Offers</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage discount campaigns, checkout coupons, category slides, and app launch popup banners.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-all border border-slate-200 flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[#16a34a]" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setIsCreatePromoOpen(true)}
            className="px-4 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
          >
            <Plus size={16} />
            New Promotion
          </button>
          <button
            type="button"
            onClick={() => setIsCreateCouponOpen(true)}
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-teal-600/20 flex items-center gap-2"
          >
            <Ticket size={16} />
            New Coupon
          </button>
          <button
            type="button"
            onClick={() => setIsCreateOfferOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
          >
            <Tag size={16} />
            New Offer Banner
          </button>
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center font-bold">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Active Promotions</div>
            <div className="text-2xl font-black text-slate-900">
              {promotions.filter((p) => p.status === "active").length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {promotions.length} Total Campaigns
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Active Coupons</div>
            <div className="text-2xl font-black text-slate-900">
              {coupons.filter((c) => c.status === "active").length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {coupons.length} Registered Codes
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Launch Popup Banners</div>
            <div className="text-2xl font-black text-slate-900">
              {offers.filter((o) => o.is_active && (o.is_popup || o.banner_type === "popup")).length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Active App Popups
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <FolderTree className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Category Slide Banners</div>
            <div className="text-2xl font-black text-slate-900">
              {offers.filter((o) => o.is_active && (o.banner_type === "category_slide" || o.category_id)).length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Targeted Category Slides</div>
          </div>
        </div>
      </div>

      {/* Main Card Container */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-4 md:p-6 space-y-6">
        {/* Tabs & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("promotions")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "promotions"
                  ? "bg-[#16a34a] text-white shadow-md shadow-emerald-600/20"
                  : "bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              <Percent className="w-4 h-4" />
              Promotions ({promotions.length})
            </button>
            <button
              onClick={() => setActiveTab("coupons")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "coupons"
                  ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                  : "bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              <Ticket className="w-4 h-4" />
              Coupons ({coupons.length})
            </button>
            <button
              onClick={() => setActiveTab("offers")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "offers"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              <Tag className="w-4 h-4" />
              Offers, Slides &amp; Popups ({offers.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused / Inactive</option>
              <option value="draft">Draft</option>
            </select>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${activeTab}...`}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>
        </div>

        {/* Tab 1: Promotions Table */}
        {activeTab === "promotions" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="p-4">Promotion Name &amp; ID</th>
                  <th className="p-4">Discount Value</th>
                  <th className="p-4">Min. Order</th>
                  <th className="p-4">Scope &amp; Rules</th>
                  <th className="p-4">Redemptions</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPromotions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400">
                      No promotions matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredPromotions.map((p) => (
                    <tr key={p.promotion_id} className="hover:bg-slate-50/60 transition">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{p.promotion_id}</div>
                        {p.description && (
                          <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">{p.description}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-[#16a34a] font-black text-xs">
                          {p.promotion_type === "percentage"
                            ? `${Number(p.discount_value)}% OFF`
                            : `₹${Number(p.discount_value)} FLAT OFF`}
                        </span>
                        {p.max_discount_amount && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            Cap: ₹{Number(p.max_discount_amount)}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-semibold text-slate-800">
                        {Number(p.minimum_order_amount) > 0 ? `₹${Number(p.minimum_order_amount)}` : "None"}
                      </td>
                      <td className="p-4 space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {p.first_order_only && (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                              First Order Only
                            </span>
                          )}
                          {p.auto_apply && (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold">
                              Auto Applied
                            </span>
                          )}
                          {p.stackable && (
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                              Stackable
                            </span>
                          )}
                          {p.allow_subscription_orders && (
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold">
                              Subscriptions Allowed
                            </span>
                          )}
                        </div>
                        <div>
                          {p.apply_to_all_products ? (
                            <span className="text-[11px] font-bold text-purple-700">
                              📦 All Products in Store
                            </span>
                          ) : (
                            <button
                              onClick={() => openManageProducts(p)}
                              className="text-[11px] font-bold text-[#16a34a] hover:underline flex items-center gap-1"
                            >
                              <Package size={12} />
                              {p.products_count || 0} Targeted Variants (Edit)
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => openRedemptionsModal("promo", p.promotion_id, p.name)}
                          className="font-bold text-slate-900 hover:text-[#16a34a] hover:underline flex items-center gap-1"
                        >
                          <Users size={12} />
                          {p.total_redemptions || 0} Claimed
                        </button>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            p.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : p.status === "paused"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!p.apply_to_all_products && (
                            <button
                              onClick={() => openManageProducts(p)}
                              title="Manage Targeted Variants"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                            >
                              <Boxes size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => openEditPromo(p)}
                            title="Edit Promotion"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1"
                          >
                            <Edit3 size={13} />
                            Edit
                          </button>
                          <button
                            onClick={() => deletePromotion(p.promotion_id, p.name)}
                            title="Delete Promotion"
                            className="p-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Coupons Table */}
        {activeTab === "coupons" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="p-4">Coupon Code &amp; Info</th>
                  <th className="p-4">Linked Promotion</th>
                  <th className="p-4">Discount</th>
                  <th className="p-4">Min. Order</th>
                  <th className="p-4">Usage Limit</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCoupons.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400">
                      No coupon codes matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredCoupons.map((c) => (
                    <tr key={c.coupon_id} className="hover:bg-slate-50/60 transition">
                      <td className="p-4">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-mono font-black text-xs tracking-wider">
                          <Ticket size={13} />
                          {c.code}
                        </div>
                        {c.name && <div className="font-semibold text-slate-900 mt-1">{c.name}</div>}
                        {c.description && <div className="text-[11px] text-slate-400">{c.description}</div>}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">{c.promotion_name || "—"}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{c.promotion_id}</div>
                      </td>
                      <td className="p-4">
                        <span className="font-black text-slate-900">
                          {c.promotion_type === "percentage"
                            ? `${Number(c.discount_value)}% OFF`
                            : `₹${Number(c.discount_value)} OFF`}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-800">
                        {Number(c.minimum_order_amount) > 0 ? `₹${Number(c.minimum_order_amount)}` : "None"}
                      </td>
                      <td className="p-4">
                        <div className="text-slate-900 font-bold">
                          {c.used_count || 0} / {c.usage_limit || "∞"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {c.usage_limit_per_customer}x per customer
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            c.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openRedemptionsModal("coupon", c.coupon_id, c.code)}
                            title="View Redemptions"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                          >
                            <Users size={14} />
                          </button>
                          <button
                            onClick={() => openEditCoupon(c)}
                            title="Edit Coupon"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1"
                          >
                            <Edit3 size={13} />
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCoupon(c.coupon_id, c.code)}
                            title="Delete Coupon"
                            className="p-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Offers, Category Slides & Popup Banners */}
        {activeTab === "offers" && (
          <div className="space-y-6">
            {/* Placement Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setOfferPlacementFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    offerPlacementFilter === "all"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  All Banners ({offers.length})
                </button>
                <button
                  onClick={() => setOfferPlacementFilter("home_carousel")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    offerPlacementFilter === "home_carousel"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Tag size={13} />
                  Home Carousel ({offers.filter((o) => o.banner_type === "home_carousel" || !o.banner_type).length})
                </button>
                <button
                  onClick={() => setOfferPlacementFilter("category_slide")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    offerPlacementFilter === "category_slide"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <FolderTree size={13} />
                  Category Slides ({offers.filter((o) => o.banner_type === "category_slide" || o.category_id).length})
                </button>
                <button
                  onClick={() => setOfferPlacementFilter("popup")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    offerPlacementFilter === "popup"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Smartphone size={13} />
                  Popup Banners ({offers.filter((o) => o.is_popup || o.banner_type === "popup").length})
                </button>
              </div>

              {/* Category Filter Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">Category Filter:</span>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Visual Previews Carousel Grid */}
            <div>
              <div className="text-xs font-bold text-slate-800 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles size={14} className="text-indigo-600" />
                  Live App Banners &amp; Category Slides Previews:
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Tap "View Popup Mockup" on any card to see how it renders as an app launch dialog.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {filteredOffers.filter((o) => o.is_active).map((offer) => {
                  const isPopup = Boolean(offer.is_popup || offer.banner_type === "popup");
                  const isCatSlide = offer.banner_type === "category_slide" || Boolean(offer.category_id);

                  return (
                    <div
                      key={offer.id}
                      style={{ backgroundColor: offer.background_color || "#16a34a" }}
                      className="p-4 rounded-3xl text-white relative overflow-hidden shadow-sm flex flex-col justify-between h-44 border border-black/5 group"
                    >
                      <div className="space-y-1 relative z-10">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {offer.discount_text && (
                            <span className="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-extrabold uppercase tracking-wider">
                              {offer.discount_text}
                            </span>
                          )}
                          {isPopup && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500 text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-xs">
                              <Smartphone size={10} /> App Popup
                            </span>
                          )}
                          {isCatSlide && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/80 text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                              <FolderTree size={10} /> {getCategoryName(offer.category_id)}
                            </span>
                          )}
                        </div>

                        <h4 className="font-extrabold text-sm leading-tight drop-shadow-xs mt-1">{offer.title}</h4>
                        {offer.description && (
                          <p className="text-[11px] text-white/90 line-clamp-2">{offer.description}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2 relative z-10">
                        <button
                          onClick={() => {
                            setPreviewOffer(offer);
                            setPopupPreviewModalOpen(true);
                          }}
                          className="text-[10px] font-bold bg-white text-slate-900 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition shadow-xs flex items-center gap-1"
                        >
                          <Eye size={12} />
                          Popup Mockup
                        </button>
                        <span className="text-[10px] text-white/80 font-mono">Order #{offer.display_order}</span>
                      </div>

                      {/* Image Preview Thumbnail */}
                      {offer.image_url && (
                        <img
                          src={offer.image_url}
                          alt={offer.title}
                          className="w-18 h-18 object-contain absolute right-2 bottom-2 drop-shadow-md z-0 opacity-90 group-hover:scale-105 transition"
                          onError={(e) => {
                            (e.target as any).style.display = "none";
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Offers Datatable */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="p-4">Banner &amp; Title</th>
                    <th className="p-4">Placement / Scope</th>
                    <th className="p-4">Discount Tag</th>
                    <th className="p-4">Target / Action</th>
                    <th className="p-4">Launch Popup?</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOffers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400">
                        No offer banners matching your filters. Click "+ New Offer Banner" to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredOffers.map((o) => {
                      const isPopup = Boolean(o.is_popup || o.banner_type === "popup");

                      return (
                        <tr key={o.id} className="hover:bg-slate-50/60 transition">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                style={{ backgroundColor: o.background_color || "#16a34a" }}
                                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 overflow-hidden shadow-xs"
                              >
                                {o.image_url ? (
                                  <img src={o.image_url} alt="" className="w-10 h-10 object-contain" />
                                ) : (
                                  <ImageIcon size={18} />
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-sm">{o.title}</div>
                                {o.description && (
                                  <div className="text-[11px] text-slate-400 line-clamp-1">{o.description}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 space-y-1">
                            {o.banner_type === "category_slide" || o.category_id ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-bold text-xs">
                                <FolderTree size={12} />
                                {getCategoryName(o.category_id)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs">
                                <Tag size={12} />
                                Home Carousel
                              </span>
                            )}
                            <div className="text-[10px] text-slate-400 font-mono">Order #{o.display_order || 1}</div>
                          </td>
                          <td className="p-4">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 text-[#16a34a] font-extrabold text-xs">
                              {o.discount_text || "OFFER"}
                            </span>
                          </td>
                          <td className="p-4 font-semibold text-slate-800">
                            <div className="font-bold">{o.action_type || "BROWSE"}</div>
                            {o.action_value && (
                              <div className="text-[10px] text-slate-400 font-mono">{o.action_value}</div>
                            )}
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => togglePopupStatus(o.id, isPopup)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold transition ${
                                isPopup
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}
                            >
                              <Smartphone size={12} />
                              {isPopup ? "Active Popup" : "Enable Popup"}
                            </button>
                          </td>
                          <td className="p-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                o.is_active
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {o.is_active ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setPreviewOffer(o);
                                  setPopupPreviewModalOpen(true);
                                }}
                                title="View Popup Dialog Mockup"
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => openEditOffer(o)}
                                title="Edit Offer Banner"
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1"
                              >
                                <Edit3 size={13} />
                                Edit
                              </button>
                              <button
                                onClick={() => deleteOffer(o.id, o.title)}
                                title="Delete Offer Banner"
                                className="p-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE PROMOTION */}
      {/* ========================================================================= */}
      {isCreatePromoOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center font-bold">
                  <Percent size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Promotion</h3>
                  <p className="text-xs text-slate-500">Configure discount rules, targeting, and eligibility</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreatePromoOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form id="create-promo-form" onSubmit={handleCreatePromo} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="font-bold text-slate-700">Promotion Name *</label>
                  <input
                    type="text"
                    required
                    value={promoForm.name}
                    onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })}
                    placeholder="e.g. First Milk Order 50% Off"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="font-bold text-slate-700">Description</label>
                  <textarea
                    rows={2}
                    value={promoForm.description}
                    onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })}
                    placeholder="Brief description for customer facing banner or app copy"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Discount Type *</label>
                  <select
                    value={promoForm.promotion_type}
                    onChange={(e) => setPromoForm({ ...promoForm, promotion_type: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">
                    Discount Value * ({promoForm.promotion_type === "percentage" ? "%" : "₹"})
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.01"
                    required
                    value={promoForm.discount_value}
                    onChange={(e) => setPromoForm({ ...promoForm, discount_value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {promoForm.promotion_type === "percentage" && (
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Max Cap Discount Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={promoForm.max_discount_amount}
                      onChange={(e) => setPromoForm({ ...promoForm, max_discount_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g. 100"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Minimum Order Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={promoForm.minimum_order_amount}
                    onChange={(e) => setPromoForm({ ...promoForm, minimum_order_amount: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Usage Limit Per Customer</label>
                  <input
                    type="number"
                    min="1"
                    value={promoForm.usage_limit_per_customer}
                    onChange={(e) => setPromoForm({ ...promoForm, usage_limit_per_customer: parseInt(e.target.value) || 1 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Global Total Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={promoForm.usage_limit}
                    onChange={(e) => setPromoForm({ ...promoForm, usage_limit: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 1000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Checkbox Options */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-3">
                <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                  Promotion Rules &amp; Flags
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={promoForm.auto_apply}
                      onChange={(e) => setPromoForm({ ...promoForm, auto_apply: e.target.checked })}
                      className="w-4 h-4 rounded text-[#16a34a] focus:ring-emerald-500"
                    />
                    <span>Auto Apply at Checkout</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={promoForm.first_order_only}
                      onChange={(e) => setPromoForm({ ...promoForm, first_order_only: e.target.checked })}
                      className="w-4 h-4 rounded text-[#16a34a] focus:ring-emerald-500"
                    />
                    <span>First Order Only (First Milk)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={promoForm.apply_to_all_products}
                      onChange={(e) => setPromoForm({ ...promoForm, apply_to_all_products: e.target.checked })}
                      className="w-4 h-4 rounded text-[#16a34a] focus:ring-emerald-500"
                    />
                    <span>Apply to All Products</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={promoForm.stackable}
                      onChange={(e) => setPromoForm({ ...promoForm, stackable: e.target.checked })}
                      className="w-4 h-4 rounded text-[#16a34a] focus:ring-emerald-500"
                    />
                    <span>Stackable with Coupons</span>
                  </label>
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreatePromoOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-promo-form"
                className="px-5 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
              >
                <Plus size={16} />
                Create Promotion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CREATE COUPON CODE */}
      {/* ========================================================================= */}
      {isCreateCouponOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                  <Ticket size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Coupon Code</h3>
                  <p className="text-xs text-slate-500">Customer entered discount promo code</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateCouponOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form id="create-coupon-form" onSubmit={handleCreateCoupon} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Coupon Code *</label>
                <input
                  type="text"
                  required
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. WELCOME50, FRESH20"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-black tracking-wider focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Linked Promotion (Discount Source) *</label>
                <select
                  required
                  value={couponForm.promotion_id}
                  onChange={(e) => setCouponForm({ ...couponForm, promotion_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {promotions.map((p) => (
                    <option key={p.promotion_id} value={p.promotion_id}>
                      {p.name} ({p.promotion_type === "percentage" ? `${p.discount_value}% OFF` : `₹${p.discount_value} OFF`})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  The coupon inherits discount calculations and order value rules from the parent promotion.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Coupon Name / Label</label>
                <input
                  type="text"
                  value={couponForm.name}
                  onChange={(e) => setCouponForm({ ...couponForm, name: e.target.value })}
                  placeholder="e.g. Welcome ₹50 Off"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Usage Limit Per User</label>
                  <input
                    type="number"
                    min="1"
                    value={couponForm.usage_limit_per_customer}
                    onChange={(e) => setCouponForm({ ...couponForm, usage_limit_per_customer: parseInt(e.target.value) || 1 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Total Global Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={couponForm.usage_limit}
                    onChange={(e) => setCouponForm({ ...couponForm, usage_limit: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 1000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateCouponOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-coupon-form"
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md shadow-teal-600/20 transition flex items-center gap-2"
              >
                <Ticket size={16} />
                Create Coupon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREATE OFFER BANNER (WITH PREVIEW, CROP & PLACEMENT TYPE) */}
      {/* ========================================================================= */}
      {isCreateOfferOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Tag size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Offer Banner</h3>
                  <p className="text-xs text-slate-500">Configure promotional top banners, category redirection &amp; popups</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOfferOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form id="create-offer-form" onSubmit={handleCreateOffer} className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* SECTION 1: OFFER DETAILS */}
              <div className="space-y-4">
                <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Offer Details</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Banner Title *</label>
                    <input
                      type="text"
                      required
                      value={offerForm.title}
                      onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                      placeholder="e.g. Fresh Organic Harvest Sale"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Discount / Badge Text</label>
                    <input
                      type="text"
                      value={offerForm.discount_text}
                      onChange={(e) => setOfferForm({ ...offerForm, discount_text: e.target.value })}
                      placeholder="e.g. 30% OFF or FREE Shipping"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Description</label>
                  <textarea
                    rows={2}
                    value={offerForm.description}
                    onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                    placeholder="Brief summary of the promotional offer..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* SECTION 2: BANNER IMAGE (URL OR UPLOAD WITH CROP & PREVIEW) */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Banner Image (URL or Upload)</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Banner Image URL (Mandatory - Min 1)</label>
                    <input
                      type="text"
                      value={offerForm.image_url}
                      onChange={(e) => setOfferForm({ ...offerForm, image_url: e.target.value })}
                      placeholder="https://images.unsplash.com/... or /uploads/..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400">Direct image link or upload &amp; crop on right</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Or Upload Banner Image</label>
                    {offerForm.banner_image || offerForm.image_url ? (
                      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3 space-y-3 shadow-xs">
                        <div className="h-36 w-full rounded-xl overflow-hidden bg-white border border-slate-200/60 flex items-center justify-center p-2 shadow-inner">
                          <img
                            src={offerForm.banner_image || offerForm.image_url}
                            alt="Banner Upload"
                            className="max-h-full max-w-full object-contain rounded-lg"
                          />
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenCropper(offerForm.banner_image || offerForm.image_url, "create")}
                            className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                          >
                            <Crop size={14} className="text-slate-500" />
                            <span>Crop</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setOfferForm({ ...offerForm, banner_image: "", image_url: "" })}
                            className="px-4 py-1.5 rounded-xl border border-red-500/80 bg-white hover:bg-red-50 text-red-600 font-bold text-xs shadow-xs transition"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-200 hover:border-emerald-500 bg-slate-50 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition text-center min-h-[110px]">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleOfferImageUpload(file, false);
                          }}
                        />
                        <div className="flex flex-col items-center gap-1.5 text-slate-500 font-semibold text-xs">
                          <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Upload size={16} />
                          </div>
                          <span>Click to upload banner / drag &amp; drop</span>
                          <span className="text-[10px] text-slate-400">PNG, JPG, WebP supported</span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 3: NAVIGATION & CTA REDIRECTION */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Navigation &amp; CTA Redirection</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Action Target Type *</label>
                    <select
                      value={offerForm.action_type}
                      onChange={(e) => setOfferForm({ ...offerForm, action_type: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="CATEGORY">Store Category (Redirection)</option>
                      <option value="PRODUCT">Single Product (Redirection)</option>
                      <option value="EXTERNAL">External Web Link</option>
                      <option value="BROWSE">None / General Browse</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Button Label *</label>
                    <input
                      type="text"
                      required
                      value={offerForm.cta_label}
                      onChange={(e) => setOfferForm({ ...offerForm, cta_label: e.target.value })}
                      placeholder="Shop Now"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">
                      Redirection Category {offerForm.banner_type === "category_slide" ? "(Target Slide Category *)" : "(If Category Target)"}
                    </label>
                    <select
                      value={offerForm.category_id}
                      onChange={(e) => setOfferForm({ ...offerForm, category_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">— Select Category —</option>
                      {categories.map((c) => (
                        <option key={c.category_id} value={c.category_id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Redirection Product (If Product Target)</label>
                    <select
                      value={offerForm.action_value}
                      onChange={(e) => setOfferForm({ ...offerForm, action_value: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">— Select Product —</option>
                      {catalogProducts.map((p) => (
                        <option key={p.variant_id} value={p.product_id || p.variant_id}>
                          {p.product_name} - {p.variant_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 4: STYLING & ORDERING */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Styling &amp; Ordering</div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Banner Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={offerForm.background_color}
                        onChange={(e) => setOfferForm({ ...offerForm, background_color: e.target.value })}
                        className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer p-1 bg-slate-50 shrink-0"
                      />
                      <input
                        type="text"
                        value={offerForm.background_color}
                        onChange={(e) => setOfferForm({ ...offerForm, background_color: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Display Sequence Order</label>
                    <input
                      type="number"
                      value={offerForm.display_order}
                      onChange={(e) => setOfferForm({ ...offerForm, display_order: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">Active Status</label>
                    <button
                      type="button"
                      onClick={() => setOfferForm({ ...offerForm, is_active: !offerForm.is_active })}
                      className={`w-full py-2.5 px-4 rounded-xl border font-bold flex items-center justify-between transition ${
                        offerForm.is_active
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                          : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}
                    >
                      <span>{offerForm.is_active ? "Active" : "Inactive"}</span>
                      {offerForm.is_active ? (
                        <ToggleRight size={22} className="text-[#16a34a]" />
                      ) : (
                        <ToggleLeft size={22} className="text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 5: BANNER PLACEMENT TYPE ABOVE PREVIEW */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wider text-slate-700 uppercase flex items-center gap-1.5">
                      <SlidersHorizontal size={13} className="text-emerald-600" />
                      Banner Placement Type *
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 capitalize bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      {offerForm.banner_type.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { type: "home_carousel", label: "Home Carousel", desc: "Top Home Slider", icon: Tag },
                      { type: "category_slide", label: "Category Slide", desc: "Targeted in Category", icon: FolderTree },
                      { type: "popup", label: "App Launch Popup", desc: "Modal On App Open", icon: Smartphone },
                      { type: "checkout_banner", label: "Checkout Promo", desc: "Cart & Pay Screens", icon: ShoppingBag },
                    ].map((b) => {
                      const isSelected = offerForm.banner_type === b.type;
                      const IconComp = b.icon;
                      return (
                        <button
                          key={b.type}
                          type="button"
                          onClick={() =>
                            setOfferForm({
                              ...offerForm,
                              banner_type: b.type as any,
                              is_popup: b.type === "popup",
                            })
                          }
                          className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                            isSelected
                              ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 shadow-xs"
                              : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <IconComp size={16} className={isSelected ? "text-emerald-600" : "text-slate-400"} />
                            {isSelected && <CheckCircle2 size={14} className="text-emerald-600" />}
                          </div>
                          <div>
                            <div className="font-bold text-xs">{b.label}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{b.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* DYNAMIC LIVE BANNER PREVIEW ACCORDING TO TYPE */}
                <div className="space-y-1.5 pt-3 border-t border-slate-200/70">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Live Banner Rendering:</span>
                    <span className="text-[10px] text-emerald-600 font-bold">Realtime Dynamic Preview</span>
                  </div>
                  <BannerVisualPreview
                    title={offerForm.title}
                    discount_text={offerForm.discount_text}
                    description={offerForm.description}
                    image_url={offerForm.banner_image || offerForm.image_url}
                    banner_type={offerForm.banner_type}
                    cta_label={offerForm.cta_label}
                    background_color={offerForm.background_color}
                    category_name={getCategoryName(offerForm.category_id)}
                  />
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateOfferOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-offer-form"
                className="px-5 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
              >
                <Plus size={16} />
                Save Offer Banner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3B: EDIT OFFER BANNER (WITH PREVIEW, CROP & PLACEMENT TYPE) */}
      {/* ========================================================================= */}
      {isEditOfferOpen && editingOffer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Offer Banner</h3>
                  <p className="text-xs text-slate-500">Update banner details, navigation targets, accent styling, and sequence order</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditOfferOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form id="edit-offer-form" onSubmit={handleUpdateOffer} className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* SECTION 1: OFFER DETAILS */}
              <div className="space-y-4">
                <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Offer Details</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Banner Title *</label>
                    <input
                      type="text"
                      required
                      value={editOfferForm.title}
                      onChange={(e) => setEditOfferForm({ ...editOfferForm, title: e.target.value })}
                      placeholder="e.g. Fresh Organic Harvest Sale"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Discount / Badge Text</label>
                    <input
                      type="text"
                      value={editOfferForm.discount_text}
                      onChange={(e) => setEditOfferForm({ ...editOfferForm, discount_text: e.target.value })}
                      placeholder="e.g. 30% OFF or FREE Shipping"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Description</label>
                  <textarea
                    rows={2}
                    value={editOfferForm.description}
                    onChange={(e) => setEditOfferForm({ ...editOfferForm, description: e.target.value })}
                    placeholder="Brief summary of the promotional offer..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* SECTION 2: BANNER IMAGE (URL OR UPLOAD WITH CROP & PREVIEW) */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Banner Image (URL or Upload)</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Banner Image URL (Mandatory - Min 1)</label>
                    <input
                      type="text"
                      value={editOfferForm.image_url}
                      onChange={(e) => setEditOfferForm({ ...editOfferForm, image_url: e.target.value })}
                      placeholder="https://images.unsplash.com/... or /uploads/..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[10px] text-slate-400">Direct image link or upload &amp; crop on right</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Or Upload Banner Image</label>
                    {editOfferForm.banner_image || editOfferForm.image_url ? (
                      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3 space-y-3 shadow-xs">
                        <div className="h-36 w-full rounded-xl overflow-hidden bg-white border border-slate-200/60 flex items-center justify-center p-2 shadow-inner">
                          <img
                            src={editOfferForm.banner_image || editOfferForm.image_url}
                            alt="Banner Upload"
                            className="max-h-full max-w-full object-contain rounded-lg"
                          />
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenCropper(editOfferForm.banner_image || editOfferForm.image_url, "edit")}
                            className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                          >
                            <Crop size={14} className="text-slate-500" />
                            <span>Crop</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditOfferForm({ ...editOfferForm, banner_image: "", image_url: "" })}
                            className="px-4 py-1.5 rounded-xl border border-red-500/80 bg-white hover:bg-red-50 text-red-600 font-bold text-xs shadow-xs transition"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-slate-200 hover:border-amber-500 bg-slate-50 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition text-center min-h-[110px]">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleOfferImageUpload(file, true);
                          }}
                        />
                        <div className="flex flex-col items-center gap-1.5 text-slate-500 font-semibold text-xs">
                          <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Upload size={16} />
                          </div>
                          <span>Click to upload new banner / drag &amp; drop</span>
                          <span className="text-[10px] text-slate-400">PNG, JPG, WebP supported</span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 3: NAVIGATION & CTA REDIRECTION */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Navigation &amp; CTA Redirection</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Action Target Type *</label>
                    <select
                      value={editOfferForm.action_type}
                      onChange={(e) => setEditOfferForm({ ...editOfferForm, action_type: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="CATEGORY">Store Category (Redirection)</option>
                      <option value="PRODUCT">Single Product (Redirection)</option>
                      <option value="EXTERNAL">External Web Link</option>
                      <option value="BROWSE">None / General Browse</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Button Label *</label>
                    <input
                      type="text"
                      required
                      value={editOfferForm.cta_label}
                      onChange={(e) => setEditOfferForm({ ...editOfferForm, cta_label: e.target.value })}
                      placeholder="Shop Now"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">
                      Redirection Category {editOfferForm.banner_type === "category_slide" ? "(Target Slide Category *)" : "(If Category Target)"}
                    </label>
                    <select
                      value={editOfferForm.category_id}
                      onChange={(e) => setEditOfferForm({ ...editOfferForm, category_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">— Select Category —</option>
                      {categories.map((c) => (
                        <option key={c.category_id} value={c.category_id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Redirection Product (If Product Target)</label>
                    <select
                      value={editOfferForm.action_value}
                      onChange={(e) => setEditOfferForm({ ...editOfferForm, action_value: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">— Select Product —</option>
                      {catalogProducts.map((p) => (
                        <option key={p.variant_id} value={p.product_id || p.variant_id}>
                          {p.product_name} - {p.variant_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 4: STYLING & ORDERING */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Styling &amp; Ordering</div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Banner Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editOfferForm.background_color}
                        onChange={(e) => setEditOfferForm({ ...editOfferForm, background_color: e.target.value })}
                        className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer p-1 bg-slate-50 shrink-0"
                      />
                      <input
                        type="text"
                        value={editOfferForm.background_color}
                        onChange={(e) => setEditOfferForm({ ...editOfferForm, background_color: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Display Sequence Order</label>
                    <input
                      type="number"
                      value={editOfferForm.display_order}
                      onChange={(e) => setEditOfferForm({ ...editOfferForm, display_order: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">Active Status</label>
                    <button
                      type="button"
                      onClick={() => setEditOfferForm({ ...editOfferForm, is_active: !editOfferForm.is_active })}
                      className={`w-full py-2.5 px-4 rounded-xl border font-bold flex items-center justify-between transition ${
                        editOfferForm.is_active
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                          : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}
                    >
                      <span>{editOfferForm.is_active ? "Active" : "Inactive"}</span>
                      {editOfferForm.is_active ? (
                        <ToggleRight size={22} className="text-[#16a34a]" />
                      ) : (
                        <ToggleLeft size={22} className="text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 5: BANNER PLACEMENT TYPE ABOVE PREVIEW */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wider text-slate-700 uppercase flex items-center gap-1.5">
                      <SlidersHorizontal size={13} className="text-amber-600" />
                      Banner Placement Type *
                    </span>
                    <span className="text-[11px] font-bold text-amber-700 capitalize bg-amber-100 px-2.5 py-0.5 rounded-full">
                      {editOfferForm.banner_type.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { type: "home_carousel", label: "Home Carousel", desc: "Top Home Slider", icon: Tag },
                      { type: "category_slide", label: "Category Slide", desc: "Targeted in Category", icon: FolderTree },
                      { type: "popup", label: "App Launch Popup", desc: "Modal On App Open", icon: Smartphone },
                      { type: "checkout_banner", label: "Checkout Promo", desc: "Cart & Pay Screens", icon: ShoppingBag },
                    ].map((b) => {
                      const isSelected = editOfferForm.banner_type === b.type;
                      const IconComp = b.icon;
                      return (
                        <button
                          key={b.type}
                          type="button"
                          onClick={() =>
                            setEditOfferForm({
                              ...editOfferForm,
                              banner_type: b.type as any,
                              is_popup: b.type === "popup",
                            })
                          }
                          className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                            isSelected
                              ? "bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 shadow-xs"
                              : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <IconComp size={16} className={isSelected ? "text-amber-600" : "text-slate-400"} />
                            {isSelected && <CheckCircle2 size={14} className="text-amber-600" />}
                          </div>
                          <div>
                            <div className="font-bold text-xs">{b.label}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{b.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* DYNAMIC LIVE BANNER PREVIEW ACCORDING TO TYPE */}
                <div className="space-y-1.5 pt-3 border-t border-slate-200/70">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Live Banner Rendering:</span>
                    <span className="text-[10px] text-amber-600 font-bold">Realtime Dynamic Preview</span>
                  </div>
                  <BannerVisualPreview
                    title={editOfferForm.title}
                    discount_text={editOfferForm.discount_text}
                    description={editOfferForm.description}
                    image_url={editOfferForm.banner_image || editOfferForm.image_url}
                    banner_type={editOfferForm.banner_type}
                    cta_label={editOfferForm.cta_label}
                    background_color={editOfferForm.background_color}
                    category_name={getCategoryName(editOfferForm.category_id)}
                  />
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditOfferOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-offer-form"
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md shadow-amber-600/20 transition flex items-center gap-2"
              >
                <Check size={16} />
                Update Offer Banner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3C: EDIT PROMOTION (WITH COMPLETE RULES, FLAGS & LIMITS) */}
      {/* ========================================================================= */}
      {isEditPromoOpen && editingPromo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Promotion</h3>
                  <p className="text-xs text-slate-500">Update discount engine rules, limits &amp; status for {editingPromo.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditPromoOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form id="edit-promo-form" onSubmit={handleUpdatePromo} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="font-bold text-slate-700">Promotion Name *</label>
                  <input
                    type="text"
                    required
                    value={editPromoForm.name}
                    onChange={(e) => setEditPromoForm({ ...editPromoForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="font-bold text-slate-700">Description</label>
                  <textarea
                    rows={2}
                    value={editPromoForm.description}
                    onChange={(e) => setEditPromoForm({ ...editPromoForm, description: e.target.value })}
                    placeholder="Brief description for customer facing banner or checkout..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Discount Type *</label>
                  <select
                    value={editPromoForm.promotion_type}
                    onChange={(e) => setEditPromoForm({ ...editPromoForm, promotion_type: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="percentage">Percentage Discount (%)</option>
                    <option value="fixed_amount">Fixed Amount Discount (₹)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">
                    Discount Value {editPromoForm.promotion_type === "percentage" ? "(%)" : "(₹)"} *
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.01"
                    required
                    value={editPromoForm.discount_value}
                    onChange={(e) => setEditPromoForm({ ...editPromoForm, discount_value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {editPromoForm.promotion_type === "percentage" && (
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700">Max Discount Amount Cap (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={editPromoForm.max_discount_amount}
                      onChange={(e) => setEditPromoForm({ ...editPromoForm, max_discount_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g. 100"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Min Order Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={editPromoForm.minimum_order_amount}
                    onChange={(e) => setEditPromoForm({ ...editPromoForm, minimum_order_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Usage Limit Per Customer</label>
                  <input
                    type="number"
                    min="1"
                    value={editPromoForm.usage_limit_per_customer}
                    onChange={(e) => setEditPromoForm({ ...editPromoForm, usage_limit_per_customer: parseInt(e.target.value) || 1 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Global Total Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={editPromoForm.usage_limit}
                    onChange={(e) => setEditPromoForm({ ...editPromoForm, usage_limit: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 1000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Promotion Status</label>
                  <select
                    value={editPromoForm.status}
                    onChange={(e) => setEditPromoForm({ ...editPromoForm, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              {/* Checkbox Promotion Rules & Flags */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-3">
                <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Promotion Rules &amp; Flags</span>
                  <span className="text-[10px] text-amber-700 font-bold">Eligibility Controls</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200 hover:border-amber-400 transition">
                    <input
                      type="checkbox"
                      checked={editPromoForm.auto_apply}
                      onChange={(e) => setEditPromoForm({ ...editPromoForm, auto_apply: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Auto Apply at Checkout</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200 hover:border-amber-400 transition">
                    <input
                      type="checkbox"
                      checked={editPromoForm.first_order_only}
                      onChange={(e) => setEditPromoForm({ ...editPromoForm, first_order_only: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>First Order Only (New User)</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200 hover:border-amber-400 transition">
                    <input
                      type="checkbox"
                      checked={editPromoForm.apply_to_all_products}
                      onChange={(e) => setEditPromoForm({ ...editPromoForm, apply_to_all_products: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Apply to All Products</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200 hover:border-amber-400 transition">
                    <input
                      type="checkbox"
                      checked={editPromoForm.stackable}
                      onChange={(e) => setEditPromoForm({ ...editPromoForm, stackable: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Stackable with Coupons</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200 hover:border-amber-400 transition sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={editPromoForm.allow_subscription_orders}
                      onChange={(e) => setEditPromoForm({ ...editPromoForm, allow_subscription_orders: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Allow on Subscription Orders</span>
                  </label>
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditPromoOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-promo-form"
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md shadow-amber-600/20 transition flex items-center gap-2"
              >
                <Check size={16} />
                Update Promotion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3D: EDIT COUPON */}
      {/* ========================================================================= */}
      {isEditCouponOpen && editingCoupon && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Coupon Code</h3>
                  <p className="text-xs text-slate-500">Update code settings for {editingCoupon.code}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditCouponOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form id="edit-coupon-form" onSubmit={handleUpdateCoupon} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Coupon Code</label>
                <input
                  type="text"
                  disabled
                  value={editCouponForm.code}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-mono font-bold uppercase cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Linked Promotion *</label>
                <select
                  required
                  value={editCouponForm.promotion_id}
                  onChange={(e) => setEditCouponForm({ ...editCouponForm, promotion_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {promotions.map((p) => (
                    <option key={p.promotion_id} value={p.promotion_id}>
                      {p.name} ({p.promotion_type === "percentage" ? `${p.discount_value}%` : `₹${p.discount_value}`})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Usage Limit (Total)</label>
                  <input
                    type="number"
                    min="1"
                    value={editCouponForm.usage_limit}
                    onChange={(e) => setEditCouponForm({ ...editCouponForm, usage_limit: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Per Customer Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={editCouponForm.usage_limit_per_customer}
                    onChange={(e) => setEditCouponForm({ ...editCouponForm, usage_limit_per_customer: parseInt(e.target.value) || 1 })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Status</label>
                <select
                  value={editCouponForm.status}
                  onChange={(e) => setEditCouponForm({ ...editCouponForm, status: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditCouponOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-coupon-form"
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md shadow-amber-600/20 transition flex items-center gap-2"
              >
                <Check size={16} />
                Update Coupon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: BANNER PREVIEW MOCKUP (SCREEN-FITTED DYNAMIC VIEW BY TYPE) */}
      {/* ========================================================================= */}
      {popupPreviewModalOpen && previewOffer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#16a34a] flex items-center justify-center font-bold">
                  <Eye size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Banner Live Rendering</h3>
                  <p className="text-[11px] text-slate-500 capitalize">
                    {(previewOffer.banner_type || (previewOffer.is_popup ? "popup" : "home_carousel")).replace('_', ' ')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPopupPreviewModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              <BannerVisualPreview
                title={previewOffer.title}
                discount_text={previewOffer.discount_text}
                description={previewOffer.description}
                image_url={previewOffer.image_url}
                banner_type={previewOffer.banner_type || (previewOffer.is_popup ? "popup" : "home_carousel")}
                cta_label={previewOffer.cta_label}
                background_color={previewOffer.background_color}
                category_name={getCategoryName(previewOffer.category_id)}
              />

              {/* Offer Info Metadata Card */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-medium text-slate-500">Action Type:</span>
                  <span className="font-bold text-slate-800">{previewOffer.action_type || "BROWSE"}</span>
                </div>
                {previewOffer.category_id && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-medium text-slate-500">Target Category:</span>
                    <span className="font-bold text-slate-800">{getCategoryName(previewOffer.category_id)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-medium text-slate-500">Display Order:</span>
                  <span className="font-bold text-slate-800">#{previewOffer.display_order}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-medium text-slate-500">Status:</span>
                  <span className={`font-bold ${previewOffer.is_active ? "text-emerald-600" : "text-slate-400"}`}>
                    {previewOffer.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setPopupPreviewModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: MANAGE TARGETED PRODUCTS */}
      {/* ========================================================================= */}
      {isManageProductsOpen && selectedPromoForProducts && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Boxes size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Targeted Products</h3>
                  <p className="text-xs text-slate-500">
                    {selectedPromoForProducts.name} ({selectedPromoForProducts.promotion_id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManageProductsOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Currently Linked Variants */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">Currently Linked Variants:</div>
                {selectedPromoForProducts.targeted_products && selectedPromoForProducts.targeted_products.length > 0 ? (
                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl p-2 bg-slate-50">
                    {selectedPromoForProducts.targeted_products.map((tp) => (
                      <div key={tp.variant_id} className="flex items-center justify-between p-2 hover:bg-white rounded-xl transition text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{tp.product_name} - {tp.variant_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{tp.variant_id} · ₹{tp.price}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveProductFromPromo(tp.variant_id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Remove Variant"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    No specific variants linked yet. All products apply if "Apply to All Products" is checked.
                  </div>
                )}
              </div>

              {/* Link New Variants */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700">Add Product Variants to Promotion:</div>
                  <div className="text-xs font-semibold text-purple-700">{selectedVariantIds.length} Selected</div>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search catalog products..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl p-2 bg-white">
                  {catalogProducts
                    .filter((cp) =>
                      cp.product_name?.toLowerCase().includes(productSearch.toLowerCase()) ||
                      cp.variant_name?.toLowerCase().includes(productSearch.toLowerCase()) ||
                      cp.variant_id?.toLowerCase().includes(productSearch.toLowerCase())
                    )
                    .map((cp) => {
                      const isSelected = selectedVariantIds.includes(cp.variant_id);
                      const isAlreadyLinked = selectedPromoForProducts.targeted_products?.some(
                        (tp) => tp.variant_id === cp.variant_id
                      );

                      return (
                        <div
                          key={cp.variant_id}
                          onClick={() => {
                            if (isAlreadyLinked) return;
                            if (isSelected) {
                              setSelectedVariantIds(selectedVariantIds.filter((id) => id !== cp.variant_id));
                            } else {
                              setSelectedVariantIds([...selectedVariantIds, cp.variant_id]);
                            }
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition text-xs ${
                            isAlreadyLinked
                              ? "opacity-40 cursor-not-allowed bg-slate-50"
                              : isSelected
                              ? "bg-purple-50 border border-purple-200 text-purple-900"
                              : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div>
                            <div className="font-bold">{cp.product_name} - {cp.variant_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{cp.variant_id} · ₹{cp.price}</div>
                          </div>
                          {isAlreadyLinked ? (
                            <span className="text-[10px] font-bold text-slate-400">Already Added</span>
                          ) : isSelected ? (
                            <CheckCircle2 size={16} className="text-purple-600" />
                          ) : (
                            <Plus size={16} className="text-slate-400" />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsManageProductsOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition text-xs"
              >
                Done
              </button>
              <button
                type="button"
                disabled={selectedVariantIds.length === 0}
                onClick={handleAddProductsToPromo}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-md shadow-purple-600/20 transition flex items-center gap-2 text-xs"
              >
                <Plus size={16} />
                Link {selectedVariantIds.length} Variants
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: VIEW REDEMPTIONS */}
      {/* ========================================================================= */}
      {isRedemptionsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 my-auto overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Claimed Redemptions</h3>
                  <p className="text-xs text-slate-500">{redemptionsTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setIsRedemptionsOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {loadingRedemptions ? (
                <div className="p-12 text-center text-xs text-slate-400">Loading redemptions...</div>
              ) : redemptionsData.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">No redemptions claimed yet.</div>
              ) : (
                <div className="overflow-x-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold">
                      <tr>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Order ID</th>
                        <th className="p-3">Discount</th>
                        <th className="p-3 text-right">Redeemed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {redemptionsData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/60">
                          <td className="p-3 font-semibold text-slate-800">
                            {r.first_name ? `${r.first_name} ${r.last_name || ""}` : r.customer_id}
                            {r.phone && <div className="text-[10px] text-slate-400">{r.phone}</div>}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">{r.order_id}</td>
                          <td className="p-3 font-bold text-[#16a34a]">₹{Number(r.discount_amount)}</td>
                          <td className="p-3 text-right text-slate-400 text-[11px]">
                            {r.redeemed_at ? new Date(r.redeemed_at).toLocaleString("en-IN") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsRedemptionsOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                Close Redemptions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: IMAGE CROPPER MODAL (FREE & RATIO BASED) */}
      {/* ========================================================================= */}
      <BannerCropperModal
        isOpen={cropperOpen}
        imageUrl={cropperImageSrc}
        onClose={() => setCropperOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
