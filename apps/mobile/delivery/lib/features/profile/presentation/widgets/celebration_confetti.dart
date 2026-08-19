import 'dart:math';
import 'package:flutter/material.dart';

class CelebrationConfetti extends StatefulWidget {
  final Widget child;
  final bool isPlaying;
  final Duration duration;

  const CelebrationConfetti({
    super.key,
    required this.child,
    this.isPlaying = true,
    this.duration = const Duration(seconds: 4),
  });

  @override
  State<CelebrationConfetti> createState() => _CelebrationConfettiState();
}

class _CelebrationConfettiState extends State<CelebrationConfetti>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final List<_ConfettiParticle> _particles = [];
  final Random _random = Random();

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );

    _generateParticles();

    if (widget.isPlaying) {
      _controller.forward(from: 0.0);
    }
  }

  @override
  void didUpdateWidget(CelebrationConfetti oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isPlaying && !oldWidget.isPlaying) {
      _generateParticles();
      _controller.forward(from: 0.0);
    }
  }

  void _generateParticles() {
    _particles.clear();
    final colors = [
      const Color(0xFF10B981), // Emerald
      const Color(0xFFF59E0B), // Amber Gold
      const Color(0xFF3B82F6), // Vibrant Blue
      const Color(0xFFEC4899), // Pink Rose
      const Color(0xFF8B5CF6), // Purple
      const Color(0xFF06B6D4), // Cyan
      const Color(0xFF22C55E), // Green
      Colors.white,
    ];

    for (int i = 0; i < 65; i++) {
      _particles.add(
        _ConfettiParticle(
          x: _random.nextDouble(),
          y: -_random.nextDouble() * 0.4, // start slightly above top
          speedY: 0.25 + _random.nextDouble() * 0.55,
          speedX: (_random.nextDouble() - 0.5) * 0.3,
          rotation: _random.nextDouble() * 2 * pi,
          rotationSpeed: (_random.nextDouble() - 0.5) * 6,
          size: 6.0 + _random.nextDouble() * 8.0,
          color: colors[_random.nextInt(colors.length)],
          isCircle: _random.nextBool(),
          isStar: i % 5 == 0,
        ),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        if (widget.isPlaying)
          Positioned.fill(
            child: IgnorePointer(
              child: AnimatedBuilder(
                animation: _controller,
                builder: (context, _) {
                  return CustomPaint(
                    painter: _ConfettiPainter(
                      particles: _particles,
                      progress: _controller.value,
                    ),
                  );
                },
              ),
            ),
          ),
      ],
    );
  }
}

class _ConfettiParticle {
  final double x;
  final double y;
  final double speedY;
  final double speedX;
  final double rotation;
  final double rotationSpeed;
  final double size;
  final Color color;
  final bool isCircle;
  final bool isStar;

  _ConfettiParticle({
    required this.x,
    required this.y,
    required this.speedY,
    required this.speedX,
    required this.rotation,
    required this.rotationSpeed,
    required this.size,
    required this.color,
    required this.isCircle,
    required this.isStar,
  });
}

class _ConfettiPainter extends CustomPainter {
  final List<_ConfettiParticle> particles;
  final double progress;

  _ConfettiPainter({
    required this.particles,
    required this.progress,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (progress >= 1.0) return;

    final opacity = (1.0 - progress * 0.8).clamp(0.0, 1.0);

    for (final p in particles) {
      final currentX = (p.x + p.speedX * progress) * size.width;
      final currentY = (p.y + p.speedY * progress * 1.3) * size.height;
      final currentRotation = p.rotation + p.rotationSpeed * progress;

      if (currentY > size.height) continue;

      final paint = Paint()
        ..color = p.color.withValues(alpha: opacity)
        ..style = PaintingStyle.fill;

      canvas.save();
      canvas.translate(currentX, currentY);
      canvas.rotate(currentRotation);

      if (p.isStar) {
        _drawStar(canvas, paint, p.size);
      } else if (p.isCircle) {
        canvas.drawCircle(Offset.zero, p.size / 2, paint);
      } else {
        canvas.drawRect(
          Rect.fromCenter(
            center: Offset.zero,
            width: p.size,
            height: p.size * 0.6,
          ),
          paint,
        );
      }

      canvas.restore();
    }
  }

  void _drawStar(Canvas canvas, Paint paint, double size) {
    final path = Path();
    final half = size / 2;
    path.moveTo(0, -half);
    path.lineTo(half * 0.3, -half * 0.3);
    path.lineTo(half, 0);
    path.lineTo(half * 0.3, half * 0.3);
    path.lineTo(0, half);
    path.lineTo(-half * 0.3, half * 0.3);
    path.lineTo(-half, 0);
    path.lineTo(-half * 0.3, -half * 0.3);
    path.close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_ConfettiPainter oldDelegate) => true;
}
