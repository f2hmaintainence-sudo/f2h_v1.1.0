import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:f2h_delivery/app.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_delivery/auth/presentation/screens/signup_screen.dart';
import 'package:f2h_delivery/auth/presentation/widgets/auth_kit.dart';
import 'package:f2h_delivery/auth/presentation/widgets/forgot_password_sheet.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();

  @override
  void dispose() {
    _identifierCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  void _toast(String message, Color background) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: GoogleFonts.poppins()),
        backgroundColor: background,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _onLogin() {
    if (_identifierCtrl.text.trim().isEmpty || _passwordCtrl.text.isEmpty) {
      _toast('Please fill in all fields', kPrimary);
      return;
    }
    FocusScope.of(context).unfocus();
    context.read<AuthBloc>().add(
      LoginRequested(
        identifier: _identifierCtrl.text.trim(),
        password: _passwordCtrl.text,
      ),
    );
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
            subtitle: 'Sign in to manage your deliveries',
            children: [
              DeliveryAuthField(
                controller: _identifierCtrl,
                hint: 'Email or Phone',
                icon: Icons.mail_outline_rounded,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 26),
              DeliveryAuthField(
                controller: _passwordCtrl,
                hint: 'Password',
                icon: Icons.lock_outline_rounded,
                isPassword: true,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _onLogin(),
              ),
              const SizedBox(height: 10),
              DeliveryTextLink(
                label: 'Forgot Password?',
                onTap: () => showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => const ForgotPasswordSheet(),
                ),
              ),
              const SizedBox(height: 24),
              DeliveryPrimaryButton(
                label: 'Sign In',
                loading: loading,
                onTap: loading ? null : _onLogin,
              ),
              const SizedBox(height: 28),
              const DeliveryAuthDivider(),
              const SizedBox(height: 22),
              DeliveryGoogleButton(onTap: loading ? null : _onGoogle),
              const SizedBox(height: 34),
              DeliveryAuthFooter(
                question: "Don't have an account?",
                action: 'Sign Up',
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SignupScreen()),
                ),
              ),
              const SizedBox(height: 16),
            ],
          );
        },
      ),
    );
  }
}
