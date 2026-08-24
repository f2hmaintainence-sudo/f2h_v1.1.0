import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/auth/presentation/screens/otp_screen.dart';
import 'package:f2h_customer/auth/presentation/widgets/auth_kit.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/features/profile/presentation/screens/privacy_screen.dart';
import 'package:f2h_customer/features/profile/presentation/screens/terms_conditions_screen.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController =
      TextEditingController();
  final TextEditingController _referralCodeController = TextEditingController();

  bool _agreeToTerms = false;
  bool _isSendingOtp = false;

  // Referral auto-check state
  bool? _isReferralValid;
  String? _referralMessage;
  bool _isCheckingReferral = false;
  Timer? _referralDebounce;

  @override
  void initState() {
    super.initState();
    _referralCodeController.addListener(_onReferralChanged);
    _passwordController.addListener(_onPasswordChanged);
    _confirmPasswordController.addListener(_onPasswordChanged);
  }

  @override
  void dispose() {
    _referralDebounce?.cancel();
    _referralCodeController.removeListener(_onReferralChanged);
    _passwordController.removeListener(_onPasswordChanged);
    _confirmPasswordController.removeListener(_onPasswordChanged);
    _usernameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _referralCodeController.dispose();
    super.dispose();
  }

  void _onPasswordChanged() {
    if (mounted) setState(() {});
  }

  void _onReferralChanged() {
    _referralDebounce?.cancel();
    final code = _referralCodeController.text.trim();
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
              ? (data['referrer_name'] != null &&
                        data['referrer_name'].toString().isNotEmpty
                    ? 'Valid referral code! (From ${data['referrer_name']})'
                    : 'Referral code is valid!')
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

  Future<void> _onSignupPressed() async {
    final userName = _usernameController.text.trim();
    final phone = _phoneController.text.trim();
    final email = _emailController.text.trim().toLowerCase();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (userName.isEmpty ||
        phone.isEmpty ||
        email.isEmpty ||
        password.isEmpty ||
        confirmPassword.isEmpty) {
      _toast('Please fill all fields');
      return;
    }

    if (!RegExp(r'^\d{10}$').hasMatch(phone)) {
      _toast('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!email.contains('@')) {
      _toast('Please enter a valid email address');
      return;
    }

    if (password != confirmPassword) {
      _toast('Passwords do not match');
      return;
    }

    final referral = _referralCodeController.text.trim();
    if (referral.isNotEmpty && _isReferralValid == false) {
      _toast('Invalid referral code. Please correct or remove it.');
      return;
    }

    if (!_agreeToTerms) {
      _toast('Please agree to the Terms & Conditions and Privacy Policy');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _isSendingOtp = true);
    try {
      await sl<AuthRepository>().sendRegistrationOtp(email, userName: userName);
      if (!mounted) return;
      _toast('OTP sent to $email');
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => OtpScreen(
            userName: userName,
            email: email,
            phone: phone,
            password: password,
            referralCode: referral,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      _toast(extractErrorMessage(e), background: kRed);
    } finally {
      if (mounted) {
        setState(() => _isSendingOtp = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final passText = _passwordController.text;
    final confirmText = _confirmPasswordController.text;
    final hasConfirmText = confirmText.isNotEmpty;
    final isPassMatching = hasConfirmText
        ? (passText.isNotEmpty && passText == confirmText)
        : null;

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
          final googleLoading = state is AuthLoading;
          return AuthScaffold(
            title: 'Create your F2H account',
            subtitle: 'Sign up to get fresh dairy delivered daily',
            showBack: true,
            heroAction: AuthSkipButton(
              onTap: () => Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(builder: (_) => const AppShell()),
                (route) => false,
              ),
            ),
            children: [
              AuthField(
                controller: _usernameController,
                hint: 'Full Name',
                icon: Icons.person_outline_rounded,
                keyboardType: TextInputType.name,
              ),
              const SizedBox(height: 14),
              AuthField(
                controller: _phoneController,
                hint: '10-digit Mobile Number',
                icon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              ),
              const SizedBox(height: 14),
              AuthField(
                controller: _emailController,
                hint: 'Email Address',
                icon: Icons.mail_outline_rounded,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 14),
              AuthField(
                controller: _passwordController,
                hint: 'Password',
                icon: Icons.lock_outline_rounded,
                isPassword: true,
              ),
              const SizedBox(height: 14),
              AuthField(
                controller: _confirmPasswordController,
                hint: 'Confirm Password',
                icon: Icons.lock_outline_rounded,
                isPassword: true,
              ),
              if (hasConfirmText && isPassMatching != null)
                _FieldHint(
                  message: isPassMatching
                      ? 'Passwords match'
                      : 'Passwords do not match',
                  isPositive: isPassMatching,
                ),
              const SizedBox(height: 14),
              AuthField(
                controller: _referralCodeController,
                hint: 'Referral Code (Optional)',
                icon: Icons.card_giftcard_rounded,
                textInputAction: TextInputAction.done,
                trailing: _isCheckingReferral
                    ? const Padding(
                        padding: EdgeInsets.all(16),
                        child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: kAuthHint,
                          ),
                        ),
                      )
                    : _isReferralValid == true
                    ? const Icon(Icons.check_circle_rounded, color: kPrimary)
                    : _isReferralValid == false
                    ? const Icon(Icons.cancel_rounded, color: kRed)
                    : null,
              ),
              if (_referralMessage != null)
                _FieldHint(
                  message: _referralMessage!,
                  isPositive: _isReferralValid == true,
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
                label: 'Sign Up',
                loading: _isSendingOtp,
                onTap: _isSendingOtp ? null : _onSignupPressed,
              ),
              const SizedBox(height: 22),
              const AuthDivider(),
              const SizedBox(height: 18),
              GoogleAuthButton(
                onTap: googleLoading || _isSendingOtp
                    ? null
                    : () => context.read<AuthBloc>().add(
                        const GoogleSignInRequested(),
                      ),
              ),
              const SizedBox(height: 26),
              AuthFooterPrompt(
                question: 'Already have an account?',
                action: 'Sign In',
                onTap: () => Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
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

/// Inline validation note shown under a field.
class _FieldHint extends StatelessWidget {
  final String message;
  final bool isPositive;
  const _FieldHint({required this.message, required this.isPositive});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(left: 6, top: 6),
    child: Row(
      children: [
        Icon(
          isPositive ? Icons.check_circle_rounded : Icons.error_outline_rounded,
          size: 14,
          color: isPositive ? kPrimary : kRed,
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            message,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: isPositive ? kPrimaryMid : kRed,
            ),
          ),
        ),
      ],
    ),
  );
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
