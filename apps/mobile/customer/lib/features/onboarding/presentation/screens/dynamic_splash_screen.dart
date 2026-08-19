import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_customer/core/widgets/scrolling_items_loader.dart';
import 'package:f2h_customer/core/services/app_asset_service.dart';

class DynamicSplashScreen extends StatefulWidget {
  final Widget child;
  const DynamicSplashScreen({super.key, required this.child});

  @override
  State<DynamicSplashScreen> createState() => _DynamicSplashScreenState();
}

class _DynamicSplashScreenState extends State<DynamicSplashScreen>
    with SingleTickerProviderStateMixin {
  bool _showSplash = true;
  bool _showBanner = false;
  String? _splashImage;
  late final AnimationController _animationController;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    AppAssetService().init();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnimation = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
    _startSplashSequence();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _startSplashSequence() async {
    // Prepare image key
    try {
      final prefs = await SharedPreferences.getInstance();
      int count = prefs.getInt('app_open_count') ?? 0;
      final images = [
        'assets/splash/splash.png',
      ];

      if (images.isNotEmpty) {
        _splashImage = images[count % images.length];
      }

      await prefs.setInt('app_open_count', count + 1);
    } catch (e) {
      debugPrint('Error preparing splash image: $e');
    }

    // Step 1: First show loading animation for 1.5 seconds on app launch
    await Future.delayed(const Duration(milliseconds: 1500));
    if (!mounted || !_showSplash) return;

    // Step 2: Then switch to showing the splash banner image
    if (_splashImage != null) {
      if (mounted) {
        setState(() {
          _showBanner = true;
        });
      }
    }

    // Step 3: Auto-dismiss after 2.5 seconds max if user doesn't tap Skip
    await Future.delayed(const Duration(milliseconds: 2500));
    if (mounted && _showSplash) {
      _fadeOutAndDismiss();
    }
  }

  void _fadeOutAndDismiss() {
    if (!mounted) return;
    _animationController.forward().then((_) {
      if (mounted) {
        setState(() {
          _showSplash = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_showSplash) {
      return widget.child;
    }

    return Scaffold(
      backgroundColor: Colors.white,
      body: FadeTransition(
        opacity: _fadeAnimation,
        child: Stack(
          children: [
            // Smooth CrossFade: First show Loading Animation, then switch to Splash Banner
            Positioned.fill(
              child: AnimatedCrossFade(
                duration: const Duration(milliseconds: 500),
                crossFadeState: _showBanner && _splashImage != null
                    ? CrossFadeState.showSecond
                    : CrossFadeState.showFirst,
                firstChild: Container(
                  color: Colors.white,
                  child: const Center(
                    child: ScrollingItemsLoader(),
                  ),
                ),
                secondChild: _splashImage != null
                    ? SizedBox.expand(
                        child: AppAssetImage(
                          assetKey: _splashImage!,
                          fit: BoxFit.cover,
                        ),
                      )
                    : Container(color: Colors.white),
              ),
            ),

            // Glassmorphic Skip Button during Banner Phase (Stays until user taps Skip)
            if (_showBanner)
              Positioned(
                top: MediaQuery.of(context).padding.top + 16,
                right: 16,
                child: SafeArea(
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: _fadeOutAndDismiss,
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.4),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.2),
                            width: 1,
                          ),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Skip',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                            SizedBox(width: 4),
                            Icon(
                              Icons.chevron_right_rounded,
                              color: Colors.white,
                              size: 18,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
