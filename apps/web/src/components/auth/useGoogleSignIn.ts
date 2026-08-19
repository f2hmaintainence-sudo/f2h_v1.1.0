// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : useGoogleSignIn.ts
// Description : Browser half of Google Sign-In. Obtains an authorization code
//               from Google Identity Services and hands it to the API, which
//               is the only side holding the client secret.
//
// ============================================================================

"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const GIS_SRC = "https://accounts.google.com/gsi/client"

/**
 * Google Identity Services, loaded from the script above. Only the two members
 * this hook uses are declared — the full surface is large and irrelevant here.
 */
interface CodeClient {
  requestCode: () => void
}
interface GoogleIdentityServices {
  accounts: {
    oauth2: {
      initCodeClient: (config: {
        client_id: string
        scope: string
        ux_mode: "popup"
        callback: (response: { code?: string; error?: string }) => void
        error_callback?: (error: { type?: string }) => void
      }) => CodeClient
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentityServices
  }
}

/** Resolves once the GIS script is on the page; shared across every caller. */
let gisLoader: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.google?.accounts?.oauth2) return Promise.resolve()

  if (!gisLoader) {
    gisLoader = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
      if (existing) {
        existing.addEventListener("load", () => resolve())
        existing.addEventListener("error", () => reject(new Error("Google script failed to load")))
        return
      }
      const script = document.createElement("script")
      script.src = GIS_SRC
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => {
        gisLoader = null // let a later attempt retry rather than fail forever
        reject(new Error("Google script failed to load"))
      }
      document.head.appendChild(script)
    })
  }
  return gisLoader
}

export interface UseGoogleSignIn {
  /** Opens the Google chooser. Resolves to the authorization code, or null if dismissed. */
  requestCode: () => Promise<string | null>
  /** False when NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset — hide the button rather than fail on click. */
  isConfigured: boolean
  /** True while the popup is open. */
  isPending: boolean
}

/**
 * The code (not the id_token) flow is deliberate: in a browser, the code is the
 * only credential the API can verify end-to-end, because exchanging it requires
 * the client secret that never leaves the server. The API's exchange tries the
 * literal `postmessage` redirect URI first, which is what a popup code client
 * issues its code against.
 */
export function useGoogleSignIn(): UseGoogleSignIn {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""
  const [isPending, setIsPending] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Warm the script up so the first click opens the popup without a delay —
  // browsers block popups opened long after the originating gesture.
  useEffect(() => {
    if (clientId) loadGis().catch(() => {})
  }, [clientId])

  const requestCode = useCallback(async (): Promise<string | null> => {
    if (!clientId) throw new Error("Google Sign-In is not configured")

    await loadGis()
    const oauth2 = window.google?.accounts?.oauth2
    if (!oauth2) throw new Error("Google Sign-In is unavailable right now")

    setIsPending(true)
    try {
      return await new Promise<string | null>((resolve, reject) => {
        const client = oauth2.initCodeClient({
          client_id: clientId,
          scope: "openid email profile",
          ux_mode: "popup",
          callback: (response) => {
            if (response.code) resolve(response.code)
            // Google reports a closed popup as an error here on some browsers.
            else if (response.error === "access_denied") resolve(null)
            else reject(new Error(response.error || "Google returned no authorization code"))
          },
          // Dismissing the chooser is not a failure — it is "nothing happened".
          error_callback: (error) =>
            error?.type === "popup_closed" || error?.type === "popup_failed_to_open"
              ? resolve(null)
              : reject(new Error("Google Sign-In could not be completed")),
        })
        client.requestCode()
      })
    } finally {
      if (mounted.current) setIsPending(false)
    }
  }, [clientId])

  return { requestCode, isConfigured: Boolean(clientId), isPending }
}
