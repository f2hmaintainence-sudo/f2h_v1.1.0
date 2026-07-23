import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';

/// A single row card shown in the "To Collect" tab listing stops
/// that are awaiting warehouse pickup.
///
/// Extracted from the inline [List.generate] in [DashboardScreen].
class CollectQueueItem extends StatelessWidget {
  final GroupedStop stop;

  const CollectQueueItem({super.key, required this.stop});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: kPrimary.withOpacity(0.1),
            child: Text(
              '#${stop.stop}',
              style: const TextStyle(
                fontWeight: FontWeight.w900,
                color: kPrimary,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  stop.customerName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 14,
                    color: kText,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${stop.orders.length} Order(s) · ${stop.deliverySlot}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: kTextSub,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: kAccent.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              stop.orders.first.status.toUpperCase(),
              style: const TextStyle(
                color: kAccent,
                fontWeight: FontWeight.w900,
                fontSize: 10,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
