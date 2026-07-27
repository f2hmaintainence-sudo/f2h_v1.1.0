import 'package:flutter/material.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/utils/stop_status_helper.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/order_detail_screen.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/report_issue_screen.dart';

class QueueItemTile extends StatelessWidget {
  final GroupedStop stop;
  final bool isNext;
  final String distanceStr;
  final VoidCallback onDeliverTap;

  const QueueItemTile({
    super.key,
    required this.stop,
    required this.isNext,
    required this.distanceStr,
    required this.onDeliverTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDelivered = StopStatusHelper.isDelivered(stop.status);
    final isFailed = StopStatusHelper.isFailed(stop.status);
    final itemsCount = stop.products.fold<int>(0, (sum, p) => sum + p.quantity);
    final orderTypes = stop.orders.map((o) => o.orderType).toSet();
    final hasSubscription = orderTypes.contains('subscription');
    final typeLabel = orderTypes.length > 1 ? 'MIXED' : (hasSubscription ? 'SUB' : 'ONCE');

    return Dismissible(
      key: ValueKey('queue_stop_${stop.customerId}_${stop.stop}'),
      confirmDismiss: (direction) async {
        if (isDelivered || isFailed) return false;
        if (direction == DismissDirection.startToEnd) {
          // Swipe Right: Deliver
          onDeliverTap();
        } else {
          // Swipe Left: Report Issue
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => ReportIssueScreen(order: stop.orders.first)),
          );
        }
        return false; // Prevent sliding out from list automatically
      },
      background: Container(
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(color: kSuccess, borderRadius: BorderRadius.circular(20)),
        child: const Icon(Icons.check_circle_rounded, color: Colors.white, size: 28),
      ),
      secondaryBackground: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(color: kDanger, borderRadius: BorderRadius.circular(20)),
        child: const Icon(Icons.report_problem_rounded, color: Colors.white, size: 28),
      ),
      child: GestureDetector(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => OrderDetailScreen(stop: stop)),
          );
        },
        child: Container(
          decoration: BoxDecoration(
            color: isNext ? kSurface : (isDelivered || isFailed ? kBgDeep.withValues(alpha: 0.5) : kSurface),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isNext 
                  ? kPrimary.withValues(alpha: 0.35) 
                  : (isDelivered ? kSuccess.withValues(alpha: 0.2) : (isFailed ? kDanger.withValues(alpha: 0.2) : kBorder)),
              width: isNext ? 2.0 : 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: kText.withValues(alpha: 0.01),
                blurRadius: 8,
                offset: const Offset(0, 4),
              )
            ],
          ),
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // Visual stop indicator
              Column(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: isDelivered 
                        ? kSuccess.withValues(alpha: 0.12)
                        : (isFailed ? kDanger.withValues(alpha: 0.12) : kBgDeep),
                    child: isDelivered
                        ? const Icon(Icons.check_rounded, color: kSuccess, size: 20)
                        : (isFailed 
                            ? const Icon(Icons.close_rounded, color: kDanger, size: 20)
                            : Text(
                                '#${stop.stop}',
                                style: const TextStyle(fontWeight: FontWeight.w900, color: kText, fontSize: 13),
                              )),
                  ),
                ],
              ),
              const SizedBox(width: 14),

              // Details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            stop.customerName,
                            style: TextStyle(
                              fontWeight: FontWeight.w900, 
                              fontSize: 14.5, 
                              color: isDelivered || isFailed ? kTextSub : kText,
                              decoration: isDelivered ? TextDecoration.lineThrough : null,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: hasSubscription ? kPrimaryPl : kAccentLt,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            typeLabel,
                            style: TextStyle(
                              color: hasSubscription ? kPrimary : kAccent,
                              fontWeight: FontWeight.w900,
                              fontSize: 8,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$itemsCount Item${itemsCount == 1 ? '' : 's'} · $distanceStr · ${stop.deliverySlot}',
                      style: const TextStyle(fontSize: 11.5, color: kTextSub, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),

              // Right arrow navigation icon
              Icon(Icons.arrow_forward_ios_rounded, color: kTextSub.withValues(alpha: 0.5), size: 14),
            ],
          ),
        ),
      ),
    );
  }
}
