"use client"

import React, { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { FaLock, FaEye, FaEyeSlash, FaCheckCircle } from "react-icons/fa"
import { useFlip, Spinner } from "../../../components/AuthFlipCard/AuthFlipCard"
import { useAlert } from "../../../context/AlertContext"
import { api } from "../../../services/api.client"

const INP = "block w-full rounded-xl border border-gray-200 bg-white text-sm transition-all focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20 outline-none py-3 pl-10 pr-10"

export function ResetPasswordContent() {
  const { flipTo } = useFlip()
  const { showAlert } = useAlert()
  const searchParams = useSearchParams()
  
  const [token, setToken] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const t = searchParams.get("token")
    const e = searchParams.get("email")
    if (t) setToken(t)
    if (e) setEmail(e)
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
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
    try {
      const { error } = await api.post("/auth/reset-password", {
        token,
        email,
        newPassword: password
      })
      if (error) throw new Error(error)
      showAlert("Success!", "Your password has been reset successfully.", "success")
      flipTo('login')
    } catch (err: any) {
      showAlert("Reset Failed", err.message || "Something went wrong", "error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl shadow-2xl rounded-2xl sm:rounded-mega border border-white/50 min-h-[500px] flex flex-col justify-center">
      <div className="px-6 py-8 sm:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">New Password</h2>
          <p className="text-gray-500 text-sm">Please enter your new secure password.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <FaLock size={14} />
            </div>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INP}
              placeholder="New password"
              required
            />
            <button 
              type="button" 
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-fresh-green"
            >
              {showPw ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
            </button>
          </div>

          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <FaCheckCircle size={14} />
            </div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={INP}
              placeholder="Confirm new password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !token}
            className="w-full flex justify-center items-center gap-2 py-3 bg-gradient-to-r from-fresh-green to-deep-green text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70"
          >
            {isLoading ? <Spinner /> : "Reset Password"}
          </button>
        </form>

        {!token && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
            <p className="text-xs text-red-600 font-medium text-center">
              Invalid or missing reset token. Please request a new link.
            </p>
          </div>
        )}

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
