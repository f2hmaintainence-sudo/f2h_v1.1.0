import 'dart:math';
import 'package:flutter/material.dart';

/// A colorful paper blast (confetti) celebration animation widget.
/// Renders 70+ vibrant paper confetti pieces bursting outwards and floating down.
class ColorPaperBlast extends StatefulWidget {
  final Widget child;
  final bool trigger;
  final Duration duration;

  const ColorPaperBlast({
    super.key,
    required this.child,
    this.trigger = false,
    this.duration = const Duration(milliseconds: 3000),
  });

  @override
  State<ColorPaperBlast> createState() => _ColorPaperBlastState();
}

class _ColorPaperBlastState extends State<ColorPaperBlast>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final List<_ConfettiParticle> _particles;
  final _random = Random();

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration);
    _particles = List.generate(70, (_) => _ConfettiParticle(_random));

    if (widget.trigger) {
      _ctrl.forward(from: 0.0);
    }
  }

  @override
  void didUpdateWidget(covariant ColorPaperBlast oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.trigger && !oldWidget.trigger) {
      for (final p in _particles) {
        p.reset(_random);
      }
      _ctrl.forward(from: 0.0);
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        AnimatedBuilder(
          animation: _ctrl,
          builder: (context, _) {
            if (!_ctrl.isAnimating && _ctrl.value == 1.0) {
              return const SizedBox.shrink();
            }
            return IgnorePointer(
              child: CustomPaint(
                size: Size.infinite,
                painter: _ConfettiPainter(
                  progress: _ctrl.value,
                  particles: _particles,
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

class _ConfettiParticle {
  late Color color;
  late double x; // -0.5 to 0.5 initial burst offset
  late double vx; // horizontal velocity
  late double vy; // vertical velocity
  late double size;
  late double rotation;
  late double rotationSpeed;
  late int shapeType; // 0 = rectangle, 1 = circle, 2 = ribbon

  static const List<Color> _palette = [
    Color(0xFFFF3B30),
    Color(0xFFFF9500),
    Color(0xFFFFCC00),
    Color(0xFF34C759),
    Color(0xFF007AFF),
    Color(0xFFAF52DE),
    Color(0xFFFF2D55),
    Color(0xFF10B981),
    Color(0xFFF59E0B),
  ];

  _ConfettiParticle(Random r) {
    reset(r);
  }

  void reset(Random r) {
    color = _palette[r.nextInt(_palette.length)];
    x = (r.nextDouble() - 0.5) * 0.4;
    vx = (r.nextDouble() - 0.5) * 600;
    vy = -r.nextDouble() * 500 - 300; // upward burst
    size = r.nextDouble() * 8 + 6;
    rotation = r.nextDouble() * 2 * pi;
    rotationSpeed = (r.nextDouble() - 0.5) * 10;
    shapeType = r.nextInt(3);
  }
}

class _ConfettiPainter extends CustomPainter {
  final double progress;
  final List<_ConfettiParticle> particles;

  _ConfettiPainter({required this.progress, required this.particles});

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0.0 || progress >= 1.0) return;

    final centerX = size.width / 2;
    final startY = size.height * 0.25; // Burst origin near top-center

    final dt = progress * 2.5; // time in seconds
    final opacity = (1.0 - progress).clamp(0.0, 1.0);

    for (final p in particles) {
      // Physics calculation: position = start + v*t + 0.5*g*t^2
      final currentX = centerX + p.x * size.width + p.vx * dt + sin(dt * 5 + p.size) * 20;
      final currentY = startY + p.vy * dt + 0.5 * 700 * dt * dt; // gravity = 700

      if (currentY > size.height) continue;

      final currentRotation = p.rotation + p.rotationSpeed * dt;

      canvas.save();
      canvas.translate(currentX, currentY);
      canvas.rotate(currentRotation);

      final paint = Paint()
        ..color = p.color.withValues(alpha: opacity)
        ..style = PaintingStyle.fill;

      if (p.shapeType == 0) {
        // Rectangle paper piece
        canvas.drawRect(
          Rect.fromCenter(
            center: Offset.zero,
            width: p.size,
            height: p.size * 0.6,
          ),
          paint,
        );
      } else if (p.shapeType == 1) {
        // Circle paper piece
        canvas.drawCircle(Offset.zero, p.size / 2, paint);
      } else {
        // Ribbon / Strip paper piece
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(
              center: Offset.zero,
              width: p.size * 1.4,
              height: p.size * 0.4,
            ),
            const Radius.circular(2),
          ),
          paint,
        );
      }

      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}
