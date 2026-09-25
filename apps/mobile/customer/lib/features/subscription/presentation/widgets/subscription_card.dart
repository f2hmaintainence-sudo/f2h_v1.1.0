import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import '../../data/models/subscription_model.dart';
import '../../../catalog/data/models/product_model.dart';
import '../screens/subscription_detail_screen.dart';

class SubCard extends StatelessWidget {
  final Subscription s;
  final VoidCallback? onPauseResume;
  final VoidCallback? onModify;
  final VoidCallback? onSkip;
  final VoidCallback? onDelete;

  const SubCard(
    this.s, {
    super.key,
    this.onPauseResume,
    this.onModify,
    this.onSkip,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final isActive = s.isActive;
    final isPaused = s.isPaused;
    final isCancelled = s.status == 'cancelled';
    final isExpired = s.status == 'expaired' || s.status == 'expired';
    final isCompleted = s.status == 'completed';
    final isTerminal = isCancelled || isExpired || isCompleted;

    // ── Status visuals ──────────────────────────────────────────────
    final Color statusColor = isActive
        ? kPrimary
        : isPaused
            ? kAccent
            : isExpired
                ? kRed
                : isCompleted
                    ? Colors.grey
                    : kRed;

    final Color statusBg = isActive
        ? kPrimaryPl
        : isPaused
            ? kAccentLt.withValues(alpha: 0.45)
            : isExpired
                ? kRed.withValues(alpha: 0.09)
                : isCompleted
                    ? Colors.grey.withValues(alpha: 0.12)
                    : kRed.withValues(alpha: 0.09);

    final IconData statusIcon = isActive
        ? Icons.check_circle_rounded
        : isPaused
            ? Icons.pause_circle_rounded
            : isExpired
                ? Icons.error_rounded
                : isCompleted
                    ? Icons.done_all_rounded
                    : Icons.cancel_rounded;

    final String statusLabel = isActive
        ? 'ACTIVE'
        : isPaused
            ? 'PAUSED'
            : isExpired
                ? 'EXPIRED'
                : isCompleted
                    ? 'COMPLETED'
                    : 'CANCELLED';

    // ── Payment type visuals ────────────────────────────────────────
    final isPostpaid = s.paymentType.toLowerCase() == 'postpaid';

    // ── Card background ─────────────────────────────────────────────
    final cardBg = isTerminal ? const Color(0xFFF8FAFC) : Colors.white;

    final cardBorderColor = isTerminal && isCancelled
        ? kRed.withValues(alpha: 0.14)
        : const Color(0xFFE2E8F0);

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => SubscriptionDetailScreen(
              subscription: s,
              onPauseResume: onPauseResume ?? () {},
              onModify: onModify ?? () {},
              onSkip: onSkip ?? () {},
              onDelete: onDelete ?? () {},
            ),
          ),
        );
      },
      child: Opacity(
        opacity: isTerminal ? 0.72 : 1.0,
        child: Container(
          margin: const EdgeInsets.only(bottom: 14),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: cardBorderColor, width: 1.2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top row: image + details
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Product image
                      _ProductImage(
                        subscription: s,
                        isActive: isActive,
                        statusColor: statusColor,
                        isTerminal: isTerminal,
                      ),
                              const SizedBox(width: 12),

                              // Right side details
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Name row + badges
                                    Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.center,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            _prettifyName(s.productName),
                                            style: TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w800,
                                              color: isActive
                                                  ? kText
                                                  : kTextSub,
                                              letterSpacing: -0.3,
                                              decoration: isCancelled
                                                  ? TextDecoration.lineThrough
                                                  : null,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        // Status badge
                                        _DotBadge(
                                          label: statusLabel,
                                          color: statusColor,
                                          bg: statusBg,
                                          icon: statusIcon,
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 5),

                                    // Pause date chip (if applicable)
                                    if (s.pauseFromDate != null &&
                                        s.pauseToDate != null) ...[
                                      Container(
                                        margin:
                                            const EdgeInsets.only(bottom: 5),
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color:
                                              kAccentLt.withValues(alpha: 0.6),
                                          borderRadius:
                                              BorderRadius.circular(8),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            const Icon(
                                              Icons.pause_circle_rounded,
                                              size: 11,
                                              color: kAccent,
                                            ),
                                            const SizedBox(width: 5),
                                            Text(
                                              s.pauseFromDate == s.pauseToDate
                                                  ? 'Paused: ${s.pauseFromDate}'
                                                  : 'Paused: ${s.pauseFromDate} → ${s.pauseToDate}',
                                              style: const TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w700,
                                                color: kAccent,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],

                                    // Price + Qty row
                                    Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.center,
                                      children: [
                                        // Price pill
                                        _PricePill(
                                          subscription: s,
                                          isActive: isActive,
                                        ),
                                        const Spacer(),
                                        // Qty badge
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: isActive
                                                ? kPrimary.withValues(
                                                    alpha: 0.07)
                                                : const Color(0xFFF1F5F9),
                                            borderRadius:
                                                BorderRadius.circular(10),
                                            border: Border.all(
                                              color: isActive
                                                  ? kPrimary.withValues(
                                                      alpha: 0.12)
                                                  : const Color(0xFFE2E8F0),
                                            ),
                                          ),
                                          child: Text(
                                            'Qty: ${s.qty}',
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w800,
                                              color: isActive
                                                  ? kPrimary
                                                  : kTextSub,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),

                  // ── Divider ──────────────────────────────────
                  Container(
                    height: 1,
                    decoration: BoxDecoration(
                      color: isPostpaid
                          ? const Color(0xFF86EFAC).withValues(alpha: 0.4)
                          : const Color(0xFFE2E8F0),
                    ),
                  ),

                  // ── Manage line / Footer ─────────────────────
                  Container(
                    width: double.infinity,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(
                      color: isPostpaid ? null : Colors.transparent,
                      gradient: isPostpaid
                          ? const LinearGradient(
                              begin: Alignment.centerLeft,
                              end: Alignment.centerRight,
                              colors: [
                                Colors.white,
                                Color(0xFFDCFCE7),
                                Color(0xFF16A34A),
                              ],
                              stops: [0.0, 0.42, 1.0],
                            )
                          : null,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          isTerminal
                              ? 'Tap to view details'
                              : 'Tap to manage subscription',
                          style: TextStyle(
                            fontSize: 10.5,
                            color: isPostpaid
                                ? const Color(0xFF334155)
                                : kTextSub.withValues(alpha: 0.65),
                            fontWeight:
                                isPostpaid ? FontWeight.w600 : FontWeight.w500,
                          ),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              isTerminal ? 'View Details' : 'Manage',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: isPostpaid ? Colors.white : kPrimary,
                                letterSpacing: isPostpaid ? 0.2 : 0.0,
                              ),
                            ),
                            const SizedBox(width: 2),
                            Icon(
                              Icons.arrow_forward_ios_rounded,
                              size: 10,
                              color: isPostpaid ? Colors.white : kPrimary,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-widgets
// ─────────────────────────────────────────────────────────────────────────────

class _ProductImage extends StatelessWidget {
  final Subscription subscription;
  final bool isActive;
  final Color statusColor;
  final bool isTerminal;

  const _ProductImage({
    required this.subscription,
    required this.isActive,
    required this.statusColor,
    required this.isTerminal,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 68,
      height: 68,
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFFE2E8F0),
          width: 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(11),
        child: buildProductImage(
          subscription.productName,
          imageAsset: subscription.imageUrl,
          fit: BoxFit.cover,
          fallbackColor: isActive ? kPrimary : kTextSub,
        ),
      ),
    );
  }
}

class _DotBadge extends StatelessWidget {
  final String label;
  final Color color;
  final Color bg;
  final IconData? icon;

  const _DotBadge({
    required this.label,
    required this.color,
    required this.bg,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 9, color: color),
            const SizedBox(width: 3),
          ] else ...[
            Container(
              width: 5,
              height: 5,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 8.5,
              fontWeight: FontWeight.w800,
              color: color,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }
}

class _PricePill extends StatelessWidget {
  final Subscription subscription;
  final bool isActive;

  const _PricePill({required this.subscription, required this.isActive});

  double get _dailyCost {
    final s = subscription;
    if (s.totalDailyCost > 0) return s.totalDailyCost;
    if (s.pricePerDay > 0) return s.pricePerDay * (s.qty > 0 ? s.qty : 1);
    if (s.items.isNotEmpty) {
      final item = s.items.first;
      return item.finalPrice > 0 ? item.finalPrice : item.unitPrice;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(
          '₹${_dailyCost.toStringAsFixed(0)}',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w900,
            color: isActive ? kText : kTextSub,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(width: 2),
        Text(
          '/ day',
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: kTextSub,
          ),
        ),
      ],
    );
  }
}



// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

String _prettifyName(String name) {
  return name
      .replaceAll('_', ' ')
      .split(' ')
      .map((word) {
        if (word.isEmpty) return '';
        return word[0].toUpperCase() + word.substring(1);
      })
      .join(' ');
}
