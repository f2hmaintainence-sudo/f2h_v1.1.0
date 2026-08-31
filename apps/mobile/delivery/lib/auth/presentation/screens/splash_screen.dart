import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/app.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_delivery/auth/presentation/screens/login_screen.dart';
import 'package:f2h_delivery/core/utils/version_checker.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _scaleController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  /// Splash routes exactly once — the listener and the mount-time check below
  /// can both see the same resolved state.
  bool _routed = false;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));

    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _scaleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    );
    _scaleAnimation = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _scaleController, curve: Curves.elasticOut),
    );

    _fadeController.forward();
    _scaleController.forward();

    // The session check may already have resolved before this listener was
    // attached; a BlocListener only reports changes, so read the state once.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _onAuthStateResolved(context.read<AuthBloc>().state);
    });
  }

  /// Routes off the splash once the session is known either way.
  void _onAuthStateResolved(AuthState state) {
    if (_routed) return;
    if (state is AuthInitial || state is AuthLoading) return;
    _routed = true;
    Future.delayed(const Duration(milliseconds: 800), () {
      _checkOnboardingAndNavigate(state);
    });
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _scaleController.dispose();
    super.dispose();
  }

  Future<void> _checkOnboardingAndNavigate(AuthState authState) async {
    try {
      if (!mounted) return;

      // ── PRIORITY 0: App Version Check ──────────────────────────────────────
      final isBlocked = await VersionChecker.checkUpdates(context);
      if (isBlocked) return; // Keep showing splash screen under dialog if blocked

      // ── PRIORITY 1: Valid session → go straight to Dashboard ──────────────
      // This ensures a logged-in user NEVER gets sent back to onboarding,
      // even if they haven't finished every KYC step.
      if (authState is Authenticated) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const AppShell()),
        );
        return;
      }

      // ── PRIORITY 2: No session → go directly to login ───────────────────
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    } catch (e) {
      // Fallback in case of error
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        // Once AuthCheckRequested completes and resolves the state, execute routing
        _onAuthStateResolved(state);
      },
      child: Scaffold(
        backgroundColor: kBg,
        body: Stack(
          children: [
            // Soft radial gradient background
            Positioned(
              top: -140,
              left: -100,
              child: Container(
                width: 400,
                height: 400,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      kPrimaryPl.withValues(alpha: 0.5),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: -120,
              right: -80,
              child: Container(
                width: 320,
                height: 320,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      kAccentLt.withValues(alpha: 0.4),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),

            // Main content
            Center(
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: ScaleTransition(
                  scale: _scaleAnimation,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Logo circle
                      Container(
                        width: 104,
                        height: 104,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(28),
                          boxShadow: [
                            BoxShadow(
                              color: kPrimary.withValues(alpha: 0.25),
                              blurRadius: 32,
                              spreadRadius: 2,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(28),
                          child: Image.asset(
                            'assets/icon/delivery_logo.png',
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              color: kPrimary,
                              child: const Icon(
                                Icons.eco_rounded,
                                size: 48,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),
                      Text(
                        'F2H FRESH',
                        style: GoogleFonts.roboto(
                          fontSize: 32,
                          fontWeight: FontWeight.w800,
                          color: kPrimary,
                          letterSpacing: 2.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Delivery Partner',
                        style: GoogleFonts.roboto(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: kTextSub,
                          letterSpacing: 1.0,
                        ),
                      ),
                      const SizedBox(height: 48),
                      SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(
                          color: kAccent,
                          strokeWidth: 2.5,
                          strokeCap: StrokeCap.round,
                        ),
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
  }
}
