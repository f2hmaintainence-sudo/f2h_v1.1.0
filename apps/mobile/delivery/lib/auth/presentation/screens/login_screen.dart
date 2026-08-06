import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/app.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_state.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_delivery/auth/presentation/screens/signup_screen.dart';
import 'package:f2h_delivery/auth/presentation/widgets/forgot_password_sheet.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with TickerProviderStateMixin {
  final _identifierCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscurePassword = true;
  bool _identifierFocused = false;
  bool _passwordFocused = false;

  late AnimationController _bgAnim;
  late AnimationController _shakeAnim;
  late AnimationController _fadeIn;
  late Animation<double> _fadeInAnim;
  late Animation<double> _slideUpAnim;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));

    _bgAnim = AnimationController(vsync: this, duration: const Duration(seconds: 8))..repeat();
    _shakeAnim = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));
    _fadeIn = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..forward();

    _fadeInAnim = CurvedAnimation(parent: _fadeIn, curve: Curves.easeOut);
    _slideUpAnim = Tween<double>(begin: 40, end: 0).animate(
      CurvedAnimation(parent: _fadeIn, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    _identifierCtrl.dispose();
    _passwordCtrl.dispose();
    _bgAnim.dispose();
    _shakeAnim.dispose();
    _fadeIn.dispose();
    super.dispose();
  }

  void _onLogin() {
    if (_identifierCtrl.text.trim().isEmpty || _passwordCtrl.text.isEmpty) {
      _shakeAnim.forward(from: 0);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Please fill in all fields', style: GoogleFonts.poppins()),
          backgroundColor: kPrimary,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }
    context.read<AuthBloc>().add(
      LoginRequested(
        identifier: _identifierCtrl.text.trim(),
        password: _passwordCtrl.text,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is Authenticated) {
          SharedPreferences.getInstance().then((prefs) {
            prefs.setBool('has_completed_onboarding', true);
          });
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const AppShell()),
            (route) => false,
          );
        } else if (state is AuthFailure) {
          _shakeAnim.forward(from: 0);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.error, style: GoogleFonts.poppins()),
              backgroundColor: kRed,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        }
      },
      child: Scaffold(
        backgroundColor: kBg,
        body: Stack(
          children: [
            _AnimatedBackground(controller: _bgAnim),

            SafeArea(
              child: SingleChildScrollView(
                child: AnimatedBuilder(
                  animation: Listenable.merge([_fadeInAnim, _slideUpAnim]),
                  builder: (_, child) => Opacity(
                    opacity: _fadeInAnim.value,
                    child: Transform.translate(
                      offset: Offset(0, _slideUpAnim.value),
                      child: child,
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 24),

                        Center(
                          child: Column(
                            children: [
                              Container(
                                width: 78,
                                height: 78,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(22),
                                  boxShadow: [
                                    BoxShadow(
                                      color: kPrimary.withValues(alpha: 0.2),
                                      blurRadius: 20,
                                      spreadRadius: 1,
                                      offset: const Offset(0, 6),
                                    ),
                                  ],
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(22),
                                  child: Image.asset(
                                    'assets/icon/delivery_logo.png',
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => Container(
                                      color: kPrimary,
                                      child: const Icon(Icons.eco_rounded, color: Colors.white, size: 36),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 16),
                              Text(
                                'F2H DELIVERY',
                                style: GoogleFonts.poppins(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: kTextSub,
                                  letterSpacing: 3,
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 40),

                        Text(
                          'Welcome Back',
                          style: GoogleFonts.poppins(
                            fontSize: 30,
                            fontWeight: FontWeight.w700,
                            color: kText,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Sign in to manage your deliveries',
                          style: GoogleFonts.poppins(fontSize: 14, color: kTextSub, height: 1.4),
                        ),

                        const SizedBox(height: 36),

                        AnimatedBuilder(
                          animation: _shakeAnim,
                          builder: (_, child) {
                            final shake = math.sin(_shakeAnim.value * math.pi * 6) * 6;
                            return Transform.translate(
                              offset: Offset(shake, 0),
                              child: child,
                            );
                          },
                          child: Container(
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: kSurface,
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(color: kBorder, width: 1),
                              boxShadow: [
                                BoxShadow(
                                  color: kPrimary.withValues(alpha: 0.06),
                                  blurRadius: 32,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: Column(
                              children: [
                                Focus(
                                  onFocusChange: (f) => setState(() => _identifierFocused = f),
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 200),
                                    decoration: BoxDecoration(
                                      color: _identifierFocused ? kPrimaryPl.withValues(alpha: 0.3) : kBgDeep,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: _identifierFocused ? kPrimaryLt : kBorder,
                                        width: _identifierFocused ? 1.5 : 1,
                                      ),
                                    ),
                                    child: TextField(
                                      controller: _identifierCtrl,
                                      keyboardType: TextInputType.emailAddress,
                                      style: GoogleFonts.poppins(
                                        color: kText,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w500,
                                      ),
                                      decoration: InputDecoration(
                                        prefixIcon: Icon(
                                          Icons.mail_outline_rounded,
                                          color: _identifierFocused ? kPrimaryMid : kMuted,
                                          size: 20,
                                        ),
                                        hintText: 'Email or Phone',
                                        hintStyle: GoogleFonts.poppins(
                                          color: kMuted,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w400,
                                        ),
                                        border: InputBorder.none,
                                        contentPadding: const EdgeInsets.symmetric(
                                          horizontal: 16,
                                          vertical: 16,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),

                                const SizedBox(height: 14),

                                Focus(
                                  onFocusChange: (f) => setState(() => _passwordFocused = f),
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 200),
                                    decoration: BoxDecoration(
                                      color: _passwordFocused ? kPrimaryPl.withValues(alpha: 0.3) : kBgDeep,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: _passwordFocused ? kPrimaryLt : kBorder,
                                        width: _passwordFocused ? 1.5 : 1,
                                      ),
                                    ),
                                    child: TextField(
                                      controller: _passwordCtrl,
                                      obscureText: _obscurePassword,
                                      style: GoogleFonts.poppins(
                                        color: kText,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w500,
                                      ),
                                      decoration: InputDecoration(
                                        prefixIcon: Icon(
                                          Icons.lock_outline_rounded,
                                          color: _passwordFocused ? kPrimaryMid : kMuted,
                                          size: 20,
                                        ),
                                        hintText: 'Password',
                                        hintStyle: GoogleFonts.poppins(
                                          color: kMuted,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w400,
                                        ),
                                        border: InputBorder.none,
                                        contentPadding: const EdgeInsets.symmetric(
                                          horizontal: 16,
                                          vertical: 16,
                                        ),
                                        suffixIcon: IconButton(
                                          icon: Icon(
                                            _obscurePassword
                                                ? Icons.visibility_off_rounded
                                                : Icons.visibility_rounded,
                                            color: kMuted,
                                            size: 20,
                                          ),
                                          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),

                                const SizedBox(height: 10),

                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton(
                                    onPressed: () {
                                      showModalBottomSheet(
                                        context: context,
                                        isScrollControlled: true,
                                        backgroundColor: Colors.transparent,
                                        builder: (_) => const ForgotPasswordSheet(),
                                      );
                                    },
                                    child: Text(
                                      'Forgot Password?',
                                      style: GoogleFonts.poppins(
                                        color: kAccent,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                        const SizedBox(height: 20),

                        BlocBuilder<AuthBloc, AuthState>(
                          builder: (context, state) {
                            final loading = state is AuthLoading;
                            return _PremiumButton(
                              label: 'Sign In',
                              icon: Icons.arrow_forward_rounded,
                              loading: loading,
                              onTap: loading ? null : _onLogin,
                            );
                          },
                        ),

                        const SizedBox(height: 36),

                        Center(
                          child: GestureDetector(
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const SignupScreen()),
                            ),
                            child: RichText(
                              text: TextSpan(
                                text: "Don't have an account? ",
                                style: GoogleFonts.poppins(color: kTextSub, fontSize: 14),
                                children: [
                                  TextSpan(
                                    text: 'Sign Up',
                                    style: GoogleFonts.poppins(
                                      color: kPrimaryMid,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 40),
                      ],
                    ),
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

// ─── Animated Background Widget ────────────────────────────────────────────────
class _AnimatedBackground extends StatelessWidget {
  final AnimationController controller;
  const _AnimatedBackground({required this.controller});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (_, _) {
        final t = controller.value;
        final y = math.sin(t * math.pi * 2) * 60;
        final x = math.cos(t * math.pi * 1.5) * 40;
        return Stack(
          children: [
            Positioned(
              top: -100 + y,
              left: -60 + x,
              child: Container(
                width: 360,
                height: 360,
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
              bottom: -80 - y * 0.5,
              right: -60 - x * 0.5,
              child: Container(
                width: 280,
                height: 280,
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
          ],
        );
      },
    );
  }
}

// ─── Premium CTA Button ────────────────────────────────────────────────────────
class _PremiumButton extends StatefulWidget {
  final String label;
  final IconData icon;
  final bool loading;
  final VoidCallback? onTap;

  const _PremiumButton({
    required this.label,
    required this.icon,
    required this.loading,
    this.onTap,
  });

  @override
  State<_PremiumButton> createState() => _PremiumButtonState();
}

class _PremiumButtonState extends State<_PremiumButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap?.call();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          height: 58,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: widget.loading
                  ? [kBorder, kBorder]
                  : [kPrimaryMid, kPrimary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: widget.loading
                ? []
                : [
                    BoxShadow(
                      color: kPrimary.withValues(alpha: 0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
          ),
          child: Center(
            child: widget.loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.label,
                        style: GoogleFonts.poppins(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                          letterSpacing: 0.3,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(widget.icon, color: kAccent, size: 20),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

