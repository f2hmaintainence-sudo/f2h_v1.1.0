import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:f2h_customer/core/services/app_asset_service.dart';

class ScrollingItemsLoader extends StatefulWidget {
  final String text;
  const ScrollingItemsLoader({
    this.text = 'Getting your F2H Fresh ready',
    super.key,
  });

  @override
  State<ScrollingItemsLoader> createState() => _ScrollingItemsLoaderState();
}

class _ScrollingItemsLoaderState extends State<ScrollingItemsLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  final List<String> _images = [
    'assets/images/media__1783661541857_nobg.png',
    'assets/images/media__1783661541865_nobg.png',
    'assets/images/media__1783661541866_nobg.png',
    'assets/images/media__1783661541889_nobg.png',
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF16653A);
    const lightBgColor = Color(0xFFEAF5EE);

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 140,
          width: 140,
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              final val = _controller.value;
              // Gentle float bounce
              final bounceY = -10 * math.sin(val * 2 * math.pi);
              // Pulse ring scale (0.85 to 1.35)
              final ringScale = 0.85 + 0.5 * (val % 1.0);
              // Pulse ring opacity (0.6 to 0.0)
              final ringOpacity = (1.0 - (val % 1.0)).clamp(0.0, 0.6);

              // Image index rotation
              final activeIndex = (val * _images.length).floor() % _images.length;

              return Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: [
                  // Outer expanding ripple ring
                  Transform.scale(
                    scale: ringScale,
                    child: Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: primaryColor.withValues(alpha: ringOpacity * 0.2),
                        border: Border.all(
                          color: primaryColor.withValues(alpha: ringOpacity),
                          width: 1.5,
                        ),
                      ),
                    ),
                  ),

                  // Inner soft static ring
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: lightBgColor,
                      boxShadow: [
                        BoxShadow(
                          color: primaryColor.withValues(alpha: 0.08),
                          blurRadius: 16,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                  ),

                  // Floating product image card
                  Transform.translate(
                    offset: Offset(0, bounceY),
                    child: Container(
                      width: 72,
                      height: 72,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.08),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 400),
                        transitionBuilder: (child, anim) => ScaleTransition(
                          scale: anim,
                          child: FadeTransition(opacity: anim, child: child),
                        ),
                        child: AppAssetImage(
                          assetKey: _images[activeIndex],
                          key: ValueKey<int>(activeIndex),
                          height: 52,
                          width: 52,
                          fit: BoxFit.contain,
                          errorBuilder: (context, error, stackTrace) {
                            return const Icon(
                              Icons.shopping_bag_outlined,
                              color: primaryColor,
                              size: 34,
                            );
                          },
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),

        const SizedBox(height: 16),

        // Text Indicator
        Text(
          widget.text,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
            letterSpacing: -0.3,
          ),
        ),

        const SizedBox(height: 10),

        // 3 Animated Pulsing Green Dots
        AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(3, (dotIndex) {
                final delay = dotIndex * 0.25;
                final dotProgress = (_controller.value + delay) % 1.0;
                final scale = 0.6 + 0.5 * math.sin(dotProgress * math.pi);
                final opacity = 0.3 + 0.7 * math.sin(dotProgress * math.pi);

                return Transform.scale(
                  scale: scale,
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: primaryColor.withValues(alpha: opacity),
                    ),
                  ),
                );
              }),
            );
          },
        ),
      ],
    );
  }
}
