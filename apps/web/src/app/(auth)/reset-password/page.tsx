"use client"

import { useState, Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, Loader, ShieldCheck } from "lucide-react"
import { showErrorToast, showSuccessToast, clearAllToasts } from "@/components/Toast"
import { api } from "@/services/api.client"

const getFingerprint = () => {
  if (typeof window === "undefined") return {}
  return {
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: navigator.platform || "unknown",
    acceptLanguage: navigator.language || "unknown",
  }
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""
  const emailFromUrl = searchParams.get("email") || ""

  const [email] = useState(emailFromUrl)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isValidLink, setIsValidLink] = useState(true)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) setIsValidLink(false)
  }, [token])

  const checks = [
    { label: "At least 8 characters", ok: newPassword.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(newPassword) },
    { label: "Lowercase letter", ok: /[a-z]/.test(newPassword) },
    { label: "Number", ok: /[0-9]/.test(newPassword) },
    { label: "Special character (!@#$%^&*)", ok: /[!@#$%^&*]/.test(newPassword) },
  ]
  const allValid = checks.every((c) => c.ok)
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allValid) { showErrorToast("Password doesn't meet all requirements"); return }
    if (!passwordsMatch) { showErrorToast("Passwords do not match"); return }

    setIsLoading(true)
    try {
      const { error } = await api.post<{ message?: string }>("/auth/reset-password", {
        email,
        token,
        newPassword,
        fingerprintData: getFingerprint(),
      })
      if (error) throw new Error(error)
      setSuccess(true)
      showSuccessToast("Password reset successful!")
      setTimeout(() => { clearAllToasts(); window.location.href = "/login" }, 2500)
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Reset failed")
    } finally {
      setIsLoading(false)
    }
  }

  /* ---------- Invalid link ---------- */
  if (!isValidLink) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#f0fdf4] via-white to-[#f9fafb] flex items-center justify-center p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#16a34a]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#2563eb]/5 rounded-full blur-3xl" />
        </div>
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-50 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Reset Link</h2>
          <p className="text-gray-500 text-sm mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="block w-full py-3 rounded-[14px] bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all text-center"
          >
            Request New Link
          </Link>
          <Link href="/login" className="block mt-3 text-sm font-semibold text-gray-500 hover:text-[#16a34a] transition-colors">
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  /* ---------- Success ---------- */
  if (success) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#f0fdf4] via-white to-[#f9fafb] flex items-center justify-center p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#16a34a]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#2563eb]/5 rounded-full blur-3xl" />
        </div>
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-50 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-[#16a34a]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h2>
          <p className="text-gray-500 text-sm mb-4">Redirecting you to login...</p>
          <Loader size={20} className="animate-spin text-[#16a34a] mx-auto" />
        </div>
      </div>
    )
  }

  /* ---------- Main form ---------- */
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f0fdf4] via-white to-[#f9fafb] flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#16a34a]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#2563eb]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#16a34a] to-[#15803d] flex items-center justify-center text-white font-bold text-lg mb-4 mx-auto shadow-lg">
            F2H
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Password</h1>
          <p className="text-gray-500 text-sm">
            Choose a strong password for <strong className="text-gray-700">{email}</strong>
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-50 p-6 sm:p-8 mb-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 rounded-[14px] border border-gray-200 text-sm placeholder-gray-400 focus:outline-none focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/20 transition-all"
                  placeholder="Enter new password"
                  autoFocus
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Strength checklist */}
              {newPassword.length > 0 && (
                <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
                  {checks.map((c) => (
                    <div key={c.label} className="flex items-center gap-1.5">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${c.ok ? "bg-green-100" : "bg-gray-100"}`}>
                        {c.ok ? (
                          <CheckCircle size={10} className="text-[#16a34a]" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        )}
                      </div>
                      <span className={`text-[11px] ${c.ok ? "text-[#16a34a] font-medium" : "text-gray-400"}`}>{c.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-12 pr-12 py-3 rounded-[14px] border text-sm placeholder-gray-400 focus:outline-none transition-all ${
                    confirmPassword.length > 0
                      ? passwordsMatch
                        ? "border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/20"
                        : "border-red-300 focus:ring-2 focus:ring-red-200"
                      : "border-gray-200 focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/20"
                  }`}
                  placeholder="Confirm new password"
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-500 mt-1 ml-1">Passwords do not match</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !allValid || !passwordsMatch}
              className="w-full py-3 rounded-[14px] bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white font-semibold text-sm active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs text-gray-400 font-medium">OR</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>
          <p className="text-center text-sm text-gray-600">
            Remember your password?{" "}
            <Link href="/login" className="font-semibold text-[#16a34a] hover:text-[#15803d] transition-colors">
              Sign In
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">F2H Fresh &bull; Delivery Management System</p>
      </div>
    </div>
  )
}

export default function ResetPassword() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fdf4] via-white to-[#f9fafb]">
          <Loader size={24} className="animate-spin text-[#16a34a]" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
