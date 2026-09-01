import 'package:flutter/material.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:flutter/services.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import '../../data/models/product_model.dart';
import '../widgets/product_tile.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/catalog_bloc.dart';
import '../bloc/catalog_state.dart';
import '../bloc/cart/cart_bloc.dart';
import '../bloc/cart/cart_event.dart';
import '../bloc/cart/cart_state.dart';
import '../../domain/entities/cart/cart_item_entity.dart';
import '../../../../core/guards/auth_guard.dart';
import '../../../../core/widgets/custom_button.dart';
import '../widgets/cart_widgets.dart';
import '../../../subscription/presentation/widgets/subscription_button.dart';
import '../helpers/cart_helpers.dart';
import 'product_detail_screen.dart';

// ══════════════════════════════════════════════════════════
//  PRODUCT DETAIL VIEW SCREEN — Blinkit / Zepto Style
// ══════════════════════════════════════════════════════════

class ProductDetailViewScreen extends StatefulWidget {
  final Product product;
  const ProductDetailViewScreen({required this.product, super.key});

  @override
  State<ProductDetailViewScreen> createState() =>
      _ProductDetailViewScreenState();
}

class _ProductDetailViewScreenState extends State<ProductDetailViewScreen>
    with SingleTickerProviderStateMixin {
  bool _detailsExpanded = false;
  int _currentImageIndex = 0;
  late final ScrollController _scrollController;
  late final PageController _pageController;
  late final AnimationController _slideCtrl;
  late final Animation<Offset> _slideAnim;
  late ProductVariant _selectedVariant;
  double _scrollOffset = 0.0;

  // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  List<Map<String, dynamic>> _reviews = [];
  bool _isLoadingReviews = true;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController()..addListener(_onScroll);
    _pageController = PageController();
    _slideCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.4),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _slideCtrl, curve: Curves.easeOutCubic));
    _slideCtrl.forward();
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

  void _shareProduct(Product p) {
    HapticFeedback.lightImpact();
    Clipboard.setData(
      ClipboardData(
        text: 'Check out ${p.name} on F2H Fresh: https://customer.f2hfresh.com',
      ),
    );
    F2HToast.success(context, 'Product link copied to clipboard!');
  }

  // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
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
      print('Error loading product reviews: $e');
      if (mounted) {
        setState(() {
          _isLoadingReviews = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _pageController.dispose();
    _slideCtrl.dispose();
    super.dispose();
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
        .where((prod) => prod.id != p.id && prod.category == p.category && !prod.isOutOfStock)
        .toList();
    if (related.isEmpty) {
      related.addAll(allProducts.where((prod) => prod.id != p.id && !prod.isOutOfStock).take(4));
    }

    final categoryProducts = allProducts
        .where((prod) => prod.category == p.category)
        .toList();
    categoryProducts.sort((a, b) => a.id.compareTo(b.id));
    if (categoryProducts.isEmpty) {
      categoryProducts.addAll(allProducts.take(4));
    }

    final discPct = _selectedVariant.originalPrice > 0
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

    final double scrollProgress = ((_scrollOffset - 80.0) / 100.0).clamp(0.0, 1.0);

    return Scaffold(
      backgroundColor: const Color(0xFFF2F2F2),
      body: Stack(
        children: [
          // ── UNIFIED SCROLL VIEW (Hero + Content all scroll together) ──
          SingleChildScrollView(
            controller: _scrollController,
            physics: const BouncingScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. HERO IMAGE AREA (Moves up on scroll)
                Container(
                  color: Colors.white,
                  child: SafeArea(
                    bottom: false,
                    child: SizedBox(
                      height: MediaQuery.of(context).size.height * 0.44,
                      child: Stack(
                        children: [
                          // Product image full width with sliding PageView
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
                                    debugPrint('[ImageCarousel] idx=$index url=$imgUrl');
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

                          // Floating top-left back button over hero
                          Positioned(
                            top: 8,
                            left: 12,
                            child: GestureDetector(
                              onTap: () => Navigator.pop(context),
                              child: Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: Colors.white,
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
                                  Icons.keyboard_arrow_down_rounded,
                                  color: kText,
                                  size: 22,
                                ),
                              ),
                            ),
                          ),

                          // Floating top-right cart button over hero
                          const Positioned(
                            top: 8,
                            right: 12,
                            child: CartBtn(),
                          ),

                          // Green subscription banner overlay on product image
                          if (_selectedVariant.subscriptionPrice != null &&
                              _selectedVariant.subscriptionPrice! > 0)
                            Positioned(
                              bottom: 14,
                              left: 16,
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
                                    duration: const Duration(milliseconds: 250),
                                    margin: const EdgeInsets.symmetric(
                                      horizontal: 4,
                                    ),
                                    width: _currentImageIndex == index ? 20 : 6,
                                    height: 6,
                                    decoration: BoxDecoration(
                                      color: _currentImageIndex == index
                                          ? const Color(0xFF0C831F)
                                          : Colors.grey.withOpacity(0.5),
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

                // 2. PRODUCT DETAILS CONTAINER (Scrolls along with Hero)
                Container(
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                  ),
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Product name
                      Text(
                        p.name,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: kText,
                          height: 1.2,
                        ),
                      ),
                      // Sub desc
                      Text(
                        '${p.vendor.isNotEmpty ? "${p.vendor} · " : ""}${_selectedVariant.formattedUnit}',
                        style: const TextStyle(
                          fontSize: 13,
                          color: kTextSub,
                        ),
                      ),
                      if (p.rating > 0) ...[
                        const SizedBox(height: 4),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.star_rounded,
                              size: 14,
                              color: Colors.amber,
                            ),
                            const SizedBox(width: 3),
                            Text(
                              '${p.rating.toStringAsFixed(1)}${p.reviews > 0 ? " (${p.reviews})" : ""}',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFFE65100),
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (_selectedVariant.isOutOfStock ||
                          _selectedVariant.isLowStock ||
                          (_selectedVariant.id == p.id &&
                              (p.isLowStock || p.isOutOfStock))) ...[
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFEBEE),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: const Color(0xFFEF5350),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.warning_amber_rounded,
                                size: 14,
                                color: Color(0xFFD32F2F),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                p.isOutOfStock
                                    ? 'OUT OF STOCK'
                                    : 'LOW STOCK — One-Time Order Unavailable',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFFD32F2F),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),

                      if (p.allVariants.isNotEmpty) ...[
                        const Text(
                          'Select Pack Size',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: kTextSub,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          height:
                              (p.allVariants.any(
                                    (v) =>
                                        v.subscriptionPrice != null &&
                                        v.subscriptionPrice! > 0,
                                  )
                                  ? 84.0
                                  : 64.0) +
                              (p.rating > 0 ? 18.0 : 0.0),
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: p.allVariants.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(width: 10),
                            itemBuilder: (context, index) {
                              final v = p.allVariants[index];
                              final isSel = v.id == _selectedVariant.id;
                              final isGone = v.isOutOfStock;
                              final hasSub =
                                  v.subscriptionPrice != null &&
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
                                  width: 128,
                                  decoration: BoxDecoration(
                                    color: isSel
                                        ? const Color(0xFFF4FBF7)
                                        : Colors.white,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: isSel
                                          ? const Color(0xFF0C831F)
                                          : const Color(0xFFE2E8F0),
                                      width: isSel ? 2.0 : 1.0,
                                    ),
                                    boxShadow: isSel
                                        ? [
                                            BoxShadow(
                                              color: const Color(
                                                0xFF0C831F,
                                              ).withOpacity(0.12),
                                              offset: const Offset(0, 3),
                                              blurRadius: 6,
                                            ),
                                          ]
                                        : null,
                                  ),
                                  child: Column(
                                    children: [
                                      Expanded(
                                        child: Padding(
                                          padding:
                                              const EdgeInsets.symmetric(
                                                horizontal: 8,
                                                vertical: 6,
                                              ),
                                          child: Column(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              Text(
                                                v.formattedUnit,
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: isSel
                                                      ? FontWeight.w900
                                                      : FontWeight.w700,
                                                  color: isSel
                                                      ? const Color(
                                                          0xFF0C831F,
                                                        )
                                                      : Colors.black,
                                                ),
                                                maxLines: 1,
                                                overflow:
                                                    TextOverflow.ellipsis,
                                              ),
                                              
                                              const SizedBox(height: 2),
                                              if (isGone)
                                                const Text(
                                                  'OUT OF STOCK',
                                                  style: TextStyle(
                                                    fontSize: 8.5,
                                                    fontWeight:
                                                        FontWeight.w900,
                                                    color: Color(0xFFD32F2F),
                                                  ),
                                                ),
                                              Text(
                                                '₹${v.price.toStringAsFixed(0)}',
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  fontWeight:
                                                      FontWeight.w900,
                                                  decoration: isGone
                                                      ? TextDecoration
                                                            .lineThrough
                                                      : null,
                                                  color: isGone
                                                      ? const Color(
                                                          0xFF9E9E9E,
                                                        )
                                                      : isSel
                                                      ? const Color(
                                                          0xFF0C831F,
                                                        )
                                                      : const Color(
                                                          0xFF2D3748,
                                                        ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                      if (hasSub)
                                        Container(
                                          width: double.infinity,
                                          padding:
                                              const EdgeInsets.symmetric(
                                                vertical: 4,
                                              ),
                                          decoration: const BoxDecoration(
                                            color: Color(0xFF0C831F),
                                            borderRadius:
                                                BorderRadius.vertical(
                                                  bottom: Radius.circular(
                                                    10,
                                                  ),
                                                ),
                                          ),
                                          child: Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              const Icon(
                                                Icons.sync_rounded,
                                                size: 10,
                                                color: Colors.white,
                                              ),
                                              const SizedBox(width: 3),
                                              Text(
                                                'Subscribe @ ₹${v.subscriptionPrice!.toStringAsFixed(0)}',
                                                style: const TextStyle(
                                                  fontSize: 10,
                                                  fontWeight:
                                                      FontWeight.w800,
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
                            },
                          ),
                        ),
                        const SizedBox(height: 16),
                      ] else
                        const SizedBox(height: 16),

                      // Discount tag if available
                      if (discPct > 0) ...[
                        Row(
                          children: [
                            Text(
                              'MRP ₹${_selectedVariant.originalPrice.toStringAsFixed(0)}',
                              style: const TextStyle(
                                fontSize: 13,
                                color: kTextSub,
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFE8F5E9),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '$discPct% OFF',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF2E7D32),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                      ],

                      // 1. ADD TO CART Button (Full Screen Width)
                      SizedBox(
                        width: double.infinity,
                        child: _buildAddButton(p),
                      ),

                      // 2. Subscription section (Full Screen Width Subscription Button)
                      if (p.hasSubscription) ...[
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: SubscriptionButton(
                            product: p,
                            selectedVariant: _selectedVariant,
                            isCompact: false,
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),

                      // Divider
                      const Divider(height: 1, color: Color(0xFFF0F0F0)),
                      const SizedBox(height: 12),

                      // Expandable details
                      GestureDetector(
                        onTap: () => setState(
                          () => _detailsExpanded = !_detailsExpanded,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _detailsExpanded
                                  ? 'Hide product details'
                                  : 'Show product details',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF0C831F),
                              ),
                            ),
                            const SizedBox(width: 4),
                            AnimatedRotation(
                              turns: _detailsExpanded ? 0.5 : 0,
                              duration: const Duration(milliseconds: 200),
                              child: const Icon(
                                Icons.keyboard_arrow_down_rounded,
                                color: Color(0xFF0C831F),
                                size: 18,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Expanded content
                      AnimatedCrossFade(
                        duration: const Duration(milliseconds: 300),
                        firstChild: const SizedBox.shrink(),
                        secondChild: Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
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
                                  : 'Sourced from locally vetted farms. Pasteurized under strict temperature controls to keep nutrients intact. FSSAI certified and tested for 75+ adulterants.',
                              style: const TextStyle(
                                fontSize: 12,
                                color: kTextSub,
                                height: 1.5,
                              ),
                            ),
                            if (p.highlights != null &&
                                p.highlights!.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              const Text(
                                'Highlights',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: kText,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                p.highlights!,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: kTextSub,
                                  height: 1.4,
                                ),
                              ),
                            ],
                            if (p.ingredients != null &&
                                p.ingredients!.isNotEmpty) ...[
                              const SizedBox(height: 10),
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
                                  fontSize: 12,
                                  color: kTextSub,
                                  height: 1.4,
                                ),
                              ),
                            ],
                            if (p.legalInfo != null &&
                                p.legalInfo!.isNotEmpty) ...[
                              const SizedBox(height: 10),
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
                                  fontSize: 12,
                                  color: kTextSub,
                                  height: 1.4,
                                ),
                              ),
                            ],
                            const SizedBox(height: 10),
                          ],
                        ),
                      ),
                      crossFadeState: _detailsExpanded
                          ? CrossFadeState.showSecond
                          : CrossFadeState.showFirst,
                    ),

                    const SizedBox(height: 12),
                    const Divider(height: 1, color: Color(0xFFF0F0F0)),
                    const SizedBox(height: 16),

                    // Trust badges strip
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _trustBadge(
                          Icons.cached_rounded,
                          '48 Hours',
                          'Refund*',
                        ),
                        Container(width: 1, height: 36, color: kBorderLt),
                        _trustBadge(
                          Icons.electric_bolt_rounded,
                          'Fast',
                          'Delivery',
                        ),
                        Container(width: 1, height: 36, color: kBorderLt),
                        _trustBadge(
                          Icons.headset_mic_outlined,
                          '24/7',
                          'Support',
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),
                    const SizedBox(height: 16),

                    // You may also like
                    if (related.isNotEmpty) ...[
                      const Text(
                        'You may also like',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: kText,
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        height: 235,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: related.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(width: 10),
                          itemBuilder: (_, i) => ProductCardH(related[i]),
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],

                    // Customer Reviews Feed Section
                    const Divider(height: 1, color: Color(0xFFF0F0F0)),
                    const SizedBox(height: 16),
                    const Text(
                      'Customer Reviews',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: kText,
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
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          vertical: 24,
                          horizontal: 16,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: const Color(0xFFF5F5F5),
                          ),
                        ),
                        child: const Column(
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
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: kTextMid,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'Be the first to review this product after purchase!',
                              style: TextStyle(
                                fontSize: 10,
                                color: kTextSub,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      )
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _reviews.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 8),
                        itemBuilder: (context, idx) {
                          final r = _reviews[idx];
                          final rating =
                              double.tryParse(
                                r['rating']?.toString() ?? '',
                              ) ??
                              0.0;
                          final name =
                              r['customer_name']?.toString() ??
                              'Verified Customer';
                          final feedback =
                              r['feedback']?.toString() ?? '';
                          final dateStr = r['created_at'] != null
                              ? DateTime.parse(
                                  r['created_at'].toString(),
                                ).toLocal().toString().split(' ')[0]
                              : '';

                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: const Color(0xFFF5F5F5),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      name,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        color: kText,
                                      ),
                                    ),
                                    const Spacer(),
                                    Text(
                                      dateStr,
                                      style: const TextStyle(
                                        fontSize: 10,
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
                                      fontSize: 12,
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
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ],
          ),
        ),

          // ── STICKY TOP APP BAR (Shown while scrolling) ──────
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: IgnorePointer(
              ignoring: scrollProgress < 0.1,
              child: Opacity(
                opacity: scrollProgress,
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.06 * scrollProgress),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                    border: Border(
                      bottom: BorderSide(
                        color: const Color(0xFFF1F5F9).withOpacity(scrollProgress),
                        width: 1,
                      ),
                    ),
                  ),
                  child: SafeArea(
                    bottom: false,
                    child: Container(
                      height: 52,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Row(
                        children: [
                          // 1. Back button (Circular <)
                          GestureDetector(
                            onTap: () => Navigator.pop(context),
                            child: Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.04),
                                    blurRadius: 4,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.keyboard_arrow_left_rounded,
                                color: kText,
                                size: 24,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),

                          // 2. Mini Thumbnail + Product Title + Price
                          Expanded(
                            child: Row(
                              children: [
                                Container(
                                  width: 38,
                                  height: 38,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: const Color(0xFFE2E8F0)),
                                  ),
                                  clipBehavior: Clip.antiAlias,
                                  child: buildProductImage(
                                    p.name,
                                    imageAsset: activeImages.isNotEmpty
                                        ? activeImages.first
                                        : p.imageAsset,
                                    fit: BoxFit.cover,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        p.name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w800,
                                          color: kText,
                                          height: 1.15,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Row(
                                        children: [
                                          Text(
                                            '₹${_selectedVariant.price.toStringAsFixed(0)}',
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w900,
                                              color: kText,
                                            ),
                                          ),
                                          if (_selectedVariant.originalPrice >
                                              _selectedVariant.price) ...[
                                            const SizedBox(width: 6),
                                            Text(
                                              '₹${_selectedVariant.originalPrice.toStringAsFixed(0)}',
                                              style: const TextStyle(
                                                fontSize: 11.5,
                                                color: kTextSub,
                                                decoration: TextDecoration.lineThrough,
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
                            ),
                          ),
                          const SizedBox(width: 8),

                          // 3. Right Action: Cart
                          const CartBtn(),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }



  Widget _buildAddButton(Product p) {
    return BlocBuilder<CartBloc, CartState>(
      builder: (ctx, state) {
        // Delivery slot windows and cutoffs are configured in the admin panel;
        // the helpers' built-in defaults sit hours away from them, so the
        // session values are threaded through every stamp below.
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

        // `p.*` describes the variant this page was opened with; once another
        // pack is picked, `_selectedVariant` is the one being bought. The card
        // flags stay in the expression only while the selection IS the card.
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
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text(
                isLowStockOrNoOneTime
                    ? (p.isOutOfStock || maxStock <= 0
                          ? 'OUT OF STOCK'
                          : 'LOW STOCK — ONE TIME ORDER UNAVAILABLE')
                    : 'ADD TO CART — ₹${_selectedVariant.price.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
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
            borderRadius: BorderRadius.circular(10),
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

  Widget _trustBadge(IconData icon, String main, String sub) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: kText, size: 22),
        const SizedBox(height: 4),
        Text(
          main,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: kText,
          ),
        ),
        Text(sub, style: const TextStyle(fontSize: 10, color: kTextSub)),
      ],
    );
  }


}
