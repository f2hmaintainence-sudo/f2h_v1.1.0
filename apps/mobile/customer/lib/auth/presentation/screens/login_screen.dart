import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/screens/forgot_password_screen.dart';
import 'package:f2h_customer/auth/presentation/screens/signup_screen.dart';
import 'package:f2h_customer/auth/presentation/widgets/auth_kit.dart';
import 'package:f2h_customer/theme/app_colors.dart';

class LoginScreen extends StatefulWidget {
  final bool popOnSuccess;
  const LoginScreen({this.popOnSuccess = false, super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: kRed,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _onLoginPressed() {
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

  void _onGooglePressed() {
    FocusScope.of(context).unfocus();
    context.read<AuthBloc>().add(const GoogleSignInRequested());
  }

  void _onSkip() {
    if (widget.popOnSuccess) {
      Navigator.pop(context, false);
    } else {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const AppShell()),
        (route) => false,
      );
    }
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
          final loading = state is AuthLoading;
          return AuthScaffold(
            title: 'Welcome to F2H Fresh!',
            subtitle: 'Login to access fresh dairy & more!',
            heroAction: AuthSkipButton(onTap: _onSkip),
            children: [
              AuthField(
                controller: _usernameController,
                hint: 'Email or Phone',
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
                onSubmitted: (_) => _onLoginPressed(),
              ),
              const SizedBox(height: 8),
              AuthTextLink(
                label: 'Forgot Password?',
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()),
                ),
              ),
              const SizedBox(height: 20),
              AuthPrimaryButton(
                label: 'Sign In',
                loading: loading,
                onTap: loading ? null : _onLoginPressed,
              ),
              const SizedBox(height: 22),
              const AuthDivider(),
              const SizedBox(height: 18),
              GoogleAuthButton(onTap: loading ? null : _onGooglePressed),
              const SizedBox(height: 26),
              AuthFooterPrompt(
                question: "Don't have an account?",
                action: 'Sign Up',
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SignupScreen()),
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
