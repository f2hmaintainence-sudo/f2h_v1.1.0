// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : client-config.ts
// Description : Server-driven client configuration. Keys live in the
//               `api_integrations_config` table and are served by
//               GET /api/v1/device/client-config, so rotating one is an admin
//               edit rather than a rebuild.
//
// ============================================================================

"use client"

import { useEffect, useState } from "react"
import { getApiBaseUrl } from "./api-config"

/** The client-public slice of the integrations table. */
export interface ClientConfig {
  googleMapsApiKey: string
  googleClientId: string
  razorpayKeyId: string
}

/**
 * Environment fallbacks.
 *
 * These exist only so a first paint (or an API outage) still renders a map
 * rather than an error card. The database is the source of truth — when both
 * disagree, the served value wins on the next fetch.
 */
const FALLBACK: ClientConfig = {
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
}

/** One in-flight request per page load, shared by every caller. */
let pending: Promise<ClientConfig> | null = null
let resolved: ClientConfig | null = null

/**
 * Fetches the config once per page load.
 *
 * The endpoint is public — it only ever returns values that are already shipped
 * to browsers and mobile binaries (map key, OAuth client id, Razorpay key id).
 * Nothing here is a secret; the client secret and private keys stay server-side.
 */
export function getClientConfig(): Promise<ClientConfig> {
  if (resolved) return Promise.resolve(resolved)
  if (pending) return pending

  pending = fetch(`${getApiBaseUrl()}/device/client-config`, {
    credentials: "include",
  })
    .then((response) => {
      if (!response.ok) throw new Error(`client-config responded ${response.status}`)
      return response.json()
    })
    .then((body) => {
      const data = body?.data ?? body ?? {}
      const config: ClientConfig = {
        googleMapsApiKey: data.google_maps?.apiKey || FALLBACK.googleMapsApiKey,
        googleClientId:
          data.google_oauth?.serverClientId ||
          data.google_oauth?.webClientId ||
          FALLBACK.googleClientId,
        razorpayKeyId: data.razorpay?.keyId || FALLBACK.razorpayKeyId,
      }
      resolved = config
      return config
    })
    .catch((error) => {
      console.warn("[client-config] falling back to build-time values:", error)
      pending = null // a later caller may succeed
      return FALLBACK
    })

  return pending
}

/**
 * Config for rendering. Starts at the build-time fallback so the first paint is
 * never blank, then re-renders once the served values arrive.
 */
export function useClientConfig(): ClientConfig {
  const [config, setConfig] = useState<ClientConfig>(resolved ?? FALLBACK)

  useEffect(() => {
    let active = true
    getClientConfig().then((next) => {
      if (active) setConfig(next)
    })
    return () => {
      active = false
    }
  }, [])

  return config
}
