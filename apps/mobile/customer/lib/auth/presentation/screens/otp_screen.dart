import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/widgets/auth_kit.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class OtpScreen extends StatefulWidget {
  final String userName;
  final String email;
  final String phone;
  final String password;
  final String? referralCode;

  const OtpScreen({
    super.key,
    required this.userName,
    required this.email,
    required this.phone,
    required this.password,
    this.referralCode,
  });

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final TextEditingController _otpController = TextEditingController();
  bool _isVerifying = false;
  bool _isResending = false;

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  void _toast(String message, {Color? background}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: background,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Future<void> _verifyAndRegister() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      _toast('Please enter the 6-digit OTP');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _isVerifying = true);
    try {
      final token = await sl<AuthRepository>().verifyOtp(
        email: widget.email,
        otp: otp,
        purpose: 'registration',
      );
      if (!mounted) return;
      context.read<AuthBloc>().add(
        SignupRequested(
          user_name: widget.userName,
          email: widget.email,
          phone: widget.phone,
          password: widget.password,
          verificationToken: token,
          referralCode: widget.referralCode,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      _toast(extractErrorMessage(e), background: kRed);
    } finally {
      if (mounted) {
        setState(() => _isVerifying = false);
      }
    }
  }

  Future<void> _resendOtp() async {
    setState(() => _isResending = true);
    try {
      await sl<AuthRepository>().sendRegistrationOtp(
        widget.email,
        userName: widget.userName,
      );
      if (!mounted) return;
      _toast('New OTP sent to ${widget.email}');
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
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const CustomerSessionGate()),
            (route) => false,
          );
        } else if (state is AuthFailure) {
          _toast(state.error, background: kRed);
        }
      },
      child: BlocBuilder<AuthBloc, AuthState>(
        builder: (context, state) {
          final isLoading = _isVerifying || state is AuthLoading;
          return AuthScaffold(
            title: 'Verify your email',
            subtitle:
                "We've sent a 6-digit code to ${widget.email}. Enter it below to finish creating your account.",
            showBack: true,
            children: [
              _OtpField(controller: _otpController),
              const SizedBox(height: 20),
              AuthPrimaryButton(
                label: 'Verify & Create Account',
                loading: isLoading,
                onTap: isLoading ? null : _verifyAndRegister,
                icon: Icons.verified_rounded,
              ),
              const SizedBox(height: 18),
              Center(
                child: AuthTextLink(
                  label: _isResending
                      ? 'Sending…'
                      : "Didn't receive it? Resend OTP",
                  alignment: Alignment.center,
                  onTap: _isResending ? () {} : _resendOtp,
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

/// Wide, centred, letter-spaced OTP entry.
class _OtpField extends StatelessWidget {
  final TextEditingController controller;
  const _OtpField({required this.controller});

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: kAuthFieldBg,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: kAuthFieldBorder, width: 1.2),
    ),
    child: TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      textAlign: TextAlign.center,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(6),
      ],
      onTapOutside: (_) => FocusScope.of(context).unfocus(),
      style: const TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w800,
        letterSpacing: 10,
        color: Color(0xFF17211B),
      ),
      decoration: const InputDecoration(
        hintText: '000000',
        hintStyle: TextStyle(
          color: kAuthHint,
          fontWeight: FontWeight.w600,
          letterSpacing: 10,
          fontSize: 22,
        ),
        border: InputBorder.none,
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      ),
    ),
  );
}
