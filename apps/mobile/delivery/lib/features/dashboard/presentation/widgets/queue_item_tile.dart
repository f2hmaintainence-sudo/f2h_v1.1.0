import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/utils/stop_status_helper.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/order_detail_screen.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/report_issue_screen.dart';
import 'package:f2h_delivery/features/tracking/presentation/screens/map_screen.dart';

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

  void _callPhone(String phone) async {
    if (phone.trim().isEmpty) return;
    final url = Uri.parse('tel:$phone');
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }
  }

  void _openNav(BuildContext context, GroupedStop stop) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MapScreen(
          focusedStop: stop,
          isStandalonePage: true,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDelivered = StopStatusHelper.isDelivered(stop.status);
    final isFailed = StopStatusHelper.isFailed(stop.status);

    return Dismissible(
      key: ValueKey('queue_stop_${stop.addressId}_${stop.customerId}_${stop.stop}'),
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
        return false;
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
                  ? kPrimary.withValues(alpha: 0.4)
                  : (isDelivered ? kSuccess.withValues(alpha: 0.2) : (isFailed ? kDanger.withValues(alpha: 0.2) : kBorder)),
              width: isNext ? 2.0 : 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: kText.withValues(alpha: 0.02),
                blurRadius: 8,
                offset: const Offset(0, 4),
              )
            ],
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Row: Stop Avatar + Customer Name & Phone + Action Buttons
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Visual stop indicator (#1, #2, etc.)
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
                  const SizedBox(width: 12),

                  // Customer Name and Phone
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          stop.customerName,
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
                            color: isDelivered || isFailed ? kTextSub : kText,
                            decoration: isDelivered ? TextDecoration.lineThrough : null,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (stop.customerPhone.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            stop.customerPhone,
                            style: const TextStyle(
                              fontSize: 12.5,
                              color: kTextSub,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Quick Action Icons: Call & Navigate
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (stop.customerPhone.isNotEmpty)
                        GestureDetector(
                          onTap: () => _callPhone(stop.customerPhone),
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0xFFDBEAFE)),
                            ),
                            child: const Icon(Icons.phone_rounded, color: Color(0xFF2563EB), size: 18),
                          ),
                        ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () => _openNav(context, stop),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFFDCFCE7)),
                          ),
                          child: const Icon(Icons.navigation_rounded, color: Color(0xFF16A34A), size: 18),
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              // Address Row
              if (stop.address.isNotEmpty) ...[
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.location_on_outlined, color: kMuted, size: 16),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        stop.address,
                        style: const TextStyle(
                          fontSize: 12.5,
                          color: kTextSub,
                          height: 1.35,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
