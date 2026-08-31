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
import '../../../catalog/presentation/helpers/cart_navigation_helper.dart';
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

    // Status visuals
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
            ? kAccentLt.withValues(alpha: 0.4)
            : isExpired
                ? kRed.withValues(alpha: 0.08)
                : isCompleted
                    ? Colors.grey.withValues(alpha: 0.12)
                    : kRed.withValues(alpha: 0.08);
    final IconData statusIcon = isActive
        ? Icons.check_circle_outline_rounded
        : isPaused
            ? Icons.pause_circle_outline_rounded
            : isExpired
                ? Icons.error_outline_rounded
                : isCompleted
                    ? Icons.done_all_rounded
                    : Icons.cancel_outlined;
    final String statusLabel = isActive
        ? 'ACTIVE'
        : isPaused
            ? 'PAUSED'
            : isExpired
                ? 'EXPIRED'
                : isCompleted
                    ? 'COMPLETED'
                    : 'CANCELLED';

    // Payment Type visuals
    final isPostpaid = s.paymentType.toLowerCase() == 'postpaid';
    final Color paymentTypeColor = isPostpaid ? const Color(0xFF7E22CE) : const Color(0xFF047857);
    final Color paymentTypeBg = isPostpaid ? const Color(0xFFF3E8FF) : const Color(0xFFECFDF5);
    final Color paymentTypeBorder = isPostpaid ? const Color(0xFFD8B4FE) : const Color(0xFFA7F3D0);
    final IconData paymentTypeIcon = isPostpaid ? Icons.credit_card_rounded : Icons.account_balance_wallet_outlined;
    final String paymentTypeLabel = isPostpaid ? 'POSTPAID' : 'PREPAID';

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
        opacity: isTerminal ? 0.65 : 1.0,
        child: Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: isActive
                  ? kPrimary.withValues(alpha: 0.12)
                  : isTerminal
                      ? (isCancelled ? kRed.withValues(alpha: 0.15) : const Color(0xFFE2E8F0))
                      : const Color(0xFFE2E8F0),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: isActive
                    ? kPrimary.withValues(alpha: 0.06)
                    : Colors.black.withValues(alpha: 0.03),
                blurRadius: 16,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Product image
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: isActive ? kPrimaryPl : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: isActive
                            ? kPrimary.withValues(alpha: 0.08)
                            : const Color(0xFFE2E8F0),
                        width: 1.5,
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: buildProductImage(
                        s.productName,
                        imageAsset: s.imageUrl,
                        fit: BoxFit.cover,
                        fallbackColor: isActive ? kPrimary : kTextSub,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Details
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                _prettifyName(s.productName),
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w900,
                                  color: isActive ? kText : kTextSub,
                                  letterSpacing: -0.2,
                                  decoration: isCancelled ? TextDecoration.lineThrough : null,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 6),
                            // Payment Type Badge (Prepaid / Postpaid)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
                              decoration: BoxDecoration(
                                color: paymentTypeBg,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: paymentTypeBorder,
                                  width: 1,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(paymentTypeIcon, size: 10, color: paymentTypeColor),
                                  const SizedBox(width: 3.5),
                                  Text(
                                    paymentTypeLabel,
                                    style: TextStyle(
                                      fontSize: 8.5,
                                      fontWeight: FontWeight.w900,
                                      color: paymentTypeColor,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 5),
                            // Dynamic status badge
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: statusBg,
                                borderRadius: BorderRadius.circular(30),
                                border: Border.all(
                                  color: statusColor.withValues(alpha: 0.2),
                                  width: 1,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(statusIcon, size: 11, color: statusColor),
                                  const SizedBox(width: 4),
                                  Text(
                                    statusLabel,
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w900,
                                      color: statusColor,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),

                        // Pause date info
                        if (s.pauseFromDate != null && s.pauseToDate != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                            margin: const EdgeInsets.only(bottom: 5),
                            decoration: BoxDecoration(
                              color: kAccentLt.withValues(alpha: 0.5),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.pause_circle_outline_rounded, size: 11, color: kAccent),
                                const SizedBox(width: 5),
                                Text(
                                  s.pauseFromDate == s.pauseToDate
                                      ? 'Paused: ${s.pauseFromDate}'
                                      : 'Paused: ${s.pauseFromDate} → ${s.pauseToDate}',
                                  style: const TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w800,
                                    color: kAccent,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        const SizedBox(height: 6),

                        // Price row
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Text(
                                  '₹${(s.totalDailyCost > 0 ? s.totalDailyCost : (s.pricePerDay > 0 ? s.pricePerDay * (s.qty > 0 ? s.qty : 1) : (s.items.isNotEmpty ? (s.items.first.finalPrice > 0 ? s.items.first.finalPrice : s.items.first.unitPrice) : 0))).toStringAsFixed(0)}',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w900,
                                    color: isActive ? kPrimary : kTextSub,
                                  ),
                                ),
                                Text(
                                  ' / day',
                                  style: TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w600,
                                    color: kTextSub.withValues(alpha: isActive ? 1 : 0.7),
                                  ),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: isActive
                                    ? kPrimary.withValues(alpha: 0.06)
                                    : const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: isActive
                                      ? kPrimary.withValues(alpha: 0.1)
                                      : const Color(0xFFE2E8F0),
                                ),
                              ),
                              child: Text(
                                'Qty: ${s.qty}',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  color: isActive ? kPrimary : kTextSub,
                                ),
                              ),
                            ),
                          ],
                        ),
                        _buildSubCardDaysWidget(s),
                      ],
                    ),
                  ),
                ],
              ),

              // Tap to view details hint
              const SizedBox(height: 10),
              Container(height: 1, color: const Color(0xFFF1F5F9)),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 11,
                    color: kTextSub.withValues(alpha: 0.6),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    isTerminal
                        ? 'Tap to view details'
                        : 'Tap to manage subscription',
                    style: TextStyle(
                      fontSize: 10,
                      color: kTextSub.withValues(alpha: 0.6),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  const Icon(Icons.chevron_right_rounded, size: 14, color: kMuted),
                ],
              ),
              if (isCompleted) ...[
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  height: 38,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      final firstItem = s.items.isNotEmpty ? s.items.first : null;
                      final variantId = firstItem?.productVariantId ?? s.id;
                      final productName = firstItem?.productName ?? s.productName;
                      final variantName = (firstItem?.variantName.isNotEmpty ?? false) ? firstItem!.variantName : 'Standard';
                      final price = (firstItem != null && firstItem.finalPrice > 0) ? firstItem.finalPrice : (firstItem?.unitPrice ?? s.pricePerDay);

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
                      F2HToast.success(context, 'Subscription added to cart for renewal!');
                      CartNavHelper.openCart(context);
                    },
                    icon: const Icon(Icons.replay_rounded, size: 15, color: Colors.white),
                    label: const Text(
                      'RENEW SUBSCRIPTION',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPrimary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ] else if (isExpired) ...[
                // No button for expired — user can tap to view details
              ],

            ],
          ),
        ),
      ),
    );
  }

}

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

Widget _buildSubCardDaysWidget(Subscription s) {
  final dayQtys = s.getSelectedDayQuantities();
  if (dayQtys.isEmpty) return const SizedBox.shrink();

  const morningColor = Color(0xFF14532D); // Dark green
  const eveningColor = Color(0xFF16A34A); // Light green

  final isSevenDays = dayQtys.length == 7;
  final first = dayQtys.first;
  final isAllSameSlots = isSevenDays &&
      dayQtys.every((dq) =>
          dq.morningQty == first.morningQty && dq.eveningQty == first.eveningQty);

  return Container(
    margin: const EdgeInsets.only(top: 8),
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: const Color(0xFFE2E8F0)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(
              Icons.calendar_today_rounded,
              size: 11,
              color: kPrimary,
            ),
            SizedBox(width: 5),
            Text(
              'Selected Days & Quantity:',
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
                color: kTextSub,
              ),
            ),
          ],
        ),
        const SizedBox(height: 5),
        if (isAllSameSlots)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Daily  ',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: kText,
                  ),
                ),
                if (first.morningQty > 0) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'M: ${first.morningQty}',
                      style: const TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: morningColor,
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                ],
                if (first.eveningQty > 0) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: eveningColor.withOpacity(0.3)),
                    ),
                    child: Text(
                      'E: ${first.eveningQty}',
                      style: const TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: eveningColor,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          )
        else
          Wrap(
            spacing: 5,
            runSpacing: 5,
            children: dayQtys.map((dq) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${dq.dayName} ',
                      style: const TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                        color: kTextSub,
                      ),
                    ),
                    if (dq.morningQty > 0) ...[
                      Text(
                        'M:${dq.morningQty} ',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: morningColor,
                        ),
                      ),
                    ],
                    if (dq.eveningQty > 0) ...[
                      Text(
                        'E:${dq.eveningQty}',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: eveningColor,
                        ),
                      ),
                    ],
                    if (dq.morningQty == 0 && dq.eveningQty == 0)
                      Text(
                        '${dq.quantity}',
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w900,
                          color: kPrimary,
                        ),
                      ),
                  ],
                ),
              );
            }).toList(),
          ),
      ],
    ),
  );
}
