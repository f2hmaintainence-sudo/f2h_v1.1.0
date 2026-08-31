import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dio/dio.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/auth/presentation/widgets/auth_kit.dart';
import 'package:f2h_delivery/core/api/api_error.dart';

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

  bool _isLoading = false;
  String? _verificationToken;
  String? _errorMessage;

  int _countdown = 60;
  bool _canResend = false;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmPasswordCtrl.dispose();
    for (var c in _otpCtrl) {
      c.dispose();
    }
    for (var f in _otpFocus) {
      f.dispose();
    }
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
        content: Text(msg, style: GoogleFonts.roboto()),
        backgroundColor: isError ? kRed : kPrimary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Future<void> _sendOtp() async {
    final identifier = _emailCtrl.text.trim();
    if (identifier.isEmpty) {
      setState(() => _errorMessage = 'Please enter your email address or phone number');
      _showSnack('Please enter your email address or phone number', isError: true);
      return;
    }

    final isEmail = RegExp(r'^[\w.-]+@[\w-]+\.\w+$').hasMatch(identifier);
    final isPhone = RegExp(r'^\+?[0-9]{7,15}$').hasMatch(identifier.replaceAll(RegExp(r'[\s\-\(\)]'), ''));

    if (!isEmail && !isPhone) {
      setState(() => _errorMessage = 'Please enter a valid email address or phone number');
      _showSnack('Please enter a valid email address or phone number', isError: true);
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      await sl<AuthRepository>().requestPasswordResetOtp(identifier);

      if (!mounted) return;
      setState(() {
        _step = 1;
        _errorMessage = null;
      });
      _startCountdown();
      _showSnack('OTP sent to $identifier ✅');
    } on DioException catch (e) {
      final msg = apiErrorMessage(e, '');
      final errorStr = msg.isNotEmpty ? msg : 'User does not exist';
      if (mounted) setState(() => _errorMessage = errorStr);
      _showSnack(errorStr, isError: true);
    } catch (e) {
      const errorStr = 'User does not exist';
      if (mounted) setState(() => _errorMessage = errorStr);
      _showSnack(errorStr, isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
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
      _verificationToken = await sl<AuthRepository>().verifyPasswordResetOtp(
        identifier: _emailCtrl.text.trim(),
        otp: otp,
      );

      if (!mounted) return;
      setState(() {
        _step = 2;
      });
      _showSnack('OTP Verified successfully! ✅');
    } on DioException catch (e) {
      final msg = apiErrorMessage(e, '');
      _showSnack(msg.isNotEmpty ? msg : 'Invalid OTP', isError: true);
    } catch (e) {
      _showSnack('Failed to verify OTP: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _resetPassword() async {
    final pass = _passwordCtrl.text;
    final confirm = _confirmPasswordCtrl.text;
    final otp = _otpCtrl.map((c) => c.text).join();
    final identifier = _emailCtrl.text.trim();

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
      await sl<AuthRepository>().resetPassword(
        identifier: identifier,
        // The OTP is the fallback only if the verify step somehow returned no
        // token; the API accepts either as proof.
        token: _verificationToken ?? otp,
        newPassword: pass,
      );

      _showSnack('Password reset successful! Please login with your new password.');
      if (mounted) Navigator.pop(context);
    } on DioException catch (e) {
      final msg = apiErrorMessage(e, '');
      _showSnack(msg.isNotEmpty ? msg : 'Failed to reset password', isError: true);
    } catch (e) {
      _showSnack('Failed to reset password: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.fromLTRB(24, 16, 24, bottomInset + 28),
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
                color: kMuted.withValues(alpha: 0.3),
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
            style: GoogleFonts.roboto(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: kAuthInk,
              letterSpacing: -0.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            _step == 0
                ? 'Enter your registered email address or phone number to receive an OTP.'
                : _step == 1
                    ? 'Enter the 6-digit OTP sent to ${_emailCtrl.text}'
                    : 'Set a secure new password for your account.',
            style: GoogleFonts.roboto(fontSize: 13.5, color: kAuthSubtitle, height: 1.4),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Center(
            child: Container(
              width: 56,
              height: 3.5,
              decoration: BoxDecoration(
                color: kPrimaryMid,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
          const SizedBox(height: 26),
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
        DeliveryAuthField(
          controller: _emailCtrl,
          hint: 'Enter email or phone number',
          icon: Icons.alternate_email_rounded,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          onChanged: (_) {
            if (_errorMessage != null) setState(() => _errorMessage = null);
          },
          onSubmitted: (_) => _sendOtp(),
        ),
        if (_errorMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: kRed.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: kRed.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline_rounded, color: kRed, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _errorMessage!,
                    style: GoogleFonts.roboto(color: kRed, fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 24),
        DeliveryPrimaryButton(
          label: 'Send OTP',
          loading: _isLoading,
          onTap: _isLoading ? null : _sendOtp,
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
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: kAuthLine, width: 1.4),
              ),
              child: Center(
                child: TextField(
                  controller: _otpCtrl[index],
                  focusNode: _otpFocus[index],
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  maxLength: 1,
                  style: GoogleFonts.roboto(fontSize: 18, fontWeight: FontWeight.w700, color: kPrimary),
                  decoration: const InputDecoration(
                    counterText: '',
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    errorBorder: InputBorder.none,
                    focusedErrorBorder: InputBorder.none,
                  ),
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
              style: GoogleFonts.roboto(
                color: _canResend ? kAccent : kMuted,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),
        DeliveryPrimaryButton(
          label: 'Verify OTP',
          loading: _isLoading,
          onTap: _isLoading ? null : _verifyOtp,
        ),
      ],
    );
  }

  Widget _buildPasswordInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DeliveryAuthField(
          controller: _passwordCtrl,
          hint: 'New Password',
          icon: Icons.lock_outline_rounded,
          isPassword: true,
        ),
        const SizedBox(height: 22),
        DeliveryAuthField(
          controller: _confirmPasswordCtrl,
          hint: 'Confirm Password',
          icon: Icons.lock_outline_rounded,
          isPassword: true,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _resetPassword(),
        ),
        const SizedBox(height: 24),
        DeliveryPrimaryButton(
          label: 'Reset Password',
          loading: _isLoading,
          onTap: _isLoading ? null : _resetPassword,
        ),
      ],
    );
  }
}
