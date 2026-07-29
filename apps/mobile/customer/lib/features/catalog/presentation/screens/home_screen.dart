import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../bloc/catalog_bloc.dart';
import '../bloc/catalog_state.dart';
import '../bloc/catalog_event.dart';
import '../../../../app.dart';
import '../../../../core/session/customer_session_cubit.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/app_refresh_indicator.dart';
import '../../../../core/session/customer_session_state.dart';
import '../../../../core/widgets/hot_toast.dart';
import '../../../../core/network/network_bloc.dart';
import '../../../../core/network/network_state.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../profile/presentation/screens/profile_screen.dart';
import '../../../profile/presentation/screens/referral_screen.dart';
import '../../../notifications/presentation/screens/notifications_screen.dart';
import '../../../address/presentation/widgets/address_selector_drawer.dart';
import '../../../address/data/models/profile_address.dart';
import '../../data/models/product_model.dart';
import '../widgets/product_tile.dart';
import '../widgets/cart_widgets.dart';
import '../widgets/offer_banner.dart';
import '../widgets/image_banner.dart';
import 'cart_screen.dart';
import 'product_detail_view_screen.dart';
import 'product_detail_screen.dart';
import '../bloc/cart/cart_bloc.dart';
import '../bloc/cart/cart_state.dart';
import '../bloc/cart/cart_event.dart';
import '../../../notifications/presentation/bloc/notifications_bloc.dart';
import '../../../notifications/presentation/bloc/notifications_state.dart';
import '../../../notifications/presentation/bloc/notifications_event.dart';
import '../../../../core/guards/auth_guard.dart';

// ══════════════════════════════════════════════════════════
//  HOME SCREEN
// ══════════════════════════════════════════════════════════

class HomeScreen extends StatefulWidget {
  final bool isNavVisible;
  const HomeScreen({this.isNavVisible = true, super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  // Search Typing Hint variables
  int _searchIndex = 0;
  Timer? _searchTimer;
  final List<String> _searchHints = [
    'Search "fresh milk"...',
    'Search "creamy paneer"...',
    'Search "organic ghee"...',
    'Search "thick curd"...',
  ];



  @override
  void initState() {
    super.initState();

    // Trigger catalog and notifications load on startup if not already loaded / loading
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final state = context.read<CatalogBloc>().state;
        if (state is! CatalogLoaded && state is! CatalogLoading) {
          context.read<CatalogBloc>().add(LoadCatalog());
        }
        final session = context.read<CustomerSessionCubit>().state;
        final customerId = session.profile?.customerId;
        if (customerId != null) {
          context.read<NotificationsBloc>().add(LoadNotifications());
        }
      }
    });

    // 1. Typing animation timer
    _searchTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (mounted) {
        setState(() {
          _searchIndex = (_searchIndex + 1) % _searchHints.length;
        });
      }
    });
  }

  @override
  void dispose() {
    _searchTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // Required for AutomaticKeepAliveClientMixin
    return Scaffold(
      backgroundColor: kBg,
      body: Stack(
        children: [
          AppRefreshIndicator(
            onRefresh: () async {
              context.read<CatalogBloc>().add(LoadCatalog());
              final session = context.read<CustomerSessionCubit>().state;
              final customerId = session.profile?.customerId;
              if (customerId != null) {
                context.read<CartBloc>().add(LoadCartEvent(customerId));
                context.read<NotificationsBloc>().add(LoadNotifications());
              }
              
              await Future.wait([
                context.read<CatalogBloc>().stream.firstWhere((s) => s is CatalogLoaded || s is CatalogError),
                if (customerId != null) ...[
                  context.read<CartBloc>().stream.firstWhere((s) => s is CartLoadedState || s is CartErrorState),
                  context.read<NotificationsBloc>().stream.firstWhere((s) => s is NotificationsLoaded || s is NotificationsError),
                ]
              ]);
            },
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                // 1. Sticky App Header with Collapsing Search Bar
                SliverPersistentHeader(
                  pinned: true,
                  delegate: HomeHeaderDelegate(
                    topPadding: MediaQuery.of(context).padding.top,
                    searchHint: _searchHints[_searchIndex],
                    notifBtn: _notifBtn(),
                    profileBtn: _profileBtn(),
                    onSearchTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const BrowseScreen(initialCategory: 'All'),
                        ),
                      );
                    },
                  ),
                ),

                // 2. Category Shortcuts Row
                SliverToBoxAdapter(child: _categoryShortcuts()),

                // 3. Static Image Banner - MOVED DOWN! (Removed by request)
                SliverToBoxAdapter(child: const ImageBanner()),

                // 4. Subscription Products (Marketplace Catalog) - MOVED TO TOP!
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
                    child: Row(
                      children: [
                        const Text(
                          'Subscription Products',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: kText,
                            letterSpacing: -0.4,
                          ),
                        ),
                        const Spacer(),
                        GestureDetector(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const BrowseScreen(initialCategory: 'All'),
                              ),
                            );
                          },
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'See All',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF16653A),
                                ),
                              ),
                              SizedBox(width: 4),
                              Icon(
                                Icons.arrow_forward,
                                size: 12,
                                color: Color(0xFF16653A),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: BlocBuilder<CatalogBloc, CatalogState>(
                    builder: (context, state) {
                      final isOffline = context.read<NetworkBloc>().state is NetworkOffline;
                      if (state is CatalogLoading || state is CatalogInitial || isOffline) {
                        return SizedBox(
                          height: 245,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: 4,
                            separatorBuilder: (_, __) => const SizedBox(width: 12),
                            itemBuilder: (_, __) => const SizedBox(
                              width: 162,
                              child: _HomeSkeletonCard(),
                            ),
                          ),
                        );
                      }

                      if (state is CatalogError) {
                        return SizedBox(
                          height: 245,
                          child: Center(
                            child: TextButton.icon(
                              onPressed: () => context.read<CatalogBloc>().add(LoadCatalog()),
                              icon: const Icon(Icons.refresh),
                              label: const Text('Retry products'),
                            ),
                          ),
                        );
                      }

                      List<Product> products = [];
                      if (state is CatalogLoaded) {
                         products = state.products.where((p) => p.isSubscribable).toList();
                      }
                      if (products.isEmpty) {
                        return SizedBox(
                          height: 245,
                          child: Center(
                            child: TextButton.icon(
                              onPressed: () => context.read<CatalogBloc>().add(LoadCatalog()),
                              icon: const Icon(Icons.refresh),
                              label: const Text('Retry products'),
                            ),
                          ),
                        );
                      }
                      return InfiniteAutoScrollList(
                        height: 245,
                        itemWidth: 170,
                        autoScrollInterval: const Duration(milliseconds: 10000),
                        scrollDuration: const Duration(milliseconds: 1000),
                        animateClockwise: true,
                        items: products
                            .map(
                              (p) => Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 4),
                                child: _subscriptionProductCard(context, p),
                              ),
                            )
                            .toList(),
                      );
                    },
                  ),
                ),



                // 6. One time Product
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
                    child: Row(
                      children: [
                        const Text(
                          'One-time Products',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: kText,
                            letterSpacing: -0.4,
                          ),
                        ),
                        const Spacer(),
                        GestureDetector(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const BrowseScreen(initialCategory: 'All'),
                              ),
                            );
                          },
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'See All',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF16653A),
                                ),
                              ),
                              SizedBox(width: 4),
                              Icon(
                                Icons.arrow_forward,
                                size: 12,
                                color: Color(0xFF16653A),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: BlocBuilder<CatalogBloc, CatalogState>(
                    builder: (context, state) {
                      final isOffline = context.read<NetworkBloc>().state is NetworkOffline;
                      if (state is CatalogLoading || state is CatalogInitial || isOffline) {
                        return SizedBox(
                          height: 245,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: 4,
                            separatorBuilder: (_, __) => const SizedBox(width: 12),
                            itemBuilder: (_, __) => const SizedBox(
                              width: 162,
                              child: _HomeSkeletonCard(),
                            ),
                          ),
                        );
                      }

                      if (state is CatalogError) {
                        return const SizedBox.shrink();
                      }

                      List<Product> products = [];
                      if (state is CatalogLoaded) {
                         products = state.products.where((p) => !p.isSubscribable).toList();
                      }
                      if (products.isEmpty) {
                        return const SizedBox.shrink();
                      }
                      return InfiniteAutoScrollList(
                        height: 245,
                        itemWidth: 170,
                        autoScrollInterval: const Duration(milliseconds: 12000),
                        scrollDuration: const Duration(milliseconds: 1000),
                        animateClockwise: false,
                        items: products
                            .map(
                              (p) => Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 4),
                                child: _oneTimeProductCard(context, p),
                              ),
                            )
                            .toList(),
                      );
                    },
                  ),
                ),

                // 6. Referral Banner (Invite Friends, Earn Rewards!)
                const SliverToBoxAdapter(
                  child: _HomeReferralBanner(),
                ),

                // 7. The F2H Promise
                SliverToBoxAdapter(child: _promiseStrip()),

                const SliverToBoxAdapter(child: SizedBox(height: 100)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _notifBtn() {
    return BlocBuilder<NotificationsBloc, NotificationsState>(
      builder: (context, state) {
        int unreadCount = 0;
        if (state is NotificationsLoaded) {
          unreadCount = state.unreadCount;
        }
        return GestureDetector(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const NotificationsScreen()),
            );
          },
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.06),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.notifications_none_rounded,
                  color: Color(0xFF16653A),
                  size: 20,
                ),
              ),
              if (unreadCount > 0)
                Positioned(
                  top: -2,
                  right: -2,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 16,
                      minHeight: 16,
                    ),
                    child: Center(
                      child: Text(
                        unreadCount > 99 ? '99+' : '$unreadCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                          height: 1.0,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _cartBtn() {
    return BlocBuilder<CartBloc, CartState>(
      builder: (context, state) {
        final items = context.read<CartBloc>().currentItems;
        int count = 0;
        for (final item in items) {
          if (item.purchaseType == 'subscription') {
            count += 1;
          } else {
            count += item.quantity ?? 1;
          }
        }
        return GestureDetector(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const CartScreen()),
            );
          },
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              const Icon(
                Icons.shopping_cart_outlined,
                color: Color(0xFF16653A),
                size: 24,
              ),
              if (count > 0)
                Positioned(
                  top: -6,
                  right: -6,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      count > 99 ? '99+' : '$count',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 8,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _profileBtn() {
    return BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
      builder: (context, state) {
        final isVip = state.profile?.isMember == true;
        return GestureDetector(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ProfileScreen()),
            );
          },
          child: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              gradient: isVip
                  ? const LinearGradient(
                      colors: [Color(0xFFB8860B), Color(0xFFFFD700)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    )
                  : null,
              color: isVip ? null : Colors.white,
              shape: BoxShape.circle,
              border: isVip ? Border.all(color: Colors.white, width: 1.5) : null,
              boxShadow: [
                BoxShadow(
                  color: isVip
                      ? const Color(0xFFFFD700).withValues(alpha: 0.4)
                      : Colors.black.withValues(alpha: 0.06),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Icon(
              Icons.person_outline_rounded,
              color: isVip ? Colors.white : const Color(0xFF16653A),
              size: 20,
            ),
          ),
        );
      },
    );
  }

  Widget _categoryShortcuts() {
    return BlocBuilder<CatalogBloc, CatalogState>(
      builder: (context, state) {
        List<Map<String, dynamic>> categories = [];
        if (state is CatalogLoaded) {
          categories = state.categories;
        }

        final colors = [
          const Color(0xFFE8F5E9), // soft green
          const Color(0xFFE3F2FD), // soft blue
          const Color(0xFFFFF3E0), // soft orange
          const Color(0xFFF3E5F5), // soft purple
          const Color(0xFFFFFDE7), // soft yellow
        ];

        return Container(
          height: 102,
          margin: const EdgeInsets.symmetric(vertical: 14),
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              // "All" item
              _categoryShortcutItem(
                label: 'All',
                icon: Icons.grid_view_rounded,
                isAll: true,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const BrowseScreen(initialCategory: 'All'),
                    ),
                  );
                },
              ),
              // Dynamic categories
              ...categories.take(5).toList().asMap().entries.map((entry) {
                final idx = entry.key;
                final cat = entry.value;
                final label = cat['name'] ?? '';
                final imagePath = cat['image_path'] ?? '';
                final bgColor = const Color(0xFFE8F5E9);
                return _categoryShortcutItem(
                  label: label,
                  imagePath: imagePath,
                  bgColor: bgColor,
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => BrowseScreen(initialCategory: label),
                      ),
                    );
                  },
                );
              }),
              // "More" item
              _categoryShortcutItem(
                label: 'More',
                icon: Icons.more_horiz_rounded,
                isMore: true,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const BrowseScreen(initialCategory: 'All'),
                    ),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _categoryShortcutItem({
    required String label,
    IconData? icon,
    String? imagePath,
    bool isAll = false,
    bool isMore = false,
    Color? bgColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 66,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: isAll
                    ? const Color(0xFF16653A)
                    : (isMore
                        ? const Color(0xFFECEFF1)
                        : (bgColor ?? Colors.white)),
                shape: BoxShape.circle,
                border: Border.all(
                  color: isAll
                      ? Colors.transparent
                      : (isMore
                          ? const Color(0xFFECEFF1)
                          : (bgColor?.withValues(alpha: 0.8) ?? const Color(0xFFECEFF1))),
                  width: 1.0,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 6,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Center(
                child: icon != null
                    ? Icon(
                        icon,
                        color: isAll ? Colors.white : const Color(0xFF16653A),
                        size: 30,
                      )
                    : (imagePath != null && imagePath.isNotEmpty
                        ? ClipOval(
                            child: Padding(
                              padding: const EdgeInsets.all(4.0),
                              child: buildProductImage(
                                label,
                                imageAsset: imagePath,
                                fit: BoxFit.contain,
                              ),
                            ),
                          )
                        : const Icon(
                            Icons.shopping_bag_outlined,
                            color: Color(0xFF16653A),
                            size: 26,
                          )),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: kText,
                letterSpacing: -0.2,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _quickFeatures() {
    final list = [
      (
        icon: Icons.local_offer_outlined,
        title: 'First Order',
        sub: '50% OFF',
        color: Colors.redAccent,
      ),
      (
        icon: Icons.local_shipping_outlined,
        title: 'Early Morning',
        sub: 'Delivery',
        color: Colors.blueAccent,
      ),
      (
        icon: Icons.replay_rounded,
        title: 'Easy',
        sub: 'Returns',
        color: const Color(0xFF2E7D32),
      ),
      (
        icon: Icons.verified_user_outlined,
        title: 'Secure',
        sub: 'Payments',
        color: Colors.orangeAccent,
      ),
    ];

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 18, 16, 8),
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderLt),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: List.generate(list.length, (idx) {
          final item = list[idx];
          return Expanded(
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    children: [
                      Icon(item.icon, color: item.color, size: 20),
                      const SizedBox(height: 6),
                      Text(
                        item.title,
                        style: const TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w900,
                          color: kText,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        item.sub,
                        style: const TextStyle(
                          fontSize: 8.5,
                          fontWeight: FontWeight.w500,
                          color: kTextSub,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
                if (idx < list.length - 1)
                  Container(
                    width: 1,
                    height: 36,
                    color: kBorderLt,
                  ),
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _subscriptionProductCard(BuildContext context, Product p) {
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        PageRouteBuilder(
          pageBuilder: (_, a, __) => ProductDetailViewScreen(product: p),
          transitionsBuilder: (_, a, __, child) =>
              FadeTransition(opacity: a, child: child),
          transitionDuration: const Duration(milliseconds: 220),
        ),
      ),
      child: Container(
        width: 162,
        margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kBorderLt, width: 1.0),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 120,
                  width: double.infinity,
                  decoration: const BoxDecoration(
                    color: Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: buildProductImage(
                      p.name,
                      imageAsset: p.imageAsset,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: kText,
                          letterSpacing: -0.2,
                        ),
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
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                Padding(
                  padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Flexible(
                              child: Text('₹${p.price.toStringAsFixed(0)}',
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: kText),
                                maxLines: 1, overflow: TextOverflow.ellipsis),
                            ),
                            if (p.originalPrice > p.price) ...[
                              const SizedBox(width: 3),
                              Flexible(
                                child: Text('₹${p.originalPrice.toStringAsFixed(0)}',
                                  style: const TextStyle(fontSize: 9.5, color: kMuted, decoration: TextDecoration.lineThrough, fontWeight: FontWeight.w600),
                                  maxLines: 1, overflow: TextOverflow.ellipsis),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 4),
                      ZeptoAddButton(p: p, isSmall: true),
                    ],
                  ),
                ),
              ],
            ),
            if (p.isSubscribable && p.subscriptionPrice != null && p.subscriptionPrice! > 0)
              Positioned(
                top: 94,
                left: 0,
                right: 0,
                child: Container(
                  height: 26,
                  decoration: const BoxDecoration(
                    color: Color(0xFFDCFCE7),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.sync_rounded, size: 12, color: Color(0xFF16653A)),
                      const SizedBox(width: 3),
                      Text(
                        'Subscribe @ ₹${p.subscriptionPrice!.toStringAsFixed(0)}',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF16653A)),
                      ),
                    ],
                  ),
                ),
              ),
            if (p.reviews > 0)
              Positioned(
                top: 8,
                left: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.9),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFFFE0B2), width: 0.8),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.04),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.star_rounded, size: 10, color: Colors.amber),
                      const SizedBox(width: 2),
                      Text(
                        '${p.rating.toStringAsFixed(1)} (${p.reviews})',
                        style: const TextStyle(fontSize: 7.5, fontWeight: FontWeight.w800, color: Color(0xFFE65100)),
                      ),
                    ],
                  ),
                ),
              ),
            if (p.isLowStock || p.isOutOfStock)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFEBEE),
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(color: const Color(0xFFEF5350), width: 0.8),
                  ),
                  child: Text(
                    p.isOutOfStock ? 'OUT OF STOCK' : 'LOW STOCK',
                    style: const TextStyle(fontSize: 6.5, fontWeight: FontWeight.w900, color: Color(0xFFD32F2F), letterSpacing: 0.3),
                  ),
                ),
              )
            else if (p.isOrganic)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF7E6),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: const Color(0xFFFFD54F), width: 0.8),
                  ),
                  child: const Text(
                    'Best Seller',
                    style: TextStyle(
                      fontSize: 6.5,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFFB45309),
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  Widget _oneTimeProductCard(BuildContext context, Product p) {
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        PageRouteBuilder(
          pageBuilder: (_, a, __) => ProductDetailViewScreen(product: p),
          transitionsBuilder: (_, a, __, child) =>
              FadeTransition(opacity: a, child: child),
          transitionDuration: const Duration(milliseconds: 220),
        ),
      ),
      child: Container(
        width: 162,
        margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kBorderLt, width: 1.0),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 120,
                  width: double.infinity,
                  decoration: const BoxDecoration(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                  ),
                  child: Padding(
                    padding: EdgeInsets.zero,
                    child: buildProductImage(
                      p.name,
                      imageAsset: p.imageAsset,
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: kText,
                          letterSpacing: -0.2,
                        ),
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
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                Padding(
                  padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Flexible(
                              child: Text('₹${p.price.toStringAsFixed(0)}',
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: kText),
                                maxLines: 1, overflow: TextOverflow.ellipsis),
                            ),
                            if (p.originalPrice > p.price) ...[
                              const SizedBox(width: 3),
                              Flexible(
                                child: Text('₹${p.originalPrice.toStringAsFixed(0)}',
                                  style: const TextStyle(fontSize: 9.5, color: kMuted, decoration: TextDecoration.lineThrough, fontWeight: FontWeight.w600),
                                  maxLines: 1, overflow: TextOverflow.ellipsis),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 4),
                      ZeptoAddButton(p: p, isSmall: true),
                    ],
                  ),
                ),
              ],
            ),
            if (p.reviews > 0)
              Positioned(
                top: 8,
                left: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.9),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFFFE0B2), width: 0.8),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.04),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.star_rounded, size: 10, color: Colors.amber),
                      const SizedBox(width: 2),
                      Text(
                        '${p.rating.toStringAsFixed(1)} (${p.reviews})',
                        style: const TextStyle(fontSize: 7.5, fontWeight: FontWeight.w800, color: Color(0xFFE65100)),
                      ),
                    ],
                  ),
                ),
              ),
            if (p.isLowStock || p.isOutOfStock)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFEBEE),
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(color: const Color(0xFFEF5350), width: 0.8),
                  ),
                  child: Text(
                    p.isOutOfStock ? 'OUT OF STOCK' : 'LOW STOCK',
                    style: const TextStyle(fontSize: 6.5, fontWeight: FontWeight.w900, color: Color(0xFFD32F2F), letterSpacing: 0.3),
                  ),
                ),
              )
            else if (p.isOrganic)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF7E6),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: const Color(0xFFFFD54F), width: 0.8),
                  ),
                  child: const Text(
                    'Best Seller',
                    style: TextStyle(
                      fontSize: 6.5,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFFB45309),
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _subscriptionBanner() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 18, 16, 8),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF114227), Color(0xFF1D5C39)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF114227).withValues(alpha: 0.15),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -20,
            bottom: -20,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Flat 50% OFF',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const Text(
                      'on your very first order!',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Colors.white70,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE5A93B).withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: const Color(0xFFE5A93B).withValues(alpha: 0.4),
                        ),
                      ),
                      child: const Text(
                        'Use code: F2HFIRST50',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFE5A93B),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    GestureDetector(
                      onTap: () {
                        AppShell.of(context)?.setTab(1); // Switch to Menu Tab
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.08),
                              blurRadius: 6,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: const Text(
                          'Order Now',
                          style: TextStyle(
                            color: Color(0xFF114227),
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Icon(
                    Icons.calendar_today_rounded,
                    color: Color(0xFFE5A93B),
                    size: 34,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _freshBatchStepper() {
    final steps = [
      (
        svg: '''<svg viewBox="0 0 24 24" fill="none" stroke="#16653A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 10h12l-1 11H7L6 10z"/>
          <path d="M9 10V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v5"/>
          <line x1="7" y1="5" x2="17" y2="5"/>
        </svg>''',
        label: 'Collected'
      ),
      (
        svg: '''<svg viewBox="0 0 24 24" fill="none" stroke="#16653A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 20h6a2 2 0 0 0 2-2V10a4 4 0 0 0-1-2.63V4a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v3.37A4 4 0 0 0 7 10v8a2 2 0 0 0 2 2z"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
          <line x1="9" y1="6" x2="15" y2="6"/>
        </svg>''',
        label: 'Packed'
      ),
      (
        svg: '''<svg viewBox="0 0 24 24" fill="none" stroke="#16653A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="2" ry="2"/>
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>''',
        label: 'In Delivery'
      ),
      (
        svg: '''<svg viewBox="0 0 24 24" fill="none" stroke="#16653A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>''',
        label: 'Delivered'
      ),
    ];

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 18, 16, 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorderLt),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.015),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                "Today's Fresh Batch",
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: kText,
                ),
              ),
              const Spacer(),
              // GestureDetector(
              //   onTap: () {
              //     // View action
              //   },
              //   child: const Text(
              //     'View All',
              //     style: TextStyle(
              //       fontSize: 11,
              //       fontWeight: FontWeight.w800,
              //       color: Color(0xFF16653A),
              //     ),
              //   ),
              // ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(steps.length * 2 - 1, (index) {
              if (index.isOdd) {
                return const Icon(
                  Icons.arrow_forward_rounded,
                  color: Color(0xFF16653A),
                  size: 16,
                );
              }
              final stepIndex = index ~/ 2;
              final step = steps[stepIndex];
              return Expanded(
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(
                        color: Color(0xFFEEF9F1),
                        shape: BoxShape.circle,
                      ),
                      child: SvgPicture.string(
                        step.svg,
                        width: 22,
                        height: 22,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      step.label,
                      style: const TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w900,
                        color: kText,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _promiseStrip() {
    final List<({IconData icon, String label, VoidCallback? onTap})> promises = [
      (
        icon: Icons.notifications_off_rounded,
        label: 'Zero Contact,\nNo Ring',
        onTap: null,
      ),
      (
        icon: Icons.verified_rounded,
        label: 'Premium\nQuality',
        onTap: null,
      ),
      (
        icon: Icons.eco_rounded,
        label: '100% Safe\n& Hygienic',
        onTap: null,
      ),
    ];

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 18, 16, 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorderLt),
      ),
      child: Column(
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('🌿', style: TextStyle(fontSize: 14)),
              SizedBox(width: 8),
              Text(
                'The F2H Promise',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF16653A),
                  letterSpacing: 0.2,
                ),
              ),
              SizedBox(width: 8),
              Text('🌿', style: TextStyle(fontSize: 14)),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: promises.map((p) {
              final content = Column(
                children: [
                  Icon(
                    p.icon,
                    color: const Color(0xFF16653A),
                    size: 22,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    p.label,
                    style: const TextStyle(
                      fontSize: 8.5,
                      fontWeight: FontWeight.w800,
                      color: kText,
                      height: 1.2,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              );

              return Expanded(
                child: p.onTap != null
                    ? GestureDetector(
                        onTap: p.onTap,
                        behavior: HitTestBehavior.opaque,
                        child: content,
                      )
                    : content,
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _reviewsCard() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 18, 16, 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorderLt),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.015),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'What Customers Say',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: kText,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () {
                  // View reviews
                },
                child: const Text(
                  'View All',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF16653A),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Row(
                          children: List.generate(5, (_) => const Icon(Icons.star_rounded, color: kAccent, size: 14)),
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          '4.9',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                            color: kText,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '"The milk is so fresh and pure. Tastes just like farm milk."',
                      style: TextStyle(
                        fontSize: 12,
                        fontStyle: FontStyle.italic,
                        fontWeight: FontWeight.w700,
                        color: kTextMid,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      '– Priya, Bengaluru',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: kTextSub,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              const Icon(
                Icons.emoji_objects_outlined,
                color: Color(0xFF16653A),
                size: 48,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _referralBanner() {
    return const _HomeReferralBanner();
  }

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
//  HOME SKELETON SHIMMER CARD
// ══════════════════════════════════════════════════════════
class _HomeSkeletonCard extends StatefulWidget {
  const _HomeSkeletonCard();
  @override
  State<_HomeSkeletonCard> createState() => _HomeSkeletonCardState();
}

class _HomeSkeletonCardState extends State<_HomeSkeletonCard>
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
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFF0F0F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 140,
              decoration: const BoxDecoration(
                color: Color(0xFFF5F5F5),
                borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(9),
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
                  const SizedBox(height: 8),
                  Container(
                    height: 14,
                    width: 50,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEEEEE),
                      borderRadius: BorderRadius.circular(4),
                    ),
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

class InfiniteAutoScrollList extends StatefulWidget {
  final List<Widget> items;
  final double height;
  final double itemWidth;
  final Duration scrollDuration;
  final Duration autoScrollInterval;
  final EdgeInsetsGeometry? padding;
  final bool animateClockwise;

  const InfiniteAutoScrollList({
    super.key,
    required this.items,
    required this.height,
    required this.itemWidth,
    this.scrollDuration = const Duration(milliseconds: 800),
    this.autoScrollInterval = const Duration(milliseconds: 1200),
    this.padding,
    this.animateClockwise = true,
  });

  @override
  State<InfiniteAutoScrollList> createState() => _InfiniteAutoScrollListState();
}

class _InfiniteAutoScrollListState extends State<InfiniteAutoScrollList> {
  late final ScrollController _scrollController;
  Timer? _timer;
  bool _userInteracting = false;
  Timer? _resumeTimer;

  @override
  void initState() {
    super.initState();
    final initialOffset = 1000 * widget.itemWidth;
    _scrollController = ScrollController(initialScrollOffset: initialOffset);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startAutoScroll();
    });
  }

  void _startAutoScroll() {
    _timer?.cancel();
    _timer = Timer.periodic(widget.autoScrollInterval, (timer) {
      if (!mounted || _userInteracting || !_scrollController.hasClients) return;
      final currentOffset = _scrollController.offset;

      double targetOffset;
      if (widget.animateClockwise) {
        targetOffset = currentOffset + widget.itemWidth;
      } else {
        targetOffset = currentOffset - widget.itemWidth;

        // Prevent hitting 0 by seamlessly jumping forward by a multiple of the item set length
        if (targetOffset < widget.itemWidth * 5) {
          final loopWidth = widget.items.length * widget.itemWidth;
          final jumpOffset = currentOffset + (loopWidth * 100);
          _scrollController.jumpTo(jumpOffset);
          targetOffset = jumpOffset - widget.itemWidth;
        }
      }

      _scrollController.animateTo(
        targetOffset,
        duration: widget.scrollDuration,
        curve: Curves.easeInOut,
      );
    });
  }

  void _onInteraction() {
    _userInteracting = true;
    _timer?.cancel();
    _resumeTimer?.cancel();
    _resumeTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          _userInteracting = false;
        });
        _startAutoScroll();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _resumeTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return const SizedBox.shrink();
    return Listener(
      onPointerDown: (_) => _onInteraction(),
      child: SizedBox(
        height: widget.height,
        child: ListView.builder(
          controller: _scrollController,
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          padding: widget.padding,
          itemBuilder: (context, index) {
            final actualIndex = index % widget.items.length;
            return SizedBox(
              width: widget.itemWidth,
              child: widget.items[actualIndex],
            );
          },
        ),
      ),
    );
  }
}

class HomeHeaderDelegate extends SliverPersistentHeaderDelegate {
  final double topPadding;
  final String searchHint;
  final Widget notifBtn;
  final Widget profileBtn;
  final VoidCallback onSearchTap;

  HomeHeaderDelegate({
    required this.topPadding,
    required this.searchHint,
    required this.notifBtn,
    required this.profileBtn,
    required this.onSearchTap,
  });

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final double minHeight = minExtent;
    final double maxHeight = maxExtent;
    final double delta = maxHeight - minHeight;
    final double shrinkFactor = delta > 0 ? (shrinkOffset / delta).clamp(0.0, 1.0) : 0.0;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: shrinkFactor > 0.8
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                )
              ]
            : [],
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Farm Background Image (fades out as header collapses)
          Opacity(
            opacity: (1.0 - shrinkFactor).clamp(0.0, 1.0),
            child: Image.asset(
              'assets/icon/home_bg.jpg',
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  color: const Color(0xFFE8F5E9),
                );
              },
            ),
          ),

          // 2. Solid color background overlay (smooth fade to solid color as collapses)
          Positioned.fill(
            child: Container(
              color: Colors.white.withValues(alpha: shrinkFactor),
            ),
          ),

          // 3. Darker bottom gradient for expanded state
          Opacity(
            opacity: (1.0 - shrinkFactor).clamp(0.0, 1.0),
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: const [0.0, 1.0],
                  colors: [
                    Colors.transparent,
                    kBg.withValues(alpha: 0.85),
                  ],
                ),
              ),
            ),
          ),

          // 4. Top Row (App Logo, Title, Actions) - fades out
          Positioned(
            top: topPadding + 10,
            left: 16,
            right: 16,
            child: Opacity(
              opacity: (1.0 - shrinkFactor * 1.8).clamp(0.0, 1.0),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.asset(
                      'assets/icon/app_icon.png',
                      width: 32,
                      height: 32,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return Container(
                          width: 32,
                          height: 32,
                          color: const Color(0xFF16653A),
                          child: const Icon(Icons.eco_rounded, color: Colors.white, size: 20),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Farm to Home',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF16653A),
                    ),
                  ),
                  const Spacer(),
                  notifBtn,
                  const SizedBox(width: 12),
                  profileBtn,
                ],
              ),
            ),
          ),

          // 5. Search Bar (slides up to stick at top)
          Positioned(
            left: 16,
            right: 16,
            top: topPadding + 170 - (shrinkFactor * 162), // Interpolates from topPadding+170 to topPadding+8
            child: GestureDetector(
              onTap: onSearchTap,
              child: Container(
                height: 46,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(
                    color: const Color(0xFF16653A).withValues(alpha: 0.12),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF16653A).withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.search_rounded,
                      color: Color(0xFF16653A),
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        searchHint,
                        style: const TextStyle(
                          color: kTextSub,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    const Icon(
                      Icons.tune_rounded,
                      color: Color(0xFF16653A),
                      size: 20,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  double get maxExtent => 300;

  @override
  double get minExtent => topPadding + 62;

  @override
  bool shouldRebuild(covariant HomeHeaderDelegate oldDelegate) {
    return oldDelegate.searchHint != searchHint ||
        oldDelegate.notifBtn != notifBtn ||
        oldDelegate.profileBtn != profileBtn ||
        oldDelegate.topPadding != topPadding;
  }
}

// ══════════════════════════════════════════════════════════
//  HOME REFERRAL BANNER (Invite Friends, Earn Rewards!)
// ══════════════════════════════════════════════════════════
class _HomeReferralBanner extends StatelessWidget {
  const _HomeReferralBanner();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
      builder: (context, sessionState) {
        final profile = sessionState.profile;
        final isLoggedIn = profile != null;
        final rawCode = profile?.referralCode ?? sessionState.wallet['referral_code']?.toString();
        final rawStatus = profile?.referralStatus ?? sessionState.wallet['referral_status']?.toString();
        final isLocked = isLoggedIn && (rawStatus?.toLowerCase() == 'locked');
        final code = (isLoggedIn && !isLocked && rawCode != null && rawCode.isNotEmpty) ? rawCode : null;

        // ponytail: scale factor based on screen width for 320-430+ range
        final sw = MediaQuery.of(context).size.width;
        final scale = (sw / 375).clamp(0.82, 1.15);

        return GestureDetector(
          onTap: () {
            if (!isLoggedIn) {
              context.runWithAuth(() {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ReferralScreen()),
                );
              });
            } else {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ReferralScreen(
                    referralCode: rawCode,
                    referralStatus: rawStatus,
                  ),
                ),
              );
            }
          },
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: AspectRatio(
                aspectRatio: 2.45,
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: 16 * scale, vertical: 12 * scale),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [
                        Color(0xFF0B4628),
                        Color(0xFF145C34),
                        Color(0xFF043927),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: const Color(0xFF34D399).withOpacity(0.35),
                      width: 1.2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF064E3B).withOpacity(0.25),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      // Icon badge — fixed size, scales with screen
                      Container(
                        width: 44 * scale,
                        height: 44 * scale,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFFEF3C7), Color(0xFFFDE68A)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.5),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFD97706).withOpacity(0.25),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Center(
                          child: Icon(
                            isLocked ? Icons.lock_outline_rounded : Icons.card_giftcard_rounded,
                            color: const Color(0xFFB45309),
                            size: 22 * scale,
                          ),
                        ),
                      ),
                      SizedBox(width: 12 * scale),
                      // Text content — expands to fill
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Invite Friends & Earn ₹50!',
                              style: TextStyle(
                                fontSize: 14 * scale,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                height: 1.2,
                                letterSpacing: -0.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            SizedBox(height: 3 * scale),
                            Text(
                              isLocked
                                  ? 'Make your 1st order to unlock referral code.'
                                  : 'You & your friend both get ₹50 on first order.',
                              style: TextStyle(
                                fontSize: 10.5 * scale,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFFA7F3D0),
                                height: 1.2,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      SizedBox(width: 8 * scale),
                      // CTA button — wraps to fit
                      _buildCta(context, isLoggedIn, isLocked, code, scale),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildCta(BuildContext ctx, bool isLoggedIn, bool isLocked, String? code, double scale) {
    if (!isLoggedIn) {
      return Container(
        padding: EdgeInsets.symmetric(horizontal: 14 * scale, vertical: 8 * scale),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.12),
              blurRadius: 5,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.login_rounded, color: const Color(0xFF064E3B), size: 14 * scale),
            SizedBox(width: 5 * scale),
            Text(
              'Login',
              style: TextStyle(
                fontSize: 12 * scale,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF064E3B),
              ),
            ),
          ],
        ),
      );
    }

    if (isLocked) {
      return Container(
        padding: EdgeInsets.symmetric(horizontal: 12 * scale, vertical: 7 * scale),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFFEF3C7), Color(0xFFFDE68A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white, width: 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_rounded, color: const Color(0xFFB45309), size: 13 * scale),
            SizedBox(width: 4 * scale),
            Text(
              'Unlock',
              style: TextStyle(
                fontSize: 11.5 * scale,
                fontWeight: FontWeight.w900,
                color: const Color(0xFFB45309),
              ),
            ),
          ],
        ),
      );
    }

    if (code != null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: EdgeInsets.symmetric(horizontal: 10 * scale, vertical: 6 * scale),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.18),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white.withOpacity(0.45), width: 1),
            ),
            child: Text(
              code,
              style: TextStyle(
                fontSize: 11.5 * scale,
                fontWeight: FontWeight.w900,
                color: Colors.white,
                letterSpacing: 0.4,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          SizedBox(width: 6 * scale),
          GestureDetector(
            onTap: () => _shareCode(ctx, code),
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: 12 * scale, vertical: 6 * scale),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.share_rounded, color: const Color(0xFF064E3B), size: 13 * scale),
                  SizedBox(width: 4 * scale),
                  Text(
                    'Share',
                    style: TextStyle(
                      fontSize: 11 * scale,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF064E3B),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }

    return const SizedBox.shrink();
  }

  static Future<void> _shareCode(BuildContext context, String code) async {
    final message = 'Your F2H Invite is Ready\n\n'
        'Get ₹100 on your first order!\n'
        'Fresh farm products, delivered to your doorstep.\n\n'
        'Invite Code: $code\n'
        'https://f2h.app.link/$code\n\n'
        'F2H — Farm To Home\n'
        'Fresh. Smart. Rewarding.';
    final encodedMsg = Uri.encodeComponent(message);
    final whatsappUri = Uri.parse('https://wa.me/?text=$encodedMsg');

    try {
      if (await canLaunchUrl(whatsappUri)) {
        await launchUrl(whatsappUri, mode: LaunchMode.externalApplication);
      } else {
        Clipboard.setData(ClipboardData(text: message));
        if (context.mounted) {
          F2HToast.success(context, 'Referral message copied to clipboard!');
        }
      }
    } catch (_) {
      Clipboard.setData(ClipboardData(text: message));
      if (context.mounted) {
        F2HToast.success(context, 'Referral message copied to clipboard!');
      }
    }
  }
}

