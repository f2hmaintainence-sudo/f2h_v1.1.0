// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : login_screen.dart
// Description : Dual-mode customer login supporting modern Phone OTP login
//               alongside classic Email & Password authentication for legacy
//               users whose phone numbers are null in the database.
// ============================================================================

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/screens/forgot_password_screen.dart';
import 'package:f2h_customer/auth/presentation/screens/phone_otp_verification_screen.dart';
import 'package:f2h_customer/auth/presentation/widgets/auth_kit.dart';
import 'package:f2h_customer/core/auth/token_storage.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/features/profile/presentation/screens/privacy_screen.dart';
import 'package:f2h_customer/features/profile/presentation/screens/terms_conditions_screen.dart';
import 'package:f2h_customer/theme/app_colors.dart';

enum LoginMode { phoneOtp, password }

class LoginScreen extends StatefulWidget {
  final bool popOnSuccess;
  final LoginMode initialMode;

  const LoginScreen({
    this.popOnSuccess = false,
    this.initialMode = LoginMode.phoneOtp,
    super.key,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late LoginMode _currentMode;

  // Controllers for Email/Password mode
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  // Controller for Phone OTP mode
  final TextEditingController _phoneController = TextEditingController();
  bool _isSendingOtp = false;
  bool _agreeToTerms = false;

  @override
  void initState() {
    super.initState();
    _currentMode = widget.initialMode;
    _checkAlreadyAuthenticated();
  }

  void _checkAlreadyAuthenticated() async {
    final authState = context.read<AuthBloc>().state;
    if (authState is Authenticated) {
      _redirectToApp();
      return;
    }
    final hasSession = await TokenStorage.hasSession();
    if (hasSession && mounted) {
      context.read<AuthBloc>().add(const AuthCheckRequested());
      _redirectToApp();
    }
  }

  void _redirectToApp() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (widget.popOnSuccess) {
        Navigator.pop(context, true);
      } else {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const AppShell()),
          (route) => false,
        );
      }
    });
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _showError(String message, {VoidCallback? onAction, String? actionLabel}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: kRed,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        action: actionLabel != null && onAction != null
            ? SnackBarAction(
                label: actionLabel,
                textColor: Colors.white,
                onPressed: onAction,
              )
            : null,
      ),
    );
  }

  void _onPasswordLoginPressed() {
    final identifier = _usernameController.text.trim();
    final password = _passwordController.text;

    if (identifier.isEmpty) {
      _showError('Please enter your email or mobile number');
      return;
    }
    if (password.isEmpty) {
      _showError('Please enter your password');
      return;
    }

    FocusScope.of(context).unfocus();
    context.read<AuthBloc>().add(
      LoginRequested(identifier: identifier, password: password),
    );
  }

  Future<void> _onSendPhoneOtpPressed() async {
    final phone = _phoneController.text.trim();

    if (phone.isEmpty) {
      _showError('Please enter your 10-digit mobile number');
      return;
    }
    if (phone.length != 10 || !RegExp(r'^[6-9]\d{9}$').hasMatch(phone)) {
      _showError('Please enter a valid 10-digit Indian mobile number');
      return;
    }
    if (!_agreeToTerms) {
      _showError('Please agree to the Terms & Conditions and Privacy Policy');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _isSendingOtp = true);

    try {
      await sl<AuthRepository>().sendLoginOtp(phone);
      if (!mounted) return;
      setState(() => _isSendingOtp = false);

      final result = await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => PhoneOtpVerificationScreen(
            phone: phone,
            popOnSuccess: widget.popOnSuccess,
          ),
        ),
      );

      if (result == 'switch_to_password' && mounted) {
        setState(() => _currentMode = LoginMode.password);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSendingOtp = false);
      final errorMsg = extractErrorMessage(e, fallback: 'Failed to send OTP. Please try again.');
      
      // If user has no phone in DB, guide them to switch to Password mode
      if (errorMsg.contains('email and password')) {
        _showError(
          errorMsg,
          actionLabel: 'Use Password',
          onAction: () => setState(() => _currentMode = LoginMode.password),
        );
      } else {
        _showError(errorMsg);
      }
    }
  }

  void _onGooglePressed() {
    FocusScope.of(context).unfocus();
    context.read<AuthBloc>().add(const GoogleSignInRequested());
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is Authenticated) {
          if (widget.popOnSuccess) {
            Navigator.pop(context, true);
          } else {
            Navigator.pushAndRemoveUntil(
              context,
              MaterialPageRoute(builder: (_) => const CustomerSessionGate()),
              (route) => false,
            );
          }
        } else if (state is AuthFailure) {
          _showError(state.error);
        }
      },
      child: BlocBuilder<AuthBloc, AuthState>(
        builder: (context, state) {
          if (state is Authenticated) {
            _redirectToApp();
            return const Scaffold(
              backgroundColor: Colors.white,
              body: Center(
                child: CircularProgressIndicator(color: kPrimary),
              ),
            );
          }
          final loading = state is AuthLoading;

          return AuthScaffold(
            title: 'Welcome to F2H Fresh!',
            subtitle: _currentMode == LoginMode.phoneOtp
                ? 'Sign in instantly with your mobile number'
                : 'Sign in to access fresh dairy & daily farm picks',
            children: [
              // Animated Form based on selected mode
              AnimatedCrossFade(
                duration: const Duration(milliseconds: 250),
                crossFadeState: _currentMode == LoginMode.phoneOtp
                    ? CrossFadeState.showFirst
                    : CrossFadeState.showSecond,
                firstChild: _buildPhoneOtpForm(loading),
                secondChild: _buildPasswordForm(loading),
              ),
              const SizedBox(height: 16),
            ],
          );
        },
      ),
    );
  }

  /// Phone + OTP form widgets
  Widget _buildPhoneOtpForm(bool loading) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthField(
          controller: _phoneController,
          hint: '10-digit mobile number',
          icon: Icons.phone_android_rounded,
          prefixText: '+91  ',
          keyboardType: TextInputType.phone,
          inputFormatters: [IndianMobileNumberInputFormatter()],
          textInputAction: TextInputAction.done,
          maxLength: 10,
          onSubmitted: (_) => _onSendPhoneOtpPressed(),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'We will send a 6-digit verification code',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: kAuthSubtitle,
              ),
            ),
            AuthTextLink(
              label: 'Use Password',
              alignment: Alignment.centerRight,
              onTap: () => setState(() => _currentMode = LoginMode.password),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _TermsCheckbox(
          value: _agreeToTerms,
          onChanged: (v) => setState(() => _agreeToTerms = v),
          onOpenTerms: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const TermsConditionsScreen()),
          ),
          onOpenPrivacy: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const PrivacyScreen()),
          ),
        ),
        const SizedBox(height: 20),
        AuthPrimaryButton(
          label: 'Get OTP',
          loading: _isSendingOtp,
          onTap: _isSendingOtp || loading ? null : _onSendPhoneOtpPressed,
        ),
      ],
    );
  }

  /// Classic Email/Phone + Password form widgets
  Widget _buildPasswordForm(bool loading) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthField(
          controller: _usernameController,
          hint: 'Email or Mobile Number',
          icon: Icons.mail_outline_rounded,
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 14),
        AuthField(
          controller: _passwordController,
          hint: 'Password',
          icon: Icons.lock_outline_rounded,
          isPassword: true,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _onPasswordLoginPressed(),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            AuthTextLink(
              label: 'Sign in with OTP instead',
              alignment: Alignment.centerLeft,
              onTap: () => setState(() => _currentMode = LoginMode.phoneOtp),
            ),
            AuthTextLink(
              label: 'Forgot Password?',
              alignment: Alignment.centerRight,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        AuthPrimaryButton(
          label: 'Sign In',
          loading: loading,
          onTap: loading || _isSendingOtp ? null : _onPasswordLoginPressed,
        ),
        const SizedBox(height: 20),
        const AuthDivider(label: 'or continue with'),
        const SizedBox(height: 16),
        GoogleAuthButton(
          onTap: loading || _isSendingOtp ? null : _onGooglePressed,
        ),
      ],
    );
  }
}

class _TermsCheckbox extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  final VoidCallback onOpenTerms;
  final VoidCallback onOpenPrivacy;

  const _TermsCheckbox({
    required this.value,
    required this.onChanged,
    required this.onOpenTerms,
    required this.onOpenPrivacy,
  });

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      SizedBox(
        width: 24,
        height: 24,
        child: Checkbox(
          value: value,
          activeColor: kPrimary,
          checkColor: Colors.white,
          side: const BorderSide(color: kAuthHint, width: 1.6),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(6),
          ),
          onChanged: (v) => onChanged(v ?? false),
        ),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: RichText(
          text: TextSpan(
            text: 'I agree to the ',
            style: const TextStyle(
              color: kAuthSubtitle,
              fontSize: 12.5,
              fontWeight: FontWeight.w500,
            ),
            children: [
              TextSpan(
                text: 'Terms & Conditions',
                style: const TextStyle(
                  color: kPrimaryMid,
                  fontWeight: FontWeight.w800,
                ),
                recognizer: TapGestureRecognizer()..onTap = onOpenTerms,
              ),
              const TextSpan(text: ' and '),
              TextSpan(
                text: 'Privacy Policy',
                style: const TextStyle(
                  color: kPrimaryMid,
                  fontWeight: FontWeight.w800,
                ),
                recognizer: TapGestureRecognizer()..onTap = onOpenPrivacy,
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

