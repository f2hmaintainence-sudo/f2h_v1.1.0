import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_delivery/features/onboarding/presentation/screens/welcome_intro_screen.dart';
import 'package:geolocator/geolocator.dart';
import 'package:f2h_delivery/app.dart';
import 'package:f2h_delivery/auth/presentation/screens/login_screen.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> with TickerProviderStateMixin {
  int _step = 0; // 0=Identity, 1=OTP, 2=Password

  // Controllers
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _referralCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  final List<TextEditingController> _otpCtrl = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocus = List.generate(6, (_) => FocusNode());

  bool _obscurePass = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;
  String? _selectedBranchId;
  String? _verificationToken;

  // Countdown timer
  int _countdown = 60;
  bool _canResend = false;

  // Animations
  late AnimationController _bgAnim;
  late AnimationController _stepAnim;
  late AnimationController _iconAnim;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
    _bgAnim = AnimationController(vsync: this, duration: const Duration(seconds: 8))..repeat();
    _stepAnim = AnimationController(vsync: this, duration: const Duration(milliseconds: 400));
    _iconAnim = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))
      ..repeat(reverse: true);
    _loadBranch();
  }

  Future<void> _loadBranch() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _selectedBranchId = prefs.getString('onboarding_branch_id');
    });
  }

  @override
  void dispose() {
    _nameCtrl.dispose(); _emailCtrl.dispose(); _phoneCtrl.dispose(); _referralCtrl.dispose();
    _passwordCtrl.dispose(); _confirmCtrl.dispose();
    for (var c in _otpCtrl) c.dispose();
    for (var f in _otpFocus) f.dispose();
    _bgAnim.dispose(); _stepAnim.dispose(); _iconAnim.dispose();
    super.dispose();
  }

  // ─── Step 1: Send Email OTP ────────────────────────────────────────────────
  Future<void> _sendEmailOtp() async {
    final email = _emailCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    if (_nameCtrl.text.trim().isEmpty || email.isEmpty || phone.isEmpty) {
      _showSnack('Please enter your name, email, and phone number', isError: true);
      return;
    }
    if (!RegExp(r'^[\w.-]+@[\w-]+\.\w+$').hasMatch(email)) {
      _showSnack('Please enter a valid email address', isError: true);
      return;
    }
    if (!RegExp(r'^\d{10,15}$').hasMatch(phone)) {
      _showSnack('Please enter a valid 10-15 digit phone number (digits only)', isError: true);
      return;
    }
    setState(() => _isLoading = true);
    try {
      final dioClient = sl<DioClient>();
      await dioClient.fetchCsrfToken();
      
      await dioClient.dio.post(
        '/auth/send-email-otp',
        data: {'email': email},
      );
      setState(() { _isLoading = false; _step = 1; });
      _stepAnim.forward(from: 0);
      _startCountdown();
      _showSnack('OTP sent to $email ✅');
    } on DioException catch (e) {
      setState(() => _isLoading = false);
      _showSnack(e.response?.data?['message'] ?? 'Failed to send OTP', isError: true);
    }
  }

  void _startCountdown() {
    setState(() { _countdown = 60; _canResend = false; });
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (!mounted) return false;
      setState(() { _countdown--; if (_countdown <= 0) _canResend = true; });
      return _countdown > 0;
    });
  }

  // ─── Step 2: Verify Email OTP ──────────────────────────────────────────────
  Future<void> _verifyEmailOtp() async {
    final otp = _otpCtrl.map((c) => c.text).join();
    if (otp.length < 6) {
      _showSnack('Please enter the complete 6-digit OTP', isError: true);
      return;
    }
    setState(() => _isLoading = true);
    try {
      final dioClient = sl<DioClient>();
      await dioClient.fetchCsrfToken();
      
      final res = await dioClient.dio.post(
        '/auth/verify-email-otp',
        data: {'email': _emailCtrl.text.trim(), 'otp': otp},
      );
      setState(() {
        _verificationToken = res.data['verification_token'] as String?;
        _isLoading = false;
        _step = 2;
      });
      _stepAnim.forward(from: 0);
      _showSnack('Email verified! ✅ Now set your password');
    } on DioException catch (e) {
      setState(() => _isLoading = false);
      _showSnack(e.response?.data?['message'] ?? 'Invalid OTP. Please try again.', isError: true);
    }
  }

  Future<void> _createAccount() async {
    final pass = _passwordCtrl.text;
    final confirm = _confirmCtrl.text;
    if (pass.isEmpty || confirm.isEmpty) {
      _showSnack('Please enter and confirm your password', isError: true);
      return;
    }
    if (pass != confirm) {
      _showSnack('Passwords do not match', isError: true);
      return;
    }
    if (pass.length < 8) {
      _showSnack('Password must be at least 8 characters', isError: true);
      return;
    }

    setState(() => _isLoading = true);

    double? latitude;
    double? longitude;
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (serviceEnabled) {
        LocationPermission permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) {
          permission = await Geolocator.requestPermission();
        }
        if (permission == LocationPermission.always || permission == LocationPermission.whileInUse) {
          final Position position = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.medium,
            timeLimit: const Duration(seconds: 4),
          );
          latitude = position.latitude;
          longitude = position.longitude;
        }
      }
    } catch (e) {
      debugPrint('Failed to get signup location: $e');
    }

    if (!mounted) return;
    context.read<AuthBloc>().add(SignupRequested(
      name: _nameCtrl.text.trim(),
      email: _emailCtrl.text.trim(),
      password: pass,
      phone: _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
      branchId: _selectedBranchId,
      latitude: latitude,
      longitude: longitude,
      verificationToken: _verificationToken,
      referralCode: _referralCtrl.text.trim().isEmpty ? null : _referralCtrl.text.trim(),
    ));
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: GoogleFonts.poppins()),
      backgroundColor: isError ? kRed : kPrimary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }

  double _passwordStrength(String pass) {
    double s = 0;
    if (pass.length >= 8) s += 0.25;
    if (RegExp(r'[A-Z]').hasMatch(pass)) s += 0.25;
    if (RegExp(r'[0-9]').hasMatch(pass)) s += 0.25;
    if (RegExp(r'[!@#\$%^&*]').hasMatch(pass)) s += 0.25;
    return s;
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is Authenticated) {
          // Mark onboarding complete so the splash screen never loops back
          SharedPreferences.getInstance().then((prefs) {
            prefs.setBool('has_completed_onboarding', true);
          });
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const WelcomeIntroScreen(afterSignup: true)),
            (route) => false,
          );
        } else if (state is AuthFailure) {
          _showSnack(state.error, isError: true);
        }
      },
      child: Scaffold(
        backgroundColor: kBg,
        body: Stack(
          children: [
            // Animated background
            _AnimatedBg(controller: _bgAnim),

            SafeArea(
              child: Column(
                children: [
                  // Header
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                    child: Row(
                      children: [
                        if (_step > 0)
                          GestureDetector(
                            onTap: () { setState(() => _step--); _stepAnim.forward(from: 0); },
                            child: Container(
                              width: 40, height: 40,
                              decoration: BoxDecoration(
                                color: kSurface, borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: kBorder),
                                boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.04), blurRadius: 6)],
                              ),
                              child: const Icon(Icons.arrow_back_rounded, color: kText, size: 20),
                            ),
                          )
                        else
                          GestureDetector(
                            onTap: () => Navigator.pop(context),
                            child: Container(
                              width: 40, height: 40,
                              decoration: BoxDecoration(
                                color: kSurface, borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: kBorder),
                                boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.04), blurRadius: 6)],
                              ),
                              child: const Icon(Icons.arrow_back_rounded, color: kText, size: 20),
                            ),
                          ),
                        const Spacer(),
                        // Step indicator
                        _StepIndicator(currentStep: _step),
                        const SizedBox(width: 40),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Content
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 350),
                        transitionBuilder: (child, anim) => SlideTransition(
                          position: Tween<Offset>(
                            begin: const Offset(0.08, 0),
                            end: Offset.zero,
                          ).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
                          child: FadeTransition(opacity: anim, child: child),
                        ),
                        child: KeyedSubtree(
                          key: ValueKey(_step),
                          child: _step == 0
                              ? _buildStep0()
                              : _step == 1
                                  ? _buildStep1()
                                  : _buildStep2(),
                        ),
                      ),
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

  // ─── STEP 0: Identity (Name + Email) ─────────────────────────────────────
  Widget _buildStep0() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Animated icon
        Center(
          child: AnimatedBuilder(
            animation: _iconAnim,
            builder: (_, __) => Transform.translate(
              offset: Offset(0, math.sin(_iconAnim.value * math.pi) * 6),
              child: Container(
                width: 100, height: 100,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: kSurface,
                  border: Border.all(color: kBorder, width: 1.5),
                  boxShadow: [
                    BoxShadow(color: kPrimary.withValues(alpha: 0.08), blurRadius: 24),
                    BoxShadow(color: kPrimaryLt.withValues(alpha: 0.1), blurRadius: 40, spreadRadius: 8),
                  ],
                ),
                child: const Icon(Icons.person_outline_rounded, color: kPrimaryMid, size: 44),
              ),
            ),
          ),
        ),
        const SizedBox(height: 28),

        Text(
          'Create Account',
          style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w700, color: kText, letterSpacing: -0.5),
        ),
        const SizedBox(height: 6),
        Text(
          'Let\'s start with your name and email address',
          style: GoogleFonts.poppins(fontSize: 14, color: kTextSub, height: 1.5),
        ),
        const SizedBox(height: 32),

        _LightField(controller: _nameCtrl, hint: 'Full Name', icon: Icons.badge_outlined, keyboard: TextInputType.name),
        const SizedBox(height: 14),
        _LightField(controller: _emailCtrl, hint: 'Email Address', icon: Icons.email_outlined, keyboard: TextInputType.emailAddress),
        const SizedBox(height: 14),
        _LightField(controller: _phoneCtrl, hint: 'Phone Number', icon: Icons.phone_android_rounded, keyboard: TextInputType.phone),
        const SizedBox(height: 14),
        _LightField(
          controller: _referralCtrl,
          hint: 'Referral Code (Optional)',
          icon: Icons.card_giftcard_outlined,
          keyboard: TextInputType.text,
        ),
        const SizedBox(height: 32),

        _GreenButton(
          label: 'Send Verification Code',
          icon: Icons.send_rounded,
          loading: _isLoading,
          onTap: _isLoading ? null : _sendEmailOtp,
        ),
        const SizedBox(height: 28),

        Center(
          child: GestureDetector(
            onTap: () => Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => const LoginScreen()),
            ),
            child: RichText(
              text: TextSpan(
                text: 'Already have an account? ',
                style: GoogleFonts.poppins(color: kTextSub, fontSize: 14),
                children: [
                  TextSpan(
                    text: 'Sign In',
                    style: GoogleFonts.poppins(color: kPrimaryMid, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 40),
      ],
    );
  }

  // ─── STEP 1: OTP Verification ─────────────────────────────────────────────
  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Animated email icon
        Center(
          child: AnimatedBuilder(
            animation: _iconAnim,
            builder: (_, __) => Stack(
              alignment: Alignment.topRight,
              children: [
                Transform.translate(
                  offset: Offset(0, math.sin(_iconAnim.value * math.pi) * 6),
                  child: Container(
                    width: 100, height: 100,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: kSurface,
                      border: Border.all(color: kBorder, width: 1.5),
                      boxShadow: [
                        BoxShadow(color: kPrimary.withValues(alpha: 0.08), blurRadius: 24),
                        BoxShadow(color: kPrimaryLt.withValues(alpha: 0.1), blurRadius: 40, spreadRadius: 8),
                      ],
                    ),
                    child: const Icon(Icons.mark_email_read_outlined, color: kPrimaryMid, size: 44),
                  ),
                ),
                // Notification badge
                Container(
                  width: 22, height: 22,
                  decoration: const BoxDecoration(color: kAccent, shape: BoxShape.circle),
                  child: Center(
                    child: Text('1', style: GoogleFonts.poppins(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 28),

        Text(
          'Check Your Email',
          style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w700, color: kText, letterSpacing: -0.5),
        ),
        const SizedBox(height: 6),
        RichText(
          text: TextSpan(
            text: 'We sent a 6-digit code to ',
            style: GoogleFonts.poppins(color: kTextSub, fontSize: 14, height: 1.5),
            children: [
              TextSpan(
                text: _emailCtrl.text.trim(),
                style: GoogleFonts.poppins(color: kPrimaryMid, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
        const SizedBox(height: 36),

        // 6-box OTP input
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(6, (i) => _OtpBox(
            controller: _otpCtrl[i],
            focusNode: _otpFocus[i],
            onChanged: (v) {
              if (v.isNotEmpty && i < 5) _otpFocus[i + 1].requestFocus();
              if (v.isEmpty && i > 0) _otpFocus[i - 1].requestFocus();
            },
          )),
        ),

        const SizedBox(height: 32),

        _GreenButton(
          label: 'Verify Email',
          icon: Icons.verified_outlined,
          loading: _isLoading,
          onTap: _isLoading ? null : _verifyEmailOtp,
        ),

        const SizedBox(height: 24),

        // Resend
        Center(
          child: _canResend
              ? GestureDetector(
                  onTap: () async {
                    setState(() => _isLoading = true);
                    try {
                      final dioClient = sl<DioClient>();
                      await dioClient.fetchCsrfToken();
                      
                      await dioClient.dio.post(
                        '/auth/send-email-otp',
                        data: {'email': _emailCtrl.text.trim()},
                      );
                      setState(() => _isLoading = false);
                      _startCountdown();
                      _showSnack('OTP resent ✅');
                    } catch (e) {
                      setState(() => _isLoading = false);
                      _showSnack('Failed to resend OTP', isError: true);
                    }
                  },
                  child: Text(
                    'Resend OTP',
                    style: GoogleFonts.poppins(color: kPrimaryMid, fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                )
              : Text(
                  'Resend code in ${_countdown}s',
                  style: GoogleFonts.poppins(color: kMuted, fontSize: 14),
                ),
        ),
        const SizedBox(height: 40),
      ],
    );
  }

  // ─── STEP 2: Set Password ─────────────────────────────────────────────────
  Widget _buildStep2() {
    final pass = _passwordCtrl.text;
    final strength = _passwordStrength(pass);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Lock icon
        Center(
          child: AnimatedBuilder(
            animation: _iconAnim,
            builder: (_, __) => Transform.translate(
              offset: Offset(0, math.sin(_iconAnim.value * math.pi) * 6),
              child: Container(
                width: 100, height: 100,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: kSurface,
                  border: Border.all(color: kPrimaryLt.withValues(alpha: 0.4), width: 1.5),
                  boxShadow: [
                    BoxShadow(color: kPrimaryLt.withValues(alpha: 0.12), blurRadius: 24),
                    BoxShadow(color: kPrimaryLt.withValues(alpha: 0.08), blurRadius: 40, spreadRadius: 8),
                  ],
                ),
                child: const Icon(Icons.lock_open_rounded, color: kPrimaryMid, size: 44),
              ),
            ),
          ),
        ),
        const SizedBox(height: 28),

        Text(
          'Set Your Password',
          style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w700, color: kText, letterSpacing: -0.5),
        ),
        const SizedBox(height: 6),
        Text(
          'Choose a strong password with 8+ characters',
          style: GoogleFonts.poppins(fontSize: 14, color: kTextSub, height: 1.5),
        ),
        const SizedBox(height: 32),

        // Password
        _LightField(
          controller: _passwordCtrl,
          hint: 'Password',
          icon: Icons.lock_outline_rounded,
          obscure: _obscurePass,
          onToggleObscure: () => setState(() => _obscurePass = !_obscurePass),
          onChanged: (_) => setState(() {}),
        ),

        // Strength bar
        if (pass.isNotEmpty) ...[
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: strength,
                    backgroundColor: kBorder,
                    valueColor: AlwaysStoppedAnimation(
                      strength < 0.4 ? kRed : strength < 0.75 ? kAccent : kPrimaryLt,
                    ),
                    minHeight: 5,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                strength < 0.4 ? 'Weak' : strength < 0.75 ? 'Fair' : 'Strong',
                style: GoogleFonts.poppins(
                  color: strength < 0.4 ? kRed : strength < 0.75 ? kAccent : kPrimaryLt,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ],

        const SizedBox(height: 14),

        _LightField(
          controller: _confirmCtrl,
          hint: 'Confirm Password',
          icon: Icons.lock_outline_rounded,
          obscure: _obscureConfirm,
          onToggleObscure: () => setState(() => _obscureConfirm = !_obscureConfirm),
        ),

        const SizedBox(height: 32),

        BlocBuilder<AuthBloc, AuthState>(
          builder: (context, state) => _GreenButton(
            label: 'Create Account',
            icon: Icons.check_circle_outline_rounded,
            loading: state is AuthLoading,
            onTap: state is AuthLoading ? null : _createAccount,
          ),
        ),
        const SizedBox(height: 40),
      ],
    );
  }
}

// ─── Step Indicator ────────────────────────────────────────────────────────────
class _StepIndicator extends StatelessWidget {
  final int currentStep;
  const _StepIndicator({required this.currentStep});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(3, (i) {
        final done = i < currentStep;
        final active = i == currentStep;
        return Row(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: active ? 28 : 8,
              height: 8,
              decoration: BoxDecoration(
                color: done ? kPrimaryLt : active ? kPrimaryMid : kBorder,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            if (i < 2) const SizedBox(width: 6),
          ],
        );
      }),
    );
  }
}

// ─── OTP Box ──────────────────────────────────────────────────────────────────
class _OtpBox extends StatefulWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  const _OtpBox({required this.controller, required this.focusNode, required this.onChanged});

  @override
  State<_OtpBox> createState() => _OtpBoxState();
}

class _OtpBoxState extends State<_OtpBox> {
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    widget.focusNode.addListener(() {
      if (mounted) setState(() => _focused = widget.focusNode.hasFocus);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: 46,
      height: 56,
      decoration: BoxDecoration(
        color: _focused ? kPrimaryPl.withValues(alpha: 0.3) : kSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: _focused ? kPrimaryLt : kBorder,
          width: _focused ? 2 : 1,
        ),
        boxShadow: _focused
            ? [BoxShadow(color: kPrimaryLt.withValues(alpha: 0.15), blurRadius: 12)]
            : [BoxShadow(color: kPrimary.withValues(alpha: 0.04), blurRadius: 6)],
      ),
      child: TextField(
        controller: widget.controller,
        focusNode: widget.focusNode,
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        maxLength: 1,
        style: GoogleFonts.poppins(
          fontSize: 22,
          fontWeight: FontWeight.w700,
          color: kPrimary,
        ),
        decoration: const InputDecoration(counterText: '', border: InputBorder.none),
        onChanged: widget.onChanged,
      ),
    );
  }
}

// ─── Light Input Field ─────────────────────────────────────────────────────────
class _LightField extends StatefulWidget {
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final TextInputType keyboard;
  final bool obscure;
  final VoidCallback? onToggleObscure;
  final ValueChanged<String>? onChanged;

  const _LightField({
    required this.controller,
    required this.hint,
    required this.icon,
    this.keyboard = TextInputType.text,
    this.obscure = false,
    this.onToggleObscure,
    this.onChanged,
  });

  @override
  State<_LightField> createState() => _LightFieldState();
}

class _LightFieldState extends State<_LightField> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    return Focus(
      onFocusChange: (f) => setState(() => _focused = f),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: _focused ? kPrimaryPl.withValues(alpha: 0.25) : kSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: _focused ? kPrimaryLt : kBorder,
            width: _focused ? 1.5 : 1,
          ),
          boxShadow: _focused
              ? [BoxShadow(color: kPrimaryLt.withValues(alpha: 0.12), blurRadius: 12)]
              : [BoxShadow(color: kPrimary.withValues(alpha: 0.04), blurRadius: 6)],
        ),
        child: TextField(
          controller: widget.controller,
          keyboardType: widget.keyboard,
          obscureText: widget.obscure,
          onChanged: widget.onChanged,
          style: GoogleFonts.poppins(color: kText, fontSize: 15, fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            prefixIcon: Icon(
              widget.icon,
              color: _focused ? kPrimaryMid : kMuted,
              size: 20,
            ),
            hintText: widget.hint,
            hintStyle: GoogleFonts.poppins(color: kMuted, fontSize: 14),
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            suffixIcon: widget.onToggleObscure != null
                ? IconButton(
                    icon: Icon(
                      widget.obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                      color: kMuted,
                      size: 20,
                    ),
                    onPressed: widget.onToggleObscure,
                  )
                : null,
          ),
        ),
      ),
    );
  }
}

// ─── Green CTA Button ─────────────────────────────────────────────────────────
class _GreenButton extends StatefulWidget {
  final String label;
  final IconData icon;
  final bool loading;
  final VoidCallback? onTap;
  const _GreenButton({required this.label, required this.icon, required this.loading, this.onTap});

  @override
  State<_GreenButton> createState() => _GreenButtonState();
}

class _GreenButtonState extends State<_GreenButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) { setState(() => _pressed = false); widget.onTap?.call(); },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          height: 58,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: widget.loading ? [kBorder, kBorder] : [kPrimaryMid, kPrimary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: widget.loading ? [] : [
              BoxShadow(color: kPrimary.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 8)),
            ],
          ),
          child: Center(
            child: widget.loading
                ? const SizedBox(width: 22, height: 22,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(widget.label,
                          style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w600,
                              color: Colors.white, letterSpacing: 0.3)),
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

// ─── Animated Background ──────────────────────────────────────────────────────
class _AnimatedBg extends StatelessWidget {
  final AnimationController controller;
  const _AnimatedBg({required this.controller});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (_, __) {
        final t = controller.value;
        final y = math.sin(t * math.pi * 2) * 50;
        final x = math.cos(t * math.pi * 1.5) * 35;
        return Stack(
          children: [
            Positioned(
              top: -100 + y,
              left: -60 + x,
              child: Container(
                width: 340, height: 340,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    kPrimaryPl.withValues(alpha: 0.45),
                    Colors.transparent,
                  ]),
                ),
              ),
            ),
            Positioned(
              bottom: -80 - y * 0.5,
              right: -60 - x * 0.5,
              child: Container(
                width: 260, height: 260,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    kAccentLt.withValues(alpha: 0.35),
                    Colors.transparent,
                  ]),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
