// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : product_grid_card.dart
// Description : Vertical product card for the 2-column shop grid — discount
//               and rating strip, artwork, unit, pricing, and a full-width
//               add / quantity / subscribe action.
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:f2h_customer/core/guards/auth_guard.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_event.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_state.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_view_screen.dart';
import 'package:f2h_customer/features/catalog/presentation/widgets/product_tile.dart';
import 'package:f2h_customer/features/subscription/presentation/screens/subscription_setup_screen.dart';
import 'package:f2h_customer/theme/app_colors.dart';

/// Violet used for everything subscription-related on the card.
const Color kSubscribe = Color(0xFF7C3AED);
const Color kSubscribeSoft = Color(0xFFF3EDFF);

const Color _cardBorder = Color(0xFFEDF1EE);
const Color _stockGrey = Color(0xFFE4E9EC);

/// Aspect ratio the shop grid should use with this card. Chosen so the
/// artwork still gets roughly a third of the cell once the fixed rows
/// (badges, name, unit, price, action) have taken their space.
const double kProductGridAspectRatio = 0.52;

class ProductGridCard extends StatelessWidget {
  final Product product;
  const ProductGridCard(this.product, {super.key});

  int get _discountPercent {
    if (product.originalPrice <= product.price || product.originalPrice <= 0) {
      return 0;
    }
    return (((product.originalPrice - product.price) / product.originalPrice) *
            100)
        .round();
  }

  double? get _subPrice {
    final p = product.subscriptionPrice;
    return (p != null && p > 0) ? p : null;
  }

  @override
  Widget build(BuildContext context) {
    final unit = product.formattedUnit.isNotEmpty
        ? product.formattedUnit
        : product.unit;
    final subPrice = _subPrice;
    final showSubscribe = product.isSubscribable && !product.isOutOfStock;

    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        PageRouteBuilder(
          pageBuilder: (_, _, _) => ProductDetailViewScreen(product: product),
          transitionsBuilder: (_, a, _, child) =>
              FadeTransition(opacity: a, child: child),
          transitionDuration: const Duration(milliseconds: 220),
        ),
      ),
      child: Container(
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _cardBorder, width: 1.2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.035),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(9, 9, 9, 9),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _TopStrip(
              discountPercent: _discountPercent,
              isOutOfStock: product.isOutOfStock,
              subscriptionPrice: showSubscribe ? subPrice : null,
              rating: product.rating,
              reviews: product.reviews,
            ),
            const SizedBox(height: 6),
            Expanded(
              child: Center(
                child: Hero(
                  tag: 'product-v-${product.id}',
                  child: buildProductImage(
                    product.name,
                    imageAsset: product.imageAsset,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),
            if (showSubscribe && subPrice != null) ...[
              const SizedBox(height: 5),
              _SubscriptionPillButton(
                product: product,
                subscriptionPrice: subPrice,
              ),
            ],
            const SizedBox(height: 6),
            Text(
              product.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: kText,
                letterSpacing: -0.2,
                height: 1.2,
              ),
            ),
            const SizedBox(height: 3),
            _UnitLine(unit: unit, showSubscribeHint: false),
            const SizedBox(height: 6),
            _PriceRow(
              price: product.price,
              originalPrice: product.originalPrice,
              muted: false,
            ),
            const SizedBox(height: 8),
            _CardAction(product: product),
          ],
        ),
      ),
    );
  }
}

// ── Top strip: discount / stock chip on the left, rating on the right ──

class _TopStrip extends StatelessWidget {
  final int discountPercent;
  final bool isOutOfStock;
  final double? subscriptionPrice;
  final double rating;
  final int reviews;

  const _TopStrip({
    required this.discountPercent,
    required this.isOutOfStock,
    required this.subscriptionPrice,
    required this.rating,
    required this.reviews,
  });

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 20,
    child: Row(
      children: [
        Flexible(
          flex: 5,
          child: _ScaleDown(
            alignment: Alignment.centerLeft,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (isOutOfStock)
                  const _Chip(
                    label: 'OUT OF STOCK',
                    background: Colors.white,
                    foreground: Color(0xFFE11D48),
                    border: Color(0xFFE11D48),
                  )
                else if (discountPercent > 0)
                  _Chip(
                    label: '$discountPercent% OFF',
                    background: kPrimary,
                    foreground: Colors.white,
                  ),
                if (subscriptionPrice != null) ...[
                  const SizedBox(width: 5),
                  _Chip(
                    label: '@${subscriptionPrice!.toStringAsFixed(0)}',
                    background: kSubscribe,
                    foreground: Colors.white,
                  ),
                ],
              ],
            ),
          ),
        ),
        if (reviews > 0)
          Flexible(
            flex: 4,
            child: _ScaleDown(
              alignment: Alignment.centerRight,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.star_rounded,
                    size: 14,
                    color: Color(0xFFF5A524),
                  ),
                  const SizedBox(width: 3),
                  Text(
                    '${rating.toStringAsFixed(1)} ($reviews)',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: kTextMid,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    ),
  );
}

/// Shrinks its child to fit rather than overflowing — cards get narrow on
/// small phones and wide at large text scales.
class _ScaleDown extends StatelessWidget {
  final Widget child;
  final Alignment alignment;
  const _ScaleDown({required this.child, required this.alignment});

  @override
  Widget build(BuildContext context) => Align(
    alignment: alignment,
    child: FittedBox(fit: BoxFit.scaleDown, alignment: alignment, child: child),
  );
}

class _Chip extends StatelessWidget {
  final String label;
  final Color background;
  final Color foreground;
  final Color? border;

  const _Chip({
    required this.label,
    required this.background,
    required this.foreground,
    this.border,
  });

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(6),
      border: border != null ? Border.all(color: border!, width: 1.2) : null,
    ),
    child: Text(
      label,
      style: TextStyle(
        fontSize: 9.5,
        fontWeight: FontWeight.w800,
        color: foreground,
        letterSpacing: 0.2,
      ),
    ),
  );
}

// ── Unit line ──

class _UnitLine extends StatelessWidget {
  final String unit;
  final bool showSubscribeHint;

  const _UnitLine({required this.unit, required this.showSubscribeHint});

  @override
  Widget build(BuildContext context) {
    if (unit.isEmpty && !showSubscribeHint) return const SizedBox(height: 14);
    return Row(
      children: [
        if (unit.isNotEmpty)
          Flexible(
            child: Text(
              unit,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w500,
                color: kTextSub,
              ),
            ),
          ),
        if (unit.isNotEmpty && showSubscribeHint)
          const Text('  •  ', style: TextStyle(fontSize: 11.5, color: kMuted)),
        if (showSubscribeHint)
          const Flexible(
            child: Text(
              'Subscribe & Save',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: kSubscribe,
              ),
            ),
          ),
      ],
    );
  }
}

class _SubscriptionPillButton extends StatelessWidget {
  final Product product;
  final double subscriptionPrice;

  const _SubscriptionPillButton({
    required this.product,
    required this.subscriptionPrice,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _openSubscriptionSetup(context, product),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
          color: kPrimary,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: kPrimary.withValues(alpha: 0.2),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.autorenew_rounded, color: Colors.white, size: 12),
            const SizedBox(width: 4),
            Text(
              'Subscribe @ ₹${subscriptionPrice.toStringAsFixed(0)}',
              style: const TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 2),
            const Icon(Icons.chevron_right_rounded, color: Colors.white, size: 13),
          ],
        ),
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  final double price;
  final double originalPrice;

  /// When a subscription price is shown above, the one-time price steps back.
  final bool muted;

  const _PriceRow({
    required this.price,
    required this.originalPrice,
    required this.muted,
  });

  @override
  Widget build(BuildContext context) => _ScaleDown(
    alignment: Alignment.centerLeft,
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '₹${price.toStringAsFixed(0)}',
          style: TextStyle(
            fontSize: muted ? 12 : 15.5,
            fontWeight: muted ? FontWeight.w600 : FontWeight.w800,
            color: muted ? kTextSub : kText,
          ),
        ),
        if (originalPrice > price) ...[
          const SizedBox(width: 6),
          Padding(
            padding: EdgeInsets.only(bottom: muted ? 0 : 2),
            child: Text(
              '₹${originalPrice.toStringAsFixed(0)}',
              style: TextStyle(
                fontSize: muted ? 11 : 12.5,
                fontWeight: FontWeight.w500,
                color: kMuted,
                decoration: TextDecoration.lineThrough,
                decorationColor: kMuted,
              ),
            ),
          ),
        ],
      ],
    ),
  );
}

void _openSubscriptionSetup(BuildContext context, Product product) {
  HapticFeedback.lightImpact();
  context.runWithAuth(() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SubscriptionSetupScreen(
          product: product,
          initialVariant: product.allVariants.firstOrNull,
        ),
      ),
    );
  });
}

// ── Full-width action: Add / stepper / Subscribe / Out of Stock ──

class _CardAction extends StatelessWidget {
  final Product product;

  const _CardAction({required this.product});

  /// The main action only becomes "Subscribe" for products that cannot be
  /// bought one-off. Anything else keeps "Add" — the purchase sheet behind it
  /// offers the subscription too, and the price row already carries a direct
  /// Subscribe shortcut.
  bool get _subscriptionOnly => product.isSubscribable && !product.isOneTime;

  void _add(BuildContext context) {
    context.runWithAuth(() {
      HapticFeedback.lightImpact();
      showPurchaseOptionsSheet(context, product);
    });
  }

  void _remove(BuildContext context) {
    context.runWithAuth(() {
      HapticFeedback.lightImpact();
      final items = context.read<CartBloc>().currentItems;
      CartItemEntity? matched;
      for (final item in items) {
        if (item.productId == product.id) {
          matched = item;
          break;
        }
      }

      final fallbackVariant = product.variants.isNotEmpty
          ? product.variants.first
          : null;

      context.read<CartBloc>().add(
        RemoveFromCartEvent(
          CartItemEntity(
            productId: matched?.productId ?? product.id,
            variantId: matched?.variantId ?? fallbackVariant?.id ?? product.id,
            productName: product.name,
            variantName:
                matched?.variantName ?? fallbackVariant?.label ?? product.unit,
            unitPrice: matched?.unitPrice ?? product.price,
            purchaseType: matched?.purchaseType ?? 'onetime',
            quantity: 1,
            deliveryDate:
                matched?.deliveryDate ??
                DateTime.now()
                    .add(const Duration(days: 1))
                    .toString()
                    .split(' ')[0],
            deliverySlot: matched?.deliverySlot ?? 'Morning',
          ),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    if (product.isOutOfStock) {
      return const _ActionShell(
        color: _stockGrey,
        child: Text(
          'Out of Stock',
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
            color: kTextSub,
          ),
        ),
      );
    }

    return BlocBuilder<CartBloc, CartState>(
      builder: (context, _) {
        final qty = context
            .read<CartBloc>()
            .currentItems
            .where((item) => item.productId == product.id)
            .fold<int>(
              0,
              (sum, item) =>
                  sum +
                  (item.purchaseType == 'subscription'
                      ? 1
                      : (item.quantity ?? 1)),
            );

        if (qty > 0) {
          return _ActionShell(
            color: kPrimary,
            fill: true,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _StepperButton(
                  icon: Icons.remove_rounded,
                  onTap: () => _remove(context),
                ),
                Text(
                  '$qty',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                _StepperButton(
                  icon: Icons.add_rounded,
                  onTap: () => _add(context),
                ),
              ],
            ),
          );
        }

        return GestureDetector(
          onTap: () => _subscriptionOnly
              ? _openSubscriptionSetup(context, product)
              : _add(context),
          behavior: HitTestBehavior.opaque,
          child: _ActionShell(
            color: kPrimary,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.add_rounded, size: 18, color: Colors.white),
                const SizedBox(width: 6),
                Text(
                  _subscriptionOnly ? 'Subscribe' : 'Add',
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ActionShell extends StatelessWidget {
  final Color color;
  final Widget child;

  /// When true the child spans the pill (the quantity stepper) instead of
  /// being centred and shrink-wrapped (the labelled actions).
  final bool fill;

  const _ActionShell({
    required this.color,
    required this.child,
    this.fill = false,
  });

  @override
  Widget build(BuildContext context) => Container(
    height: 38,
    width: double.infinity,
    alignment: Alignment.center,
    padding: const EdgeInsets.symmetric(horizontal: 4),
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(10),
    ),
    child: fill ? child : FittedBox(fit: BoxFit.scaleDown, child: child),
  );
}

class _StepperButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _StepperButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: SizedBox(
      width: 44,
      height: 38,
      child: Icon(icon, size: 20, color: Colors.white),
    ),
  );
}
