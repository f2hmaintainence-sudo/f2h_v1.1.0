// ══════════════════════════════════════════════════════════
//  MONTHLY ESTIMATION CARD
//
//  Displays a styled estimation summary card for subscriptions.
//
//  Two variants are created via named constructors:
//    MonthlyEstimationCard.currentMonth(...)  — from start date to end of month
//    MonthlyEstimationCard.fullMonth(...)     — for a complete 30-day period
//
//  RULE: All prices use variant.subscription_price, NEVER selling price.
// ══════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class MonthlyEstimationCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData headerIcon;
  final Color headerColor;

  // ── Estimation values ─────────────────────────────────
  final int estimatedDays;
  final int estimatedQty;
  final int morningQty;
  final int eveningQty;
  final double normalPrice;         // variant.price (for savings calc)
  final double subscriptionPrice;   // variant.subscription_price
  final double estimatedTotal;      // subscriptionPrice × total qty
  final double savings;             // normalPrice total − subscriptionPrice total
  final double savingsPercent;

  const MonthlyEstimationCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.headerIcon,
    required this.headerColor,
    required this.estimatedDays,
    required this.estimatedQty,
    required this.morningQty,
    required this.eveningQty,
    required this.normalPrice,
    required this.subscriptionPrice,
    required this.estimatedTotal,
    required this.savings,
    required this.savingsPercent,
  });

  @override
  Widget build(BuildContext context) {
    final hasSavings = savings > 0;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: headerColor.withOpacity(0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ─────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: headerColor.withOpacity(0.08),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: [
                Icon(headerIcon, size: 16, color: headerColor),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          color: headerColor,
                        ),
                      ),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 10,
                          color: headerColor.withOpacity(0.7),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                if (hasSavings)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1B4332),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'Save ${savingsPercent.toStringAsFixed(0)}%',
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // ── Body rows ──────────────────────────────────
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                _Row(
                  label: 'Delivery Days',
                  value: '$estimatedDays days',
                  icon: Icons.calendar_today_rounded,
                ),
                const SizedBox(height: 8),
                _Row(
                  label: 'Est. Quantity',
                  value: '$estimatedQty units',
                  sub: morningQty > 0 && eveningQty > 0
                      ? '(Morning: $morningQty · Evening: $eveningQty per day)'
                      : morningQty > 0
                          ? '(Morning: $morningQty per day)'
                          : '(Evening: $eveningQty per day)',
                  icon: Icons.local_shipping_outlined,
                ),
                const SizedBox(height: 8),
                _Row(
                  label: 'Normal Price',
                  value: '₹${normalPrice.toStringAsFixed(0)}/unit',
                  icon: Icons.price_change_outlined,
                  valueColor: kTextSub,
                  strikethrough: true,
                ),
                const SizedBox(height: 8),
                _Row(
                  label: 'Subscription Price',
                  value: '₹${subscriptionPrice.toStringAsFixed(0)}/unit',
                  icon: Icons.autorenew_rounded,
                  valueColor: const Color(0xFF1B4332),
                  bold: true,
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 10),
                  child: Divider(color: Color(0xFFE5E7EB), height: 1),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Estimated Total',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        color: kText,
                      ),
                    ),
                    Text(
                      '₹${estimatedTotal.toStringAsFixed(0)}',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: headerColor,
                      ),
                    ),
                  ],
                ),
                if (hasSavings) ...[
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.savings_outlined,
                          size: 14,
                          color: Color(0xFF1B4332),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'You save ₹${savings.toStringAsFixed(0)} (${savingsPercent.toStringAsFixed(0)}%) vs buying one-time',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1B4332),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Internal row widget ───────────────────────────────────

class _Row extends StatelessWidget {
  final String label;
  final String value;
  final String? sub;
  final IconData icon;
  final Color? valueColor;
  final bool strikethrough;
  final bool bold;

  const _Row({
    required this.label,
    required this.value,
    required this.icon,
    this.sub,
    this.valueColor,
    this.strikethrough = false,
    this.bold = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 13, color: kTextSub),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 11,
                  color: kTextSub,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Text(
              value,
              style: TextStyle(
                fontSize: 12,
                fontWeight: bold ? FontWeight.w900 : FontWeight.w700,
                color: valueColor ?? kText,
                decoration: strikethrough ? TextDecoration.lineThrough : null,
              ),
            ),
          ],
        ),
        if (sub != null) ...[
          Padding(
            padding: const EdgeInsets.only(left: 19),
            child: Text(
              sub!,
              style: const TextStyle(
                fontSize: 9.5,
                color: kTextSub,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
