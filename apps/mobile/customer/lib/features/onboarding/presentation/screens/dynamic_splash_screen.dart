import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_customer/core/widgets/scrolling_items_loader.dart';

class DynamicSplashScreen extends StatefulWidget {
  final Widget child;
  const DynamicSplashScreen({super.key, required this.child});

  @override
  State<DynamicSplashScreen> createState() => _DynamicSplashScreenState();
}

class _DynamicSplashScreenState extends State<DynamicSplashScreen> with SingleTickerProviderStateMixin {
  bool _showSplash = true;
  String? _splashImage;
  late final AnimationController _animationController;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnimation = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
    _loadSplashImage();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _loadSplashImage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      int count = prefs.getInt('app_open_count') ?? 0;
      
      // List of available splash images
      final images = [
        'assets/splash/splash.png',
      ];
      
      if (images.isNotEmpty) {
        setState(() {
          _splashImage = images[count % images.length];
        });
      }
      
      // Increment and save count for the next run
      await prefs.setInt('app_open_count', count + 1);
    } catch (e) {
      debugPrint('Error loading splash image: $e');
    }

    // Wait for 800 milliseconds before starting the fade-out transition
    await Future.delayed(const Duration(milliseconds: 800));
    _fadeOutAndDismiss();
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
            // Full Screen Image
            Positioned.fill(
              child: _splashImage == null
                  ? Container(
                      color: Colors.white,
                      child: const Center(
                        child: ScrollingItemsLoader(),
                      ),
                    )
                  : Image.asset(
                      _splashImage!,
                      fit: BoxFit.cover,
                    ),
            ),
            // ponytail: removed bottom rolling loader overlay
            // const Positioned(
            //   bottom: 80,
            //   left: 0,
            //   right: 0,
            //   child: Center(
            //     child: ScrollingItemsLoader(),
            //   ),
            // ),
            // Glassmorphic / Semi-transparent Skip Button
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
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.4),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.2),
                          width: 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
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
