import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import '../../data/models/product_model.dart';
import '../screens/product_detail_view_screen.dart';
import 'product_grid_card.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/cart/cart_bloc.dart';
import '../bloc/cart/cart_event.dart';
import '../bloc/cart/cart_state.dart';
import '../../domain/entities/cart/cart_item_entity.dart';
import '../../../../core/guards/auth_guard.dart';
import '../../../subscription/presentation/widgets/subscription_button.dart';
import '../helpers/cart_helpers.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';

// ── Product image widget ─────────────────────────────────
Widget _productImage(Product p, {BoxFit fit = BoxFit.cover, double padding = 0.0}) {
  return Padding(
    padding: EdgeInsets.all(padding),
    child: buildProductImage(p.name, imageAsset: p.imageAsset, fit: fit),
  );
}

// ══════════════════════════════════════════════════════════
//  VARIANT SELECTOR BOTTOM SHEET
//  Appears when user taps "+" on a product with variants
// ══════════════════════════════════════════════════════════

void showPurchaseOptionsSheet(BuildContext context, Product product, {String? selectedVariantId}) {
  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (_) => _PurchaseOptionsSheet(product: product, selectedVariantId: selectedVariantId),
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
    // The pills below render from `product.variants`, so resolve the initial
    // selection from that same list — `allVariants` de-dupes by unit and can
    // drop the very entry the tapped card stands for.
    final vars = widget.product.variants.isNotEmpty
        ? widget.product.variants
        : widget.product.allVariants;

    // A product card IS a single variant (Product.id holds a variant_id) and
    // carries its siblings in `variants`. Default to the variant the user
    // actually tapped; falling back to `vars.first` preselected whichever
    // sibling happened to be listed first, so opening the 1L card came up on
    // an unrelated pack at the wrong price.
    _selected = _variantById(vars, widget.selectedVariantId) ??
        _variantById(vars, widget.product.id) ??
        (vars.isNotEmpty
            ? vars.first
            : ProductVariant(
                id: widget.product.id,
                label: widget.product.unit,
                price: widget.product.price,
                originalPrice: widget.product.originalPrice,
                subscriptionPrice: widget.product.subscriptionPrice,
              ));
  }

  static ProductVariant? _variantById(List<ProductVariant> vars, String? id) {
    if (id == null || id.isEmpty) return null;
    for (final v in vars) {
      if (v.id == id) return v;
    }
    return null;
  }

  /// Whether the pack the user currently has selected can be bought.
  ///
  /// The card-level flags describe the variant the sheet was opened from, which
  /// is a different pack the moment another pill is picked — so stock is read
  /// off `_selected`. The card's own flags are still honoured when the selection
  /// IS the card, because the category feed reconciles master stock onto the
  /// Product while leaving its sibling list untouched.
  bool get _selectionUnavailable {
    final isSelf = _selected.id == widget.product.id;
    return _selected.isOutOfStock ||
        _selected.isLowStock ||
        (isSelf && (widget.product.isOutOfStock || widget.product.isLowStock)) ||
        !widget.product.isOneTime;
  }

  bool get _selectionOutOfStock =>
      _selected.isOutOfStock ||
      (_selected.id == widget.product.id && widget.product.isOutOfStock);

  /// Name for the pack the user currently has selected. Each pill is a
  /// separately named product row, so the header and the cart entry have to
  /// follow the selection rather than the card that opened the sheet.
  String get _selectedName =>
      _selected.id == widget.product.id || _selected.label.trim().isEmpty
          ? widget.product.name
          : _selected.label;

  @override
  Widget build(BuildContext context) {
    final p = widget.product;

    Widget content = Container(
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
                    Text(_selectedName,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: kText)),
                    Text(p.vendor,
                        style: const TextStyle(fontSize: 11, color: kTextSub)),
                  ],
                ),
              ),
            ],
          ),
          if (_selectionOutOfStock) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFFFEBEE),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFEF5350)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.error_outline_rounded, size: 14, color: Color(0xFFD32F2F)),
                  SizedBox(width: 6),
                  Text('This pack is currently Out of Stock', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFD32F2F))),
                ],
              ),
            ),
          ] else if (_selectionUnavailable) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3E0),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFFB74D)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.warning_amber_rounded, size: 14, color: Color(0xFFE65100)),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text('LOW STOCK — One-Time Order Unavailable', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFE65100))),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 18),
          if (p.variants.isNotEmpty) ...[
            // "SELECT PACK SIZE" label
            const Text(
              'SELECT PACK SIZE',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: kTextSub, letterSpacing: 1.2),
            ),
            const SizedBox(height: 10),
            // Equal-sized responsive variant boxes
            LayoutBuilder(
              builder: (context, constraints) {
                final count = p.variants.length;
                final columns = count == 2
                    ? 2
                    : (constraints.maxWidth >= 330 && count % 3 == 0 ? 3 : (constraints.maxWidth >= 360 ? 3 : 2));
                const spacing = 8.0;
                final itemWidth = (constraints.maxWidth - (columns - 1) * spacing) / columns;

                return Wrap(
                  spacing: spacing,
                  runSpacing: spacing,
                  children: p.variants.map((v) {
                    final isSel = v.id == _selected.id;
                    final isGone = v.isOutOfStock;
                    // A sold-out pack stays selectable so the reason lands in the
                    // banner and the ADD button, rather than the tap doing nothing.
                    return GestureDetector(
                      onTap: () => setState(() {
                        _selected = v;
                        _sheetQty = 1;
                      }),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: itemWidth,
                        height: 74,
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        decoration: BoxDecoration(
                          color: isSel ? (isGone ? kMuted : kPrimary) : kSurface,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isSel ? (isGone ? kMuted : kPrimary) : kBorder,
                            width: isSel ? 1.8 : 1.0,
                          ),
                          boxShadow: isSel
                              ? [
                                  BoxShadow(
                                    color: (isGone ? kMuted : kPrimary).withValues(alpha: 0.20),
                                    blurRadius: 6,
                                    offset: const Offset(0, 2),
                                  ),
                                ]
                              : null,
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              v.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: isSel ? Colors.white : (isGone ? kTextSub : kText),
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              '₹${v.price.toStringAsFixed(0)}',
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: isSel ? Colors.white70 : (isGone ? kMuted : kPrimary),
                                decoration: isGone ? TextDecoration.lineThrough : null,
                              ),
                            ),
                            if (isGone) ...[
                              const SizedBox(height: 2),
                              Text(
                                'Out of stock',
                                maxLines: 1,
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.3,
                                  color: isSel ? Colors.white : const Color(0xFFD32F2F),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
            const SizedBox(height: 20),
          ],
          // Price row + Add button
          BlocBuilder<CartBloc, CartState>(
            builder: (ctx, state) {
              final items = ctx.read<CartBloc>().currentItems;
              // variantId is the real key (the server resolves everything by
              // product_variants.variant_id), and matching on it alone also
              // counts rows added before the sheet tracked the selected pack.
              int qty = items
                  .where((item) => item.variantId == _selected.id)
                  .fold(0, (sum, item) => sum + (item.purchaseType == 'subscription' ? (item.schedules?.fold<int>(0, (s, sc) => s + sc.mQuantity + sc.eQuantity) ?? 1) : (item.quantity ?? 0)));
              final displayPrice = _selected.price;

              final maxStock = _selected.maxStock;

              void dispatchAdd({int quantity = 1}) {
                if (qty + quantity > maxStock) {
                  F2HToast.error(ctx, 'Only $maxStock unit(s) available in stock');
                  return;
                }
                final now = DateTime.now();
                // Slot windows/cutoffs come from admin Configurations; the
                // helper's built-in defaults are only a fallback and are
                // hours away from the configured cutoffs.
                final slotTimings = slotTimingsOf(ctx);
                final defDate = getDefaultDeliveryDate(now, slotTimings);
                final defSlot = getDefaultSlot(defDate, now, slotTimings);
                final cartItem = CartItemEntity(
                  productId: _selected.id,
                  variantId: _selected.id,
                  productName: _selectedName,
                  variantName: _selected.label,
                  unitPrice: _selected.price,
                  purchaseType: 'onetime',
                  quantity: quantity,
                  deliveryDate: defDate.toString().split(' ')[0],
                  deliverySlot: defSlot,
                  imageAsset: p.imageAsset,
                  isSubscribable: p.isSubscribable,
                  isOneTime: p.isOneTime,
                  subscriptionPrice: _selected.subscriptionPrice,
                );
                ctx.read<CartBloc>().add(AddToCartEvent(cartItem));
              }

              void dispatchRemove() {
                final now = DateTime.now();
                // Slot windows/cutoffs come from admin Configurations; the
                // helper's built-in defaults are only a fallback and are
                // hours away from the configured cutoffs.
                final slotTimings = slotTimingsOf(ctx);
                final defDate = getDefaultDeliveryDate(now, slotTimings);
                final defSlot = getDefaultSlot(defDate, now, slotTimings);
                final cartItem = CartItemEntity(
                  productId: _selected.id,
                  variantId: _selected.id,
                  productName: _selectedName,
                  variantName: _selected.label,
                  unitPrice: _selected.price,
                  purchaseType: 'onetime',
                  quantity: 1,
                  deliveryDate: defDate.toString().split(' ')[0],
                  deliverySlot: defSlot,
                  imageAsset: p.imageAsset,
                  isSubscribable: p.isSubscribable,
                  isOneTime: p.isOneTime,
                  subscriptionPrice: _selected.subscriptionPrice,
                );
                ctx.read<CartBloc>().add(RemoveFromCartEvent(cartItem));
              }

              final isAtMaxStock = qty >= maxStock;

              return Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '₹${displayPrice.toStringAsFixed(0)}',
                        style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w900, color: kPrimary),
                      ),
                      Text(
                        '₹${_selected.originalPrice.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 15, color: kMuted,
                          decoration: TextDecoration.lineThrough,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  if (qty == 0)
                    Row(
                      children: [
                        Container(
                          height: 44,
                          decoration: BoxDecoration(
                            color: kPrimaryPl,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: kPrimary.withValues(alpha: 0.15)),
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
                                  child: Icon(Icons.remove_rounded, color: kPrimary, size: 18),
                                ),
                              ),
                              Text('$_sheetQty', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: kPrimary)),
                              GestureDetector(
                                onTap: () {
                                  if (_sheetQty < maxStock) {
                                    setState(() => _sheetQty++);
                                  } else {
                                    F2HToast.error(context, 'Only $maxStock unit(s) available in stock');
                                  }
                                },
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 14),
                                  child: Icon(Icons.add_rounded,
                                      color: _sheetQty >= maxStock ? kMuted : kPrimary, size: 18),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        ElevatedButton(
                          onPressed: (_selectionUnavailable || maxStock <= 0)
                              ? null
                              : () {
                                  ctx.runWithAuth(() {
                                    HapticFeedback.lightImpact();
                                    dispatchAdd(quantity: _sheetQty);
                                    Navigator.pop(ctx);
                                  });
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: (_selectionUnavailable || maxStock <= 0)
                                ? const Color(0xFFE0E0E0)
                                : kPrimary,
                            foregroundColor: (_selectionUnavailable || maxStock <= 0)
                                ? const Color(0xFF757575)
                                : Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            elevation: 0,
                          ),
                          child: Text(
                            (_selectionOutOfStock || maxStock <= 0)
                                ? 'OUT OF STOCK'
                                : (_selectionUnavailable ? 'UNAVAILABLE' : 'ADD'),
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900),
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
                              child: Icon(Icons.remove_rounded, color: Colors.white, size: 18),
                            ),
                          ),
                          Text('$qty', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white)),
                          GestureDetector(
                            onTap: (_selectionUnavailable || isAtMaxStock)
                                ? () {
                                    if (isAtMaxStock) {
                                      F2HToast.error(ctx, 'Only $maxStock unit(s) available in stock');
                                    }
                                  }
                                : () {
                                    ctx.runWithAuth(() {
                                      HapticFeedback.lightImpact();
                                      dispatchAdd();
                                    });
                                  },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 14),
                              child: Icon(Icons.add_rounded,
                                  color: (_selectionUnavailable || isAtMaxStock) ? Colors.white38 : Colors.white, size: 18),
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

    if (p.isOutOfStock) {
      content = ColorFiltered(
        colorFilter: const ColorFilter.matrix(<double>[
          0.2126, 0.7152, 0.0722, 0, 0,
          0.2126, 0.7152, 0.0722, 0, 0,
          0.2126, 0.7152, 0.0722, 0, 0,
          0,      0,      0,      1, 0,
        ]),
        child: content,
      );
    }

    return content;
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
                    Text('FREE DELIVERY UNLOCKED!',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12)),
                    Text('100+ items added — enjoy free delivery!',
                        style: TextStyle(color: Colors.white70, fontSize: 10)),
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
    return SizedBox(
      width: 165,
      child: ProductGridCard(p),
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
    if (!isBrowse) {
      return SizedBox(
        width: 165,
        child: ProductGridCard(p),
      );
    }
    final colorIndex = p.id.hashCode.abs() % 5;
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
        constraints: isBrowse ? const BoxConstraints(minHeight: 128) : null,
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
            ? IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // 1. Image on the left
                    SizedBox(
                      width: MediaQuery.of(context).size.width < 350 ? 98 : 112,
                      child: Hero(
                        tag: 'product-v-${p.id}',
                        child: Stack(
                          children: [
                            Positioned.fill(
                              child: _productImage(p, padding: 0.0),
                            ),
                            if (p.isOutOfStock)
                              Positioned(
                                top: 6, left: 6,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2.5),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFEBEE),
                                    borderRadius: BorderRadius.circular(100),
                                    border: Border.all(color: const Color(0xFFEF5350), width: 0.8),
                                  ),
                                  child: const Text(
                                    'OUT OF STOCK',
                                    style: TextStyle(fontSize: 6.5, fontWeight: FontWeight.w900, color: Color(0xFFD32F2F), letterSpacing: 0.3),
                                  ),
                                ),
                              )
                            else if (p.isLowStock)
                              Positioned(
                                top: 6, left: 6,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2.5),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFF3E0),
                                    borderRadius: BorderRadius.circular(100),
                                    border: Border.all(color: const Color(0xFFFFB74D), width: 0.8),
                                  ),
                                  child: const Text(
                                    'LOW STOCK',
                                    style: TextStyle(fontSize: 6.5, fontWeight: FontWeight.w900, color: Color(0xFFE65100), letterSpacing: 0.3),
                                  ),
                                ),
                              ),
                            if (p.reviews > 0)
                              Positioned(
                                bottom: 6, left: 6,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 4.5, vertical: 2.5),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.9),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: const Color(0xFFFFE0B2), width: 0.8),
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
                                      const Icon(Icons.star_rounded, size: 10, color: Colors.amber),
                                      const SizedBox(width: 2.5),
                                      Text(
                                        '${p.rating.toStringAsFixed(1)} (${p.reviews})',
                                        style: const TextStyle(fontSize: 7.5, fontWeight: FontWeight.w800, color: Color(0xFFE65100)),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    // 2. Info on the right
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  p.name,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    color: kText,
                                    letterSpacing: -0.2,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if ((p.formattedUnit.isNotEmpty ? p.formattedUnit : p.unit).isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: UnconstrainedBox(
                                      alignment: Alignment.centerLeft,
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF3F4F6),
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: const Color(0xFFE5E7EB), width: 1.0),
                                        ),
                                        child: Text(
                                          p.formattedUnit.isNotEmpty ? p.formattedUnit : p.unit,
                                          style: const TextStyle(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF6B7280),
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ),
                                  ),
                                if (p.hasSubscription)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4, bottom: 2),
                                    child: SubscriptionButton(
                                      product: p,
                                      isCompact: true,
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Expanded(
                                  child: Wrap(
                                    crossAxisAlignment: WrapCrossAlignment.center,
                                    spacing: 4,
                                    runSpacing: 2,
                                    children: [
                                      Text(
                                        '₹${p.price.toStringAsFixed(0)}',
                                        style: const TextStyle(
                                          fontSize: 16.5,
                                          fontWeight: FontWeight.w900,
                                          color: kText,
                                        ),
                                      ),
                                      if (p.originalPrice > p.price)
                                        Text(
                                          '₹${p.originalPrice.toStringAsFixed(0)}',
                                          style: const TextStyle(
                                            fontSize: 9.5,
                                            color: kMuted,
                                            decoration: TextDecoration.lineThrough,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 4),
                                ZeptoAddButton(p: p, isSmall: true, isBrowse: isBrowse),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Image area
                  Stack(
                    children: [
                      Hero(
                        tag: 'product-v-${p.id}',
                        child: Container(
                          height: 112,
                          width: double.infinity,
                          decoration: const BoxDecoration(
                            color: Colors.transparent,
                          ),
                          child: _productImage(p, padding: 0.0),
                        ),
                      ),
                      if (p.isOutOfStock)
                        Positioned(
                          top: 8, right: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFEBEE),
                              borderRadius: BorderRadius.circular(100),
                              border: Border.all(color: const Color(0xFFEF5350), width: 0.8),
                            ),
                            child: const Text(
                              'OUT OF STOCK',
                              style: TextStyle(fontSize: 6.5, fontWeight: FontWeight.w900, color: Color(0xFFD32F2F), letterSpacing: 0.3),
                            ),
                          ),
                        )
                      else if (p.isLowStock)
                        Positioned(
                          top: 8, right: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFF3E0),
                              borderRadius: BorderRadius.circular(100),
                              border: Border.all(color: const Color(0xFFFFB74D), width: 0.8),
                            ),
                            child: const Text(
                              'LOW STOCK',
                              style: TextStyle(fontSize: 6.5, fontWeight: FontWeight.w900, color: Color(0xFFE65100), letterSpacing: 0.3),
                            ),
                          ),
                        ),
                      // Rating badge on image
                      if (p.reviews > 0)
                        Positioned(
                          top: 8, left: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4.5, vertical: 2.5),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.9),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFFFFE0B2), width: 0.8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.star_rounded, size: 10, color: Colors.amber),
                                const SizedBox(width: 2.5),
                                Text(
                                  '${p.rating.toStringAsFixed(1)} (${p.reviews})',
                                  style: const TextStyle(fontSize: 7.5, fontWeight: FontWeight.w800, color: Color(0xFFE65100)),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                  // Info
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(p.name,
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText, letterSpacing: -0.2),
                              maxLines: 2, overflow: TextOverflow.ellipsis),
                          const SizedBox(height: 2),
                           if ((p.formattedUnit.isNotEmpty ? p.formattedUnit : p.unit).isNotEmpty) ...[
                             const SizedBox(height: 3),
                             UnconstrainedBox(
                               alignment: Alignment.centerLeft,
                               child: Container(
                                 padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                 decoration: BoxDecoration(
                                   color: const Color(0xFFF3F4F6),
                                   borderRadius: BorderRadius.circular(6),
                                   border: Border.all(color: const Color(0xFFE5E7EB), width: 1.0),
                                 ),
                                 child: Text(
                                   p.formattedUnit.isNotEmpty ? p.formattedUnit : p.unit,
                                   style: const TextStyle(
                                     fontSize: 10,
                                     fontWeight: FontWeight.w700,
                                     color: Color(0xFF6B7280),
                                   ),
                                   maxLines: 1,
                                   overflow: TextOverflow.ellipsis,
                                 ),
                               ),
                             ),
                           ] else
                             const SizedBox(height: 12),
                          const Spacer(),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
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
                              ZeptoAddButton(p: p, isSmall: true, isBrowse: isBrowse),
                            ],
                          ),
                        ],
                      ),
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
  const ZeptoAddButton({super.key, required this.p, this.isSmall = true, this.isBrowse = false});

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
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
    _scale = TweenSequence([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.80), weight: 40),
      TweenSequenceItem(tween: Tween(begin: 0.80, end: 1.10).chain(CurveTween(curve: Curves.elasticOut)), weight: 60),
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
        matchedItem = items.firstWhere(
          (item) => item.productId == widget.p.id,
        );
      } catch (_) {}

      final variantId = matchedItem?.variantId ?? (widget.p.variants.isNotEmpty ? widget.p.variants.first.id : widget.p.id);
      final variantLabel = matchedItem?.variantName ?? (widget.p.variants.isNotEmpty ? widget.p.variants.first.label : widget.p.unit);
      final purchaseType = matchedItem?.purchaseType ?? 'onetime';

      final cartItem = CartItemEntity(
        productId: matchedItem?.productId ?? widget.p.id,
        variantId: variantId,
        productName: widget.p.name,
        variantName: variantLabel,
        unitPrice: matchedItem?.unitPrice ?? widget.p.price,
        purchaseType: purchaseType,
        quantity: 1,
        deliveryDate: matchedItem?.deliveryDate ?? DateTime.now().add(const Duration(days: 1)).toString().split(' ')[0],
        deliverySlot: matchedItem?.deliverySlot ?? 'Morning',
      );
      ctx.read<CartBloc>().add(RemoveFromCartEvent(cartItem));
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CartBloc, CartState>(
      builder: (ctx, state) {
        final items = ctx.read<CartBloc>().currentItems;
        int qty = items
            .where((item) => item.productId == widget.p.id)
            .fold(0, (sum, item) => sum + (item.purchaseType == 'subscription' ? 1 : (item.quantity ?? 1)));

        if (qty == 0) {
          if (widget.p.isOutOfStock) {
            return widget.isBrowse
                ? Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF5F5F5),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE0E0E0), width: 1.0),
                    ),
                    child: const Text(
                      'OUT',
                      style: TextStyle(fontSize: 7.5, fontWeight: FontWeight.w900, color: Color(0xFF9E9E9E)),
                    ),
                  )
                : Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF5F5F5),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFE0E0E0), width: 1.0),
                    ),
                    child: const Text(
                      'OUT OF STOCK',
                      style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: Color(0xFF9E9E9E)),
                    ),
                  );
          }
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
                        border: Border.all(color: kPrimary.withValues(alpha: 0.35), width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: kPrimary.withValues(alpha: 0.04),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Icon(Icons.add_rounded, color: kPrimary, size: 16),
                      ),
                    )
                  : Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: kPrimary.withValues(alpha: 0.35), width: 1.5),
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
                    child: Icon(Icons.remove_rounded, color: Colors.white, size: 12),
                  ),
                ),
                Text('$qty',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.white)),
                GestureDetector(
                  // The out-of-stock branch above only covers qty == 0, so
                  // without this an item already in the cart could keep topping
                  // up from a sold-out card.
                  onTap: widget.p.isOutOfStock ? null : () => _onAdd(ctx),
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    child: Icon(Icons.add_rounded,
                        color: widget.p.isOutOfStock ? Colors.white38 : Colors.white, size: 12),
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




