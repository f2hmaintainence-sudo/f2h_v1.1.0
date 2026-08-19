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

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _otpController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController =
      TextEditingController();

  int _step = 0;
  bool _isLoading = false;
  String? _resetToken;

  @override
  void dispose() {
    _emailController.dispose();
    _otpController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  String get _email => _emailController.text.trim().toLowerCase();

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

  void _showError(String message) => _toast(message, background: kRed);

  Future<void> _sendOtp() async {
    if (_email.isEmpty || !_email.contains('@')) {
      _showError('Please enter a valid email address');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _isLoading = true);
    try {
      await sl<AuthRepository>().requestPasswordResetOtp(_email);
      if (!mounted) return;
      setState(() => _step = 1);
      _toast('Password reset OTP sent to $_email');
    } catch (e) {
      if (!mounted) return;
      _showError(extractErrorMessage(e));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _verifyOtp() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      _showError('Please enter the 6-digit OTP');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _isLoading = true);
    try {
      final token = await sl<AuthRepository>().verifyOtp(
        email: _email,
        otp: otp,
        purpose: 'forgot_password',
      );
      if (!mounted) return;
      setState(() {
        _resetToken = token;
        _step = 2;
      });
    } catch (e) {
      if (!mounted) return;
      _showError(extractErrorMessage(e));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _resetPassword() async {
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;
    final token = _resetToken;

    if (token == null || token.isEmpty) {
      _showError('Please verify the OTP first');
      return;
    }
    if (password.length < 8) {
      _showError('Password must be at least 8 characters long');
      return;
    }
    if (password != confirmPassword) {
      _showError('Passwords do not match');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _isLoading = true);
    try {
      await sl<AuthRepository>().resetPassword(
        email: _email,
        token: token,
        newPassword: password,
      );
      if (!mounted) return;
      _toast('Password reset successfully. Logging in…');

      context.read<AuthBloc>().add(
        LoginRequested(identifier: _email, password: password),
      );
    } catch (e) {
      if (!mounted) return;
      _showError(extractErrorMessage(e));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  String get _title => switch (_step) {
    1 => 'Verify OTP',
    2 => 'Reset Password',
    _ => 'Forgot Password?',
  };

  String get _subtitle => switch (_step) {
    1 => 'Enter the 6-digit OTP sent to $_email.',
    2 => 'Create a new secure password for your account.',
    _ =>
      "No worries! Enter your email and we'll send you a code to reset your password.",
  };

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
          _showError(state.error);
        }
      },
      child: AuthScaffold(
        title: _title,
        subtitle: _subtitle,
        showBack: true,
        children: [
          _StepIndicator(currentStep: _step),
          const SizedBox(height: 24),
          if (_step == 0) ..._emailStep(),
          if (_step == 1) ..._otpStep(),
          if (_step == 2) ..._passwordStep(),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  List<Widget> _emailStep() => [
    AuthField(
      controller: _emailController,
      hint: 'Email Address',
      icon: Icons.mail_outline_rounded,
      keyboardType: TextInputType.emailAddress,
      textInputAction: TextInputAction.done,
      onSubmitted: (_) => _sendOtp(),
    ),
    const SizedBox(height: 20),
    AuthPrimaryButton(
      label: 'Send Reset Code',
      loading: _isLoading,
      onTap: _isLoading ? null : _sendOtp,
    ),
    const SizedBox(height: 22),
    const AuthDivider(label: 'or'),
    const SizedBox(height: 18),
    _OutlinedAuthButton(
      label: 'Back to Login',
      icon: Icons.arrow_back_rounded,
      onTap: () => Navigator.pop(context),
    ),
  ];

  List<Widget> _otpStep() => [
    AuthField(
      controller: _otpController,
      hint: '6-digit OTP',
      icon: Icons.password_outlined,
      keyboardType: TextInputType.number,
      maxLength: 6,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      textInputAction: TextInputAction.done,
      onSubmitted: (_) => _verifyOtp(),
    ),
    const SizedBox(height: 20),
    AuthPrimaryButton(
      label: 'Verify OTP',
      loading: _isLoading,
      onTap: _isLoading ? null : _verifyOtp,
    ),
    const SizedBox(height: 12),
    AuthTextLink(
      label: 'Resend OTP',
      alignment: Alignment.center,
      onTap: _isLoading ? () {} : _sendOtp,
    ),
  ];

  List<Widget> _passwordStep() => [
    AuthField(
      controller: _passwordController,
      hint: 'New Password',
      icon: Icons.lock_outline_rounded,
      isPassword: true,
    ),
    const SizedBox(height: 14),
    AuthField(
      controller: _confirmPasswordController,
      hint: 'Confirm Password',
      icon: Icons.lock_reset_outlined,
      isPassword: true,
      textInputAction: TextInputAction.done,
      onSubmitted: (_) => _resetPassword(),
    ),
    const SizedBox(height: 20),
    AuthPrimaryButton(
      label: 'Reset Password',
      loading: _isLoading,
      onTap: _isLoading ? null : _resetPassword,
    ),
  ];
}

/// Three-segment progress bar for the reset flow.
class _StepIndicator extends StatelessWidget {
  final int currentStep;
  const _StepIndicator({required this.currentStep});

  @override
  Widget build(BuildContext context) => Row(
    children: List.generate(3, (index) {
      final isActive = index <= currentStep;
      return Expanded(
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          height: 4,
          margin: EdgeInsets.only(right: index == 2 ? 0 : 8),
          decoration: BoxDecoration(
            color: isActive ? kPrimary : kAuthFieldBorder,
            borderRadius: BorderRadius.circular(999),
          ),
        ),
      );
    }),
  );
}

/// Secondary outlined action matching [AuthPrimaryButton]'s metrics.
class _OutlinedAuthButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  const _OutlinedAuthButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      height: 56,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: kPrimary.withValues(alpha: 0.4), width: 1.4),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: kPrimaryMid, size: 18),
          const SizedBox(width: 10),
          Text(
            label,
            style: const TextStyle(
              color: kPrimaryMid,
              fontSize: 15.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    ),
  );
}
