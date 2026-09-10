import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';

class ORow extends StatelessWidget {
  final Order o;
  const ORow(this.o, {super.key});

  String _formatSlot(String slot) {
    final s = slot.trim().toLowerCase();
    if (s == 'morning') return 'Morning Slot';
    if (s == 'evening') return 'Evening Slot';
    if (s.isEmpty) return '';
    return slot.trim();
  }

  @override
  Widget build(BuildContext context) {
    Color statusFgColor = kPrimary;
    IconData statusIcon = Icons.check_circle;
    String statusText = 'Delivered';

    final normalizedStatus = o.status.toLowerCase();
    if (normalizedStatus == 'delivered') {
      statusFgColor = kPrimary;
      statusIcon = Icons.check_circle;
      statusText = 'Delivered';
    } else if (normalizedStatus == 'cancelled') {
      statusFgColor = const Color(0xFFDC2626);
      statusIcon = Icons.cancel;
      statusText = 'Cancelled';
    } else if (normalizedStatus == 'placed') {
      statusFgColor = Colors.orange.shade700;
      statusIcon = Icons.hourglass_empty;
      statusText = 'Placed';
    } else if (normalizedStatus == 'confirmed') {
      statusFgColor = const Color(0xFF2563EB);
      statusIcon = Icons.local_shipping;
      statusText = 'Confirmed';
    } else if (normalizedStatus == 'assigned') {
      statusFgColor = const Color(0xFF2563EB);
      statusIcon = Icons.local_shipping;
      statusText = 'Assigned';
    } else if (normalizedStatus == 'skipped') {
      statusFgColor = const Color(0xFFDC2626);
      statusIcon = Icons.skip_next;
      statusText = 'Skipped';
    } else {
      statusFgColor = const Color(0xFF2563EB);
      statusIcon = Icons.local_shipping;
      statusText = o.status;
    }

    final isSubOrder = o.orderSource == 'subscription';
    final slotText = _formatSlot(o.deliverySlot);
    final isDelivered = normalizedStatus == 'delivered';
    String deliveryTimeOnly = '';
    if (isDelivered) {
      final rawTime = o.deliveredAt.isNotEmpty ? o.deliveredAt : o.updatedAt;
      if (rawTime.isNotEmpty) {
        try {
          final dt = DateTime.parse(rawTime).toLocal();
          final hour = dt.hour;
          final minute = dt.minute.toString().padLeft(2, '0');
          final period = hour >= 12 ? 'PM' : 'AM';
          final formattedHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
          deliveryTimeOnly = '${formattedHour.toString().padLeft(2, '0')}:$minute $period';
        } catch (_) {}
      }
    }
    final dateDisplay = o.date.isNotEmpty ? o.date : 'Scheduled';
    final slotPart = slotText.isNotEmpty ? ' · $slotText' : '';
    final deliveryPart = (isDelivered && deliveryTimeOnly.isNotEmpty) ? ' · $deliveryTimeOnly' : '';
    final dateAndSlot = '$dateDisplay$slotPart$deliveryPart';

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSubOrder ? const Color(0xFFBAE6FD) : kBorder,
          width: isSubOrder ? 1.5 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: kText.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── 1. Date and Slot first (no 'Delivery' prefix, bold font weight) ──
          Text(
            dateAndSlot,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w900,
              color: kText,
              letterSpacing: -0.1,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),

          const SizedBox(height: 6),

          // ── 2. Below: Full Order ID and Product Info ───────────
          Text(
            '#${o.id.toUpperCase()}',
            style: const TextStyle(
              fontSize: 11,
              color: kTextSub,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            o.productName,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: kText,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),

          const SizedBox(height: 10),

          // ── 3. Thin line ─────────────────────────────────────────
          Container(
            height: 1,
            color: const Color(0xFFF1F5F9),
          ),

          const SizedBox(height: 10),

          // ── 4. First show status with color (no badge), next end total amount ──
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // First: Status with color (no badge container)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    statusIcon,
                    color: statusFgColor,
                    size: 13,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    statusText,
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      color: statusFgColor,
                    ),
                  ),
                ],
              ),

              // Next end: Total amount
              Text(
                '₹${o.amount.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w900,
                  color: kText,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
