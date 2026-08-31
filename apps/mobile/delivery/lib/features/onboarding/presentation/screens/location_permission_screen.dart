import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:geolocator/geolocator.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/auth/presentation/screens/signup_screen.dart';

class LocationPermissionScreen extends StatefulWidget {
  const LocationPermissionScreen({super.key});

  @override
  State<LocationPermissionScreen> createState() => _LocationPermissionScreenState();
}

class _LocationPermissionScreenState extends State<LocationPermissionScreen>
    with SingleTickerProviderStateMixin {
  bool _isRequesting = false;
  late AnimationController _pulseAnim;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
    _pulseAnim = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseAnim.dispose();
    super.dispose();
  }

  Future<void> _requestLocationPermission() async {
    setState(() {
      _isRequesting = true;
    });

    try {
      // 1. Check if location services are enabled
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Please enable GPS Location Services in your settings', style: GoogleFonts.roboto()),
            backgroundColor: kRed,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
        setState(() {
          _isRequesting = false;
        });
        return;
      }

      // 2. Request permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Location permission is required to operate as a delivery boy', style: GoogleFonts.roboto()),
              backgroundColor: kRed,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
          setState(() {
            _isRequesting = false;
          });
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Location permission is permanently denied. Please enable it in device settings.', style: GoogleFonts.roboto()),
            backgroundColor: kRed,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
        setState(() {
          _isRequesting = false;
        });
        return;
      }

      // 3. Permission granted: Navigate to Signup Screen
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const SignupScreen()),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error requesting permission: $e', style: GoogleFonts.roboto()),
            backgroundColor: kRed,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isRequesting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            children: [
              const Spacer(),

              // Animated Location Radar Visual
              AnimatedBuilder(
                animation: _pulseAnim,
                builder: (_, _) => Container(
                  height: 160 + _pulseAnim.value * 12,
                  width: 160 + _pulseAnim.value * 12,
                  decoration: BoxDecoration(
                    color: kPrimaryPl.withValues(alpha: 0.5),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          height: 100,
                          width: 100,
                          decoration: BoxDecoration(
                            color: kPrimaryPl,
                            shape: BoxShape.circle,
                          ),
                        ),
                        Container(
                          height: 64,
                          width: 64,
                          decoration: BoxDecoration(
                            color: kSurface,
                            shape: BoxShape.circle,
                            border: Border.all(color: kBorder, width: 1.5),
                            boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.1), blurRadius: 16)],
                          ),
                          child: const Icon(
                            Icons.my_location_rounded,
                            size: 30,
                            color: kPrimaryMid,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 48),

              // Explainer Titles
              Text(
                'Enable Precise Location',
                textAlign: TextAlign.center,
                style: GoogleFonts.roboto(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  color: kText,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'F2H Fresh relies on your device location to streamline your deliveries and calculate daily payouts.',
                textAlign: TextAlign.center,
                style: GoogleFonts.roboto(
                  fontSize: 14,
                  color: kTextSub,
                  height: 1.6,
                  fontWeight: FontWeight.w400,
                ),
              ),
              const SizedBox(height: 36),

              // Rationale bullet list
              _PermissionReasonRow(
                icon: Icons.route_outlined,
                title: 'Live Map Navigation',
                subtitle: 'Get optimized sequence turns and directions directly to customer houses.',
              ),
              const SizedBox(height: 20),
              _PermissionReasonRow(
                icon: Icons.local_atm_outlined,
                title: 'Distance Payouts',
                subtitle: 'Accurately track your daily trip distance for fuel and mileage incentives.',
              ),
              const SizedBox(height: 20),
              _PermissionReasonRow(
                icon: Icons.share_location_outlined,
                title: 'Real-Time Customer ETA',
                subtitle: 'Automatically notify customers when you enter their H3 sector/hexagon boundary.',
              ),

              const Spacer(),

              // Grant Button
              GestureDetector(
                onTap: _isRequesting ? null : _requestLocationPermission,
                child: Container(
                  width: double.infinity,
                  height: 58,
                  decoration: BoxDecoration(
                    gradient: _isRequesting
                        ? LinearGradient(colors: [kBorder, kBorder])
                        : const LinearGradient(
                            colors: [kPrimaryMid, kPrimary],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: _isRequesting ? [] : [
                      BoxShadow(
                        color: kPrimary.withValues(alpha: 0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Center(
                    child: _isRequesting
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                          )
                        : Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Grant Location Access',
                                style: GoogleFonts.roboto(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                  letterSpacing: 0.3,
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Icon(Icons.my_location_rounded, color: kAccent, size: 20),
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

class _PermissionReasonRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _PermissionReasonRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: kPrimaryPl,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, color: kPrimaryMid, size: 20),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: GoogleFonts.roboto(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: kText,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: GoogleFonts.roboto(
                  fontSize: 13,
                  color: kTextSub,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
