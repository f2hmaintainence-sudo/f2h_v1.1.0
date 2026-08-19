// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Delivery
// File        : auth_kit.dart
// Description : Shared building blocks for every delivery-partner auth
//               screen — decorated white canvas, brand lockup, underlined
//               fields, pill CTA and Google sign-in.
// ============================================================================

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:f2h_delivery/theme/app_colors.dart';

// ══════════════════════════════════════════════════════════
//  TOKENS
// ══════════════════════════════════════════════════════════

const Color kAuthInk = Color(0xFF141B17);
const Color kAuthHint = Color(0xFF9AA5A0);
const Color kAuthLine = Color(0xFFE0E6E2);
const Color kAuthSubtitle = Color(0xFF6D7B73);

// ══════════════════════════════════════════════════════════
//  AUTH SCAFFOLD
// ══════════════════════════════════════════════════════════

/// Frame shared by every delivery auth screen: decorated white canvas,
/// centred brand lockup, then a two-tone headline over [children].
class DeliveryAuthScaffold extends StatelessWidget {
  /// Leading half of the headline, rendered in ink.
  final String title;

  /// Trailing half of the headline, rendered in brand green.
  final String titleAccent;
  final String subtitle;
  final List<Widget> children;
  final bool showBack;

  const DeliveryAuthScaffold({
    super.key,
    required this.title,
    required this.titleAccent,
    required this.subtitle,
    required this.children,
    this.showBack = false,
  });

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: Colors.white,
        body: Stack(
          children: [
            const Positioned.fill(child: DeliveryAuthBackdrop()),
            SafeArea(
              child: Stack(
                children: [
                  if (showBack)
                    Positioned(
                      top: 4,
                      left: 8,
                      child: IconButton(
                        icon: const Icon(
                          Icons.arrow_back_rounded,
                          color: kAuthInk,
                        ),
                        onPressed: () => Navigator.maybePop(context),
                      ),
                    ),
                  SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(
                      28,
                      36,
                      28,
                      28 + MediaQuery.of(context).viewInsets.bottom,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const _BrandLockup(),
                        const SizedBox(height: 34),
                        _Headline(title: title, accent: titleAccent),
                        const SizedBox(height: 10),
                        Text(
                          subtitle,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.poppins(
                            fontSize: 14.5,
                            color: kAuthSubtitle,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 18),
                        const Center(child: _AccentRule()),
                        const SizedBox(height: 30),
                        ...children,
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Headline extends StatelessWidget {
  final String title;
  final String accent;
  const _Headline({required this.title, required this.accent});

  @override
  Widget build(BuildContext context) => RichText(
    textAlign: TextAlign.center,
    text: TextSpan(
      text: '$title ',
      style: GoogleFonts.poppins(
        fontSize: 33,
        fontWeight: FontWeight.w800,
        color: kAuthInk,
        letterSpacing: -0.8,
        height: 1.15,
      ),
      children: [
        TextSpan(
          text: accent,
          style: GoogleFonts.poppins(
            fontSize: 33,
            fontWeight: FontWeight.w800,
            color: kPrimary,
            letterSpacing: -0.8,
          ),
        ),
      ],
    ),
  );
}

class _AccentRule extends StatelessWidget {
  const _AccentRule();

  @override
  Widget build(BuildContext context) => Container(
    width: 56,
    height: 3.5,
    decoration: BoxDecoration(
      color: kPrimaryMid,
      borderRadius: BorderRadius.circular(3),
    ),
  );
}

/// App icon plus the "F2H DELIVERY" wordmark.
class _BrandLockup extends StatelessWidget {
  const _BrandLockup();

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        width: 96,
        height: 96,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: kPrimary.withValues(alpha: 0.22),
              blurRadius: 26,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Image.asset(
            'assets/icon/delivery_logo.png',
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => Image.asset(
              'assets/icon/app_icon.png',
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => Container(
                color: kPrimary,
                child: const Icon(
                  Icons.delivery_dining_rounded,
                  color: Colors.white,
                  size: 44,
                ),
              ),
            ),
          ),
        ),
      ),
      const SizedBox(height: 18),
      Text(
        'F2H DELIVERY',
        style: GoogleFonts.poppins(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: kPrimaryMid,
          letterSpacing: 5,
        ),
      ),
    ],
  );
}

// ══════════════════════════════════════════════════════════
//  BACKDROP — dot grids, arcs and a soft green wash
// ══════════════════════════════════════════════════════════

class DeliveryAuthBackdrop extends StatelessWidget {
  const DeliveryAuthBackdrop({super.key});

  @override
  Widget build(BuildContext context) => CustomPaint(
    painter: _BackdropPainter(),
    size: Size.infinite,
  );
}

class _BackdropPainter extends CustomPainter {
  void _dotGrid(Canvas canvas, Offset origin, int cols, int rows) {
    final paint = Paint()..color = kPrimaryMid.withValues(alpha: 0.13);
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        canvas.drawCircle(
          origin + Offset(c * 13.0, r * 13.0),
          1.6,
          paint,
        );
      }
    }
  }

  @override
  void paint(Canvas canvas, Size size) {
    // Soft green wash sweeping in from the bottom-left.
    final wash = Path()
      ..moveTo(0, size.height * 0.62)
      ..quadraticBezierTo(
        size.width * 0.22,
        size.height * 0.74,
        size.width * 0.18,
        size.height,
      )
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(
      wash,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [
            kPrimaryLt.withValues(alpha: 0.10),
            kPrimaryLt.withValues(alpha: 0.26),
          ],
        ).createShader(Offset.zero & size),
    );

    // Mirrored wash top-left, keeping the canvas from feeling empty.
    final topWash = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width * 0.42, 0)
      ..quadraticBezierTo(
        size.width * 0.16,
        size.height * 0.10,
        0,
        size.height * 0.20,
      )
      ..close();
    canvas.drawPath(
      topWash,
      Paint()..color = kPrimaryPl.withValues(alpha: 0.35),
    );

    // Thin concentric arcs in the top-right corner.
    final arcPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..color = kPrimaryMid.withValues(alpha: 0.18);
    for (var i = 0; i < 3; i++) {
      canvas.drawArc(
        Rect.fromCircle(
          center: Offset(size.width * 1.02, -size.height * 0.02),
          radius: size.width * (0.26 + i * 0.075),
        ),
        math.pi * 0.52,
        math.pi * 0.44,
        false,
        arcPaint,
      );
    }

    _dotGrid(canvas, const Offset(18, 22), 7, 5);
    _dotGrid(
      canvas,
      Offset(size.width - 105, size.height - 118),
      7,
      6,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ══════════════════════════════════════════════════════════
//  FORM CONTROLS
// ══════════════════════════════════════════════════════════

/// Underlined field: leading icon, hint, and a rule that turns green on focus.
class DeliveryAuthField extends StatefulWidget {
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final TextInputType keyboardType;
  final bool isPassword;
  final TextInputAction textInputAction;
  final List<TextInputFormatter>? inputFormatters;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;
  final Widget? trailing;
  final int? maxLength;
  final TextCapitalization textCapitalization;

  const DeliveryAuthField({
    super.key,
    required this.controller,
    required this.hint,
    required this.icon,
    this.keyboardType = TextInputType.text,
    this.isPassword = false,
    this.textInputAction = TextInputAction.next,
    this.inputFormatters,
    this.onSubmitted,
    this.onChanged,
    this.trailing,
    this.maxLength,
    this.textCapitalization = TextCapitalization.none,
  });

  @override
  State<DeliveryAuthField> createState() => _DeliveryAuthFieldState();
}

class _DeliveryAuthFieldState extends State<DeliveryAuthField> {
  bool _obscure = true;
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    return Focus(
      onFocusChange: (f) => setState(() => _focused = f),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                widget.icon,
                size: 22,
                color: _focused ? kPrimary : kPrimaryMid.withValues(alpha: 0.8),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  keyboardType: widget.keyboardType,
                  obscureText: widget.isPassword && _obscure,
                  textInputAction: widget.textInputAction,
                  inputFormatters: widget.inputFormatters,
                  maxLength: widget.maxLength,
                  textCapitalization: widget.textCapitalization,
                  onSubmitted: widget.onSubmitted,
                  onChanged: widget.onChanged,
                  onTapOutside: (_) => FocusScope.of(context).unfocus(),
                  style: GoogleFonts.poppins(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w500,
                    color: kAuthInk,
                  ),
                  decoration: InputDecoration(
                    counterText: '',
                    isDense: true,
                    hintText: widget.hint,
                    hintStyle: GoogleFonts.poppins(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w400,
                      color: kAuthHint,
                    ),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
              if (widget.isPassword)
                IconButton(
                  splashRadius: 20,
                  icon: Icon(
                    _obscure
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    size: 21,
                    color: kAuthHint,
                  ),
                  onPressed: () => setState(() => _obscure = !_obscure),
                )
              else if (widget.trailing != null)
                widget.trailing!,
            ],
          ),
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            height: _focused ? 1.8 : 1.2,
            color: _focused ? kPrimary : kAuthLine,
          ),
        ],
      ),
    );
  }
}

/// Full-width green pill CTA with trailing arrow.
class DeliveryPrimaryButton extends StatefulWidget {
  final String label;
  final IconData icon;
  final bool loading;
  final VoidCallback? onTap;

  const DeliveryPrimaryButton({
    super.key,
    required this.label,
    required this.onTap,
    this.loading = false,
    this.icon = Icons.arrow_forward_rounded,
  });

  @override
  State<DeliveryPrimaryButton> createState() => _DeliveryPrimaryButtonState();
}

class _DeliveryPrimaryButtonState extends State<DeliveryPrimaryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null && !widget.loading;
    return GestureDetector(
      onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
      onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
      onTapUp: enabled
          ? (_) {
              setState(() => _pressed = false);
              widget.onTap?.call();
            }
          : null,
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 110),
        child: Container(
          height: 60,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: enabled
                  ? const [kPrimaryLt, kPrimaryMid]
                  : [kMuted, kMuted],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
            borderRadius: BorderRadius.circular(999),
            boxShadow: enabled
                ? [
                    BoxShadow(
                      color: kPrimary.withValues(alpha: 0.34),
                      blurRadius: 22,
                      offset: const Offset(0, 10),
                    ),
                  ]
                : null,
          ),
          child: Center(
            child: widget.loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2.4,
                    ),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.label,
                        style: GoogleFonts.poppins(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                          letterSpacing: 0.2,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Icon(widget.icon, color: Colors.white, size: 20),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

/// "OR" rule.
class DeliveryAuthDivider extends StatelessWidget {
  final String label;
  const DeliveryAuthDivider({super.key, this.label = 'OR'});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Expanded(child: Divider(color: kAuthLine, thickness: 1.2)),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18),
        child: Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: kAuthHint,
            letterSpacing: 1.2,
          ),
        ),
      ),
      const Expanded(child: Divider(color: kAuthLine, thickness: 1.2)),
    ],
  );
}

/// Full-width "Continue with Google" pill.
class DeliveryGoogleButton extends StatelessWidget {
  final VoidCallback? onTap;
  final bool loading;
  final String label;

  const DeliveryGoogleButton({
    super.key,
    required this.onTap,
    this.loading = false,
    this.label = 'Continue with Google',
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: loading ? null : onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      height: 60,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: kAuthLine, width: 1.4),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.035),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Center(
        child: loading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  color: kPrimary,
                  strokeWidth: 2.2,
                ),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SvgPicture.asset(
                    'assets/icons/google.svg',
                    width: 23,
                    height: 23,
                    placeholderBuilder: (_) => const Icon(
                      Icons.g_mobiledata_rounded,
                      size: 28,
                      color: kTextSub,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Text(
                    label,
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: const Color(0xFF3C4A42),
                    ),
                  ),
                ],
              ),
      ),
    ),
  );
}

/// "Don't have an account? Sign Up" footer.
class DeliveryAuthFooter extends StatelessWidget {
  final String question;
  final String action;
  final VoidCallback onTap;

  const DeliveryAuthFooter({
    super.key,
    required this.question,
    required this.action,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => Center(
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: RichText(
          text: TextSpan(
            text: '$question ',
            style: GoogleFonts.poppins(color: kAuthSubtitle, fontSize: 14.5),
            children: [
              TextSpan(
                text: action,
                style: GoogleFonts.poppins(
                  color: kPrimaryMid,
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Inline text link, right-aligned by default.
class DeliveryTextLink extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final Alignment alignment;

  const DeliveryTextLink({
    super.key,
    required this.label,
    required this.onTap,
    this.alignment = Alignment.centerRight,
  });

  @override
  Widget build(BuildContext context) => Align(
    alignment: alignment,
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: kPrimaryMid,
          ),
        ),
      ),
    ),
  );
}
