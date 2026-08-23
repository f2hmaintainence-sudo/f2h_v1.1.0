// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : LoginClient.tsx
// Description : Login client component for admin panel auth
//
// ============================================================================

"use client"

import React, { useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { FaEnvelope, FaPhone, FaLock, FaEye, FaEyeSlash } from "react-icons/fa"
import { showErrorToast, showSuccessToast } from "../../../components/Toast"
import { fingerprintService } from "../../../services/fingerprint.service"
import { api } from "../../../services/api.client"
import { getHomeForRole } from "../../../context/AuthContext"
import AuthFlipCard, { SOCIAL, Spinner } from "../../../components/AuthFlipCard/AuthFlipCard"
import { useAlert } from "../../../context/AlertContext"
import { useGoogleSignIn } from "../../../components/auth/useGoogleSignIn"

interface LoginResponse {
  message: string;
  user: { user_id: string; email: string; role_id?: string };
  cache_ready: boolean;
}
interface MeResponse {
  active_role: string;
}

const gradientTextStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #2d8a45 0%, #f0a500 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

// ─────────────────────────────────────────────
// Validators — aligned with backend LoginDto
// LoginDto: identifier MaxLength(255), password MaxLength(128)
// ─────────────────────────────────────────────
const VALIDATORS = {
  identifier: (v: string) => {
    const s = v.trim()
    if (!s) return "Email or phone is required."
    if (s.length > 255) return "Identifier too long."
    // Phone: optional leading + then 10-15 digits
    const isPhone = /^\+?\d{10,15}$/.test(s)
    if (isPhone) return null
    const isEmail = s.includes("@") && /\.[a-zA-Z]/.test(s.split("@")[1] ?? "")
    if (isEmail) {
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9._%+\-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(s))
        return "Please enter a valid email (e.g. name@example.com)."
      if (/\.{2,}/.test(s)) return "Email must not contain consecutive dots."
    } else {
      if (s.length < 3) return "Must be at least 3 characters."
      if (s.length > 30) return "Must not exceed 30 characters."
      if (!/^[a-zA-Z0-9._@\-]+$/.test(s)) return "Can only contain letters, digits, . _ @ -"
      if (/^[._\-@]/.test(s)) return "Cannot start with . _ - or @"
      if (/[._\-@]$/.test(s)) return "Cannot end with . _ - or @"
      if (/[._\-@]{2,}/.test(s)) return "Cannot contain consecutive special characters."
    }
    return null
  },
  password: (v: string) => {
    if (!v) return "Password is required."
    if (v.length < 6) return "Password must be at least 6 characters."
    if (v.length > 128) return "Password must not exceed 128 characters."  // matches backend MaxLength(128)
    if (/^\s+$/.test(v)) return "Password cannot be only spaces."
    return null
  },
} as const

type Field = keyof typeof VALIDATORS

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const CONTROL_KEYS = new Set([
  "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab", "Enter",
])

const setNativeValue = (el: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, value)
  el.dispatchEvent(new Event("input", { bubbles: true }))
}

// ─────────────────────────────────────────────
// Input guards
// ─────────────────────────────────────────────
function identifierKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const { key, currentTarget: el, ctrlKey, metaKey } = e
  if (CONTROL_KEYS.has(key) || ctrlKey || metaKey || key.length > 1) return
  if (key === " ") { e.preventDefault(); return }
  // Allow + only at the very start (international phone prefix)
  if (key === "+") {
    if (el.selectionStart !== 0) { e.preventDefault(); return }
    return
  }
  if (!/^[a-zA-Z0-9@._\-]$/.test(key)) { e.preventDefault(); return }
  if (key === "@" && el.value.includes("@")) { e.preventDefault(); return }
  const beforeCursor = el.value.slice(0, el.selectionStart ?? 0)
  if (key === "." && beforeCursor.endsWith(".")) { e.preventDefault(); return }
  // For pure-digit (phone) input allow starting with digit
  const looksLikePhone = /^\+?\d*$/.test(el.value)
  if (el.value.length === 0 && !looksLikePhone && /^[^a-zA-Z0-9+]$/.test(key)) { e.preventDefault(); return }
  if (beforeCursor.endsWith("@") && /^[^a-zA-Z0-9]$/.test(key)) { e.preventDefault(); return }
}

function identifierPaste(e: React.ClipboardEvent<HTMLInputElement>) {
  e.preventDefault()
  const raw = e.clipboardData.getData("text").replace(/\s/g, "")
  // If pasted text looks like a phone number, keep only digits and leading +
  if (/^\+?\d{10,15}$/.test(raw)) {
    setNativeValue(e.currentTarget, raw.slice(0, 15))
    return
  }
  const pasted = raw
    .replace(/[^a-zA-Z0-9@._+\-]/g, "")
    .slice(0, 255)
  if (!pasted) return
  const el = e.currentTarget
  const { selectionStart: s = 0, selectionEnd: end = 0, value } = el
  let finalText = value.slice(0, s!) + pasted + value.slice(end!)
  const atIdx = finalText.indexOf("@")
  if (atIdx !== -1)
    finalText = finalText.slice(0, atIdx + 1) + finalText.slice(atIdx + 1).replace(/@/g, "")
  setNativeValue(el, finalText.replace(/\.{2,}/g, "."))
}

function passwordKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const { key, currentTarget: el, ctrlKey, metaKey } = e
  if (CONTROL_KEYS.has(key) || ctrlKey || metaKey || key.length > 1) return
  if (key === " ") { e.preventDefault(); return }
  if (!/^[\x20-\x7E]$/.test(key)) { e.preventDefault(); return }
  if (el.value.length >= 128 && el.selectionStart === el.selectionEnd) e.preventDefault() // matches backend MaxLength(128)
}

function passwordPaste(e: React.ClipboardEvent<HTMLInputElement>) {
  e.preventDefault()
  const pasted = e.clipboardData.getData("text")
    .replace(/\s/g, "")
    .replace(/[^\x21-\x7E]/g, "")
    .slice(0, 128) // matches backend MaxLength(128)
  if (!pasted) return
  const el = e.currentTarget
  const { selectionStart: s = 0, selectionEnd: end = 0, value } = el
  setNativeValue(el, (value.slice(0, s!) + pasted + value.slice(end!)).slice(0, 128))
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export function LoginContent() {
  const { showAlert } = useAlert()
  const router = useRouter()
  const searchParams = useSearchParams()
  const googleSignIn = useGoogleSignIn()

  const identifierRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token")
      if (token) {
        api.get<any>("/users/me").then(({ data: me }) => {
          if (me) {
            const userHasAdmin = me?.roles?.some((r: any) => (r.role_name || r.role_id || '').toUpperCase() === 'ADMIN')
            const role = (me?.active_role || (userHasAdmin ? "ADMIN" : "")).toUpperCase().trim()
            if (!["CUSTOMER", "DELIVERY_PARTNER", "DELIVERY_BOY"].includes(role)) {
              router.replace(getHomeForRole(role))
            }
          }
        }).catch(() => {})
      }
    }
  }, [router])

  const setError = (field: Field, msg: string | null) =>
    setErrors(prev => ({ ...prev, [field]: msg ?? undefined }))

  const handleBlur = (field: Field, value: string) =>
    setError(field, VALIDATORS[field](value) ?? null)

  const validateAll = () => {
    const idErr = VALIDATORS.identifier(identifier)
    const pwErr = VALIDATORS.password(password)
    setErrors({ identifier: idErr ?? undefined, password: pwErr ?? undefined })
    return !idErr && !pwErr
  }

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateAll()) return
    setIsLoading(true)
    try {
      // 🔍 Generate device fingerprint — sent to backend LoginDto.fingerprintData
      console.log('[LoginClient] Collecting device fingerprint...')
      const fingerprintData = await fingerprintService.generateFingerprint()
      console.log('[LoginClient] Fingerprint collected:', fingerprintData)

      const { data, error, status } = await api.post<LoginResponse>("/auth/login", {
        identifier,
        password,
        fingerprintData, //matches LoginDto.fingerprintData (optional)
      })

      if (error || !data) {
        let msg = error || "Login failed"
        if (status === 429) msg = "Too many login attempts. Please try again later."
        else if (status === 403) msg = error || "Account is locked. Please try again later."
        else if (status === 401) msg = error || "Invalid email/username or password"
        showAlert("Login Failed", msg, "error")
        setIsLoading(false)
        return
      }

      await establishSession(data)
    } catch (err) {
      console.error("[Login] Catch error:", err)
      showErrorToast("Unable to connect to server. Please check your connection.", 5000)
      setIsLoading(false)
    }
  }

  /**
   * Turns a successful auth response into a session and sends the user on.
   *
   * Shared by password login and Google Sign-In: both hit the same role gate,
   * because this panel is admin-only and the Google endpoint will happily
   * authenticate a customer.
   */
  const establishSession = async (data: LoginResponse) => {
    const authData = data as any
    if (authData.accessToken && typeof window !== 'undefined') {
      localStorage.setItem("access_token", authData.accessToken)
      if (authData.refreshToken) localStorage.setItem("refresh_token", authData.refreshToken)
      document.cookie = `access_token=${authData.accessToken}; path=/; max-age=86400`
    }

    // Check role returned from login endpoint
    const userRole = (data.user?.role_id || "").toUpperCase().trim()
    if (["CUSTOMER", "DELIVERY_PARTNER", "DELIVERY_BOY"].includes(userRole)) {
      showAlert("Login Failed", "Customers and Delivery Partners are not authorized to access the Admin Panel.", "error")
      setIsLoading(false)
      return
    }

    const redirectTo = searchParams.get("redirect")
    console.log("[Login] Successful login. Redirecting to:", redirectTo || "Dashboard")

    if (redirectTo) {
      router.push(redirectTo)
      return
    }

    // Fetch active role to redirect to the correct panel
    console.log("[Login] Fetching user profile...")
    const { data: me, error: meError } = await api.get<any>("/users/me")

    if (meError || !me) {
      console.error("[Login] Failed to fetch user profile after login:", meError)
      router.push("/login") // Fallback to login if profile fetch fails
      return
    }

    const userHasAdmin = me?.roles?.some((r: any) => (r.role_name || r.role_id || '').toUpperCase() === 'ADMIN')
    console.log("[Login] User profile fetched. isAdmin:", userHasAdmin)

    // Use active_role if set, otherwise fallback based on admin status
    const role = (me?.active_role || (userHasAdmin ? "ADMIN" : "")).toUpperCase().trim()
    if (["CUSTOMER", "DELIVERY_PARTNER", "DELIVERY_BOY"].includes(role)) {
      showAlert("Login Failed", "Customers and Delivery Partners are not authorized to access the Admin Panel.", "error")
      setIsLoading(false)
      return
    }

    console.log("[Login] Final redirect role:", role)

    const destination = getHomeForRole(role)
    console.log("[Login] Pushing to destination:", destination)
    router.push(destination)
  }

  /**
   * Google Sign-In. The browser only ever holds an authorization code; the API
   * exchanges it with the client secret and returns the same payload as a
   * password login, so the session handling below is identical.
   */
  const loginWithGoogle = async () => {
    setIsLoading(true)
    try {
      const code = await googleSignIn.requestCode()
      if (!code) {
        setIsLoading(false) // user dismissed the chooser — not an error
        return
      }

      const { data, error, status } = await api.post<LoginResponse>("/auth/google", { code })
      if (error || !data) {
        showAlert(
          "Google Sign-In Failed",
          error || (status === 401 ? "Google could not verify that account." : "Google Sign-In failed."),
          "error",
        )
        setIsLoading(false)
        return
      }

      await establishSession(data)
    } catch (err) {
      console.error("[Login] Google sign-in error:", err)
      showErrorToast(err instanceof Error ? err.message : "Google Sign-In failed.", 5000)
      setIsLoading(false)
    }
  }

  const inputClass = (field: Field) =>
    `block w-full rounded-xl border bg-white text-sm transition-all outline-none py-2.5 pr-4 pl-10 ${errors[field]
      ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
      : "border-gray-200 focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20"
    }`

  return (
    <div className="bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl sm:rounded-mega border border-white/50 min-h-[530px] flex flex-col justify-center">
      <div className="px-6 py-6 sm:px-8 sm:py-6">

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-1">
            Welcome <span style={gradientTextStyle}>Back!</span>
          </h2>
          <p className="text-gray-500 text-sm font-medium">Ready to celebrate more moments?</p>
        </div>

        <form className="space-y-3.5" onSubmit={login} noValidate>

          {/* Identifier */}
          <div>
            <label className="text-sm font-semibold text-gray-700 ml-1 block mb-1">Email or Phone</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                {/^\+?\d/.test(identifier) ? <FaPhone size={13} /> : <FaEnvelope size={14} />}
              </div>
              <input
                ref={identifierRef}
                type="text"
                required
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                onBlur={e => handleBlur("identifier", e.target.value)}
                onKeyDown={e => {
                  identifierKeyDown(e)
                  if (e.key === "Enter" && !e.defaultPrevented) {
                    e.preventDefault()
                    const err = VALIDATORS.identifier(identifier)
                    setError("identifier", err ?? null)
                    if (!err) passwordRef.current?.focus()
                  }
                }}
                onPaste={identifierPaste}
                className={inputClass("identifier")}
                placeholder="email or phone number"
                autoComplete="username"
              />
            </div>
            {errors.identifier && <p className="mt-1 ml-1 text-xs text-red-500 font-medium">{errors.identifier}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-semibold text-gray-700 ml-1 block mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <FaLock size={14} />
              </div>
              <input
                ref={passwordRef}
                type={showPw ? "text" : "password"}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                onBlur={e => handleBlur("password", e.target.value)}
                onKeyDown={passwordKeyDown}
                onPaste={passwordPaste}
                className={`${inputClass("password")} pr-12`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-fresh-green transition-colors">
                {showPw ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 ml-1 text-xs text-red-500 font-medium">{errors.password}</p>}
          </div>

          {/* Remember / Forgot */}
          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-fresh-green focus:ring-fresh-green cursor-pointer" />
              <span className="text-sm text-gray-600 font-medium group-hover:text-gray-900 transition-colors">Remember me</span>
            </label>
            <Link href="/forgot-password"
              className="text-sm font-semibold text-fresh-green hover:text-deep-green transition-colors">
              Forgot?
            </Link>
          </div>

          {/* Submit */}
          <button type="submit" disabled={isLoading}
            className="w-full flex justify-center items-center py-2.5 px-4 bg-gradient-to-r from-fresh-green to-deep-green text-white rounded-xl font-bold text-base shadow-lg shadow-fresh-green/25 hover:shadow-fresh-green/40 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
            {isLoading ? <Spinner /> : "Login to Account"}
          </button>
        </form>

        {/* Social + switch */}
        <div className="mt-4">
          <div className="relative flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {googleSignIn.isConfigured && SOCIAL.map(({ id, Icon }) => (
            <button key={id} type="button" onClick={loginWithGoogle} disabled={isLoading || googleSignIn.isPending}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-fresh-green/30 hover:-translate-y-0.5 transition-all duration-300 font-semibold text-gray-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
              <Icon className="w-5 h-5 shrink-0" />
              Continue with Google
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          © 2026 Farm To Home
        </p>
      </div>
    </div>
  )
}

export default function LoginClient() {
  return <AuthFlipCard initialSide="login" />
}
