import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';

class ORow extends StatelessWidget {
  final Order o;
  const ORow(this.o, {super.key});

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
      statusText = 'placed';
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
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: kBorderLt, width: 1),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.all(3),
                child: buildProductImage(
                  o.productName,
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      '#${o.id.toUpperCase().substring(0, o.id.length > 8 ? 8 : o.id.length)} ',
                      style: const TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: isSubOrder ? const Color(0xFFE0F2FE) : const Color(0xFFE8F5E9),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isSubOrder ? Icons.autorenew_rounded : Icons.shopping_bag_outlined,
                            size: 8,
                            color: isSubOrder ? const Color(0xFF0369A1) : const Color(0xFF2E7D32),
                          ),
                          const SizedBox(width: 2),
                          Text(
                            isSubOrder ? 'Subscription' : 'One-Time',
                            style: TextStyle(
                              fontSize: 7.5,
                              fontWeight: FontWeight.w800,
                              color: isSubOrder ? const Color(0xFF0369A1) : const Color(0xFF2E7D32),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  o.productName,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: kText,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '${o.vendorName} · ${o.date}',
                  style: const TextStyle(fontSize: 11, color: kTextSub),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (o.amount > 0)
                Text(
                  '₹${o.amount.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: kText,
                  ),
                ),
              const SizedBox(height: 6),
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
                      size: 11,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      statusText,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: statusFgColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
