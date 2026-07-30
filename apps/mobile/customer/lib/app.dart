import 'package:flutter/material.dart';
import 'package:f2h_customer/core/utils/version_checker.dart';
import 'package:f2h_customer/features/onboarding/presentation/screens/dynamic_splash_screen.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/theme/app_theme.dart';
import 'package:f2h_customer/core/widgets/animations.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/home_screen.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_screen.dart'; // Contains BrowseScreen
import 'package:f2h_customer/features/catalog/presentation/screens/cart_screen.dart';
import 'package:f2h_customer/features/subscription/presentation/screens/my_subscriptions_screen.dart'; // Contains SubsScreen
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/core/network/network_bloc.dart';
import 'package:f2h_customer/core/widgets/network_overlay.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/catalog_bloc.dart';
import 'package:f2h_customer/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_bloc.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_state.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_event.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_state.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_event.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/checkout/checkout_bloc.dart';
import 'package:f2h_customer/features/notifications/presentation/bloc/notifications_bloc.dart';
import 'package:f2h_customer/features/notifications/presentation/bloc/notifications_event.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_bloc.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_state.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_event.dart';
import 'package:f2h_customer/core/app_bootstrap.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';


class F2HApp extends StatelessWidget {
  final AuthBootResult? bootResult;

  const F2HApp({super.key, this.bootResult});
  @override
  Widget build(BuildContext context) => MultiBlocProvider(
    providers: [
      BlocProvider<AuthBloc>(create: (_) => sl<AuthBloc>()..add(const AuthCheckRequested())),
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
      title: 'F2H Fresh',
      debugShowCheckedModeBanner: false,
      builder: (context, child) => NetworkOverlay(child: child!),
      theme: AppTheme.lightTheme,
      home: DynamicSplashScreen(
        child: BlocListener<AuthBloc, AuthState>(
          listener: (context, state) {
            if (state is Authenticated) {
              context.read<CustomerSessionCubit>().bootstrap();
            } else if (state is Unauthenticated || state is AuthFailure) {
              context.read<CartBloc>().add(ClearCartEvent());
            }
          },
          child: BlocBuilder<AuthBloc, AuthState>(
            builder: (context, state) {
              if (state is Authenticated) {
                return const CustomerSessionGate();
              }
              return const LoginScreen();
            },
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
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: kText,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        state.error ?? 'Unable to connect to the server. Please check your internet connection or server status.',
                        style: const TextStyle(
                          fontSize: 14,
                          color: kTextSub,
                        ),
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
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Retry Connection',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
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
  bool _showNav = true;
  bool _isTransitioning = false;

  bool get isNavVisible => _showNav;

  void setTab(int index, {String? category}) {
    if (category != null) {
      _pendingCategory = category;
    }
    AppShell.activeTab = index;
    setState(() {
      _showNav = true;
      _i = index;
      _isTransitioning = true;
    });
    _pageController.jumpToPage(index);
    Future.delayed(const Duration(milliseconds: 300), () {
      if (mounted) {
        setState(() {
          _isTransitioning = false;
        });
      }
    });
  }

  String? consumePendingCategory() {
    final cat = _pendingCategory;
    _pendingCategory = null;
    return cat;
  }

  late final List<Widget> _screens;

  static const _tabs = [
    (Icons.home_outlined, Icons.home_rounded, 'Home'),
    (Icons.grid_view_outlined, Icons.grid_view_rounded, 'Menu'),
    (Icons.shopping_cart_outlined, Icons.shopping_cart_rounded, 'Cart'),
    (Icons.calendar_today_outlined, Icons.calendar_today_rounded, 'Subscribe'),
  ];

  @override
  void initState() {
    super.initState();
    _screens = [
      HomeScreen(isNavVisible: _showNav),
      BrowseScreen(isNavVisible: _showNav),
      const CartScreen(),
      const SubsScreen(),
    ];
    _pageController = PageController(initialPage: _i);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) VersionChecker.checkUpdates(context);
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        extendBody: true,
        backgroundColor: kBg,
        body: NotificationListener<ScrollNotification>(
          onNotification: (notification) {
            if (_isTransitioning) return false;
            if (notification.metrics.axis == Axis.vertical) {
              if (notification is ScrollUpdateNotification) {
                final delta = notification.scrollDelta ?? 0;
                if (delta > 1.5 && _showNav) {
                  setState(() => _showNav = false);
                } else if (delta < -1.5 && !_showNav) {
                  setState(() => _showNav = true);
                }
              }
              if (notification is ScrollEndNotification &&
                  notification.metrics.pixels <= 0 &&
                  !_showNav) {
                setState(() => _showNav = true);
              }
            }
            return false;
          },
          child: PageView(
            controller: _pageController,
            physics: const NeverScrollableScrollPhysics(),
            onPageChanged: (index) {
              AppShell.activeTab = index;
              setState(() {
                _i = index;
                _showNav = true;
              });
            },
            children: _screens,
          ),
        ),
        bottomNavigationBar: AnimatedSlide(
          offset: _showNav ? Offset.zero : const Offset(0, 1),
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOutCubic,
<<<<<<< HEAD
          child: BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
            builder: (context, sessionState) {
              final isVip = sessionState.profile?.isMember == true;
              final activeColor = isVip ? const Color(0xFFB8860B) : kPrimary;
              final shadowColor = isVip ? const Color(0xFFFFD700) : kPrimary;

              return Container(
                decoration: BoxDecoration(
                  color: kSurface,
                  border: Border(
                    top: BorderSide(
                      color: isVip ? const Color(0xFFFFD700) : kBorderLt,
                      width: isVip ? 1.5 : 1.0,
=======
          child: Container(
            decoration: BoxDecoration(
              color: kSurface,
              border: const Border(top: BorderSide(color: kBorderLt)),
              boxShadow: [
                BoxShadow(
                  color: kPrimary.withValues(alpha: 0.04),
                  blurRadius: 20,
                  offset: const Offset(0, -4),
                )
              ],
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: List.generate(_tabs.length, (i) {
                    final on = i == _i;
                    final tab = _tabs[i];
                    return Expanded(
                      child: GestureDetector(
                        onTap: () {
                          if (_i == i) return;
                          AppShell.activeTab = i;
                          setState(() {
                            _showNav = true;
                            _i = i;
                            _isTransitioning = true;
                          });
                          _pageController.jumpToPage(i);
                          Future.delayed(const Duration(milliseconds: 300), () {
                            if (mounted) {
                              setState(() {
                                _isTransitioning = false;
                              });
                            }
                          });
                        },
                        behavior: HitTestBehavior.opaque,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          color: Colors.transparent,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                            AnimatedScale(
                              scale: on ? 1.15 : 1.0,
                              duration: const Duration(milliseconds: 200),
                              curve: Curves.easeOutBack,
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: on ? kPrimary : Colors.transparent,
                                  shape: BoxShape.circle,
                                  boxShadow: on
                                      ? [
                                          BoxShadow(
                                            color: kPrimary.withValues(alpha: 0.3),
                                            blurRadius: 8,
                                            offset: const Offset(0, 3),
                                          )
                                        ]
                                      : [],
                                ),
                                child: i == 2
                                    ? BlocBuilder<CartBloc, CartState>(
                                        builder: (context, state) {
                                          final items = context.read<CartBloc>().currentItems;
                                           int count = 0;
                                           for (final item in items) {
                                             if (item.purchaseType == 'subscription') {
                                               final schedSum = item.schedules?.fold(0, (s, sched) => s + sched.mQuantity + sched.eQuantity) ?? 0;
                                               count += (schedSum > 0 ? schedSum : 1);
                                             } else {
                                               count += item.quantity ?? 1;
                                             }
                                           }
                                          return Stack(
                                            clipBehavior: Clip.none,
                                            children: [
                                              Icon(
                                                on ? tab.$2 : tab.$1,
                                                color: on ? Colors.white : kTextSub,
                                                size: 20,
                                              ),
                                              if (count > 0)
                                                Positioned(
                                                  top: -4,
                                                  right: -4,
                                                  child: Container(
                                                    padding: const EdgeInsets.all(3),
                                                    decoration: const BoxDecoration(
                                                      color: Colors.red,
                                                      shape: BoxShape.circle,
                                                    ),
                                                    child: Text(
                                                      count > 99 ? '99+' : '$count',
                                                      style: const TextStyle(
                                                        color: Colors.white,
                                                        fontSize: 7,
                                                        fontWeight: FontWeight.w900,
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                            ],
                                          );
                                        },
                                      )
                                    : (i == 3
                                        ? BlocBuilder<SubscriptionBloc, SubscriptionState>(
                                            builder: (context, subState) {
                                              int subCount = 0;
                                              if (subState is SubscriptionLoaded) {
                                                subCount = subState.subscriptions
                                                    .where((s) => s.status.toLowerCase() == 'active' || s.status.toLowerCase() == 'paused')
                                                    .length;
                                              } else {
                                                final orderState = context.read<OrderHistoryBloc>().state;
                                                if (orderState is OrderHistoryLoaded) {
                                                  subCount = orderState.subscriptionPlans.where((p) => p.isActive).length;
                                                }
                                              }
                                              return Stack(
                                                clipBehavior: Clip.none,
                                                children: [
                                                  Icon(
                                                    on ? tab.$2 : tab.$1,
                                                    color: on ? Colors.white : kTextSub,
                                                    size: 20,
                                                  ),
                                                  if (subCount > 0)
                                                    Positioned(
                                                      top: -4,
                                                      right: -4,
                                                      child: Container(
                                                        padding: const EdgeInsets.all(3),
                                                        decoration: const BoxDecoration(
                                                          color: Colors.red,
                                                          shape: BoxShape.circle,
                                                        ),
                                                        child: Text(
                                                          subCount > 99 ? '99+' : '$subCount',
                                                          style: const TextStyle(
                                                            color: Colors.white,
                                                            fontSize: 7,
                                                            fontWeight: FontWeight.w900,
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                ],
                                              );
                                            },
                                          )
                                        : Icon(
                                            on ? tab.$2 : tab.$1,
                                            color: on ? Colors.white : kTextSub,
                                            size: 20,
                                          )),
                              ),
                            ),
                            const SizedBox(height: 3),
                            AnimatedDefaultTextStyle(
                              duration: const Duration(milliseconds: 200),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: on ? FontWeight.w800 : FontWeight.w500,
                                color: on ? kPrimary : kTextSub,
                                letterSpacing: 0.1,
                              ),
                              child: Text(
                                tab.$3,
                                maxLines: 1,
                                overflow: TextOverflow.visible,
                                softWrap: false,
                              ),
                            ),
                          ],
                        ),
                      ),
>>>>>>> d4fb2b59b4da470914731ab0239e4a2417b85ecf
                    ),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: shadowColor.withValues(alpha: isVip ? 0.12 : 0.04),
                      blurRadius: 20,
                      offset: const Offset(0, -4),
                    )
                  ],
                ),
                child: SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: List.generate(_tabs.length, (i) {
                        final on = i == _i;
                        final tab = _tabs[i];
                        return Expanded(
                          child: GestureDetector(
                            onTap: () {
                              if (_i == i) return;
                              AppShell.activeTab = i;
                              setState(() {
                                _showNav = true;
                                _i = i;
                                _isTransitioning = true;
                              });
                              _pageController.jumpToPage(i);
                              Future.delayed(const Duration(milliseconds: 300), () {
                                if (mounted) {
                                  setState(() {
                                    _isTransitioning = false;
                                  });
                                }
                              });
                            },
                            behavior: HitTestBehavior.opaque,
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              color: Colors.transparent,
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  AnimatedScale(
                                    scale: on ? 1.15 : 1.0,
                                    duration: const Duration(milliseconds: 200),
                                    curve: Curves.easeOutBack,
                                    child: AnimatedContainer(
                                      duration: const Duration(milliseconds: 200),
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: on ? activeColor : Colors.transparent,
                                        shape: BoxShape.circle,
                                        boxShadow: on
                                            ? [
                                                BoxShadow(
                                                  color: shadowColor.withValues(alpha: 0.35),
                                                  blurRadius: 8,
                                                  offset: const Offset(0, 3),
                                                )
                                              ]
                                            : [],
                                      ),
                                      child: i == 2
                                          ? BlocBuilder<CartBloc, CartState>(
                                              builder: (context, state) {
                                                final items = context.read<CartBloc>().currentItems;
                                                int count = 0;
                                                for (final item in items) {
                                                  if (item.purchaseType == 'subscription') {
                                                    final schedSum = item.schedules?.fold(0, (s, sched) => s + sched.mQuantity + sched.eQuantity) ?? 0;
                                                    count += (schedSum > 0 ? schedSum : 1);
                                                  } else {
                                                    count += item.quantity ?? 1;
                                                  }
                                                }
                                                return Stack(
                                                  clipBehavior: Clip.none,
                                                  children: [
                                                    Icon(
                                                      on ? tab.$2 : tab.$1,
                                                      color: on ? Colors.white : kTextSub,
                                                      size: 20,
                                                    ),
                                                    if (count > 0)
                                                      Positioned(
                                                        top: -4,
                                                        right: -4,
                                                        child: Container(
                                                          padding: const EdgeInsets.all(3),
                                                          decoration: const BoxDecoration(
                                                            color: Colors.red,
                                                            shape: BoxShape.circle,
                                                          ),
                                                          child: Text(
                                                            count > 99 ? '99+' : '$count',
                                                            style: const TextStyle(
                                                              color: Colors.white,
                                                              fontSize: 7,
                                                              fontWeight: FontWeight.w900,
                                                            ),
                                                          ),
                                                        ),
                                                      ),
                                                  ],
                                                );
                                              },
                                            )
                                          : Icon(
                                              on ? tab.$2 : tab.$1,
                                              color: on ? Colors.white : kTextSub,
                                              size: 20,
                                            ),
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  AnimatedDefaultTextStyle(
                                    duration: const Duration(milliseconds: 200),
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: on ? FontWeight.w800 : FontWeight.w500,
                                      color: on ? activeColor : kTextSub,
                                      letterSpacing: 0.1,
                                    ),
                                    child: Text(
                                      tab.$3,
                                      maxLines: 1,
                                      overflow: TextOverflow.visible,
                                      softWrap: false,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      );
  }

// class F2HDialogs {
//   static void showEmptyCartDialog(BuildContext context) {
//     showDialog(
//       context: context,
//       builder: (context) => AlertDialog(
//         shape: RoundedRectangleBorder(
//           borderRadius: BorderRadius.circular(20),
//         ),
//         backgroundColor: Colors.white,
//         content: Padding(
//           padding: const EdgeInsets.symmetric(vertical: 10),
//           child: Column(
//             mainAxisSize: MainAxisSize.min,
//             children: [
//               Container(
//                 width: 90,
//                 height: 90,
//                 decoration: BoxDecoration(
//                   shape: BoxShape.circle,
//                   color: const Color(0xFFE8F5E9),
//                   border: Border.all(
//                     color: const Color(0xFFC8E6C9),
//                     width: 4,
//                   ),
//                   boxShadow: [
//                     BoxShadow(
//                       color: const Color(0xFF0C831F).withValues(alpha: 0.1),
//                       blurRadius: 16,
//                       spreadRadius: 4,
//                     ),
//                   ],
//                 ),
//                 child: Center(
//                   child: Container(
//                     width: 66,
//                     height: 66,
//                     decoration: const BoxDecoration(
//                       shape: BoxShape.circle,
//                       gradient: LinearGradient(
//                         colors: [Color(0xFF81C784), Color(0xFF388E3C)],
//                         begin: Alignment.topLeft,
//                         end: Alignment.bottomRight,
//                       ),
//                     ),
//                     child: const Icon(
//                       Icons.shopping_cart_checkout_rounded,
//                       color: Colors.white,
//                       size: 32,
//                     ),
//                   ),
//                 ),
//               ),
//               const SizedBox(height: 20),
//               const Text(
//                 'Your Cart is Empty',
//                 style: TextStyle(
//                   fontSize: 18,
//                   fontWeight: FontWeight.w900,
//                   color: Color(0xFF1D252C),
//                 ),
//               ),
//               const SizedBox(height: 10),
//               const Text(
//                 'Please add items to your cart before proceeding.',
//                 textAlign: TextAlign.center,
//                 style: TextStyle(
//                   fontSize: 13,
//                   fontWeight: FontWeight.w600,
//                   color: Color(0xFF8D989F),
//                   height: 1.4,
//                 ),
//               ),
//               const SizedBox(height: 24),
//               SizedBox(
//                 width: double.infinity,
//                 child: ElevatedButton(
//                   onPressed: () => Navigator.pop(context),
//                   style: ElevatedButton.styleFrom(
//                     backgroundColor: const Color(0xFF0C831F),
//                     foregroundColor: Colors.white,
//                     padding: const EdgeInsets.symmetric(vertical: 14),
//                     shape: RoundedRectangleBorder(
//                       borderRadius: BorderRadius.circular(12),
//                     ),
//                     elevation: 0,
//                   ),
//                   child: const Text(
//                     'Okay',
//                     style: TextStyle(
//                       fontSize: 14,
//                       fontWeight: FontWeight.w900,
//                     ),
//                   ),
//                 ),
//               ),
//             ],
//           ),
//         ),
//       ),
//     );
//   }

//   static void showEmptySubscriptionsDialog(BuildContext context) {
//     showDialog(
//       context: context,
//       builder: (context) => AlertDialog(
//         shape: RoundedRectangleBorder(
//           borderRadius: BorderRadius.circular(20),
//         ),
//         backgroundColor: Colors.white,
//         content: Padding(
//           padding: const EdgeInsets.symmetric(vertical: 10),
//           child: Column(
//             mainAxisSize: MainAxisSize.min,
//             children: [
//               Container(
//                 width: 90,
//                 height: 90,
//                 decoration: BoxDecoration(
//                   shape: BoxShape.circle,
//                   color: const Color(0xFFFFF8E1),
//                   border: Border.all(
//                     color: const Color(0xFFFFE082),
//                     width: 4,
//                   ),
//                   boxShadow: [
//                     BoxShadow(
//                       color: const Color(0xFFFFB300).withValues(alpha: 0.1),
//                       blurRadius: 16,
//                       spreadRadius: 4,
//                     ),
//                   ],
//                 ),
//                 child: Center(
//                   child: Container(
//                     width: 66,
//                     height: 66,
//                     decoration: const BoxDecoration(
//                       shape: BoxShape.circle,
//                       gradient: LinearGradient(
//                         colors: [Color(0xFFFFD54F), Color(0xFFFF8F00)],
//                         begin: Alignment.topLeft,
//                         end: Alignment.bottomRight,
//                       ),
//                     ),
//                     child: const Icon(
//                       Icons.calendar_today_rounded,
//                       color: Colors.white,
//                       size: 30,
//                     ),
//                   ),
//                 ),
//               ),
//               const SizedBox(height: 20),
//               const Text(
//                 'No Active Subscriptions',
//                 style: TextStyle(
//                   fontSize: 18,
//                   fontWeight: FontWeight.w900,
//                   color: Color(0xFF1D252C),
//                 ),
//               ),
//               const SizedBox(height: 10),
//               const Text(
//                 'You do not have any active subscriptions yet. Subscribe to products to manage them here.',
//                 textAlign: TextAlign.center,
//                 style: TextStyle(
//                   fontSize: 13,
//                   fontWeight: FontWeight.w600,
//                   color: Color(0xFF8D989F),
//                   height: 1.4,
//                 ),
//               ),
//               const SizedBox(height: 24),
//               SizedBox(
//                 width: double.infinity,
//                 child: ElevatedButton(
//                   onPressed: () => Navigator.pop(context),
//                   style: ElevatedButton.styleFrom(
//                     backgroundColor: const Color(0xFF0C831F),
//                     foregroundColor: Colors.white,
//                     padding: const EdgeInsets.symmetric(vertical: 14),
//                     shape: RoundedRectangleBorder(
//                       borderRadius: BorderRadius.circular(12),
//                     ),
//                     elevation: 0,
//                   ),
//                   child: const Text(
//                     'Okay',
//                     style: TextStyle(
//                       fontSize: 14,
//                       fontWeight: FontWeight.w900,
//                     ),
//                   ),
//                 ),
//               ),
//             ],
//           ),
//         ),
//       ),
//     );
//   }
// }
