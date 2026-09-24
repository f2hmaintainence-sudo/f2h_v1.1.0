// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : phone_otp_verification_screen.dart
// Description : OTP verification screen for Phone Number login
// ============================================================================

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:shared_preferences/shared_preferences.dart';

import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/widgets/auth_kit.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/features/address/presentation/screens/add_address_screen.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class PhoneOtpVerificationScreen extends StatefulWidget {
  final String phone;
  final bool popOnSuccess;
  final String? referralCode;

  const PhoneOtpVerificationScreen({
    super.key,
    required this.phone,
    this.popOnSuccess = false,
    this.referralCode,
  });

  @override
  State<PhoneOtpVerificationScreen> createState() => _PhoneOtpVerificationScreenState();
}

const int _kResendCooldownSeconds = 60;

class _PhoneOtpVerificationScreenState extends State<PhoneOtpVerificationScreen> {
  final TextEditingController _otpController = TextEditingController();
  bool _isResending = false;

  Timer? _cooldownTimer;
  int _cooldownRemaining = 0;

  @override
  void initState() {
    super.initState();
    _startResendCooldown();
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _otpController.dispose();
    super.dispose();
  }

  void _startResendCooldown() {
    _cooldownTimer?.cancel();
    setState(() => _cooldownRemaining = _kResendCooldownSeconds);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() => _cooldownRemaining--);
      if (_cooldownRemaining <= 0) timer.cancel();
    });
  }

  void _toast(String message, {Color? background}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: background ?? kPrimary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Future<void> _onVerifyPressed() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      _toast('Please enter the 6-digit OTP', background: kRed);
      return;
    }

    FocusScope.of(context).unfocus();

    String? refCode = widget.referralCode;
    if (refCode == null || refCode.trim().isEmpty) {
      try {
        final prefs = await SharedPreferences.getInstance();
        refCode = prefs.getString('pending_referral_code') ?? prefs.getString('referral_code');
      } catch (_) {}
    }

    if (!mounted) return;
    context.read<AuthBloc>().add(
      PhoneOtpLoginRequested(
        phone: widget.phone,
        otp: otp,
        referralCode: refCode,
      ),
    );
  }

  Future<void> _resendOtp() async {
    setState(() => _isResending = true);
    try {
      await sl<AuthRepository>().sendLoginOtp(widget.phone);
      if (!mounted) return;
      _startResendCooldown();
      _toast('New OTP sent to +91 ${widget.phone}');
    } catch (e) {
      if (!mounted) return;
      _toast(extractErrorMessage(e), background: kRed);
    } finally {
      if (mounted) {
        setState(() => _isResending = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is Authenticated) {
          if (state.user.isNewUser || state.user.needsAddress) {
            Navigator.pushAndRemoveUntil(
              context,
              MaterialPageRoute(
                builder: (_) => const AddAddressScreen(isInitialSetup: true),
              ),
              (route) => false,
            );
          } else if (widget.popOnSuccess) {
            Navigator.pop(context, true);
          } else {
            Navigator.pushAndRemoveUntil(
              context,
              MaterialPageRoute(builder: (_) => const CustomerSessionGate()),
              (route) => false,
            );
          }
        } else if (state is AuthFailure) {
          _toast(state.error, background: kRed);
        }
      },
      child: BlocBuilder<AuthBloc, AuthState>(
        builder: (context, state) {
          final loading = state is AuthLoading;

          return AuthScaffold(
            title: 'Verify Phone Number',
            subtitle: 'Enter the 6-digit OTP sent to\n+91 ${widget.phone}',
            showBack: true,
            children: [
              Center(
                child: TextButton.icon(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.edit_outlined, size: 16, color: kPrimaryMid),
                  label: const Text(
                    'Wrong number? Change',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: kPrimaryMid,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              _OtpField(controller: _otpController),
              const SizedBox(height: 24),
              AuthPrimaryButton(
                label: 'Verify & Sign In',
                loading: loading,
                onTap: loading ? null : _onVerifyPressed,
              ),
              const SizedBox(height: 18),
              Opacity(
                opacity: _cooldownRemaining > 0 ? 0.6 : 1,
                child: AuthTextLink(
                  label: _isResending
                      ? 'Sending OTP...'
                      : _cooldownRemaining > 0
                          ? 'Resend OTP in ${_cooldownRemaining}s'
                          : "Didn't receive code? Resend OTP",
                  alignment: Alignment.center,
                  onTap: _isResending || _cooldownRemaining > 0
                      ? () {}
                      : _resendOtp,
                ),
              ),
              const SizedBox(height: 24),
              const AuthDivider(label: 'or'),
              const SizedBox(height: 16),
              Center(
                child: TextButton(
                  onPressed: () {
                    Navigator.pop(context, 'switch_to_password');
                  },
                  child: const Text(
                    'Sign in with Email & Password instead',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: kPrimaryMid,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
          );
        },
      ),
    );
  }
}

class _OtpField extends StatelessWidget {
  final TextEditingController controller;
  const _OtpField({required this.controller});

  OutlineInputBorder _border(Color color) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(14),
    borderSide: BorderSide(color: color, width: 1.4),
  );

  @override
  Widget build(BuildContext context) => TextField(
    controller: controller,
    keyboardType: TextInputType.number,
    textAlign: TextAlign.center,
    inputFormatters: [
      FilteringTextInputFormatter.digitsOnly,
      LengthLimitingTextInputFormatter(6),
    ],
    onTapOutside: (_) => FocusScope.of(context).unfocus(),
    cursorColor: kPrimary,
    style: const TextStyle(
      fontSize: 24,
      fontWeight: FontWeight.w800,
      letterSpacing: 10,
      color: Color(0xFF17211B),
    ),
    decoration: InputDecoration(
      counterText: '',
      filled: true,
      fillColor: kAuthFieldBg,
      hintText: '000000',
      hintStyle: const TextStyle(
        color: kAuthHint,
        fontWeight: FontWeight.w600,
        letterSpacing: 10,
        fontSize: 24,
      ),
      border: _border(kAuthFieldBorder),
      enabledBorder: _border(kAuthFieldBorder),
      focusedBorder: _border(kPrimary),
      errorBorder: _border(kRed),
      focusedErrorBorder: _border(kRed),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
    ),
  );
}
