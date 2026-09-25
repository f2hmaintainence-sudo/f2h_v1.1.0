// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Delivery
// File        : phone_otp_verification_screen.dart
// Description : OTP verification screen for Delivery Partner Phone Number login
// ============================================================================

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:f2h_delivery/app.dart';
import 'package:f2h_delivery/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_delivery/auth/presentation/widgets/auth_kit.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

const int _kResendCooldownSeconds = 60;

class PhoneOtpVerificationScreen extends StatefulWidget {
  final String phone;
  final String? referralCode;

  const PhoneOtpVerificationScreen({
    super.key,
    required this.phone,
    this.referralCode,
  });

  @override
  State<PhoneOtpVerificationScreen> createState() => _PhoneOtpVerificationScreenState();
}

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
        content: Text(message, style: GoogleFonts.roboto()),
        backgroundColor: background ?? kPrimary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Future<void> _onVerifyPressed() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      _toast('Please enter the 6-digit verification code', background: kRed);
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
    if (_cooldownRemaining > 0 || _isResending) return;
    setState(() => _isResending = true);
    try {
      await sl<AuthRepository>().sendLoginOtp(widget.phone);
      if (!mounted) return;
      _startResendCooldown();
      _toast('New verification code sent to +91 ${widget.phone}');
    } catch (e) {
      if (!mounted) return;
      _toast(e.toString(), background: kRed);
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
          context.read<DeliverySessionBloc>().add(LoadSessionEvent());
          SharedPreferences.getInstance().then((prefs) {
            prefs.setBool('has_completed_onboarding', true);
          });
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const AppShell()),
            (route) => false,
          );
        } else if (state is AuthFailure) {
          _toast(state.error, background: kRed);
        }
      },
      child: BlocBuilder<AuthBloc, AuthState>(
        builder: (context, state) {
          final loading = state is AuthLoading;

          return DeliveryAuthScaffold(
            title: 'Verify',
            titleAccent: 'Phone',
            subtitle: 'Enter the 6-digit code sent to +91 ${widget.phone}',
            showBack: true,
            children: [
              DeliveryAuthField(
                controller: _otpController,
                hint: '6-digit OTP',
                icon: Icons.mark_email_read_outlined,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textInputAction: TextInputAction.done,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(6),
                ],
                onSubmitted: (_) => _onVerifyPressed(),
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _cooldownRemaining > 0
                        ? 'Resend OTP in ${_cooldownRemaining}s'
                        : "Didn't receive the code?",
                    style: GoogleFonts.roboto(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500,
                      color: kAuthSubtitle,
                    ),
                  ),
                  if (_cooldownRemaining <= 0)
                    InkWell(
                      onTap: _isResending ? null : _resendOtp,
                      child: Text(
                        _isResending ? 'Sending…' : 'Resend Code',
                        style: GoogleFonts.roboto(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: kPrimary,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 30),
              DeliveryPrimaryButton(
                label: 'Verify & Sign In',
                loading: loading,
                onTap: loading ? null : _onVerifyPressed,
              ),
              const SizedBox(height: 18),
              Center(
                child: InkWell(
                  onTap: () => Navigator.pop(context),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                    child: Text(
                      'Change Mobile Number',
                      style: GoogleFonts.roboto(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: kAuthSubtitle,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
