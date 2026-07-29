import 'package:flutter/material.dart';

// ══════════════════════════════════════════════════════════
//  F2H BRAND COLORS — WEB ADMIN ALIGNED & GLASSY PALETTE
// ══════════════════════════════════════════════════════════
const Color kBg        = Color(0xFFF8FAFC); // Slate 50 (Clean Web Admin BG)
const Color kBgDeep    = Color(0xFFF1F5F9); // Slate 100
const Color kSurface   = Color(0xFFFFFFFF); // Pure White Surface
const Color kPrimary   = Color(0xFF16A34A); // Web Emerald Green (#16A34A)
const Color kPrimaryMid= Color(0xFF15803D); // Web Dark Emerald Green (#15803D)
const Color kPrimaryLt = Color(0xFF22C55E); // Web Light Emerald Green (#22C55E)
const Color kPrimaryPl = Color(0xFFDCFCE7); // Web Mint Tint / Soft Green Pill BG
const Color kAccent    = Color(0xFFF59E0B); // Amber Accent (#F59E0B)
const Color kAccentLt  = Color(0xFFFEF3C7); // Light Amber Highlight
const Color kText      = Color(0xFF0F172A); // Slate 900 Deep Text
const Color kTextMid   = Color(0xFF334155); // Slate 700 Text Secondary
const Color kTextSub   = Color(0xFF64748B); // Slate 500 Subtitle Text
const Color kMuted     = Color(0xFF94A3B8); // Slate 400 Muted lines/borders
const Color kBorder    = Color(0xFFE2E8F0); // Slate 200 Soft Border
const Color kBorderLt  = Color(0xFFF1F5F9); // Slate 100 Subtle Divider
const Color kRed       = Color(0xFFEF4444); // Red 500 Danger/Warning
const Color kRedLt     = Color(0xFFFEE2E2); // Red 100 Soft Red BG
const Color kSuccess   = Color(0xFF16A34A);
const Color kDanger    = Color(0xFFEF4444);

// ══════════════════════════════════════════════════════════
//  DARK THEME COLORS — Premium onboarding & auth screens
// ══════════════════════════════════════════════════════════
const Color kDarkBg       = Color(0xFF060D06); // Near-black deep forest
const Color kDarkSurface  = Color(0xFF0E180E); // Dark card background
const Color kDarkCard     = Color(0xFF142014); // Slightly lighter card
const Color kDarkBorder   = Color(0xFF1E3A1E); // Subtle green border
const Color kDarkPrimary  = Color(0xFF15803D); // Deep emerald green
const Color kDarkMid      = Color(0xFF16A34A); // Mid emerald green
const Color kDarkAccent   = Color(0xFF4ADE80); // Mint green (glow)
const Color kDarkAccentDim= Color(0xFF22C55E); // Dimmed green accent
const Color kDarkText     = Color(0xFFF0FDF4); // Off-white green tint
const Color kDarkTextSub  = Color(0xFF86EFAC); // Muted green text
const Color kDarkMuted    = Color(0xFF4ADE80); // Muted elements
const Color kDarkGlow     = Color(0xFF22C55E); // Neon green glow

const LinearGradient kPrimaryGradient = LinearGradient(
  colors: [kPrimaryMid, kPrimary],
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
);

const LinearGradient kGlassGradient = LinearGradient(
  colors: [
    Color(0xCCFFFFFF), // 80% opacity white
    Color(0x99FFFFFF), // 60% opacity white
  ],
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
);
