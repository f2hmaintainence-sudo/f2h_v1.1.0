import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

/// Displays the daily bottle tracking metrics (dispatched, collected,
/// outstanding, to return).
///
/// Returns [SizedBox.shrink] silently when all counts are zero (no bottles
/// were part of today's run).
class BottleTrackerCard extends StatelessWidget {
  final int expected;
  final int collected;
  final int outstanding;
  final int toReturn;

  const BottleTrackerCard({
    super.key,
    required this.expected,
    required this.collected,
    required this.outstanding,
    required this.toReturn,
  });

  @override
  Widget build(BuildContext context) {
    if (expected == 0 && collected == 0 && outstanding == 0) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: kText.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.opacity_rounded, color: Colors.teal, size: 20),
              SizedBox(width: 8),
              Text(
                'Bottle Tracker Today',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 14,
                  color: kText,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _BottleMetricTile('Dispatched', expected.toString(), Colors.blue),
              const SizedBox(width: 8),
              _BottleMetricTile('Collected', collected.toString(), kSuccess),
              const SizedBox(width: 8),
              _BottleMetricTile('Outstanding', outstanding.toString(), Colors.orange),
              const SizedBox(width: 8),
              _BottleMetricTile('To Return', toReturn.toString(), Colors.teal),
            ],
          ),
        ],
      ),
    );
  }
}

/// Private tile used by [BottleTrackerCard].
class _BottleMetricTile extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _BottleMetricTile(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w800,
                color: kTextSub,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
