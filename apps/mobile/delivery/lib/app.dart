import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:f2h_delivery/features/tracking/presentation/screens/map_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/referral_screen.dart';
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

class F2HApp extends StatelessWidget {
  const F2HApp({super.key});

  @override
  Widget build(BuildContext context) => MultiBlocProvider(
    providers: [
      BlocProvider(create: (_) => sl<AuthBloc>()..add(AuthCheckRequested())),
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
        textTheme: GoogleFonts.robotoTextTheme(ThemeData.light().textTheme),
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
    MapScreen(),
    ReferralScreen(),
  ];
  static const _tabs = [
    (Icons.explore_rounded, 'Home'),
    (Icons.map_rounded, 'Map'),
    (Icons.card_giftcard_rounded, ''),
  ];

  static List<TextSpan> _buildMultiColorReferralSpans(bool on, bool isEnabled) {
    if (!isEnabled) {
      return [
        TextSpan(
          text: 'REFERRAL',
          style: GoogleFonts.roboto(
            fontSize: 14,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.4,
            color: kMuted,
          ),
        ),
      ];
    }

    const letters = ['R', 'E', 'F', 'E', 'R', 'R', 'A', 'L'];
    // When active on Gold: rich jewel & royal tones contrasting with gold
    // When unselected on Flag: deep vibrant tones that pop over the tricolor flag
    final colors = on
        ? const [
            Color(0xFF451A03), // R - Deep Bronze
            Color(0xFF7C2D12), // E - Deep Russet
            Color(0xFF14532D), // F - Deep Emerald
            Color(0xFF0F766E), // E - Deep Teal
            Color(0xFF1E3A8A), // R - Deep Royal Navy
            Color(0xFF581C87), // R - Deep Royal Purple
            Color(0xFF831843), // A - Deep Ruby Pink
            Color(0xFF713F12), // L - Deep Amber
          ]
        : const [
            Color(0xFFB91C1C), // R - Vivid Crimson
            Color(0xFFC2410C), // E - Saffron Orange
            Color(0xFF15803D), // F - Forest Green
            Color(0xFF0369A1), // E - Ocean Blue
            Color(0xFF4338CA), // R - Indigo
            Color(0xFF7E22CE), // R - Purple
            Color(0xFFBE185D), // A - Ruby Pink
            Color(0xFF15803D), // L - Dark Green
          ];

    return List.generate(letters.length, (idx) {
      return TextSpan(
        text: letters[idx],
        style: GoogleFonts.roboto(
          fontSize: 14,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.4,
          color: colors[idx],
          shadows: on
              ? [
                  Shadow(
                    color: Colors.white.withValues(alpha: 0.7),
                    offset: const Offset(0, 1),
                    blurRadius: 1,
                  ),
                ]
              : [
                  Shadow(
                    color: Colors.white.withValues(alpha: 0.95),
                    offset: const Offset(0, 1),
                    blurRadius: 2,
                  ),
                ],
        ),
      );
    });
  }

  Future<bool> _handlePop() async {
    final now = DateTime.now();
    const backButtonInterval = Duration(seconds: 2);
    if (_lastPressedAt == null ||
        now.difference(_lastPressedAt!) > backButtonInterval) {
      _lastPressedAt = now;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Press back again to exit'),
          duration: backButtonInterval,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
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
              setState(() {
                _i = 0;
              });
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
                  child: IndexedStack(index: _i, children: _screens),
                ),
              ],
            ),
            bottomNavigationBar: Container(
              decoration: BoxDecoration(
                color: kSurface,
                border: const Border(top: BorderSide(color: kBorderLt)),
                boxShadow: [
                  BoxShadow(
                    color: kPrimary.withValues(alpha: 0.04),
                    blurRadius: 16,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Row(
                    children: List.generate(_tabs.length, (i) {
                      final on = i == _i;
                      final isReferral = i == 2;
                      final isTabEnabled =
                          (i == 0 || i == 2) || (isVerified && isAccountActive);
                      const activeColor = kPrimary;

                      return Expanded(
                        child: GestureDetector(
                          onTap: () {
                            if (i == 1) {
                              if (!isVerified) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Verification pending. Please wait for admin approval.',
                                    ),
                                    backgroundColor: Colors.redAccent,
                                    duration: Duration(seconds: 2),
                                  ),
                                );
                                return;
                              }
                              if (!isAccountActive) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Account is inactive. Please contact admin.',
                                    ),
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
                              if (isReferral)
                                Container(
                                  height: 42,
                                  alignment: Alignment.center,
                                  child: Stack(
                                    clipBehavior: Clip.none,
                                    alignment: Alignment.center,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                                        decoration: BoxDecoration(
                                          gradient: on
                                              ? const LinearGradient(
                                                  colors: [
                                                    Color(0xFFFFFBEB), // Pale bright gold highlight
                                                    Color(0xFFFDE68A), // Radiant yellow gold
                                                    Color(0xFFF59E0B), // Vibrant amber gold
                                                    Color(0xFFD97706), // Rich deep gold
                                                  ],
                                                  begin: Alignment.topLeft,
                                                  end: Alignment.bottomRight,
                                                )
                                              : const LinearGradient(
                                                  colors: [
                                                    Color(0xFFFF9933), // Saffron (India Flag Top)
                                                    Color(0xFFFFFFFF), // White (India Flag Middle)
                                                    Color(0xFFFFFFFF), // White
                                                    Color(0xFF138808), // Green (India Flag Bottom)
                                                  ],
                                                  stops: [0.0, 0.38, 0.62, 1.0],
                                                  begin: Alignment.topCenter,
                                                  end: Alignment.bottomCenter,
                                                ),
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(
                                            color: on
                                                ? const Color(0xFFB45309)
                                                : const Color(0xFFCBD5E1),
                                            width: on ? 2.0 : 1.4,
                                          ),
                                          boxShadow: on
                                              ? [
                                                  BoxShadow(
                                                    color: const Color(0xFFF59E0B).withValues(alpha: 0.5),
                                                    blurRadius: 12,
                                                    offset: const Offset(0, 3),
                                                  ),
                                                  BoxShadow(
                                                    color: const Color(0xFFFFD700).withValues(alpha: 0.3),
                                                    blurRadius: 6,
                                                    offset: const Offset(0, 1),
                                                  ),
                                                ]
                                              : [
                                                  BoxShadow(
                                                    color: const Color(0xFFFF9933).withValues(alpha: 0.25),
                                                    blurRadius: 6,
                                                    offset: const Offset(0, -1),
                                                  ),
                                                  BoxShadow(
                                                    color: const Color(0xFF138808).withValues(alpha: 0.25),
                                                    blurRadius: 6,
                                                    offset: const Offset(0, 2),
                                                  ),
                                                ],
                                        ),
                                        child: RichText(
                                          text: TextSpan(
                                            children: _buildMultiColorReferralSpans(on, isTabEnabled),
                                          ),
                                        ),
                                      ),
                                      Positioned(
                                        top: -9,
                                        right: -8,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 7.5, vertical: 2),
                                          decoration: BoxDecoration(
                                            gradient: on
                                                ? const LinearGradient(
                                                    colors: [
                                                      Color(0xFF78350F),
                                                      Color(0xFF451A03),
                                                      Color(0xFF291102),
                                                    ],
                                                    begin: Alignment.topLeft,
                                                    end: Alignment.bottomRight,
                                                  )
                                                : const LinearGradient(
                                                    colors: [
                                                      Color(0xFF0F172A),
                                                      Color(0xFF064E3B),
                                                      Color(0xFF052E16),
                                                    ],
                                                    begin: Alignment.topLeft,
                                                    end: Alignment.bottomRight,
                                                  ),
                                            borderRadius: BorderRadius.circular(8),
                                            border: Border.all(
                                              color: on
                                                  ? const Color(0xFFFFD700)
                                                  : const Color(0xFF4ADE80),
                                              width: 1.3,
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: on
                                                    ? const Color(0xFFD97706).withValues(alpha: 0.5)
                                                    : const Color(0xFF064E3B).withValues(alpha: 0.4),
                                                blurRadius: 6,
                                                offset: const Offset(0, 2),
                                              ),
                                            ],
                                          ),
                                          child: Text(
                                            '₹75',
                                            style: GoogleFonts.roboto(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w900,
                                              color: on
                                                  ? const Color(0xFFFFD700)
                                                  : const Color(0xFF4ADE80),
                                              letterSpacing: -0.2,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                              else
                                AnimatedContainer(
                                  duration: const Duration(milliseconds: 200),
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: on ? activeColor : Colors.transparent,
                                    shape: BoxShape.circle,
                                    boxShadow: on
                                        ? [
                                            BoxShadow(
                                              color: activeColor.withValues(alpha: 0.35),
                                              blurRadius: 8,
                                              offset: const Offset(0, 3),
                                            ),
                                          ]
                                        : [],
                                  ),
                                  child: Icon(
                                    _tabs[i].$1,
                                    color: on
                                        ? Colors.white
                                        : (isTabEnabled
                                            ? kMuted
                                            : kMuted.withValues(alpha: 0.3)),
                                    size: 20,
                                  ),
                                ),
                              const SizedBox(height: 4),
                              Text(
                                _tabs[i].$2,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: on
                                      ? FontWeight.w800
                                      : (isReferral ? FontWeight.w700 : FontWeight.w500),
                                  color: on
                                      ? activeColor
                                      : (isReferral
                                          ? kPrimary.withValues(alpha: 0.85)
                                          : (isTabEnabled
                                              ? kMuted
                                              : kMuted.withValues(alpha: 0.3))),
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
    MockDataService().tabNavigationNotifier.addListener(
      _onTabNavigationRequested,
    );

    // Request location permissions on app startup
    _requestLocationPermission();

    // Initialize location tracking service
    _locationTrackingService = sl<LocationTrackingService>();

    // Foreground notification
    if (Firebase.apps.isNotEmpty) {
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
      if (!kIsWeb) {
        FirebaseMessaging.instance.getToken().then((token) {
          print("FCM TOKEN: $token");
        }).catchError((e) {
          print('Error getting FCM token: $e');
        });
      }
    }
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
    MockDataService().tabNavigationNotifier.removeListener(
      _onTabNavigationRequested,
    );
    _locationTrackingService.stopTracking();
    super.dispose();
  }
}
