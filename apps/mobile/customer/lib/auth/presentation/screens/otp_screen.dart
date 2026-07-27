import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';

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

  Future<void> _verifyAndRegister() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter the 6-digit OTP')),
      );
      return;
    }

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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: kRed),
      );
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('New OTP sent to ${widget.email}')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(extractErrorMessage(e)), backgroundColor: kRed),
      );
    } finally {
      if (mounted) {
        setState(() => _isResending = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

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
                kPrimary,    // Mid Green
              ],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: SafeArea(
            bottom: false,
            child: SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: size.height - MediaQuery.of(context).padding.top,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      children: [
                        const SizedBox(height: 12),
                        // Back Button top-left
                        Align(
                          alignment: Alignment.topLeft,
                          child: Padding(
                            padding: const EdgeInsets.only(left: 16.0),
                            child: IconButton(
                              icon: const Icon(Icons.arrow_back, color: Colors.white),
                              onPressed: () => Navigator.pop(context),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        // App Logo splat
                        Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white.withValues(alpha: 0.35), width: 2),
                          ),
                          padding: const EdgeInsets.all(4),
                          child: Container(
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Image.asset(
                                'assets/icon/app_icon.png',
                                width: 38,
                                height: 38,
                                errorBuilder: (context, error, stackTrace) => const Icon(
                                  Icons.agriculture_rounded,
                                  color: kPrimary,
                                  size: 26,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'F2H',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: 1.0,
                          ),
                        ),
                        const Text(
                          'FARM TO HOME',
                          style: TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.w800,
                            color: Colors.white70,
                            letterSpacing: 1.5,
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                    ),
                    
                    // Wavy Top Container
                    ClipPath(
                      clipper: WavyTopClipper(),
                      child: Container(
                        width: double.infinity,
                        color: Colors.white,
                        padding: const EdgeInsets.fromLTRB(20, 48, 20, 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Center(
                              child: Text(
                                'Verify Email',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF1A1A1A),
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Center(
                              child: Text(
                                "We've sent a 6-digit OTP to ${widget.email}. Enter it below to finish creating your account.",
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF7E8F84),
                                  fontWeight: FontWeight.w500,
                                  height: 1.4,
                                ),
                              ),
                            ),
                            const SizedBox(height: 18),
                            
                            // OTP Text Field Input
                            Container(
                              decoration: BoxDecoration(
                                color: const Color(0xFFF7F9FB),
                                borderRadius: BorderRadius.circular(30),
                                border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                              ),
                              child: TextField(
                                controller: _otpController,
                                keyboardType: TextInputType.number,
                                textAlign: TextAlign.center,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                  LengthLimitingTextInputFormatter(6),
                                ],
                                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: 6, color: Color(0xFF1A1A1A)),
                                enableInteractiveSelection: true,
                                onTapOutside: (event) => FocusScope.of(context).unfocus(),
                                decoration: const InputDecoration(
                                  prefixIcon: Icon(Icons.password_outlined, color: Color(0xFF94A3B8)),
                                  hintText: '000000',
                                  hintStyle: TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w500, letterSpacing: 6),
                                  border: InputBorder.none,
                                  contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            
                            // Verify & Create Account Button
                            BlocBuilder<AuthBloc, AuthState>(
                              builder: (context, state) {
                                final isLoading = _isVerifying || state is AuthLoading;
                                return SizedBox(
                                  width: double.infinity,
                                  height: 46,
                                  child: ElevatedButton(
                                    onPressed: isLoading ? null : _verifyAndRegister,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: kPrimary,
                                      foregroundColor: Colors.white,
                                      elevation: 0,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(30),
                                      ),
                                    ),
                                    child: isLoading
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                          )
                                        : const Text(
                                            'Verify & Create Account',
                                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                                          ),
                                  ),
                                );
                              },
                            ),
                            const SizedBox(height: 12),
                            
                            // Resend OTP Link
                            Center(
                              child: TextButton(
                                onPressed: _isResending ? null : _resendOtp,
                                style: TextButton.styleFrom(foregroundColor: kPrimary),
                                child: Text(
                                  _isResending ? 'Sending...' : "Didn't receive it? Resend OTP",
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                            
                            const SizedBox(height: 16),
                            
                            // Milk Splash Footer
                            Stack(
                              alignment: Alignment.center,
                              children: [
                                Image.asset(
                                  'assets/icon/milk_splash.png',
                                  width: double.infinity,
                                  height: 70,
                                  fit: BoxFit.fitWidth,
                                  errorBuilder: (context, error, stackTrace) => const SizedBox(height: 70),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
