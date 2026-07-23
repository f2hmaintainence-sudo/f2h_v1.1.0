"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { EyebrowPill } from "./EyebrowPill";

// ── URL Parser ─────────────────────────────────────────────────────────────────
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /\/shorts\/([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /[?&]v=([a-zA-Z0-9_-]+)/,
    /\/embed\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function getThumbnailUrl(videoId: string): string {
  // hqdefault is the most reliable across Shorts and regular videos
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function getEmbedUrl(videoId: string, origin: string): string {
  // autoplay=1 here is intentional — it only fires AFTER user clicks the play button
  // mute=0 so the video plays with sound (user-initiated)
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&playsinline=1&enablejsapi=1&origin=${origin}&rel=0&modestbranding=1`;
}

// ── Video List ─────────────────────────────────────────────────────────────────
const VIDEO_URLS = [
  "https://www.youtube.com/shorts/rG52RiXv2Lg",
  "https://youtu.be/40TeHamw_5c",
  "https://youtu.be/lQNFZaKHhdQ",
  "https://www.youtube.com/shorts/6QRBkSZSbY8",
];

// ── Main Component ─────────────────────────────────────────────────────────────
export function CustomerVideoReviews() {
  const autoplayPlugin = useRef(
    Autoplay({ delay: 3500, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center", skipSnaps: false },
    [autoplayPlugin.current]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  // playingIndex: which card the user has clicked play on; null = none playing
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const newIndex = emblaApi.selectedScrollSnap();
    setSelectedIndex(newIndex);
    // When slide changes, stop any playing video and resume carousel auto-sliding
    setPlayingIndex((prev) => {
      if (prev !== null && prev !== newIndex) {
        autoplayPlugin.current.play();
        return null;
      }
      return prev;
    });
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const handlePlay = useCallback(
    (index: number) => {
      // Snap to card if not already centered
      if (emblaApi && index !== selectedIndex) {
        emblaApi.scrollTo(index);
      }
      // Stop carousel auto-sliding while video is playing
      autoplayPlugin.current.stop();
      setPlayingIndex(index);
    },
    [emblaApi, selectedIndex]
  );

  const videoIds = VIDEO_URLS.map(getYouTubeId);

  return (
    <section className="relative py-20 px-4 overflow-hidden bg-gradient-to-b from-[#f9f6ef] to-white isolate">
      {/* Background decorations */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#2d8a45]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#f0a500]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-14"
        >
          <div className="flex justify-center mb-4">
            <EyebrowPill label="Voice of Customers" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0d3d1a] tracking-tight">
            Hear What Our{" "}
            <em className="not-italic text-[#2d8a45]">Families Say</em>
          </h2>
          <div className="mx-auto mt-4 h-px w-20 rounded-full bg-gradient-to-r from-transparent via-[#2d8a45]/40 to-transparent" />
          <p className="mt-5 max-w-2xl mx-auto text-[#3a5c42] text-sm sm:text-base leading-relaxed">
            Real stories from our happy customers.
          </p>
        </motion.div>

        {/* Carousel — edge fade mask for premium feel */}
        <div
          className="relative max-w-full mx-auto"
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
            maskImage:
              "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
          }}
        >
          <div
            className="overflow-hidden py-8"
            ref={emblaRef}
          >
            <div
              className="flex -ml-4"
              style={{ backfaceVisibility: "hidden", touchAction: "pan-y" }}
            >
              {videoIds.map((videoId, index) => {
                const isCenter = index === selectedIndex;
                const isPlaying = index === playingIndex;

                return (
                  <div
                    key={index}
                    className="flex-[0_0_82%] sm:flex-[0_0_60%] md:flex-[0_0_42%] lg:flex-[0_0_34%] pl-4 min-w-0 flex justify-center"
                  >
                    <VideoCard
                      videoId={videoId}
                      index={index}
                      isCenter={isCenter}
                      isPlaying={isPlaying}
                      origin={origin}
                      onPlay={handlePlay}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {videoIds.map((_, index) => (
            <button
              key={index}
              aria-label={`Go to video ${index + 1}`}
              onClick={() => emblaApi?.scrollTo(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === selectedIndex
                  ? "w-6 bg-[#2d8a45]"
                  : "w-2 bg-[#2d8a45]/30"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Video Card ─────────────────────────────────────────────────────────────────
interface VideoCardProps {
  videoId: string | null;
  index: number;
  isCenter: boolean;
  isPlaying: boolean;
  origin: string;
  onPlay: (index: number) => void;
}

function VideoCard({
  videoId,
  index,
  isCenter,
  isPlaying,
  origin,
  onPlay,
}: VideoCardProps) {
  return (
    <motion.div
      animate={{
        scale: isCenter ? 1 : 0.85,
        opacity: isCenter ? 1 : 0.45,
        y: isCenter ? 0 : 12,
      }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={`relative w-full max-w-[300px] aspect-[9/16] rounded-[2rem] overflow-hidden bg-gray-900 border border-black/10 ${
        isCenter
          ? "shadow-[0_24px_60px_rgba(45,138,69,0.22)] z-10"
          : "z-0 shadow-xl"
      }`}
    >
      {!videoId ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <div className="w-14 h-14 rounded-full bg-[#2d8a45]/15 flex items-center justify-center mb-3 text-2xl">
            🎥
          </div>
          <p className="text-sm font-bold text-white/70">Coming Soon</p>
        </div>
      ) : isPlaying ? (
        /* ── Playing state: render iframe ONLY after user clicks ── */
        <iframe
          // Dynamic key forces a fresh mount when play is requested (fixes stuck iframes)
          key={`playing-${index}-${videoId}`}
          className="absolute inset-0 w-full h-full"
          src={getEmbedUrl(videoId, origin)}
          title={`Customer Review ${index + 1}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        /* ── Idle state: thumbnail + play button overlay ── */
        <button
          type="button"
          aria-label={`Play customer review ${index + 1}`}
          onClick={() => onPlay(index)}
          className="absolute inset-0 w-full h-full group"
        >
          {/* Thumbnail image */}
          <img
            src={getThumbnailUrl(videoId)}
            alt={`Customer review thumbnail ${index + 1}`}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.93 }}
              className="w-16 h-16 rounded-full bg-white/90 shadow-xl flex items-center justify-center"
            >
              {/* Classic play triangle */}
              <svg
                className="w-6 h-6 text-[#0d3d1a] ml-1"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </motion.div>
          </div>

          {/* Label */}
          <div className="absolute bottom-4 inset-x-0 flex justify-center">
            <span className="bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
              Tap to Play
            </span>
          </div>
        </button>
      )}

      {/* Sparkle accent on active card */}
      {isCenter && !isPlaying && videoId && (
        <div className="pointer-events-none absolute -top-3 -right-3 text-3xl z-20 opacity-90 animate-pulse">
          ✨
        </div>
      )}
    </motion.div>
  );
}

export default CustomerVideoReviews;
