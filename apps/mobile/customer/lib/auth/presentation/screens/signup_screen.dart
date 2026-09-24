import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
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
import 'package:f2h_customer/core/auth/token_storage.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/features/profile/presentation/screens/privacy_screen.dart';
import 'package:f2h_customer/features/profile/presentation/screens/terms_conditions_screen.dart';
import 'package:f2h_customer/features/address/presentation/screens/add_address_screen.dart';
import 'package:f2h_customer/auth/domain/entities/user_entity.dart';
import 'package:f2h_customer/theme/app_colors.dart';

import 'package:shared_preferences/shared_preferences.dart';

class SignupScreen extends StatefulWidget {
  final String? initialReferralCode;

  const SignupScreen({super.key, this.initialReferralCode});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();

  bool _agreeToTerms = true;
  bool _isSendingOtp = false;

  // Automated link-only referral state (no manual entry)
  String? _autoReferralCode;
  bool? _isReferralValid;
  String? _referralMessage;
  bool _isCheckingReferral = false;

  @override
  void initState() {
    super.initState();
    _checkAlreadyAuthenticated();
    _checkPendingReferralCode();
  }

  Future<void> _checkPendingReferralCode() async {
    try {
      String? code;
      if (widget.initialReferralCode != null && widget.initialReferralCode!.trim().isNotEmpty) {
        code = widget.initialReferralCode!.trim().toUpperCase();
      } else {
        final uri = Uri.base;
        code = uri.queryParameters['ref'] ?? uri.queryParameters['referral'] ?? uri.queryParameters['code'];
        if (code == null || code.isEmpty) {
          final segments = uri.pathSegments;
          final rIdx = segments.indexOf('r');
          if (rIdx != -1 && rIdx + 1 < segments.length) {
            code = segments[rIdx + 1];
          }
        }
        if (code == null || code.isEmpty) {
          final prefs = await SharedPreferences.getInstance();
          code = prefs.getString('pending_referral_code') ?? prefs.getString('referral_code');
        }
      }

      if (code != null && code.trim().isNotEmpty) {
        await _validateDetectedReferral(code.trim().toUpperCase());
      }
    } catch (_) {}
  }

  Future<void> _validateDetectedReferral(String code) async {
    if (!mounted) return;
    setState(() {
      _autoReferralCode = code;
      _isCheckingReferral = true;
      _isReferralValid = null;
      _referralMessage = null;
    });

    try {
      final dio = sl<DioClient>().dio;
      final resp = await dio.get('${ApiEndpoints.validateReferralCode}/$code');
      if (!mounted) return;
      final data = resp.data;
      final isValid = data['valid'] == true;
      setState(() {
        _isReferralValid = isValid;
        _isCheckingReferral = false;
        if (isValid) {
          final refName = data['referrer_name']?.toString();
          _referralMessage = (refName != null && refName.isNotEmpty)
              ? 'Referral invite applied from $refName'
              : 'Referral invite applied ($code)';
        } else {
          _autoReferralCode = null;
          _referralMessage = null;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isCheckingReferral = false;
        _isReferralValid = false;
        _autoReferralCode = null;
        _referralMessage = null;
      });
    }
  }

  void _checkAlreadyAuthenticated() async {
    final authState = context.read<AuthBloc>().state;
    if (authState is Authenticated) {
      _redirectToApp(authState.user);
      return;
    }
    final hasSession = await TokenStorage.hasSession();
    if (hasSession && mounted) {
      context.read<AuthBloc>().add(const AuthCheckRequested());
      _redirectToApp();
    }
  }

  void _redirectToApp([User? user]) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (user != null && (user.isNewUser || user.needsAddress)) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(
            builder: (_) => const AddAddressScreen(isInitialSetup: true),
          ),
          (route) => false,
        );
      } else {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const CustomerSessionGate()),
          (route) => false,
        );
      }
    });
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  String _getNameFromEmail(String email) {
    if (!email.contains('@')) return 'Customer';
    final raw = email.split('@').first.trim();
    if (raw.isEmpty) return 'Customer';
    final formatted = raw.replaceAll(RegExp(r'[._-]+'), ' ').trim();
    if (formatted.isEmpty) return 'Customer';
    return formatted.split(' ').map((w) {
      if (w.isEmpty) return '';
      return w[0].toUpperCase() + (w.length > 1 ? w.substring(1) : '');
    }).join(' ');
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
    final phone = _phoneController.text.trim();
    final email = _emailController.text.trim().toLowerCase();

    if (phone.isEmpty || email.isEmpty) {
      _toast('Please enter your mobile number and email');
      return;
    }

    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(phone)) {
      _toast('Please enter a valid 10-digit mobile number starting with 6-9');
      return;
    }
    if (RegExp(r'^([6-9])\1{9}$').hasMatch(phone)) {
      _toast('Please enter a valid mobile number (repeated digits not allowed)');
      return;
    }

    if (!email.contains('@')) {
      _toast('Please enter a valid email address');
      return;
    }

    if (!_agreeToTerms) {
      _toast('Please agree to the Terms & Conditions and Privacy Policy');
      return;
    }

    final userName = _getNameFromEmail(email);

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
            referralCode: (_autoReferralCode != null && _isReferralValid == true)
                ? _autoReferralCode
                : null,
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
          if (state is Authenticated) {
            _redirectToApp(state.user);
            return const Scaffold(
              backgroundColor: Colors.white,
              body: Center(
                child: CircularProgressIndicator(color: kPrimary),
              ),
            );
          }
          final googleLoading = state is AuthLoading;
          return AuthScaffold(
            title: 'Create your F2H account',
            subtitle: 'Sign up to get fresh dairy delivered daily',
            showBack: true,
            children: [
              AuthField(
                controller: _phoneController,
                hint: '10-digit Mobile Number',
                icon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                prefixText: '+91 ',
                inputFormatters: [
                  IndianMobileNumberInputFormatter(),
                ],
              ),
              const SizedBox(height: 14),
              AuthField(
                controller: _emailController,
                hint: 'Email Address',
                icon: Icons.mail_outline_rounded,
                keyboardType: TextInputType.emailAddress,
              ),
              if (_isCheckingReferral) ...[
                Container(
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: const [
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary),
                      ),
                      SizedBox(width: 10),
                      Text(
                        'Verifying referral link...',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w500,
                          color: kAuthSubtitle,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ] else if (_autoReferralCode != null && _isReferralValid == true) ...[
                Container(
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF86EFAC), width: 1.2),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(
                          color: Color(0xFFDCFCE7),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.card_giftcard_rounded,
                          size: 16,
                          color: Color(0xFF16A34A),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Referral Invite Applied ($_autoReferralCode)',
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF166534),
                              ),
                            ),
                            if (_referralMessage != null) ...[
                              const SizedBox(height: 2),
                              Text(
                                _referralMessage!,
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w500,
                                  color: Color(0xFF15803D),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.check_circle_rounded,
                        size: 18,
                        color: Color(0xFF16A34A),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],
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

