// ═══════════════════════════════════════════════════════════════════════════
//  ANIMATIONS — Shared animation widgets used across the F2H app
//
//  Contains:
//    1. BouncyAddButton     — Scale-bounce wrapper for add-to-cart
//    2. FloatingPlusOne     — "+1" particle that floats upward
//    3. CartBadge           — Pulsing badge on cart icon
//    4. ConfettiBurst       — Success confetti particles
//    5. OrderSuccessScreen  — Post-checkout success with animated checkmark
//    6. RippleTapEffect     — Ink-ripple on card taps
//    7. ShimmerContainer    — Loading placeholder shimmer
//    8. RollingMarquee      — Initial loading screen with product carousel
// ═══════════════════════════════════════════════════════════════════════════

import 'dart:math' as math;
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/services/app_asset_service.dart';
// NOTE: Removed circular self-import that was here previously


// ══════════════════════════════════════════════════════════
//  1.  BOUNCY ADD-TO-CART BUTTON WRAPPER
//      Wraps any widget and plays a scale-bounce when tapped
// ══════════════════════════════════════════════════════════

class BouncyAddButton extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;
  const BouncyAddButton({required this.child, required this.onTap, super.key});

  @override
  State<BouncyAddButton> createState() => _BouncyAddButtonState();
}

class _BouncyAddButtonState extends State<BouncyAddButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 180),
    );
    _scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.80), weight: 40),
      TweenSequenceItem(
        tween: Tween(begin: 0.80, end: 1.20)
            .chain(CurveTween(curve: Curves.elasticOut)),
        weight: 60,
      ),
    ]).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _handleTap() async {
    HapticFeedback.lightImpact();
    await _ctrl.forward(from: 0);
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: _handleTap,
        child: ScaleTransition(scale: _scale, child: widget.child),
      );
}

// ══════════════════════════════════════════════════════════
//  2.  FLOATING +1 PARTICLE
//      Overlay widget that floats a "+1" tag upward and fades out
// ══════════════════════════════════════════════════════════

class FloatingPlusOne extends StatefulWidget {
  final Offset startPosition;
  final VoidCallback onDone;
  const FloatingPlusOne({required this.startPosition, required this.onDone, super.key});

  @override
  State<FloatingPlusOne> createState() => _FloatingPlusOneState();
}

class _FloatingPlusOneState extends State<FloatingPlusOne>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _y;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _y = Tween<double>(begin: 0, end: -72).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOut),
    );
    _opacity = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.0), weight: 20),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.0), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 30),
    ]).animate(_ctrl);

    _ctrl.forward().then((_) => widget.onDone());
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, _) => Positioned(
        left: widget.startPosition.dx - 16,
        top: widget.startPosition.dy + _y.value - 20,
        child: Opacity(
          opacity: _opacity.value,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: kPrimary,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: kPrimary.withValues(alpha: 0.4),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                )
              ],
            ),
            child: const Text(
              '+1',
              style: TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  3.  CART BADGE PULSE ANIMATION
//      A pulsing badge that animates when item is added
// ══════════════════════════════════════════════════════════

class CartBadge extends StatefulWidget {
  final int count;
  final Widget child;
  const CartBadge({required this.count, required this.child, super.key});

  @override
  State<CartBadge> createState() => _CartBadgeState();
}

class _CartBadgeState extends State<CartBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;
  int _prevCount = 0;

  @override
  void initState() {
    super.initState();
    _prevCount = widget.count;
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.5), weight: 50),
      TweenSequenceItem(
        tween: Tween(begin: 1.5, end: 1.0)
            .chain(CurveTween(curve: Curves.elasticOut)),
        weight: 50,
      ),
    ]).animate(_ctrl);
  }

  @override
  void didUpdateWidget(CartBadge oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.count != _prevCount) {
      _prevCount = widget.count;
      _ctrl.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.count == 0) return widget.child;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        widget.child,
        Positioned(
          right: -6,
          top: -6,
          child: ScaleTransition(
            scale: _scale,
            child: Container(
              width: 18,
              height: 18,
              decoration: const BoxDecoration(
                color: Color(0xFFFF5252),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  widget.count > 99 ? '99+' : '${widget.count}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════
//  4.  CONFETTI BURST
//      Tiny colored particles that burst outward on success
// ══════════════════════════════════════════════════════════

class _Particle {
  final double angle;
  final double speed;
  final Color color;
  final double size;
  _Particle({required this.angle, required this.speed, required this.color, required this.size});
}

class ConfettiBurst extends StatefulWidget {
  const ConfettiBurst({super.key});

  @override
  State<ConfettiBurst> createState() => _ConfettiBurstState();
}

class _ConfettiBurstState extends State<ConfettiBurst>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final List<_Particle> _particles;

  static const _colors = [
    Color(0xFF4CAF50), Color(0xFFFF9800), Color(0xFF2196F3),
    Color(0xFFE91E63), Color(0xFFFFEB3B), Color(0xFF9C27B0),
    Color(0xFF00BCD4), Color(0xFFFF5252),
  ];

  @override
  void initState() {
    super.initState();
    final rng = math.Random();
    _particles = List.generate(40, (_) => _Particle(
      angle: rng.nextDouble() * 2 * math.pi,
      speed: 60 + rng.nextDouble() * 120,
      color: _colors[rng.nextInt(_colors.length)],
      size: 4 + rng.nextDouble() * 6,
    ));

    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}

class _ConfettiPainter extends CustomPainter {
  final List<_Particle> particles;
  final double t;
  _ConfettiPainter(this.particles, this.t);

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    for (final p in particles) {
      final dist = p.speed * t;
      final x = cx + dist * math.cos(p.angle);
      final y = cy + dist * math.sin(p.angle) + 60 * t * t; // gravity
      final opacity = (1.0 - t).clamp(0.0, 1.0);
      final paint = Paint()..color = p.color.withValues(alpha: opacity);
      canvas.drawCircle(Offset(x, y), p.size * (1 - t * 0.5), paint);
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => true;
}

// ══════════════════════════════════════════════════════════
//  5.  ORDER SUCCESS SCREEN with multi-step delivery animation
//
//  Displayed after successful order placement or subscription activation.
//  Shows different content based on order type:
//    • One-time order  → "Order Placed Successfully!" + Order ID (#F2H-xxx)
//    • Subscription    → "Subscription Activated!" + Subscription ID (#SUB-xxx)
//
//  Uses green theme for orders, gold/amber theme for subscriptions.
//  Includes animated checkmark, confetti burst, and delivery details card.
// ══════════════════════════════════════════════════════════

class OrderSuccessScreen extends StatefulWidget {
  final VoidCallback onDone;

  /// Whether this was a subscription order (changes theme and text)
  final bool isSubscription;

  /// The delivery address to display on the success card
  final String? deliveryAddress;

  /// The order/subscription ID to display (e.g., '#F2H-123' or '#SUB-456')
  final String? orderId;

  const OrderSuccessScreen({
    required this.onDone,
    this.isSubscription = false,
    this.deliveryAddress,
    this.orderId,
    super.key,
  });

  @override
  State<OrderSuccessScreen> createState() => _OrderSuccessScreenState();
}

class _OrderSuccessScreenState extends State<OrderSuccessScreen>
    with TickerProviderStateMixin {
  late final AnimationController _iconCtrl;
  late final Animation<double> _iconScale;

  late final AnimationController _checkCtrl;
  late final Animation<double> _checkProgress;

  late final AnimationController _bgCtrl;
  bool _showConfetti = false;
  Timer? _autoDoneTimer;

  @override
  void initState() {
    super.initState();

    _bgCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    )..forward();

    _iconCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _iconScale = CurvedAnimation(parent: _iconCtrl, curve: Curves.elasticOut);

    _checkCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 550),
    );
    _checkProgress = CurvedAnimation(parent: _checkCtrl, curve: Curves.easeOut);

    _startAnimation();
  }

  Future<void> _startAnimation() async {
    HapticFeedback.heavyImpact();
    _iconCtrl.forward();
    await Future.delayed(const Duration(milliseconds: 300));
    if (!mounted) return;
    _checkCtrl.forward();
    setState(() {
      _showConfetti = true;
    });
    // ponytail: no auto-back navigation, requires explicit Done button click.
  }

  @override
  void dispose() {
    _autoDoneTimer?.cancel();
    _iconCtrl.dispose();
    _checkCtrl.dispose();
    _bgCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isSub = widget.isSubscription;
    final themeColor = isSub ? kAccent : kPrimary;
    final themeColorPl = isSub ? kAccentLt : kPrimaryPl;
    // ===== Order Confirmation Text =====
    // Different title/subtitle based on whether this is a subscription or one-time order
    final title = isSub ? 'Subscription Activated!' : 'Order Placed Successfully!';
    final subtitle = isSub
        ? 'Your recurring deliveries are all set!'
        : 'Your fresh farm products are on their way!';
    
    final addressVal = widget.deliveryAddress ?? 'Home · Flat 304, Green Meadows';
    
    final defaultIdValue = isSub 
        ? '#SUB-F2H${DateTime.now().millisecondsSinceEpoch % 100000}'
        : '#F2H${DateTime.now().millisecondsSinceEpoch % 100000}';
    final orderIdVal = widget.orderId ?? defaultIdValue;

    return Scaffold(
      backgroundColor: Colors.white,
      body: FadeTransition(
        opacity: _bgCtrl,
        child: Container(
          width: double.infinity,
          height: double.infinity,
          color: Colors.white,
          child: Stack(
            children: [
              // Premium Background Glow - Top Left
              Positioned(
                top: -100,
                left: -100,
                child: Container(
                  width: 300,
                  height: 300,
                  decoration: BoxDecoration(
                    color: themeColor.withValues(alpha: 0.04),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              
              // Premium Background Glow - Bottom Right
              Positioned(
                bottom: -120,
                right: -100,
                child: Container(
                  width: 350,
                  height: 350,
                  decoration: BoxDecoration(
                    color: themeColor.withValues(alpha: 0.03),
                    shape: BoxShape.circle,
                  ),
                ),
              ),

              // Confetti burst
              if (_showConfetti) const ConfettiBurst(),

              // Main content
              SafeArea(
                child: Column(
                  children: [
                    const Spacer(flex: 2),

                    // Custom Premium Tag Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: themeColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(30),
                        border: Border.all(color: themeColor.withValues(alpha: 0.2), width: 1),
                      ),
                      child: Text(
                        isSub ? 'VIP SUBSCRIPTION ACTIVE' : 'ORDER CONFIRMED',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: themeColor,
                          letterSpacing: 1.0,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Central icon + ripples
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        // Ripple 2
                        AnimatedBuilder(
                          animation: _iconCtrl,
                          builder: (_, _) => Container(
                            width: 170 * _iconScale.value,
                            height: 170 * _iconScale.value,
                            decoration: BoxDecoration(
                              color: themeColor.withValues(alpha: 0.04),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                        // Ripple 1
                        AnimatedBuilder(
                          animation: _iconCtrl,
                          builder: (_, _) => Container(
                            width: 130 * _iconScale.value,
                            height: 130 * _iconScale.value,
                            decoration: BoxDecoration(
                              color: themeColor.withValues(alpha: 0.08),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                        // Main circle checkmark with gradient and premium shadow
                        ScaleTransition(
                          scale: _iconScale,
                          child: Container(
                            width: 90,
                            height: 90,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: LinearGradient(
                                colors: isSub
                                    ? [kAccent, const Color(0xFFE28B00)]
                                    : [kPrimary, kPrimaryLt],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: themeColor.withValues(alpha: 0.24),
                                  blurRadius: 20,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: Center(
                              child: _buildAnimatedCheckmark(),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),

                    // Success Labels
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        color: kText,
                        letterSpacing: -0.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 14,
                        color: kTextSub,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),

                    const Spacer(flex: 1),

                    // Premium Card with left accent bar and colored shadows
                    Container(
                      margin: const EdgeInsets.symmetric(horizontal: 24),
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: themeColorPl.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: themeColor.withValues(alpha: 0.24),
                          width: 2.0,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: themeColor.withValues(alpha: 0.04),
                            blurRadius: 16,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                isSub ? Icons.verified_rounded : Icons.check_circle_rounded,
                                color: themeColor,
                                size: 16,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                isSub ? 'Subscription Details' : 'Delivery Details',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                  color: themeColor,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: Divider(color: Color(0xFFF1F5F9), height: 1),
                          ),
                          _buildInfoRow(
                            Icons.location_on_rounded, 
                            'DELIVERY ADDRESS', 
                            Text(
                              addressVal,
                              style: const TextStyle(
                                fontSize: 13,
                                color: kText,
                                fontWeight: FontWeight.w700,
                                height: 1.3,
                              ),
                            ),
                            themeColor,
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Divider(color: themeColor.withValues(alpha: 0.06), height: 1),
                          ),
                          _buildInfoRow(
                            isSub ? Icons.vpn_key_rounded : Icons.receipt_long_rounded, 
                            isSub ? 'SUBSCRIPTION ID' : 'ORDER ID', 
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: themeColor.withValues(alpha: 0.06),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                orderIdVal,
                                style: TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                  color: themeColor,
                                ),
                              ),
                            ),
                            themeColor,
                          ),
                        ],
                      ),
                    ),

                    const Spacer(flex: 2),

                    // Premium DONE Button with Linear Gradient and Shadow Glow
                    Padding(
                      padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
                      child: Container(
                        width: double.infinity,
                        height: 54,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          gradient: LinearGradient(
                            colors: isSub
                                ? [kAccent, const Color(0xFFE28B00)]
                                : [kPrimary, kPrimaryLt],
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: themeColor.withValues(alpha: 0.24),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: ElevatedButton(
                          onPressed: () {
                            _autoDoneTimer?.cancel();
                            widget.onDone();
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            foregroundColor: Colors.white,
                            shadowColor: Colors.transparent,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          child: const Text(
                            'DONE',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAnimatedCheckmark() {
    return AnimatedBuilder(
      animation: _checkProgress,
      builder: (_, _) => CustomPaint(
        size: const Size(60, 60),
        painter: _CheckmarkPainter(_checkProgress.value),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, Widget valueWidget, Color themeColor) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: themeColor.withValues(alpha: 0.06),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: themeColor, size: 18),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 9.5,
                  color: kTextSub,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 4),
              valueWidget,
            ],
          ),
        ),
      ],
    );
  }
}

// Custom painter to draw an animated checkmark stroke
class _CheckmarkPainter extends CustomPainter {
  final double progress;
  _CheckmarkPainter(this.progress);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..strokeWidth = 4.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    final cx = size.width / 2;
    final cy = size.height / 2;

    final path = Path()
      ..moveTo(cx - 15, cy)
      ..lineTo(cx - 5, cy + 10)
      ..lineTo(cx + 18, cy - 12);

    final totalLength = 48.0;
    final drawLength = progress * totalLength;

    final pathMetric = path.computeMetrics().first;
    final extracted = pathMetric.extractPath(0, drawLength.clamp(0, pathMetric.length));
    canvas.drawPath(extracted, paint);
  }

  @override
  bool shouldRepaint(covariant _CheckmarkPainter oldDelegate) => oldDelegate.progress != progress;
}

// ══════════════════════════════════════════════════════════
//  6.  RIPPLE TAP EFFECT
//      Ink-ripple that emanates outward from tap point on cards
// ══════════════════════════════════════════════════════════

class RippleTapEffect extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  const RippleTapEffect({required this.child, this.onTap, super.key});

  @override
  State<RippleTapEffect> createState() => _RippleTapEffectState();
}

class _RippleTapEffectState extends State<RippleTapEffect>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _radius;
  late final Animation<double> _opacity;
  Offset _tapPos = Offset.zero;
  bool _rippling = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _radius = Tween<double>(begin: 0, end: 80).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOut),
    );
    _opacity = Tween<double>(begin: 0.25, end: 0.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _startRipple(TapDownDetails d) {
    setState(() {
      _tapPos = d.localPosition;
      _rippling = true;
    });
    _ctrl.forward(from: 0).then((_) {
      if (mounted) setState(() => _rippling = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _startRipple,
      onTap: widget.onTap,
      child: ClipRect(
        child: Stack(
          children: [
            widget.child,
            if (_rippling)
              AnimatedBuilder(
                animation: _ctrl,
                builder: (_, _) => Positioned.fill(
                  child: CustomPaint(
                    painter: _RipplePainter(_tapPos, _radius.value, _opacity.value),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _RipplePainter extends CustomPainter {
  final Offset center;
  final double radius;
  final double opacity;
  _RipplePainter(this.center, this.radius, this.opacity);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = kPrimary.withValues(alpha: opacity)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, radius, paint);
  }

  @override
  bool shouldRepaint(_RipplePainter old) => true;
}

// ══════════════════════════════════════════════════════════
//  7.  SHIMMER CONTAINER & FLIPKART-STYLE SHIMMER CARD
// ══════════════════════════════════════════════════════════

class ShimmerContainer extends StatefulWidget {
  final double width;
  final double height;
  final double borderRadius;
  const ShimmerContainer({required this.width, required this.height, this.borderRadius = 8, super.key});

  @override
  State<ShimmerContainer> createState() => _ShimmerContainerState();
}

class _ShimmerContainerState extends State<ShimmerContainer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
    _anim = Tween<double>(begin: 0.35, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (context, _) => Opacity(
        opacity: _anim.value,
        child: Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: kBgDeep,
            borderRadius: BorderRadius.circular(widget.borderRadius),
          ),
        ),
      ),
    );
  }
}

class FlipkartProductShimmer extends StatelessWidget {
  const FlipkartProductShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorderLt),
        boxShadow: const [
          BoxShadow(color: Color(0x061B4332), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: const Padding(
        padding: EdgeInsets.all(8.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image box shimmer
            ShimmerContainer(width: double.infinity, height: 100, borderRadius: 8),
            SizedBox(height: 12),
            // Title lines shimmer
            ShimmerContainer(width: 90, height: 12, borderRadius: 4),
            SizedBox(height: 6),
            ShimmerContainer(width: 50, height: 10, borderRadius: 4),
            Spacer(),
            // Price & Add button row shimmer
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ShimmerContainer(width: 40, height: 14, borderRadius: 4),
                    SizedBox(height: 4),
                    ShimmerContainer(width: 25, height: 8, borderRadius: 4),
                  ],
                ),
                ShimmerContainer(width: 28, height: 28, borderRadius: 8),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  8.  ROLLING MARQUEE LOADER & INITIAL LOADING SCREEN
// ══════════════════════════════════════════════════════════

class RollingMarquee extends StatefulWidget {
  const RollingMarquee({super.key});

  @override
  State<RollingMarquee> createState() => _RollingMarqueeState();
}

class _RollingMarqueeState extends State<RollingMarquee>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  static const List<_MarqueeItemData> _items = [
    _MarqueeItemData('Milk', Icons.water_drop_rounded, Color(0xFFE8F5E9), Color(0xFF1B5E20)),
    _MarqueeItemData('Curd', Icons.soup_kitchen_rounded, Color(0xFFE3F2FD), Color(0xFF0D47A1)),
    _MarqueeItemData('Kova', Icons.cake_rounded, Color(0xFFF3E5F5), Color(0xFF4A148C)),
    _MarqueeItemData('Almonds', Icons.grain_rounded, Color(0xFFFFF3E0), Color(0xFFE65100)),
    _MarqueeItemData('Ghee', Icons.opacity_rounded, Color(0xFFFFFDE7), Color(0xFFF57F17)),
    _MarqueeItemData('Butter', Icons.breakfast_dining_rounded, Color(0xFFFFF8E1), Color(0xFFFF6F00)),
    _MarqueeItemData('Paneer', Icons.grid_view_rounded, Color(0xFFE0F2F1), Color(0xFF004D40)),
    _MarqueeItemData('Chaas', Icons.local_cafe_rounded, Color(0xFFF1F8E9), Color(0xFF33691E)),
  ];

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 5),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) {
        const double itemWidth = 76.0;
        const double itemPadding = 24.0; // 12 left + 12 right
        const double unitSize = itemWidth + itemPadding;
        final double offset = -_ctrl.value * (unitSize * _items.length);

        return SizedBox(
          height: 100,
          child: ClipRect(
            child: OverflowBox(
              maxWidth: 4000, // Allows child Row to exceed screen width without overflow warnings
              alignment: Alignment.centerLeft,
              child: Transform.translate(
                offset: Offset(offset, 0),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: List.generate(24, (index) {
                    final item = _items[index % _items.length];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12.0),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 68,
                            height: 68,
                            decoration: BoxDecoration(
                              color: item.bg,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: item.iconColor.withValues(alpha: 0.2),
                                width: 1.5,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: item.iconColor.withValues(alpha: 0.12),
                                  blurRadius: 12,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Center(
                              child: Icon(
                                item.icon,
                                color: item.iconColor,
                                size: 32,
                              ),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            item.label,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: item.iconColor,
                              letterSpacing: -0.2,
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _MarqueeItemData {
  final String label;
  final IconData icon;
  final Color bg;
  final Color iconColor;
  const _MarqueeItemData(this.label, this.icon, this.bg, this.iconColor);
}

class InitialLoadingScreen extends StatelessWidget {
  const InitialLoadingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Logo
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: kBorderLt),
                  boxShadow: [
                    BoxShadow(
                      color: kPrimary.withValues(alpha: 0.08),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(17),
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Image.asset(
                      'assets/icon/app_icon.png',
                      fit: BoxFit.contain,
                      errorBuilder: (_, _, _) => const Icon(Icons.spa, color: kPrimary, size: 36),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'F2H Freshby',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: kPrimary,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Fresh Daily Essentials',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: kTextSub,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 32),
              const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  color: kPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
