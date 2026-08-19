// ============================================================================
// F2H Fresh — Delivery Partner App
// File        : register_screen.dart
// Description : Premium 3-step partner registration — F2H design pattern.
//               Step 0: Identity (name, email, phone) → send email OTP
//               Step 1: 6-digit OTP verification
//               Step 2: Password creation → account registration
// ============================================================================

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
import 'package:f2h_delivery/auth/presentation/screens/login_screen.dart';
import 'package:geolocator/geolocator.dart';
import 'package:f2h_delivery/app.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen>
    with SingleTickerProviderStateMixin {
  int _step = 0; // 0=Identity, 1=OTP, 2=Password

  // Controllers
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl  = TextEditingController();
  final _emailCtrl     = TextEditingController();
  final _phoneCtrl     = TextEditingController();
  final _passwordCtrl  = TextEditingController();
  final _confirmCtrl   = TextEditingController();
  final List<TextEditingController> _otpCtrl =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocus = List.generate(6, (_) => FocusNode());

  // Focus nodes for identity step
  final _firstNameFocus = FocusNode();
  final _lastNameFocus  = FocusNode();
  final _emailFocus     = FocusNode();
  final _phoneFocus     = FocusNode();
  final _passFocus    = FocusNode();
  final _confirmFocus = FocusNode();

  bool _obscurePass    = true;
  bool _obscureConfirm = true;
  bool _isLoading      = false;
  String? _selectedBranchId;
  String? _verificationToken;

  // OTP countdown
  int  _countdown  = 60;
  bool _canResend  = false;

  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
    _fadeAnim  = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.07),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOutCubic));

    for (final n in [_firstNameFocus, _lastNameFocus, _emailFocus, _phoneFocus, _passFocus, _confirmFocus]) {
      n.addListener(() => setState(() {}));
    }

    _passwordCtrl.addListener(() => setState(() {}));

    _loadBranch();
  }

  Future<void> _loadBranch() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() => _selectedBranchId = prefs.getString('onboarding_branch_id'));
  }

  @override
  void dispose() {
    for (final c in [_firstNameCtrl, _lastNameCtrl, _emailCtrl, _phoneCtrl, _passwordCtrl, _confirmCtrl]) {
      c.dispose();
    }
    for (final c in _otpCtrl) {
      c.dispose();
    }
    for (final n in _otpFocus) {
      n.dispose();
    }
    _firstNameFocus.dispose(); _lastNameFocus.dispose();
    _emailFocus.dispose(); _phoneFocus.dispose();
    _passFocus.dispose(); _confirmFocus.dispose();
    _fadeCtrl.dispose();
    super.dispose();
  }

  void _animateStep() {
    _fadeCtrl.forward(from: 0);
  }

  void _goBack() {
    if (_step > 0) {
      setState(() { _step--; _animateStep(); });
    } else {
      Navigator.pop(context);
    }
  }

  // ─── Step 0 → Step 1: Send Email OTP ─────────────────────────────────────
  Future<void> _sendEmailOtp() async {
    FocusScope.of(context).unfocus();
    final firstName = _firstNameCtrl.text.trim();
    final email = _emailCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    if (firstName.isEmpty || email.isEmpty || phone.isEmpty) {
      _showSnack('Please enter First Name, Email, and Phone Number', isError: true);
      return;
    }
    if (!RegExp(r'^[\w.-]+@[\w-]+\.\w+$').hasMatch(email)) {
      _showSnack('Please enter a valid email address', isError: true);
      return;
    }
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(phone)) {
      _showSnack('Please enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9)', isError: true);
      return;
    }
    setState(() => _isLoading = true);
    try {
      final dioClient = sl<DioClient>();
      await dioClient.fetchCsrfToken();
      await dioClient.dio.post(
        ApiEndpoints.sendEmailOtp,
        data: {
          'email': email,
          'purpose': 'delivery_partner_registration',
          'role': 'DELIVERY_PARTNER',
        },
      );
      setState(() { _isLoading = false; _step = 1; });
      _animateStep();
      _startCountdown();
      _showSnack('OTP sent to $email ✅');
    } on DioException catch (e) {
      setState(() => _isLoading = false);
      final msg = ((e.response?.data as Map?)?['message'] ?? 'Failed to send OTP').toString();
      _showSnack(msg, isError: true);
      if (e.response?.statusCode == 409 || msg.toLowerCase().contains('already')) {
        _showAlreadyExistsDialog(msg);
      }
    } catch (_) {
      setState(() => _isLoading = false);
      _showSnack('Connection error. Please try again.', isError: true);
    }
  }

  // ─── Step 1 → Step 2: Verify OTP ─────────────────────────────────────────
  Future<void> _verifyEmailOtp() async {
    FocusScope.of(context).unfocus();
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
        ApiEndpoints.verifyEmailOtp,
        data: {
          'email': _emailCtrl.text.trim(),
          'otp': otp,
          'purpose': 'delivery_partner_registration',
          'role': 'DELIVERY_PARTNER',
        },
      );
      setState(() {
        _verificationToken = (res.data as Map?)?['verification_token']?.toString();
        _isLoading = false;
        _step = 2;
      });
      _animateStep();
      _showSnack('Email verified! ✅ Set your password');
    } on DioException catch (e) {
      setState(() => _isLoading = false);
      _showSnack(
        ((e.response?.data as Map?)?['message'] ?? 'Invalid OTP. Try again.').toString(),
        isError: true,
      );
    }
  }

  // ─── Step 2: Create Account ───────────────────────────────────────────────
  Future<void> _createAccount() async {
    FocusScope.of(context).unfocus();
    final pass    = _passwordCtrl.text;
    final confirm = _confirmCtrl.text;
    if (pass.isEmpty || confirm.isEmpty) {
      _showSnack('Please set and confirm your password', isError: true);
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

    double? lat, lng;
    try {
      bool svcEnabled = await Geolocator.isLocationServiceEnabled();
      if (svcEnabled) {
        LocationPermission perm = await Geolocator.checkPermission();
        if (perm == LocationPermission.denied) {
          perm = await Geolocator.requestPermission();
        }
        if (perm == LocationPermission.always || perm == LocationPermission.whileInUse) {
          final pos = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.medium,
              timeLimit: Duration(seconds: 4),
            ),
          );
          lat = pos.latitude;
          lng = pos.longitude;
        }
      }
    } catch (_) {}

    if (!mounted) return;
    setState(() => _isLoading = false);
    final firstName = _firstNameCtrl.text.trim();
    final lastName = _lastNameCtrl.text.trim();
    final fullName = [firstName, lastName].where((s) => s.isNotEmpty).join(' ');

    context.read<AuthBloc>().add(SignupRequested(
      name: fullName,
      email: _emailCtrl.text.trim(),
      password: pass,
      phone: _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
      branchId: _selectedBranchId,
      latitude: lat,
      longitude: lng,
      verificationToken: _verificationToken,
    ));
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

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: GoogleFonts.poppins(fontSize: 13)),
      backgroundColor: isError ? kRed : kPrimary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
    ));
  }

  void _showAlreadyExistsDialog(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(children: [
          const Icon(Icons.account_circle_rounded, color: kPrimary, size: 24),
          const SizedBox(width: 10),
          Text('Account Exists', style: GoogleFonts.poppins(
            fontSize: 16, fontWeight: FontWeight.bold)),
        ]),
        content: Text(
          message.toLowerCase().contains('login')
              ? message
              : '$message\n\nPlease log in to continue.',
          style: GoogleFonts.poppins(fontSize: 13, color: kTextSub, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: GoogleFonts.poppins(
              color: kTextSub, fontWeight: FontWeight.bold)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: kPrimary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text('Login Now', style: GoogleFonts.poppins(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
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
          SharedPreferences.getInstance()
              .then((p) => p.setBool('has_completed_onboarding', true));
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const AppShell(initialIndex: 3)),
            (route) => false,
          );
        } else if (state is AuthFailure) {
          setState(() => _isLoading = false);
          _showSnack(state.error, isError: true);
        } else if (state is AuthLoading) {
          setState(() => _isLoading = true);
        }
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: Stack(
          children: [
            const _BlobDecorations(),
            SafeArea(
              child: Column(
                children: [
                  // Header row: back + step indicator
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      children: [
                        _BackBtn(onTap: _goBack),
                        const Spacer(),
                        _StepIndicator(current: _step, total: 3),
                        const Spacer(),
                        const SizedBox(width: 42),
                      ],
                    ),
                  ),

                  Expanded(
                    child: FadeTransition(
                      opacity: _fadeAnim,
                      child: SlideTransition(
                        position: _slideAnim,
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.symmetric(horizontal: 28),
                          child: [
                            _buildIdentityStep(),
                            _buildOtpStep(),
                            _buildPasswordStep(),
                          ][_step],
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

  // ─── Step 0 UI: Identity ──────────────────────────────────────────────────
  Widget _buildIdentityStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const SizedBox(height: 12),
        Container(
          width: 80, height: 80,
          decoration: BoxDecoration(
            color: kPrimary.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.delivery_dining_rounded, size: 40, color: kPrimary),
        ),
        const SizedBox(height: 20),

        RichText(
          text: TextSpan(
            style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w800, color: kText),
            children: [
              const TextSpan(text: 'Partner '),
              TextSpan(text: 'Register', style: GoogleFonts.poppins(
                fontSize: 28, fontWeight: FontWeight.w800, color: kPrimary)),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Register to become an F2H delivery partner',
          style: GoogleFonts.poppins(fontSize: 14, color: kTextSub),
        ),
        const SizedBox(height: 10),
        Container(width: 40, height: 3,
          decoration: BoxDecoration(color: kPrimary, borderRadius: BorderRadius.circular(4))),

        const SizedBox(height: 32),

        _UnderlineField(
          controller: _firstNameCtrl,
          focusNode: _firstNameFocus,
          hintText: 'First Name *',
          prefixIcon: Icons.person_outline_rounded,
          keyboardType: TextInputType.name,
          textInputAction: TextInputAction.next,
          onSubmitted: (_) => _lastNameFocus.requestFocus(),
        ),
        const SizedBox(height: 22),
        _UnderlineField(
          controller: _lastNameCtrl,
          focusNode: _lastNameFocus,
          hintText: 'Last Name (Optional)',
          prefixIcon: Icons.person_outline_rounded,
          keyboardType: TextInputType.name,
          textInputAction: TextInputAction.next,
          onSubmitted: (_) => _emailFocus.requestFocus(),
        ),
        const SizedBox(height: 22),
        _UnderlineField(
          controller: _emailCtrl,
          focusNode: _emailFocus,
          hintText: 'Email Address *',
          prefixIcon: Icons.mail_outline_rounded,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          onSubmitted: (_) => _phoneFocus.requestFocus(),
        ),
        const SizedBox(height: 22),
        _UnderlineField(
          controller: _phoneCtrl,
          focusNode: _phoneFocus,
          hintText: 'Phone Number (10 digits) *',
          prefixIcon: Icons.phone_outlined,
          keyboardType: TextInputType.phone,
          textInputAction: TextInputAction.done,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(10),
          ],
          onSubmitted: (_) => _sendEmailOtp(),
        ),

        const SizedBox(height: 36),

        _ActionButton(
          label: 'Send OTP',
          icon: Icons.send_rounded,
          loading: _isLoading,
          onTap: _isLoading ? null : _sendEmailOtp,
        ),

        const SizedBox(height: 28),

        GestureDetector(
          onTap: () => Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => const LoginScreen()),
          ),
          child: RichText(
            text: TextSpan(
              text: 'Already registered? ',
              style: GoogleFonts.poppins(color: kTextSub, fontSize: 14),
              children: [
                TextSpan(
                  text: 'Sign In',
                  style: GoogleFonts.poppins(
                    color: kPrimary, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 48),
      ],
    );
  }

  // ─── Step 1 UI: OTP ───────────────────────────────────────────────────────
  Widget _buildOtpStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const SizedBox(height: 12),
        Container(
          width: 80, height: 80,
          decoration: BoxDecoration(
            color: kPrimary.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.mark_email_read_rounded, size: 40, color: kPrimary),
        ),
        const SizedBox(height: 20),

        RichText(
          text: TextSpan(
            style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w800, color: kText),
            children: [
              const TextSpan(text: 'Verify '),
              TextSpan(text: 'Email', style: GoogleFonts.poppins(
                fontSize: 28, fontWeight: FontWeight.w800, color: kPrimary)),
            ],
          ),
        ),
        const SizedBox(height: 6),
        RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: GoogleFonts.poppins(fontSize: 13, color: kTextSub, height: 1.5),
            children: [
              const TextSpan(text: 'Enter the 6-digit code sent to\n'),
              TextSpan(
                text: _emailCtrl.text.trim(),
                style: GoogleFonts.poppins(
                  fontWeight: FontWeight.w700, color: kText, fontSize: 13),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Container(width: 40, height: 3,
          decoration: BoxDecoration(color: kPrimary, borderRadius: BorderRadius.circular(4))),

        const SizedBox(height: 36),

        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(6, (i) => _OtpBox(
            controller: _otpCtrl[i],
            focusNode: _otpFocus[i],
            onChanged: (v) {
              if (v.length == 1 && i < 5) {
                _otpFocus[i + 1].requestFocus();
              } else if (v.isEmpty && i > 0) {
                _otpFocus[i - 1].requestFocus();
              }
              if (i == 5 && v.length == 1) {
                final full = _otpCtrl.map((c) => c.text).join();
                if (full.length == 6) _verifyEmailOtp();
              }
            },
          )),
        ),

        const SizedBox(height: 16),

        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              _canResend
                  ? 'Didn\'t receive the code? '
                  : 'Resend in ${_countdown}s — ',
              style: GoogleFonts.poppins(color: kMuted, fontSize: 13),
            ),
            if (_canResend)
              GestureDetector(
                onTap: _sendEmailOtp,
                child: Text('Resend', style: GoogleFonts.poppins(
                  color: kPrimary, fontWeight: FontWeight.w700, fontSize: 13)),
              ),
          ],
        ),

        const SizedBox(height: 32),

        _ActionButton(
          label: 'Verify OTP',
          icon: Icons.check_circle_outline_rounded,
          loading: _isLoading,
          onTap: _isLoading ? null : _verifyEmailOtp,
        ),
        const SizedBox(height: 48),
      ],
    );
  }

  // ─── Step 2 UI: Password ──────────────────────────────────────────────────
  Widget _buildPasswordStep() {
    final strength = _passwordStrength(_passwordCtrl.text);
    final strengthColor = strength <= 0.25
        ? kRed
        : strength <= 0.5
            ? kAccent
            : kPrimary;
    final strengthLabel = strength <= 0.25
        ? 'Weak'
        : strength <= 0.5
            ? 'Fair'
            : strength <= 0.75
                ? 'Good'
                : 'Strong';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const SizedBox(height: 12),
        Container(
          width: 80, height: 80,
          decoration: BoxDecoration(
            color: kPrimary.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.shield_outlined, size: 40, color: kPrimary),
        ),
        const SizedBox(height: 20),

        RichText(
          text: TextSpan(
            style: GoogleFonts.poppins(fontSize: 28, fontWeight: FontWeight.w800, color: kText),
            children: [
              const TextSpan(text: 'Set '),
              TextSpan(text: 'Password', style: GoogleFonts.poppins(
                fontSize: 28, fontWeight: FontWeight.w800, color: kPrimary)),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Create a strong password for your account',
          textAlign: TextAlign.center,
          style: GoogleFonts.poppins(fontSize: 14, color: kTextSub),
        ),
        const SizedBox(height: 10),
        Container(width: 40, height: 3,
          decoration: BoxDecoration(color: kPrimary, borderRadius: BorderRadius.circular(4))),

        const SizedBox(height: 36),

        _UnderlineField(
          controller: _passwordCtrl,
          focusNode: _passFocus,
          hintText: 'New Password',
          prefixIcon: Icons.lock_outline_rounded,
          obscureText: _obscurePass,
          textInputAction: TextInputAction.next,
          onSubmitted: (_) => _confirmFocus.requestFocus(),
          suffix: GestureDetector(
            onTap: () => setState(() => _obscurePass = !_obscurePass),
            child: Icon(
              _obscurePass ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              color: kMuted, size: 20,
            ),
          ),
        ),

        if (_passwordCtrl.text.isNotEmpty) ...[
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: strength,
                    backgroundColor: const Color(0xFFE2E8F0),
                    valueColor: AlwaysStoppedAnimation(strengthColor),
                    minHeight: 4,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(strengthLabel, style: GoogleFonts.poppins(
                fontSize: 12, fontWeight: FontWeight.w600, color: strengthColor)),
            ],
          ),
        ],

        const SizedBox(height: 22),

        _UnderlineField(
          controller: _confirmCtrl,
          focusNode: _confirmFocus,
          hintText: 'Confirm Password',
          prefixIcon: Icons.lock_outline_rounded,
          obscureText: _obscureConfirm,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _createAccount(),
          suffix: GestureDetector(
            onTap: () => setState(() => _obscureConfirm = !_obscureConfirm),
            child: Icon(
              _obscureConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              color: kMuted, size: 20,
            ),
          ),
        ),

        const SizedBox(height: 36),

        BlocBuilder<AuthBloc, AuthState>(
          builder: (context, state) {
            final loading = state is AuthLoading || _isLoading;
            return _ActionButton(
              label: 'Complete Registration',
              icon: Icons.check_rounded,
              loading: loading,
              onTap: loading ? null : _createAccount,
            );
          },
        ),
        const SizedBox(height: 48),
      ],
    );
  }
}

// ─── Shared UI Widgets ────────────────────────────────────────────────────────
class _OtpBox extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final void Function(String) onChanged;

  const _OtpBox({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 44,
      height: 52,
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        maxLength: 1,
        textAlign: TextAlign.center,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        onChanged: onChanged,
        style: GoogleFonts.poppins(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: kText,
        ),
        decoration: InputDecoration(
          counterText: '',
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: kPrimary, width: 2),
          ),
          filled: true,
          fillColor: focusNode.hasFocus
              ? kPrimary.withValues(alpha: 0.05)
              : const Color(0xFFF8FAFC),
          contentPadding: EdgeInsets.zero,
        ),
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  final int current;
  final int total;
  const _StepIndicator({required this.current, required this.total});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(total, (i) {
        final active = i == current;
        final done   = i < current;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: active ? 24 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: done ? kPrimary : active ? kPrimary : const Color(0xFFE2E8F0),
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }
}

class _BackBtn extends StatelessWidget {
  final VoidCallback onTap;
  const _BackBtn({required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      width: 42, height: 42,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: const Icon(Icons.arrow_back_rounded, size: 20, color: Color(0xFF0F172A)),
    ),
  );
}

class _BlobDecorations extends StatelessWidget {
  const _BlobDecorations();

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      Positioned(top: -80, left: -80, child: _blob(260, const Color(0xFFDCFCE7), 0.7)),
      Positioned(top: 20, right: 8, child: _dotGrid(5, 4, const Color(0xFF16A34A).withValues(alpha: 0.15))),
      Positioned(bottom: -60, left: -40, child: _blob(220, const Color(0xFFDCFCE7), 0.6)),
      Positioned(bottom: 60, right: 8, child: _dotGrid(4, 3, const Color(0xFF16A34A).withValues(alpha: 0.15))),
    ],
  );

  Widget _blob(double size, Color color, double opacity) => Container(
    width: size, height: size,
    decoration: BoxDecoration(shape: BoxShape.circle, color: color.withValues(alpha: opacity)),
  );

  Widget _dotGrid(int rows, int cols, Color color) => Column(
    children: List.generate(rows, (r) => Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(cols, (c) => Container(
        margin: const EdgeInsets.all(3),
        width: 4, height: 4,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      )),
    )),
  );
}

class _UnderlineField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final String hintText;
  final IconData prefixIcon;
  final bool obscureText;
  final TextInputType keyboardType;
  final TextInputAction textInputAction;
  final void Function(String)? onSubmitted;
  final Widget? suffix;
  final List<TextInputFormatter>? inputFormatters;

  const _UnderlineField({
    required this.controller,
    required this.focusNode,
    required this.hintText,
    required this.prefixIcon,
    this.obscureText = false,
    this.keyboardType = TextInputType.text,
    this.textInputAction = TextInputAction.next,
    this.onSubmitted,
    this.suffix,
    this.inputFormatters,
  });

  @override
  Widget build(BuildContext context) {
    final focused = focusNode.hasFocus;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(
          color: focused ? kPrimary : const Color(0xFFCBD5E1),
          width: focused ? 2 : 1.2,
        )),
      ),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 12, bottom: 8),
            child: Icon(prefixIcon, size: 20, color: focused ? kPrimary : kMuted),
          ),
          Expanded(
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              obscureText: obscureText,
              keyboardType: keyboardType,
              textInputAction: textInputAction,
              inputFormatters: inputFormatters,
              onSubmitted: onSubmitted,
              onChanged: (_) {},
              style: GoogleFonts.poppins(fontSize: 15, color: kText, fontWeight: FontWeight.w500),
              decoration: InputDecoration(
                hintText: hintText,
                hintStyle: GoogleFonts.poppins(color: kMuted, fontSize: 14, fontWeight: FontWeight.w400),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.only(bottom: 8),
              ),
            ),
          ),
          if (suffix != null)
            Padding(padding: const EdgeInsets.only(bottom: 8), child: suffix!),
        ],
      ),
    );
  }
}

class _ActionButton extends StatefulWidget {
  final String label;
  final IconData icon;
  final bool loading;
  final VoidCallback? onTap;
  const _ActionButton({
    required this.label, required this.icon,
    required this.loading, this.onTap,
  });

  @override
  State<_ActionButton> createState() => _ActionButtonState();
}

class _ActionButtonState extends State<_ActionButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTapDown: (_) => setState(() => _pressed = true),
    onTapUp: (_) { setState(() => _pressed = false); widget.onTap?.call(); },
    onTapCancel: () => setState(() => _pressed = false),
    child: AnimatedScale(
      scale: _pressed ? 0.97 : 1.0,
      duration: const Duration(milliseconds: 100),
      child: Container(
        width: double.infinity, height: 58,
        decoration: BoxDecoration(
          gradient: widget.loading
              ? const LinearGradient(colors: [Color(0xFFCBD5E1), Color(0xFFCBD5E1)])
              : const LinearGradient(
                  colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                  begin: Alignment.topLeft, end: Alignment.bottomRight,
                ),
          borderRadius: BorderRadius.circular(30),
          boxShadow: widget.loading ? [] : [
            BoxShadow(color: kPrimary.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 8)),
          ],
        ),
        child: Center(
          child: widget.loading
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(widget.label, style: GoogleFonts.poppins(
                      fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: 0.3,
                    )),
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(widget.icon, color: Colors.white, size: 16),
                    ),
                  ],
                ),
        ),
      ),
    ),
  );
}
