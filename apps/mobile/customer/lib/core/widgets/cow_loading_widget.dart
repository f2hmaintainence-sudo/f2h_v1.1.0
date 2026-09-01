// ═══════════════════════════════════════════════════════════════════════════
//  COW DRINK MILK LOTTIE LOADING WIDGET
//
//  Renders the custom "Cow Drink Milk" Lottie animation with an animated
//  green progress bar for app loading screens, overlays, pull-to-refresh,
//  catalog loaders, and order processing.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class CowLoadingWidget extends StatelessWidget {
  /// Width & Height of the Lottie animation
  final double size;

  /// Optional message string under the animation
  final String? message;

  /// Background color of the container card (default: transparent)
  final Color? backgroundColor;

  /// Whether to show in a card container with rounded corners & shadow
  final bool showCard;

  /// Whether to show the animated green loading bar below the cow animation
  final bool showLoadingBar;

  /// Custom width for the green loading bar (defaults to scaled proportion)
  final double? loadingBarWidth;

  const CowLoadingWidget({
    super.key,
    this.size = 120,
    this.message,
    this.backgroundColor,
    this.showCard = false,
    this.showLoadingBar = true,
    this.loadingBarWidth,
  });

  @override
  Widget build(BuildContext context) {
    final barWidth = loadingBarWidth ?? (size * 0.65).clamp(48.0, 160.0);
    final barHeight = (size * 0.045).clamp(4.0, 7.0);

    final content = Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(
          width: size,
          height: size * 0.36,
          child: OverflowBox(
            maxHeight: size * 0.58,
            minHeight: size * 0.58,
            maxWidth: size,
            minWidth: size,
            alignment: Alignment.topCenter,
            child: Lottie.asset(
              'assets/loading/cow_drink_milk.json',
              width: size,
              height: size * 0.58,
              fit: BoxFit.contain,
              repeat: true,
              animate: true,
              filterQuality: FilterQuality.medium,
              errorBuilder: (context, error, stackTrace) {
                return Center(
                  child: SizedBox(
                    width: size * 0.30,
                    height: size * 0.30,
                    child: const CircularProgressIndicator(
                      color: kPrimary,
                      strokeWidth: 2.5,
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        if (showLoadingBar) ...[
          const SizedBox(height: 4),
          GreenLoadingBar(
            width: barWidth,
            height: barHeight,
          ),
        ],
        if (message != null && message!.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(
            message!,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: kText,
              letterSpacing: -0.2,
            ),
          ),
        ],
      ],
    );

    if (!showCard) {
      return Center(child: content);
    }

    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        decoration: BoxDecoration(
          color: backgroundColor ?? Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: content,
      ),
    );
  }
}

/// Hardware-accelerated, ultra-smooth Green Loading Bar
class GreenLoadingBar extends StatefulWidget {
  final double width;
  final double height;

  const GreenLoadingBar({
    super.key,
    this.width = 120,
    this.height = 6,
  });

  @override
  State<GreenLoadingBar> createState() => _GreenLoadingBarState();
}

class _GreenLoadingBarState extends State<GreenLoadingBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1300),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final barWidth = widget.width;
    final barHeight = widget.height;
    final pillWidth = (barWidth * 0.42).clamp(24.0, 80.0);

    return SizedBox(
      width: barWidth,
      height: barHeight,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(barHeight / 2),
        child: Stack(
          children: [
            // Background track
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(barHeight / 2),
                ),
              ),
            ),
            // Smooth moving glowing gradient pill
            AnimatedBuilder(
              animation: _ctrl,
              builder: (context, _) {
                final curved = Curves.easeInOutCubic.transform(_ctrl.value);
                final maxOffset = barWidth - pillWidth;
                final left = maxOffset * curved;

                return Positioned(
                  left: left,
                  top: 0,
                  bottom: 0,
                  width: pillWidth,
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(barHeight / 2),
                      gradient: const LinearGradient(
                        colors: [
                          Color(0xFF16A34A),
                          Color(0xFF22C55E),
                          Color(0xFF4ADE80),
                        ],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF16A34A).withValues(alpha: 0.35),
                          blurRadius: 3,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// Full screen loading overlay with blur/scrim and Cow Loading Animation
class CowLoadingOverlay extends StatelessWidget {
  final String? message;
  final double size;

  const CowLoadingOverlay({
    super.key,
    this.message = 'Loading fresh farm products...',
    this.size = 130,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white.withValues(alpha: 0.85),
      child: CowLoadingWidget(
        size: size,
        message: message,
        showCard: true,
      ),
    );
  }
}
