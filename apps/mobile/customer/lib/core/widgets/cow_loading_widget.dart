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
    final barWidth = loadingBarWidth ?? (size * 0.75).clamp(64.0, 220.0);
    final barHeight = (size * 0.05).clamp(4.0, 8.0);

    final content = Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(
          width: size,
          height: size * 0.65,
          child: Lottie.asset(
            'assets/loading/cow_drink_milk.json',
            width: size,
            height: size * 0.65,
            fit: BoxFit.contain,
            repeat: true,
            animate: true,
            errorBuilder: (context, error, stackTrace) {
              return Center(
                child: SizedBox(
                  width: size * 0.4,
                  height: size * 0.4,
                  child: const CircularProgressIndicator(
                    color: kPrimary,
                    strokeWidth: 2.5,
                  ),
                ),
              );
            },
          ),
        ),
        if (showLoadingBar) ...[
          const SizedBox(height: 6),
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

/// Standalone Green Loading Bar Lottie Animation Widget
class GreenLoadingBar extends StatelessWidget {
  final double width;
  final double height;

  const GreenLoadingBar({
    super.key,
    this.width = 120,
    this.height = 6,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(height / 2),
        child: Lottie.asset(
          'assets/loading/green_loading_bar.json',
          width: width,
          height: height,
          fit: BoxFit.fill,
          repeat: true,
          animate: true,
          errorBuilder: (context, error, stackTrace) {
            return LinearProgressIndicator(
              backgroundColor: const Color(0xFFDCFCE7),
              valueColor: const AlwaysStoppedAnimation<Color>(kPrimary),
              minHeight: height,
            );
          },
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
