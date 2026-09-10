import 'package:flutter/material.dart';
import 'package:f2h_customer/core/utils/version_checker.dart';
import 'package:f2h_customer/features/onboarding/presentation/screens/dynamic_splash_screen.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/theme/app_theme.dart';
import 'package:f2h_customer/core/widgets/animations.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/widgets/popup_banner_widget.dart';

import 'package:f2h_customer/features/catalog/presentation/screens/home_screen.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_screen.dart'; // Contains BrowseScreen
import 'package:f2h_customer/features/subscription/presentation/screens/my_subscriptions_screen.dart'; // Contains SubsScreen
import 'package:f2h_customer/features/profile/presentation/screens/profile_screen.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/core/network/network_bloc.dart';
import 'package:f2h_customer/core/widgets/network_overlay.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/catalog_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/catalog_event.dart';
import 'package:f2h_customer/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_bloc.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_state.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_event.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_event.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/checkout/checkout_bloc.dart';
import 'package:f2h_customer/features/notifications/presentation/bloc/notifications_bloc.dart';
import 'package:f2h_customer/features/notifications/presentation/bloc/notifications_event.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_bloc.dart';

import 'package:f2h_customer/features/orders/presentation/bloc/order_history_event.dart';
import 'package:f2h_customer/core/services/notification_service.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/core/widgets/force_update_gate.dart';

class F2HApp extends StatelessWidget {
  const F2HApp({super.key});

  @override
  Widget build(BuildContext context) => MultiBlocProvider(
    providers: [
      // Eager: the session check has to start with the app, not when the splash
      // screen finally mounts its child, or a signed-in user waits twice.
      BlocProvider<AuthBloc>(
        lazy: false,
        create: (_) => sl<AuthBloc>()..add(const AuthCheckRequested()),
      ),
      BlocProvider<CustomerSessionCubit>(create: (_) => sl<CustomerSessionCubit>()),
      BlocProvider<CatalogBloc>(create: (_) => sl<CatalogBloc>()),
      BlocProvider<ProfileBloc>(create: (_) => sl<ProfileBloc>()),
      BlocProvider<SubscriptionBloc>(create: (_) => sl<SubscriptionBloc>()),
      BlocProvider<NetworkBloc>(create: (_) => sl<NetworkBloc>()),
      BlocProvider<CartBloc>(create: (_) => sl<CartBloc>()),
      BlocProvider<CheckoutBloc>(create: (_) => sl<CheckoutBloc>()),
      BlocProvider<NotificationsBloc>(create: (_) => sl<NotificationsBloc>()),
      BlocProvider<OrderHistoryBloc>(create: (_) => sl<OrderHistoryBloc>()),
    ],
    child: MaterialApp(
      navigatorKey: appNavigatorKey,
      title: 'F2H Fresh',
      debugShowCheckedModeBanner: false,
      builder: (context, child) => NetworkOverlay(child: child!),
      theme: AppTheme.lightTheme,
      home: DynamicSplashScreen(
        // Wraps both the signed-in and signed-out trees: an unsupported build
        // must not reach the login form either, since the session it would
        // create belongs to a client the API no longer supports.
        child: ForceUpdateGate(
          pending: const InitialLoadingScreen(),
          child: BlocListener<AuthBloc, AuthState>(
            listener: (context, state) {
              if (state is Authenticated) {
                context.read<CustomerSessionCubit>().bootstrap();
              } else if (state is Unauthenticated || state is AuthFailure) {
                // Clear session cubit on logout so re-login always starts fresh
                context.read<CustomerSessionCubit>().clear(clearToken: false);
                context.read<CartBloc>().add(ClearCartEvent());
              }
            },
            child: BlocBuilder<AuthBloc, AuthState>(
              buildWhen: (previous, current) {
                // Skip intermediate AuthLoading rebuilds — the login screen handles its own loading UI
                if (current is AuthLoading) return false;
                return true;
              },
              builder: (context, state) {
                if (state is Authenticated) {
                  return const CustomerSessionGate();
                }
                // Session still unknown — hold a loading screen rather than
                // showing a login form to someone who is already signed in.
                if (state is AuthInitial || state is AuthCheckInProgress) {
                  return const InitialLoadingScreen();
                }
                return const LoginScreen();
              },
            ),
          ),
        ),
      ),
    ),
  );
}

class CustomerSessionGate extends StatefulWidget {
  const CustomerSessionGate({super.key});

  @override
  State<CustomerSessionGate> createState() => _CustomerSessionGateState();
}

class _CustomerSessionGateState extends State<CustomerSessionGate> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<CustomerSessionCubit>().bootstrap();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<CustomerSessionCubit, CustomerSessionState>(
      listenWhen: (previous, current) {
        return previous.status != current.status ||
            previous.profile?.customerId != current.profile?.customerId;
      },
      listener: (context, state) {
        if (state.status == CustomerSessionStatus.unauthenticated) {
          context.read<AuthBloc>().add(const LogoutRequested());
        }
        if (state.status == CustomerSessionStatus.ready ||
            state.status == CustomerSessionStatus.cached) {
          final customerId = state.profile?.customerId;
          if (customerId != null) {
            context.read<CartBloc>().add(LoadCartEvent(customerId));
            context.read<NotificationsBloc>().add(LoadNotifications());
            context.read<SubscriptionBloc>().add(LoadSubscriptions());
            context.read<OrderHistoryBloc>().add(LoadOrderHistory());

            String? branchId;
            try {
              if (state.addresses.isNotEmpty) {
                final defaultAddr = state.addresses.firstWhere(
                  (a) => a.isDefault,
                  orElse: () => state.addresses.first,
                );
                if (defaultAddr.branchId.isNotEmpty) {
                  branchId = defaultAddr.branchId;
                }
              }
            } catch (_) {}
            context.read<CatalogBloc>().add(LoadCatalog(branchId: branchId));
          }
        }
      },
      builder: (context, state) {
        if (state.status == CustomerSessionStatus.ready ||
            state.status == CustomerSessionStatus.cached) {
          return const AppShell();
        }

        if (state.status == CustomerSessionStatus.failure) {
          if (state.hasUsableData) {
            return const AppShell();
          }

          return Scaffold(
            body: SafeArea(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 72,
                        height: 72,
                        decoration: const BoxDecoration(
                          color: Color(0xFFFEE2E2),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.wifi_off_rounded,
                          color: Colors.redAccent,
                          size: 36,
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'Connection Failed',
                        style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: kText),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        state.error ??
                            'Unable to connect to the server. Please check your internet connection or server status.',
                        style: const TextStyle(fontSize: 14, color: kTextSub),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 32),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton(
                          onPressed: () {
                            context.read<CustomerSessionCubit>().bootstrap();
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: kPrimary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text(
                            'Retry Connection',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () {
                          context.read<AuthBloc>().add(const LogoutRequested());
                        },
                        child: const Text(
                          'Log Out',
                          style: TextStyle(
                            color: Colors.redAccent,
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }

        return const InitialLoadingScreen();
      },
    );
  }
}

class AppShell extends StatefulWidget {
  static int activeTab = 0;
  const AppShell({super.key});

  static AppShellState? of(BuildContext context) =>
      context.findAncestorStateOfType<AppShellState>();

  @override
  State<AppShell> createState() => AppShellState();
}

class AppShellState extends State<AppShell> {
  int _i = AppShell.activeTab;
  late final PageController _pageController;
  String? _pendingCategory;
  String? _pendingProductId;
  String? _pendingProductName;
  bool _showNav = true;
  bool _isTransitioning = false;

  bool get isNavVisible => _showNav;
  bool get isHomeScreen => _i == 0;
  int get currentTab => _i;

  void setTab(int index, {String? category, String? productId, String? productName}) {
    if (index >= _tabs.length) {
      index = 0;
    }
    if (category != null) {
      _pendingCategory = category;
    }
    if (productId != null) {
      _pendingProductId = productId;
    }
    if (productName != null) {
      _pendingProductName = productName;
    }
    AppShell.activeTab = index;
    setState(() {
      _showNav = true;
      _i = index;
    });
    if (index == 0) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          PopupBannerWidget.onReturnedToHomeScreen(context);
        }
      });
    }
  }

  String? consumePendingCategory() {
    final cat = _pendingCategory;
    _pendingCategory = null;
    return cat;
  }

  Map<String, String?> consumePendingNavigation() {
    final res = {
      'category': _pendingCategory,
      'productId': _pendingProductId,
      'productName': _pendingProductName,
    };
    _pendingCategory = null;
    _pendingProductId = null;
    _pendingProductName = null;
    return res;
  }

  static const _tabs = [
    (Icons.home_outlined, Icons.home_rounded, 'Home'),
    (Icons.grid_view_outlined, Icons.grid_view_rounded, 'Shop'),
    (Icons.calendar_today_outlined, Icons.calendar_today_rounded, 'Subscribe'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) VersionChecker.checkUpdates(context);
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    extendBody: true,
    backgroundColor: kBg,
    body: NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (_isTransitioning) return false;
        if (notification.metrics.axis == Axis.vertical) {
          final pixels = notification.metrics.pixels;
          if (notification is ScrollUpdateNotification) {
            final delta = notification.scrollDelta ?? 0;
            // Hide bottom navbar when scrolling down past top padding (pixels > 30)
            if (delta > 2.0 && pixels > 30 && _showNav) {
              setState(() => _showNav = false);
            }
            // Show bottom navbar when scrolling up firmly or near top
            else if ((delta < -2.0 || pixels <= 20) && !_showNav) {
              setState(() => _showNav = true);
            }
          }
          if (notification is ScrollEndNotification) {
            if (pixels <= 20 && !_showNav) {
              setState(() => _showNav = true);
            }
          }
        }
        return false;
      },
      child: IndexedStack(
        index: _i,
        children: [
          HomeScreen(isNavVisible: _showNav),
          BrowseScreen(isNavVisible: _showNav),
          const SubsScreen(),
        ],
      ),
    ),
    bottomNavigationBar: AnimatedSlide(
      offset: _showNav ? Offset.zero : const Offset(0, 1),
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
      child: _BottomNav(
        tabs: _tabs,
        activeIndex: _i,
        onSelect: (i) {
          if (_i == i) return;
          AppShell.activeTab = i;
          setState(() {
            _showNav = true;
            _i = i;
          });
        },
      ),
    ),
  );
}

// ══════════════════════════════════════════════════════════
//  BOTTOM NAVIGATION — Home / Shop / Subscribe
//
//  The cart is reachable from the shop header and the floating
//  "View cart" pill, so it does not occupy a tab of its own.
// ══════════════════════════════════════════════════════════

class _BottomNav extends StatelessWidget {
  final List<(IconData, IconData, String)> tabs;
  final int activeIndex;
  final ValueChanged<int> onSelect;

  const _BottomNav({required this.tabs, required this.activeIndex, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
      builder: (context, sessionState) {
        final isVip = sessionState.profile?.isMember == true;
        final activeColor = isVip ? const Color(0xFFB8860B) : kPrimary;

        return Container(
          decoration: BoxDecoration(
            color: kSurface,
            border: Border(
              top: BorderSide(
                color: isVip ? const Color(0xFFFFD700) : kBorderLt,
                width: isVip ? 1.5 : 1.0,
              ),
            ),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: List.generate(tabs.length, (i) {
                  final tab = tabs[i];
                  return Expanded(
                    child: _NavItem(
                      icon: tab.$1,
                      activeIcon: tab.$2,
                      label: tab.$3,
                      isActive: i == activeIndex,
                      activeColor: activeColor,
                      badge: i == 2 ? const _SubscriptionBadgeCount() : null,
                      onTap: () => onSelect(i),
                    ),
                  );
                }),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isActive;
  final Color activeColor;
  final Widget? badge;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isActive,
    required this.activeColor,
    required this.onTap,
    this.badge,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 6),
      color: Colors.transparent,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 32,
            height: 30,
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                AnimatedScale(
                  scale: isActive ? 1.08 : 1.0,
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOutCubic,
                  child: Icon(
                    isActive ? activeIcon : icon,
                    color: isActive ? activeColor : kTextSub,
                    size: isActive ? 26 : 22,
                  ),
                ),
                if (badge != null) Positioned(top: -3, right: -7, child: badge!),
              ],
            ),
          ),
          const SizedBox(height: 3),
          AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 180),
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
              color: isActive ? activeColor : kTextSub,
              letterSpacing: 0.1,
            ),
            child: Text(label, maxLines: 1, overflow: TextOverflow.visible, softWrap: false),
          ),
        ],
      ),
    ),
  );
}

/// Red pip carrying the number of active or paused subscriptions.
///
/// The count is latched from the last loaded state instead of being read
/// straight off the current one. Tapping the Subscribe tab builds SubsScreen,
/// which re-dispatches LoadSubscriptions, so the bloc briefly sits in
/// SubscriptionLoading; reading that state directly made the pip blink out and
/// reappear only once the API answered, trailing the tab's green circle.
class _SubscriptionBadgeCount extends StatefulWidget {
  const _SubscriptionBadgeCount();

  @override
  State<_SubscriptionBadgeCount> createState() => _SubscriptionBadgeCountState();
}

class _SubscriptionBadgeCountState extends State<_SubscriptionBadgeCount> {
  late int _count;

  /// Null for any state that carries no subscription list, so the latched
  /// count is left untouched rather than reset to zero.
  int? _countOf(SubscriptionState state) {
    if (state is! SubscriptionLoaded) return null;
    return state.subscriptions.where((s) {
      final status = s.status.toLowerCase();
      return status == 'active' || status == 'paused';
    }).length;
  }

  @override
  void initState() {
    super.initState();
    _count = _countOf(context.read<SubscriptionBloc>().state) ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<SubscriptionBloc, SubscriptionState>(
      listener: (context, state) {
        final next = _countOf(state);
        if (next != null && next != _count) {
          setState(() => _count = next);
        }
      },
      child: _count == 0 ? const SizedBox.shrink() : _CountPip(count: _count),
    );
  }
}

class _CountPip extends StatelessWidget {
  final int count;
  const _CountPip({required this.count});

  @override
  Widget build(BuildContext context) => Container(
    constraints: const BoxConstraints(minWidth: 19, minHeight: 19),
    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1.5),
    decoration: BoxDecoration(
      color: const Color(0xFFEF4444),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: Colors.white, width: 1.5),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.25),
          blurRadius: 3,
          offset: const Offset(0, 1),
        ),
      ],
    ),
    child: Center(
      child: Text(
        count > 99 ? '99+' : '$count',
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10.5,
          fontWeight: FontWeight.w900,
          height: 1.0,
        ),
      ),
    ),
  );
}
