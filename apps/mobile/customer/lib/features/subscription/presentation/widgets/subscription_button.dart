// ══════════════════════════════════════════════════════════
//  SUBSCRIPTION BUTTON
//
//  A reusable badge/button that appears on subscribable
//  product cards (top-right) and the Product Detail page.
//  Tapping it opens the dedicated SubscriptionSetupScreen.
//
//  RULE: Only visible when product.isSubscribable == true.
//        Never adds the product to the cart.
// ══════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../catalog/data/models/product_model.dart';
import '../../../../core/guards/auth_guard.dart';
import '../screens/subscription_setup_screen.dart';

class SubscriptionButton extends StatelessWidget {
  final Product product;
  final ProductVariant? selectedVariant;

  /// If true, renders as a compact pill badge (for product cards).
  /// If false, renders as a full-width outlined button (for detail page).
  final bool isCompact;

  const SubscriptionButton({
    super.key,
    required this.product,
    this.selectedVariant,
    this.isCompact = true,
  });

  void _openSetup(BuildContext context) {
    HapticFeedback.lightImpact();
    final vars = product.variants.isNotEmpty ? product.variants : product.allVariants;
    final initialVar = selectedVariant ??
        vars.firstWhere(
          (v) => v.id == product.id,
          orElse: () => vars.firstWhere(
            (v) => v.subscriptionPrice != null && v.subscriptionPrice! > 0 && !v.isOutOfStock,
            orElse: () => vars.firstOrNull ?? ProductVariant(
              id: product.id,
              label: product.unit,
              price: product.price,
              originalPrice: product.originalPrice,
              subscriptionPrice: product.subscriptionPrice,
            ),
          ),
        );

    context.runWithAuth(() {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => SubscriptionSetupScreen(
            product: product,
            initialVariant: initialVar,
          ),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!product.isSubscribable) return const SizedBox.shrink();

    final subPrice = selectedVariant?.subscriptionPrice ?? product.subscriptionPrice;

    if (isCompact) {
      return _CompactBadge(
        onTap: () => _openSetup(context),
        subscriptionPrice: subPrice,
      );
    }
    return _FullButton(
      onTap: () => _openSetup(context),
      subscriptionPrice: subPrice,
    );
  }
}

// ── Compact badge for product cards ──────────────────────

class _CompactBadge extends StatelessWidget {
  final VoidCallback onTap;
  final double? subscriptionPrice;
  const _CompactBadge({required this.onTap, this.subscriptionPrice});

  @override
  Widget build(BuildContext context) {
    final hasPrice = subscriptionPrice != null && subscriptionPrice! > 0;
    final label = hasPrice ? 'Subscribe @ ₹${subscriptionPrice!.toStringAsFixed(0)}' : 'Subscribe';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xFF1B4332),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1B4332).withValues(alpha: 0.25),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.autorenew_rounded, size: 9, color: Colors.white),
              const SizedBox(width: 2),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 8.5,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Full button for Product Detail page ──────────────────

class _FullButton extends StatelessWidget {
  final VoidCallback onTap;
  final double? subscriptionPrice;
  const _FullButton({required this.onTap, this.subscriptionPrice});

  @override
  Widget build(BuildContext context) {
    final hasPrice = subscriptionPrice != null && subscriptionPrice! > 0;
    final label = hasPrice ? 'Subscribe @ ₹${subscriptionPrice!.toStringAsFixed(0)}' : 'Subscribe & Save';

    return OutlinedButton.icon(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: const Color(0xFF1B4332),
        side: const BorderSide(color: Color(0xFF1B4332), width: 1.5),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      icon: const Icon(Icons.autorenew_rounded, size: 16),
      label: Text(
        label,
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
      ),
    );
  }
}
