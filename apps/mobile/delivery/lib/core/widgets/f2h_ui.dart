// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Delivery
// File        : f2h_ui.dart
// Description : The shared surface vocabulary for the partner app.
//
//               `F2hAppBar` was already marked the reference standard but only
//               three of twenty-eight screens used it, so every other screen
//               hand-rolled its own header, card and spacing. That drift is why
//               the app had two different home headers. These are the pieces
//               each screen composes from instead of re-inventing them.
//
//               Colours come from theme/app_colors.dart — nothing here defines
//               its own palette.
// ============================================================================

import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

// ── Metrics ────────────────────────────────────────────────────────────────
// Named so spacing and rounding stay in step across screens; the previous
// screens used values between 8 and 24 more or less arbitrarily.
abstract final class F2hSpace {
  static const double xs = 6;
  static const double sm = 10;
  static const double md = 16;
  static const double lg = 22;
  static const double xl = 30;
}

abstract final class F2hRadius {
  static const double card = 20;
  static const double pill = 999;
  static const double field = 14;
}

/// The one card surface. A single soft shadow plus a hairline border reads as
/// depth without the heavy elevation the older screens used.
class F2hCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final Color? color;
  final Color? borderColor;
  final VoidCallback? onTap;

  const F2hCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(F2hSpace.md),
    this.margin,
    this.color,
    this.borderColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? kSurface,
        borderRadius: BorderRadius.circular(F2hRadius.card),
        border: Border.all(color: borderColor ?? kBorder),
        boxShadow: const [
          BoxShadow(color: Color(0x0F0F172A), blurRadius: 14, offset: Offset(0, 4)),
        ],
      ),
      child: child,
    );

    return Padding(
      padding: margin ?? EdgeInsets.zero,
      child: onTap == null
          ? card
          : InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(F2hRadius.card),
              child: card,
            ),
    );
  }
}

/// Section heading with an optional trailing action ("Today's Progress · View Details").
class F2hSectionTitle extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const F2hSectionTitle({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, F2hSpace.lg, 0, F2hSpace.sm),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: kText,
                letterSpacing: -0.3,
              ),
            ),
          ),
          if (actionLabel != null)
            GestureDetector(
              onTap: onAction,
              behavior: HitTestBehavior.opaque,
              child: Text(
                actionLabel!,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: kPrimary,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// One figure in a stat row — the Completed / Ongoing / Accepted / Cancelled tiles.
class F2hStatTile extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color tint;

  const F2hStatTile({
    super.key,
    required this.icon,
    required this.value,
    required this.label,
    required this.tint,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: tint.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 20, color: tint),
        ),
        const SizedBox(height: F2hSpace.sm),
        Text(
          value,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: kText,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: tint),
        ),
      ],
    );
  }
}

/// Status pill — "Assigned", "Delivered", "Morning", "Prepaid".
class F2hChip extends StatelessWidget {
  final String label;
  final Color tint;
  final IconData? icon;

  const F2hChip({super.key, required this.label, required this.tint, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: tint.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(F2hRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: tint),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              color: tint,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

/// Full-width primary action. Carries its own busy state so screens stop
/// re-implementing "disable and swap in a spinner".
class F2hPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final bool loading;
  final Color? color;

  const F2hPrimaryButton({
    super.key,
    required this.label,
    this.onTap,
    this.icon,
    this.loading = false,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null && !loading;
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: enabled ? onTap : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: color ?? kPrimary,
          disabledBackgroundColor: (color ?? kPrimary).withValues(alpha: 0.45),
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(F2hRadius.field),
          ),
        ),
        child: loading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[Icon(icon, size: 19), const SizedBox(width: 8)],
                  Text(
                    label,
                    style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
      ),
    );
  }
}

/// Outlined counterpart for the secondary action in a pair.
class F2hSecondaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final Color? color;

  const F2hSecondaryButton({
    super.key,
    required this.label,
    this.onTap,
    this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final tint = color ?? kPrimary;
    return SizedBox(
      height: 52,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          foregroundColor: tint,
          side: BorderSide(color: tint.withValues(alpha: 0.4)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(F2hRadius.field),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 7)],
            Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}

/// Shown when a list has nothing in it — previously each screen invented its own.
class F2hEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  const F2hEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(F2hSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 74,
              height: 74,
              decoration: const BoxDecoration(color: kPrimaryPl, shape: BoxShape.circle),
              child: Icon(icon, size: 34, color: kPrimary),
            ),
            const SizedBox(height: F2hSpace.md),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16.5,
                fontWeight: FontWeight.w800,
                color: kText,
              ),
            ),
            if (message != null) ...[
              const SizedBox(height: F2hSpace.xs),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13.5, color: kTextSub, height: 1.45),
              ),
            ],
            if (action != null) ...[const SizedBox(height: F2hSpace.lg), action!],
          ],
        ),
      ),
    );
  }
}
