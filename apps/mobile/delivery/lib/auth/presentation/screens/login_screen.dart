// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Delivery
// File        : login_screen.dart
// Description : Delivery partner login supporting Phone OTP login
//               alongside Google authentication.
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:f2h_delivery/app.dart';
import 'package:f2h_delivery/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_delivery/auth/presentation/screens/phone_otp_verification_screen.dart';
import 'package:f2h_delivery/auth/presentation/widgets/auth_kit.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/core/utils/version_checker.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneCtrl = TextEditingController();
  bool _isSendingOtp = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        VersionChecker.checkUpdates(context);
      }
    });
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  void _toast(String message, Color background) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: GoogleFonts.roboto()),
        backgroundColor: background,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Future<void> _onSendPhoneOtp() async {
    final phone = _phoneCtrl.text.trim();

    if (phone.isEmpty) {
      _toast('Please enter your 10-digit mobile number', kPrimary);
      return;
    }
    if (phone.length != 10 || !RegExp(r'^[6-9]\d{9}$').hasMatch(phone)) {
      _toast('Please enter a valid 10-digit Indian mobile number', kRed);
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _isSendingOtp = true);

    try {
      await sl<AuthRepository>().sendLoginOtp(phone);
      if (!mounted) return;
      setState(() => _isSendingOtp = false);

      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => PhoneOtpVerificationScreen(phone: phone),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSendingOtp = false);
      _toast(e.toString(), kRed);
    }
  }

  void _onGoogle() {
    FocusScope.of(context).unfocus();
    context.read<AuthBloc>().add(GoogleSignInRequested());
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
          _toast(state.error, kRed);
        }
      },
      child: BlocBuilder<AuthBloc, AuthState>(
        builder: (context, state) {
          final loading = state is AuthLoading;

          return DeliveryAuthScaffold(
            title: 'Welcome',
            titleAccent: 'Back',
            subtitle: 'Sign in instantly with your mobile number',
            children: [
              _buildPhoneOtpForm(loading),
              const SizedBox(height: 28),
              const DeliveryAuthDivider(),
              const SizedBox(height: 22),
              DeliveryGoogleButton(onTap: loading || _isSendingOtp ? null : _onGoogle),
              const SizedBox(height: 24),
            ],
          );
        },
      ),
    );
  }

  Widget _buildPhoneOtpForm(bool loading) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        DeliveryAuthField(
          controller: _phoneCtrl,
          hint: '10-digit mobile number',
          icon: Icons.phone_android_rounded,
          prefixText: '+91  ',
          keyboardType: TextInputType.phone,
          maxLength: 10,
          inputFormatters: [IndianMobileNumberInputFormatter()],
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _onSendPhoneOtp(),
        ),
        const SizedBox(height: 12),
        Text(
          'We will send a 6-digit verification code',
          style: GoogleFonts.roboto(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: kAuthSubtitle,
          ),
        ),
        const SizedBox(height: 24),
        DeliveryPrimaryButton(
          label: 'Get OTP',
          loading: _isSendingOtp,
          onTap: _isSendingOtp || loading ? null : _onSendPhoneOtp,
        ),
      ],
    );
  }
}
