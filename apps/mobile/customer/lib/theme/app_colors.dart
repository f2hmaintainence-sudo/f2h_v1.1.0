// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : app_colors.dart
// Description : Web Admin aligned theme colors with glassmorphism palette.
//
// ============================================================================

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

// ══════════════════════════════════════════════════════════
//  GLASSMORPHISM STYLES & GRADIENTS
// ══════════════════════════════════════════════════════════
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

class AppColors {
  // Semantic Colors mapped to F2H Premium Palette
  static const Color primary = kPrimary;
  static const Color primaryDark = kPrimaryMid;
  static const Color secondary = kPrimaryLt;
  static const Color accent = kAccent;
  
  static const Color success = kPrimary;
  static const Color warning = kAccent;
  static const Color error = kRed;

  static const Color background = kBg;
  static const Color surface = kSurface;
  static const Color surfaceSoft = kPrimaryPl;
  static const Color surfaceAlt = kBgDeep;

  static const Color textPrimary = kText;
  static const Color textSecondary = kTextMid;
  static const Color textMuted = kTextSub;

  static const Color border = kBorder;
  static const Color divider = kBorderLt;
  static const Color shadow = Color(0x0A0F172A);
}
