"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  FaEnvelope, FaLock, FaEye, FaEyeSlash,
  FaUser, FaPhone, FaCheckCircle,
} from "react-icons/fa"
import { showErrorToast, showSuccessToast } from "../../../components/Toast"
import { api } from "../../../services/api.client"
import AuthFlipCard, { useFlip, SOCIAL, Spinner } from "../../../components/AuthFlipCard/AuthFlipCard";
import { useAlert } from "../../../context/AlertContext"
import { useGoogleSignIn } from "../../../components/auth/useGoogleSignIn"

const OTP_LENGTH = 6
const INP = "block w-full rounded-xl border border-gray-200 bg-white text-sm transition-all focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20 outline-none py-[7px]"

// ─────────────────────────────────────────────
// Validators — matched to backend DTOs
// ─────────────────────────────────────────────

// RegisterDto: @IsString() @IsOptional() user_name
const validateUsername = (v: string): string | null => {
  const s = v.trim()
  if (!s) return "Username is required."
  if (s.length < 3) return "Username must be at least 3 characters."
  if (s.length > 30) return "Username must not exceed 30 characters."
  if (!/^[a-zA-Z0-9._@\-]+$/.test(s)) return "Username can only contain letters, digits, . _ @ -"
  if (/^[._\-@]/.test(s)) return "Username cannot start with . _ - or @"
  if (/[._\-@]$/.test(s)) return "Username cannot end with . _ - or @"
  if (/[._\-@]{2,}/.test(s)) return "Username cannot have consecutive special characters."
  return null
}

// SendOtpDto / RegisterDto: @Matches(/^\d{10,15}$/) — enforced as exactly 10 per product requirement
const validateMobile = (v: string): string | null => {
  if (!v) return "Mobile number is required."
  if (v.length !== 10) return "Mobile number must be exactly 10 digits."
  if (!/^[6-9]/.test(v)) return "Mobile number must start with 6, 7, 8, or 9."
  if (/^(\d)\1{9}$/.test(v)) return "Mobile number cannot be all the same digit."
  if (/^(0123456789|9876543210)$/.test(v)) return "Mobile number cannot be a sequential pattern."
  return null
}

// RegisterDto: @IsOptional() @IsEmail()
const validateEmail = (v: string): string | null => {
  if (!v.trim()) return null
  const s = v.trim().toLowerCase()
  if (s.length > 254) return "Email address is too long."
  if (!/^[a-z0-9]([a-z0-9._%+\-]*[a-z0-9])?@[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z]{2,})+$/.test(s))
    return "Please provide a valid email address."
  if (/\.{2,}/.test(s)) return "Email must not contain consecutive dots."
  if (s.split("@")[0].length > 64) return "Email username part must not exceed 64 characters."
  return null
}

// RegisterDto: @MinLength(8) + @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/)
// = uppercase + lowercase + (digit OR special char)
const validatePassword = (v: string): string | null => {
  if (!v) return "Password is required."
  if (v.length < 8) return "Password must be at least 8 characters."
  if (v.length > 128) return "Password must not exceed 128 characters."
  if (!/[A-Z]/.test(v)) return "Password must contain at least one uppercase letter."
  if (!/[a-z]/.test(v)) return "Password must contain at least one lowercase letter."
  if (!/\d/.test(v) && !/\W/.test(v))
    return "Password must contain at least one number or special character."
  if (/^\s+$/.test(v)) return "Password cannot be only spaces."
  return null
}

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
function usernameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const { key, currentTarget: el, ctrlKey, metaKey } = e
  if (CONTROL_KEYS.has(key) || ctrlKey || metaKey || key.length > 1) return
  if (key === " ") { e.preventDefault(); return }
  if (!/^[a-zA-Z0-9._@\-]$/.test(key)) { e.preventDefault(); return }
  if (el.value.length === 0 && /^[._\-@]$/.test(key)) { e.preventDefault(); return }
  const beforeCursor = el.value.slice(0, el.selectionStart ?? 0)
  if (/[._\-@]$/.test(beforeCursor) && /^[._\-@]$/.test(key)) { e.preventDefault(); return }
}

function usernamePaste(e: React.ClipboardEvent<HTMLInputElement>) {
  e.preventDefault()
  const pasted = e.clipboardData.getData("text")
    .replace(/\s/g, "")
    .replace(/[^a-zA-Z0-9._@\-]/g, "")
    .replace(/[._\-@]{2,}/g, s => s[0])
    .slice(0, 30)
  if (!pasted || /^[._\-@]/.test(pasted)) return
  const el = e.currentTarget
  const { selectionStart: s = 0, selectionEnd: end = 0, value } = el
  setNativeValue(el, (value.slice(0, s!) + pasted + value.slice(end!)).slice(0, 30))
}

function mobileKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const { key, currentTarget: el, ctrlKey, metaKey } = e
  if (CONTROL_KEYS.has(key) || ctrlKey || metaKey) return
  if (!/^\d$/.test(key)) { e.preventDefault(); return }
  if (el.value.length >= 10 && el.selectionStart === el.selectionEnd) { e.preventDefault(); return }
  const atStart = (el.selectionStart ?? 0) === 0
  const replacingStart = atStart && (el.selectionEnd ?? 0) > 0
  if ((atStart || !el.value.length || replacingStart) && !/^[6-9]$/.test(key)) e.preventDefault()
}

function mobilePaste(e: React.ClipboardEvent<HTMLInputElement>) {
  e.preventDefault()
  const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 10)
  if (!pasted || !/^[6-9]/.test(pasted)) return
  const el = e.currentTarget
  const { selectionStart: s = 0, selectionEnd: end = 0, value } = el
  setNativeValue(el, (value.slice(0, s!) + pasted + value.slice(end!)).slice(0, 10))
}

function emailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const { key, currentTarget: el, ctrlKey, metaKey } = e
  if (CONTROL_KEYS.has(key) || ctrlKey || metaKey || key.length > 1) return
  if (key === " ") { e.preventDefault(); return }
  if (!/^[a-zA-Z0-9@._+\-]$/.test(key)) { e.preventDefault(); return }
  const beforeCursor = el.value.slice(0, el.selectionStart ?? 0)
  if (key === "@" && el.value.includes("@")) { e.preventDefault(); return }
  if (key === "." && beforeCursor.endsWith(".")) { e.preventDefault(); return }
  if (el.value.length === 0 && /^[^a-zA-Z0-9]$/.test(key)) { e.preventDefault(); return }
  if (beforeCursor.endsWith("@") && /^[^a-zA-Z0-9]$/.test(key)) { e.preventDefault(); return }
}

function emailPaste(e: React.ClipboardEvent<HTMLInputElement>) {
  e.preventDefault()
  const pasted = e.clipboardData.getData("text")
    .replace(/\s/g, "")
    .replace(/[^a-zA-Z0-9@._+\-]/g, "")
    .slice(0, 254)
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
  if (!/^[\x21-\x7E]$/.test(key)) { e.preventDefault(); return }
  if (el.value.length >= 128 && el.selectionStart === el.selectionEnd) e.preventDefault()
}

function passwordPaste(e: React.ClipboardEvent<HTMLInputElement>) {
  e.preventDefault()
  const pasted = e.clipboardData.getData("text")
    .replace(/\s/g, "")
    .replace(/[^\x21-\x7E]/g, "")
    .slice(0, 128)
  if (!pasted) return
  const el = e.currentTarget
  const { selectionStart: s = 0, selectionEnd: end = 0, value } = el
  setNativeValue(el, (value.slice(0, s!) + pasted + value.slice(end!)).slice(0, 128))
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
      {children}
    </span>
  )
}

function PwInput({ value, onChange, onKeyDown, onPaste, onBlur, show, onToggle, className = "" }: {
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  show: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <div className="relative">
      <FieldIcon><FaLock size={12} /></FieldIcon>
      <input
        type={show ? "text" : "password"}
        required
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={onBlur}
        className={`${INP} pl-8 pr-8 ${className}`}
        placeholder="••••••••"
      />
      <button type="button" onClick={onToggle}
        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-fresh-green transition-colors">
        {show ? <FaEyeSlash size={13} /> : <FaEye size={13} />}
      </button>
    </div>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-0.5 ml-0.5 text-[10px] text-red-500 font-medium">{msg}</p>
}

function inpClass(hasError?: boolean) {
  return hasError
    ? INP.replace("border-gray-200", "border-red-400") + " focus:border-red-400 focus:ring-red-400/20"
    : INP
}

// FIX: Inline styles instead of text-gradient class — survives SSR hydration
const gradientTextStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #2d8a45 0%, #f0a500 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
type FormKey = "user_name" | "mobile" | "email" | "password" | "confirmPassword"
type Errors = Partial<Record<FormKey, string>>

/* ── Register form content (rendered as back face of flip card) ── */
export function RegisterContent() {
  const { showAlert } = useAlert()
  const { flipTo } = useFlip()
  const googleSignIn = useGoogleSignIn()

  // Field refs for Enter-key focus shifting
  const mobileRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    user_name: "", mobile: "", email: "", password: "", confirmPassword: "",
  })
  const setField = useCallback(
    (key: FormKey) => (val: string) => setForm(f => ({ ...f, [key]: val })), []
  )

  const [errors, setErrors] = useState<Errors>({})
  const [showPw, setShowPw] = useState(false)
  const [showCpw, setShowCpw] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpVerificationToken, setOtpVerificationToken] = useState("")
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""))
  const [otpLoading, setOtpLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const setError = (field: FormKey, msg: string | null) =>
    setErrors(prev => ({ ...prev, [field]: msg ?? undefined }))

  const handleBlur = (field: FormKey, value: string) => {
    let err: string | null = null
    if (field === "user_name") err = validateUsername(value)
    else if (field === "mobile") err = validateMobile(value)
    else if (field === "email") err = validateEmail(value)
    else if (field === "password") err = validatePassword(value)
    else if (field === "confirmPassword") err = value !== form.password ? "Passwords do not match." : null
    setError(field, err)
  }

  // Enter key: validate current field then focus next
  const handleEnter = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: FormKey,
    next: React.RefObject<HTMLInputElement | null>
  ) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    handleBlur(field, e.currentTarget.value)
    next.current?.focus()
  }

  useEffect(() => {
    if (resendTimer <= 0) return
    const id = setTimeout(() => setResendTimer(t => t - 1), 1000)
    return () => clearTimeout(id)
  }, [resendTimer])

  const apiPost = useCallback(async <T = any>(path: string, body: object): Promise<T> => {
    const { data, error, status } = await api.post<T>(path, body)
    if (error) {
      if (status === 429) throw new Error("Too many requests. Please try again later.")
      throw new Error(error)
    }
    return data as T
  }, [])

  // SendOtpDto: phone + optional user_name
  const sendOtp = useCallback(async () => {
    const mobileErr = validateMobile(form.mobile)
    if (mobileErr) { showAlert("Check Mobile", mobileErr, "warning"); setError("mobile", mobileErr); return }
    const unErr = validateUsername(form.user_name)
    if (unErr) { showAlert("Fix Username", "Fix username errors first.", "warning"); setError("user_name", unErr); return }
    setOtpLoading(true)
    try {
      await apiPost("/auth/send-otp", { phone: form.mobile, user_name: form.user_name, purpose: "registration" })
      setOtpSent(true); setResendTimer(30); setOtp(Array(OTP_LENGTH).fill("")); setOtpVerificationToken("")
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (err) {
      showAlert("OTP Error", err instanceof Error ? err.message : "Failed to send OTP", "error")
    } finally { setOtpLoading(false) }
  }, [form.mobile, form.user_name, apiPost])

  const handleOtpChange = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    setOtp(prev => { const next = [...prev]; next[index] = value.slice(-1); return next })
    if (value && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus()
  }, [])

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus()
  }, [otp])

  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH)
    setOtp(prev => { const next = [...prev]; digits.split("").forEach((d, i) => { next[i] = d }); return next })
    otpRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus()
  }, [])

  // VerifyOtpDto: phone + otp MinLength(6)
  const verifyOtp = useCallback(async () => {
    const code = otp.join("")
    if (code.length < OTP_LENGTH) { showErrorToast("Enter the complete OTP", 5000); return }
    setVerifyLoading(true)
    try {
      const data = await apiPost("/auth/verify-otp", { phone: form.mobile, otp: code, purpose: "registration" })
      const token = data?.verification_token
      if (!token) throw new Error("OTP verified, but verification token was not returned")
      setOtpVerificationToken(token); setOtpVerified(true); setOtpSent(false)
    } catch (err) {
      showAlert("Verification Failed", err instanceof Error ? err.message : "OTP verification failed", "error")
    } finally { setVerifyLoading(false) }
  }, [otp, form.mobile, apiPost])

  const validateAll = useCallback((): boolean => {
    const newErrors: Errors = {
      user_name: validateUsername(form.user_name) ?? undefined,
      mobile: validateMobile(form.mobile) ?? undefined,
      email: validateEmail(form.email) ?? undefined,
      password: validatePassword(form.password) ?? undefined,
      confirmPassword: form.confirmPassword !== form.password ? "Passwords do not match." : undefined,
    }
    setErrors(newErrors)
    return !Object.values(newErrors).some(Boolean)
  }, [form])

  // RegisterDto: user_name, phone, email (optional), password
  const register = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateAll()) { showAlert("Form Error", "Please fix the errors before submitting.", "warning"); return }
    if (!otpVerified || !otpVerificationToken) { showAlert("Phone Unverified", "Please verify your mobile number first", "warning"); return }
    setIsLoading(true)
    try {
      await apiPost("/auth/register", {
        user_name: form.user_name,
        phone: form.mobile,
        email: form.email || undefined,
        password: form.password,
        verification_token: otpVerificationToken,
      })
      showSuccessToast("Account created! Welcome to Form 2 Home 🎉", 3000)
      flipTo('login')
    } catch (err) {
      showAlert("Registration Failed", err instanceof Error ? err.message : "Something went wrong", "error")
    } finally { setIsLoading(false) }
  }, [form, otpVerified, otpVerificationToken, apiPost, flipTo, validateAll])

  /**
   * Google Sign-Up.
   *
   * This used to navigate to `${API_URL}/auth/google`, which the API never
   * exposed as a GET — the button always landed on a 404. The browser now takes
   * an authorization code from Google and posts it to the endpoint that does
   * exist; the API exchanges it with the client secret and returns a session.
   *
   * Google is the only identity here: no phone, email, or name is sent, because
   * the API ignores client-supplied identity on this route by design.
   */
  const handleSocialLogin = useCallback(async () => {
    setIsLoading(true)
    try {
      const code = await googleSignIn.requestCode()
      if (!code) return // chooser dismissed

      await apiPost("/auth/google", { code })
      showSuccessToast("Signed in with Google 🎉", 3000)
      window.location.href = "/"
    } catch (err) {
      showAlert("Google Sign-In Failed", err instanceof Error ? err.message : "Something went wrong", "error")
    } finally {
      setIsLoading(false)
    }
  }, [apiPost, googleSignIn, showAlert])

  const pwMismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword

  return (
    <div className="bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl sm:rounded-mega border border-white/50">
      <div className="px-6 py-6 sm:px-8 sm:py-8">
        {/* Header */}
        <div className="text-center mb-2">
          <h2 className="text-3xl sm:text-4xl font-heading font-bold leading-tight">
            Create <span style={gradientTextStyle}>Account</span>
          </h2>
          <p className="text-gray-500 text-xs font-medium mt-0.5">Join the celebration today!</p>
        </div>

        <form className="space-y-2" onSubmit={register} noValidate>

          {/* Username */}
          <div>
            <label className="text-xs font-semibold text-gray-700 ml-0.5 block mb-0.5">Username</label>
            <div className="relative">
              <FieldIcon><FaUser size={11} /></FieldIcon>
              <input
                type="text" required value={form.user_name}
                onChange={e => setField("user_name")(e.target.value)}
                onBlur={e => handleBlur("user_name", e.target.value)}
                onKeyDown={e => { usernameKeyDown(e); handleEnter(e, "user_name", mobileRef) }}
                onPaste={usernamePaste}
                className={`${inpClass(!!errors.user_name)} pl-8 pr-2`}
                placeholder="e.g. charan@official"
              />
            </div>
            <FieldError msg={errors.user_name} />
          </div>

          {/* Mobile + OTP */}
          <div>
            <label className="text-xs font-semibold text-gray-700 ml-0.5 mb-0.5 flex items-center gap-1.5">
              Mobile Number
              <span className="text-[10px] font-normal text-gray-400">· OTP required</span>
              {otpVerified && (
                <span className="ml-auto flex items-center gap-1 text-green-500 text-[10px] font-bold">
                  <FaCheckCircle size={10} /> Verified
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                  <div className="flex items-center gap-0.5 pl-2.5 pr-2 border-r border-gray-200 h-full">
                    <FaPhone size={10} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-500">+91</span>
                  </div>
                </div>
                <input
                  ref={mobileRef}
                  type="tel" required maxLength={10} value={form.mobile}
                  onChange={e => {
                    setField("mobile")(e.target.value.replace(/\D/g, ""))
                    if (otpVerified) { setOtpVerified(false); setOtpSent(false); setOtpVerificationToken("") }
                  }}
                  onBlur={e => handleBlur("mobile", e.target.value)}
                  onKeyDown={e => { mobileKeyDown(e); handleEnter(e, "mobile", emailRef) }}
                  onPaste={mobilePaste}
                  disabled={otpVerified}
                  className={`${inpClass(!!errors.mobile)} pl-[4.5rem] pr-2 disabled:bg-gray-50 disabled:text-gray-500`}
                  placeholder="9876543210"
                />
              </div>
              {!otpVerified && (
                <button type="button" onClick={sendOtp}
                  disabled={otpLoading || resendTimer > 0 || form.mobile.length < 10}
                  className="shrink-0 px-3 rounded-xl bg-gradient-to-r from-fresh-green to-deep-green text-white text-xs font-bold shadow hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                  {otpLoading ? <Spinner size={3} />
                    : resendTimer > 0 ? `${resendTimer}s` : otpSent ? "Resend" : "Send OTP"}
                </button>
              )}
            </div>
            <FieldError msg={errors.mobile} />

            {otpSent && !otpVerified && (
              <div className="mt-1.5 space-y-1">
                <p className="text-[10px] text-gray-500 font-medium">Enter OTP sent to +91 {form.mobile}</p>
                <div className="flex gap-1.5 items-center">
                  <div className="flex gap-1" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input key={i} ref={el => { otpRefs.current[i] = el }}
                        type="text" inputMode="numeric" maxLength={1} value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        className="w-8 h-8 text-center text-sm font-bold border-2 border-gray-200 rounded-lg outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20 transition-all" />
                    ))}
                  </div>
                  <button type="button" onClick={verifyOtp}
                    disabled={verifyLoading || otp.join("").length < OTP_LENGTH}
                    className="px-4 h-8 bg-gradient-to-r from-fresh-green to-deep-green text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                    {verifyLoading ? <Spinner size={3} /> : "Verify"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-semibold text-gray-700 ml-0.5 mb-0.5 flex items-center gap-1.5">Email Address</label>
            <div className="relative">
              <FieldIcon><FaEnvelope size={11} /></FieldIcon>
              <input
                ref={emailRef}
                type="text" value={form.email}
                onChange={e => setField("email")(e.target.value)}
                onBlur={e => handleBlur("email", e.target.value)}
                onKeyDown={e => { emailKeyDown(e); handleEnter(e, "email", passwordRef) }}
                onPaste={emailPaste}
                className={`${inpClass(!!errors.email)} pl-8 pr-3`}
                placeholder="name@example.com (optional)"
              />
            </div>
            <FieldError msg={errors.email} />
          </div>

          {/* Password row */}
          <div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-700 ml-0.5 block mb-0.5">Password</label>
                <PwInput
                  value={form.password}
                  onChange={setField("password")}
                  onKeyDown={e => { passwordKeyDown(e); handleEnter(e, "password", confirmRef) }}
                  onPaste={passwordPaste}
                  onBlur={e => handleBlur("password", e.target.value)}
                  show={showPw}
                  onToggle={() => setShowPw(p => !p)}
                  className={errors.password ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""}
                />
                <FieldError msg={errors.password} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 ml-0.5 mb-0.5 flex items-center gap-1">
                  Confirm
                  {form.confirmPassword.length > 0 && (
                    !pwMismatch
                      ? <FaCheckCircle size={10} className="text-green-500" />
                      : <span className="text-[10px] text-red-400 font-bold">✗</span>
                  )}
                </label>
                <PwInput
                  value={form.confirmPassword}
                  onChange={val => {
                    setField("confirmPassword")(val)
                    setError("confirmPassword", val !== form.password ? "Passwords do not match." : null)
                  }}
                  onKeyDown={passwordKeyDown}
                  onPaste={passwordPaste}
                  onBlur={e => handleBlur("confirmPassword", e.target.value)}
                  show={showCpw}
                  onToggle={() => setShowCpw(p => !p)}
                  className={pwMismatch ? "border-red-300 focus:border-red-400 focus:ring-red-200/40" : ""}
                />
                <FieldError msg={errors.confirmPassword} />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 ml-0.5 italic -mt-0.5">
              Min 8 chars · uppercase · lowercase · number or special symbol
            </p>
          </div>

          {/* Submit */}
          <div>
            <button type="submit" disabled={isLoading || !otpVerified}
              className="w-full flex justify-center items-center py-2 px-4 bg-gradient-to-r from-fresh-green to-deep-green text-white rounded-xl font-bold text-sm shadow-lg shadow-fresh-green/25 hover:shadow-fresh-green/40 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? <Spinner /> : "Get Started Free"}
            </button>
          </div>
        </form>

        {/* Social + switch */}
        <div className="mt-2">
          <div className="relative flex items-center gap-3 mb-2">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {googleSignIn.isConfigured && SOCIAL.map(({ id, Icon }) => (
            <button key={id} type="button" onClick={handleSocialLogin} disabled={isLoading || googleSignIn.isPending}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-fresh-green/30 hover:-translate-y-0.5 transition-all duration-300 font-semibold text-gray-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0">
              <Icon className="w-5 h-5 shrink-0" />
              Continue with Google
            </button>
          ))}
        </div>
        <div className="mt-2 text-center bg-gray-50/50 rounded-xl py-1.5 border border-gray-100/50">
          <p className="text-sm text-gray-500 font-medium">
            Already have an account?{" "}
            <a href="/login" onClick={e => { e.preventDefault(); flipTo('login') }}
              className="text-fresh-green font-bold hover:text-deep-green hover:underline underline-offset-4 decoration-2 cursor-pointer">Sign in</a>
          </p>
        </div>
        <p className="mt-1.5 text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest">
          © 2026 Farm To Home
        </p>
      </div>
    </div>
  )
}

/* ── Client page wrapper ── */
export default function RegisterClient() {
  return <AuthFlipCard initialSide="register" />
}