import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../app.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import '../../data/models/product_model.dart';
import '../widgets/product_tile.dart';
import 'cart_screen.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/catalog_bloc.dart';
import '../bloc/catalog_state.dart';
import '../bloc/catalog_event.dart';
import '../bloc/cart/cart_bloc.dart';
import '../bloc/cart/cart_state.dart';
import '../../../../core/widgets/custom_button.dart';

// ══════════════════════════════════════════════════════════
//  BROWSE SCREEN — Blinkit-style top chips + sidebar + grid
// ══════════════════════════════════════════════════════════

class BrowseScreen extends StatefulWidget {
  final String? initialCategory;
  final bool isNavVisible;
  const BrowseScreen({
    this.initialCategory,
    this.isNavVisible = true,
    super.key,
  });

  @override
  State<BrowseScreen> createState() => _BrowseState();
}

class _BrowseState extends State<BrowseScreen> {
  late String _cat;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  final bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _cat = widget.initialCategory ?? 'All';
    _searchController.addListener(() {
      setState(() => _searchQuery = _searchController.text);
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final state = context.read<CatalogBloc>().state;
      if (state is CatalogLoaded) {
        final cat = state.categories.firstWhere(
          (c) => c['name'] == _cat,
          orElse: () => <String, dynamic>{},
        );
        final catId = cat['category_id']?.toString() ?? 'All';
        context.read<CatalogBloc>().add(LoadProductsByCategory(catId));
      } else {
        // Fallback/bootstrap loading if catalog is not fully loaded yet
        context.read<CatalogBloc>().add(LoadProductsByCategory('All'));
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _selectCat(String name, String id) {
    if (_cat == name) return;
    HapticFeedback.selectionClick();
    setState(() {
      _cat = name;
    });

    // Dispatch bloc event to load products from backend
    context.read<CatalogBloc>().add(LoadProductsByCategory(id));
  }

  List<Product> _getFilteredProducts(List<Product> sourceProducts) {
    final list = sourceProducts;
    return list.where((p) {
      final q = _searchQuery.toLowerCase();
      final matchSearch =
          q.isEmpty ||
          p.name.toLowerCase().contains(q) ||
          p.vendor.toLowerCase().contains(q) ||
          p.category.toLowerCase().contains(q);
      return matchSearch;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final pending = AppShell.of(context)?.consumePendingCategory();
    if (pending != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final state = context.read<CatalogBloc>().state;
        String catId = 'All';
        if (state is CatalogLoaded) {
          final cat = state.categories.firstWhere(
            (c) => c['name'] == pending,
            orElse: () => <String, dynamic>{},
          );
          catId = cat['category_id']?.toString() ?? 'All';
        }
        _selectCat(pending, catId);
      });
    }
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shadowColor: const Color(0x14000000),
        leadingWidth: Navigator.canPop(context) ? 48 : 0,
        leading: Navigator.canPop(context)
            ? IconButton(
                icon: const Icon(
                  Icons.arrow_back_ios_new_rounded,
                  size: 18,
                  color: kText,
                ),
                onPressed: () => Navigator.pop(context),
              )
            : null,
        title: Padding(
          padding: EdgeInsets.only(
            left: Navigator.canPop(context) ? 0 : 16,
            right: 12,
          ),
          child: Container(
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFFFAFBF9),
              borderRadius: BorderRadius.circular(30),
              border: Border.all(color: kPrimary.withValues(alpha: 0.12), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: kPrimary.withValues(alpha: 0.03),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Row(
              children: [
                const SizedBox(width: 12),
                const Icon(Icons.search_rounded, color: kPrimary, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: kText,
                    ),
                    onTapOutside: (_) => FocusScope.of(context).unfocus(),
                    decoration: const InputDecoration(
                      hintText: 'Search milk, ghee, paneer…',
                      hintStyle: TextStyle(color: kTextSub, fontSize: 13.5),
                      border: InputBorder.none,
                      isDense: true,
                    ),
                  ),
                ),
                if (_searchQuery.isNotEmpty)
                  GestureDetector(
                    onTap: () => _searchController.clear(),
                    child: const Padding(
                      padding: EdgeInsets.all(8),
                      child: Icon(Icons.close_rounded, size: 16, color: kTextSub),
                    ),
                  ),
              ],
            ),
          ),
        ),
        titleSpacing: 0,
        actions: const [
          CartBtn(),
          SizedBox(width: 16),
        ],
      ),
      body: Stack(
        children: [
          Row(
            children: [
              _buildSidebar(),
              Expanded(
                child: BlocBuilder<CatalogBloc, CatalogState>(
                  builder: (context, state) {
                    List<Product> products = [];
                    if (state is CatalogLoaded) {
                      products = state.filteredProducts;
                    }
                    final filtered = _getFilteredProducts(products);

                    final isLoading =
                        (state is CatalogLoading) ||
                        (state is CatalogLoaded && state.isFiltering);

                    if (isLoading) {
                      return GridView.builder(
                        padding: const EdgeInsets.fromLTRB(8, 10, 8, 90),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 1,
                              mainAxisSpacing: 10,
                              crossAxisSpacing: 10,
                              childAspectRatio: 2.3,
                            ),
                        itemCount: 6,
                        itemBuilder: (_, _) => const _SkeletonCard(),
                      );
                    }

                    if (filtered.isEmpty) {
                      return Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.search_off_outlined,
                              size: 40,
                              color: kMuted,
                            ),
                            const SizedBox(height: 10),
                            Text(
                              _searchQuery.isEmpty
                                  ? 'No products in this category'
                                  : 'No results for "$_searchQuery"',
                              style: const TextStyle(
                                color: kMuted,
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      );
                    }

                    return GridView.builder(
                      padding: const EdgeInsets.fromLTRB(8, 10, 8, 90),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 1,
                            mainAxisSpacing: 10,
                            crossAxisSpacing: 10,
                            childAspectRatio: 2.3,
                          ),
                      itemCount: filtered.length,
                      itemBuilder: (_, i) => RepaintBoundary(
                        child: ProductCardV(filtered[i], isBrowse: true),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── SIDEBAR ─────────────────────────────────────────────────
  Widget _buildSidebar() {
    final isLoadingState = context.select(
      (CatalogBloc bloc) => bloc.state is CatalogLoading,
    );
    final categories = context.select((CatalogBloc bloc) {
      final state = bloc.state;
      if (state is CatalogLoaded) {
        return [
          {'name': 'All', 'image_path': null},
          ...state.categories,
        ];
      }
      return <Map<String, dynamic>>[];
    });

    return Container(
      width: 86,
      decoration: const BoxDecoration(
        color: Color(0xFFF4F6F8),
      ),
      child: isLoadingState
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : ListView.builder(
              padding: const EdgeInsets.only(top: 6, bottom: 90),
              itemCount: categories.length,
              itemBuilder: (context, i) {
                final cat = categories[i];
                final catName = cat['name'] as String? ?? '';
                final catId = cat['category_id']?.toString() ?? 'All';
                final isSelected = catName == _cat;
                return _SidebarItem(
                  cat: cat,
                  isSelected: isSelected,
                  onTap: () => _selectCat(catName, catId),
                );
              },
            ),
    );
  }

  // ── CART BADGE ───────────────────────────────────────────────
  Widget _buildFloatingCartBadge() {
    return BlocBuilder<CartBloc, CartState>(
      builder: (context, state) {
        final items = context.read<CartBloc>().currentItems;
        int total = 0;
        total = items.fold(0, (sum, item) {
          if (item.purchaseType == 'subscription') {
            final schedSum = item.schedules?.fold(0, (s, sched) => s + sched.mQuantity + sched.eQuantity) ?? 0;
            return sum + (schedSum > 0 ? schedSum : 1);
          }
          return sum + (item.quantity ?? 1);
        });
        return AnimatedScale(
          scale: total > 0 ? 1.0 : 0.0,
          duration: const Duration(milliseconds: 250),
          curve: Curves.elasticOut,
          child: GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CartScreen()),
              );
            },
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFE5A93B), Color(0xFFC78A1D)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFE5A93B).withValues(alpha: 0.35),
                        blurRadius: 12,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.shopping_cart_outlined,
                    color: Colors.white,
                    size: 26,
                  ),
                ),
                Positioned(
                  top: -2,
                  right: -2,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: kAccent,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                    child: Text(
                      '$total',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1A1000),
                      ),
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

// ══════════════════════════════════════════════════════════
//  CLEAN SIDEBAR ITEM — minimal, Blinkit/Zepto style
// ══════════════════════════════════════════════════════════
class _SidebarItem extends StatelessWidget {
  final Map<String, dynamic> cat;
  final bool isSelected;
  final VoidCallback onTap;
  const _SidebarItem({
    required this.cat,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final catName = cat['name'] as String? ?? '';
    final imagePath = cat['image_path'] as String?;
    final isAll = catName == 'All';

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeInOut,
        width: double.infinity,
        margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Icon circle ──────────────────────
            AnimatedScale(
              scale: isSelected ? 1.08 : 1.0,
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOutBack,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: isAll
                      ? (isSelected ? kPrimary : const Color(0xFFFAFBF9))
                      : Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isSelected
                        ? kPrimary
                        : const Color(0xFFEBEFF0),
                    width: isSelected ? 1.5 : 1.0,
                  ),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: kPrimary.withValues(alpha: 0.08),
                            blurRadius: 6,
                            offset: const Offset(0, 3),
                          ),
                        ]
                      : [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.02),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                ),
                child: isAll
                    ? Center(
                        child: Icon(
                          Icons.grid_view_rounded,
                          color: isSelected ? Colors.white : kPrimary,
                          size: 24,
                        ),
                      )
                    : (imagePath != null && imagePath.isNotEmpty
                        ? ClipOval(
                            child: Padding(
                              padding: const EdgeInsets.all(1),
                              child: buildProductImage(
                                catName,
                                imageAsset: imagePath,
                                fit: BoxFit.contain,
                              ),
                            ),
                          )
                        : const Center(
                            child: Icon(
                              Icons.shopping_bag_outlined,
                              color: kPrimary,
                              size: 20,
                            ),
                          )),
              ),
            ),
            const SizedBox(height: 6),
            // ── Label ────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                catName,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                  color: isSelected ? kPrimary : kText,
                  height: 1.2,
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
//  SKELETON SHIMMER CARD — pulsing placeholder
// ══════════════════════════════════════════════════════════
class _SkeletonCard extends StatefulWidget {
  const _SkeletonCard();
  @override
  State<_SkeletonCard> createState() => _SkeletonCardState();
}

class _SkeletonCardState extends State<_SkeletonCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _anim = Tween(
      begin: 0.4,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _anim,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFF0F0F0)),
        ),
        child: Row(
          children: [
            Container(
              width: 104,
              height: double.infinity,
              decoration: const BoxDecoration(
                color: Color(0xFFF5F5F5),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(16),
                  bottomLeft: Radius.circular(16),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      height: 12,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0F0F0),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      height: 10,
                      width: 60,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF5F5F5),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const Spacer(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          height: 14,
                          width: 50,
                          decoration: BoxDecoration(
                            color: const Color(0xFFEEEEEE),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        Container(
                          height: 28,
                          width: 60,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFAFBF9),
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
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
