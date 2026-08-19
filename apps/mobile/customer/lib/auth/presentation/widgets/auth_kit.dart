// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : auth_kit.dart
// Description : Shared building blocks for every customer authentication
//               screen — leafy brand hero, curved sheet, fields, CTA,
//               Google sign-in button and footer prompt.
// ============================================================================

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'package:f2h_customer/theme/app_colors.dart';

// ══════════════════════════════════════════════════════════
//  BRAND TOKENS — shared by every auth screen
// ══════════════════════════════════════════════════════════

/// Deep brand green used for the wordmark on the light hero.
const Color kAuthBrandInk = Color(0xFF14532D);

/// Very light mint the hero fades from.
const Color kAuthHeroTop = Color(0xFFDDF3E2);
const Color kAuthHeroMid = Color(0xFFEAF7EC);

const Color kAuthFieldBg = Color(0xFFFCFDFC);
const Color kAuthFieldBorder = Color(0xFFE3EAE5);
const Color kAuthHint = Color(0xFF9AA5A0);
const Color kAuthSubtitle = Color(0xFF7E8F84);

// ══════════════════════════════════════════════════════════
//  AUTH SCAFFOLD — leafy hero + curved white sheet
// ══════════════════════════════════════════════════════════

/// The frame every customer auth screen sits in.
///
/// Renders the mint hero with the F2H mark on top and a curved white sheet
/// carrying [children]. The hero collapses while the keyboard is open so the
/// form keeps as much room as possible.
class AuthScaffold extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<Widget> children;

  /// Optional pill rendered in the hero's top-right corner (e.g. "Skip").
  final Widget? heroAction;

  /// Shows a back chevron in the hero's top-left corner.
  final bool showBack;

  const AuthScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
    this.heroAction,
    this.showBack = false,
  });

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final heroHeight = math.min(media.size.height * 0.38, 320.0);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: Colors.white,
        resizeToAvoidBottomInset: true,
        body: Stack(
          children: [
            const Positioned.fill(child: _LeafyHeroBackground()),

            // Hero and sheet scroll together, so nothing ever slides under
            // the curve and gets clipped.
            SafeArea(
              bottom: false,
              child: SingleChildScrollView(
                padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
                child: Column(
                  children: [
                    SizedBox(height: heroHeight, child: const _HeroBrand()),
                    _FormSheet(
                      title: title,
                      subtitle: subtitle,
                      minHeight: media.size.height - heroHeight,
                      children: children,
                    ),
                  ],
                ),
              ),
            ),

            // Back and Skip stay pinned while the page scrolls beneath them.
            SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 16, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (showBack)
                      _HeroCircleButton(
                        icon: Icons.arrow_back_rounded,
                        onTap: () => Navigator.maybePop(context),
                      )
                    else
                      const SizedBox.shrink(),
                    if (heroAction != null)
                      heroAction!
                    else
                      const SizedBox.shrink(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// White sheet with the curved top edge, carrying the form.
class _FormSheet extends StatelessWidget {
  final String title;
  final String subtitle;
  final double minHeight;
  final List<Widget> children;

  const _FormSheet({
    required this.title,
    required this.subtitle,
    required this.minHeight,
    required this.children,
  });

  @override
  Widget build(BuildContext context) => ClipPath(
    clipper: _AuthSheetClipper(),
    child: Container(
      width: double.infinity,
      color: Colors.white,
      constraints: BoxConstraints(minHeight: math.max(minHeight, 0)),
      // Top padding clears the curve so no field is ever cut by it.
      padding: const EdgeInsets.fromLTRB(24, 78, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 21,
              fontWeight: FontWeight.w800,
              color: Color(0xFF17211B),
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w500,
              color: kAuthSubtitle,
            ),
          ),
          const SizedBox(height: 14),
          const Center(child: _AccentRule()),
          const SizedBox(height: 22),
          ...children,
        ],
      ),
    ),
  );
}

/// Short green underline that sits under the sheet's subtitle.
class _AccentRule extends StatelessWidget {
  const _AccentRule();

  @override
  Widget build(BuildContext context) => Container(
    width: 64,
    height: 3,
    decoration: BoxDecoration(
      gradient: const LinearGradient(colors: [kPrimaryMid, kPrimaryLt]),
      borderRadius: BorderRadius.circular(3),
    ),
  );
}

/// Logo and wordmark. Scrolls with the sheet.
class _HeroBrand extends StatelessWidget {
  const _HeroBrand();

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 92,
          height: 92,
          decoration: BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: kPrimaryMid.withValues(alpha: 0.14),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          padding: const EdgeInsets.all(14),
          child: const _BrandMark(),
        ),
        const SizedBox(height: 14),
        const Text(
          'F2H',
          style: TextStyle(
            fontSize: 42,
            height: 1.0,
            fontWeight: FontWeight.w900,
            color: kAuthBrandInk,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 8),
        const _WordmarkRule(),
      ],
    ),
  );
}

/// "— FARM TO HOME —" rule under the F2H wordmark.
class _WordmarkRule extends StatelessWidget {
  const _WordmarkRule();

  @override
  Widget build(BuildContext context) => FittedBox(
    fit: BoxFit.scaleDown,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 22,
          height: 1.4,
          color: kPrimaryMid.withValues(alpha: 0.5),
        ),
        const SizedBox(width: 10),
        const Text(
          'FARM TO HOME',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: kPrimaryMid,
            letterSpacing: 4.0,
          ),
        ),
        const SizedBox(width: 10),
        Container(
          width: 22,
          height: 1.4,
          color: kPrimaryMid.withValues(alpha: 0.5),
        ),
      ],
    ),
  );
}

/// The bundled app icon, degrading to a leaf glyph if the asset is missing.
class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) => Image.asset(
    'assets/icon/app_logo.png',
    fit: BoxFit.contain,
    errorBuilder: (_, _, _) => Image.asset(
      'assets/icon/app_icon.png',
      fit: BoxFit.contain,
      errorBuilder: (_, _, _) =>
          const Icon(Icons.eco_rounded, color: kPrimary, size: 34),
    ),
  );
}

class _HeroCircleButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _HeroCircleButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: kPrimaryMid.withValues(alpha: 0.12),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Icon(icon, size: 19, color: kAuthBrandInk),
    ),
  );
}

/// White "Skip →" pill for the hero's top-right corner.
class AuthSkipButton extends StatelessWidget {
  final VoidCallback onTap;
  const AuthSkipButton({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        boxShadow: [
          BoxShadow(
            color: kPrimaryMid.withValues(alpha: 0.12),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: const FittedBox(
        fit: BoxFit.scaleDown,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Skip',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: kAuthBrandInk,
              ),
            ),
            SizedBox(width: 8),
            Icon(Icons.arrow_forward_rounded, size: 16, color: kAuthBrandInk),
          ],
        ),
      ),
    ),
  );
}

// ══════════════════════════════════════════════════════════
//  HERO BACKGROUND — mint wash, soft blobs, drifting leaves
// ══════════════════════════════════════════════════════════

class _LeafyHeroBackground extends StatelessWidget {
  const _LeafyHeroBackground();

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      Positioned.fill(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: const [kAuthHeroTop, kAuthHeroMid, Colors.white],
              stops: const [0.0, 0.55, 1.0],
            ),
          ),
        ),
      ),
      Positioned.fill(child: CustomPaint(painter: _HeroBlobPainter())),
      const Positioned(top: 96, left: 26, child: _Leaf(size: 30, turns: -0.12)),
      const Positioned(top: 62, right: 34, child: _Leaf(size: 26, turns: 0.18)),
      const Positioned(
        top: 150,
        right: 18,
        child: _Leaf(size: 38, turns: 0.42),
      ),
    ],
  );
}

class _HeroBlobPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    void blob(Offset center, double radius, Color color) {
      canvas.drawCircle(
        center,
        radius,
        Paint()
          ..shader = RadialGradient(
            colors: [color, color.withValues(alpha: 0.0)],
          ).createShader(Rect.fromCircle(center: center, radius: radius)),
      );
    }

    blob(
      Offset(size.width * 0.16, size.height * 0.10),
      130,
      Colors.white.withValues(alpha: 0.9),
    );
    blob(
      Offset(size.width * 0.88, size.height * 0.06),
      110,
      Colors.white.withValues(alpha: 0.75),
    );
    blob(
      Offset(size.width * 0.72, size.height * 0.22),
      140,
      kPrimaryLt.withValues(alpha: 0.16),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _Leaf extends StatelessWidget {
  final double size;
  final double turns;
  const _Leaf({required this.size, required this.turns});

  @override
  Widget build(BuildContext context) => Transform.rotate(
    angle: turns * math.pi,
    child: Icon(
      Icons.energy_savings_leaf_rounded,
      size: size,
      color: kPrimaryMid.withValues(alpha: 0.28),
    ),
  );
}

/// Curves the top edge of the white form sheet.
class _AuthSheetClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final w = size.width;
    return Path()
      ..moveTo(0, size.height)
      ..lineTo(0, 62)
      ..cubicTo(w * 0.22, 0, w * 0.78, 0, w, 62)
      ..lineTo(w, size.height)
      ..close();
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

// ══════════════════════════════════════════════════════════
//  FORM CONTROLS
// ══════════════════════════════════════════════════════════

/// Rounded field used across every customer auth form.
class AuthField extends StatefulWidget {
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
  final bool enabled;
  final int? maxLength;

  const AuthField({
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
    this.enabled = true,
    this.maxLength,
  });

  @override
  State<AuthField> createState() => _AuthFieldState();
}

class _AuthFieldState extends State<AuthField> {
  bool _obscure = true;
  bool _focused = false;

  /// One painter owns the whole box. The app theme sets `filled: true` with a
  /// square fill and its own error borders, so every slot is overridden here —
  /// otherwise the theme fill paints over the rounded corners and the focus
  /// ring reads as a broken, doubled border.
  OutlineInputBorder _border(Color color, double width) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(14),
    borderSide: BorderSide(color: color, width: width),
  );

  @override
  Widget build(BuildContext context) {
    return Focus(
      canRequestFocus: false,
      onFocusChange: (f) => setState(() => _focused = f),
      child: TextField(
        controller: widget.controller,
        enabled: widget.enabled,
        keyboardType: widget.keyboardType,
        obscureText: widget.isPassword && _obscure,
        textInputAction: widget.textInputAction,
        inputFormatters: widget.inputFormatters,
        maxLength: widget.maxLength,
        onSubmitted: widget.onSubmitted,
        onChanged: widget.onChanged,
        onTapOutside: (_) => FocusScope.of(context).unfocus(),
        cursorColor: kPrimary,
        style: const TextStyle(
          fontSize: 14.5,
          fontWeight: FontWeight.w600,
          color: Color(0xFF17211B),
        ),
        decoration: InputDecoration(
          counterText: '',
          isDense: false,
          filled: true,
          fillColor: widget.enabled ? kAuthFieldBg : const Color(0xFFF3F5F4),
          prefixIcon: Icon(
            widget.icon,
            size: 21,
            color: _focused ? kPrimary : kPrimaryMid.withValues(alpha: 0.75),
          ),
          prefixIconConstraints: const BoxConstraints(minWidth: 46),
          hintText: widget.hint,
          hintStyle: const TextStyle(
            color: kAuthHint,
            fontSize: 14.5,
            fontWeight: FontWeight.w500,
          ),
          // Same stroke width in every state so focusing never shifts layout.
          border: _border(kAuthFieldBorder, 1.4),
          enabledBorder: _border(kAuthFieldBorder, 1.4),
          focusedBorder: _border(kPrimary, 1.4),
          disabledBorder: _border(kAuthFieldBorder, 1.4),
          errorBorder: _border(kRed, 1.4),
          focusedErrorBorder: _border(kRed, 1.4),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 18,
          ),
          suffixIcon: widget.isPassword
              ? IconButton(
                  splashRadius: 20,
                  icon: Icon(
                    _obscure
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    size: 20,
                    color: kAuthHint,
                  ),
                  onPressed: () => setState(() => _obscure = !_obscure),
                )
              : widget.trailing,
        ),
      ),
    );
  }
}

/// Green gradient CTA with a trailing arrow.
class AuthPrimaryButton extends StatelessWidget {
  final String label;
  final bool loading;
  final VoidCallback? onTap;
  final IconData icon;

  const AuthPrimaryButton({
    super.key,
    required this.label,
    required this.onTap,
    this.loading = false,
    this.icon = Icons.arrow_forward_rounded,
  });

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null && !loading;
    return Opacity(
      opacity: enabled ? 1 : 0.7,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [kPrimaryLt, kPrimaryMid],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
            borderRadius: BorderRadius.circular(14),
            boxShadow: enabled
                ? [
                    BoxShadow(
                      color: kPrimary.withValues(alpha: 0.32),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ]
                : null,
          ),
          child: Center(
            child: loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2.4,
                    ),
                  )
                : Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            label,
                            style: const TextStyle(
                              fontSize: 16.5,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              letterSpacing: 0.2,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Icon(icon, size: 19, color: Colors.white),
                        ],
                      ),
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

/// "or continue with" rule.
class AuthDivider extends StatelessWidget {
  final String label;
  const AuthDivider({super.key, this.label = 'or continue with'});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Expanded(child: Divider(color: kAuthFieldBorder, thickness: 1.2)),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w500,
            color: kAuthHint,
          ),
        ),
      ),
      const Expanded(child: Divider(color: kAuthFieldBorder, thickness: 1.2)),
    ],
  );
}

/// Full-width "Continue with Google" button.
class GoogleAuthButton extends StatelessWidget {
  final VoidCallback? onTap;
  final bool loading;
  final String label;

  const GoogleAuthButton({
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
      height: 56,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: kAuthFieldBorder, width: 1.4),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
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
            : Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const GoogleGlyph(size: 22),
                      const SizedBox(width: 12),
                      Text(
                        label,
                        style: const TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF3C4A42),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    ),
  );
}

/// Multi-colour Google "G", falling back to a glyph if the SVG is absent.
class GoogleGlyph extends StatelessWidget {
  final double size;
  const GoogleGlyph({super.key, this.size = 22});

  @override
  Widget build(BuildContext context) => SvgPicture.asset(
    'assets/icons/google.svg',
    width: size,
    height: size,
    placeholderBuilder: (_) =>
        Icon(Icons.g_mobiledata_rounded, size: size + 6, color: kTextMid),
  );
}

/// "Don't have an account? Sign Up" style footer.
class AuthFooterPrompt extends StatelessWidget {
  final String question;
  final String action;
  final VoidCallback onTap;

  const AuthFooterPrompt({
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
            style: const TextStyle(
              color: kAuthSubtitle,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
            children: [
              TextSpan(
                text: action,
                style: const TextStyle(
                  color: kPrimaryMid,
                  fontSize: 14.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Right-aligned "Forgot Password?" link.
class AuthTextLink extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final Alignment alignment;

  const AuthTextLink({
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
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
            color: kPrimaryMid,
          ),
        ),
      ),
    ),
  );
}
