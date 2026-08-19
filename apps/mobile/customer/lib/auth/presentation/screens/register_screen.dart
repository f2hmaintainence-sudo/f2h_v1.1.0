// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh — Customer Mobile Application
// File        : register_screen.dart
// Description : Premium Customer Register Screen matching F2H brand pattern.
//               Features pale green gradient header, F2H logo badge, wave card,
//               referral validation, terms agreement checkbox & OTP transition.
// ============================================================================

import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/app_input_field.dart';
import 'package:f2h_customer/core/widgets/custom_button.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/auth/presentation/screens/otp_screen.dart';
import 'package:f2h_customer/features/profile/presentation/screens/privacy_screen.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> with SingleTickerProviderStateMixin {
  final TextEditingController _firstNameCtrl = TextEditingController();
  final TextEditingController _lastNameCtrl  = TextEditingController();
  final TextEditingController _phoneCtrl     = TextEditingController();
  final TextEditingController _emailCtrl     = TextEditingController();
  final TextEditingController _passCtrl      = TextEditingController();
  final TextEditingController _confirmCtrl   = TextEditingController();
  final TextEditingController _referralCtrl  = TextEditingController();

  final FocusNode _firstNameFocus = FocusNode();
  final FocusNode _lastNameFocus  = FocusNode();
  final FocusNode _phoneFocus     = FocusNode();
  final FocusNode _emailFocus     = FocusNode();
  final FocusNode _passFocus      = FocusNode();
  final FocusNode _confirmFocus   = FocusNode();
  final FocusNode _referralFocus  = FocusNode();

  bool _obscurePass    = true;
  bool _obscureConfirm = true;
  bool _agreeToTerms   = false;
  bool _isSendingOtp   = false;

  // Referral state
  bool? _isReferralValid;
  String? _referralMessage;
  bool _isCheckingReferral = false;
  Timer? _referralDebounce;

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

    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOutCubic));

    _referralCtrl.addListener(_onReferralChanged);
    _passCtrl.addListener(() => setState(() {}));
    _confirmCtrl.addListener(() => setState(() {}));

    for (final n in [_firstNameFocus, _lastNameFocus, _phoneFocus, _emailFocus, _passFocus, _confirmFocus, _referralFocus]) {
      n.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    _referralDebounce?.cancel();
    _referralCtrl.removeListener(_onReferralChanged);
    for (final c in [_firstNameCtrl, _lastNameCtrl, _phoneCtrl, _emailCtrl, _passCtrl, _confirmCtrl, _referralCtrl]) {
      c.dispose();
    }
    for (final n in [_firstNameFocus, _lastNameFocus, _phoneFocus, _emailFocus, _passFocus, _confirmFocus, _referralFocus]) {
      n.dispose();
    }
    _fadeCtrl.dispose();
    super.dispose();
  }

  void _onReferralChanged() {
    _referralDebounce?.cancel();
    final code = _referralCtrl.text.trim();
    if (code.isEmpty) {
      setState(() {
        _isReferralValid = null;
        _referralMessage = null;
        _isCheckingReferral = false;
      });
      return;
    }
    if (code.length < 3) return;
    setState(() => _isCheckingReferral = true);
    _referralDebounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        final dio = sl<DioClient>().dio;
        final resp = await dio.get('${ApiEndpoints.validateReferralCode}/$code');
        if (!mounted) return;
        final data = resp.data;
        final isValid = data['valid'] == true;
        setState(() {
          _isReferralValid = isValid;
          _referralMessage = isValid
              ? (data['referrer_name'] != null && data['referrer_name'].toString().isNotEmpty
                  ? 'Valid referral from ${data['referrer_name']}'
                  : 'Referral code valid!')
              : (data['message']?.toString() ?? 'Invalid referral code');
          _isCheckingReferral = false;
        });
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _isReferralValid = false;
          _referralMessage = 'Invalid referral code';
          _isCheckingReferral = false;
        });
      }
    });
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (isError) {
      F2HToast.error(context, msg);
    } else {
      F2HToast.success(context, msg);
    }
  }

  Future<void> _onRegisterPressed() async {
    FocusScope.of(context).unfocus();
    final firstName = _firstNameCtrl.text.trim();
    final lastName  = _lastNameCtrl.text.trim();
    final name      = [firstName, lastName].where((s) => s.isNotEmpty).join(' ');
    final phone     = _phoneCtrl.text.trim();
    final email     = _emailCtrl.text.trim().toLowerCase();
    final pass      = _passCtrl.text;
    final confirm   = _confirmCtrl.text;

    if (firstName.isEmpty || phone.isEmpty || email.isEmpty || pass.isEmpty || confirm.isEmpty) {
      _showSnack('Please fill in all required fields', isError: true);
      return;
    }
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(phone)) {
      _showSnack('Please enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9)', isError: true);
      return;
    }
    if (!email.contains('@')) {
      _showSnack('Please enter a valid email address', isError: true);
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
    final referral = _referralCtrl.text.trim();
    if (referral.isNotEmpty && _isReferralValid == false) {
      _showSnack('Invalid referral code. Please correct or clear it.', isError: true);
      return;
    }
    if (!_agreeToTerms) {
      _showSnack('Please agree to Terms & Conditions and Privacy Policy', isError: true);
      return;
    }

    setState(() => _isSendingOtp = true);
    try {
      await sl<AuthRepository>().sendRegistrationOtp(email, userName: name);
      if (!mounted) return;
      _showSnack('OTP sent to $email ✅');
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => OtpScreen(
            userName: name,
            email: email,
            phone: phone,
            password: pass,
            referralCode: referral,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      _showSnack(extractErrorMessage(e), isError: true);
    } finally {
      if (mounted) setState(() => _isSendingOtp = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SingleChildScrollView(
        child: SizedBox(
          height: math.max(size.height, 900),
          child: Stack(
            children: [
              // ── Top Soft Green Header ─────────────────────────────────────
              Container(
                height: size.height * 0.32,
                width: double.infinity,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Color(0xFFF0FDF4),
                      Color(0xFFDCFCE7),
                      Color(0xFFE8F5E9),
                    ],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
                child: Stack(
                  children: [
                    // Ambient Glowing Blobs
                    Positioned(
                      top: -60,
                      left: -60,
                      child: Container(
                        width: 220,
                        height: 220,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: kPrimaryLt.withValues(alpha: 0.2),
                        ),
                      ),
                    ),
                    Positioned(
                      top: 30,
                      right: -40,
                      child: Container(
                        width: 180,
                        height: 180,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: kPrimary.withValues(alpha: 0.12),
                        ),
                      ),
                    ),

                    // Decorative Leaf Shapes
                    Positioned(
                      top: 110,
                      left: 14,
                      child: _LeafDecoration(width: 22, height: 40, angle: -0.5),
                    ),
                    Positioned(
                      top: 58,
                      right: 44,
                      child: _LeafDecoration(width: 18, height: 30, angle: 0.4),
                    ),
                    Positioned(
                      top: 178,
                      right: 8,
                      child: _LeafDecoration(width: 36, height: 60, angle: 1.0),
                    ),

                    // Back Button
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: GestureDetector(
                          onTap: () => Navigator.pop(context),
                          child: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.04),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Icon(Icons.arrow_back_rounded, size: 20, color: kText),
                          ),
                        ),
                      ),
                    ),

                    // Center Branding Badge & Logo
                    Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(height: 20),
                          Container(
                            width: 80,
                            height: 80,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0xFFDCFCE7), width: 3),
                              boxShadow: [
                                BoxShadow(
                                  color: kPrimary.withValues(alpha: 0.15),
                                  blurRadius: 20,
                                  offset: const Offset(0, 6),
                                ),
                              ],
                            ),
                            child: Center(
                              child: ClipOval(
                                child: Image.asset(
                                  'assets/icon/app_logo.png',
                                  width: 54,
                                  height: 54,
                                  fit: BoxFit.contain,
                                  errorBuilder: (_, _, _) => const Icon(
                                    Icons.eco_rounded,
                                    size: 40,
                                    color: kPrimary,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            'F2H',
                            style: GoogleFonts.poppins(
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF14532D),
                              letterSpacing: 1.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(width: 14, height: 1.2, color: kPrimary),
                              const SizedBox(width: 6),
                              Text(
                                'FARM TO HOME',
                                style: GoogleFonts.poppins(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  color: kPrimary,
                                  letterSpacing: 2.5,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(width: 14, height: 1.2, color: kPrimary),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // ── Bottom Curved White Card ──────────────────────────────────
              Positioned(
                top: size.height * 0.27,
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(32),
                      topRight: Radius.circular(32),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x0F000000),
                        blurRadius: 20,
                        offset: Offset(0, -6),
                      ),
                    ],
                  ),
                  padding: const EdgeInsets.fromLTRB(28, 28, 28, 20),
                  child: FadeTransition(
                    opacity: _fadeAnim,
                    child: SlideTransition(
                      position: _slideAnim,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Text(
                            'Register Account',
                            style: GoogleFonts.poppins(
                              fontSize: 24,
                              fontWeight: FontWeight.w800,
                              color: kText,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Join F2H Fresh for daily farm delivery',
                            style: GoogleFonts.poppins(fontSize: 13, color: kTextSub),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            width: 36,
                            height: 3,
                            decoration: BoxDecoration(color: kPrimary, borderRadius: BorderRadius.circular(4)),
                          ),

                          const SizedBox(height: 24),

                          AppInputField(
                            controller: _firstNameCtrl,
                            focusNode: _firstNameFocus,
                            hintText: 'First Name *',
                            prefixIcon: Icons.person_outline_rounded,
                            textInputAction: TextInputAction.next,
                            onSubmitted: (_) => _lastNameFocus.requestFocus(),
                          ),
                          const SizedBox(height: 14),

                          AppInputField(
                            controller: _lastNameCtrl,
                            focusNode: _lastNameFocus,
                            hintText: 'Last Name (Optional)',
                            prefixIcon: Icons.person_outline_rounded,
                            textInputAction: TextInputAction.next,
                            onSubmitted: (_) => _phoneFocus.requestFocus(),
                          ),
                          const SizedBox(height: 12),

                          AppInputField(
                            controller: _phoneCtrl,
                            focusNode: _phoneFocus,
                            hintText: 'Mobile Number (10 digits)',
                            prefixIcon: Icons.phone_outlined,
                            keyboardType: TextInputType.phone,
                            textInputAction: TextInputAction.next,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(10),
                            ],
                            onSubmitted: (_) => _emailFocus.requestFocus(),
                          ),
                          const SizedBox(height: 12),

                          AppInputField(
                            controller: _emailCtrl,
                            focusNode: _emailFocus,
                            hintText: 'Email Address',
                            prefixIcon: Icons.mail_outline_rounded,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            onSubmitted: (_) => _passFocus.requestFocus(),
                          ),
                          const SizedBox(height: 12),

                          AppInputField(
                            controller: _passCtrl,
                            focusNode: _passFocus,
                            hintText: 'Password (min 8 chars)',
                            prefixIcon: Icons.lock_outline_rounded,
                            obscureText: _obscurePass,
                            textInputAction: TextInputAction.next,
                            onSubmitted: (_) => _confirmFocus.requestFocus(),
                            suffixIcon: GestureDetector(
                              onTap: () => setState(() => _obscurePass = !_obscurePass),
                              child: Icon(
                                _obscurePass ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                color: kMuted, size: 20,
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),

                          AppInputField(
                            controller: _confirmCtrl,
                            focusNode: _confirmFocus,
                            hintText: 'Confirm Password',
                            prefixIcon: Icons.lock_outline_rounded,
                            obscureText: _obscureConfirm,
                            textInputAction: TextInputAction.next,
                            onSubmitted: (_) => _referralFocus.requestFocus(),
                            suffixIcon: GestureDetector(
                              onTap: () => setState(() => _obscureConfirm = !_obscureConfirm),
                              child: Icon(
                                _obscureConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                color: kMuted, size: 20,
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),

                          AppInputField(
                            controller: _referralCtrl,
                            focusNode: _referralFocus,
                            hintText: 'Referral Code (Optional)',
                            prefixIcon: Icons.card_giftcard_rounded,
                            textInputAction: TextInputAction.done,
                            suffixIcon: _isCheckingReferral
                                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary))
                                : _isReferralValid == true
                                    ? const Icon(Icons.check_circle_rounded, color: kPrimary, size: 20)
                                    : _isReferralValid == false
                                        ? const Icon(Icons.error_outline_rounded, color: kRed, size: 20)
                                        : null,
                          ),
                          if (_referralMessage != null) ...[
                            const SizedBox(height: 4),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                _referralMessage!,
                                style: GoogleFonts.poppins(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  color: _isReferralValid == true ? kPrimary : kRed,
                                ),
                              ),
                            ),
                          ],

                          const SizedBox(height: 14),

                          Row(
                            children: [
                              SizedBox(
                                width: 22,
                                height: 22,
                                child: Checkbox(
                                  value: _agreeToTerms,
                                  activeColor: kPrimary,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
                                  onChanged: (v) => setState(() => _agreeToTerms = v ?? false),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: RichText(
                                  text: TextSpan(
                                    text: 'I agree to the ',
                                    style: GoogleFonts.poppins(fontSize: 12, color: kTextSub),
                                    children: [
                                      TextSpan(
                                        text: 'Terms & Conditions',
                                        style: GoogleFonts.poppins(
                                          fontWeight: FontWeight.w600, color: kPrimary),
                                        recognizer: TapGestureRecognizer()
                                          ..onTap = () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PrivacyScreen())),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 20),

                          AppPrimaryButton(
                            label: 'Send OTP',
                            loading: _isSendingOtp,
                            onTap: _isSendingOtp ? null : _onRegisterPressed,
                          ),

                          const SizedBox(height: 20),

                          GestureDetector(
                            onTap: () => Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(builder: (_) => const LoginScreen()),
                            ),
                            child: RichText(
                              text: TextSpan(
                                text: 'Already have an account? ',
                                style: GoogleFonts.poppins(fontSize: 14, color: kTextSub),
                                children: [
                                  TextSpan(
                                    text: 'Sign In',
                                    style: GoogleFonts.poppins(
                                      fontSize: 14, fontWeight: FontWeight.w700, color: kPrimary),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Realistic Leaf Decoration Widgets ────────────────────────────────────────

class _LeafDecoration extends StatelessWidget {
  final double width;
  final double height;
  final double angle;

  const _LeafDecoration({
    required this.width,
    required this.height,
    this.angle = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: angle,
      child: CustomPaint(
        size: Size(width, height),
        painter: _LeafPainter(),
      ),
    );
  }
}

class _LeafPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final fillPaint = Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xFF3A7A34), Color(0xFF5CB85C)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ).createShader(Rect.fromLTWH(0, 0, 100, 100))
      ..style = PaintingStyle.fill;

    final path = Path();
    path.moveTo(w * 0.5, 0);
    path.cubicTo(w * 0.92, h * 0.08, w * 0.98, h * 0.48, w * 0.5, h * 0.88);
    path.lineTo(w * 0.5, h);
    path.cubicTo(w * 0.02, h * 0.48, w * 0.08, h * 0.08, w * 0.5, 0);
    canvas.drawPath(path, fillPaint);

    final ribPaint = Paint()
      ..color = const Color(0xFF2D6128)
      ..strokeWidth = w * 0.05
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(w * 0.5, h * 0.06), Offset(w * 0.5, h * 0.88), ribPaint);

    final veinPaint = Paint()
      ..color = const Color(0xFF2D6128)
      ..strokeWidth = w * 0.025
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(w * 0.5, h * 0.28), Offset(w * 0.15, h * 0.46), veinPaint);
    canvas.drawLine(Offset(w * 0.5, h * 0.46), Offset(w * 0.1, h * 0.62), veinPaint);
    canvas.drawLine(Offset(w * 0.5, h * 0.28), Offset(w * 0.85, h * 0.46), veinPaint);
    canvas.drawLine(Offset(w * 0.5, h * 0.46), Offset(w * 0.9, h * 0.62), veinPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
