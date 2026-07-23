import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/features/subscription/data/models/subscription_model.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_event.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/cart_screen.dart';
import 'package:f2h_customer/features/wallet/presentation/screens/wallet_screen.dart';
import 'package:f2h_customer/features/subscription/presentation/screens/subscription_detail_screen.dart';

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
                            const SizedBox(width: 8),
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
                                  'Paused: ${s.pauseFromDate} → ${s.pauseToDate}',
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

                        // Frequency
                        Row(
                          children: [
                            Icon(Icons.loop_rounded, size: 12, color: isActive ? kPrimary : kTextSub),
                            const SizedBox(width: 4),
                            Text(
                              s.frequency,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: isActive ? kTextMid : kTextSub,
                              ),
                            ),
                          ],
                        ),

                        if (s.items.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          ...s.items.map((item) {
                            final List<String> parts = [];
                            if (item.defaultMQty > 0) parts.add('${item.defaultMQty} AM');
                            if (item.defaultEQty > 0) parts.add('${item.defaultEQty} PM');
                            final qtyLabel = parts.join(' + ');
                            return Padding(
                              padding: const EdgeInsets.only(top: 3),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.subdirectory_arrow_right_rounded,
                                    size: 11,
                                    color: isActive
                                        ? kPrimary.withValues(alpha: 0.5)
                                        : kTextSub.withValues(alpha: 0.5),
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      item.displayName,
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w600,
                                        color: isActive ? kTextMid : kTextSub,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (qtyLabel.isNotEmpty) ...[
                                    const SizedBox(width: 6),
                                    Text(
                                      qtyLabel,
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w800,
                                        color: isActive ? kPrimary : kTextSub,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            );
                          }),
                        ],
                        const SizedBox(height: 8),

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
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const CartScreen(),
                        ),
                      );
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
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  height: 38,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const WalletScreen(),
                        ),
                      );
                    },
                    icon: const Icon(Icons.account_balance_wallet_rounded, size: 15, color: Colors.white),
                    label: const Text(
                      'PAY OUTSTANDING BILLS',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kRed,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ] else if (isActive && s.paymentType == 'prepaid' && s.autoRenew && s.pricePerDay > 0) ...[
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  height: 36,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const WalletScreen(),
                        ),
                      );
                    },
                    icon: const Icon(Icons.account_balance_wallet_outlined, size: 14, color: kPrimary),
                    label: const Text(
                      'TOP-UP WALLET',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: kPrimary),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: EdgeInsets.zero,
                      side: const BorderSide(color: kPrimary, width: 1),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
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
