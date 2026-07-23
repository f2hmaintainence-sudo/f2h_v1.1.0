import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/orders_screen.dart';
import 'package:f2h_delivery/features/tracking/presentation/screens/map_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/profile_screen.dart';
import 'package:f2h_delivery/auth/presentation/screens/login_screen.dart';
import 'package:f2h_delivery/auth/presentation/screens/splash_screen.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/services/location_tracking_service.dart';
import 'package:f2h_delivery/services/mock_data_service.dart';

import 'package:f2h_delivery/core/app_bootstrap.dart';

class F2HApp extends StatelessWidget {
  final AuthBootResult? bootResult;

  const F2HApp({super.key, this.bootResult});

  @override
  Widget build(BuildContext context) => MultiBlocProvider(
        providers: [
          BlocProvider(
            create: (_) => sl<AuthBloc>()..add(AuthCheckRequested()),
          ),
          BlocProvider(
            create: (_) => sl<DeliverySessionBloc>()..add(LoadSessionEvent()),
          ),
        ],
        child: MaterialApp(
          title: 'Farm to Home',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            brightness: Brightness.light,
            scaffoldBackgroundColor: kBg,
            textTheme: GoogleFonts.poppinsTextTheme(
              ThemeData.light().textTheme,
            ),
            colorScheme: ColorScheme.fromSeed(
              seedColor: kPrimary,
              brightness: Brightness.light,
              primary: kPrimary,
            ),
            useMaterial3: true,
            appBarTheme: const AppBarTheme(
              backgroundColor: kSurface,
              foregroundColor: kText,
              elevation: 0,
              surfaceTintColor: Colors.transparent,
            ),
          ),
          home: const SplashScreen(),
        ),
      );
}

class AppShell extends StatefulWidget {
  final int initialIndex;
  const AppShell({super.key, this.initialIndex = 0});
  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> with WidgetsBindingObserver {
  int _i = 0;
  DateTime? _lastPressedAt;
  late final LocationTrackingService _locationTrackingService;
  static const _screens = [
    DashboardScreen(),
    OrdersScreen(),
    MapScreen(),
    ProfileScreen(),
  ];
  static const _tabs = [
    (Icons.explore_rounded, 'Home'),
    (Icons.assignment_rounded, 'Orders'),
    (Icons.map_rounded, 'Map'),
    (Icons.person_rounded, 'Profile')
  ];

  Future<bool> _handlePop() async {
    final now = DateTime.now();
    const backButtonInterval = Duration(seconds: 2);
    if (_lastPressedAt == null || now.difference(_lastPressedAt!) > backButtonInterval) {
      _lastPressedAt = now;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Press back again to exit'),
          duration: backButtonInterval,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) => BlocListener<AuthBloc, AuthState>(
    listener: (context, state) {
      if (state is Unauthenticated) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }
    },
    child: BlocBuilder<DeliverySessionBloc, DeliverySessionState>(
      builder: (context, sessionState) {
        final isVerified = sessionState is DeliverySessionLoaded
            ? sessionState.isVerified
            : true;
        final isAccountActive = sessionState is DeliverySessionLoaded
            ? sessionState.isAccountActive
            : true;
        return PopScope(
          canPop: false,
          onPopInvoked: (didPop) async {
            if (didPop) return;
            if (_i != 0) {
              setState(() { _i = 0; });
              return;
            }
            final shouldPop = await _handlePop();
            if (shouldPop) SystemNavigator.pop();
          },
          child: Scaffold(
            backgroundColor: kBg,
            body: Column(
              children: [
                Expanded(
                  child: IndexedStack(
                    index: _i,
                    children: _screens,
                  ),
                ),
              ],
            ),
            bottomNavigationBar: Container(
              decoration: BoxDecoration(
                color: kSurface,
                border: const Border(top: BorderSide(color: kBorderLt)),
                boxShadow: [
                  BoxShadow(color: kPrimary.withOpacity(0.04), blurRadius: 16, offset: const Offset(0, -4))
                ],
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(
                    children: List.generate(_tabs.length, (i) {
                      final on = i == _i;
                      final isTabEnabled = (i == 0 || i == 3) || (isVerified && isAccountActive);
                      const activeColor = kPrimary;
                      return Expanded(
                        child: GestureDetector(
                          onTap: () {
                            if (i == 1 || i == 2) {
                              if (!isVerified) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Verification pending. Please wait for admin approval.'),
                                    backgroundColor: Colors.redAccent,
                                    duration: Duration(seconds: 2),
                                  ),
                                );
                                return;
                              }
                              if (!isAccountActive) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Account is inactive. Please contact admin.'),
                                    backgroundColor: Colors.redAccent,
                                    duration: Duration(seconds: 2),
                                  ),
                                );
                                return;
                              }
                            }
                            setState(() => _i = i);
                          },
                          behavior: HitTestBehavior.opaque,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: on ? activeColor : Colors.transparent,
                                  shape: BoxShape.circle,
                                  boxShadow: on
                                      ? [
                                          BoxShadow(
                                            color: activeColor.withValues(alpha: 0.3),
                                            blurRadius: 8,
                                            offset: const Offset(0, 3),
                                          )
                                        ]
                                      : [],
                                ),
                                child: Icon(
                                  _tabs[i].$1,
                                  color: on
                                      ? Colors.white
                                      : (isTabEnabled ? kMuted : kMuted.withValues(alpha: 0.3)),
                                  size: 20,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _tabs[i].$2,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: on ? FontWeight.w800 : FontWeight.w500,
                                  color: on
                                      ? activeColor
                                      : (isTabEnabled ? kMuted : kMuted.withOpacity(0.3)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    ),
  );

  @override
  void initState() {
    super.initState();
    _i = widget.initialIndex;
    WidgetsBinding.instance.addObserver(this);

    // Kick off the initial session load via BLoC
    // (LoadSessionEvent is already dispatched in F2HApp's BlocProvider)

    // Listen to tab navigation requests (still on MockDataService.tabNavigationNotifier
    // as it's a UI-only navigation bus, not session data)
    MockDataService().tabNavigationNotifier.addListener(_onTabNavigationRequested);

    // Request location permissions on app startup
    _requestLocationPermission();

    // Initialize location tracking service
    _locationTrackingService = sl<LocationTrackingService>();

    // Foreground notification
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print("Foreground: ${message.notification?.title}");
    });

    // When user taps notification
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) async {
      final url = message.data['url'];
      if (url != null) {
        await launchUrl(Uri.parse(url));
      }
    });

    // Get token
    FirebaseMessaging.instance.getToken().then((token) {
      print("FCM TOKEN: $token");
    });
  }

  Future<void> _requestLocationPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      print('Location services are disabled.');
      return;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        print('Location permissions are denied.');
        return;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      print('Location permissions are permanently denied.');
      return;
    }

    print('Location permissions granted.');
  }

  void _onTabNavigationRequested() {
    final tabIdx = MockDataService().tabNavigationNotifier.value;
    if (tabIdx != null && mounted) {
      setState(() {
        _i = tabIdx;
      });
      MockDataService().tabNavigationNotifier.value = null;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Reload session data on app foreground
      context.read<DeliverySessionBloc>().add(ReloadSessionEvent());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    MockDataService().tabNavigationNotifier.removeListener(_onTabNavigationRequested);
    _locationTrackingService.stopTracking();
    super.dispose();
  }
}
