import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
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
    final isPending = !isDelivered && !isFailed;
    final isHighlightedNext = isNext && isPending;

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
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          decoration: BoxDecoration(
            color: isHighlightedNext
                ? Colors.white
                : (isDelivered || isFailed ? const Color(0xFFF8FAFC) : Colors.white),
            borderRadius: BorderRadius.circular(isHighlightedNext ? 22 : 18),
            border: Border.all(
              color: isHighlightedNext
                  ? const Color(0xFF16A34A)
                  : (isDelivered
                      ? const Color(0xFF86EFAC).withValues(alpha: 0.5)
                      : (isFailed ? const Color(0xFFFCA5A5).withValues(alpha: 0.5) : const Color(0xFFE2E8F0))),
              width: isHighlightedNext ? 2.0 : 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: isHighlightedNext
                    ? const Color(0xFF16A34A).withValues(alpha: 0.12)
                    : Colors.black.withValues(alpha: 0.03),
                blurRadius: isHighlightedNext ? 16 : 8,
                offset: Offset(0, isHighlightedNext ? 6 : 2),
              )
            ],
          ),
          padding: EdgeInsets.all(isHighlightedNext ? 18 : 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Next Delivery Stop Highlight Banner
              if (isHighlightedNext) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF16A34A).withValues(alpha: 0.25),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.flash_on_rounded, color: Colors.white, size: 12),
                          const SizedBox(width: 4),
                          Text(
                            'NEXT DELIVERY STOP',
                            style: GoogleFonts.poppins(
                              color: Colors.white,
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.6,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFDCFCE7)),
                      ),
                      child: Text(
                        distanceStr,
                        style: GoogleFonts.poppins(
                          color: const Color(0xFF15803D),
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],

              // Header Row: Stop Indicator Avatar + Customer Name & Phone + Action Buttons
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Visual Stop Avatar (#1, #2, etc.)
                  CircleAvatar(
                    radius: isHighlightedNext ? 22 : 19,
                    backgroundColor: isHighlightedNext
                        ? const Color(0xFFDCFCE7)
                        : (isDelivered
                            ? const Color(0xFFDCFCE7)
                            : (isFailed ? const Color(0xFFFEE2E2) : const Color(0xFFF1F5F9))),
                    child: isDelivered
                        ? const Icon(Icons.check_rounded, color: Color(0xFF16A34A), size: 20)
                        : (isFailed
                            ? const Icon(Icons.close_rounded, color: Color(0xFFDC2626), size: 20)
                            : Text(
                                '#${stop.stop}',
                                style: GoogleFonts.poppins(
                                  fontWeight: FontWeight.w900,
                                  color: isHighlightedNext ? const Color(0xFF15803D) : const Color(0xFF0F172A),
                                  fontSize: isHighlightedNext ? 14 : 12.5,
                                ),
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
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.w800,
                            fontSize: isHighlightedNext ? 16 : 14.5,
                            color: isDelivered || isFailed ? const Color(0xFF94A3B8) : const Color(0xFF0F172A),
                            decoration: isDelivered ? TextDecoration.lineThrough : null,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (stop.customerPhone.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            stop.customerPhone,
                            style: GoogleFonts.poppins(
                              fontSize: isHighlightedNext ? 13 : 12,
                              color: const Color(0xFF64748B),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Quick Action Icons: Call, Navigate, and Deliver
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // 1. Call button
                      if (stop.customerPhone.isNotEmpty) ...[
                        GestureDetector(
                          onTap: () => _callPhone(stop.customerPhone),
                          child: Container(
                            padding: EdgeInsets.all(isHighlightedNext ? 9 : 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0xFFDBEAFE)),
                            ),
                            child: const Icon(Icons.phone_rounded, color: Color(0xFF2563EB), size: 17),
                          ),
                        ),
                        const SizedBox(width: 7),
                      ],

                      // 2. Navigate button
                      GestureDetector(
                        onTap: () => _openNav(context, stop),
                        child: Container(
                          padding: EdgeInsets.all(isHighlightedNext ? 9 : 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFFDCFCE7)),
                          ),
                          child: const Icon(Icons.navigation_rounded, color: Color(0xFF16A34A), size: 17),
                        ),
                      ),
                      const SizedBox(width: 7),

                      // 3. Deliver Icon (Right side of navigation icon)
                      if (isPending)
                        GestureDetector(
                          onTap: onDeliverTap,
                          child: Container(
                            padding: EdgeInsets.all(isHighlightedNext ? 9 : 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF16A34A),
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF16A34A).withValues(alpha: 0.35),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Icon(Icons.check_rounded, color: Colors.white, size: 17),
                          ),
                        )
                      else
                        Container(
                          padding: EdgeInsets.all(isHighlightedNext ? 9 : 8),
                          decoration: BoxDecoration(
                            color: isDelivered ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            isDelivered ? Icons.check_circle_rounded : Icons.cancel_rounded,
                            color: isDelivered ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                            size: 17,
                          ),
                        ),
                    ],
                  ),
                ],
              ),

              // Address Row
              if (stop.address.isNotEmpty) ...[
                SizedBox(height: isHighlightedNext ? 12 : 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.location_on_outlined,
                      color: isHighlightedNext ? const Color(0xFF16A34A) : const Color(0xFF94A3B8),
                      size: isHighlightedNext ? 17 : 15,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        stop.address,
                        style: GoogleFonts.poppins(
                          fontSize: isHighlightedNext ? 13 : 12,
                          color: isHighlightedNext ? const Color(0xFF334155) : const Color(0xFF64748B),
                          height: 1.35,
                          fontWeight: isHighlightedNext ? FontWeight.w600 : FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ],

              // Next Stop Prominent Delivery CTA
              if (isHighlightedNext) ...[
                const SizedBox(height: 14),
                GestureDetector(
                  onTap: onDeliverTap,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                      ),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF16A34A).withValues(alpha: 0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'Deliver Stop #${stop.stop}',
                          style: GoogleFonts.poppins(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 13.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
