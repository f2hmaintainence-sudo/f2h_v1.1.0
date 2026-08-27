import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../app.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/floating_cart_bar.dart';
import '../../data/models/product_model.dart';
import '../bloc/catalog_bloc.dart';
import '../bloc/catalog_event.dart';
import '../bloc/catalog_state.dart';
import '../widgets/product_grid_card.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import '../../../../core/widgets/cow_loading_widget.dart';

// ══════════════════════════════════════════════════════════
//  SHOP SCREEN — category rail + 2-column product grid
//
//  The rail steps aside while a search is active so results
//  get the full width.
// ══════════════════════════════════════════════════════════

/// Space kept clear at the bottom of scrollable content for the app shell's
/// navigation bar and the floating cart pill.
const double _kBottomInset = 160;

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

  bool get _isSearching => _searchQuery.trim().isNotEmpty;

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
    setState(() => _cat = name);

    // Dispatch bloc event to load products from backend
    context.read<CatalogBloc>().add(LoadProductsByCategory(id));
  }

  List<Product> _getFilteredProducts(List<Product> sourceProducts) {
    final q = _searchQuery.toLowerCase().trim();
    List<Product> list;
    if (q.isEmpty) {
      list = List<Product>.from(sourceProducts);
    } else {
      list = sourceProducts.where((p) {
        return p.name.toLowerCase().contains(q) ||
            p.vendor.toLowerCase().contains(q) ||
            p.category.toLowerCase().contains(q);
      }).toList();
    }
    list.sort((a, b) {
      if (a.isOutOfStock == b.isOutOfStock) return 0;
      return a.isOutOfStock ? 1 : -1;
    });
    return list;
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
      appBar: _buildSearchBar(),
      body: CartBarScrollScope(
        child: Stack(
          children: [
            Row(
              children: [
                // Hidden while searching so results span the full width.
                if (!_isSearching) _buildSidebar(),
                Expanded(child: _buildGrid()),
              ],
            ),
            AnimatedPositioned(
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeOutCubic,
              left: 0,
              right: 0,
              bottom: floatingCartBarBottomOffset(
                context,
                isNavVisible: widget.isNavVisible,
              ),
              child: const FloatingCartBar(),
            ),
          ],
        ),
      ),
    );
  }

  // ── SEARCH BAR ──────────────────────────────────────────────
  PreferredSizeWidget _buildSearchBar() {
    final canPop = Navigator.canPop(context);
    return AppBar(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      toolbarHeight: 68,
      leadingWidth: canPop ? 44 : 0,
      leading: canPop
          ? IconButton(
              icon: const Icon(
                Icons.arrow_back_ios_new_rounded,
                size: 18,
                color: kText,
              ),
              onPressed: () => Navigator.pop(context),
            )
          : null,
      titleSpacing: 0,
      title: Padding(
        padding: EdgeInsets.only(left: canPop ? 0 : 16, right: 12),
        child: Container(
          height: 50,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE6ECE8), width: 1.2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                margin: const EdgeInsets.only(left: 4),
                decoration: BoxDecoration(
                  color: kPrimaryPl.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.search_rounded,
                  color: kPrimary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _searchController,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: kText,
                  ),
                  onTapOutside: (_) => FocusScope.of(context).unfocus(),
                  decoration: const InputDecoration(
                    hintText: 'Search milk, ghee, paneer…',
                    hintStyle: TextStyle(
                      color: Color(0xFF9AA5A0),
                      fontSize: 15,
                      fontWeight: FontWeight.w400,
                    ),
                    border: InputBorder.none,
                    isDense: true,
                  ),
                ),
              ),
              if (_isSearching)
                GestureDetector(
                  onTap: () => _searchController.clear(),
                  child: const Padding(
                    padding: EdgeInsets.all(10),
                    child: Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: kTextSub,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
      actions: const [CartBtn(), SizedBox(width: 16)],
    );
  }

  // ── PRODUCT GRID ────────────────────────────────────────────
  Widget _buildGrid() {
    return BlocBuilder<CatalogBloc, CatalogState>(
      builder: (context, state) {
        final products = state is CatalogLoaded ? state.filteredProducts : <Product>[];
        final filtered = _getFilteredProducts(products);

        final isLoading =
            (state is CatalogLoading) ||
            (state is CatalogLoaded && state.isFiltering);

        if (filtered.isEmpty && !isLoading) {
          return _EmptyResults(query: _searchQuery.trim());
        }

        return LayoutBuilder(
          builder: (context, constraints) => GridView.builder(
            padding: const EdgeInsets.fromLTRB(10, 10, 10, _kBottomInset),
            gridDelegate: _gridDelegate(constraints.maxWidth),
            itemCount: isLoading ? 6 : filtered.length,
            itemBuilder: (_, i) => isLoading
                ? const _SkeletonCard()
                : RepaintBoundary(child: ProductGridCard(filtered[i])),
          ),
        );
      },
    );
  }

  /// Derives the cell height from the real card width so the artwork keeps a
  /// usable share of the card even on narrow screens.
  SliverGridDelegate _gridDelegate(double availableWidth) {
    const horizontalPadding = 16.0;
    const crossAxisSpacing = 10.0;
    final cardWidth =
        (availableWidth - horizontalPadding - crossAxisSpacing) / 2;
    final extent = math.max(cardWidth / kProductGridAspectRatio, 252.0);

    return SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: 2,
      mainAxisSpacing: 10,
      crossAxisSpacing: crossAxisSpacing,
      mainAxisExtent: extent,
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
      width: 88,
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        border: Border(
          right: BorderSide(
            color: const Color(0xFFE2E8F0).withValues(alpha: 0.8),
            width: 1,
          ),
        ),
      ),
      child: isLoadingState
          ? const Center(child: CowLoadingWidget(size: 120))
          : ListView.builder(
              padding: const EdgeInsets.only(top: 8, bottom: _kBottomInset),
              itemCount: categories.length,
              itemBuilder: (context, i) {
                final cat = categories[i];
                final catName = cat['name'] as String? ?? '';
                final catId = cat['category_id']?.toString() ?? 'All';
                return _SidebarItem(
                  cat: cat,
                  isSelected: catName == _cat,
                  onTap: () => _selectCat(catName, catId),
                );
              },
            ),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  EMPTY STATE
// ══════════════════════════════════════════════════════════

class _EmptyResults extends StatelessWidget {
  final String query;
  const _EmptyResults({required this.query});

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, _kBottomInset),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.search_off_outlined, size: 44, color: kMuted),
          const SizedBox(height: 12),
          Text(
            query.isEmpty
                ? 'No products in this category'
                : 'No results for "$query"',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: kMuted,
              fontWeight: FontWeight.w600,
              fontSize: 13.5,
            ),
          ),
        ],
      ),
    ),
  );
}

/// Cleans category display names by stripping 'F2H ' / 'f2h ' prefixes.
String cleanCategoryName(String name) {
  if (name.isEmpty) return name;
  final cleaned = name.replaceAll(RegExp(r'\bf2h\b\s*', caseSensitive: false), '').trim();
  return cleaned.isNotEmpty ? cleaned : name;
}

// ══════════════════════════════════════════════════════════
//  GLASSIE SIDEBAR ITEM — Glossy glassmorphic indicator UI
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
    final displayCatName = cleanCategoryName(catName);
    final imagePath = cat['image_path'] as String?;
    final isAll = catName == 'All';

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── SINGLE CLEAN CIRCLE BADGE (Down-to-Top Gradient Fade) ──────────
            AnimatedScale(
              scale: isSelected ? 1.08 : 1.0,
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeOutBack,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOutCubic,
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: isAll
                      ? const LinearGradient(
                          colors: [Color(0xFF047857), Color(0xFF10B981), Color(0xFF34D399)],
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                        )
                      : (isSelected
                          ? const LinearGradient(
                              colors: [
                                Color(0xFF34D399),
                                Color(0xFFA7F3D0),
                                Colors.white,
                              ],
                              stops: [0.0, 0.55, 1.0],
                              begin: Alignment.bottomCenter,
                              end: Alignment.topCenter,
                            )
                          : const LinearGradient(
                              colors: [Color(0xFFF1F5F9), Color(0xFFF8FAFC), Color(0xFFFFFFFF)],
                              begin: Alignment.bottomCenter,
                              end: Alignment.topCenter,
                            )),
                  border: Border.all(
                    color: isAll
                        ? Colors.white
                        : (isSelected
                            ? const Color(0xFF10B981)
                            : const Color(0xFFE2E8F0)),
                    width: isSelected ? 2.2 : 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: isAll
                          ? const Color(0xFF047857).withValues(alpha: 0.35)
                          : (isSelected
                              ? const Color(0xFF10B981).withValues(alpha: 0.22)
                              : Colors.black.withValues(alpha: 0.04)),
                      blurRadius: isSelected ? 8 : 4,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: isAll
                    ? const Center(
                        child: Icon(
                          Icons.grid_view_rounded,
                          color: Colors.white,
                          size: 26,
                        ),
                      )
                    : (imagePath != null && imagePath.isNotEmpty
                          ? ClipOval(
                              child: Padding(
                                padding: const EdgeInsets.all(2),
                                child: buildProductImage(
                                  catName,
                                  imageAsset: imagePath,
                                  fit: BoxFit.cover,
                                ),
                              ),
                            )
                          : Center(
                              child: Icon(
                                Icons.water_drop_rounded,
                                color: isSelected
                                    ? const Color(0xFF059669)
                                    : const Color(0xFF64748B),
                                size: 24,
                              ),
                            )),
              ),
            ),
            const SizedBox(height: 6),
            // ── Label ────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeInOut,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
                  color: isSelected
                      ? const Color(0xFF059669)
                      : const Color(0xFF475569),
                  height: 1.18,
                  letterSpacing: isSelected ? -0.1 : 0,
                ),
                child: Text(
                  displayCatName,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
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
//  SKELETON SHIMMER CARD — pulsing grid placeholder
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

  Widget _bar(double height, double width) => Container(
    height: height,
    width: width,
    decoration: BoxDecoration(
      color: const Color(0xFFF0F2F1),
      borderRadius: BorderRadius.circular(4),
    ),
  );

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _anim,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFEDF1EE)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _bar(14, 54),
            const SizedBox(height: 10),
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F7F6),
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 10),
            _bar(12, double.infinity),
            const SizedBox(height: 6),
            _bar(10, 60),
            const SizedBox(height: 10),
            _bar(16, 70),
            const SizedBox(height: 10),
            Container(
              height: 42,
              width: double.infinity,
              decoration: BoxDecoration(
                color: const Color(0xFFF0F2F1),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
