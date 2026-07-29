import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import '../../data/models/product_model.dart';
import '../screens/product_detail_view_screen.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/cart/cart_bloc.dart';
import '../bloc/cart/cart_event.dart';
import '../bloc/cart/cart_state.dart';
import '../../domain/entities/cart/cart_item_entity.dart';
import '../../../../core/guards/auth_guard.dart';
import '../../../subscription/presentation/widgets/subscription_button.dart';

// ── Product image widget ─────────────────────────────────
Widget _productImage(
  Product p, {
  BoxFit fit = BoxFit.cover,
  double padding = 0.0,
}) {
  return Padding(
    padding: EdgeInsets.all(padding),
    child: buildProductImage(p.name, imageAsset: p.imageAsset, fit: fit),
  );
}

// ══════════════════════════════════════════════════════════
//  VARIANT SELECTOR BOTTOM SHEET
//  Appears when user taps "+" on a product with variants
// ══════════════════════════════════════════════════════════

void showPurchaseOptionsSheet(
  BuildContext context,
  Product product, {
  String? selectedVariantId,
}) {
  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (_) => _PurchaseOptionsSheet(
      product: product,
      selectedVariantId: selectedVariantId,
    ),
  );
}

class _PurchaseOptionsSheet extends StatefulWidget {
  final Product product;
  final String? selectedVariantId;
  const _PurchaseOptionsSheet({required this.product, this.selectedVariantId});
  @override
  State<_PurchaseOptionsSheet> createState() => _PurchaseOptionsSheetState();
}

class _PurchaseOptionsSheetState extends State<_PurchaseOptionsSheet> {
  late ProductVariant _selected;
  int _sheetQty = 1;

  @override
  void initState() {
    super.initState();
    final vars = widget.product.allVariants;
    _selected = vars.firstWhere(
      (v) => v.id == widget.selectedVariantId,
      orElse: () => vars.isNotEmpty
          ? vars.first
          : ProductVariant(
              id: widget.product.id,
              label: widget.product.unit,
              price: widget.product.price,
              originalPrice: widget.product.originalPrice,
              subscriptionPrice: widget.product.subscriptionPrice,
            ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    return Container(
      decoration: const BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle bar
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: kBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Product info header
          Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: buildProductImage(
                  p.name,
                  imageAsset: p.imageAsset,
                  width: 52,
                  height: 52,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.name,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: kText,
                      ),
                    ),
                    Text(
                      p.vendor,
                      style: const TextStyle(fontSize: 11, color: kTextSub),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          if (p.allVariants.isNotEmpty) ...[
            // "SELECT PACK SIZE" label
            const Text(
              'SELECT PACK SIZE',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: kTextSub,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 10),
            // Variant pills
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: p.allVariants.map((v) {
                final isSel = v.id == _selected.id;
                final isVarLowStock =
                    v.isLowStock || p.isLowStock || p.isOutOfStock;
                return GestureDetector(
                  onTap: () => setState(() {
                    _selected = v;
                    _sheetQty = 1;
                  }),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: isSel
                          ? kPrimary
                          : (isVarLowStock
                                ? const Color(0xFFFFF5F5)
                                : kSurface),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSel
                            ? kPrimary
                            : (isVarLowStock
                                  ? const Color(0xFFEF5350)
                                  : kBorder),
                        width: isSel ? 1.5 : 1.0,
                      ),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          v.label,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: isSel
                                ? Colors.white
                                : (isVarLowStock
                                      ? const Color(0xFFD32F2F)
                                      : kText),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '₹${v.price.toStringAsFixed(0)}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: isSel ? Colors.white70 : kPrimary,
                          ),
                        ),
                        if (isVarLowStock) ...[
                          const SizedBox(height: 2),
                          Text(
                            p.isOutOfStock ? 'OUT OF STOCK' : 'LOW STOCK',
                            style: TextStyle(
                              fontSize: 7.5,
                              fontWeight: FontWeight.w900,
                              color: isSel
                                  ? Colors.white
                                  : const Color(0xFFD32F2F),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),
          ],
          // Price row + Add button
          BlocBuilder<CartBloc, CartState>(
            builder: (ctx, state) {
              final items = ctx.read<CartBloc>().currentItems;
              int qty = items
                  .where(
                    (item) =>
                        item.productId == p.id &&
                        item.variantId == _selected.id,
                  )
                  .fold(
                    0,
                    (sum, item) =>
                        sum +
                        (item.purchaseType == 'subscription'
                            ? (item.schedules?.fold<int>(
                                    0,
                                    (s, sc) => s + sc.mQuantity + sc.eQuantity,
                                  ) ??
                                  1)
                            : (item.quantity ?? 0)),
                  );
              final displayPrice = _selected.price;

              void dispatchAdd({int quantity = 1}) {
                final cartItem = CartItemEntity(
                  productId: p.id,
                  variantId: _selected.id,
                  productName: p.name,
                  variantName: _selected.label,
                  unitPrice: _selected.price,
                  purchaseType: 'onetime',
                  quantity: quantity,
                  deliveryDate: DateTime.now()
                      .add(const Duration(days: 1))
                      .toString()
                      .split(' ')[0],
                  deliverySlot: 'Morning',
                  imageAsset: p.imageAsset,
                  isSubscribable: p.isSubscribable,
                  isOneTime: p.isOneTime,
                  subscriptionPrice: _selected.subscriptionPrice,
                );
                ctx.read<CartBloc>().add(AddToCartEvent(cartItem));
              }

              void dispatchRemove() {
                final cartItem = CartItemEntity(
                  productId: p.id,
                  variantId: _selected.id,
                  productName: p.name,
                  variantName: _selected.label,
                  unitPrice: _selected.price,
                  purchaseType: 'onetime',
                  quantity: 1,
                  deliveryDate: DateTime.now()
                      .add(const Duration(days: 1))
                      .toString()
                      .split(' ')[0],
                  deliverySlot: 'Morning',
                  imageAsset: p.imageAsset,
                  isSubscribable: p.isSubscribable,
                  isOneTime: p.isOneTime,
                  subscriptionPrice: _selected.subscriptionPrice,
                );
                ctx.read<CartBloc>().add(RemoveFromCartEvent(cartItem));
              }

              final isSelectedOutOfStock =
                  p.isOutOfStock ||
                  p.isLowStock ||
                  _selected.isLowStock ||
                  !p.isOneTime;

              return Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '₹${displayPrice.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: kPrimary,
                        ),
                      ),
                      Text(
                        '₹${_selected.originalPrice.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: kMuted,
                          decoration: TextDecoration.lineThrough,
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  if (isSelectedOutOfStock)
                    ElevatedButton(
                      onPressed: null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFE0E0E0),
                        foregroundColor: const Color(0xFF757575),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 14,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        p.isOutOfStock
                            ? 'OUT OF STOCK'
                            : 'LOW STOCK — UNAVAILABLE',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF757575),
                        ),
                      ),
                    )
                  else if (qty == 0)
                    Row(
                      children: [
                        Container(
                          height: 44,
                          decoration: BoxDecoration(
                            color: kPrimaryPl,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: kPrimary.withOpacity(0.15),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              GestureDetector(
                                onTap: () {
                                  if (_sheetQty > 1) {
                                    setState(() => _sheetQty--);
                                  }
                                },
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 14),
                                  child: Icon(
                                    Icons.remove_rounded,
                                    color: kPrimary,
                                    size: 18,
                                  ),
                                ),
                              ),
                              Text(
                                '$_sheetQty',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                  color: kPrimary,
                                ),
                              ),
                              GestureDetector(
                                onTap: () {
                                  setState(() => _sheetQty++);
                                },
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 14),
                                  child: Icon(
                                    Icons.add_rounded,
                                    color: kPrimary,
                                    size: 18,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        ElevatedButton(
                          onPressed: () {
                            ctx.runWithAuth(() {
                              HapticFeedback.lightImpact();
                              dispatchAdd(quantity: _sheetQty);
                              Navigator.pop(ctx);
                            });
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: kPrimary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 32,
                              vertical: 14,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            elevation: 0,
                          ),
                          child: const Text(
                            'ADD',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    )
                  else
                    Container(
                      height: 44,
                      decoration: BoxDecoration(
                        color: kPrimary,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          GestureDetector(
                            onTap: () {
                              ctx.runWithAuth(() {
                                HapticFeedback.lightImpact();
                                dispatchRemove();
                              });
                            },
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 14),
                              child: Icon(
                                Icons.remove_rounded,
                                color: Colors.white,
                                size: 18,
                              ),
                            ),
                          ),
                          Text(
                            '$qty',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                          GestureDetector(
                            onTap: () {
                              ctx.runWithAuth(() {
                                HapticFeedback.lightImpact();
                                dispatchAdd();
                              });
                            },
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 14),
                              child: Icon(
                                Icons.add_rounded,
                                color: Colors.white,
                                size: 18,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

// ── Celebration snackbar (100+ items) ───────────────────
void _maybeCelebrate(BuildContext context) {
  final cartState = context.read<CartBloc>().state;
  int total = 0;
  if (cartState is CartLoadedState) {
    total = cartState.items.fold(0, (sum, item) => sum + (item.quantity ?? 1));
  }
  if (total == 100) {
    HapticFeedback.heavyImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        duration: const Duration(seconds: 4),
        content: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF1B5E20), Color(0xFF2E7D32)],
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Row(
            children: [
              Text('🎉', style: TextStyle(fontSize: 24)),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'FREE DELIVERY UNLOCKED!',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      '100+ items added — enjoy free delivery!',
                      style: TextStyle(color: Colors.white70, fontSize: 10),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  HORIZONTAL PRODUCT CARD — Zepto/Instamart compact style
// ══════════════════════════════════════════════════════════

class ProductCardH extends StatelessWidget {
  final Product p;
  const ProductCardH(this.p, {super.key});

  @override
  Widget build(BuildContext context) {
    final colorIndex = (p.id.hashCode ?? p.name.hashCode).abs() % 5;
    final borderColor = [
      const Color(0xFFC8E6C9), // soft green
      const Color(0xFFC8E6C9), // soft blue
      const Color(0xFFC8E6C9), // soft orange
      const Color(0xFFC8E6C9), // soft purple
      const Color(0xFFC8E6C9), // soft yellow
    ][colorIndex];

    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        PageRouteBuilder(
          pageBuilder: (_, a, _) => ProductDetailViewScreen(product: p),
          transitionsBuilder: (_, a, _, child) =>
              FadeTransition(opacity: a, child: child),
          transitionDuration: const Duration(milliseconds: 220),
        ),
      ),
      child: Container(
        width: 144,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: borderColor, width: 1.5),
          boxShadow: [
            BoxShadow(
              color: kPrimary.withValues(alpha: 0.03),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image area
            Stack(
              children: [
                Hero(
                  tag: 'product-${p.id}',
                  child: Container(
                    height: 120,
                    width: double.infinity,
                    decoration: const BoxDecoration(color: Colors.transparent),
                    child: _productImage(p, padding: 0.0),
                  ),
                ),
                // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
                if (p.reviews > 0)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4.5,
                        vertical: 2.5,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.9),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: const Color(0xFFFFE0B2),
                          width: 0.8,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.star_rounded,
                            size: 10,
                            color: Colors.amber,
                          ),
                          const SizedBox(width: 2.5),
                          Text(
                            '${p.rating.toStringAsFixed(1)} (${p.reviews})',
                            style: const TextStyle(
                              fontSize: 7.5,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFFE65100),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                // Low Stock badge
                if (p.isLowStock || p.isOutOfStock)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFEBEE),
                        borderRadius: BorderRadius.circular(100),
                        border: Border.all(
                          color: const Color(0xFFEF5350),
                          width: 0.8,
                        ),
                      ),
                      child: const Text(
                        'LOW STOCK',
                        style: TextStyle(
                          fontSize: 6.5,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFD32F2F),
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                  )
                else if (p.isOrganic)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE8F5E9),
                        borderRadius: BorderRadius.circular(100),
                        border: Border.all(
                          color: const Color(0xFFA5D6A7),
                          width: 0.8,
                        ),
                      ),
                      child: const Text(
                        'ORGANIC',
                        style: TextStyle(
                          fontSize: 6.5,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF2E7D32),
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                  ),
                if (p.isSubscribable)
                  Positioned(
                    bottom: 6,
                    left: 6,
                    child: SubscriptionButton(product: p, isCompact: true),
                  ),
              ],
            ),
            // Info area
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    p.name,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: kText,
                      letterSpacing: -0.2,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (p.formattedUnit.isNotEmpty && p.formattedUnit.toLowerCase() != p.name.toLowerCase()) ...[
                    const SizedBox(height: 3),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
                      ),
                      child: Text(
                        p.formattedUnit,
                        style: const TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF475569),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Flexible(
                              child: Text(
                                '₹${p.price.toStringAsFixed(0)}',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                  color: kText,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (p.originalPrice > p.price) ...[
                              const SizedBox(width: 3),
                              Flexible(
                                child: Text(
                                  '₹${p.originalPrice.toStringAsFixed(0)}',
                                  style: const TextStyle(
                                    fontSize: 9.5,
                                    color: kMuted,
                                    decoration: TextDecoration.lineThrough,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 4),
                      ZeptoAddButton(p: p, isSmall: true),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  VERTICAL PRODUCT CARD — Zepto/Instamart 2-col grid
// ══════════════════════════════════════════════════════════

class ProductCardV extends StatelessWidget {
  final Product p;
  final bool isBrowse;
  const ProductCardV(this.p, {super.key, this.isBrowse = false});

  @override
  Widget build(BuildContext context) {
    final colorIndex = (p.id?.hashCode ?? p.name.hashCode).abs() % 5;
    final borderColor = [
      const Color(0xFFC8E6C9), // soft green
      const Color(0xFFC8E6C9), // soft blue
      const Color(0xFFC8E6C9), // soft orange
      const Color(0xFFC8E6C9), // soft purple
      const Color(0xFFC8E6C9), // soft yellow
    ][colorIndex];

    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        PageRouteBuilder(
          pageBuilder: (_, a, _) => ProductDetailViewScreen(product: p),
          transitionsBuilder: (_, a, _, child) =>
              FadeTransition(opacity: a, child: child),
          transitionDuration: const Duration(milliseconds: 220),
        ),
      ),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: borderColor, width: 1.2),
          boxShadow: [
            BoxShadow(
              color: kPrimary.withValues(alpha: 0.03),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: isBrowse
            ? Row(
                children: [
                  // 1. Image on the left
                  Hero(
                    tag: 'product-v-${p.id}',
                    child: Stack(
                      children: [
                        Container(
                          width: 104,
                          height: double.infinity,
                          decoration: const BoxDecoration(
                            color: Colors.transparent,
                          ),
                          child: _productImage(p, padding: 0.0),
                        ),
                        // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
                        if (p.reviews > 0)
                          Positioned(
                            top: 8,
                            left: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4.5,
                                vertical: 2.5,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.9),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: const Color(0xFFFFE0B2),
                                  width: 0.8,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.04),
                                    blurRadius: 4,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.star_rounded,
                                    size: 10,
                                    color: Colors.amber,
                                  ),
                                  const SizedBox(width: 2.5),
                                  Text(
                                    '${p.rating.toStringAsFixed(1)} (${p.reviews})',
                                    style: const TextStyle(
                                      fontSize: 7.5,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFFE65100),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  // 2. Info on the right
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p.name,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: kText,
                              letterSpacing: -0.2,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (p.formattedUnit.isNotEmpty && p.formattedUnit.toLowerCase() != p.name.toLowerCase()) ...[
                            const SizedBox(height: 3),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
                              ),
                              child: Text(
                                p.formattedUnit,
                                style: const TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF475569),
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                          if (p.isSubscribable)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: SubscriptionButton(
                                product: p,
                                isCompact: true,
                              ),
                            ),
                          const Spacer(),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          '₹${p.price.toStringAsFixed(0)}',
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w900,
                                            color: kText,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ),
                                    if (p.originalPrice > p.price) ...[
                                      const SizedBox(height: 1),
                                      Text(
                                        '₹${p.originalPrice.toStringAsFixed(0)}',
                                        style: const TextStyle(
                                          fontSize: 10,
                                          color: kMuted,
                                          decoration:
                                              TextDecoration.lineThrough,
                                          fontWeight: FontWeight.w600,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(width: 4),
                              ZeptoAddButton(
                                p: p,
                                isSmall: true,
                                isBrowse: isBrowse,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Image container
                  Expanded(
                    child: Stack(
                      children: [
                        Container(
                          width: double.infinity,
                          decoration: const BoxDecoration(
                            color: Colors.transparent,
                          ),
                          child: _productImage(p, padding: 0.0),
                        ),
                        // Rating badge on image
                        if (p.reviews > 0)
                          Positioned(
                            top: 8,
                            left: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4.5,
                                vertical: 2.5,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.9),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: const Color(0xFFFFE0B2),
                                  width: 0.8,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.star_rounded,
                                    size: 10,
                                    color: Colors.amber,
                                  ),
                                  const SizedBox(width: 2.5),
                                  Text(
                                    '${p.rating.toStringAsFixed(1)} (${p.reviews})',
                                    style: const TextStyle(
                                      fontSize: 7.5,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFFE65100),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  // Info
                  Padding(
                    padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.name,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: kText,
                            letterSpacing: -0.2,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (p.formattedUnit.isNotEmpty && p.formattedUnit.toLowerCase() != p.name.toLowerCase()) ...[
                          const SizedBox(height: 3),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
                            ),
                            child: Text(
                              p.formattedUnit,
                              style: const TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF475569),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                        const Spacer(),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        '₹${p.price.toStringAsFixed(0)}',
                                        style: const TextStyle(
                                          fontSize: 13.5,
                                          fontWeight: FontWeight.w900,
                                          color: kText,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                  if (p.originalPrice > p.price) ...[
                                    const SizedBox(height: 1),
                                    Text(
                                      '₹${p.originalPrice.toStringAsFixed(0)}',
                                      style: const TextStyle(
                                        fontSize: 9.5,
                                        color: kMuted,
                                        decoration: TextDecoration.lineThrough,
                                        fontWeight: FontWeight.w600,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(width: 4),
                            ZeptoAddButton(
                              p: p,
                              isSmall: true,
                              isBrowse: isBrowse,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  ZEPTO-STYLE ADD BUTTON
//  Shows "+" or a counter; if product has variants, opens sheet
// ══════════════════════════════════════════════════════════

class ZeptoAddButton extends StatefulWidget {
  final Product p;
  final bool isSmall;
  final bool isBrowse;
  const ZeptoAddButton({
    required this.p,
    this.isSmall = true,
    this.isBrowse = false,
  });

  @override
  State<ZeptoAddButton> createState() => ZeptoAddButtonState();
}

class ZeptoAddButtonState extends State<ZeptoAddButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _scale = TweenSequence([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.80), weight: 40),
      TweenSequenceItem(
        tween: Tween(
          begin: 0.80,
          end: 1.10,
        ).chain(CurveTween(curve: Curves.elasticOut)),
        weight: 60,
      ),
    ]).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _onAdd(BuildContext ctx) {
    ctx.runWithAuth(() {
      HapticFeedback.lightImpact();
      _ctrl.forward(from: 0);
      showPurchaseOptionsSheet(ctx, widget.p);
    });
  }

  void _onRemove(BuildContext ctx) {
    ctx.runWithAuth(() {
      HapticFeedback.lightImpact();

      final items = ctx.read<CartBloc>().currentItems;
      CartItemEntity? matchedItem;
      try {
        matchedItem = items.firstWhere((item) => item.productId == widget.p.id);
      } catch (_) {}

      final variantId =
          matchedItem?.variantId ??
          (widget.p.allVariants.isNotEmpty
              ? widget.p.allVariants.first.id
              : widget.p.id);
      final variantLabel =
          matchedItem?.variantName ??
          (widget.p.allVariants.isNotEmpty
              ? widget.p.allVariants.first.label
              : widget.p.unit);
      final purchaseType = matchedItem?.purchaseType ?? 'onetime';

      final cartItem = CartItemEntity(
        productId: matchedItem?.productId ?? widget.p.id,
        variantId: variantId,
        productName: widget.p.name,
        variantName: variantLabel,
        unitPrice: matchedItem?.unitPrice ?? widget.p.price,
        purchaseType: purchaseType,
        quantity: 1,
        deliveryDate:
            matchedItem?.deliveryDate ??
            DateTime.now()
                .add(const Duration(days: 1))
                .toString()
                .split(' ')[0],
        deliverySlot: matchedItem?.deliverySlot ?? 'Morning',
      );
      ctx.read<CartBloc>().add(RemoveFromCartEvent(cartItem));
    });
  }

  @override
  Widget build(BuildContext context) {
    final isOutOfStockOrLow =
        widget.p.isOutOfStock || widget.p.isLowStock || !widget.p.isOneTime;
    if (isOutOfStockOrLow) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFE0E0E0),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFBDBDBD), width: 1.0),
        ),
        child: Text(
          widget.p.isOutOfStock ? 'OUT OF STOCK' : 'LOW STOCK',
          style: const TextStyle(
            fontSize: 8.5,
            fontWeight: FontWeight.w900,
            color: Color(0xFF757575),
            letterSpacing: 0.3,
          ),
        ),
      );
    }

    return BlocBuilder<CartBloc, CartState>(
      builder: (ctx, state) {
        final items = ctx.read<CartBloc>().currentItems;
        int qty = items
            .where((item) => item.productId == widget.p.id)
            .fold(
              0,
              (sum, item) =>
                  sum +
                  (item.purchaseType == 'subscription'
                      ? 1
                      : (item.quantity ?? 1)),
            );

        if (qty == 0) {
          return ScaleTransition(
            scale: _scale,
            child: GestureDetector(
              onTap: () => _onAdd(ctx),
              child: widget.isBrowse
                  ? Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: kPrimary.withOpacity(0.35),
                          width: 1.5,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: kPrimary.withValues(alpha: 0.04),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.add_rounded,
                          color: kPrimary,
                          size: 16,
                        ),
                      ),
                    )
                  : Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: kPrimary.withOpacity(0.35),
                          width: 1.5,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: kPrimary.withValues(alpha: 0.04),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'ADD',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: kPrimary,
                              letterSpacing: 0.5,
                            ),
                          ),
                          SizedBox(width: 2),
                          Icon(Icons.add_rounded, color: kPrimary, size: 11),
                        ],
                      ),
                    ),
            ),
          );
        }

        // Counter (only for non-variant products)
        return ScaleTransition(
          scale: _scale,
          child: Container(
            height: 24,
            decoration: BoxDecoration(
              color: kPrimary,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: kPrimary.withValues(alpha: 0.2),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                GestureDetector(
                  onTap: () => _onRemove(ctx),
                  behavior: HitTestBehavior.opaque,
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    child: Icon(
                      Icons.remove_rounded,
                      color: Colors.white,
                      size: 12,
                    ),
                  ),
                ),
                Text(
                  '$qty',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
                GestureDetector(
                  onTap: () => _onAdd(ctx),
                  behavior: HitTestBehavior.opaque,
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    child: Icon(
                      Icons.add_rounded,
                      color: Colors.white,
                      size: 12,
                    ),
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
