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
    Color statusBgColor = kPrimaryPl;
    Color statusFgColor = kPrimary;
    IconData statusIcon = Icons.check_circle;
    String statusText = 'Delivered';

    final normalizedStatus = o.status.toLowerCase();
    if (normalizedStatus == 'delivered') {
      statusBgColor = kPrimaryPl;
      statusFgColor = kPrimary;
      statusIcon = Icons.check_circle;
      statusText = 'Delivered';
    } else if (normalizedStatus == 'cancelled') {
      statusBgColor = kRedLt.withValues(alpha: 0.5);
      statusFgColor = kRed;
      statusIcon = Icons.cancel;
      statusText = 'Cancelled';
    } else if (normalizedStatus == 'placed') {
      statusBgColor = Colors.orange.shade50;
      statusFgColor = Colors.orange.shade700;
      statusIcon = Icons.hourglass_empty;
      statusText = 'Placed';
    } else if (normalizedStatus == 'confirmed') {
      statusBgColor = Colors.blue.shade50;
      statusFgColor = Colors.blue.shade700;
      statusIcon = Icons.local_shipping;
      statusText = 'Confirmed';
    } else if (normalizedStatus == 'skipped') {
      statusBgColor = kRedLt.withValues(alpha: 0.5);
      statusFgColor = kRed;
      statusIcon = Icons.skip_next;
      statusText = 'Skipped';
    } else {
      statusBgColor = Colors.blue.shade50;
      statusFgColor = Colors.blue.shade700;
      statusIcon = Icons.local_shipping;
      statusText = o.status;
    }

    final isSubOrder = o.orderSource == 'subscription';
    final slotText = _formatSlot(o.deliverySlot);
    final dateDisplay = o.date.isNotEmpty ? o.date : 'Scheduled';
    final dateAndSlot = slotText.isNotEmpty ? '$dateDisplay · $slotText' : dateDisplay;

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
          // ── 1. Delivery Date and Slot first ─────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Delivery: $dateAndSlot',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: kText,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isSubOrder ? const Color(0xFFE0F2FE) : const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isSubOrder ? Icons.autorenew_rounded : Icons.shopping_bag_outlined,
                      size: 9,
                      color: isSubOrder ? const Color(0xFF0369A1) : const Color(0xFF2E7D32),
                    ),
                    const SizedBox(width: 3),
                    Text(
                      isSubOrder ? 'Subscription' : 'One-Time',
                      style: TextStyle(
                        fontSize: 8.5,
                        fontWeight: FontWeight.w800,
                        color: isSubOrder ? const Color(0xFF0369A1) : const Color(0xFF2E7D32),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 6),

          // ── 2. Below: Order ID and Product Info ─────────────────
          Row(
            children: [
              Text(
                '#${o.id.toUpperCase().substring(0, o.id.length > 8 ? 8 : o.id.length)}',
                style: const TextStyle(
                  fontSize: 10.5,
                  color: kTextSub,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (o.vendorName.isNotEmpty && o.vendorName != 'F2H Partner') ...[
                const SizedBox(width: 6),
                Text(
                  '· ${o.vendorName}',
                  style: const TextStyle(fontSize: 10.5, color: kTextSub),
                ),
              ],
            ],
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

          // ── 4. First show status, next end show total amount ─────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // First: Status
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusBgColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      statusIcon,
                      color: statusFgColor,
                      size: 12,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      statusText,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        color: statusFgColor,
                      ),
                    ),
                  ],
                ),
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
