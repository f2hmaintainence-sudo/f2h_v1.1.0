import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/onboarding/presentation/screens/service_area_check_screen.dart';
import 'package:f2h_delivery/app.dart';

class WelcomeIntroScreen extends StatefulWidget {
  final bool afterSignup;
  const WelcomeIntroScreen({super.key, this.afterSignup = false});

  @override
  State<WelcomeIntroScreen> createState() => _WelcomeIntroScreenState();
}

class _WelcomeIntroScreenState extends State<WelcomeIntroScreen>
    with TickerProviderStateMixin {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  // Animation controllers for slide 0 - Coin stack
  late AnimationController _coin1;
  late AnimationController _pulse1;
  // Slide 1 - Sunrise
  late AnimationController _sunrise;
  // Slide 2 - Hex grid
  late AnimationController _hexGrid;
  // Shared float animation
  late AnimationController _floatCtrl;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));

    _coin1 = AnimationController(vsync: this, duration: const Duration(seconds: 3))
      ..repeat();
    _pulse1 = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))
      ..repeat(reverse: true);
    _sunrise = AnimationController(vsync: this, duration: const Duration(seconds: 4))
      ..repeat();
    _hexGrid = AnimationController(vsync: this, duration: const Duration(seconds: 5))
      ..repeat();
    _floatCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200))
      ..repeat(reverse: true);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (widget.afterSignup) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const AppShell(initialIndex: 3)),
        );
      } else {
        Navigator.pushReplacement(
          context,
          _slideRoute(const ServiceAreaCheckScreen()),
        );
      }
    });
  }

  @override
  void dispose() {
    _coin1.dispose();
    _pulse1.dispose();
    _sunrise.dispose();
    _hexGrid.dispose();
    _floatCtrl.dispose();
    _pageController.dispose();
    super.dispose();
  }

  void _onNextPressed() {
    if (_currentPage < 2) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeOutCubic,
      );
    } else {
      if (widget.afterSignup) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const AppShell(initialIndex: 3)),
        );
      } else {
        Navigator.pushReplacement(
          context,
          _slideRoute(const ServiceAreaCheckScreen()),
        );
      }
    }
  }

  PageRouteBuilder _slideRoute(Widget page) {
    return PageRouteBuilder(
      pageBuilder: (_, _, _) => page,
      transitionsBuilder: (_, anim, _, child) {
        return SlideTransition(
          position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
              .animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
          child: child,
        );
      },
      transitionDuration: const Duration(milliseconds: 400),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      body: Stack(
        children: [
          // Background radial glow — soft mint
          Positioned(
            top: -120,
            left: -80,
            child: AnimatedBuilder(
              animation: _pulse1,
              builder: (_, _) => Container(
                width: 420,
                height: 420,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      kPrimaryPl.withValues(alpha: 0.4 + _pulse1.value * 0.1),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),

          SafeArea(
            child: Column(
              children: [
                // Top bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [kPrimaryMid, kPrimary],
                              ),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.eco, color: Colors.white, size: 18),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'F2H FRESH',
                            style: GoogleFonts.poppins(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: kPrimary,
                              letterSpacing: 2,
                            ),
                          ),
                        ],
                      ),
                      TextButton(
                        onPressed: () {
                          if (widget.afterSignup) {
                            Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(builder: (_) => const AppShell(initialIndex: 3)),
                            );
                          } else {
                            Navigator.pushReplacement(
                              context,
                              _slideRoute(const ServiceAreaCheckScreen()),
                            );
                          }
                        },
                        child: Text(
                          'Skip',
                          style: GoogleFonts.poppins(
                            color: kTextSub,
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Page view
                Expanded(
                  child: PageView(
                    controller: _pageController,
                    onPageChanged: (p) => setState(() => _currentPage = p),
                    children: [
                      _buildSlide0(),
                      _buildSlide1(),
                      _buildSlide2(),
                    ],
                  ),
                ),

                // Footer
                _buildFooter(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Slide 0: High Earnings ────────────────────────────────────────────────
  Widget _buildSlide0() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // 3D Coin Stack icon
          AnimatedBuilder(
            animation: Listenable.merge([_coin1, _floatCtrl, _pulse1]),
            builder: (_, _) {
              final float = math.sin(_floatCtrl.value * math.pi) * 10;
              final rotate = math.sin(_coin1.value * math.pi * 2) * 0.08;
              return Transform.translate(
                offset: Offset(0, float),
                child: Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.identity()
                    ..setEntry(3, 2, 0.001)
                    ..rotateY(rotate),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Outer glow
                      Container(
                        width: 200 + _pulse1.value * 20,
                        height: 200 + _pulse1.value * 20,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            colors: [
                              kAccent.withValues(alpha: 0.08 + _pulse1.value * 0.06),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                      // Main circle
                      Container(
                        width: 160,
                        height: 160,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: kSurface,
                          border: Border.all(color: kBorder, width: 1.5),
                          boxShadow: [
                            BoxShadow(
                              color: kPrimary.withValues(alpha: 0.08),
                              blurRadius: 30,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                      ),
                      // Stacked coins
                      ..._buildCoinStack(rotate),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 52),
          _buildSlideText(
            '₹ High Earnings & Weekly Pay',
            'Earn per-order rates, distance incentives, and referral bonuses. Guaranteed payouts to your bank every week.',
          ),
        ],
      ),
    );
  }

  List<Widget> _buildCoinStack(double rotate) {
    return [
      for (int i = 3; i >= 0; i--)
        Positioned(
          top: 60.0 + i * 6,
          child: Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateX(-0.4 + rotate),
            child: Container(
              width: 70 - i * 4.0,
              height: 18,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(50),
                gradient: LinearGradient(
                  colors: [
                    Color.lerp(const Color(0xFFFFD54F), const Color(0xFFFFF176), i / 3.0)!,
                    Color.lerp(const Color(0xFFFF8F00), const Color(0xFFFFD740), i / 3.0)!,
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFFD740).withValues(alpha: 0.3),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
            ),
          ),
        ),
      // Rupee symbol
      Positioned(
        top: 52,
        child: Text(
          '₹',
          style: GoogleFonts.poppins(
            fontSize: 36,
            fontWeight: FontWeight.w900,
            color: const Color(0xFFFF8F00),
            shadows: [const Shadow(color: Color(0xFFFFD740), blurRadius: 8)],
          ),
        ),
      ),
    ];
  }

  // ─── Slide 1: Flexible Shifts ──────────────────────────────────────────────
  Widget _buildSlide1() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedBuilder(
            animation: Listenable.merge([_sunrise, _floatCtrl, _pulse1]),
            builder: (_, _) {
              final float = math.sin(_floatCtrl.value * math.pi) * 8;
              return Transform.translate(
                offset: Offset(0, float),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Pulsing outer ring
                    Container(
                      width: 180 + _pulse1.value * 24,
                      height: 180 + _pulse1.value * 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            const Color(0xFFFF6D00).withValues(alpha: 0.06 + _pulse1.value * 0.04),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                    // Main sun container
                    Container(
                      width: 160,
                      height: 160,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: kSurface,
                        border: Border.all(color: kBorder, width: 1.5),
                        boxShadow: [
                          BoxShadow(color: kPrimary.withValues(alpha: 0.06), blurRadius: 20),
                        ],
                      ),
                    ),
                    // Rotating rays
                    Transform.rotate(
                      angle: _sunrise.value * math.pi * 2,
                      child: CustomPaint(
                        size: const Size(140, 140),
                        painter: _SunRayPainter(opacity: 0.5 + _pulse1.value * 0.3),
                      ),
                    ),
                    // Sun core
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const RadialGradient(
                          colors: [Color(0xFFFFCC02), Color(0xFFFF8C00)],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFFFCC02).withValues(alpha: 0.5 + _pulse1.value * 0.3),
                            blurRadius: 20,
                            spreadRadius: 4,
                          ),
                        ],
                      ),
                    ),
                    // Moon crescent (early morning theme)
                    Positioned(
                      top: 32,
                      right: 32,
                      child: Opacity(
                        opacity: 0.5,
                        child: const Icon(Icons.nightlight_round, color: Color(0xFF90A4AE), size: 22),
                      ),
                    ),
                    // Clock indicator
                    Positioned(
                      bottom: 30,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: kSurface,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: kBorder),
                          boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.06), blurRadius: 8)],
                        ),
                        child: Text(
                          '5:00 AM',
                          style: GoogleFonts.poppins(
                            color: const Color(0xFFFF8C00),
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 52),
          _buildSlideText(
            '🌅 Flexible Early Morning Shifts',
            'Deliver between 5:00 AM and 9:00 AM. Finish early and enjoy your whole day for other commitments.',
          ),
        ],
      ),
    );
  }

  // ─── Slide 2: Smart Routing ────────────────────────────────────────────────
  Widget _buildSlide2() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedBuilder(
            animation: Listenable.merge([_hexGrid, _floatCtrl, _pulse1]),
            builder: (_, _) {
              final float = math.sin(_floatCtrl.value * math.pi) * 9;
              return Transform.translate(
                offset: Offset(0, float),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Pulsing glow
                    Container(
                      width: 180 + _pulse1.value * 20,
                      height: 180 + _pulse1.value * 20,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            kPrimaryLt.withValues(alpha: 0.08 + _pulse1.value * 0.05),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                    // Hex grid custom paint
                    Container(
                      width: 160,
                      height: 160,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: kSurface,
                        border: Border.all(color: kBorder, width: 1.5),
                        boxShadow: [
                          BoxShadow(color: kPrimary.withValues(alpha: 0.06), blurRadius: 20),
                        ],
                      ),
                      child: ClipOval(
                        child: CustomPaint(
                          painter: _HexGridPainter(
                            progress: _hexGrid.value,
                            pulse: _pulse1.value,
                          ),
                        ),
                      ),
                    ),
                    // Center pin
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [kPrimaryMid, kPrimary],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: kPrimary.withValues(alpha: 0.3),
                            blurRadius: 12,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: const Icon(Icons.navigation_rounded, color: Colors.white, size: 18),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 52),
          _buildSlideText(
            '🗺️ Smart H3 Sector Routing',
            'Advanced hexagonal grid auto-groups deliveries by sector. Save fuel, avoid traffic, and navigate with one tap.',
          ),
        ],
      ),
    );
  }

  Widget _buildSlideText(String title, String subtitle) {
    return Column(
      children: [
        Text(
          title,
          textAlign: TextAlign.center,
          style: GoogleFonts.poppins(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: kText,
            height: 1.2,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: GoogleFonts.poppins(
            fontSize: 14.5,
            color: kTextSub,
            height: 1.6,
            fontWeight: FontWeight.w400,
          ),
        ),
      ],
    );
  }

  Widget _buildFooter() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 36),
      child: Column(
        children: [
          // Dot indicators
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(3, (i) {
              final active = i == _currentPage;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                height: 6,
                width: active ? 28 : 6,
                decoration: BoxDecoration(
                  color: active ? kPrimaryMid : kBorder,
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            }),
          ),
          const SizedBox(height: 28),
          // CTA Button
          GestureDetector(
            onTap: _onNextPressed,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: double.infinity,
              height: 58,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [kPrimaryMid, kPrimary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(
                    color: kPrimary.withValues(alpha: 0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    _currentPage == 2
                        ? (widget.afterSignup ? 'Get Started' : 'Find My Hub')
                        : 'Continue',
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    _currentPage == 2
                        ? (widget.afterSignup ? Icons.done_rounded : Icons.explore_rounded)
                        : Icons.arrow_forward_rounded,
                    color: kAccent,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Custom Painters ──────────────────────────────────────────────────────────

class _SunRayPainter extends CustomPainter {
  final double opacity;
  _SunRayPainter({required this.opacity});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final paint = Paint()
      ..color = const Color(0xFFFFCC02).withValues(alpha: opacity * 0.6)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    for (int i = 0; i < 8; i++) {
      final angle = (i / 8) * math.pi * 2;
      final inner = center + Offset(math.cos(angle) * 36, math.sin(angle) * 36);
      final outer = center + Offset(math.cos(angle) * 58, math.sin(angle) * 58);
      canvas.drawLine(inner, outer, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SunRayPainter old) => old.opacity != opacity;
}

class _HexGridPainter extends CustomPainter {
  final double progress;
  final double pulse;
  _HexGridPainter({required this.progress, required this.pulse});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final double hexR = 22;
    final positions = [
      Offset(0, 0),
      Offset(hexR * 1.73, 0),
      Offset(-hexR * 1.73, 0),
      Offset(hexR * 0.87, hexR * 1.5),
      Offset(-hexR * 0.87, hexR * 1.5),
      Offset(hexR * 0.87, -hexR * 1.5),
      Offset(-hexR * 0.87, -hexR * 1.5),
    ];

    for (int idx = 0; idx < positions.length; idx++) {
      final pos = positions[idx];
      final animProgress = ((progress + idx * 0.12) % 1.0);
      final alpha = (0.15 + animProgress * 0.5).clamp(0.0, 0.8);
      final fillPaint = Paint()
        ..color = kPrimaryLt.withValues(alpha: alpha * 0.3)
        ..style = PaintingStyle.fill;
      final strokePaint = Paint()
        ..color = kPrimaryLt.withValues(alpha: alpha)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5;

      final path = _hexPath(cx + pos.dx, cy + pos.dy, hexR - 3);
      canvas.drawPath(path, fillPaint);
      canvas.drawPath(path, strokePaint);
    }
  }

  Path _hexPath(double cx, double cy, double r) {
    final path = Path();
    for (int i = 0; i < 6; i++) {
      final angle = math.pi / 180 * (60 * i - 30);
      final x = cx + r * math.cos(angle);
      final y = cy + r * math.sin(angle);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    path.close();
    return path;
  }

  @override
  bool shouldRepaint(covariant _HexGridPainter old) =>
      old.progress != progress || old.pulse != pulse;
}
