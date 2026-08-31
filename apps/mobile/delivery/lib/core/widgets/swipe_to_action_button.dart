import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// A premium, customizable swipe-to-action slider button (e.g. Swipe to Return, Swipe to Deliver).
class SwipeToActionButton extends StatefulWidget {
  final Future<void> Function() onSwipeConfirmed;
  final String label;
  final String? loadingLabel;
  final IconData icon;
  final double height;
  final bool isLoading;
  final bool isEnabled;
  final Color primaryColor;
  final Color secondaryColor;
  final Color thumbColor;
  final Color iconColor;
  final Color textColor;
  final BorderRadius? borderRadius;

  const SwipeToActionButton({
    super.key,
    required this.onSwipeConfirmed,
    required this.label,
    this.loadingLabel,
    this.icon = Icons.arrow_forward_rounded,
    this.height = 52.0,
    this.isLoading = false,
    this.isEnabled = true,
    this.primaryColor = const Color(0xFF059669),
    this.secondaryColor = const Color(0xFF047857),
    this.thumbColor = Colors.white,
    this.iconColor = const Color(0xFF047857),
    this.textColor = Colors.white,
    this.borderRadius,
  });

  @override
  State<SwipeToActionButton> createState() => _SwipeToActionButtonState();
}

class _SwipeToActionButtonState extends State<SwipeToActionButton>
    with SingleTickerProviderStateMixin {
  double _dragValue = 0.0; // 0.0 to 1.0
  late AnimationController _springController;
  late Animation<double> _springAnimation;
  bool _isConfirming = false;

  @override
  void initState() {
    super.initState();
    _springController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );
    _springController.addListener(() {
      setState(() {
        _dragValue = _springAnimation.value;
      });
    });
  }

  @override
  void didUpdateWidget(covariant SwipeToActionButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.isLoading && oldWidget.isLoading) {
      // Finished loading -> reset slider
      _resetSlider();
    }
  }

  @override
  void dispose() {
    _springController.dispose();
    super.dispose();
  }

  void _resetSlider() {
    if (!mounted) return;
    _springAnimation = Tween<double>(begin: _dragValue, end: 0.0).animate(
      CurvedAnimation(parent: _springController, curve: Curves.easeOutBack),
    );
    _springController.forward(from: 0.0);
    _isConfirming = false;
  }

  void _onDragUpdate(DragUpdateDetails details, double maxDragDistance) {
    if (!widget.isEnabled || widget.isLoading || _isConfirming) return;
    if (maxDragDistance <= 0) return;

    final newDragValue = (_dragValue * maxDragDistance + details.primaryDelta!) / maxDragDistance;
    setState(() {
      _dragValue = newDragValue.clamp(0.0, 1.0);
    });
  }

  void _onDragEnd(DragEndDetails details, double maxDragDistance) async {
    if (!widget.isEnabled || widget.isLoading || _isConfirming) return;

    // If dragged past 82% threshold, trigger confirmation
    if (_dragValue >= 0.82) {
      HapticFeedback.heavyImpact();
      setState(() {
        _dragValue = 1.0;
        _isConfirming = true;
      });

      try {
        await widget.onSwipeConfirmed();
      } finally {
        if (mounted) {
          _resetSlider();
        }
      }
    } else {
      // Snap back smoothly
      HapticFeedback.lightImpact();
      _resetSlider();
    }
  }

  @override
  Widget build(BuildContext context) {
    final effectiveBorderRadius = widget.borderRadius ?? BorderRadius.circular(widget.height / 2);
    final thumbSize = widget.height - 8; // 4px padding on each side

    return LayoutBuilder(
      builder: (context, constraints) {
        final totalWidth = constraints.maxWidth;
        final maxDragDistance = totalWidth - thumbSize - 8; // 4px margin each side

        final currentOffset = _dragValue * (maxDragDistance > 0 ? maxDragDistance : 0);
        final isBusy = widget.isLoading || _isConfirming;

        return Container(
          width: totalWidth,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: effectiveBorderRadius,
            gradient: LinearGradient(
              colors: widget.isEnabled
                  ? [widget.primaryColor, widget.secondaryColor]
                  : [const Color(0xFF94A3B8), const Color(0xFF64748B)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: widget.isEnabled && !isBusy
                ? [
                    BoxShadow(
                      color: widget.primaryColor.withOpacity(0.35),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Stack(
            alignment: Alignment.centerLeft,
            children: [
              // 1. Shimmer/Filled Progress Track behind thumb
              if (_dragValue > 0.01)
                Positioned(
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: (currentOffset + thumbSize + 4).clamp(0.0, totalWidth),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: effectiveBorderRadius,
                      gradient: LinearGradient(
                        colors: [
                          widget.secondaryColor.withOpacity(0.6),
                          Colors.white.withOpacity(0.2),
                        ],
                      ),
                    ),
                  ),
                ),

              // 2. Center Text Label & Chevrons (Fades as slider advances)
              Center(
                child: Opacity(
                  opacity: isBusy ? 1.0 : (1.0 - (_dragValue * 1.5)).clamp(0.0, 1.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isBusy) ...[
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2.2,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          widget.loadingLabel ?? 'Submitting Return…',
                          style: GoogleFonts.roboto(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w800,
                            color: widget.textColor,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ] else ...[
                        Text(
                          widget.label,
                          style: GoogleFonts.roboto(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w800,
                            color: widget.textColor,
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(
                          Icons.chevron_right_rounded,
                          size: 18,
                          color: Colors.white70,
                        ),
                        const Icon(
                          Icons.chevron_right_rounded,
                          size: 18,
                          color: Colors.white38,
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // 3. Draggable Sliding Thumb Knob
              if (!isBusy)
                Positioned(
                  left: 4 + currentOffset,
                  child: GestureDetector(
                    onHorizontalDragUpdate: (details) => _onDragUpdate(details, maxDragDistance),
                    onHorizontalDragEnd: (details) => _onDragEnd(details, maxDragDistance),
                    onHorizontalDragCancel: _resetSlider,
                    child: Container(
                      width: thumbSize,
                      height: thumbSize,
                      decoration: BoxDecoration(
                        color: widget.thumbColor,
                        shape: BoxShape.circle,
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x33000000),
                            blurRadius: 6,
                            offset: Offset(1, 2),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Icon(
                          widget.icon,
                          size: 22,
                          color: widget.iconColor,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
