// ═══════════════════════════════════════════════════════════════════════════
//  CART WIDGETS — Reusable UI components for Cart and Checkout screens
//
//  Extracts repeated patterns (toggles, summary rows, counters, cards)
//  into composable widgets to reduce code duplication and improve consistency.
// ═══════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';

// ===== Info Tooltip Card =====

/// A small informational card that explains a concept to the user.
///
/// Used to clarify terms like "One-Time Order", "Subscription", "Wallet",
/// "Prepaid", "Postpaid", "Daily Schedule", "Custom Schedule", etc.
///
/// Displays an icon, a title, and a description in a styled container.
class InfoTooltipCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final Color? accentColor;

  const InfoTooltipCard({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    final color = accentColor ?? kPrimary;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.12)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 14, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 10,
                    color: kTextSub,
                    fontWeight: FontWeight.w500,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Factory constructors for common tooltip types ──

  /// Explains what a one-time order is.
  factory InfoTooltipCard.oneTimeOrder() {
    return const InfoTooltipCard(
      icon: Icons.shopping_basket_rounded,
      title: 'One-Time Order',
      description:
          'A single delivery on your chosen date and time slot. '
          'Great for trying products or occasional purchases.',
      accentColor: kPrimary,
    );
  }

  /// Explains what a subscription is.
  factory InfoTooltipCard.subscription() {
    return const InfoTooltipCard(
      icon: Icons.repeat_rounded,
      title: 'Subscription',
      description:
          'Get automatic recurring deliveries on your selected days. '
          'Enjoy special subscription pricing, lower than one-time prices.',
      accentColor: kAccent,
    );
  }

  /// Explains the daily schedule mode.
  factory InfoTooltipCard.dailySchedule() {
    return const InfoTooltipCard(
      icon: Icons.calendar_view_week_rounded,
      title: 'Daily Schedule',
      description:
          'Delivers every day (Mon–Sun) in the Morning slot. '
          'Just set your quantity — we handle the rest.',
      accentColor: kPrimary,
    );
  }

  /// Explains the custom schedule mode.
  factory InfoTooltipCard.customSchedule() {
    return const InfoTooltipCard(
      icon: Icons.edit_calendar_rounded,
      title: 'Custom Schedule',
      description:
          'Choose specific days and slots (Morning/Evening) '
          'with different quantities for each.',
      accentColor: kPrimary,
    );
  }

  /// Explains the wallet payment method.
  factory InfoTooltipCard.wallet() {
    return const InfoTooltipCard(
      icon: Icons.account_balance_wallet_outlined,
      title: 'F2H Wallet',
      description:
          'Pay instantly from your pre-loaded F2H Wallet balance. '
          'Top up anytime via UPI or bank transfer.',
      accentColor: kPrimary,
    );
  }

  /// Explains the prepaid payment type.
  factory InfoTooltipCard.prepaid() {
    return const InfoTooltipCard(
      icon: Icons.payment_rounded,
      title: 'Prepaid',
      description:
          'Full amount is deducted from your wallet upfront when the '
          'subscription is created. Ensures uninterrupted delivery.',
      accentColor: kPrimary,
    );
  }

  /// Explains the postpaid payment type.
  factory InfoTooltipCard.postpaid() {
    return const InfoTooltipCard(
      icon: Icons.schedule_outlined,
      title: 'Postpaid',
      description:
          'Pay at the end of the billing cycle. Available only for '
          'approved accounts with a postpaid credit limit.',
      accentColor: kAccent,
    );
  }

  /// Explains subscription pricing.
  factory InfoTooltipCard.subscriptionPrice() {
    return const InfoTooltipCard(
      icon: Icons.local_offer_rounded,
      title: 'Subscription Price',
      description:
          'Subscription orders use a special discounted price, '
          'different from the one-time selling price. '
          'The more you subscribe, the more you save!',
      accentColor: kAccent,
    );
  }
}

// ===== Pill Toggle =====

/// A two-option pill-shaped toggle widget.
///
/// Used for Buy One-Time / Subscribe, Prepaid / Postpaid, Daily / Custom toggles.
/// Highlights the selected option with [activeColor] and shows the unselected
/// option in a muted style.
class PillToggle extends StatelessWidget {
  final String leftLabel;
  final String rightLabel;
  final IconData leftIcon;
  final IconData rightIcon;
  final bool isLeftSelected;
  final VoidCallback onLeftTap;
  final VoidCallback? onRightTap;
  final Color activeColor;

  /// If true, the right option appears disabled (50% opacity, non-tappable).
  final bool rightDisabled;

  const PillToggle({
    super.key,
    required this.leftLabel,
    required this.rightLabel,
    required this.leftIcon,
    required this.rightIcon,
    required this.isLeftSelected,
    required this.onLeftTap,
    this.onRightTap,
    this.activeColor = kPrimary,
    this.rightDisabled = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: kBgDeep,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: [
          // Left option
          Expanded(
            child: GestureDetector(
              onTap: onLeftTap,
              child: _buildOption(
                label: leftLabel,
                icon: leftIcon,
                isSelected: isLeftSelected,
                color: activeColor,
              ),
            ),
          ),
          // Right option
          Expanded(
            child: GestureDetector(
              onTap: rightDisabled ? null : onRightTap,
              child: Opacity(
                opacity: rightDisabled ? 0.5 : 1.0,
                child: _buildOption(
                  label: rightLabel,
                  icon: rightIcon,
                  isSelected: !isLeftSelected,
                  color: activeColor,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOption({
    required String label,
    required IconData icon,
    required bool isSelected,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: isSelected ? color : Colors.transparent,
        borderRadius: BorderRadius.circular(30),
        boxShadow: isSelected
            ? [
                BoxShadow(
                  color: color.withValues(alpha: 0.2),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ]
            : [],
      ),
      alignment: Alignment.center,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            color: isSelected ? Colors.white : kTextSub,
            size: 14,
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w900,
              color: isSelected ? Colors.white : kTextSub,
            ),
          ),
        ],
      ),
    );
  }
}

// ===== Summary Row =====

/// A row in a bill summary showing a label and value.
///
/// Used in both Cart bill summary and Checkout bill details.
/// Supports bold styling for totals and custom value colors.
class SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isBold;
  final double fontSize;
  final Color? valueColor;

  const SummaryRow({
    super.key,
    required this.label,
    required this.value,
    this.isBold = false,
    this.fontSize = 12,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: fontSize,
            color: isBold ? kText : kTextSub,
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: fontSize,
            color: valueColor ?? (isBold ? kPrimary : kText),
            fontWeight: isBold ? FontWeight.w900 : FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

// ===== Quantity Counter =====

/// A compact +/- quantity counter widget.
///
/// Shows a decrement button, current quantity, and increment button
/// in a horizontal row. Calls [onDecrement] and [onIncrement] callbacks.
///
/// When [isLoading] is true, shows a spinner instead of the counter.
class QuantityCounter extends StatelessWidget {
  final int quantity;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;
  final bool isLoading;

  /// Optional fixed width for the counter container.
  final double? width;

  const QuantityCounter({
    super.key,
    required this.quantity,
    required this.onDecrement,
    required this.onIncrement,
    this.isLoading = false,
    this.width,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Container(
        width: width ?? 68,
        height: 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: kBorderLt),
        ),
        child: const SizedBox(
          width: 14,
          height: 14,
          child: CircularProgressIndicator(
            strokeWidth: 1.5,
            valueColor: AlwaysStoppedAnimation<Color>(kPrimary),
          ),
        ),
      );
    }

    return Container(
      height: 28,
      width: width,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: kBorderLt),
      ),
      child: Row(
        mainAxisSize: width == null ? MainAxisSize.min : MainAxisSize.max,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          GestureDetector(
            onTap: onDecrement,
            behavior: HitTestBehavior.opaque,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Icon(Icons.remove, color: kTextMid, size: 14),
            ),
          ),
          Text(
            '$quantity',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: kText,
            ),
          ),
          GestureDetector(
            onTap: onIncrement,
            behavior: HitTestBehavior.opaque,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Icon(Icons.add, color: kPrimary, size: 14),
            ),
          ),
        ],
      ),
    );
  }
}

// ===== Section Card =====

/// A styled container card used as a section wrapper throughout Cart/Checkout.
///
/// Provides consistent padding, rounded corners, border, and background color
/// for each section (Items, Bill Summary, Payment, etc.).
class SectionCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final double borderRadius;

  const SectionCard({
    super.key,
    required this.child,
    this.padding,
    this.borderRadius = 20,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: kBorder),
      ),
      child: child,
    );
  }
}

// ===== Monthly Savings Card =====

/// Displays a savings estimation card comparing normal price vs subscription price.
///
/// Shows:
///   - Total delivery days and estimated quantity
///   - Normal price total
///   - Subscription price total
///   - Savings amount and percentage
///
/// Used in both Cart subscription summary and Checkout bill details.
class MonthlySavingsCard extends StatelessWidget {
  final double normalPriceTotal;
  final double subscriptionTotal;
  final double savings;
  final double savingsPercent;
  final int totalDeliveryDays;
  final int totalEstimatedQuantity;

  const MonthlySavingsCard({
    super.key,
    required this.normalPriceTotal,
    required this.subscriptionTotal,
    required this.savings,
    required this.savingsPercent,
    required this.totalDeliveryDays,
    required this.totalEstimatedQuantity,
  });

  @override
  Widget build(BuildContext context) {
    // Only show savings if there's actually a difference
    final hasSavings = savings > 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: hasSavings
            ? const Color(0xFFF0FFF4) // Light green for savings
            : kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: hasSavings
              ? kPrimary.withValues(alpha: 0.2)
              : kBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(
                hasSavings ? Icons.savings_rounded : Icons.info_outline_rounded,
                size: 18,
                color: hasSavings ? kPrimary : kTextSub,
              ),
              const SizedBox(width: 8),
              Text(
                'Monthly Estimation',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: hasSavings ? kPrimary : kText,
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Delivery stats
          Row(
            children: [
              _buildStatChip(
                Icons.calendar_today_rounded,
                '$totalDeliveryDays days',
                'Deliveries',
              ),
              const SizedBox(width: 10),
              _buildStatChip(
                Icons.inventory_2_rounded,
                '$totalEstimatedQuantity',
                'Total Items',
              ),
            ],
          ),

          const Divider(color: kBorderLt, height: 20),

          // Normal Price row
          _buildPriceRow(
            'Normal Price',
            '₹${normalPriceTotal.toStringAsFixed(0)}',
            isStrikethrough: hasSavings,
          ),
          const SizedBox(height: 8),

          // Subscription Price row
          _buildPriceRow(
            'Subscription Price',
            '₹${subscriptionTotal.toStringAsFixed(0)}',
            color: kPrimary,
            isBold: true,
          ),

          if (hasSavings) ...[
            const Divider(color: kBorderLt, height: 20),

            // Savings row
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.trending_down_rounded, size: 16, color: kPrimary),
                      SizedBox(width: 6),
                      Text(
                        'You Save',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: kPrimary,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    '₹${savings.toStringAsFixed(0)} (${savingsPercent.toStringAsFixed(0)}%)',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: kPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatChip(IconData icon, String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: kBorderLt),
        ),
        child: Row(
          children: [
            Icon(icon, size: 14, color: kTextSub),
            const SizedBox(width: 6),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    color: kText,
                  ),
                ),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 9,
                    color: kTextSub,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPriceRow(
    String label,
    String value, {
    bool isStrikethrough = false,
    Color? color,
    bool isBold = false,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: isStrikethrough ? kTextSub : (color ?? kText),
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            color: isStrikethrough ? kTextSub : (color ?? kText),
            fontWeight: isBold ? FontWeight.w900 : FontWeight.w700,
            decoration: isStrikethrough ? TextDecoration.lineThrough : null,
            decorationColor: kTextSub,
          ),
        ),
      ],
    );
  }
}

// ===== Subscription Price Badge =====

/// A reusable badge that displays the subscription price for a product.
///
/// Two styles:
///   - **compact** (default): Small inline pill "Sub: ₹XX" — for product cards
///   - **full**: Row with icon "Subscribe at ₹XX · Save ₹X" — for detail pages
///
/// Usage:
/// ```dart
/// SubscriptionPriceBadge.compact(subscriptionPrice: 99)
/// SubscriptionPriceBadge.full(subscriptionPrice: 99, normalPrice: 120)
/// ```
class SubscriptionPriceBadge extends StatelessWidget {
  final double subscriptionPrice;
  final double? normalPrice;
  final bool isCompact;

  const SubscriptionPriceBadge({
    super.key,
    required this.subscriptionPrice,
    this.normalPrice,
    this.isCompact = true,
  });

  /// Compact pill badge: "Sub: ₹XX" — for use in product cards.
  factory SubscriptionPriceBadge.compact({
    Key? key,
    required double subscriptionPrice,
  }) {
    return SubscriptionPriceBadge(
      key: key,
      subscriptionPrice: subscriptionPrice,
      isCompact: true,
    );
  }

  /// Full badge with icon and savings: "Subscribe at ₹XX · Save ₹X"
  /// For use in product detail pages.
  factory SubscriptionPriceBadge.full({
    Key? key,
    required double subscriptionPrice,
    double? normalPrice,
  }) {
    return SubscriptionPriceBadge(
      key: key,
      subscriptionPrice: subscriptionPrice,
      normalPrice: normalPrice,
      isCompact: false,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (isCompact) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
        decoration: BoxDecoration(
          color: kPrimaryPl,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          'Sub: ₹${subscriptionPrice.toStringAsFixed(0)}',
          style: const TextStyle(
            fontSize: 8,
            fontWeight: FontWeight.w800,
            color: kPrimary,
          ),
        ),
      );
    }

    // Full style — detail page
    final savings = (normalPrice != null && normalPrice! > subscriptionPrice)
        ? (normalPrice! - subscriptionPrice)
        : null;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F5E9),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFA5D6A7), width: 0.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.repeat_rounded, size: 13, color: Color(0xFF2E7D32)),
          const SizedBox(width: 5),
          Text(
            'Subscribe at ₹${subscriptionPrice.toStringAsFixed(0)}',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF2E7D32),
            ),
          ),
          if (savings != null && savings > 0) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: const Color(0xFF2E7D32),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                'Save ₹${savings.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
