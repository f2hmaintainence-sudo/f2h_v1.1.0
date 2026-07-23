"use client"

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { FcGoogle } from "react-icons/fc"
import { LoginContent } from "../../app/(auth)/login/LoginClient"
import { RegisterContent } from "../../app/(auth)/register/RegisterClient"
import { ForgotPasswordContent } from "../../app/(auth)/forgot-password/ForgotPasswordClient"
import { ResetPasswordContent } from "../../app/(auth)/reset-password/ResetPasswordClient"
import './AuthFlipCard.css'

/* ─── Types ─── */
export type AuthSide = 'login' | 'register' | 'forgot-password' | 'reset-password'

/* ─── Social providers ─── */
export const SOCIAL = [
  { id: 'google', Icon: FcGoogle },
] as const

/* ─── Spinner ─── */
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size, height: size,
        border: '2.5px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'f2h-spin 0.7s linear infinite',
      }}
    />
  )
}

/* ─── Flip context ─── */
const FlipCtx = createContext<{ 
  side: AuthSide;
  flipTo: (side: AuthSide) => void;
}>({ side: 'login', flipTo: () => { } })

export const useFlip = () => useContext(FlipCtx)

/* ─── Hero Panel ─── */
function HeroPanel({ side }: { side: AuthSide }) {
  const heroRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const spotRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)

  const stats = [
    { v: '10K+', l: 'Happy Families', icon: '👨‍👩‍👧' },
    { v: '4.9★', l: 'Avg Rating', icon: '⭐' },
    { v: '98%', l: 'On-time Rate', icon: '⚡' },
  ]

  /* ── Canvas logic ── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    type Bubble = { x: number; y: number; vy: number; r: number; opacity: number }
    const bubbles: Bubble[] = Array.from({ length: 22 }, () => ({
      x: Math.random() * 400,
      y: canvas.height - Math.random() * 80,
      vy: -0.3 - Math.random() * 0.5,
      r: 2 + Math.random() * 5,
      opacity: 0.08 + Math.random() * 0.15,
    }))

    let waveOffset = 0
    const draw = () => {
      if (!canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      waveOffset += 0.012
      const waveY = canvas.height - 70
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(0, waveY)
      for (let x = 0; x <= canvas.width; x += 4) {
        const y = waveY + Math.sin(x * 0.018 + waveOffset) * 14 + Math.sin(x * 0.009 + waveOffset * 1.3) * 8
        ctx.lineTo(x, y)
      }
      ctx.lineTo(canvas.width, canvas.height)
      ctx.lineTo(0, canvas.height)
      ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill()
      ctx.restore()

      for (const b of bubbles) {
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255,255,255,${b.opacity})`; ctx.lineWidth = 0.8; ctx.stroke()
        b.y += b.vy; if (b.y < canvas.height * 0.4) { b.y = canvas.height; b.x = Math.random() * canvas.width }
      }
      animRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect() }
  }, [])

  return (
    <aside className="f2h-hero" ref={heroRef}>
      <canvas ref={canvasRef} className="f2h-hero-canvas" />
      <div ref={spotRef} className="f2h-hero-glow" />

      <div className="f2h-tilt-wrap" ref={tiltRef}>
        <div className="f2h-hero-logo-row">
          <img src="/assets/log1.webp" alt="F2H" className="f2h-logo-img" />
          <div>
            <div className="f2h-logo-tagline">Farm to Home</div>
            <div className="f2h-time-badge"><div className="f2h-time-dot" />Delivering before 7 AM</div>
          </div>
        </div>

        <div className="f2h-hero-center">
          <div className="f2h-glass-orb">
            <span className="f2h-milk-emoji" role="img" aria-label="milk">🥛</span>
            <div className="f2h-badge f2h-b1"><div className="f2h-badge-dot" />🌾 Farm Fresh</div>
            <div className="f2h-badge f2h-b2"><div className="f2h-badge-dot" style={{ background: '#ffd54f' }} />⚡ 2-Hr Refund</div>
            <div className="f2h-badge f2h-b3"><div className="f2h-badge-dot" style={{ background: '#80deea' }} />📍 Live Tracking</div>
          </div>
          <h1 className="f2h-hero-title">
            {side === 'login' && <>Fresh Milk,<br /><span className="f2h-accent">Every Morning</span></>}
            {side === 'register' && <>Start Your<br /><span className="f2h-accent">Daily Fresh</span><br />Subscription</>}
            {side === 'forgot-password' && <>Secure Your<br /><span className="f2h-accent">Account Recovery</span></>}
            {side === 'reset-password' && <>Set Your<br /><span className="f2h-accent">New Password</span></>}
          </h1>
        </div>

        <div className="f2h-hero-stats">
          {stats.map(({ v, l, icon }) => (
            <div key={l} className="f2h-stat">
              <div className="f2h-stat-icon">{icon}</div>
              <div className="f2h-stat-val">{v}</div>
              <div className="f2h-stat-lbl">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

/* ─── Root component ─── */
export default function AuthFlipCard({ initialSide }: { initialSide: AuthSide }) {
  const [side, setSide] = useState<AuthSide>(initialSide)
  const router = useRouter()

  const flipTo = useCallback((newSide: AuthSide) => {
    setSide(newSide)
    // Update URL without full refresh to stay in sync with component state
    const url = `/${newSide}`
    window.history.pushState(null, '', url)
  }, [])

  // Sync side with URL on mount or back/forward
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace('/', '') as AuthSide
      if (['login', 'register', 'forgot-password', 'reset-password'].includes(path)) {
        setSide(path)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <FlipCtx.Provider value={{ side, flipTo }}>
      <div className="f2h-shell">
        <HeroPanel side={side} />

        <div className="f2h-right">
          <div className="f2h-right-inner">
            <div className="f2h-mobile-header">
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--f2h-green)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: '#fff', flexShrink: 0,
              }}>🥛</div>
              <div>
                <div className="f2h-mobile-brand">F2H Fresh</div>
                <div style={{ fontSize: 10, color: 'var(--f2h-muted)' }}>Farm to Home</div>
              </div>
            </div>

            <div className="f2h-card-stack">
              {side === 'login' && <div className="f2h-card-slot active"><LoginContent /></div>}
              {side === 'register' && <div className="f2h-card-slot active"><RegisterContent /></div>}
              {side === 'forgot-password' && <div className="f2h-card-slot active"><ForgotPasswordContent /></div>}
              {side === 'reset-password' && <div className="f2h-card-slot active"><ResetPasswordContent /></div>}
            </div>
          </div>
        </div>
      </div>
    </FlipCtx.Provider>
  )
}
