import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../bloc/catalog_bloc.dart';
import '../bloc/catalog_state.dart';
import '../bloc/catalog_event.dart';
import '../../../../app.dart';
import '../../../../core/session/customer_session_cubit.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import '../../../../core/widgets/app_refresh_indicator.dart';
import '../../../../core/widgets/referral_invite_card.dart';
import '../../../../core/network/network_bloc.dart';
import '../../../../core/network/network_state.dart';
import 'package:f2h_customer/core/services/app_asset_service.dart';
import '../../../address/presentation/widgets/address_selector_drawer.dart';
import '../../../address/data/models/profile_address.dart';
import '../../data/models/product_model.dart';
import '../widgets/product_tile.dart';
import '../widgets/product_grid_card.dart';
import '../widgets/image_banner.dart';
import '../widgets/home_coupon_banner.dart';
import '../widgets/promo_banner.dart';
import 'cart_screen.dart';
import 'product_detail_view_screen.dart';
import '../../../../core/widgets/floating_cart_bar.dart';
import 'product_detail_screen.dart';
import '../bloc/cart/cart_bloc.dart';
import '../bloc/cart/cart_state.dart';
import '../bloc/cart/cart_event.dart';
import '../../../notifications/presentation/bloc/notifications_bloc.dart';
import '../../../notifications/presentation/bloc/notifications_state.dart';
import '../../../notifications/presentation/bloc/notifications_event.dart';
import '../../../notifications/presentation/screens/notifications_screen.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import '../../../../core/widgets/popup_banner_widget.dart';

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

  String? _getBranchId(BuildContext context) {
    try {
      final session = context.read<CustomerSessionCubit>().state;
      if (session.addresses.isEmpty) return null;
      final defaultAddr = session.addresses.firstWhere(
        (a) => a.isDefault,
        orElse: () => session.addresses.first,
      );
      if (defaultAddr.branchId.isNotEmpty) {
        return defaultAddr.branchId;
      }
    } catch (_) {}
    return null;
  }

  @override
  void initState() {
    super.initState();

    // Trigger catalog, notifications, and popup banner load on startup
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final branchId = _getBranchId(context);
        final state = context.read<CatalogBloc>().state;
        if (state is! CatalogLoaded && state is! CatalogLoading) {
          context.read<CatalogBloc>().add(LoadCatalog(branchId: branchId));
        }
        final session = context.read<CustomerSessionCubit>().state;
        final customerId = session.profile?.customerId;
        if (customerId != null) {
          context.read<NotificationsBloc>().add(LoadNotifications());
        }
        // Show popup banner on HomeScreen
        PopupBannerWidget.checkAndShowPopupBanner(context);
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
      body: BlocListener<CustomerSessionCubit, CustomerSessionState>(
        listenWhen: (prev, curr) {
          final prevBranch = prev.addresses
                  .where((a) => a.isDefault)
                  .map((a) => a.branchId)
                  .firstOrNull ??
              prev.addresses.firstOrNull?.branchId;
          final currBranch = curr.addresses
                  .where((a) => a.isDefault)
                  .map((a) => a.branchId)
                  .firstOrNull ??
              curr.addresses.firstOrNull?.branchId;
          return prevBranch != currBranch;
        },
        listener: (context, sessionState) {
          final branchId = _getBranchId(context);
          context.read<CatalogBloc>().add(LoadCatalog(branchId: branchId));
        },
        child: CartBarScrollScope(
          child: Stack(
            children: [
              AppRefreshIndicator(
                onRefresh: () async {
                  final branchId = _getBranchId(context);
                  context.read<CatalogBloc>().add(LoadCatalog(branchId: branchId));
                  final session = context.read<CustomerSessionCubit>().state;
                  final customerId = session.profile?.customerId;
                  if (customerId != null) {
                    context.read<CartBloc>().add(LoadCartEvent(customerId));
                    context.read<NotificationsBloc>().add(LoadNotifications());
                  }

                  await Future.wait([
                    context.read<CatalogBloc>().stream.firstWhere(
                      (s) => s is CatalogLoaded || s is CatalogError,
                    ),
                    if (customerId != null) ...[
                      context.read<CartBloc>().stream.firstWhere(
                        (s) => s is CartLoadedState || s is CartErrorState,
                      ),
                      context.read<NotificationsBloc>().stream.firstWhere(
                        (s) =>
                            s is NotificationsLoaded || s is NotificationsError,
                      ),
                    ],
                  ]);
                },
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    // 1. Sticky App Header with Collapsing Search Bar & Branch Info
                    SliverPersistentHeader(
                      pinned: true,
                      delegate: HomeHeaderDelegate(
                        topPadding: MediaQuery.of(context).padding.top,
                        searchHint: _searchHints[_searchIndex],
                        branchWidget: _branchInfoChip(context),
                        onSearchTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  const BrowseScreen(initialCategory: 'All'),
                            ),
                          );
                        },
                      ),
                    ),

                    // 2. Delivery Address Prompt (if no default address/branch set)
                    SliverToBoxAdapter(child: _noAddressPromptCard(context)),

                    // 3. Category Shortcuts Row
                    SliverToBoxAdapter(child: _categoryShortcuts()),

                  // 3. Top Banner (above Subscription Products)
                  const SliverToBoxAdapter(child: PromoBanner()),

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
                                  builder: (_) => const BrowseScreen(
                                    initialCategory: 'All',
                                  ),
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
                        final isOffline =
                            context.read<NetworkBloc>().state is NetworkOffline;
                        if (state is CatalogLoading ||
                            state is CatalogInitial ||
                            isOffline) {
                          return SizedBox(
                            height: 285,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                              ),
                              itemCount: 4,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(width: 12),
                              itemBuilder: (_, __) => const SizedBox(
                                width: 165,
                                child: _HomeSkeletonCard(),
                              ),
                            ),
                          );
                        }

                        if (state is CatalogError) {
                          return SizedBox(
                            height: 285,
                            child: Center(
                              child: TextButton.icon(
                                onPressed: () => context
                                    .read<CatalogBloc>()
                                    .add(LoadCatalog(branchId: _getBranchId(context))),
                                icon: const Icon(Icons.refresh),
                                label: const Text('Retry products'),
                              ),
                            ),
                          );
                        }

                        List<Product> products = [];
                        if (state is CatalogLoaded) {
                          products = state.products
                              .where((p) => p.isSubscribable)
                              .toList();
                        }
                        if (products.isEmpty) {
                          return SizedBox(
                            height: 285,
                            child: Center(
                              child: TextButton.icon(
                                onPressed: () => context
                                    .read<CatalogBloc>()
                                    .add(LoadCatalog(branchId: _getBranchId(context))),
                                icon: const Icon(Icons.refresh),
                                label: const Text('Retry products'),
                              ),
                            ),
                          );
                        }
                        return InfiniteAutoScrollList(
                          height: 285,
                          itemWidth: 165,
                          autoScrollInterval: const Duration(
                            milliseconds: 10000,
                          ),
                          scrollDuration: const Duration(milliseconds: 1000),
                          animateClockwise: true,
                          items: products
                              .map(
                                (p) => Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 4,
                                  ),
                                  child: _subscriptionProductCard(context, p),
                                ),
                              )
                              .toList(),
                        );
                      },
                    ),
                  ),

                  // 5. Image Banner (Below Subscription Products)
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: ImageBanner(),
                    ),
                  ),

                  const SliverToBoxAdapter(child: HomeCouponBanner()),

                  // 6. Popular Product
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
                      child: Row(
                        children: [
                          const Text(
                            'Popular Products',
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
                                  builder: (_) => const BrowseScreen(
                                    initialCategory: 'All',
                                  ),
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
                        final isOffline =
                            context.read<NetworkBloc>().state is NetworkOffline;
                        if (state is CatalogLoading ||
                            state is CatalogInitial ||
                            isOffline) {
                          return SizedBox(
                            height: 285,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                              ),
                              itemCount: 4,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(width: 12),
                              itemBuilder: (_, __) => const SizedBox(
                                width: 165,
                                child: _HomeSkeletonCard(),
                              ),
                            ),
                          );
                        }

                        if (state is CatalogError) {
                          return const SizedBox.shrink();
                        }

                        // Popular Products: in-stock, non-subscribable, rated — highest first
                        List<Product> products = [];
                        if (state is CatalogLoaded) {
                          final all = state.products
                              .where((p) =>
                                  !p.isSubscribable &&
                                  !p.isOutOfStock &&
                                  p.rating > 0)
                              .toList()
                            ..sort((a, b) => b.rating.compareTo(a.rating));
                          products = all.take(20).toList();
                        }
                        if (products.isEmpty) {
                          return const SizedBox.shrink();
                        }
                        return InfiniteAutoScrollList(
                          height: 285,
                          itemWidth: 165,
                          autoScrollInterval: const Duration(
                            milliseconds: 12000,
                          ),
                          scrollDuration: const Duration(milliseconds: 1000),
                          animateClockwise: false,
                          items: products
                              .map(
                                (p) => Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 4,
                                  ),
                                  child: oneTimeProductCard(context, p),
                                ),
                              )
                              .toList(),
                        );
                      },
                    ),
                  ),

                  // 7. Per-category product groups with inline banners
                  SliverToBoxAdapter(
                    child: BlocBuilder<CatalogBloc, CatalogState>(
                      builder: (context, state) {
                        if (state is! CatalogLoaded) return const SizedBox.shrink();
                        return _CategoryProductGroups(
                          allProducts: state.products,
                        );
                      },
                    ),
                  ),

                  // 8. Referral Banner (Invite Friends, Earn Rewards!)
                  const SliverToBoxAdapter(child: ReferralInviteCard()),

                  // 9. The F2H Promise
                  SliverToBoxAdapter(child: _promiseStrip()),

                  const SliverToBoxAdapter(child: SizedBox(height: 160)),
                ],
              ),
            ),
            AnimatedPositioned(
              duration: const Duration(milliseconds: 280),
              curve: Curves.easeOutCubic,
              left: 0,
              right: 0,
              bottom: widget.isNavVisible ? 74 : 16,
              child: const FloatingCartBar(),
            ),
          ],
        ),
      ),
    ),
  );
}

  Widget _branchInfoChip(BuildContext context) {
    return BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
      builder: (context, session) {
        AddressModel? defaultAddr;
        try {
          defaultAddr = session.addresses.firstWhere((a) => a.isDefault);
        } catch (_) {
          if (session.addresses.isNotEmpty) {
            defaultAddr = session.addresses.first;
          }
        }

        String locationLabel = 'Set Location';
        String? branchName;
        final branchId = defaultAddr?.branchId;
        if (branchId != null && branchId.isNotEmpty) {
          final matchingBranch = session.branches.firstWhere(
            (b) => (b is Map && (b['branch_id'] == branchId || b['id']?.toString() == branchId)),
            orElse: () => null,
          );
          if (matchingBranch != null && matchingBranch is Map) {
            branchName = matchingBranch['branch_name']?.toString() ?? matchingBranch['name']?.toString();
          }
        }

        if (defaultAddr != null) {
          if (defaultAddr.area.isNotEmpty) {
            locationLabel = defaultAddr.area;
          } else if (defaultAddr.city.isNotEmpty) {
            locationLabel = defaultAddr.city;
          } else if (branchName != null && branchName.isNotEmpty) {
            locationLabel = branchName;
          }
        }

        final bool hasBranch = branchId != null && branchId.isNotEmpty;

        return PopupMenuButton<dynamic>(
          offset: const Offset(0, 40),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          color: Colors.white,
          elevation: 8,
          onSelected: (value) async {
            final sessionCubit = context.read<CustomerSessionCubit>();
            final catalogBloc = context.read<CatalogBloc>();

            if (value is AddressModel) {
              final addrId = (value.addressId != null && value.addressId!.isNotEmpty)
                  ? value.addressId!
                  : ((value.id != null && value.id!.isNotEmpty) ? value.id! : value.uniqueId);

              await sessionCubit.updateDefaultAddress(addrId);
              if (context.mounted) {
                final labelName = value.area.isNotEmpty
                    ? value.area
                    : (value.city.isNotEmpty ? value.city : value.name);
                F2HToast.success(context, 'Delivery address set to $labelName');
                final latestSession = sessionCubit.state;
                AddressModel? activeAddr;
                try {
                  activeAddr = latestSession.addresses.firstWhere((a) => a.isDefault);
                } catch (_) {}
                final targetBranchId = (activeAddr?.branchId.isNotEmpty == true)
                    ? activeAddr!.branchId
                    : (value.branchId.isNotEmpty ? value.branchId : (latestSession.profile?.branchId ?? ''));
                if (targetBranchId.isNotEmpty) {
                  catalogBloc.add(LoadCatalog(branchId: targetBranchId));
                }
              }
            } else if (value == 'manage') {
              final chosen = await AddressSelectorDrawer.show(context);
              if (context.mounted) {
                await sessionCubit.refreshSilently();
                final latestSession = sessionCubit.state;
                AddressModel? activeAddr = chosen;
                if (latestSession.addresses.isNotEmpty) {
                  try {
                    activeAddr = latestSession.addresses.firstWhere((a) => a.isDefault);
                  } catch (_) {
                    activeAddr ??= latestSession.addresses.first;
                  }
                }
                final targetBranchId = (activeAddr?.branchId.isNotEmpty == true)
                    ? activeAddr!.branchId
                    : (latestSession.profile?.branchId ?? '');
                if (targetBranchId.isNotEmpty) {
                  catalogBloc.add(LoadCatalog(branchId: targetBranchId));
                }
              }
            }
          },
          itemBuilder: (context) {
            return [
              if (session.addresses.isNotEmpty) ...[
                const PopupMenuItem<dynamic>(
                  enabled: false,
                  height: 28,
                  child: Text(
                    'SELECT DELIVERY ADDRESS',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: kTextSub,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                ...session.addresses.map((addr) {
                  final isSelected = defaultAddr != null && addr.addressId == defaultAddr.addressId;
                  final label = addr.area.isNotEmpty
                      ? addr.area
                      : (addr.city.isNotEmpty ? addr.city : addr.name);
                  final subLabel = addr.detail;
                  final typeBadge = addr.addressType.toUpperCase();

                  return PopupMenuItem<dynamic>(
                    value: addr,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        children: [
                          Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isSelected ? const Color(0xFF16653A) : const Color(0xFFF3F4F6),
                            ),
                            child: Icon(
                              isSelected ? Icons.check : Icons.location_on_outlined,
                              color: isSelected ? Colors.white : kTextSub,
                              size: 13,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        label,
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700,
                                          color: isSelected ? const Color(0xFF16653A) : kText,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                      decoration: BoxDecoration(
                                        color: kPrimaryPl,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        typeBadge,
                                        style: const TextStyle(
                                          fontSize: 8,
                                          fontWeight: FontWeight.w800,
                                          color: kPrimary,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  subLabel,
                                  style: const TextStyle(fontSize: 10, color: kTextSub),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                const PopupMenuDivider(),
              ],
              PopupMenuItem<dynamic>(
                value: 'manage',
                child: Row(
                  children: const [
                    Icon(Icons.add_location_alt_rounded, color: kPrimary, size: 16),
                    SizedBox(width: 8),
                    Text(
                      'Manage / Add New Address',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: kPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ];
          },
          child: Container(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
            constraints: const BoxConstraints(maxWidth: 160),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: const Color(0xFF16653A).withValues(alpha: 0.15),
                width: 1.0,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Icon(
                  hasBranch ? Icons.location_on_rounded : Icons.add_location_alt_rounded,
                  color: const Color(0xFF16653A),
                  size: 15,
                ),
                const SizedBox(width: 4),
                Flexible(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        locationLabel,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF16653A),
                          height: 1.1,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (branchName != null && branchName.isNotEmpty && branchName != locationLabel)
                        Text(
                          branchName,
                          style: const TextStyle(
                            fontSize: 8.5,
                            fontWeight: FontWeight.w600,
                            color: kTextSub,
                            height: 1.1,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 2),
                const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: Color(0xFF16653A),
                  size: 14,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _noAddressPromptCard(BuildContext context) {
    return BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
      builder: (context, session) {
        if (session.addresses.isNotEmpty) return const SizedBox.shrink();

        return Align(
          alignment: Alignment.center,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 500),
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 12, 16, 6),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFECFDF5), Color(0xFFD1FAE5)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: const Color(0xFF16A34A).withValues(alpha: 0.45),
                  width: 1.2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF16A34A).withValues(alpha: 0.12),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF15803D), Color(0xFF16A34A)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF16A34A).withValues(alpha: 0.35),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.location_on_rounded,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Select Delivery Address',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF14532D),
                            letterSpacing: -0.2,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Set your location for accurate stock & delivery times.',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF16A34A),
                            height: 1.25,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () async {
                      final sessionCubit = context.read<CustomerSessionCubit>();
                      final catalogBloc = context.read<CatalogBloc>();
                      final chosen = await AddressSelectorDrawer.show(context);
                      if (context.mounted) {
                        await sessionCubit.refreshSilently();
                        final session = sessionCubit.state;
                        AddressModel? activeAddr = chosen;
                        if (session.addresses.isNotEmpty) {
                          try {
                            activeAddr = session.addresses.firstWhere((a) => a.isDefault);
                          } catch (_) {
                            activeAddr ??= session.addresses.first;
                          }
                        }
                        final targetBranchId = (activeAddr?.branchId.isNotEmpty == true)
                            ? activeAddr!.branchId
                            : (session.profile?.branchId ?? '');
                        if (targetBranchId.isNotEmpty) {
                          catalogBloc.add(LoadCatalog(branchId: targetBranchId));
                        }
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF15803D), Color(0xFF16A34A)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF16A34A).withValues(alpha: 0.35),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Set',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                          SizedBox(width: 3),
                          Icon(
                            Icons.chevron_right_rounded,
                            color: Colors.white,
                            size: 16,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
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
                      builder: (_) =>
                          const BrowseScreen(initialCategory: 'All'),
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
                  // bgColor: bgColor,
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
                      builder: (_) =>
                          const BrowseScreen(initialCategory: 'All'),
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
                            : (bgColor?.withValues(alpha: 0.8) ??
                                  const Color(0xFFECEFF1))),
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
                  Container(width: 1, height: 36, color: kBorderLt),
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _subscriptionProductCard(BuildContext context, Product p) {
    return SizedBox(
      width: 165,
      child: ProductGridCard(p),
    );
  }

  Widget oneTimeProductCard(BuildContext context, Product p) {
    return SizedBox(
      width: 165,
      child: ProductGridCard(p),
    );
  }

  Widget _subscriptionBanner() {
    final imageUrl =
        '${ApiEndpoints.host}/uploads/banners/subscription_banner.png';
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: AspectRatio(
          aspectRatio: 2.75,
          child: GestureDetector(
            onTap: () => AppShell.of(context)?.setTab(1),
            child: Image.network(
              imageUrl,
              fit: BoxFit.cover,
              width: double.infinity,
              errorBuilder: (context, error, stackTrace) => Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF16A34A),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'Save Up To 5%',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Subscription to fresh milk, curd, paneer & more for hassle-free morning deliveries.',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 11,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.amber,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text(
                        'Order Now >',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.black,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _freshBatchStepper() {
    final steps = [
      (
        svg:
            '''<svg viewBox="0 0 24 24" fill="none" stroke="#16653A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 10h12l-1 11H7L6 10z"/>
          <path d="M9 10V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v5"/>
          <line x1="7" y1="5" x2="17" y2="5"/>
        </svg>''',
        label: 'Collected',
      ),
      (
        svg:
            '''<svg viewBox="0 0 24 24" fill="none" stroke="#16653A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 20h6a2 2 0 0 0 2-2V10a4 4 0 0 0-1-2.63V4a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v3.37A4 4 0 0 0 7 10v8a2 2 0 0 0 2 2z"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
          <line x1="9" y1="6" x2="15" y2="6"/>
        </svg>''',
        label: 'Packed',
      ),
      (
        svg:
            '''<svg viewBox="0 0 24 24" fill="none" stroke="#16653A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="2" ry="2"/>
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>''',
        label: 'In Delivery',
      ),
      (
        svg:
            '''<svg viewBox="0 0 24 24" fill="none" stroke="#16653A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>''',
        label: 'Delivered',
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
                      child: SvgPicture.string(step.svg, width: 22, height: 22),
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
    final List<({IconData icon, String label, VoidCallback? onTap})>
    promises = [
      (
        icon: Icons.notifications_off_rounded,
        label: 'Zero Contact,\nNo Ring',
        onTap: null,
      ),
      (icon: Icons.verified_rounded, label: 'Premium\nQuality', onTap: null),
      (icon: Icons.eco_rounded, label: '100% Safe\n& Hygienic', onTap: null),
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
                  Icon(p.icon, color: const Color(0xFF16653A), size: 22),
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
                          children: List.generate(
                            5,
                            (_) => const Icon(
                              Icons.star_rounded,
                              color: kAccent,
                              size: 14,
                            ),
                          ),
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

  // Widget _referralBanner() {
  //   return const ReferralInviteCard();
  // }

  Widget _buildFloatingCartBadge() {
    return BlocBuilder<CartBloc, CartState>(
      builder: (context, state) {
        final items = context.read<CartBloc>().currentItems;
        int total = 0;
        total = items.fold(0, (sum, item) {
          if (item.purchaseType == 'subscription') {
            final schedSum =
                item.schedules?.fold(
                  0,
                  (s, sched) => s + sched.mQuantity + sched.eQuantity,
                ) ??
                0;
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
  final Widget branchWidget;
  final VoidCallback onSearchTap;

  HomeHeaderDelegate({
    required this.topPadding,
    required this.searchHint,
    required this.branchWidget,
    required this.onSearchTap,
  });

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    final double minHeight = minExtent;
    final double maxHeight = maxExtent;
    final double delta = maxHeight - minHeight;
    final double shrinkFactor = delta > 0
        ? (shrinkOffset / delta).clamp(0.0, 1.0)
        : 0.0;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: shrinkFactor > 0.8
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ]
            : [],
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Farm Background Image (fades out as header collapses)
          Opacity(
            opacity: (1.0 - shrinkFactor).clamp(0.0, 1.0),
            child: AppAssetImage(
              assetKey: 'api/uploads/app_assets/bg/home_bg.jpg',
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
              errorBuilder: (context, error, stackTrace) {
                return Container(color: const Color(0xFFE8F5E9));
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
                  colors: [Colors.transparent, kBg.withValues(alpha: 0.85)],
                ),
              ),
            ),
          ),

          // 4. Top Row (App Logo, Title, Branch Info, Notification Bell) - fades out
          Positioned(
            top: topPadding + 10,
            left: 12,
            right: 12,
            child: Opacity(
              opacity: (1.0 - shrinkFactor * 1.8).clamp(0.0, 1.0),
              child: Row(
                children: [
                  Flexible(
                    flex: 5,
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.asset(
                              'assets/icon/app_icon.png',
                              width: 28,
                              height: 28,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) {
                                return Container(
                                  width: 28,
                                  height: 28,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF16653A),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(
                                    Icons.eco_rounded,
                                    color: Colors.white,
                                    size: 18,
                                  ),
                                );
                              },
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Text(
                            'Farm to Home',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF16653A),
                              letterSpacing: -0.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Flexible(
                    flex: 6,
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerRight,
                        child: branchWidget,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  _buildNotificationBell(context),
                ],
              ),
            ),
          ),

          // 5. Search Bar (slides up to stick at top)
          Positioned(
            left: 16,
            right: 16,
            top:
                topPadding +
                208 -
                (shrinkFactor *
                    200), // Interpolates from topPadding+208 to topPadding+8
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
                    width: 1.0,
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

  Widget _buildNotificationBell(BuildContext context) {
    return BlocBuilder<NotificationsBloc, NotificationsState>(
      builder: (context, state) {
        bool hasUnread = false;
        if (state is NotificationsLoaded) {
          hasUnread = state.unreadCount > 0;
        }
        return GestureDetector(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const NotificationsScreen(),
              ),
            );
          },
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              border: Border.all(
                color: const Color(0xFF16653A).withValues(alpha: 0.15),
                width: 1.0,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                const Icon(
                  Icons.notifications_none_rounded,
                  color: Color(0xFF16653A),
                  size: 20,
                ),
                if (hasUnread)
                  Positioned(
                    top: 7,
                    right: 7,
                    child: Container(
                      width: 7.5,
                      height: 7.5,
                      decoration: const BoxDecoration(
                        color: Color(0xFFEF4444),
                        shape: BoxShape.circle,
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

  @override
  double get maxExtent => 300;

  @override
  double get minExtent => topPadding + 62;

  @override
  bool shouldRebuild(covariant HomeHeaderDelegate oldDelegate) {
    return oldDelegate.searchHint != searchHint ||
        oldDelegate.branchWidget != branchWidget ||
        oldDelegate.topPadding != topPadding;
  }
}

// ══════════════════════════════════════════════════════════
//  REUSABLE HOME SCREEN ONE-TIME PRODUCT CARD
// ══════════════════════════════════════════════════════════

Widget oneTimeProductCard(BuildContext context, Product p) {
  int discountPercent = 0;
  if (p.originalPrice > p.price && p.originalPrice > 0) {
    discountPercent = (((p.originalPrice - p.price) / p.originalPrice) * 100).round();
  }

  final cardWidget = GestureDetector(
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
      width: 162,
      margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderLt, width: 1.1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 3),
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
                color: const Color(0xFFF8FAFC),
                child: Padding(
                  padding: const EdgeInsets.all(6.0),
                  child: buildProductImage(
                    p.name,
                    imageAsset: p.imageAsset,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
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
                    if ((p.formattedUnit.isNotEmpty ? p.formattedUnit : p.unit)
                            .isNotEmpty &&
                        (p.formattedUnit.isNotEmpty ? p.formattedUnit : p.unit)
                                .toLowerCase() !=
                            p.name.toLowerCase()) ...[
                      const SizedBox(height: 3),
                      Text(
                        p.formattedUnit.isNotEmpty
                            ? p.formattedUnit
                            : p.unit,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w500,
                          color: kTextSub,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              '₹${p.price.toStringAsFixed(0)}',
                              style: const TextStyle(
                                fontSize: 15.5,
                                fontWeight: FontWeight.w900,
                                color: kText,
                              ),
                            ),
                            if (p.originalPrice > p.price) ...[
                              const SizedBox(width: 3.5),
                              Text(
                                '₹${p.originalPrice.toStringAsFixed(0)}',
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  color: kMuted,
                                  decoration: TextDecoration.lineThrough,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    ZeptoAddButton(p: p, isSmall: true),
                  ],
                ),
              ),
            ],
          ),
          // Top Overlay Badges (Discount + Rating) - Auto Responsive Scaling for All Mobile Sizes
          Positioned(
            top: 6,
            left: 6,
            right: 6,
            child: SizedBox(
              height: 20,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (p.isOutOfStock)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: const Color(0xFFEF4444), width: 0.9),
                        ),
                        child: const Text(
                          'OUT OF STOCK',
                          style: TextStyle(
                            fontSize: 7.5,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFFEF4444),
                            letterSpacing: 0.2,
                          ),
                        ),
                      )
                    else if (discountPercent > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5.5, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF047857),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '$discountPercent% OFF',
                          style: const TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            letterSpacing: 0.2,
                          ),
                        ),
                      )
                    else
                      const SizedBox.shrink(),
                    const SizedBox(width: 4),
                    // Top Right: Rating Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4.5, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: const Color(0xFFE5E7EB), width: 0.8),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.02),
                            blurRadius: 2,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.star_rounded,
                            size: 10,
                            color: Color(0xFFF59E0B),
                          ),
                          const SizedBox(width: 2),
                          Text(
                            '${(p.rating > 0 ? p.rating : 5.0).toStringAsFixed(1)} (${p.reviews > 0 ? p.reviews : 1})',
                            style: const TextStyle(
                              fontSize: 8,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF374151),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Bottom of Image: Subscribe pill (if subscribable)
          if (p.isSubscribable && !p.isOutOfStock)
            Positioned(
              top: 94,
              left: 6,
              right: 6,
              child: Container(
                height: 22,
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(
                  color: kPrimary,
                  borderRadius: BorderRadius.circular(100),
                ),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.center,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.autorenew_rounded,
                        size: 10,
                        color: Colors.white,
                      ),
                      const SizedBox(width: 2),
                      Text(
                        'Subscribe @ ₹${(p.subscriptionPrice != null && p.subscriptionPrice! > 0 ? p.subscriptionPrice! : p.price).toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 2),
                      const Icon(
                        Icons.chevron_right_rounded,
                        size: 11,
                        color: Colors.white,
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
  );

  if (p.isOutOfStock) {
    return ColorFiltered(
      colorFilter: const ColorFilter.matrix(<double>[
        0.2126, 0.7152, 0.0722, 0, 0,
        0.2126, 0.7152, 0.0722, 0, 0,
        0.2126, 0.7152, 0.0722, 0, 0,
        0,      0,      0,      1, 0,
      ]),
      child: cardWidget,
    );
  }
  return cardWidget;
}

// ══════════════════════════════════════════════════════════
//  PER-CATEGORY PRODUCT GROUPS WITH INLINE BANNERS
//  Fetches category_slide banners from the existing promo-banners
//  endpoint, groups in-stock / non-subscribable products by category,
//  and renders an inline banner above each group that has a matching
//  product_banner row.
// ══════════════════════════════════════════════════════════

class _CategoryProductGroups extends StatefulWidget {
  final List<Product> allProducts;
  const _CategoryProductGroups({required this.allProducts});

  @override
  State<_CategoryProductGroups> createState() => _CategoryProductGroupsState();
}

class _CategoryProductGroupsState extends State<_CategoryProductGroups> {
  /// Map from lowercase category name → banner data from promo-banners API.
  final Map<String, Map<String, dynamic>> _categoryBanners = {};
  bool _bannersLoaded = false;

  @override
  void initState() {
    super.initState();
    _fetchCategoryBanners();
  }

  Future<void> _fetchCategoryBanners() async {
    try {
      final resp = await DioClient().dio.get(ApiEndpoints.promoBanners);
      dynamic data = resp.data;
      if (data is String) data = jsonDecode(data);
      if (data is Map && data['status'] == true && data['data'] is List) {
        for (final b in data['data'] as List) {
          final bannerType = (b['bannerType'] ?? b['banner_type'] ?? '').toString().toLowerCase();
          if (bannerType.isNotEmpty && bannerType != 'category_slide') continue;
          final actionType = (b['actionType'] ?? '').toString().toUpperCase();
          final actionValue = b['actionValue']?.toString() ?? '';
          if (actionType == 'CATEGORY' && actionValue.isNotEmpty) {
            _categoryBanners[actionValue.toLowerCase()] =
                Map<String, dynamic>.from(b as Map);
          }
        }
      }
    } catch (_) {
      // Non-critical — fall through, groups render without banners
    }
    if (mounted) setState(() => _bannersLoaded = true);
  }

  String _formatImageUrl(String rawUrl) {
    if (rawUrl.isEmpty) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      final uri = Uri.tryParse(rawUrl);
      if (uri != null) {
        const devHosts = {'localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2'};
        if (devHosts.contains(uri.host)) {
          return 'https://f2hfresh.com${uri.path}';
        }
        return rawUrl;
      }
    }
    if (rawUrl.contains('/uploads/')) {
      final pathAfterUploads = rawUrl.substring(rawUrl.indexOf('/uploads/'));
      return 'https://f2hfresh.com$pathAfterUploads';
    }
    if (rawUrl.contains('/assets/')) {
      final pathAfterAssets = rawUrl.substring(rawUrl.indexOf('/assets/'));
      return 'https://f2hfresh.com$pathAfterAssets';
    }
    final clean = rawUrl.startsWith('/') ? rawUrl : '/$rawUrl';
    return 'https://f2hfresh.com$clean';
  }

  /// Group in-stock, non-subscribable, rated products by category.
  Map<String, List<Product>> _groupByCategory() {
    final eligible = widget.allProducts
        .where((p) => !p.isSubscribable && !p.isOutOfStock)
        .toList()
      ..sort((a, b) => b.rating.compareTo(a.rating));

    final Map<String, List<Product>> groups = {};
    for (final p in eligible) {
      final cat = p.category.isNotEmpty ? p.category : 'Other';
      groups.putIfAbsent(cat, () => []).add(p);
    }
    // Keep groups with at least 2 products; sort groups by name
    final filtered = Map.fromEntries(
      groups.entries
          .where((e) => e.value.length >= 2)
          .toList()
        ..sort((a, b) => a.key.compareTo(b.key)),
    );
    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final groups = _groupByCategory();
    if (groups.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final entry in groups.entries) ...[
          _CategorySection(
            categoryName: entry.key,
            products: entry.value,
            banner: _bannersLoaded
                ? (_categoryBanners[entry.key.toLowerCase()] ??
                    _categoryBanners.entries
                        .where((e) => entry.key
                            .toLowerCase()
                            .contains(e.key.toLowerCase()))
                        .map((e) => e.value)
                        .firstOrNull)
                : null,
            formatImageUrl: _formatImageUrl,
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single category group: header + optional inline banner + product scroll
// ─────────────────────────────────────────────────────────────────────────────
class _CategorySection extends StatelessWidget {
  final String categoryName;
  final List<Product> products;
  final Map<String, dynamic>? banner;
  final String Function(String) formatImageUrl;

  const _CategorySection({
    required this.categoryName,
    required this.products,
    required this.banner,
    required this.formatImageUrl,
  });

  void _onBannerTap(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => BrowseScreen(initialCategory: categoryName),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Category header ─────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
          child: Row(
            children: [
              Text(
                categoryName,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: kText,
                  letterSpacing: -0.3,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) =>
                        BrowseScreen(initialCategory: categoryName),
                  ),
                ),
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
                    Icon(Icons.arrow_forward, size: 12, color: Color(0xFF16653A)),
                  ],
                ),
              ),
            ],
          ),
        ),

        // ── Inline category banner (if admin set one for this category) ─────
        if (banner != null) ...[
          GestureDetector(
            onTap: () => _onBannerTap(context),
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              height: 90,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: const Color(0xFF15803D),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    // Banner image
                    Image.network(
                      formatImageUrl(banner!['imageUrl']?.toString() ?? ''),
                      fit: BoxFit.fill,
                      width: double.infinity,
                      errorBuilder: (_, __, ___) => Container(
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF15803D), Color(0xFF22C55E)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    banner!['title']?.toString() ?? categoryName,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15,
                                    ),
                                  ),
                                  if ((banner!['subtitle'] ?? '').toString().isNotEmpty)
                                    Text(
                                      banner!['subtitle'].toString(),
                                      style: const TextStyle(
                                        color: Colors.white70,
                                        fontSize: 11,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                banner!['cta']?.toString() ?? 'Shop Now',
                                style: const TextStyle(
                                  color: Color(0xFF15803D),
                                  fontWeight: FontWeight.w800,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    // Tap ripple overlay
                    Positioned.fill(
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(14),
                          onTap: () => _onBannerTap(context),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],

        // ── Horizontal product scroll for this category ──────────────────────
        SizedBox(
          height: 285,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: products.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (ctx, i) => SizedBox(
              width: 165,
              child: ProductGridCard(products[i]),
            ),
          ),
        ),

        const SizedBox(height: 8),
      ],
    );
  }
}
