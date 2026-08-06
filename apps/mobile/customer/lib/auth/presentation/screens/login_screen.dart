import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/auth/presentation/screens/forgot_password_screen.dart';
import 'package:f2h_customer/auth/presentation/screens/signup_screen.dart';
import 'package:f2h_customer/core/services/app_asset_service.dart';

class LoginScreen extends StatefulWidget {
  final bool popOnSuccess;
  const LoginScreen({this.popOnSuccess = false, super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _onLoginPressed() {
    final identifier = _usernameController.text.trim();
    final password = _passwordController.text;

    if (identifier.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your email or mobile number')),
      );
      return;
    }

    if (password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter your password')),
      );
      return;
    }

    context.read<AuthBloc>().add(
      LoginRequested(identifier: identifier, password: password),
    );
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final isKeyboardOpen = MediaQuery.of(context).viewInsets.bottom > 0;
    
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
                        kAccent.withValues(alpha: 0.35),
                        kAccent.withValues(alpha: 0.0),
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
                        kPrimaryLt.withValues(alpha: 0.4),
                        kPrimaryLt.withValues(alpha: 0.0),
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
                        // Skip Button
                        // Align(
                        //   alignment: Alignment.topRight,
                        //   child: Padding(
                        //     padding: const EdgeInsets.only(right: 24.0),
                        //     child: TextButton.icon(
                        //       onPressed: () {
                        //         if (widget.popOnSuccess) {
                        //           Navigator.pop(context, false);
                        //         } else {
                        //           Navigator.pushAndRemoveUntil(
                        //             context,
                        //             MaterialPageRoute(builder: (_) => const AppShell()),
                        //             (route) => false,
                        //           );
                        //         }
                        //       },
                        //       icon: const Icon(Icons.arrow_forward_outlined, color: Colors.white, size: 14),
                        //       label: const Text(
                        //         'Skip',
                        //         style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                        //       ),
                        //       style: TextButton.styleFrom(
                        //         backgroundColor: Colors.white.withValues(alpha: 0.15),
                        //         shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                        //         padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        //       ),
                        //     ),
                        //   ),
                        // ),
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
                                  Colors.white.withValues(alpha: 0.25),
                                  Colors.white.withValues(alpha: 0.05),
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.4),
                                width: 1.5,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.08),
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
                                          color: kPrimary.withValues(alpha: 0.2),
                                          blurRadius: 10,
                                          offset: const Offset(0, 4),
                                        ),
                                      ],
                                    ),
                                    child: Center(
                                      child: AppAssetImage(
                                        assetKey: 'assets/icon/app_icon.png',
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
                            color: Colors.white.withValues(alpha: 0.70),
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
                            const Center(
                              child: Text(
                                'Welcome Back to F2H Fresh!',
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
                                'Login to access fresh dairy & more!',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF7E8F84),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            const SizedBox(height: 18),
                            
                            // Username Input
                            Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(30),
                                border: Border.all(color: kBorder.withValues(alpha: 0.35), width: 1.2),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.015),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: TextField(
                                controller: _usernameController,
                                keyboardType: TextInputType.emailAddress,
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1A1A1A)),
                                enableInteractiveSelection: true,
                                onTapOutside: (event) => FocusScope.of(context).unfocus(),
                                decoration: const InputDecoration(
                                  prefixIcon: Icon(Icons.mail_outline_rounded, color: Color(0xFF94A3B8)),
                                  hintText: 'Email or Phone',
                                  hintStyle: TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
                                  border: InputBorder.none,
                                  contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            
                            // Password Input
                            Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(30),
                                border: Border.all(color: kBorder.withValues(alpha: 0.35), width: 1.2),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.015),
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
                                  hintText: 'Password',
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
                            const SizedBox(height: 8),
                            
                            // Forgot Password Link
                            Align(
                              alignment: Alignment.centerRight,
                              child: GestureDetector(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => const ForgotPasswordScreen(),
                                    ),
                                  );
                                },
                                child: const Text(
                                  'Forgot Password?',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: kPrimary,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            
                            // Login Button
                            BlocBuilder<AuthBloc, AuthState>(
                              builder: (context, state) {
                                final isEnabled = state is! AuthLoading;
                                return Container(
                                  width: double.infinity,
                                  height: 46,
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: isEnabled
                                          ? [kPrimary, kPrimaryLt]
                                          : [kPrimary.withValues(alpha: 0.6), kPrimaryLt.withValues(alpha: 0.6)],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                    borderRadius: BorderRadius.circular(30),
                                    boxShadow: isEnabled ? [
                                      BoxShadow(
                                        color: kPrimary.withValues(alpha: 0.25),
                                        blurRadius: 10,
                                        offset: const Offset(0, 4),
                                      ),
                                    ] : null,
                                  ),
                                  child: ElevatedButton(
                                    onPressed: state is AuthLoading ? null : _onLoginPressed,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.transparent,
                                      foregroundColor: Colors.white,
                                      shadowColor: Colors.transparent,
                                      elevation: 0,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(30),
                                      ),
                                    ),
                                    child: state is AuthLoading
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                          )
                                        : const Text(
                                            'Sign In',
                                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                                          ),
                                  ),
                                );
                              },
                            ),
                            const SizedBox(height: 16),
                            
                            // Divider
                            Row(
                              children: [
                                Expanded(child: Container(height: 1, color: const Color(0xFFE2E8F0))),
                                const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 16),
                                  child: Text(
                                    'or continue with',
                                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w500),
                                  ),
                                ),
                                Expanded(child: Container(height: 1, color: const Color(0xFFE2E8F0))),
                              ],
                            ),
                            const SizedBox(height: 12),
                            
                            // OAuth Rows
                            Row(
                              children: [
                                Expanded(
                                  child: _OAuthButton(
                                    icon: 'assets/google.png',
                                    label: 'Google',
                                    fallbackIcon: Icons.g_mobiledata,
                                    onTap: () {
                                      context.read<AuthBloc>().add(const GoogleSignInRequested());
                                    },
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            
                            // Milk Splash Footer with Sign Up Link
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
                                  margin: const EdgeInsets.only(top: 6,bottom: 26),
                                  child: GestureDetector(
                                    onTap: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(builder: (_) => const SignupScreen()),
                                      );
                                    },
                                    child: RichText(
                                      text: const TextSpan(
                                        text: "Don't have an account? ",
                                        style: TextStyle(color: Color(0xFF7E8F84), fontSize: 13, fontWeight: FontWeight.w500),
                                        children: [
                                          TextSpan(
                                            text: 'Sign Up',
                                            style: TextStyle(color: kPrimary,fontSize: 14, fontWeight: FontWeight.bold),
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

class WavyTopClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path();
    final w = size.width;
    final h = size.height;
    
    // Start from bottom-left
    path.moveTo(0, h);
    // Line to top-left (leaving room for wave and rounding)
    path.lineTo(0, 40);
    
    // Left rounded peak
    path.quadraticBezierTo(w * 0.1, 8, w * 0.25, 18);
    // Dip in the middle
    path.quadraticBezierTo(w * 0.5, 38, w * 0.75, 18);
    // Right rounded peak and corner
    path.quadraticBezierTo(w * 0.9, 8, w, 40);
    
    // Line to bottom-right
    path.lineTo(w, h);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(CustomClipper<Path> oldClipper) => false;
}

class WavyBorderPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..shader = LinearGradient(
        colors: [
          Colors.white.withValues(alpha: 0.55),
          Colors.white.withValues(alpha: 0.15),
          Colors.white.withValues(alpha: 0.35),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ).createShader(Rect.fromLTWH(0, 0, size.width, 40))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    
    final path = Path();
    final w = size.width;
    
    // Shift path slightly down to prevent clipping from ClipPath
    path.moveTo(0, 41);
    path.quadraticBezierTo(w * 0.1, 9, w * 0.25, 19);
    path.quadraticBezierTo(w * 0.5, 39, w * 0.75, 19);
    path.quadraticBezierTo(w * 0.9, 9, w, 41);
    
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
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
          child: AppAssetImage(
            assetKey: icon,
            width: 24,
            height: 24,
            errorBuilder: (context, error, stackTrace) => Icon(
              fallbackIcon,
              size: 24,
              color: const Color(0xFF1A1A1A),
            ),
          ),
        ),
      ),
    );
  }
}
