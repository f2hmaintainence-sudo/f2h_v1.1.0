import 'dart:math' as math;
import 'package:flutter/material.dart';

class ScrollingItemsLoader extends StatefulWidget {
  final String text;
  const ScrollingItemsLoader({
    this.text = 'Getting your BIG basket ready',
    super.key,
  });

  @override
  State<ScrollingItemsLoader> createState() => _ScrollingItemsLoaderState();
}

class _ScrollingItemsLoaderState extends State<ScrollingItemsLoader> with SingleTickerProviderStateMixin {
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
      duration: const Duration(seconds: 4),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 100,
          width: double.infinity,
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              final screenWidth = MediaQuery.of(context).size.width;
              return Stack(
                clipBehavior: Clip.none,
                children: List.generate(8, (index) {
                  final imgIndex = index % _images.length;
                  final itemSize = 74.0;
                  final spacing = 36.0;
                  final totalItemWidth = itemSize + spacing;
                  final loopWidth = totalItemWidth * _images.length;
                  
                  // Slide from right to left in a line
                  double x = screenWidth - (_controller.value * loopWidth) + (index * totalItemWidth);
                  x = (x + loopWidth) % (loopWidth + screenWidth) - totalItemWidth;

                  // Rotate clockwise as they move
                  final rotationAngle = _controller.value * 4 * math.pi + (index * math.pi / 2);

                  return Positioned(
                    left: x,
                    top: 10,
                    child: Transform.rotate(
                      angle: rotationAngle,
                      child: Image.asset(
                        _images[imgIndex],
                        height: itemSize,
                        width: itemSize,
                        fit: BoxFit.contain,
                      ),
                    ),
                  );
                }),
              );
            },
          ),
        ),
        const SizedBox(height: 28),
        Text(
          widget.text,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: Color(0xFF222222),
            letterSpacing: -0.2,
          ),
        ),
      ],
    );
  }
}
