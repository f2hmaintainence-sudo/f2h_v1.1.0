import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'cow_loading_widget.dart';

class AppRefreshIndicator extends StatefulWidget {
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
  State<AppRefreshIndicator> createState() => _AppRefreshIndicatorState();
}

class _AppRefreshIndicatorState extends State<AppRefreshIndicator> {
  bool _isRefreshing = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_isRefreshing)
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: const Center(
              child: CowLoadingWidget(size: 70),
            ),
          ),
        Expanded(
          child: RefreshIndicator(
            color: widget.color ?? kPrimary,
            backgroundColor: widget.backgroundColor ?? kSurface,
            displacement: widget.displacement,
            strokeWidth: 2.5,
            triggerMode: RefreshIndicatorTriggerMode.anywhere,
            onRefresh: () async {
              await HapticFeedback.mediumImpact();
              if (mounted) {
                setState(() {
                  _isRefreshing = true;
                });
              }
              try {
                await widget.onRefresh();
              } finally {
                if (mounted) {
                  setState(() {
                    _isRefreshing = false;
                  });
                }
              }
            },
            child: widget.child,
          ),
        ),
      ],
    );
  }
}
