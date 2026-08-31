import 'dart:async';
import 'package:flutter/material.dart';
import 'package:f2h_customer/core/widgets/cow_loading_widget.dart';

class DynamicSplashScreen extends StatefulWidget {
  final Widget child;
  const DynamicSplashScreen({super.key, required this.child});

  @override
  State<DynamicSplashScreen> createState() => _DynamicSplashScreenState();
}

class _DynamicSplashScreenState extends State<DynamicSplashScreen>
    with SingleTickerProviderStateMixin {
  bool _showSplash = true;
  late final AnimationController _animationController;
  late final Animation<double> _fadeAnimation;
  Timer? _autoDismissTimer;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnimation = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
    _startSplashSequence();
  }

  @override
  void dispose() {
    _autoDismissTimer?.cancel();
    _animationController.dispose();
    super.dispose();
  }

  void _startSplashSequence() {
    // Auto-dismiss smoothly after 3.5 seconds if user doesn't tap Skip
    _autoDismissTimer = Timer(const Duration(milliseconds: 3500), () {
      if (mounted && _showSplash) {
        _fadeOutAndDismiss();
      }
    });
  }

  void _fadeOutAndDismiss() {
    if (!mounted || !_showSplash) return;
    _autoDismissTimer?.cancel();
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

    final topPadding = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: Colors.white,
      body: FadeTransition(
        opacity: _fadeAnimation,
        child: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0xFFE8FAF0),
                Color(0xFFF3FCF7),
                Color(0xFFFFFFFF),
              ],
              stops: [0.0, 0.45, 1.0],
            ),
          ),
          child: SafeArea(
            child: Stack(
              children: [
                // ── Top Right Skip Button ──────────────────────────────
                Positioned(
                  top: 12,
                  right: 16,
                  child: GestureDetector(
                    onTap: _fadeOutAndDismiss,
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: const Color(0xFFE2E8F0),
                          width: 1.2,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Text(
                            'Skip',
                            style: TextStyle(
                              color: Color(0xFF16A34A),
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.2,
                            ),
                          ),
                          SizedBox(width: 5),
                          Icon(
                            Icons.arrow_forward_rounded,
                            color: Color(0xFF16A34A),
                            size: 16,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                // ── Main Content ───────────────────────────────────────
                Column(
                  children: [
                    SizedBox(height: topPadding > 0 ? 32 : 48),

                    // 1. Logo Circle
                    Container(
                      width: 88,
                      height: 88,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xFFDCFCE7),
                          width: 2,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF16A34A).withValues(alpha: 0.12),
                            blurRadius: 24,
                            spreadRadius: 2,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: ClipOval(
                        child: Image.asset(
                          'assets/icon/app_icon.png',
                          fit: BoxFit.contain,
                        ),
                      ),
                    ),

                    const SizedBox(height: 24),

                    // 2. Headline
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24.0),
                      child: RichText(
                        textAlign: TextAlign.center,
                        text: const TextSpan(
                          children: [
                            TextSpan(
                              text: 'Fresh ',
                              style: TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F172A),
                                letterSpacing: -0.5,
                              ),
                            ),
                            TextSpan(
                              text: 'Milk & Curd\n',
                              style: TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF16A34A),
                                letterSpacing: -0.5,
                              ),
                            ),
                            TextSpan(
                              text: 'Delivered, Every Day!',
                              style: TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F172A),
                                letterSpacing: -0.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 12),

                    // 3. Heart Line Divider
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 28,
                          height: 1.8,
                          decoration: BoxDecoration(
                            color: const Color(0xFF22C55E),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Icon(
                          Icons.favorite_rounded,
                          size: 14,
                          color: Color(0xFF22C55E),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          width: 28,
                          height: 1.8,
                          decoration: BoxDecoration(
                            color: const Color(0xFF22C55E),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ],
                    ),

                    const Spacer(),

                    // 4. Center Cow Drinking Milk Animation with Soft Mint Glow
                    Container(
                      width: 170,
                      height: 170,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFFDDF5E8).withValues(alpha: 0.7),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF16A34A).withValues(alpha: 0.08),
                            blurRadius: 36,
                            spreadRadius: 10,
                          ),
                        ],
                      ),
                      child: const Center(
                        child: CowLoadingWidget(
                          size: 135,
                          loadingBarWidth: 85,
                        ),
                      ),
                    ),

                    const Spacer(),

                    // 5. Bottom Feature Card
                    Container(
                      margin: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 16,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: const Color(0xFFE2E8F0),
                          width: 1.2,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 20,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          _buildFeatureItem(
                            icon: Icons.calendar_month_rounded,
                            iconBg: const Color(0xFFD4F8E8),
                            iconColor: const Color(0xFF16A34A),
                            title: 'Flexible Plans',
                            subtitle: 'Daily & Weekly',
                          ),
                          _buildFeatureItem(
                            icon: Icons.pause_rounded,
                            iconBg: const Color(0xFFE0EEFD),
                            iconColor: const Color(0xFF2563EB),
                            title: 'Pause Anytime',
                            subtitle: 'Skip or pause',
                          ),
                          _buildFeatureItem(
                            icon: Icons.percent_rounded,
                            iconBg: const Color(0xFFFEF0E0),
                            iconColor: const Color(0xFFEA580C),
                            title: 'Save More',
                            subtitle: 'Member offers',
                          ),
                          _buildFeatureItem(
                            icon: Icons.verified_user_rounded,
                            iconBg: const Color(0xFFEFE5FC),
                            iconColor: const Color(0xFF7C3AED),
                            title: '100% Pure',
                            subtitle: 'Farm fresh',
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFeatureItem({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String title,
    required String subtitle,
  }) {
    return Expanded(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBg,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w900,
              color: Color(0xFF0F172A),
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
              color: Color(0xFF64748B),
            ),
          ),
        ],
      ),
    );
  }
}
