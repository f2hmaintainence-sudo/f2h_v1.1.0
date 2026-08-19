// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Component   : ImageCropperModal.tsx
// Description : Advanced Free & Ratio-Based Image Cropper with Realtime Canvas Export
// ============================================================================

"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Crop, RotateCw, ZoomIn, ZoomOut, Check, X,
  RefreshCw, Maximize, Move, CheckCircle2
} from "lucide-react";

export type AspectRatioType = "free" | "16:9" | "4:3" | "1:1" | "21:9" | "3:2";

interface ImageCropperModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
}

const RATIO_OPTIONS: { id: AspectRatioType; label: string; ratio?: number; desc: string }[] = [
  { id: "free", label: "Free Crop", desc: "Custom unconstrained crop" },
  { id: "16:9", label: "16:9", ratio: 16 / 9, desc: "Home Banner & Slide" },
  { id: "4:3", label: "4:3", ratio: 4 / 3, desc: "Standard Hero" },
  { id: "1:1", label: "1:1 Square", ratio: 1, desc: "Square Thumbnail" },
  { id: "21:9", label: "21:9 Ultra", ratio: 21 / 9, desc: "Wide Header Strip" },
  { id: "3:2", label: "3:2", ratio: 3 / 2, desc: "Classic Card" },
];

export default function ImageCropperModal({
  isOpen,
  imageUrl,
  onClose,
  onCropComplete,
}: ImageCropperModalProps) {
  const [selectedRatio, setSelectedRatio] = useState<AspectRatioType>("16:9");
  const [rotation, setRotation] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [imageLoaded, setImageLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Normalized crop box [0..1] relative to displayed image
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0.1,
    y: 0.1,
    w: 0.8,
    h: 0.8,
  });

  const dragRef = useRef<{
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

  // Calculate default crop box when ratio or image changes
  const applyRatioCrop = useCallback(
    (ratioId: AspectRatioType) => {
      setSelectedRatio(ratioId);
      if (!imageRef.current) return;

      const imgWidth = imageRef.current.clientWidth;
      const imgHeight = imageRef.current.clientHeight;
      if (!imgWidth || !imgHeight) return;

      if (ratioId === "free") {
        setCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
        return;
      }

      const targetRatio = RATIO_OPTIONS.find((r) => r.id === ratioId)?.ratio || 16 / 9;
      const imageDisplayRatio = imgWidth / imgHeight;

      let w = 0.85;
      let h = 0.85;

      if (targetRatio > imageDisplayRatio) {
        // Target is wider than image
        w = 0.9;
        const targetHeightPx = (w * imgWidth) / targetRatio;
        h = Math.min(0.95, targetHeightPx / imgHeight);
      } else {
        // Target is taller than image
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

  const handleImageLoad = () => {
    setImageLoaded(true);
    applyRatioCrop(selectedRatio);
  };

  useEffect(() => {
    if (isOpen) {
      setImageLoaded(false);
      setRotation(0);
      setZoom(1);
    }
  }, [isOpen, imageUrl]);

  // Pointer drag handling for moving and resizing crop box
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
    const activeRatio = RATIO_OPTIONS.find((r) => r.id === selectedRatio)?.ratio;

    if (mode === "move") {
      newCrop.x = Math.min(Math.max(0, startCrop.x + deltaX), 1 - startCrop.w);
      newCrop.y = Math.min(Math.max(0, startCrop.y + deltaY), 1 - startCrop.h);
    } else {
      let dx = deltaX;
      let dy = deltaY;

      // Handle corner and edge resizing
      if (mode.includes("e")) {
        newCrop.w = Math.min(Math.max(0.1, startCrop.w + dx), 1 - startCrop.x);
      }
      if (mode.includes("s")) {
        newCrop.h = Math.min(Math.max(0.1, startCrop.h + dy), 1 - startCrop.y);
      }
      if (mode.includes("w")) {
        const potentialW = Math.max(0.1, startCrop.w - dx);
        if (startCrop.x + startCrop.w - potentialW >= 0) {
          newCrop.w = potentialW;
          newCrop.x = startCrop.x + startCrop.w - potentialW;
        }
      }
      if (mode.includes("n")) {
        const potentialH = Math.max(0.1, startCrop.h - dy);
        if (startCrop.y + startCrop.h - potentialH >= 0) {
          newCrop.h = potentialH;
          newCrop.y = startCrop.y + startCrop.h - potentialH;
        }
      }

      // Constrain aspect ratio if not in free mode
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
      } catch (err) {
        // Ignore
      }
      dragRef.current.mode = null;
    }
  };

  // Perform Final Crop on Canvas and Export DataURL
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

      // Extract pixel coordinates from normalized crop values
      const cropX = Math.round(crop.x * natW);
      const cropY = Math.round(crop.y * natH);
      const cropW = Math.round(crop.w * natW);
      const cropH = Math.round(crop.h * natH);

      // Handle rotation if any
      const isRotated90or270 = rotation % 180 !== 0;
      canvas.width = isRotated90or270 ? cropH : cropW;
      canvas.height = isRotated90or270 ? cropW : cropH;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      const drawW = isRotated90or270 ? canvas.height : canvas.width;
      const drawH = isRotated90or270 ? canvas.width : canvas.height;

      ctx.drawImage(
        naturalImg,
        cropX,
        cropY,
        cropW,
        cropH,
        -drawW / 2,
        -drawH / 2,
        drawW,
        drawH
      );
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
        {/* Modal Header */}
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
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Aspect Ratio Selector Pills */}
        <div className="p-3 sm:px-6 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto shrink-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap mr-1 flex items-center gap-1">
            <Maximize size={12} /> Aspect Ratio:
          </span>
          {RATIO_OPTIONS.map((opt) => {
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

        {/* Main Crop Canvas Area */}
        <div
          ref={containerRef}
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
                onLoad={handleImageLoad}
                style={{
                  transform: `rotate(${rotation}deg) scale(${zoom})`,
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
                  {/* Rule of Thirds Grid Lines */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                    <div className="border-r border-b border-white/70" />
                    <div className="border-r border-b border-white/70" />
                    <div className="border-b border-white/70" />
                    <div className="border-r border-b border-white/70" />
                    <div className="border-r border-b border-white/70" />
                    <div className="border-b border-white/70" />
                    <div className="border-r border-white/70" />
                    <div className="border-r border-white/70" />
                    <div />
                  </div>

                  {/* Move Icon in Center */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
                    <div className="p-1.5 rounded-full bg-black/40 text-white">
                      <Move size={16} />
                    </div>
                  </div>

                  {/* Corner Handles */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, "nw")}
                    className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-xs cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, "ne")}
                    className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-xs cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, "sw")}
                    className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-xs cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, "se")}
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-xs cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                  />

                  {/* Edge Handles */}
                  <div
                    onPointerDown={(e) => handlePointerDown(e, "n")}
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-2.5 bg-white/90 border border-emerald-600 rounded-full cursor-ns-resize"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, "s")}
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-2.5 bg-white/90 border border-emerald-600 rounded-full cursor-ns-resize"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, "w")}
                    className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-6 bg-white/90 border border-emerald-600 rounded-full cursor-ew-resize"
                  />
                  <div
                    onPointerDown={(e) => handlePointerDown(e, "e")}
                    className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-6 bg-white/90 border border-emerald-600 rounded-full cursor-ew-resize"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Controls & Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          {/* Zoom and Rotate controls */}
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
                setZoom(1);
                applyRatioCrop(selectedRatio);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <RefreshCw size={14} />
              <span>Reset</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition text-xs"
            >
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
