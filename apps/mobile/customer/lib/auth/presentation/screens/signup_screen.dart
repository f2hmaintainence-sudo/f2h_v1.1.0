import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/auth/presentation/screens/otp_screen.dart';
import 'package:f2h_customer/features/profile/presentation/screens/privacy_screen.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';

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

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _agreeToTerms = false;
  bool _isSendingOtp = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Please fill all fields')));
      return;
    }

    // if (phone.length != 10) {
    //   ScaffoldMessenger.of(context).showSnackBar(
    //     const SnackBar(content: Text('Please enter a valid 10-digit mobile number')),
    //   );
    //   return;
    // }

    if (!RegExp(r'^\d{10}$').hasMatch(phone)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid 10-digit mobile number'),
        ),
      );
      return;
    }

    if (!email.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid email address')),
      );
      return;
    }

    if (password != confirmPassword) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Passwords do not match')));
      return;
    }

    if (!_agreeToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Please agree to the Terms & Conditions and Privacy Policy',
          ),
        ),
      );
      return;
    }

    setState(() => _isSendingOtp = true);
    try {
      await sl<AuthRepository>().sendRegistrationOtp(email, userName: userName);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('OTP sent to $email')));
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => OtpScreen(
            userName: userName,
            email: email,
            phone: phone,
            password: password,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: kRed),
      );
    } finally {
      if (mounted) {
        setState(() => _isSendingOtp = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final isKeyboardOpen = MediaQuery.of(context).viewInsets.bottom > 0;

    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is Authenticated) {
          Navigator.pushAndRemoveUntil(
            context,
            MaterialPageRoute(builder: (_) => const CustomerSessionGate()),
            (route) => false,
          );
        } else if (state is AuthFailure) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.error), backgroundColor: kRed),
          );
        }
      },
      child: Scaffold(
        body: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [
                kPrimaryMid, // Dark Green
                kPrimary, // Mid Green
              ],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: Stack(
            children: [
              // Ambient Glowing Blobs
              Positioned(
                top: size.height * 0.25,
                left: -70,
                child: Container(
                  width: 200,
                  height: 200,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        kAccent.withOpacity(0.35),
                        kAccent.withOpacity(0.0),
                      ],
                      stops: const [0.3, 1.0],
                    ),
                  ),
                ),
              ),
              Positioned(
                top: size.height * 0.38,
                right: -80,
                child: Container(
                  width: 250,
                  height: 250,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        kPrimaryLt.withOpacity(0.4),
                        kPrimaryLt.withOpacity(0.0),
                      ],
                      stops: const [0.3, 1.0],
                    ),
                  ),
                ),
              ),
              SafeArea(
                bottom: false,
                child: SingleChildScrollView(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight:
                          size.height -
                          MediaQuery.of(context).padding.top -
                          MediaQuery.of(context).viewInsets.bottom,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          children: [
                            const SizedBox(height: 12),
                            // Skip Button
                            Align(
                              alignment: Alignment.topRight,
                              child: Padding(
                                padding: const EdgeInsets.only(right: 24.0),
                                child: TextButton.icon(
                                  onPressed: () {
                                    Navigator.pushAndRemoveUntil(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => const AppShell(),
                                      ),
                                      (route) => false,
                                    );
                                  },
                                  icon: const Icon(
                                    Icons.arrow_forward_outlined,
                                    color: Colors.white,
                                    size: 14,
                                  ),
                                  label: const Text(
                                    'Skip',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                  style: TextButton.styleFrom(
                                    backgroundColor: Colors.white.withValues(
                                      alpha: 0.15,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 8,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            if (!isKeyboardOpen) ...[
                              const SizedBox(height: 16),
                              // App Logo splat (Glassmorphic)
                              Container(
                                width: 72,
                                height: 72,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: LinearGradient(
                                    colors: [
                                      Colors.white.withOpacity(0.25),
                                      Colors.white.withOpacity(0.05),
                                    ],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  border: Border.all(
                                    color: Colors.white.withOpacity(0.4),
                                    width: 1.5,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.08),
                                      blurRadius: 15,
                                      offset: const Offset(0, 8),
                                    ),
                                  ],
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(36),
                                  child: BackdropFilter(
                                    filter: ImageFilter.blur(
                                      sigmaX: 5,
                                      sigmaY: 5,
                                    ),
                                    child: Center(
                                      child: Container(
                                        width: 52,
                                        height: 52,
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          shape: BoxShape.circle,
                                          boxShadow: [
                                            BoxShadow(
                                              color: kPrimary.withOpacity(0.2),
                                              blurRadius: 10,
                                              offset: const Offset(0, 4),
                                            ),
                                          ],
                                        ),
                                        child: Center(
                                          child: Image.asset(
                                            'assets/icon/app_icon.png',
                                            width: 32,
                                            height: 32,
                                            errorBuilder:
                                                (context, error, stackTrace) =>
                                                    const Icon(
                                                      Icons.agriculture_rounded,
                                                      color: kPrimary,
                                                      size: 24,
                                                    ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 6),
                              const Text(
                                'F2H',
                                style: TextStyle(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                  letterSpacing: 1.5,
                                  shadows: [
                                    Shadow(
                                      color: Colors.black12,
                                      offset: Offset(0, 2),
                                      blurRadius: 4,
                                    ),
                                  ],
                                ),
                              ),
                              const Text(
                                'FARM TO HOME',
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white70,
                                  letterSpacing: 3.0,
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],
                          ],
                        ),

                        // Wavy Top Container (Glassmorphic)
                        ClipPath(
                          clipper: WavyTopClipper(),
                          child: BackdropFilter(
                            filter: ImageFilter.blur(
                              sigmaX: 18.0,
                              sigmaY: 18.0,
                            ),
                            child: Container(
                              width: double.infinity,
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.70),
                              ),
                              child: Stack(
                                children: [
                                  Positioned.fill(
                                    child: CustomPaint(
                                      painter: WavyBorderPainter(),
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.fromLTRB(
                                      20,
                                      48,
                                      20,
                                      16,
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const Center(
                                          child: Text(
                                            'Create Account',
                                            style: TextStyle(
                                              fontSize: 18,
                                              fontWeight: FontWeight.w900,
                                              color: Color(0xFF1A1A1A),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        const Center(
                                          child: Text(
                                            'Sign up to get started',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Color(0xFF7E8F84),
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 18),

                                        // Full Name Input
                                        Container(
                                          decoration: BoxDecoration(
                                            color: kPrimaryPl.withOpacity(0.55),
                                            borderRadius: BorderRadius.circular(
                                              30,
                                            ),
                                            border: Border.all(
                                              color: kBorder.withOpacity(0.35),
                                              width: 1.2,
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: Colors.black.withOpacity(
                                                  0.015,
                                                ),
                                                blurRadius: 8,
                                                offset: const Offset(0, 2),
                                              ),
                                            ],
                                          ),
                                          child: TextField(
                                            controller: _usernameController,
                                            keyboardType: TextInputType.name,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.bold,
                                              color: Color(0xFF1A1A1A),
                                            ),
                                            enableInteractiveSelection: true,
                                            onTapOutside: (event) =>
                                                FocusScope.of(
                                                  context,
                                                ).unfocus(),
                                            decoration: const InputDecoration(
                                              prefixIcon: Icon(
                                                Icons.person_outline_rounded,
                                                color: Color(0xFF94A3B8),
                                              ),
                                              hintText: 'Full Name',
                                              hintStyle: TextStyle(
                                                color: Color(0xFF94A3B8),
                                                fontWeight: FontWeight.w500,
                                              ),
                                              border: InputBorder.none,
                                              contentPadding:
                                                  EdgeInsets.symmetric(
                                                    horizontal: 16,
                                                    vertical: 12,
                                                  ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 12),

                                        // Mobile Number Input
                                        Container(
                                          decoration: BoxDecoration(
                                            color: kPrimaryPl.withOpacity(0.55),
                                            borderRadius: BorderRadius.circular(
                                              30,
                                            ),
                                            border: Border.all(
                                              color: kBorder.withOpacity(0.35),
                                              width: 1.2,
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: Colors.black.withOpacity(
                                                  0.015,
                                                ),
                                                blurRadius: 8,
                                                offset: const Offset(0, 2),
                                              ),
                                            ],
                                          ),
                                          child: TextField(
                                            controller: _phoneController,
                                            keyboardType: TextInputType.phone,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.bold,
                                              color: Color(0xFF1A1A1A),
                                            ),
                                            enableInteractiveSelection: true,
                                            onTapOutside: (event) =>
                                                FocusScope.of(
                                                  context,
                                                ).unfocus(),
                                            decoration: const InputDecoration(
                                              prefixIcon: Icon(
                                                Icons.phone_outlined,
                                                color: Color(0xFF94A3B8),
                                              ),
                                              hintText: 'Mobile Number',
                                              hintStyle: TextStyle(
                                                color: Color(0xFF94A3B8),
                                                fontWeight: FontWeight.w500,
                                              ),
                                              border: InputBorder.none,
                                              contentPadding:
                                                  EdgeInsets.symmetric(
                                                    horizontal: 16,
                                                    vertical: 12,
                                                  ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 12),

                                        // Email Address Input
                                        Container(
                                          decoration: BoxDecoration(
                                            color: kPrimaryPl.withOpacity(0.55),
                                            borderRadius: BorderRadius.circular(
                                              30,
                                            ),
                                            border: Border.all(
                                              color: kBorder.withOpacity(0.35),
                                              width: 1.2,
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: Colors.black.withOpacity(
                                                  0.015,
                                                ),
                                                blurRadius: 8,
                                                offset: const Offset(0, 2),
                                              ),
                                            ],
                                          ),
                                          child: TextField(
                                            controller: _emailController,
                                            keyboardType:
                                                TextInputType.emailAddress,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.bold,
                                              color: Color(0xFF1A1A1A),
                                            ),
                                            enableInteractiveSelection: true,
                                            onTapOutside: (event) =>
                                                FocusScope.of(
                                                  context,
                                                ).unfocus(),
                                            decoration: const InputDecoration(
                                              prefixIcon: Icon(
                                                Icons.mail_outline_rounded,
                                                color: Color(0xFF94A3B8),
                                              ),
                                              hintText: 'Email Address',
                                              hintStyle: TextStyle(
                                                color: Color(0xFF94A3B8),
                                                fontWeight: FontWeight.w500,
                                              ),
                                              border: InputBorder.none,
                                              contentPadding:
                                                  EdgeInsets.symmetric(
                                                    horizontal: 16,
                                                    vertical: 12,
                                                  ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 12),

                                        // Password Input
                                        Container(
                                          decoration: BoxDecoration(
                                            color: kPrimaryPl.withOpacity(0.55),
                                            borderRadius: BorderRadius.circular(
                                              30,
                                            ),
                                            border: Border.all(
                                              color: kBorder.withOpacity(0.35),
                                              width: 1.2,
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: Colors.black.withOpacity(
                                                  0.015,
                                                ),
                                                blurRadius: 8,
                                                offset: const Offset(0, 2),
                                              ),
                                            ],
                                          ),
                                          child: TextField(
                                            controller: _passwordController,
                                            obscureText: _obscurePassword,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.bold,
                                              color: Color(0xFF1A1A1A),
                                            ),
                                            enableInteractiveSelection: true,
                                            onTapOutside: (event) =>
                                                FocusScope.of(
                                                  context,
                                                ).unfocus(),
                                            decoration: InputDecoration(
                                              prefixIcon: const Icon(
                                                Icons.lock_outline_rounded,
                                                color: Color(0xFF94A3B8),
                                              ),
                                              hintText: 'Password',
                                              hintStyle: const TextStyle(
                                                color: Color(0xFF94A3B8),
                                                fontWeight: FontWeight.w500,
                                              ),
                                              border: InputBorder.none,
                                              contentPadding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 16,
                                                    vertical: 12,
                                                  ),
                                              suffixIcon: IconButton(
                                                icon: Icon(
                                                  _obscurePassword
                                                      ? Icons
                                                            .visibility_off_outlined
                                                      : Icons
                                                            .visibility_outlined,
                                                  color: const Color(
                                                    0xFF94A3B8,
                                                  ),
                                                  size: 20,
                                                ),
                                                onPressed: () {
                                                  setState(() {
                                                    _obscurePassword =
                                                        !_obscurePassword;
                                                  });
                                                },
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 12),

                                        // Confirm Password Input
                                        Container(
                                          decoration: BoxDecoration(
                                            color: kPrimaryPl.withOpacity(0.55),
                                            borderRadius: BorderRadius.circular(
                                              30,
                                            ),
                                            border: Border.all(
                                              color: kBorder.withOpacity(0.35),
                                              width: 1.2,
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: Colors.black.withOpacity(
                                                  0.015,
                                                ),
                                                blurRadius: 8,
                                                offset: const Offset(0, 2),
                                              ),
                                            ],
                                          ),
                                          child: TextField(
                                            controller:
                                                _confirmPasswordController,
                                            obscureText:
                                                _obscureConfirmPassword,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.bold,
                                              color: Color(0xFF1A1A1A),
                                            ),
                                            enableInteractiveSelection: true,
                                            onTapOutside: (event) =>
                                                FocusScope.of(
                                                  context,
                                                ).unfocus(),
                                            decoration: InputDecoration(
                                              prefixIcon: const Icon(
                                                Icons.lock_outline_rounded,
                                                color: Color(0xFF94A3B8),
                                              ),
                                              hintText: 'Confirm Password',
                                              hintStyle: const TextStyle(
                                                color: Color(0xFF94A3B8),
                                                fontWeight: FontWeight.w500,
                                              ),
                                              border: InputBorder.none,
                                              contentPadding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 16,
                                                    vertical: 12,
                                                  ),
                                              suffixIcon: IconButton(
                                                icon: Icon(
                                                  _obscureConfirmPassword
                                                      ? Icons
                                                            .visibility_off_outlined
                                                      : Icons
                                                            .visibility_outlined,
                                                  color: const Color(
                                                    0xFF94A3B8,
                                                  ),
                                                  size: 20,
                                                ),
                                                onPressed: () {
                                                  setState(() {
                                                    _obscureConfirmPassword =
                                                        !_obscureConfirmPassword;
                                                  });
                                                },
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 12),

                                        // Terms & Conditions Checkbox
                                        Row(
                                          children: [
                                            SizedBox(
                                              width: 24,
                                              height: 24,
                                              child: Checkbox(
                                                value: _agreeToTerms,
                                                activeColor: kPrimary,
                                                checkColor: Colors.white,
                                                side: const BorderSide(
                                                  color: Colors.white,
                                                  width: 2,
                                                ),
                                                shape: RoundedRectangleBorder(
                                                  borderRadius:
                                                      BorderRadius.circular(4),
                                                ),
                                                onChanged: (val) {
                                                  setState(() {
                                                    _agreeToTerms =
                                                        val ?? false;
                                                  });
                                                },
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: RichText(
                                                text: TextSpan(
                                                  text: 'I agree to the ',
                                                  style: const TextStyle(
                                                    color: Color(0xFF7E8F84),
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.w500,
                                                  ),
                                                  children: [
                                                    TextSpan(
                                                      text: 'Terms & Conditions',
                                                      style: const TextStyle(
                                                        color: kPrimary,
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                      recognizer: TapGestureRecognizer()
                                                        ..onTap = () {
                                                          Navigator.push(
                                                            context,
                                                            MaterialPageRoute(
                                                              builder: (_) => const PrivacyScreen(),
                                                            ),
                                                          );
                                                        },
                                                    ),
                                                    const TextSpan(text: ' and '),
                                                    TextSpan(
                                                      text: 'Privacy Policy',
                                                      style: const TextStyle(
                                                        color: kPrimary,
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                      recognizer: TapGestureRecognizer()
                                                        ..onTap = () {
                                                          Navigator.push(
                                                            context,
                                                            MaterialPageRoute(
                                                              builder: (_) => const PrivacyScreen(),
                                                            ),
                                                          );
                                                        },
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 14),

                                        // Sign Up Button
                                        Container(
                                          width: double.infinity,
                                          height: 46,
                                          decoration: BoxDecoration(
                                            gradient: LinearGradient(
                                              colors: !_isSendingOtp
                                                  ? [kPrimary, kPrimaryLt]
                                                  : [
                                                      kPrimary.withOpacity(0.6),
                                                      kPrimaryLt.withOpacity(
                                                        0.6,
                                                      ),
                                                    ],
                                              begin: Alignment.topLeft,
                                              end: Alignment.bottomRight,
                                            ),
                                            borderRadius: BorderRadius.circular(
                                              30,
                                            ),
                                            boxShadow: !_isSendingOtp
                                                ? [
                                                    BoxShadow(
                                                      color: kPrimary
                                                          .withOpacity(0.25),
                                                      blurRadius: 10,
                                                      offset: const Offset(
                                                        0,
                                                        4,
                                                      ),
                                                    ),
                                                  ]
                                                : null,
                                          ),
                                          child: ElevatedButton(
                                            onPressed: _isSendingOtp
                                                ? null
                                                : _onSignupPressed,
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor:
                                                  Colors.transparent,
                                              foregroundColor: Colors.white,
                                              shadowColor: Colors.transparent,
                                              elevation: 0,
                                              shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(30),
                                              ),
                                            ),
                                            child: _isSendingOtp
                                                ? const SizedBox(
                                                    width: 20,
                                                    height: 20,
                                                    child:
                                                        CircularProgressIndicator(
                                                          color: Colors.white,
                                                          strokeWidth: 2,
                                                        ),
                                                  )
                                                : const Text(
                                                    'Sign Up',
                                                    style: TextStyle(
                                                      fontSize: 14,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                    ),
                                                  ),
                                          ),
                                        ),
                                        const SizedBox(height: 14),

                                        // Divider
                                        // Row(
                                        //   children: [
                                        //     Expanded(child: Container(height: 1, color: const Color(0xFFE2E8F0))),
                                        //     const Padding(
                                        //       padding: EdgeInsets.symmetric(horizontal: 16),
                                        //       child: Text(
                                        //         'or continue with',
                                        //         style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w500),
                                        //       ),
                                        //     ),
                                        //     Expanded(child: Container(height: 1, color: const Color(0xFFE2E8F0))),
                                        //   ],
                                        // ),
                                        // const SizedBox(height: 12),

                                        // OAuth Rows
                                        // Row(
                                        //   children: [
                                        //     Expanded(
                                        //       child: _OAuthButton(
                                        //         icon: 'assets/google.png',
                                        //         label: 'Google',
                                        //         fallbackIcon: Icons.g_mobiledata,
                                        //         onTap: () {
                                        //           context.read<AuthBloc>().add(const GoogleSignInRequested());
                                        //         },
                                        //       ),
                                        //     ),
                                        //     const SizedBox(width: 16),
                                        //     Expanded(
                                        //       child: _OAuthButton(
                                        //         icon: 'assets/apple.png',
                                        //         label: 'Apple',
                                        //         fallbackIcon: Icons.apple,
                                        //         onTap: () {},
                                        //       ),
                                        //     ),
                                        //   ],
                                        // ),
                                        // const SizedBox(height: 16),

                                        // Milk Splash Footer with Log In Link
                                        Stack(
                                          alignment: Alignment.center,
                                          children: [
                                            // Image.asset(
                                            //   'assets/icon/milk_splash.png',
                                            //   width: double.infinity,
                                            //   height: 70,
                                            //   fit: BoxFit.fitWidth,
                                            //   errorBuilder: (context, error, stackTrace) => const SizedBox(height: 70),
                                            // ),
                                            Container(
                                              margin: const EdgeInsets.only(
                                                top: 6,
                                                bottom: 26,
                                              ),
                                              child: GestureDetector(
                                                onTap: () {
                                                  Navigator.pushReplacement(
                                                    context,
                                                    MaterialPageRoute(
                                                      builder: (_) =>
                                                          const LoginScreen(),
                                                    ),
                                                  );
                                                },
                                                child: RichText(
                                                  text: const TextSpan(
                                                    text:
                                                        "Already have an account? ",
                                                    style: TextStyle(
                                                      color: Color(0xFF7E8F84),
                                                      fontSize: 13,
                                                      fontWeight:
                                                          FontWeight.w500,
                                                    ),
                                                    children: [
                                                      TextSpan(
                                                        text: 'Sign In',
                                                        style: TextStyle(
                                                          color: kPrimary,
                                                          fontSize: 14,
                                                          fontWeight:
                                                              FontWeight.bold,
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OAuthButton extends StatelessWidget {
  final String icon;
  final String label;
  final IconData fallbackIcon;
  final VoidCallback onTap;

  const _OAuthButton({
    required this.icon,
    required this.label,
    required this.fallbackIcon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(30),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
        ),
        child: Center(
          child: Image.asset(
            icon,
            width: 24,
            height: 24,
            errorBuilder: (context, error, stackTrace) =>
                Icon(fallbackIcon, size: 24, color: const Color(0xFF1A1A1A)),
          ),
        ),
      ),
    );
  }
}
