import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/warehouse_handover_screen.dart';

/// Displays a contextual status banner when the delivery run is [completed]
/// (needs warehouse handover) or [handed_over] (shift fully done).
///
/// Returns [SizedBox.shrink] for all other states, including when [currentRun]
/// is null (no active run today).
class HandoverStatusCard extends StatelessWidget {
  final DeliveryRun? currentRun;

  const HandoverStatusCard({super.key, required this.currentRun});

  @override
  Widget build(BuildContext context) {
    final run = currentRun;
    if (run == null) return const SizedBox.shrink();

    // Check if session has all orders completed as a fallback
    bool allOrdersDone = false;
    try {
      final sessionState = context.read<DeliverySessionBloc>().state;
      if (sessionState is DeliverySessionLoaded) {
        allOrdersDone = sessionState.orders.isNotEmpty &&
            sessionState.orders.every((o) =>
                o.status == 'delivered' ||
                o.status == 'failed' ||
                o.status == 'completed' ||
                o.status == 'cancelled');
      }
    } catch (_) {}

    final isCompleted = run.status == 'completed' ||
        (allOrdersDone && run.status != 'handed_over');

    if (isCompleted) {
      return Container(
        margin: const EdgeInsets.only(top: 16, bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kDanger.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kDanger.withValues(alpha: 0.2), width: 1.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: const BoxDecoration(
                    color: Colors.redAccent,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.warehouse_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Delivery Run Completed!',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                          color: kText,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Proceed to Warehouse to return empty bottles and undelivered items.',
                        style: TextStyle(
                          fontSize: 12,
                          color: kTextSub,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ElevatedButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const WarehouseHandoverScreen(),
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: kDanger,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.directions_walk_rounded, size: 16),
                  SizedBox(width: 6),
                  Text(
                    'GO TO WAREHOUSE HANDOVER',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (run.status == 'handed_over') {
      return Container(
        margin: const EdgeInsets.only(top: 16, bottom: 16),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: kSuccess.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kSuccess.withValues(alpha: 0.2), width: 1.5),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: const BoxDecoration(
                color: kSuccess,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_outline_rounded,
                color: Colors.white,
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Shift Completed!',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                      color: kText,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Warehouse handover checked and closed successfully. Have a great day!',
                    style: TextStyle(
                      fontSize: 12,
                      color: kTextSub,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }
}
