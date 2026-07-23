import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dio/dio.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/di/injection.dart';

class ForgotPasswordSheet extends StatefulWidget {
  const ForgotPasswordSheet({super.key});

  @override
  State<ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends State<ForgotPasswordSheet> {
  int _step = 0; // 0 = Email Input, 1 = OTP Verification, 2 = New Password
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmPasswordCtrl = TextEditingController();
  final List<TextEditingController> _otpCtrl = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocus = List.generate(6, (_) => FocusNode());

  bool _obscurePass = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;

  int _countdown = 60;
  bool _canResend = false;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    for (var c in _otpCtrl) c.dispose();
    for (var f in _otpFocus) f.dispose();
    super.dispose();
  }

  void _startCountdown() {
    setState(() {
      _countdown = 60;
      _canResend = false;
    });
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (!mounted) return false;
      setState(() {
        _countdown--;
        if (_countdown <= 0) _canResend = true;
      });
      return _countdown > 0;
    });
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: GoogleFonts.poppins()),
        backgroundColor: isError ? kRed : kPrimary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Future<void> _sendOtp() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty || !RegExp(r'^[\w.-]+@[\w-]+\.\w+$').hasMatch(email)) {
      _showSnack('Please enter a valid email address', isError: true);
      return;
    }

    setState(() => _isLoading = true);
    try {
      final dioClient = sl<DioClient>();
      await dioClient.fetchCsrfToken();
      
      await dioClient.dio.post(
        ApiEndpoints.sendEmailOtp,
        data: {'email': email},
      );

      setState(() {
        _isLoading = false;
        _step = 1;
      });
      _startCountdown();
      _showSnack('OTP sent to $email ✅');
    } on DioException catch (e) {
      setState(() => _isLoading = false);
      _showSnack(e.response?.data?['message'] ?? 'Failed to send OTP', isError: true);
    }
  }

  Future<void> _verifyOtp() async {
    final otp = _otpCtrl.map((c) => c.text).join();
    if (otp.length < 6) {
      _showSnack('Please enter the complete 6-digit OTP', isError: true);
      return;
    }

    setState(() => _isLoading = true);
    try {
      final dioClient = sl<DioClient>();
      await dioClient.fetchCsrfToken();

      await dioClient.dio.post(
        ApiEndpoints.verifyEmailOtp,
        data: {'email': _emailCtrl.text.trim(), 'otp': otp},
      );

      setState(() {
        _isLoading = false;
        _step = 2;
      });
      _showSnack('OTP Verified successfully! ✅');
    } on DioException catch (e) {
      setState(() => _isLoading = false);
      _showSnack(e.response?.data?['message'] ?? 'Invalid OTP', isError: true);
    }
  }

  Future<void> _resetPassword() async {
    final pass = _passwordCtrl.text;
    final confirm = _confirmPasswordCtrl.text;
    final otp = _otpCtrl.map((c) => c.text).join();

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
    try {
      final dioClient = sl<DioClient>();
      await dioClient.fetchCsrfToken();

      await dioClient.dio.post(
        '/DeliveryPartner/auth/reset-password',
        data: {
          'email': _emailCtrl.text.trim(),
          'token': otp,
          'newPassword': pass,
        },
      );

      setState(() => _isLoading = false);
      _showSnack('Password reset successful! Please login with your new password.');
      if (mounted) Navigator.pop(context);
    } on DioException catch (e) {
      setState(() => _isLoading = false);
      _showSnack(e.response?.data?['message'] ?? 'Failed to reset password', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: const BoxDecoration(
        color: kBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, bottomInset + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: kMuted.withOpacity(0.3),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            _step == 0
                ? 'Forgot Password'
                : _step == 1
                    ? 'Verify OTP'
                    : 'Reset Password',
            style: GoogleFonts.poppins(fontSize: 20, fontWeight: FontWeight.w700, color: kText),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            _step == 0
                ? 'Enter your registered email address to receive an OTP.'
                : _step == 1
                    ? 'Enter the 6-digit OTP sent to ${_emailCtrl.text}'
                    : 'Set a secure new password for your account.',
            style: GoogleFonts.poppins(fontSize: 13, color: kTextSub),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          if (_step == 0) _buildEmailInput(),
          if (_step == 1) _buildOtpInput(),
          if (_step == 2) _buildPasswordInput(),
        ],
      ),
    );
  }

  Widget _buildEmailInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          decoration: BoxDecoration(
            color: kBgDeep,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: kBorder),
          ),
          child: TextField(
            controller: _emailCtrl,
            keyboardType: TextInputType.emailAddress,
            style: GoogleFonts.poppins(color: kText, fontSize: 15, fontWeight: FontWeight.w500),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.alternate_email_rounded, color: kMuted, size: 20),
              hintText: 'Enter email address',
              hintStyle: GoogleFonts.poppins(color: kMuted, fontSize: 14),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            ),
          ),
        ),
        const SizedBox(height: 24),
        SizedBox(
          height: 54,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _sendOtp,
            style: ElevatedButton.styleFrom(
              backgroundColor: kPrimary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              elevation: 0,
            ),
            child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Text('Send OTP', style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }

  Widget _buildOtpInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(6, (index) {
            return Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: kBgDeep,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: kBorder),
              ),
              child: Center(
                child: TextField(
                  controller: _otpCtrl[index],
                  focusNode: _otpFocus[index],
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  maxLength: 1,
                  style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: kPrimary),
                  decoration: const InputDecoration(counterText: "", border: InputBorder.none),
                  onChanged: (val) {
                    if (val.isNotEmpty && index < 5) {
                      _otpFocus[index + 1].requestFocus();
                    } else if (val.isEmpty && index > 0) {
                      _otpFocus[index - 1].requestFocus();
                    }
                  },
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 20),
        Center(
          child: TextButton(
            onPressed: _canResend ? _sendOtp : null,
            child: Text(
              _canResend ? 'Resend OTP' : 'Resend in ${_countdown}s',
              style: GoogleFonts.poppins(
                color: _canResend ? kAccent : kMuted,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),
        SizedBox(
          height: 54,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _verifyOtp,
            style: ElevatedButton.styleFrom(
              backgroundColor: kPrimary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              elevation: 0,
            ),
            child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Text('Verify OTP', style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }

  Widget _buildPasswordInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          decoration: BoxDecoration(color: kBgDeep, borderRadius: BorderRadius.circular(14), border: Border.all(color: kBorder)),
          child: TextField(
            controller: _passwordCtrl,
            obscureText: _obscurePass,
            style: GoogleFonts.poppins(color: kText, fontSize: 15, fontWeight: FontWeight.w500),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.lock_outline_rounded, color: kMuted, size: 20),
              suffixIcon: IconButton(
                icon: Icon(_obscurePass ? Icons.visibility_off_rounded : Icons.visibility_rounded, color: kMuted, size: 20),
                onPressed: () => setState(() => _obscurePass = !_obscurePass),
              ),
              hintText: 'New Password',
              hintStyle: GoogleFonts.poppins(color: kMuted, fontSize: 14),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(color: kBgDeep, borderRadius: BorderRadius.circular(14), border: Border.all(color: kBorder)),
          child: TextField(
            controller: _confirmPasswordCtrl,
            obscureText: _obscureConfirm,
            style: GoogleFonts.poppins(color: kText, fontSize: 15, fontWeight: FontWeight.w500),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.lock_outline_rounded, color: kMuted, size: 20),
              suffixIcon: IconButton(
                icon: Icon(_obscureConfirm ? Icons.visibility_off_rounded : Icons.visibility_rounded, color: kMuted, size: 20),
                onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
              ),
              hintText: 'Confirm Password',
              hintStyle: GoogleFonts.poppins(color: kMuted, fontSize: 14),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            ),
          ),
        ),
        const SizedBox(height: 24),
        SizedBox(
          height: 54,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _resetPassword,
            style: ElevatedButton.styleFrom(
              backgroundColor: kPrimary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              elevation: 0,
            ),
            child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Text('Reset Password', style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }
}
