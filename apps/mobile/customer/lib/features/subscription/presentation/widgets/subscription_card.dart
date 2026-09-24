import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import '../../../../core/widgets/hot_toast.dart';
import '../../data/models/subscription_model.dart';
import '../../../catalog/data/models/product_model.dart';
import '../../../catalog/domain/entities/cart/cart_item_entity.dart';
import '../../../catalog/presentation/bloc/cart/cart_bloc.dart';
import '../../../catalog/presentation/bloc/cart/cart_event.dart';
import '../../../catalog/presentation/screens/cart_screen.dart';
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
    final Color paymentTypeColor =
        isPostpaid ? const Color(0xFF7E22CE) : const Color(0xFF047857);
    final Color paymentTypeBg =
        isPostpaid ? const Color(0xFFF3E8FF) : const Color(0xFFECFDF5);
    final String paymentTypeLabel = isPostpaid ? 'POSTPAID' : 'PREPAID';

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
            borderRadius: BorderRadius.circular(24),
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
            borderRadius: BorderRadius.circular(24),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top row: image + details
                  Row(
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
                                        const SizedBox(width: 5),
                                        // Payment type badge (dot style)
                                        _DotBadge(
                                          label: paymentTypeLabel,
                                          color: paymentTypeColor,
                                          bg: paymentTypeBg,
                                        ),
                                        const SizedBox(width: 4),
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

                                    // Days / Quantity widget
                                    _buildSubCardDaysWidget(s),
                                  ],
                                ),
                              ),
                            ],
                          ),

                          // ── Divider ──────────────────────────────────
                          const SizedBox(height: 10),
                          Container(
                            height: 1,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Colors.transparent,
                                  const Color(0xFFE2E8F0),
                                  Colors.transparent,
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),

                          // ── Footer ────────────────────────────────────
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                isTerminal
                                    ? 'Tap to view details'
                                    : 'Tap to manage subscription',
                                style: TextStyle(
                                  fontSize: 10.5,
                                  color: kTextSub.withValues(alpha: 0.65),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              Row(
                                children: [
                                  Text(
                                    isTerminal
                                        ? 'View Details'
                                        : 'Manage',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: kPrimary,
                                    ),
                                  ),
                                  const SizedBox(width: 2),
                                  const Icon(
                                    Icons.arrow_forward_ios_rounded,
                                    size: 10,
                                    color: kPrimary,
                                  ),
                                ],
                              ),
                            ],
                          ),

                          // ── Renew button (completed only) ─────────────
                          if (isCompleted) ...[
                            const SizedBox(height: 10),
                            _RenewButton(subscription: s),
                          ],
                        ],
                      ),
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
        borderRadius: BorderRadius.circular(20),
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
        borderRadius: BorderRadius.circular(19),
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: isActive ? kPrimary : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(
            '₹${_dailyCost.toStringAsFixed(0)}',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              color: isActive ? Colors.white : kTextSub,
              letterSpacing: -0.3,
            ),
          ),
          Text(
            ' / day',
            style: TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
              color: isActive
                  ? Colors.white.withValues(alpha: 0.7)
                  : kMuted,
            ),
          ),
        ],
      ),
    );
  }
}

class _RenewButton extends StatelessWidget {
  final Subscription subscription;

  const _RenewButton({required this.subscription});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 40,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [kPrimaryMid, kPrimary],
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
          ),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: kPrimary.withValues(alpha: 0.3),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: ElevatedButton.icon(
          onPressed: () {
            final s = subscription;
            final firstItem = s.items.isNotEmpty ? s.items.first : null;
            final variantId = firstItem?.productVariantId ?? s.id;
            final productName = firstItem?.productName ?? s.productName;
            final variantName =
                (firstItem?.variantName.isNotEmpty ?? false)
                    ? firstItem!.variantName
                    : 'Standard';
            final price = (firstItem != null && firstItem.finalPrice > 0)
                ? firstItem.finalPrice
                : (firstItem?.unitPrice ?? s.pricePerDay);

            final cartItem = CartItemEntity(
              productId: variantId,
              variantId: variantId,
              productName: productName,
              variantName: variantName,
              unitPrice: price,
              purchaseType: 'subscription',
              schedules: [
                SubscriptionSchedule(
                  day: 0,
                  mQuantity: s.qty > 0 ? s.qty : 1,
                  eQuantity: 0,
                ),
              ],
              isSubscribable: true,
              isOneTime: true,
              subscriptionPrice: price,
            );
            context.read<CartBloc>().add(AddToCartEvent(cartItem));
            F2HToast.success(
                context, 'Subscription added to cart for renewal!');
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const CartScreen()),
            );
          },
          icon: const Icon(Icons.replay_rounded,
              size: 15, color: Colors.white),
          label: const Text(
            'RENEW SUBSCRIPTION',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.6,
              color: Colors.white,
            ),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.transparent,
            foregroundColor: Colors.white,
            shadowColor: Colors.transparent,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Days / Quantity chip widget
// ─────────────────────────────────────────────────────────────────────────────

Widget _buildSubCardDaysWidget(Subscription s) {
  final dayQtys = s.getSelectedDayQuantities();
  if (dayQtys.isEmpty) return const SizedBox.shrink();

  const morningColor = Color(0xFF14532D);
  const eveningColor = Color(0xFF16A34A);
  const morningBg = Color(0xFFDCFCE7);
  const eveningBg = Color(0xFFF0FDF4);

  final isSevenDays = dayQtys.length == 7;
  final first = dayQtys.first;
  final isAllSameSlots = isSevenDays &&
      dayQtys.every((dq) =>
          dq.morningQty == first.morningQty &&
          dq.eveningQty == first.eveningQty);

  return Container(
    margin: const EdgeInsets.only(top: 8),
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
    decoration: BoxDecoration(
      color: const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: const Color(0xFFE9EFF5)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Row(
          children: [
            Container(
              width: 16,
              height: 16,
              decoration: BoxDecoration(
                color: kPrimaryPl,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Icon(
                Icons.calendar_today_rounded,
                size: 9,
                color: kPrimary,
              ),
            ),
            const SizedBox(width: 6),
            const Text(
              'Selected Days & Quantity:',
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                color: kTextSub,
              ),
            ),
          ],
        ),
        const SizedBox(height: 7),

        if (isAllSameSlots)
          _DayChip(
            label: 'Daily',
            morningQty: first.morningQty,
            eveningQty: first.eveningQty,
            morningColor: morningColor,
            eveningColor: eveningColor,
            morningBg: morningBg,
            eveningBg: eveningBg,
            quantity: first.quantity,
          )
        else
          Wrap(
            spacing: 5,
            runSpacing: 5,
            children: dayQtys
                .map(
                  (dq) => _DayChip(
                    label: dq.dayName,
                    morningQty: dq.morningQty,
                    eveningQty: dq.eveningQty,
                    morningColor: morningColor,
                    eveningColor: eveningColor,
                    morningBg: morningBg,
                    eveningBg: eveningBg,
                    quantity: dq.quantity,
                  ),
                )
                .toList(),
          ),
      ],
    ),
  );
}

class _DayChip extends StatelessWidget {
  final String label;
  final int morningQty;
  final int eveningQty;
  final int quantity;
  final Color morningColor;
  final Color eveningColor;
  final Color morningBg;
  final Color eveningBg;

  const _DayChip({
    required this.label,
    required this.morningQty,
    required this.eveningQty,
    required this.morningColor,
    required this.eveningColor,
    required this.morningBg,
    required this.eveningBg,
    required this.quantity,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: kTextMid,
            ),
          ),
          if (morningQty > 0) ...[
            const SizedBox(width: 4),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: morningBg,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                'M:$morningQty',
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  color: morningColor,
                ),
              ),
            ),
          ],
          if (eveningQty > 0) ...[
            const SizedBox(width: 4),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: eveningBg,
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                    color: eveningColor.withValues(alpha: 0.25)),
              ),
              child: Text(
                'E:$eveningQty',
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  color: eveningColor,
                ),
              ),
            ),
          ],
          if (morningQty == 0 && eveningQty == 0 && quantity > 0) ...[
            const SizedBox(width: 4),
            Text(
              '$quantity',
              style: const TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w900,
                color: kPrimary,
              ),
            ),
          ],
        ],
      ),
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
