// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : product_detail_view_screen.dart
// Description : Premium quick-commerce product view with animated sticky
//               header (mini thumbnail, title, price), unified scrolling,
//               pack size options, feature badges, reviews, and stock guards.
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:f2h_customer/core/guards/auth_guard.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/widgets/custom_button.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_event.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_state.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/catalog_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/catalog_state.dart';
import 'package:f2h_customer/features/catalog/presentation/helpers/cart_helpers.dart';
import 'package:f2h_customer/features/catalog/presentation/widgets/cart_widgets.dart';
import 'package:f2h_customer/features/catalog/presentation/widgets/product_tile.dart';
import 'package:f2h_customer/features/subscription/presentation/widgets/subscription_button.dart';
import 'package:f2h_customer/theme/app_colors.dart';

// ══════════════════════════════════════════════════════════
//  PRODUCT DETAIL VIEW SCREEN — Quick Commerce Style
// ══════════════════════════════════════════════════════════

class ProductDetailViewScreen extends StatefulWidget {
  final Product product;
  const ProductDetailViewScreen({required this.product, super.key});

  @override
  State<ProductDetailViewScreen> createState() =>
      _ProductDetailViewScreenState();
}

class _ProductDetailViewScreenState extends State<ProductDetailViewScreen> {
  late final ScrollController _scrollController;
  late final PageController _pageController;
  double _scrollOffset = 0.0;
  int _currentImageIndex = 0;
  bool _highlightsExpanded = true;
  bool _detailsExpanded = false;
  late ProductVariant _selectedVariant;

  List<Map<String, dynamic>> _reviews = [];
  bool _isLoadingReviews = true;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController()..addListener(_onScroll);
    _pageController = PageController();
    _loadReviews();

    final p = widget.product;
    final vars = p.allVariants;
    _selectedVariant = vars.firstWhere(
      (v) => v.label == p.unit || v.id == p.id,
      orElse: () => vars.isNotEmpty
          ? vars.first
          : ProductVariant(
              id: p.id,
              label: p.unit,
              price: p.price,
              originalPrice: p.originalPrice,
              subscriptionPrice: p.subscriptionPrice,
              availableQuantity: p.availableQuantity,
            ),
    );
  }

  void _onScroll() {
    if (_scrollController.hasClients) {
      final offset = _scrollController.offset;
      if ((offset - _scrollOffset).abs() > 2) {
        setState(() {
          _scrollOffset = offset;
        });
      }
    }
  }

  Future<void> _loadReviews() async {
    try {
      final repo = context.read<CatalogBloc>().catalogRepository;
      final list = await repo.getProductReviews(widget.product.id);
      if (mounted) {
        setState(() {
          _reviews = list;
          _isLoadingReviews = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading product reviews: $e');
      if (mounted) {
        setState(() {
          _isLoadingReviews = false;
        });
      }
    }
  }

  void _shareProduct(Product p) {
    HapticFeedback.lightImpact();
    Clipboard.setData(
      ClipboardData(
        text: 'Check out ${p.name} on F2H Fresh: https://customer.f2hfresh.com',
      ),
    );
    F2HToast.success(context, 'Product link copied to clipboard!');
  }

  void _showProductInfoSheet(Product p) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Icon(Icons.verified_outlined, color: kPrimary, size: 22),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    p.name,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: kText,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              (p.description != null && p.description!.isNotEmpty)
                  ? p.description!
                  : 'Sourced from locally vetted farms. Checked for 75+ quality standards, 100% farm fresh with zero preservatives.',
              style: const TextStyle(fontSize: 13, color: kTextSub, height: 1.5),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  Widget _buildHighlightRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 110,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: kTextSub,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              color: kText,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final state = context.read<CatalogBloc>().state;
    List<Product> allProducts = [];
    if (state is CatalogLoaded) {
      allProducts = state.products;
    }

    final related = allProducts
        .where((prod) =>
            prod.id != p.id &&
            prod.category == p.category &&
            !prod.isOutOfStock)
        .toList();
    if (related.isEmpty) {
      related.addAll(
        allProducts
            .where((prod) => prod.id != p.id && !prod.isOutOfStock)
            .take(6),
      );
    }

    final discAmount = _selectedVariant.originalPrice > _selectedVariant.price
        ? (_selectedVariant.originalPrice - _selectedVariant.price).round()
        : 0;

    final discPct = _selectedVariant.originalPrice > 0 &&
            _selectedVariant.originalPrice > _selectedVariant.price
        ? (((_selectedVariant.originalPrice - _selectedVariant.price) /
                    _selectedVariant.originalPrice) *
                100)
            .round()
        : 0;

    final activeImages = _selectedVariant.images.isNotEmpty
        ? _selectedVariant.images
        : (_selectedVariant.imagePath != null &&
                _selectedVariant.imagePath!.isNotEmpty
            ? [_selectedVariant.imagePath!]
            : (p.images.isNotEmpty
                ? p.images
                : (p.imageAsset != null && p.imageAsset!.isNotEmpty
                    ? [p.imageAsset!]
                    : <String>[])));

    final heroHeight = MediaQuery.of(context).size.height * 0.42;

    return Scaffold(
      backgroundColor: const Color(0xFFF3F5F7),
      body: Stack(
        children: [
          // ── MAIN UNIFIED SCROLL VIEW ──────────────────────
          SingleChildScrollView(
            controller: _scrollController,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.only(bottom: 96),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Hero Image Area with Carousel
                Container(
                  color: Colors.white,
                  child: SafeArea(
                    bottom: false,
                    child: SizedBox(
                      height: heroHeight,
                      child: Stack(
                        children: [
                          activeImages.length > 1
                              ? PageView.builder(
                                  controller: _pageController,
                                  itemCount: activeImages.length,
                                  onPageChanged: (index) {
                                    setState(() {
                                      _currentImageIndex = index;
                                    });
                                  },
                                  itemBuilder: (context, index) {
                                    final imgUrl = activeImages[index];
                                    return Hero(
                                      tag: index == 0
                                          ? 'product-v-${p.id}'
                                          : 'product-v-${p.id}-$index',
                                      child: SizedBox(
                                        width: double.infinity,
                                        height: double.infinity,
                                        child: buildProductImage(
                                          p.name,
                                          imageAsset: imgUrl,
                                          fit: BoxFit.cover,
                                        ),
                                      ),
                                    );
                                  },
                                )
                              : Hero(
                                  tag: 'product-v-${p.id}',
                                  child: SizedBox(
                                    width: double.infinity,
                                    height: double.infinity,
                                    child: buildProductImage(
                                      p.name,
                                      imageAsset: activeImages.isNotEmpty
                                          ? activeImages.first
                                          : p.imageAsset,
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                ),

                          // Info button (i) on bottom-left of hero image
                          Positioned(
                            bottom: 12,
                            left: 14,
                            child: GestureDetector(
                              onTap: () => _showProductInfoSheet(p),
                              child: Container(
                                width: 34,
                                height: 34,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.08),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: const Icon(
                                  Icons.info_outline_rounded,
                                  color: Color(0xFF334155),
                                  size: 18,
                                ),
                              ),
                            ),
                          ),

                          // Green subscription banner overlay on product image
                          if (_selectedVariant.subscriptionPrice != null &&
                              _selectedVariant.subscriptionPrice! > 0)
                            Positioned(
                              bottom: 12,
                              right: 14,
                              child: SubscriptionPriceBadge.full(
                                subscriptionPrice:
                                    _selectedVariant.subscriptionPrice!,
                                normalPrice: _selectedVariant.price,
                              ),
                            ),

                          // Dot indicators for multiple images
                          if (activeImages.length > 1)
                            Positioned(
                              bottom: 14,
                              left: 0,
                              right: 0,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: List.generate(
                                  activeImages.length,
                                  (index) => AnimatedContainer(
                                    duration: const Duration(milliseconds: 200),
                                    margin: const EdgeInsets.symmetric(
                                      horizontal: 3,
                                    ),
                                    width: _currentImageIndex == index ? 16 : 6,
                                    height: 6,
                                    decoration: BoxDecoration(
                                      color: _currentImageIndex == index
                                          ? kPrimary
                                          : const Color(0xFFCBD5E1),
                                      borderRadius: BorderRadius.circular(3),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 10),

                // 2. Primary Product Info Card
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 14),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFF0F3F6)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.02),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Delivery timing pill (⚡ 10 mins)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.bolt_rounded,
                              size: 14,
                              color: Color(0xFF475569),
                            ),
                            SizedBox(width: 4),
                            Text(
                              '10 mins',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF475569),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Product Title
                      Text(
                        p.name,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: kText,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 4),

                      // Net Quantity
                      Text(
                        'Net quantity: ${_selectedVariant.formattedUnit}',
                        style: const TextStyle(
                          fontSize: 13,
                          color: kTextSub,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Pricing Row (Green Badge + MRP + Discount)
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: kPrimary,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '₹${_selectedVariant.price.toStringAsFixed(0)}',
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          if (_selectedVariant.originalPrice >
                              _selectedVariant.price) ...[
                            Text(
                              'MRP ₹${_selectedVariant.originalPrice.toStringAsFixed(0)}',
                              style: const TextStyle(
                                fontSize: 13,
                                color: kTextSub,
                                decoration: TextDecoration.lineThrough,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Text(
                              '(incl. of all taxes)',
                              style: TextStyle(
                                fontSize: 11,
                                color: kTextSub,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '₹$discAmount OFF',
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w900,
                                color: kPrimary,
                              ),
                            ),
                          ] else ...[
                            const Text(
                              '(incl. of all taxes)',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: kTextSub,
                              ),
                            ),
                          ],
                        ],
                      ),

                      // Stock status alert
                      if (_selectedVariant.isOutOfStock ||
                          _selectedVariant.isLowStock ||
                          _selectedVariant.maxStock <= 0 ||
                          (_selectedVariant.id == p.id &&
                              (p.isLowStock || p.isOutOfStock))) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFEBEE),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: const Color(0xFFEF5350),
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.warning_amber_rounded,
                                size: 16,
                                color: Color(0xFFD32F2F),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  (p.isOutOfStock || _selectedVariant.maxStock <= 0)
                                      ? 'OUT OF STOCK'
                                      : 'LOW STOCK — One-Time Order Unavailable',
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFFD32F2F),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      // Pack size selection
                      if (p.allVariants.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        const Text(
                          'Select Pack Size',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: kTextSub,
                            letterSpacing: 0.3,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: p.allVariants.map((v) {
                            final isSel = v.id == _selectedVariant.id;
                            final isGone = v.isOutOfStock || v.maxStock <= 0;
                            final hasSub = v.subscriptionPrice != null &&
                                v.subscriptionPrice! > 0;
                            return GestureDetector(
                              onTap: () {
                                setState(() {
                                  _selectedVariant = v;
                                  _currentImageIndex = 0;
                                  if (_pageController.hasClients) {
                                    _pageController.jumpToPage(0);
                                  }
                                });
                              },
                              child: Container(
                                width: 140,
                                decoration: BoxDecoration(
                                  color: isSel
                                      ? const Color(0xFFF4FBF7)
                                      : Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isSel
                                        ? kPrimary
                                        : const Color(0xFFE2E8F0),
                                    width: isSel ? 2.0 : 1.0,
                                  ),
                                  boxShadow: isSel
                                      ? [
                                          BoxShadow(
                                            color: kPrimary.withOpacity(0.12),
                                            offset: const Offset(0, 3),
                                            blurRadius: 6,
                                          ),
                                        ]
                                      : null,
                                ),
                                child: Column(
                                  children: [
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 10, vertical: 8),
                                      child: Column(
                                        children: [
                                          Text(
                                            v.formattedUnit,
                                            style: TextStyle(
                                              fontSize: 13,
                                              fontWeight: isSel
                                                  ? FontWeight.w900
                                                  : FontWeight.w700,
                                              color: isSel ? kPrimary : kText,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 3),
                                          if (isGone)
                                            const Text(
                                              'OUT OF STOCK',
                                              style: TextStyle(
                                                fontSize: 9,
                                                fontWeight: FontWeight.w900,
                                                color: Color(0xFFD32F2F),
                                              ),
                                            ),
                                          Text(
                                            '₹${v.price.toStringAsFixed(0)}',
                                            style: TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w900,
                                              decoration: isGone
                                                  ? TextDecoration.lineThrough
                                                  : null,
                                              color: isGone
                                                  ? kMuted
                                                  : (isSel ? kPrimary : kText),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    if (hasSub)
                                      Container(
                                        width: double.infinity,
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 4),
                                        decoration: const BoxDecoration(
                                          color: kPrimary,
                                          borderRadius: BorderRadius.vertical(
                                              bottom: Radius.circular(10)),
                                        ),
                                        child: Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            const Icon(Icons.sync_rounded,
                                                size: 10, color: Colors.white),
                                            const SizedBox(width: 3),
                                            Text(
                                              'Subscribe @ ₹${v.subscriptionPrice!.toStringAsFixed(0)}',
                                              style: const TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w800,
                                                color: Colors.white,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],

                      // Subscription banner / button
                      if (p.hasSubscription) ...[
                        const SizedBox(height: 16),
                        SubscriptionButton(
                          product: p,
                          selectedVariant: _selectedVariant,
                          isCompact: false,
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                // 3. Side-by-Side Trust Cards (Screenshot 1)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            vertical: 16,
                            horizontal: 12,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFF0F3F6)),
                          ),
                          child: Column(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: const Color(0xFFE2E8F0),
                                  ),
                                ),
                                child: const Icon(
                                  Icons.assignment_return_outlined,
                                  color: Color(0xFF475569),
                                  size: 22,
                                ),
                              ),
                              const SizedBox(height: 10),
                              const Text(
                                'No return or replacement',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: kText,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            vertical: 16,
                            horizontal: 12,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFF0F3F6)),
                          ),
                          child: Column(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: const Color(0xFFE2E8F0),
                                  ),
                                ),
                                child: const Icon(
                                  Icons.electric_bolt_rounded,
                                  color: Color(0xFF475569),
                                  size: 22,
                                ),
                              ),
                              const SizedBox(height: 10),
                              const Text(
                                'Fast Delivery',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: kText,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                // 4. Highlights Card (Screenshot 1)
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 14),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFF0F3F6)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      GestureDetector(
                        onTap: () => setState(
                          () => _highlightsExpanded = !_highlightsExpanded,
                        ),
                        behavior: HitTestBehavior.opaque,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Highlights',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: kText,
                              ),
                            ),
                            Icon(
                              _highlightsExpanded
                                  ? Icons.keyboard_arrow_up_rounded
                                  : Icons.keyboard_arrow_down_rounded,
                              color: kTextSub,
                              size: 22,
                            ),
                          ],
                        ),
                      ),
                      if (_highlightsExpanded) ...[
                        const SizedBox(height: 14),
                        _buildHighlightRow(
                          'Product Type',
                          p.category.isNotEmpty ? p.category : 'Fresh Produce',
                        ),
                        const SizedBox(height: 10),
                        _buildHighlightRow(
                          'Top Nutrients',
                          (p.highlights != null && p.highlights!.isNotEmpty)
                              ? p.highlights!
                              : 'Rich in Essential Nutrients & Freshness',
                        ),
                        if (p.vendor.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          _buildHighlightRow('Source', p.vendor),
                        ],
                        const SizedBox(height: 14),

                        // View more / less details toggle button
                        Center(
                          child: TextButton.icon(
                            onPressed: () => setState(
                              () => _detailsExpanded = !_detailsExpanded,
                            ),
                            icon: Text(
                              _detailsExpanded ? 'View less' : 'View more',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: kPrimary,
                              ),
                            ),
                            label: Icon(
                              _detailsExpanded
                                  ? Icons.keyboard_arrow_up_rounded
                                  : Icons.keyboard_arrow_down_rounded,
                              size: 18,
                              color: kPrimary,
                            ),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 6,
                              ),
                              backgroundColor: const Color(0xFFF4FBF7),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                            ),
                          ),
                        ),

                        if (_detailsExpanded) ...[
                          const SizedBox(height: 14),
                          const Divider(height: 1, color: Color(0xFFF0F3F6)),
                          const SizedBox(height: 12),
                          const Text(
                            'About this product',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: kText,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            (p.description != null &&
                                    p.description!.isNotEmpty)
                                ? p.description!
                                : 'Sourced from locally vetted farms. Checked for 75+ quality standards, hygienic packing, zero harmful chemicals.',
                            style: const TextStyle(
                              fontSize: 12.5,
                              color: kTextSub,
                              height: 1.5,
                            ),
                          ),
                          if (p.ingredients != null &&
                              p.ingredients!.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            const Text(
                              'Ingredients',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: kText,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              p.ingredients!,
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: kTextSub,
                                height: 1.4,
                              ),
                            ),
                          ],
                          if (p.legalInfo != null &&
                              p.legalInfo!.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            const Text(
                              'Legal Information',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: kText,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              p.legalInfo!,
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: kTextSub,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ],
                      ],
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // 5. You may also like section
                if (related.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: const Text(
                      'You may also like',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: kText,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 245,
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      scrollDirection: Axis.horizontal,
                      itemCount: related.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 12),
                      itemBuilder: (_, i) => ProductCardH(related[i]),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // 6. Customer Reviews section
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Customer Reviews',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: kText,
                        ),
                      ),
                      if (p.rating > 0)
                        Row(
                          children: [
                            const Icon(
                              Icons.star_rounded,
                              size: 16,
                              color: Colors.amber,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${p.rating.toStringAsFixed(1)} / 5.0',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: kText,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                if (_isLoadingReviews)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(
                        color: kPrimary,
                        strokeWidth: 2,
                      ),
                    ),
                  )
                else if (_reviews.isEmpty)
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 14),
                    padding: const EdgeInsets.symmetric(
                      vertical: 24,
                      horizontal: 16,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFF0F3F6)),
                    ),
                    child: const Center(
                      child: Column(
                        children: [
                          Icon(
                            Icons.rate_review_outlined,
                            color: kTextSub,
                            size: 28,
                          ),
                          SizedBox(height: 8),
                          Text(
                            'No reviews yet',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: kTextMid,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Be the first to review this product after purchase!',
                            style: TextStyle(fontSize: 11, color: kTextSub),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    itemCount: _reviews.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, idx) {
                      final r = _reviews[idx];
                      final rating =
                          double.tryParse(r['rating']?.toString() ?? '') ?? 0.0;
                      final name =
                          r['customer_name']?.toString() ?? 'Verified Customer';
                      final feedback = r['feedback']?.toString() ?? '';
                      final dateStr = r['created_at'] != null
                          ? DateTime.parse(r['created_at'].toString())
                              .toLocal()
                              .toString()
                              .split(' ')[0]
                          : '';

                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFF0F3F6)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  name,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    color: kText,
                                  ),
                                ),
                                const Spacer(),
                                Text(
                                  dateStr,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: kTextSub,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: List.generate(5, (starIdx) {
                                return Icon(
                                  starIdx < rating
                                      ? Icons.star_rounded
                                      : Icons.star_border_rounded,
                                  color: Colors.amber,
                                  size: 16,
                                );
                              }),
                            ),
                            if (feedback.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                feedback,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  color: kTextMid,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                const SizedBox(height: 20),
              ],
            ),
          ),

          // ── STICKY TOP APP BAR (Appears on Scroll) ───────────
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              decoration: BoxDecoration(
                color: _scrollOffset > 60 ? Colors.white : Colors.transparent,
                boxShadow: _scrollOffset > 60
                    ? [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.06),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
              ),
              child: SafeArea(
                bottom: false,
                child: Container(
                  height: 56,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: Row(
                    children: [
                      // Back Button
                      GestureDetector(
                        onTap: () => Navigator.pop(context),
                        child: Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: _scrollOffset > 60
                                ? const Color(0xFFF1F5F9)
                                : Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.08),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.arrow_back_ios_new_rounded,
                            color: kText,
                            size: 16,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),

                      // Scrolled mini product info (Image + Name + Price)
                      Expanded(
                        child: AnimatedOpacity(
                          duration: const Duration(milliseconds: 200),
                          opacity: _scrollOffset > 60 ? 1.0 : 0.0,
                          child: _scrollOffset > 60
                              ? Row(
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: SizedBox(
                                        width: 38,
                                        height: 38,
                                        child: buildProductImage(
                                          p.name,
                                          imageAsset: activeImages.isNotEmpty
                                              ? activeImages.first
                                              : p.imageAsset,
                                          fit: BoxFit.cover,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Text(
                                            p.name,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w800,
                                              color: kText,
                                            ),
                                          ),
                                          Row(
                                            children: [
                                              Text(
                                                '₹${_selectedVariant.price.toStringAsFixed(0)}',
                                                style: const TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w900,
                                                  color: kPrimary,
                                                ),
                                              ),
                                              if (_selectedVariant.originalPrice >
                                                  _selectedVariant.price) ...[
                                                const SizedBox(width: 6),
                                                Text(
                                                  '₹${_selectedVariant.originalPrice.toStringAsFixed(0)}',
                                                  style: const TextStyle(
                                                    fontSize: 11,
                                                    color: kMuted,
                                                    decoration: TextDecoration
                                                        .lineThrough,
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                )
                              : const SizedBox.shrink(),
                        ),
                      ),

                      // Share Button
                      GestureDetector(
                        onTap: () => _shareProduct(p),
                        child: Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: _scrollOffset > 60
                                ? const Color(0xFFF1F5F9)
                                : Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.08),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.share_outlined,
                            color: kText,
                            size: 18,
                          ),
                        ),
                      ),
                      // Cart Button with badge
                      const SizedBox(width: 2),
                      CartBtn(),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // ── FIXED BOTTOM ACTION BAR ───────────────────────
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: EdgeInsets.fromLTRB(
                16,
                10,
                16,
                MediaQuery.of(context).padding.bottom > 0
                    ? MediaQuery.of(context).padding.bottom
                    : 12,
              ),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.06),
                    blurRadius: 10,
                    offset: const Offset(0, -3),
                  ),
                ],
              ),
              child: _buildAddButton(p),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAddButton(Product p) {
    return BlocBuilder<CartBloc, CartState>(
      builder: (ctx, state) {
        final slotTimings = slotTimingsOf(ctx);
        final now = DateTime.now();
        int qty = 0;
        if (state is CartLoadedState) {
          qty = state.items
              .where(
                (item) =>
                    item.productId == p.id &&
                    item.variantId == _selectedVariant.id,
              )
              .fold(0, (sum, item) => sum + (item.quantity ?? 1));
        }

        final maxStock = _selectedVariant.maxStock;

        void dispatchAdd() {
          if (qty + 1 > maxStock) {
            F2HToast.error(context, 'Only $maxStock unit(s) available in stock');
            return;
          }
          final variantId = _selectedVariant.id;
          final variantLabel = _selectedVariant.label;

          final cartItem = CartItemEntity(
            productId: p.id,
            variantId: variantId,
            productName: p.name,
            variantName: variantLabel,
            unitPrice: _selectedVariant.price,
            purchaseType: 'onetime',
            quantity: 1,
            schedules: null,
            deliveryDate:
                getDefaultDeliveryDate(now, slotTimings).toString().split(' ')[0],
            deliverySlot:
                getDefaultSlot(getDefaultDeliveryDate(now, slotTimings), now, slotTimings),
            imageAsset: p.imageAsset,
            isSubscribable: p.isSubscribable,
            isOneTime: p.isOneTime,
            subscriptionPrice: _selectedVariant.subscriptionPrice,
          );
          ctx.read<CartBloc>().add(AddToCartEvent(cartItem));
        }

        void dispatchRemove() {
          final items = ctx.read<CartBloc>().currentItems;
          CartItemEntity? matchedItem;
          try {
            matchedItem = items.firstWhere(
              (item) =>
                  item.productId == p.id &&
                  item.variantId == _selectedVariant.id,
            );
          } catch (_) {}

          final purchaseType =
              matchedItem?.purchaseType ??
              (p.isSubscribable ? 'subscription' : 'onetime');
          final isSub = purchaseType == 'subscription';
          final variantId = _selectedVariant.id;
          final variantLabel = _selectedVariant.label;

          final cartItem = CartItemEntity(
            productId: p.id,
            variantId: variantId,
            productName: p.name,
            variantName: variantLabel,
            unitPrice: _selectedVariant.price,
            purchaseType: purchaseType,
            quantity: !isSub ? 1 : null,
            schedules: isSub
                ? [SubscriptionSchedule(day: 0, mQuantity: 1, eQuantity: 0)]
                : null,
            deliveryDate: !isSub
                ? getDefaultDeliveryDate(now, slotTimings).toString().split(' ')[0]
                : null,
            deliverySlot: !isSub
                ? getDefaultSlot(getDefaultDeliveryDate(now, slotTimings), now, slotTimings)
                : null,
            imageAsset: p.imageAsset,
            isSubscribable: p.isSubscribable,
            isOneTime: p.isOneTime,
            subscriptionPrice: _selectedVariant.subscriptionPrice,
          );
          ctx.read<CartBloc>().add(RemoveFromCartEvent(cartItem));
        }

        final isSelfVariant = _selectedVariant.id == p.id;
        final isLowStockOrNoOneTime =
            !p.isOneTime ||
            _selectedVariant.isOutOfStock ||
            _selectedVariant.isLowStock ||
            maxStock <= 0 ||
            (isSelfVariant && (p.isLowStock || p.isOutOfStock));

        if (qty == 0) {
          return SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: isLowStockOrNoOneTime
                  ? null
                  : () {
                      HapticFeedback.lightImpact();
                      ctx.runWithAuth(() => dispatchAdd());
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: isLowStockOrNoOneTime
                    ? const Color(0xFFE0E0E0)
                    : kPrimary,
                foregroundColor: isLowStockOrNoOneTime
                    ? const Color(0xFF757575)
                    : Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                isLowStockOrNoOneTime
                    ? (p.isOutOfStock || maxStock <= 0
                          ? 'OUT OF STOCK'
                          : 'LOW STOCK — ONE TIME ORDER UNAVAILABLE')
                    : 'ADD TO CART — ₹${_selectedVariant.price.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          );
        }

        final isAtMaxStock = qty >= maxStock;
        return Container(
          width: double.infinity,
          height: 48,
          decoration: BoxDecoration(
            color: kPrimary,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: const Icon(Icons.remove, color: Colors.white, size: 22),
                onPressed: () {
                  HapticFeedback.lightImpact();
                  ctx.runWithAuth(() => dispatchRemove());
                },
                padding: const EdgeInsets.symmetric(horizontal: 16),
              ),
              Text(
                'ADDED ($qty) — ₹${(_selectedVariant.price * qty).toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
              IconButton(
                icon: Icon(Icons.add,
                    color: (isLowStockOrNoOneTime || isAtMaxStock) ? Colors.white38 : Colors.white, size: 22),
                onPressed: (isLowStockOrNoOneTime || isAtMaxStock)
                    ? () {
                        if (isAtMaxStock) {
                          F2HToast.error(context, 'Only $maxStock unit(s) available in stock');
                        }
                      }
                    : () {
                        HapticFeedback.lightImpact();
                        ctx.runWithAuth(() => dispatchAdd());
                      },
                padding: const EdgeInsets.symmetric(horizontal: 16),
              ),
            ],
          ),
        );
      },
    );
  }
}
