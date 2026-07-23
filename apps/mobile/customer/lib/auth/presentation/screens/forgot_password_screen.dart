import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _otpController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();

  int _step = 0;
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
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

  Future<void> _sendOtp() async {
    if (_email.isEmpty || !_email.contains('@')) {
      _showError('Please enter a valid email address');
      return;
    }

    setState(() => _isLoading = true);
    try {
      await sl<AuthRepository>().requestPasswordResetOtp(_email);
      if (!mounted) return;
      setState(() => _step = 1);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Password reset OTP sent to $_email')),
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

  Future<void> _verifyOtp() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      _showError('Please enter the 6-digit OTP');
      return;
    }

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

    setState(() => _isLoading = true);
    try {
      await sl<AuthRepository>().resetPassword(
        email: _email,
        token: token,
        newPassword: password,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password reset successfully')),
      );
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
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

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: kRed),
    );
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final isKeyboardOpen = MediaQuery.of(context).viewInsets.bottom > 0;

    return Scaffold(
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
                minHeight: size.height - MediaQuery.of(context).padding.top - MediaQuery.of(context).viewInsets.bottom,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    children: [
                      const SizedBox(height: 12),
                      // Skip/Back Button top-left
                      Align(
                        alignment: Alignment.topLeft,
                        child: Padding(
                          padding: const EdgeInsets.only(left: 16.0),
                          child: IconButton(
                            icon: const Icon(Icons.arrow_back, color: Colors.white),
                            onPressed: () {
                              if (_step > 0) {
                                setState(() {
                                  _step--;
                                });
                              } else {
                                Navigator.pop(context);
                              }
                            },
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
                                filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5),
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
                                        errorBuilder: (context, error, stackTrace) => const Icon(
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
                      filter: ImageFilter.blur(sigmaX: 18.0, sigmaY: 18.0),
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
                              padding: const EdgeInsets.fromLTRB(20, 48, 20, 16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Center(
                                    child: Text(
                                      _title,
                                      style: const TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w900,
                                        color: Color(0xFF1A1A1A),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Center(
                                    child: Text(
                                      _subtitle,
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF7E8F84),
                                        fontWeight: FontWeight.w500,
                                        height: 1.4,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  _StepIndicator(currentStep: _step),
                                  const SizedBox(height: 18),
                                  
                                  if (_step == 0) _emailStep(),
                                  if (_step == 1) _otpStep(),
                                  if (_step == 2) _passwordStep(),
                                  
                                  const SizedBox(height: 32),
                                  
                                  // Milk Splash Footer
                                  Image.asset(
                                    'assets/icon/milk_splash.png',
                                    width: double.infinity,
                                    height: 70,
                                    fit: BoxFit.fitWidth,
                                    errorBuilder: (context, error, stackTrace) => const SizedBox(height: 70),
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
);
}

  String get _title {
    switch (_step) {
      case 1:
        return 'Verify OTP';
      case 2:
        return 'Reset Password';
      default:
        return 'Forgot Password?';
    }
  }

  String get _subtitle {
    switch (_step) {
      case 1:
        return 'Enter the 6-digit OTP sent to $_email.';
      case 2:
        return 'Create a new secure password for your account.';
      default:
        return 'No worries! Enter your email or mobile number and we\'ll send you a link to reset your password.';
    }
  }

  Widget _emailStep() {
    return Column(
      children: [
        Container(
          decoration: BoxDecoration(
            color: kPrimaryPl.withOpacity(0.55),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: kBorder.withOpacity(0.35), width: 1.2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.015),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1A1A1A)),
            enableInteractiveSelection: true,
            onTapOutside: (event) => FocusScope.of(context).unfocus(),
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.mail_outline_rounded, color: Color(0xFF94A3B8)),
              hintText: 'Email or Mobile Number',
              hintStyle: TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
              border: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
          ),
        ),
        const SizedBox(height: 16),
        
        // Send Reset Link Button
        Container(
          width: double.infinity,
          height: 46,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: !_isLoading
                  ? [kPrimary, kPrimaryLt]
                  : [kPrimary.withOpacity(0.6), kPrimaryLt.withOpacity(0.6)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(30),
            boxShadow: !_isLoading ? [
              BoxShadow(
                color: kPrimary.withOpacity(0.25),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ] : null,
          ),
          child: ElevatedButton(
            onPressed: _isLoading ? null : _sendOtp,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.transparent,
              foregroundColor: Colors.white,
              shadowColor: Colors.transparent,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(30),
              ),
            ),
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : const Text(
                    'Send Reset Link',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
          ),
        ),
        const SizedBox(height: 12),
        
        // Divider "or"
        Row(
          children: [
            Expanded(child: Container(height: 1, color: const Color(0xFFE2E8F0))),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'or',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w500),
              ),
            ),
            Expanded(child: Container(height: 1, color: const Color(0xFFE2E8F0))),
          ],
        ),
        const SizedBox(height: 12),

        // Back to Login Button (Outlined Green with Glass Fill)
        SizedBox(
          width: double.infinity,
          height: 46,
          child: OutlinedButton(
            onPressed: () => Navigator.pop(context),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: kPrimary, width: 1.2),
              backgroundColor: Colors.white.withOpacity(0.35),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(30),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: const [
                Icon(Icons.arrow_back, color: kPrimary, size: 16),
                SizedBox(width: 8),
                Text(
                  'Back to Login',
                  style: TextStyle(
                    color: kPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _otpStep() {
    return Column(
      children: [
        Container(
          decoration: BoxDecoration(
            color: kPrimaryPl.withOpacity(0.55),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: kBorder.withOpacity(0.35), width: 1.2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.015),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
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
              hintText: '6-digit OTP',
              hintStyle: TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w500, letterSpacing: 0),
              border: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
          ),
        ),
        const SizedBox(height: 16),
        
        // Verify Button
        Container(
          width: double.infinity,
          height: 46,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: !_isLoading
                  ? [kPrimary, kPrimaryLt]
                  : [kPrimary.withOpacity(0.6), kPrimaryLt.withOpacity(0.6)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(30),
            boxShadow: !_isLoading ? [
              BoxShadow(
                color: kPrimary.withOpacity(0.25),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ] : null,
          ),
          child: ElevatedButton(
            onPressed: _isLoading ? null : _verifyOtp,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.transparent,
              foregroundColor: Colors.white,
              shadowColor: Colors.transparent,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(30),
              ),
            ),
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : const Text(
                    'Verify OTP',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
          ),
        ),
        const SizedBox(height: 12),
        
        // Resend TextButton
        TextButton(
          onPressed: _isLoading ? null : _sendOtp,
          style: TextButton.styleFrom(foregroundColor: kPrimary),
          child: const Text(
            'Resend OTP',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
        ),
      ],
    );
  }

  Widget _passwordStep() {
    return Column(
      children: [
        Container(
          decoration: BoxDecoration(
            color: kPrimaryPl.withOpacity(0.55),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: kBorder.withOpacity(0.35), width: 1.2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.015),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: TextField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1A1A1A)),
            enableInteractiveSelection: true,
            onTapOutside: (event) => FocusScope.of(context).unfocus(),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.lock_outline_rounded, color: Color(0xFF94A3B8)),
              hintText: 'New Password',
              hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                  color: const Color(0xFF94A3B8),
                  size: 20,
                ),
                onPressed: () {
                  setState(() {
                    _obscurePassword = !_obscurePassword;
                  });
                },
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: kPrimaryPl.withOpacity(0.55),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: kBorder.withOpacity(0.35), width: 1.2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.015),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: TextField(
            controller: _confirmPasswordController,
            obscureText: _obscureConfirmPassword,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1A1A1A)),
            enableInteractiveSelection: true,
            onTapOutside: (event) => FocusScope.of(context).unfocus(),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.lock_reset_outlined, color: Color(0xFF94A3B8)),
              hintText: 'Confirm Password',
              hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureConfirmPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                  color: const Color(0xFF94A3B8),
                  size: 20,
                ),
                onPressed: () {
                  setState(() {
                    _obscureConfirmPassword = !_obscureConfirmPassword;
                  });
                },
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        
        // Reset Password Button
        Container(
          width: double.infinity,
          height: 46,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: !_isLoading
                  ? [kPrimary, kPrimaryLt]
                  : [kPrimary.withOpacity(0.6), kPrimaryLt.withOpacity(0.6)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(30),
            boxShadow: !_isLoading ? [
              BoxShadow(
                color: kPrimary.withOpacity(0.25),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ] : null,
          ),
          child: ElevatedButton(
            onPressed: _isLoading ? null : _resetPassword,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.transparent,
              foregroundColor: Colors.white,
              shadowColor: Colors.transparent,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(30),
              ),
            ),
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : const Text(
                    'Reset Password',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
          ),
        ),
      ],
    );
  }
}

class _StepIndicator extends StatelessWidget {
  final int currentStep;

  const _StepIndicator({required this.currentStep});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(3, (index) {
        final isActive = index <= currentStep;
        return Expanded(
          child: Container(
            height: 4,
            margin: EdgeInsets.only(right: index == 2 ? 0 : 8),
            decoration: BoxDecoration(
              color: isActive ? kPrimary : const Color(0xFFE2E8F0),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        );
      }),
    );
  }
}
