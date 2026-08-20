"use client";

import { useEffect } from "react";

export default function ChunkLoadRecovery() {
  useEffect(() => {
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const error = "error" in event ? event.error : event.reason;
      const message = error?.message || String(error || "");

      const isChunkError =
        message.includes("Loading chunk") ||
        message.includes("ChunkLoadError") ||
        message.includes("Failed to load chunk") ||
        message.includes("loading CSS chunk");

      if (isChunkError) {
        const lastReload = sessionStorage.getItem("chunk_reload_timestamp");
        const now = Date.now();
        // Prevent infinite reload loop by checking if we reloaded within the last 10 seconds
        if (!lastReload || now - Number(lastReload) > 10000) {
          sessionStorage.setItem("chunk_reload_timestamp", String(now));
          window.location.reload();
        }
      }
    };

    window.addEventListener("error", handleChunkError);
    window.addEventListener("unhandledrejection", handleChunkError);

    return () => {
      window.removeEventListener("error", handleChunkError);
      window.removeEventListener("unhandledrejection", handleChunkError);
    };
  }, []);

  return null;
}
