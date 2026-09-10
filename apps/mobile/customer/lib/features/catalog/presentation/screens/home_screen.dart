import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import '../widgets/promo_banner.dart';
import '../widgets/today_delivery_partner_card.dart';
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
import '../../../wallet/presentation/screens/wallet_screen.dart';
import '../../../../core/widgets/popup_banner_widget.dart';
import '../../../../core/widgets/unpaid_bill_banner_widget.dart';
import 'package:f2h_customer/core/guards/auth_guard.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_bloc.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_state.dart';
import 'package:f2h_customer/features/subscription/presentation/screens/subscription_setup_screen.dart';
import 'package:f2h_customer/features/subscription/presentation/screens/my_subscriptions_screen.dart';
import 'package:f2h_customer/core/auth/token_storage.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import '../../../profile/presentation/screens/profile_screen.dart';

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


  }

  @override
  void dispose() {
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
                  await context.read<CustomerSessionCubit>().refreshSilently();
                  UnpaidBillBannerWidget.refresh();

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
                    // 1. Sticky App Header with Address, Search Option & Profile
                    SliverPersistentHeader(
                      pinned: true,
                      delegate: HomeHeaderDelegate(
                        topPadding: MediaQuery.of(context).padding.top,
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

                    // 1B. Unpaid / Pending Postpaid Bill Banner
                    const SliverToBoxAdapter(child: UnpaidBillBannerWidget()),

                    // 2. Delivery Address Prompt (if no default address/branch set)
                    SliverToBoxAdapter(child: _noAddressPromptCard(context)),

                    // 2B. Today & Current Slot Delivery Partner Card(s)
                    SliverToBoxAdapter(
                      child: BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
                        builder: (context, session) {
                          if (session.todayDeliveryPartners.isEmpty) {
                            return const SizedBox.shrink();
                          }
                          return Padding(
                            padding: const EdgeInsets.only(top: 4, bottom: 4),
                            child: TodayDeliveryPartnersSection(
                              partners: session.todayDeliveryPartners,
                            ),
                          );
                        },
                      ),
                    ),

                    // 2C. Weekly Delivery Schedule Calendar (like in reference image)
                    SliverToBoxAdapter(
                      child: HomeDeliveryCalendarCard(
                        onCalendarTap: () => AppShell.of(context)?.setTab(2),
                      ),
                    ),

                    // 3. Top Banner (with banner count dots)
                    const SliverToBoxAdapter(child: PromoBanner()),

                    // 4. Subscription Products (Daily doorstep delivery with subscribe options)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
                        child: Row(
                          children: [
                            const Text(
                              'Subscription Products',
                              style: TextStyle(
                                fontSize: 18,
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
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF16A34A),
                                    ),
                                  ),
                                  SizedBox(width: 4),
                                  Icon(
                                    Icons.arrow_forward_ios_rounded,
                                    size: 12,
                                    color: Color(0xFF16A34A),
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
                              height: 255,
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
                              height: 255,
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
                            return const SizedBox.shrink();
                          }
                          return SizedBox(
                            height: 255,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                              ),
                              itemCount: products.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(width: 12),
                              itemBuilder: (context, index) {
                                return _subscriptionProductCard(
                                  context,
                                  products[index],
                                );
                              },
                            ),
                          );
                        },
                      ),
                    ),

                    // 5. Popular Products (Sorted based on ratings!)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 22, 16, 10),
                        child: Row(
                          children: [
                            const Text(
                              'Popular Products',
                              style: TextStyle(
                                fontSize: 18,
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
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF16A34A),
                                    ),
                                  ),
                                  SizedBox(width: 4),
                                  Icon(
                                    Icons.arrow_forward_ios_rounded,
                                    size: 12,
                                    color: Color(0xFF16A34A),
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
                          if (state is CatalogLoading ||
                              state is CatalogInitial) {
                            return SizedBox(
                              height: 275,
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

                          List<Product> popularProducts = [];
                          if (state is CatalogLoaded) {
                            final inStock = state.products
                                .where((p) => !p.isOutOfStock)
                                .toList();
                            inStock.sort((a, b) {
                              final r = b.rating.compareTo(a.rating);
                              if (r != 0) return r;
                              return b.reviews.compareTo(a.reviews);
                            });
                            popularProducts = inStock.take(15).toList();
                          }
                          if (popularProducts.isEmpty) {
                            return const SizedBox.shrink();
                          }
                          return SizedBox(
                            height: 275,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                              ),
                              itemCount: popularProducts.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(width: 12),
                              itemBuilder: (context, index) {
                                return oneTimeProductCard(
                                  context,
                                  popularProducts[index],
                                );
                              },
                            ),
                          );
                        },
                      ),
                    ),

                    // 6. Categories (Next show categories!)
                    const SliverToBoxAdapter(child: SizedBox(height: 10)),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
                        child: Row(
                          children: [
                            const Text(
                              'Shop by Category',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: kText,
                                letterSpacing: -0.4,
                              ),
                            ),
                            const Spacer(),
                            GestureDetector(
                              onTap: () => AppShell.of(context)?.setTab(1),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    'See All',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF16A34A),
                                    ),
                                  ),
                                  SizedBox(width: 4),
                                  Icon(
                                    Icons.arrow_forward_ios_rounded,
                                    size: 12,
                                    color: Color(0xFF16A34A),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    SliverToBoxAdapter(child: _categoryShortcuts()),

                    const SliverToBoxAdapter(child: SizedBox(height: 16)),

                    // 7. Promotional Offer Cards (Live Preview Style)
                    const SliverToBoxAdapter(child: _HomeBottomPromoBanners()),
                    const SliverToBoxAdapter(child: SizedBox(height: 16)),

                    // 8. Per-category product groups with inline banners
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

                    // Spacing before Referral
                    const SliverToBoxAdapter(child: SizedBox(height: 16)),

                  // 8. Referral Banner (Invite Friends, Earn Rewards!)
                  const SliverToBoxAdapter(
                    child: ReferralInviteCard(
                      margin: EdgeInsets.symmetric(horizontal: 16),
                    ),
                  ),



                  // Spacing before Promise Strip
                  const SliverToBoxAdapter(child: SizedBox(height: 20)),

                  // 9. The F2H Promise
                  SliverToBoxAdapter(child: _promiseStrip()),

                  SliverToBoxAdapter(
                    child: SizedBox(height: floatingCartBarClearance(context)),
                  ),
                ],
              ),
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
    ),
  );
}

  Future<bool> _isUserAuthenticated() async {
    final authState = context.read<AuthBloc>().state;
    final sessionState = context.read<CustomerSessionCubit>().state;
    if (authState is Authenticated || sessionState.profile != null) return true;
    return await TokenStorage.hasSession();
  }

  Future<void> _handleAddressTap() async {
    final isAuthed = await _isUserAuthenticated();
    if (!isAuthed) {
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => const LoginScreen(popOnSuccess: true),
        ),
      );
      return;
    }

    final sessionCubit = context.read<CustomerSessionCubit>();
    final catalogBloc = context.read<CatalogBloc>();

    final chosen = await AddressSelectorDrawer.show(context);
    if (!mounted) return;

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

        String? branchName;
        final branchId = defaultAddr?.branchId ?? session.profile?.branchId;
        if (branchId != null && branchId.isNotEmpty) {
          final matchingBranch = session.branches.firstWhere(
            (b) => (b is Map && (b['branch_id'] == branchId || b['id']?.toString() == branchId)),
            orElse: () => null,
          );
          if (matchingBranch != null && matchingBranch is Map) {
            branchName = matchingBranch['branch_name']?.toString() ?? matchingBranch['name']?.toString();
          }
        }
        if ((branchName == null || branchName.isEmpty) && defaultAddr?.branchName != null && defaultAddr!.branchName!.isNotEmpty) {
          branchName = defaultAddr.branchName;
        }
        if ((branchName == null || branchName.isEmpty) && session.branches.isNotEmpty) {
          final firstB = session.branches.first;
          if (firstB is Map) {
            branchName = firstB['branch_name']?.toString() ?? firstB['name']?.toString();
          }
        }

        String branchDisplay = '';
        if (branchName != null && branchName.trim().isNotEmpty) {
          final clean = branchName.replaceAll(RegExp(r'\s+'), ' ').trim();
          if (clean.isNotEmpty) {
            branchDisplay = clean.split(' ').map((w) {
              if (w.isEmpty) return '';
              return '${w[0].toUpperCase()}${w.substring(1)}';
            }).join(' ');
          }
        }

        String addressType = '';
        if (defaultAddr != null) {
          if (defaultAddr.addressType.trim().isNotEmpty) {
            addressType = defaultAddr.addressType.trim();
          } else if (defaultAddr.label.trim().isNotEmpty) {
            addressType = defaultAddr.label.trim();
          } else {
            addressType = 'Home';
          }
          if (addressType.isNotEmpty) {
            addressType = '${addressType[0].toUpperCase()}${addressType.substring(1)}';
          }
        }

        final bool hasBranch = branchId != null && branchId.isNotEmpty;
        final bool hasAddress = defaultAddr != null;

        return MouseRegion(
          cursor: SystemMouseCursors.click,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: _handleAddressTap,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: const Color(0xFF16653A).withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    hasBranch || hasAddress ? Icons.location_on_rounded : Icons.add_location_alt_rounded,
                    color: const Color(0xFF16653A),
                    size: 18,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Flexible(
                            child: Text(
                              hasAddress ? addressType : 'Set Location',
                              style: const TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                                letterSpacing: -0.2,
                                height: 1.15,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 3),
                          const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            color: Color(0xFF16653A),
                            size: 16,
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        branchDisplay.isNotEmpty ? branchDisplay : 'Select Branch',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: branchDisplay.isNotEmpty ? FontWeight.w600 : FontWeight.w500,
                          color: branchDisplay.isNotEmpty ? const Color(0xFF16653A) : const Color(0xFF64748B),
                          height: 1.1,
                        ),
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
            child: MouseRegion(
              cursor: SystemMouseCursors.click,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _handleAddressTap,
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
                      Container(
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
                    ? const Color(0xFF16A34A)
                    : (isMore
                          ? const Color(0xFFECEFF1)
                          : (bgColor ?? Colors.white)),
                borderRadius: BorderRadius.circular(14),
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
              child: ClipRRect(
                borderRadius: BorderRadius.circular(13),
                child: icon != null
                    ? Center(
                        child: Icon(
                          icon,
                          color: isAll ? Colors.white : const Color(0xFF16653A),
                          size: 28,
                        ),
                      )
                    : (imagePath != null && imagePath.isNotEmpty
                          ? SizedBox(
                              width: double.infinity,
                              height: double.infinity,
                              child: buildProductImage(
                                label,
                                imageAsset: imagePath,
                                fit: BoxFit.cover,
                              ),
                            )
                          : const Center(
                              child: Icon(
                                Icons.shopping_bag_outlined,
                                color: Color(0xFF16653A),
                                size: 26,
                              ),
                            )),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              cleanCategoryName(label),
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
        icon: Icons.eco_outlined,
        title: 'Farm Fresh',
        sub: '100% Pure',
        color: const Color(0xFF16A34A),
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
    final unit = p.formattedUnit.isNotEmpty ? p.formattedUnit : p.unit;
    final subPrice = (p.subscriptionPrice != null && p.subscriptionPrice! > 0)
        ? p.subscriptionPrice!
        : p.price;

    return Container(
      width: 165,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      padding: const EdgeInsets.all(8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top row: "Subscribe" badge / Out of stock
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(5),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.repeat_rounded, size: 10, color: Color(0xFF16A34A)),
                    SizedBox(width: 3),
                    Text(
                      'Daily',
                      style: TextStyle(
                        color: Color(0xFF16A34A),
                        fontSize: 9.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              if (p.isOutOfStock)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'Out of stock',
                    style: TextStyle(
                      color: Color(0xFFDC2626),
                      fontSize: 8.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),

          // Center Product Image
          Expanded(
            child: GestureDetector(
              onTap: () => Navigator.push(
                context,
                PageRouteBuilder(
                  pageBuilder: (_, _, _) => ProductDetailViewScreen(product: p),
                  transitionsBuilder: (_, a, _, child) =>
                      FadeTransition(opacity: a, child: child),
                  transitionDuration: const Duration(milliseconds: 220),
                ),
              ),
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Hero(
                    tag: 'product-sub-${p.id}',
                    child: buildProductImage(
                      p.name,
                      imageAsset: p.imageAsset,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),

          // Row: Unit Tag + "Subscribe" button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  unit,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF475569),
                  ),
                ),
              ),
              InkWell(
                onTap: () {
                  context.runWithAuth(() {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => SubscriptionSetupScreen(product: p),
                      ),
                    );
                  });
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF16A34A), width: 1.5),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF16A34A).withValues(alpha: 0.08),
                        blurRadius: 4,
                        offset: const Offset(0, 1.5),
                      ),
                    ],
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.repeat_rounded, size: 11, color: Color(0xFF16A34A)),
                      SizedBox(width: 3),
                      Text(
                        'Subscribe',
                        style: TextStyle(
                          color: Color(0xFF16A34A),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),

          // Product Name
          GestureDetector(
            onTap: () => Navigator.push(
              context,
              PageRouteBuilder(
                pageBuilder: (_, _, _) => ProductDetailViewScreen(product: p),
                transitionsBuilder: (_, a, _, child) =>
                    FadeTransition(opacity: a, child: child),
                transitionDuration: const Duration(milliseconds: 220),
              ),
            ),
            child: Text(
              p.displayName,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
                height: 1.15,
              ),
            ),
          ),
          const SizedBox(height: 3),

          // Price row with / delivery
          Row(
            children: [
              Text(
                '₹${subPrice.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const Text(
                ' / delivery',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ],
      ),
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
      margin: const EdgeInsets.symmetric(horizontal: 16),
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

class InfiniteAutoScrollList extends StatelessWidget {
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
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: height,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: padding ?? const EdgeInsets.symmetric(horizontal: 12),
        itemCount: items.length,
        itemBuilder: (context, index) {
          return SizedBox(
            width: itemWidth,
            child: items[index],
          );
        },
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  WEEKLY DELIVERY SCHEDULE CALENDAR CARD (Matching Image)
// ══════════════════════════════════════════════════════════

class HomeDeliveryCalendarCard extends StatefulWidget {
  final VoidCallback? onCalendarTap;
  const HomeDeliveryCalendarCard({super.key, this.onCalendarTap});

  @override
  State<HomeDeliveryCalendarCard> createState() =>
      _HomeDeliveryCalendarCardState();
}

class _HomeDeliveryCalendarCardState extends State<HomeDeliveryCalendarCard> {
  late DateTime _selectedDate;
  bool _isCollapsed = false;

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime.now();
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    // Week starting on Sunday
    final diffToSunday = now.weekday % 7;
    final sunday = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: diffToSunday));
    final weekDays = List.generate(7, (i) => sunday.add(Duration(days: i)));

    // Check active subscriptions to see orders scheduled
    final subState = context.watch<SubscriptionBloc>().state;
    int ordersForSelectedDay = 0;
    if (subState is SubscriptionLoaded) {
      for (final sub in subState.subscriptions) {
        if (!sub.isActive && !sub.isPaused) continue;
        ordersForSelectedDay++;
      }
    }

    final scheduleTitle = ordersForSelectedDay > 0
        ? '$ordersForSelectedDay order${ordersForSelectedDay > 1 ? "s" : ""} scheduled for this day'
        : 'There are no orders scheduled for this day';

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F8FE), // soft light blue like screenshot
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFD6EAF8),
          width: 1.0,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row: Schedule status + Collapse/Expand toggle
          MouseRegion(
            cursor: SystemMouseCursors.click,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                setState(() {
                  _isCollapsed = !_isCollapsed;
                });
              },
              child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      const Icon(
                        Icons.calendar_month_rounded,
                        color: Color(0xFF0284C7),
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          scheduleTitle,
                          style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1E293B),
                            letterSpacing: -0.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  _isCollapsed
                      ? Icons.keyboard_arrow_down_rounded
                      : Icons.keyboard_arrow_up_rounded,
                  color: const Color(0xFF64748B),
                  size: 22,
                ),
              ],
            ),
          ),
        ),
          if (!_isCollapsed) ...[
            const SizedBox(height: 12),

            // 7 Days of the Week Selector Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: weekDays.map((day) {
                final isToday = _isSameDay(day, now);
                final isSelected = _isSameDay(day, _selectedDate);
                final dayName = isToday
                    ? 'Today'
                    : const [
                        'Sun',
                        'Mon',
                        'Tue',
                        'Wed',
                        'Thu',
                        'Fri',
                        'Sat'
                      ][day.weekday % 7];
                final dateNum = day.day.toString().padLeft(2, '0');

                return GestureDetector(
                  onTap: () {
                    setState(() {
                      _selectedDate = day;
                    });
                  },
                  behavior: HitTestBehavior.opaque,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        dayName,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight:
                              isSelected ? FontWeight.w700 : FontWeight.w500,
                          color: isSelected
                              ? const Color(0xFF0284C7)
                              : const Color(0xFF475569),
                        ),
                      ),
                      const SizedBox(height: 6),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 32,
                        height: 32,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: isSelected
                              ? const Color(0xFF1E88E5) // solid vivid blue circle
                              : Colors.transparent,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          dateNum,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: isSelected
                                ? Colors.white
                                : const Color(0xFF0F172A),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),

            const SizedBox(height: 14),

            // Status Legend Row: Delivered, Upcoming, Vacation, On Hold
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _legendItem(const Color(0xFF10B981), 'Delivered'),
                _legendItem(const Color(0xFF38BDF8), 'Upcoming'),
                _legendItem(const Color(0xFFF59E0B), 'Vacation'),
                _legendItem(const Color(0xFFEF4444), 'On Hold'),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _legendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 13,
          height: 3.5,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: Color(0xFF334155),
          ),
        ),
      ],
    );
  }
}

class HomeHeaderDelegate extends SliverPersistentHeaderDelegate {
  final double topPadding;
  final Widget branchWidget;
  final VoidCallback onSearchTap;

  HomeHeaderDelegate({
    required this.topPadding,
    required this.branchWidget,
    required this.onSearchTap,
  });

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(
            color: Color(0xFFF1F5F9),
            width: 1.0,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      padding: EdgeInsets.fromLTRB(12, topPadding + 6, 12, 8),
      alignment: Alignment.center,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // 1. Address Details (Left - Expanded)
          Expanded(
            child: branchWidget,
          ),
          const SizedBox(width: 8),

          // 2. Search Option (Action button without search text)
          _buildSearchButton(context),
          const SizedBox(width: 8),

          // 3. Profile Avatar Button (Right - Replaces Notification)
          _buildProfileButton(context),
        ],
      ),
    );
  }

  Widget _buildSearchButton(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onSearchTap,
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDF4),
            shape: BoxShape.circle,
            border: Border.all(
              color: const Color(0xFF16A34A),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF16A34A).withValues(alpha: 0.12),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: const Icon(
            Icons.search_rounded,
            color: Color(0xFF16653A),
            size: 20,
          ),
        ),
      ),
    );
  }

  Widget _buildProfileButton(BuildContext context) {
    return BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
      builder: (context, session) {
        final profile = session.profile;
        final bool isMember = profile?.isMember == true;

        String initials = '';
        if (profile != null) {
          final fn = profile.firstName.trim();
          final ln = profile.lastName.trim();
          if (fn.isNotEmpty && ln.isNotEmpty) {
            initials = '${fn[0]}${ln[0]}'.toUpperCase();
          } else if (profile.name.trim().isNotEmpty) {
            final parts = profile.name.trim().split(' ');
            if (parts.length > 1 && parts[0].isNotEmpty && parts[1].isNotEmpty) {
              initials = '${parts[0][0]}${parts[1][0]}'.toUpperCase();
            } else if (parts[0].isNotEmpty) {
              initials = parts[0][0].toUpperCase();
            }
          }
        }

        return MouseRegion(
          cursor: SystemMouseCursors.click,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const ProfileScreen(),
                ),
              );
            },
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: isMember
                    ? const LinearGradient(
                        colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : const LinearGradient(
                        colors: [Color(0xFFE2E8F0), Color(0xFFCBD5E1)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                boxShadow: [
                  BoxShadow(
                    color: isMember
                        ? const Color(0xFFF59E0B).withValues(alpha: 0.3)
                        : Colors.black.withValues(alpha: 0.06),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(2),
              child: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isMember ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                ),
                alignment: Alignment.center,
                child: initials.isNotEmpty
                    ? Text(
                        initials,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: isMember ? const Color(0xFFFFD700) : const Color(0xFF16653A),
                        ),
                      )
                    : Icon(
                        Icons.person_rounded,
                        size: 20,
                        color: isMember ? const Color(0xFFFFD700) : const Color(0xFF16653A),
                      ),
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  double get maxExtent => topPadding + 54;

  @override
  double get minExtent => topPadding + 54;

  @override
  bool shouldRebuild(covariant HomeHeaderDelegate oldDelegate) {
    return oldDelegate.branchWidget != branchWidget ||
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
                  child: p.isOutOfStock
                      ? ColorFiltered(
                          colorFilter: const ColorFilter.matrix(<double>[
                            0.2126, 0.7152, 0.0722, 0, 0,
                            0.2126, 0.7152, 0.0722, 0, 0,
                            0.2126, 0.7152, 0.0722, 0, 0,
                            0,      0,      0,      0.65, 0,
                          ]),
                          child: buildProductImage(
                            p.name,
                            imageAsset: p.imageAsset,
                            fit: BoxFit.contain,
                          ),
                        )
                      : buildProductImage(
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
                      p.displayName,
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
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: const Color(0xFFFCA5A5), width: 0.9),
                        ),
                        child: const Text(
                          'OUT OF STOCK',
                          style: TextStyle(
                            fontSize: 7.5,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFFDC2626),
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
  List<Map<String, dynamic>> _categorySlideBanners = [];
  final Map<String, List<Product>> _categoryProductsMap = {};
  bool _bannersLoaded = false;

  @override
  void initState() {
    super.initState();
    _fetchCategoryBanners();
  }

  Future<void> _fetchCategoryBanners() async {
    try {
      dynamic data;
      try {
        final resp = await DioClient().dio.get(ApiEndpoints.categorySlideBanners);
        data = resp.data;
      } catch (_) {
        final resp = await DioClient().dio.get(ApiEndpoints.promoBanners);
        data = resp.data;
      }

      if (data is String) data = jsonDecode(data);
      if (data is Map && data['status'] == true && data['data'] is List) {
        final list = (data['data'] as List)
            .where((b) {
              final isActive = b['isActive'] ?? b['is_active'] ?? true;
              if (isActive == false) return false;
              final bType = (b['bannerType'] ?? b['banner_type'] ?? '').toString().toLowerCase();
              return bType == 'category_slide' || bType == 'category';
            })
            .map((b) => Map<String, dynamic>.from(b as Map))
            .toList();

        if (mounted) {
          setState(() {
            _categorySlideBanners = list;
            _bannersLoaded = true;
          });

          // Fetch products specifically for each category slide banner
          for (final banner in list) {
            final catId = (banner['categoryId'] ?? banner['category_id'] ?? banner['actionValue'] ?? banner['action_value'] ?? '').toString();
            if (catId.isNotEmpty && !_categoryProductsMap.containsKey(catId)) {
              _fetchProductsForCategory(catId);
            }
          }
          return;
        }
      }
    } catch (e) {
      debugPrint('Error fetching category banners: $e');
    }
    if (mounted) setState(() => _bannersLoaded = true);
  }

  Future<void> _fetchProductsForCategory(String categoryId) async {
    try {
      final resp = await DioClient().dio.get('${ApiEndpoints.customerCategory}/$categoryId');
      dynamic data = resp.data;
      if (data is String) data = jsonDecode(data);
      if (data is Map && data['data'] is List) {
        final prods = (data['data'] as List)
            .map((item) => Product.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList();
        if (mounted && prods.isNotEmpty) {
          setState(() {
            _categoryProductsMap[categoryId] = prods;
          });
        }
      }
    } catch (_) {}
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

  @override
  Widget build(BuildContext context) {
    if (!_bannersLoaded || _categorySlideBanners.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final banner in _categorySlideBanners) ...[
          _buildBannerCategorySection(banner),
        ],
      ],
    );
  }

  Widget _buildBannerCategorySection(Map<String, dynamic> banner) {
    final catId = (banner['categoryId'] ?? banner['category_id'] ?? banner['actionValue'] ?? banner['action_value'] ?? '').toString();
    final catName = (banner['categoryName'] ?? banner['category_name'] ?? banner['title'] ?? 'Category').toString();
    final cleanTitle = cleanCategoryName(catName);

    // 1. First check if products were loaded directly for this category
    var products = <Product>[];
    if (catId.isNotEmpty && _categoryProductsMap.containsKey(catId)) {
      products = _categoryProductsMap[catId]!;
    }

    // 2. Otherwise filter from widget.allProducts
    if (products.isEmpty) {
      products = widget.allProducts.where((p) {
        if (catId.isNotEmpty && (p.categoryId == catId || p.category == catId || p.id == catId || p.productId == catId)) {
          return true;
        }
        if (catName.isNotEmpty && (p.category.toLowerCase() == catName.toLowerCase() || cleanCategoryName(p.category).toLowerCase() == cleanCategoryName(catName).toLowerCase())) {
          return true;
        }
        if (catName.toLowerCase().contains('dry fruit') && p.category.toLowerCase().contains('dry')) {
          return true;
        }
        return false;
      }).toList();
    }

    // 3. Fallback matching
    if (products.isEmpty) {
      products = widget.allProducts.where((p) => p.category.toLowerCase().contains(cleanTitle.toLowerCase())).toList();
    }

    return _CategorySection(
      categoryName: catName,
      products: products,
      banner: banner,
      formatImageUrl: _formatImageUrl,
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
    if (banner == null) return;

    final actionType = (banner!['actionType'] ?? banner!['action_type'] ?? banner!['type'] ?? '').toString().toUpperCase();
    final actionVal = (banner!['actionValue'] ?? banner!['action_value'] ?? '').toString();
    final categoryId = (banner!['categoryId'] ?? banner!['category_id'] ?? '').toString();
    final productId = (banner!['productId'] ?? banner!['product_id'] ?? '').toString();
    final bannerType = (banner!['bannerType'] ?? banner!['banner_type'] ?? '').toString().toLowerCase();

    // 0. Explicit NONE action -> no-op
    if (actionType == 'NONE' && categoryId.isEmpty && productId.isEmpty) {
      return;
    }

    // 1. PRODUCT action
    final isProduct = actionType == 'PRODUCT' ||
        actionType == 'PRD' ||
        bannerType == 'product' ||
        productId.isNotEmpty ||
        (actionVal.isNotEmpty && actionVal.startsWith('PRD'));

    final targetPid = productId.isNotEmpty ? productId : (isProduct ? actionVal : '');
    if (targetPid.isNotEmpty) {
      final title = banner!['title']?.toString() ?? banner!['name']?.toString() ?? 'Product';
      final cat = categoryId.isNotEmpty ? categoryId : (products.firstOrNull?.categoryId ?? categoryName);
      AppShell.of(context)?.setTab(
        1,
        category: cat,
        productId: targetPid,
        productName: title,
      );
      return;
    }

    // 2. CATEGORY action
    final targetCategory = categoryId.isNotEmpty
        ? categoryId
        : (actionVal.isNotEmpty && actionType == 'CATEGORY' ? actionVal : categoryName);

    AppShell.of(context)?.setTab(1, category: targetCategory);
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
                cleanCategoryName(categoryName),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: kText,
                  letterSpacing: -0.3,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () {
                  final catId = products.firstOrNull?.categoryId ?? (banner != null ? (banner!['categoryId'] ?? banner!['category_id']) : null);
                  final target = (catId != null && catId.toString().isNotEmpty) ? catId.toString() : categoryName;
                  AppShell.of(context)?.setTab(1, category: target);
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
                    Icon(Icons.arrow_forward, size: 12, color: Color(0xFF16653A)),
                  ],
                ),
              ),
            ],
          ),
        ),

        // ── Inline category banner (Image ONLY - full width, uncropped) ─────
        if (banner != null) ...[
          GestureDetector(
            onTap: () => _onBannerTap(context),
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: Colors.white,
              ),
              child: AspectRatio(
                aspectRatio: 2.0,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.network(
                    formatImageUrl(banner!['imageUrl']?.toString() ?? banner!['image_url']?.toString() ?? ''),
                    fit: BoxFit.cover,
                    width: double.infinity,
                    height: double.infinity,
                    loadingBuilder: (_, child, progress) {
                      if (progress == null) return child;
                      return Container(
                        color: const Color(0xFFF1F5F9),
                        child: const Center(
                          child: SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFF16A34A),
                            ),
                          ),
                        ),
                      );
                    },
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
              ),
            ),
          ),
        ],

        // ── Horizontal product scroll for this category ──────────────────────
        if (products.isNotEmpty) ...[
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
        ],

        const SizedBox(height: 8),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════
//  HOME BOTTOM PROMO BANNERS (LIVE PREVIEW STYLE CARDS)
//  Renders promo / special offer cards at the bottom of
//  HomeScreen near the referral card.
// ══════════════════════════════════════════════════════════

class _HomeBottomPromoBanners extends StatefulWidget {
  const _HomeBottomPromoBanners();

  @override
  State<_HomeBottomPromoBanners> createState() => _HomeBottomPromoBannersState();
}

class _HomeBottomPromoBannersState extends State<_HomeBottomPromoBanners> {
  List<Map<String, dynamic>> _promoBanners = [];
  bool _loaded = false;
  int _currentPage = 0;
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(viewportFraction: 0.94);
    _fetchPromoBanners();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _fetchPromoBanners() async {
    try {
      final resp = await DioClient().dio.get(ApiEndpoints.promoBanners);
      dynamic data = resp.data;
      if (data is String) data = jsonDecode(data);
      if (data is Map && data['status'] == true && data['data'] is List) {
        final list = (data['data'] as List)
            .where((b) {
              final isActive = b['isActive'] ?? b['is_active'] ?? true;
              if (isActive == false) return false;
              final bType = (b['bannerType'] ?? b['banner_type'] ?? '').toString().toLowerCase();
              return bType == 'checkout_promo' ||
                  bType == 'checkout_banner' ||
                  bType == 'offer_banner' ||
                  bType == 'promo';
            })
            .map((b) => Map<String, dynamic>.from(b as Map))
            .toList();

        if (mounted && list.isNotEmpty) {
          setState(() {
            _promoBanners = list;
            _loaded = true;
          });
          return;
        }
      }
    } catch (_) {}

    if (mounted) setState(() => _loaded = true);
  }

  String _formatImg(String raw) {
    if (raw.isEmpty) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    final clean = raw.startsWith('/') ? raw : '/$raw';
    return '${ApiEndpoints.host}$clean';
  }

  void _onPromoTap(BuildContext context, Map<String, dynamic> banner) {
    // 1. Check for coupon code
    final couponCode = (banner['couponCode'] ?? banner['coupon_code'] ?? banner['promoCode'] ?? banner['promo_code'] ?? banner['code'])?.toString();
    String? resolvedCode = couponCode;
    if (resolvedCode == null || resolvedCode.isEmpty) {
      final cta = (banner['ctaLabel'] ?? banner['cta_label'] ?? '').toString();
      final match = RegExp(r'(?:USE CODE|CODE):\s*([A-Z0-9_-]+)', caseSensitive: false).firstMatch(cta);
      if (match != null) {
        resolvedCode = match.group(1);
      }
    }

    if (resolvedCode != null && resolvedCode.isNotEmpty) {
      Clipboard.setData(ClipboardData(text: resolvedCode));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Coupon code "$resolvedCode" copied! Use at checkout.'),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
          backgroundColor: const Color(0xFF16653A),
        ),
      );
    }

    // 2. Redirection
    final actionType = (banner['actionType'] ?? banner['action_type'] ?? '').toString().toUpperCase();
    final actionVal = (banner['actionValue'] ?? banner['action_value'] ?? banner['productId'] ?? banner['product_id'] ?? '').toString();
    final categoryId = (banner['categoryId'] ?? banner['category_id'] ?? '').toString();
    final bannerType = (banner['bannerType'] ?? banner['banner_type'] ?? '').toString().toLowerCase();

    if (actionType == 'NONE') return;

    final isProduct = actionType == 'PRODUCT' ||
        actionType == 'PRD' ||
        bannerType == 'product' ||
        actionVal.startsWith('PRD') ||
        banner['productId'] != null ||
        banner['product_id'] != null;

    if (isProduct && actionVal.isNotEmpty) {
      final title = banner['title']?.toString() ?? banner['name']?.toString() ?? 'Product';
      AppShell.of(context)?.setTab(
        1,
        category: categoryId.isNotEmpty ? categoryId : null,
        productId: actionVal,
        productName: title,
      );
      return;
    }

    if (actionType == 'CATEGORY' || categoryId.isNotEmpty) {
      final cat = categoryId.isNotEmpty ? categoryId : actionVal;
      AppShell.of(context)?.setTab(1, category: cat);
      return;
    }

    if (actionType == 'SUBSCRIPTION') {
      AppShell.of(context)?.setTab(2);
      return;
    }

    if (actionType == 'WALLET') {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const WalletScreen()),
      );
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const BrowseScreen(initialCategory: 'All')),
    );
  }

  Widget _buildCard(BuildContext context, Map<String, dynamic> banner) {
    final title = banner['title']?.toString() ?? 'Special Offer';
    final description = banner['description']?.toString() ?? banner['subtitle']?.toString() ?? '';
    final discountText = banner['discountText']?.toString() ?? banner['discount_text']?.toString();
    final ctaLabel = banner['ctaLabel']?.toString() ?? banner['cta_label']?.toString() ?? banner['cta']?.toString() ?? 'Grab Offer';
    final imageUrl = _formatImg(banner['imageUrl']?.toString() ?? banner['image_url']?.toString() ?? '');
    final bType = (banner['bannerType'] ?? banner['banner_type'] ?? '').toString().toLowerCase();
    final tagLabel = bType == 'checkout_banner' || bType == 'checkout_promo'
        ? 'CHECKOUT PROMO'
        : (discountText?.isNotEmpty == true ? discountText!.toUpperCase() : 'SPECIAL OFFER');

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _onPromoTap(context, banner),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDF4),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: const Color(0xFF86EFAC),
              width: 1.2,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Top tag badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.shopping_bag_outlined, size: 12, color: Color(0xFF92400E)),
                    const SizedBox(width: 4),
                    Text(
                      tagLabel,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF92400E),
                        letterSpacing: 0.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),

              // Content Row: Thumbnail -> Text (Title + Discount Pill) -> CTA Button
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Thumbnail
                  if (imageUrl.isNotEmpty)
                    Container(
                      width: 52,
                      height: 52,
                      margin: const EdgeInsets.only(right: 10),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        color: Colors.white,
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(11),
                        child: Image.network(
                          imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.local_offer_rounded,
                            color: Color(0xFF16A34A),
                            size: 22,
                          ),
                        ),
                      ),
                    ),

                  // Middle details
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                title,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w900,
                                  color: kText,
                                  height: 1.2,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (discountText != null && discountText.isNotEmpty) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFDCFCE7),
                                  borderRadius: BorderRadius.circular(5),
                                ),
                                child: Text(
                                  discountText.toUpperCase(),
                                  style: const TextStyle(
                                    fontSize: 8.5,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF16653A),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        if (description.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            description,
                            style: const TextStyle(
                              fontSize: 10.5,
                              color: kTextSub,
                              height: 1.25,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),

                  // CTA Button
                  ElevatedButton(
                    onPressed: () => _onPromoTap(context, banner),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00875A),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          ctaLabel,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(width: 3),
                        const Icon(Icons.arrow_forward_rounded, size: 12),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded || _promoBanners.isEmpty) return const SizedBox.shrink();

    if (_promoBanners.length == 1) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: _buildCard(context, _promoBanners.first),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: 118,
            child: PageView.builder(
              controller: _pageController,
              itemCount: _promoBanners.length,
              onPageChanged: (i) => setState(() => _currentPage = i),
              itemBuilder: (context, index) {
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: _buildCard(context, _promoBanners[index]),
                );
              },
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(_promoBanners.length, (i) {
              final isSel = i == _currentPage;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: isSel ? 14 : 5,
                height: 4,
                decoration: BoxDecoration(
                  color: isSel ? const Color(0xFF16A34A) : const Color(0xFFD1D5DB),
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}
