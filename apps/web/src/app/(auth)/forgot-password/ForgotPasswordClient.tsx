"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { FaEnvelope, FaPhone, FaArrowRight, FaLock, FaKey } from "react-icons/fa"
import { useFlip, Spinner } from "../../../components/AuthFlipCard/AuthFlipCard"
import { useAlert } from "../../../context/AlertContext"
import { api } from "../../../services/api.client"
import { fingerprintService } from "../../../services/fingerprint.service"
import { getHomeForRole } from "../../../context/AuthContext"
import { showSuccessToast, showErrorToast } from "../../../components/Toast"

const INP = "block w-full rounded-xl border border-gray-200 bg-white text-sm transition-all focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20 outline-none py-3 pl-10 pr-4"

export function ForgotPasswordContent() {
  const router = useRouter()
  const { flipTo } = useFlip()
  const { showAlert } = useAlert()
  
  const [step, setStep] = useState<"request" | "verify">("request")
  const [method, setMethod] = useState<"email" | "phone">("email")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  
  // Verification / Reset Fields
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  
  const [isLoading, setIsLoading] = useState(false)

  // ── Step 1: Send OTP ──
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (method === "email") {
        const { data, error } = await api.post<any>("/auth/forgot-password", { email })
        if (error) throw new Error(error)
        showAlert("OTP Sent", data?.message || "Check your email for the 6-digit OTP code.", "success")
        setStep("verify")
      } else {
        const cleaned = phone.replace(/\D/g, "")
        const { data, error } = await api.post<any>("/auth/forgot-password-sms", { phone: cleaned })
        if (error) throw new Error(error)
        showAlert("OTP Sent", data?.message || "A 6-digit OTP code has been sent to your phone.", "success")
        setStep("verify")
      }
    } catch (err: any) {
      showAlert("Request Failed", err.message || "Something went wrong", "error")
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 2: Verify OTP, Reset Password & Login ──
  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      showAlert("Mismatch", "Passwords do not match.", "warning")
      return
    }
    if (password.length < 8) {
      showAlert("Too Short", "Password must be at least 8 characters.", "warning")
      return
    }

    setIsLoading(true)
    const identifierVal = method === "email" ? email : phone.replace(/\D/g, "")
    try {
      // 1) Verify OTP and Reset password
      const fingerprintData = await fingerprintService.generateFingerprint()
      const { error } = await api.post<any>("/auth/reset-password", {
        email: identifierVal,
        token: otp,
        newPassword: password,
        fingerprintData
      })
      if (error) throw new Error(error)

      showSuccessToast("Password updated! Logging you in...", 3000)

      // 2) Automatically Log In
      const loginRes = await api.post<any>("/auth/login", {
        identifier: identifierVal,
        password,
        fingerprintData
      })

      if (loginRes.error || !loginRes.data) {
        // Redirect to login fallback
        showErrorToast("Could not login automatically. Redirecting to login page.", 4000)
        setTimeout(() => { flipTo('login') }, 2000)
        return
      }

      // 3) Fetch user details to redirect
      const { data: me, error: meError } = await api.get<any>("/users/me")
      if (meError || !me) {
        flipTo('login')
        return
      }

      const userHasAdmin = me?.roles?.some((r: any) => r.role_name === 'ADMIN')
      const role = me?.active_role || (userHasAdmin ? "ADMIN" : "CUSTOMER")
      const destination = getHomeForRole(role)
      router.push(destination)

    } catch (err: any) {
      showAlert("Reset Failed", err.message || "Failed to verify OTP or update password.", "error")
    } finally {
      setIsLoading(false)
    }
  }

  if (step === "verify") {
    return (
      <div className="bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl sm:rounded-mega border border-white/50 min-h-[500px] flex flex-col justify-center">
        <div className="px-6 py-8 sm:px-8">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Verify OTP</h2>
            <p className="text-gray-500 text-sm">
              Enter the OTP sent to <strong className="text-gray-700">{method === "email" ? email : phone}</strong> and create a new password.
            </p>
          </div>

          <form onSubmit={handleVerifyAndReset} className="space-y-4">
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <FaKey size={14} />
              </div>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className={INP}
                placeholder="6-digit OTP Code"
                maxLength={6}
                required
              />
            </div>

            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <FaLock size={14} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INP}
                placeholder="New Password"
                required
              />
            </div>

            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <FaLock size={14} />
              </div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={INP}
                placeholder="Confirm New Password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 bg-gradient-to-r from-fresh-green to-deep-green text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70"
            >
              {isLoading ? <Spinner /> : <>Reset & Login <FaArrowRight size={14} /></>}
            </button>
          </form>

          <div className="mt-8 text-center flex justify-between items-center px-2">
            <button
              onClick={() => setStep("request")}
              className="text-sm font-semibold text-gray-500 hover:text-fresh-green transition-colors"
            >
              Change Email/Phone
            </button>
            <button
              onClick={() => flipTo('login')}
              className="text-sm font-bold text-fresh-green hover:underline"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl sm:rounded-mega border border-white/50 min-h-[500px] flex flex-col justify-center">
      <div className="px-6 py-8 sm:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password</h2>
          <p className="text-gray-500 text-sm">Choose how you'd like to receive your 6-digit verification OTP.</p>
        </div>

        <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
          <button
            onClick={() => setMethod("email")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              method === "email" ? "bg-white text-fresh-green shadow-sm" : "text-gray-500"
            }`}
          >
            <FaEnvelope size={14} /> Email
          </button>
          <button
            onClick={() => setMethod("phone")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              method === "phone" ? "bg-white text-fresh-green shadow-sm" : "text-gray-500"
            }`}
          >
            <FaPhone size={14} /> Phone
          </button>
        </div>

        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              {method === "email" ? <FaEnvelope size={14} /> : <FaPhone size={14} />}
            </div>
            <input
              type={method === "email" ? "email" : "tel"}
              value={method === "email" ? email : phone}
              onChange={(e) => method === "email" ? setEmail(e.target.value) : setPhone(e.target.value)}
              className={INP}
              placeholder={method === "email" ? "you@example.com" : "10-digit mobile number"}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center items-center gap-2 py-3 bg-gradient-to-r from-fresh-green to-deep-green text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70"
          >
            {isLoading ? <Spinner /> : <>Send Verification OTP <FaArrowRight size={14} /></>}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => flipTo('login')}
            className="text-sm font-bold text-fresh-green hover:underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}
