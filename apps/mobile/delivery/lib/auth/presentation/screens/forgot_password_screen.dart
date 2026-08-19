// ============================================================================
// F2H Fresh — Delivery Partner App
// File        : forgot_password_screen.dart
// Description : Forgot password screen — F2H design pattern.
//               Step 1: Enter email → send OTP
//               Step 2: Enter OTP + new password → reset
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dio/dio.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';

enum _ForgotStep { enterEmail, enterOtp }

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen>
    with SingleTickerProviderStateMixin {
  _ForgotStep _step = _ForgotStep.enterEmail;

  final _emailCtrl   = TextEditingController();
  final _otpCtrl     = TextEditingController();
  final _passCtrl    = TextEditingController();
  final _confirmCtrl = TextEditingController();

  final _emailFocus   = FocusNode();
  final _otpFocus     = FocusNode();
  final _passFocus    = FocusNode();
  final _confirmFocus = FocusNode();

  bool _obscurePass    = true;
  bool _obscureConfirm = true;
  bool _loading        = false;
  String? _resetToken;

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
      duration: const Duration(milliseconds: 700),
    )..forward();
    _fadeAnim  = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOutCubic));

    for (final n in [_emailFocus, _otpFocus, _passFocus, _confirmFocus]) {
      n.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    for (final c in [_emailCtrl, _otpCtrl, _passCtrl, _confirmCtrl]) {
      c.dispose();
    }
    for (final n in [_emailFocus, _otpFocus, _passFocus, _confirmFocus]) {
      n.dispose();
    }
    _fadeCtrl.dispose();
    super.dispose();
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

  Future<void> _sendOtp() async {
    FocusScope.of(context).unfocus();
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) {
      _showSnack('Please enter your email address', isError: true);
      return;
    }
    setState(() => _loading = true);
    try {
      await sl<DioClient>().dio.post(
        ApiEndpoints.forgotPassword,
        data: {'email': email},
      );
      _showSnack('OTP sent to $email');
      setState(() => _step = _ForgotStep.enterOtp);
      _fadeCtrl.forward(from: 0);
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['message'] ??
          e.message ??
          'Failed to send OTP';
      _showSnack(msg.toString(), isError: true);
    } catch (_) {
      _showSnack('Something went wrong. Please try again.', isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resetPassword() async {
    FocusScope.of(context).unfocus();
    final otp     = _otpCtrl.text.trim();
    final pass    = _passCtrl.text;
    final confirm = _confirmCtrl.text;

    if (otp.length < 4) {
      _showSnack('Please enter the OTP sent to your email', isError: true);
      return;
    }
    if (pass.length < 8) {
      _showSnack('Password must be at least 8 characters', isError: true);
      return;
    }
    if (pass != confirm) {
      _showSnack('Passwords do not match', isError: true);
      return;
    }

    setState(() => _loading = true);
    try {
      // Step 1: verify OTP → get reset token
      final verifyResp = await sl<DioClient>().dio.post(
        ApiEndpoints.verifyOtp,
        data: {
          'email': _emailCtrl.text.trim(),
          'otp': otp,
          'purpose': 'forgot_password',
        },
      );
      _resetToken = (verifyResp.data as Map?)?['verification_token']?.toString();

      // Step 2: reset password with token
      await sl<DioClient>().dio.post(
        ApiEndpoints.resetPassword,
        data: {
          'email': _emailCtrl.text.trim(),
          'token': _resetToken,
          'newPassword': pass,
        },
      );

      _showSnack('Password reset successfully! Please sign in.');
      if (mounted) Navigator.pop(context);
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['message'] ??
          e.message ??
          'Failed to reset password';
      _showSnack(msg.toString(), isError: true);
    } catch (_) {
      _showSnack('Something went wrong. Please try again.', isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          const _BlobDecorations(),
          SafeArea(
            child: Column(
              children: [
                // ── Back button row ──────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: [
                      _BackButton(onTap: () {
                        if (_step == _ForgotStep.enterOtp) {
                          setState(() {
                            _step = _ForgotStep.enterEmail;
                            _fadeCtrl.forward(from: 0);
                          });
                        } else {
                          Navigator.pop(context);
                        }
                      }),
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
                        child: _step == _ForgotStep.enterEmail
                            ? _buildEmailStep()
                            : _buildOtpStep(),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmailStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const SizedBox(height: 16),
        // Icon
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: kPrimary.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.lock_reset_rounded, size: 40, color: kPrimary),
        ),
        const SizedBox(height: 24),

        Text(
          'Forgot',
          style: GoogleFonts.poppins(
            fontSize: 30,
            fontWeight: FontWeight.w800,
            color: kText,
          ),
        ),
        Text(
          'Password?',
          style: GoogleFonts.poppins(
            fontSize: 30,
            fontWeight: FontWeight.w800,
            color: kPrimary,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          "No worries! Enter your email and we'll\nsend you a reset OTP.",
          textAlign: TextAlign.center,
          style: GoogleFonts.poppins(fontSize: 14, color: kTextSub, height: 1.5),
        ),
        const SizedBox(height: 10),
        Container(width: 40, height: 3,
          decoration: BoxDecoration(color: kPrimary, borderRadius: BorderRadius.circular(4))),

        const SizedBox(height: 40),

        _UnderlineField(
          controller: _emailCtrl,
          focusNode: _emailFocus,
          hintText: 'Email address',
          prefixIcon: Icons.mail_outline_rounded,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _sendOtp(),
        ),

        const SizedBox(height: 36),

        _ActionButton(
          label: 'Send OTP',
          icon: Icons.send_rounded,
          loading: _loading,
          onTap: _loading ? null : _sendOtp,
        ),

        const SizedBox(height: 32),

        GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.arrow_back_rounded, size: 16, color: kPrimary),
              const SizedBox(width: 6),
              Text(
                'Back to Sign In',
                style: GoogleFonts.poppins(
                  color: kPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 48),
      ],
    );
  }

  Widget _buildOtpStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const SizedBox(height: 16),
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: kPrimary.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.mark_email_read_rounded, size: 40, color: kPrimary),
        ),
        const SizedBox(height: 24),

        Text(
          'Check your',
          style: GoogleFonts.poppins(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: kText,
          ),
        ),
        Text(
          'Email',
          style: GoogleFonts.poppins(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: kPrimary,
          ),
        ),
        const SizedBox(height: 8),
        RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: GoogleFonts.poppins(fontSize: 13, color: kTextSub, height: 1.5),
            children: [
              const TextSpan(text: 'We sent a code to\n'),
              TextSpan(
                text: _emailCtrl.text.trim(),
                style: GoogleFonts.poppins(
                  fontWeight: FontWeight.w700,
                  color: kText,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Container(width: 40, height: 3,
          decoration: BoxDecoration(color: kPrimary, borderRadius: BorderRadius.circular(4))),

        const SizedBox(height: 36),

        _UnderlineField(
          controller: _otpCtrl,
          focusNode: _otpFocus,
          hintText: 'Enter OTP code',
          prefixIcon: Icons.pin_outlined,
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.next,
          onSubmitted: (_) => _passFocus.requestFocus(),
        ),

        const SizedBox(height: 24),

        _UnderlineField(
          controller: _passCtrl,
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

        const SizedBox(height: 24),

        _UnderlineField(
          controller: _confirmCtrl,
          focusNode: _confirmFocus,
          hintText: 'Confirm New Password',
          prefixIcon: Icons.lock_outline_rounded,
          obscureText: _obscureConfirm,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _resetPassword(),
          suffix: GestureDetector(
            onTap: () => setState(() => _obscureConfirm = !_obscureConfirm),
            child: Icon(
              _obscureConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              color: kMuted, size: 20,
            ),
          ),
        ),

        const SizedBox(height: 12),

        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: _loading ? null : _sendOtp,
            child: Text(
              'Resend OTP',
              style: GoogleFonts.poppins(
                color: kPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),

        const SizedBox(height: 20),

        _ActionButton(
          label: 'Reset Password',
          icon: Icons.check_circle_outline_rounded,
          loading: _loading,
          onTap: _loading ? null : _resetPassword,
        ),

        const SizedBox(height: 48),
      ],
    );
  }
}

// ─── Shared widgets (same as login) ──────────────────────────────────────────

class _BackButton extends StatelessWidget {
  final VoidCallback onTap;
  const _BackButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: const Icon(Icons.arrow_back_rounded, size: 20, color: Color(0xFF0F172A)),
      ),
    );
  }
}

class _BlobDecorations extends StatelessWidget {
  const _BlobDecorations();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned(
          top: -80, left: -80,
          child: _blob(260, const Color(0xFFDCFCE7), 0.7),
        ),
        Positioned(
          top: 20, right: 8,
          child: _dotGrid(5, 4, const Color(0xFF16A34A).withValues(alpha: 0.15)),
        ),
        Positioned(
          bottom: -60, left: -40,
          child: _blob(220, const Color(0xFFDCFCE7), 0.6),
        ),
        Positioned(
          bottom: 60, right: 8,
          child: _dotGrid(4, 3, const Color(0xFF16A34A).withValues(alpha: 0.15)),
        ),
      ],
    );
  }

  Widget _blob(double size, Color color, double opacity) => Container(
    width: size, height: size,
    decoration: BoxDecoration(shape: BoxShape.circle,
      color: color.withValues(alpha: opacity)),
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
  });

  @override
  Widget build(BuildContext context) {
    final focused = focusNode.hasFocus;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: focused ? kPrimary : const Color(0xFFCBD5E1),
            width: focused ? 2 : 1.2,
          ),
        ),
      ),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 12, bottom: 8),
            child: Icon(prefixIcon, size: 20,
              color: focused ? kPrimary : kMuted),
          ),
          Expanded(
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              obscureText: obscureText,
              keyboardType: keyboardType,
              textInputAction: textInputAction,
              onSubmitted: onSubmitted,
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
  const _ActionButton({required this.label, required this.icon, required this.loading, this.onTap});

  @override
  State<_ActionButton> createState() => _ActionButtonState();
}

class _ActionButtonState extends State<_ActionButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) { setState(() => _pressed = false); widget.onTap?.call(); },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          width: double.infinity,
          height: 58,
          decoration: BoxDecoration(
            gradient: widget.loading
                ? const LinearGradient(colors: [Color(0xFFCBD5E1), Color(0xFFCBD5E1)])
                : const LinearGradient(
                    colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
            borderRadius: BorderRadius.circular(30),
            boxShadow: widget.loading ? [] : [
              BoxShadow(color: kPrimary.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 8)),
            ],
          ),
          child: Center(
            child: widget.loading
                ? const SizedBox(width: 22, height: 22,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(widget.label, style: GoogleFonts.poppins(
                        fontSize: 16, fontWeight: FontWeight.w700,
                        color: Colors.white, letterSpacing: 0.3,
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
}
