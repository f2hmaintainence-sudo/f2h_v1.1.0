import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class AppRefreshIndicator extends StatelessWidget {
  final Widget child;
  final Future<void> Function() onRefresh;
  final Color? color;
  final Color? backgroundColor;
  final double displacement;

  const AppRefreshIndicator({
    super.key,
    required this.child,
    required this.onRefresh,
    this.color,
    this.backgroundColor,
    this.displacement = 40.0,
  });

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: color ?? kPrimary,
      backgroundColor: backgroundColor ?? kSurface,
      displacement: displacement,
      strokeWidth: 2.5,
      triggerMode: RefreshIndicatorTriggerMode.anywhere,
      onRefresh: () async {
        // Trigger haptic feedback for a premium native feel
        await HapticFeedback.mediumImpact();
        await onRefresh();
      },
      child: child,
    );
  }
}
