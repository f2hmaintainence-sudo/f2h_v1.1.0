import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dio/dio.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';

class NotServiceableScreen extends StatefulWidget {
  final String branchId;
  final String branchName;
  final String city;
  final double userLat;
  final double userLng;

  const NotServiceableScreen({
    super.key,
    required this.branchId,
    required this.branchName,
    required this.city,
    required this.userLat,
    required this.userLng,
  });

  @override
  State<NotServiceableScreen> createState() => _NotServiceableScreenState();
}

class _NotServiceableScreenState extends State<NotServiceableScreen>
    with TickerProviderStateMixin {
  final Dio _dio = Dio();
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  bool _isSubmitting = false;
  bool _submitted = false;

  late AnimationController _bgAnim;
  late AnimationController _floatAnim;
  late AnimationController _pulseAnim;
  late AnimationController _signalAnim;
  late AnimationController _successAnim;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
    _bgAnim = AnimationController(vsync: this, duration: const Duration(seconds: 10))..repeat();
    _floatAnim = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200))
      ..repeat(reverse: true);
    _pulseAnim = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))
      ..repeat(reverse: true);
    _signalAnim = AnimationController(vsync: this, duration: const Duration(seconds: 2))
      ..repeat();
    _successAnim = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
  }

  @override
  void dispose() {
    _nameCtrl.dispose(); _phoneCtrl.dispose(); _emailCtrl.dispose();
    _bgAnim.dispose(); _floatAnim.dispose(); _pulseAnim.dispose();
    _signalAnim.dispose(); _successAnim.dispose();
    super.dispose();
  }

  Future<void> _submitWaitlist() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);
    try {
      final response = await _dio.post(
        '${ApiEndpoints.baseUrl}/DeliveryPartner/auth/waitlist',
        data: {
          'full_name': _nameCtrl.text.trim(),
          'phone': _phoneCtrl.text.trim(),
          'email': _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
          'city': widget.city,
          'lat': widget.userLat,
          'lng': widget.userLng,
        },
      );
      if (response.data['success'] == true) {
        setState(() { _isSubmitting = false; _submitted = true; });
        _successAnim.forward();
      } else {
        _showSnack(response.data['message'] ?? 'Failed to submit', isError: true);
        setState(() => _isSubmitting = false);
      }
    } on DioException catch (e) {
      _showSnack(e.response?.data?['message'] ?? 'Connection error', isError: true);
      setState(() => _isSubmitting = false);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: GoogleFonts.roboto()),
      backgroundColor: isError ? kRed : kPrimary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      body: Stack(
        children: [
          // Background blobs — soft light version
          AnimatedBuilder(
            animation: _bgAnim,
            builder: (_, _) => Stack(children: [
              Positioned(
                top: -100 + math.sin(_bgAnim.value * math.pi * 2) * 40,
                right: -60,
                child: Container(
                  width: 300, height: 300,
                  decoration: BoxDecoration(shape: BoxShape.circle,
                    gradient: RadialGradient(colors: [kAccentLt.withValues(alpha: 0.4), Colors.transparent])),
                ),
              ),
              Positioned(
                bottom: -80,
                left: -60 + math.cos(_bgAnim.value * math.pi * 2) * 30,
                child: Container(
                  width: 240, height: 240,
                  decoration: BoxDecoration(shape: BoxShape.circle,
                    gradient: RadialGradient(colors: [kPrimaryPl.withValues(alpha: 0.4), Colors.transparent])),
                ),
              ),
            ]),
          ),

          SafeArea(
            child: _submitted ? _buildSuccessState() : _buildFormState(),
          ),
        ],
      ),
    );
  }

  Widget _buildFormState() {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 20),

              // Back
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: kSurface, borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: kBorder),
                    boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.04), blurRadius: 6)],
                  ),
                  child: const Icon(Icons.arrow_back_rounded, color: kText, size: 20),
                ),
              ),

              const SizedBox(height: 32),

              // Animated satellite tower icon
              Center(
                child: AnimatedBuilder(
                  animation: Listenable.merge([_floatAnim, _signalAnim, _pulseAnim]),
                  builder: (_, _) => SizedBox(
                    width: 160, height: 160,
                    child: Stack(alignment: Alignment.center, children: [
                      // Outer pulse
                      Container(
                        width: 140 + _pulseAnim.value * 20,
                        height: 140 + _pulseAnim.value * 20,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(colors: [
                            kAccent.withValues(alpha: 0.06 + _pulseAnim.value * 0.04),
                            Colors.transparent,
                          ]),
                        ),
                      ),
                      // Signal waves
                      ...List.generate(3, (i) {
                        final progress = (_signalAnim.value - i * 0.3) % 1.0;
                        final vp = progress < 0 ? progress + 1 : progress;
                        return Container(
                          width: 24 + vp * 100,
                          height: 24 + vp * 100,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: kAccent.withValues(alpha: (1 - vp) * 0.35),
                              width: 1.5,
                            ),
                          ),
                        );
                      }),
                      // Main icon circle with float
                      Transform.translate(
                        offset: Offset(0, math.sin(_floatAnim.value * math.pi) * 8),
                        child: Container(
                          width: 90, height: 90,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: kSurface,
                            border: Border.all(color: kBorder, width: 1.5),
                            boxShadow: [BoxShadow(color: kAccent.withValues(alpha: 0.15), blurRadius: 20)],
                          ),
                          child: const Icon(Icons.cell_tower_rounded, color: kAccent, size: 44),
                        ),
                      ),
                    ]),
                  ),
                ),
              ),

              const SizedBox(height: 32),

              // "Coming Soon" chip
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  decoration: BoxDecoration(
                    color: kAccentLt.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '🚀  COMING SOON TO YOUR AREA',
                    style: GoogleFonts.roboto(color: const Color(0xFFD68A00), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              Text(
                'We\'re Expanding!',
                style: GoogleFonts.roboto(fontSize: 28, fontWeight: FontWeight.w700, color: kText, letterSpacing: -0.5),
              ),
              const SizedBox(height: 8),
              Text(
                'We don\'t cover your location near ${widget.branchName} yet. Join the waitlist and we\'ll notify you the moment we launch nearby.',
                style: GoogleFonts.roboto(fontSize: 14, color: kTextSub, height: 1.55),
              ),

              const SizedBox(height: 28),

              // Form card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: kBorder),
                  boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.05), blurRadius: 16, offset: const Offset(0, 4))],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Join the Waitlist',
                      style: GoogleFonts.roboto(fontSize: 16, fontWeight: FontWeight.w700, color: kText),
                    ),
                    const SizedBox(height: 4),
                    Text('Be first in line when we launch near you', style: GoogleFonts.roboto(color: kTextSub, fontSize: 12)),
                    const SizedBox(height: 20),

                    _WaitlistField(controller: _nameCtrl, hint: 'Full Name', icon: Icons.person_outline_rounded,
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null),
                    const SizedBox(height: 12),
                    _WaitlistField(controller: _phoneCtrl, hint: 'Phone Number', icon: Icons.phone_outlined,
                        keyboard: TextInputType.phone,
                        validator: (v) => (v == null || v.trim().length < 10) ? 'Enter valid phone number' : null),
                    const SizedBox(height: 12),
                    _WaitlistField(controller: _emailCtrl, hint: 'Email Address (Optional)', icon: Icons.email_outlined,
                        keyboard: TextInputType.emailAddress),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Waitlist perks
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: kPrimaryPl,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: [
                    _PerkRow(icon: Icons.notifications_active_outlined, text: 'Get notified the moment we launch near you'),
                    const SizedBox(height: 8),
                    _PerkRow(icon: Icons.star_outline_rounded, text: 'Priority onboarding for early waitlist members'),
                    const SizedBox(height: 8),
                    _PerkRow(icon: Icons.card_giftcard_rounded, text: 'Bonus first-week earnings for waitlist joiners'),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              // Submit button
              _WaitlistButton(loading: _isSubmitting, onTap: _isSubmitting ? null : _submitWaitlist),

              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSuccessState() {
    return FadeTransition(
      opacity: _successAnim,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Animated checkmark
              AnimatedBuilder(
                animation: _pulseAnim,
                builder: (_, _) => Stack(alignment: Alignment.center, children: [
                  Container(
                    width: 100 + _pulseAnim.value * 20,
                    height: 100 + _pulseAnim.value * 20,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(colors: [
                        kPrimaryLt.withValues(alpha: 0.08 + _pulseAnim.value * 0.04),
                        Colors.transparent,
                      ]),
                    ),
                  ),
                  Container(
                    width: 88, height: 88,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(colors: [kPrimaryMid, kPrimary]),
                      boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.3), blurRadius: 24)],
                    ),
                    child: const Icon(Icons.check_rounded, color: Colors.white, size: 44),
                  ),
                ]),
              ),

              const SizedBox(height: 32),
              Text(
                'You\'re on the List! 🎉',
                style: GoogleFonts.roboto(fontSize: 26, fontWeight: FontWeight.w700, color: kText, letterSpacing: -0.5),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                'We\'ve saved your details. You\'ll receive a notification the moment we launch F2H Fresh deliveries near you.',
                style: GoogleFonts.roboto(fontSize: 14, color: kTextSub, height: 1.6),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              GestureDetector(
                onTap: () { Navigator.pop(context); SystemNavigator.pop(); },
                child: Container(
                  width: double.infinity, height: 58,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [kPrimaryMid, kPrimary]),
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 8))],
                  ),
                  child: Center(
                    child: Text('Got It', style: GoogleFonts.roboto(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16)),
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
class _WaitlistField extends StatefulWidget {
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final TextInputType keyboard;
  final String? Function(String?)? validator;

  const _WaitlistField({
    required this.controller,
    required this.hint,
    required this.icon,
    this.keyboard = TextInputType.text,
    this.validator,
  });

  @override
  State<_WaitlistField> createState() => _WaitlistFieldState();
}

class _WaitlistFieldState extends State<_WaitlistField> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    return Focus(
      onFocusChange: (f) => setState(() => _focused = f),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: _focused ? kPrimaryPl.withValues(alpha: 0.3) : kBgDeep,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _focused ? kPrimaryLt : kBorder, width: _focused ? 1.5 : 1),
        ),
        child: TextFormField(
          controller: widget.controller,
          keyboardType: widget.keyboard,
          validator: widget.validator,
          style: GoogleFonts.roboto(color: kText, fontSize: 14, fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            prefixIcon: Icon(widget.icon, color: _focused ? kPrimaryMid : kMuted, size: 18),
            hintText: widget.hint,
            hintStyle: GoogleFonts.roboto(color: kMuted, fontSize: 13),
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            errorStyle: GoogleFonts.roboto(color: kRed, fontSize: 11),
          ),
        ),
      ),
    );
  }
}

class _PerkRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _PerkRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: kPrimaryMid, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: GoogleFonts.roboto(color: kTextSub, fontSize: 12, height: 1.4))),
      ],
    );
  }
}

class _WaitlistButton extends StatefulWidget {
  final bool loading;
  final VoidCallback? onTap;
  const _WaitlistButton({required this.loading, this.onTap});

  @override
  State<_WaitlistButton> createState() => _WaitlistButtonState();
}

class _WaitlistButtonState extends State<_WaitlistButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) { setState(() => _pressed = false); widget.onTap?.call(); },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        child: Container(
          height: 58,
          decoration: BoxDecoration(
            gradient: widget.loading
                ? LinearGradient(colors: [kBorder, kBorder])
                : const LinearGradient(colors: [kPrimaryMid, kPrimary],
                    begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(18),
            boxShadow: widget.loading ? [] : [
              BoxShadow(color: kPrimary.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 8)),
            ],
          ),
          child: Center(
            child: widget.loading
                ? const SizedBox(width: 22, height: 22,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Join Waitlist', style: GoogleFonts.roboto(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white)),
                      const SizedBox(width: 8),
                      const Icon(Icons.notifications_active_outlined, color: kAccent, size: 20),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
