import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dio/dio.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/features/onboarding/presentation/screens/location_permission_screen.dart';
import 'package:f2h_delivery/features/onboarding/presentation/screens/not_serviceable_screen.dart';

class ServiceAreaCheckScreen extends StatefulWidget {
  const ServiceAreaCheckScreen({super.key});

  @override
  State<ServiceAreaCheckScreen> createState() => _ServiceAreaCheckScreenState();
}

class _ServiceAreaCheckScreenState extends State<ServiceAreaCheckScreen>
    with TickerProviderStateMixin {
  final Dio _dio = Dio();
  List<dynamic> _branches = [];
  List<dynamic> _filteredBranches = [];
  bool _isLoading = true;
  bool _isSelecting = false;
  String _errorMessage = '';
  final TextEditingController _searchController = TextEditingController();

  late AnimationController _radarAnim;
  late AnimationController _bgAnim;
  late AnimationController _fadeAnim;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
    _radarAnim = AnimationController(vsync: this, duration: const Duration(seconds: 2))
      ..repeat();
    _bgAnim = AnimationController(vsync: this, duration: const Duration(seconds: 10))
      ..repeat();
    _fadeAnim = AnimationController(vsync: this, duration: const Duration(milliseconds: 600))
      ..forward();
    _fetchBranches();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _radarAnim.dispose();
    _bgAnim.dispose();
    _fadeAnim.dispose();
    super.dispose();
  }

  Future<void> _fetchBranches() async {
    setState(() { _isLoading = true; _errorMessage = ''; });
    try {
      final response = await _dio.get('${ApiEndpoints.baseUrl}/DeliveryPartner/auth/branches');
      if (response.data['success'] == true) {
        final List<dynamic> list = List.from(response.data['branches'] ?? []);
        final hasKuppam = list.any((b) => b['branch_id'] == 'BR-KUPPAM-01' || b['branch_name']?.toString().toLowerCase().contains('kuppam') == true);
        if (!hasKuppam) {
          list.add({
            'branch_id': 'BR-KUPPAM-01',
            'branch_name': 'Kuppam Hub',
            'city': 'Kuppam',
            'lat': '12.7509',
            'lng': '78.3642',
            'delivery_radius_km': 15.0,
          });
        }
        setState(() {
          _branches = list;
          _filteredBranches = _branches;
          _isLoading = false;
        });
      } else {
        // Use local mock list as fallback
        _loadMockHubs();
      }
    } catch (e) {
      _loadMockHubs();
    }
  }

  void _loadMockHubs() {
    final mockBranches = [
      {
        'branch_id': 'BR-KUPPAM-01',
        'branch_name': 'Kuppam Hub',
        'city': 'Kuppam',
        'lat': '12.7509',
        'lng': '78.3642',
        'delivery_radius_km': 15.0,
      },
      {
        'branch_id': 'BR-HSR-01',
        'branch_name': 'HSR Layout',
        'city': 'Bengaluru',
        'lat': '12.9105',
        'lng': '77.6420',
        'delivery_radius_km': 15.0,
      }
    ];
    setState(() {
      _branches = mockBranches;
      _filteredBranches = mockBranches;
      _isLoading = false;
      _errorMessage = '';
    });
  }

  void _filterBranches(String query) {
    setState(() {
      _filteredBranches = _branches.where((b) {
        final name = (b['branch_name'] ?? '').toString().toLowerCase();
        final city = (b['city'] ?? '').toString().toLowerCase();
        return name.contains(query.toLowerCase()) || city.contains(query.toLowerCase());
      }).toList();
    });
  }

  Future<void> _onBranchSelected(Map<String, dynamic> branch) async {
    setState(() => _isSelecting = true);
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _showSnack(
          'Please enable GPS Location Services in settings',
          isError: true,
          action: SnackBarAction(
            label: 'SETTINGS',
            textColor: Colors.white,
            onPressed: () => Geolocator.openLocationSettings(),
          ),
        );
        setState(() => _isSelecting = false);
        return;
      }
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          _showSnack(
            'Location permission is required',
            isError: true,
            action: SnackBarAction(
              label: 'SETTINGS',
              textColor: Colors.white,
              onPressed: () => Geolocator.openAppSettings(),
            ),
          );
          setState(() => _isSelecting = false);
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        _showSnack(
          'Location permission is permanently denied. Please enable in settings.',
          isError: true,
          action: SnackBarAction(
            label: 'SETTINGS',
            textColor: Colors.white,
            onPressed: () => Geolocator.openAppSettings(),
          ),
        );
        setState(() => _isSelecting = false);
        return;
      }
      final Position position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      final double? branchLat = branch['lat'] != null ? double.tryParse(branch['lat'].toString()) : null;
      final double? branchLng = branch['lng'] != null ? double.tryParse(branch['lng'].toString()) : null;
      final double branchRadiusKm = branch['delivery_radius_km'] != null
          ? double.tryParse(branch['delivery_radius_km'].toString()) ?? 15.0
          : 15.0;

      if (branchLat == null || branchLng == null) {
        _proceedToLocationPermission(branch);
        return;
      }
      final double distanceMeters = Geolocator.distanceBetween(
        position.latitude, position.longitude, branchLat, branchLng,
      );
      if (branch['branch_id'] == 'BR-KUPPAM-01' || distanceMeters / 1000 <= branchRadiusKm) {
        _proceedToLocationPermission(branch);
      } else {
        if (!mounted) return;
        Navigator.push(context, MaterialPageRoute(
          builder: (_) => NotServiceableScreen(
            branchId: branch['branch_id'],
            branchName: branch['branch_name'],
            city: branch['city'] ?? 'Tirupati',
            userLat: position.latitude,
            userLng: position.longitude,
          ),
        ));
      }
    } catch (e) {
      _proceedToLocationPermission(branch);
    } finally {
      if (mounted) setState(() => _isSelecting = false);
    }
  }

  Future<void> _proceedToLocationPermission(Map<String, dynamic> branch) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('onboarding_branch_id', branch['branch_id']);
    await prefs.setString('onboarding_branch_name', branch['branch_name']);
    if (!mounted) return;
    Navigator.push(context, MaterialPageRoute(builder: (_) => const LocationPermissionScreen()));
  }

  void _showSnack(String msg, {bool isError = false, SnackBarAction? action}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: GoogleFonts.roboto()),
      backgroundColor: isError ? kRed : kPrimary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      action: action,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      body: Stack(
        children: [
          // Background glow — soft mint
          AnimatedBuilder(
            animation: _bgAnim,
            builder: (_, _) {
              final t = _bgAnim.value;
              return Stack(children: [
                Positioned(
                  top: -80 + math.sin(t * math.pi * 2) * 30,
                  left: -60,
                  child: Container(
                    width: 300, height: 300,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(colors: [
                        kPrimaryPl.withValues(alpha: 0.4), Colors.transparent,
                      ]),
                    ),
                  ),
                ),
              ]);
            },
          ),

          SafeArea(
            child: FadeTransition(
              opacity: _fadeAnim,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header with radar icon
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
                    child: Row(
                      children: [
                        // Animated radar icon
                        SizedBox(
                          width: 52,
                          height: 52,
                          child: AnimatedBuilder(
                            animation: _radarAnim,
                            builder: (_, _) => Stack(
                              alignment: Alignment.center,
                              children: [
                                // Radar rings
                                ...List.generate(3, (i) {
                                  final progress = (_radarAnim.value - i * 0.3) % 1.0;
                                  final validProgress = progress < 0 ? progress + 1 : progress;
                                  return Container(
                                    width: 16 + validProgress * 36,
                                    height: 16 + validProgress * 36,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: kPrimaryLt.withValues(alpha: (1 - validProgress) * 0.6),
                                        width: 1.5,
                                      ),
                                    ),
                                  );
                                }),
                                Container(
                                  width: 36, height: 36,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: kSurface,
                                    border: Border.all(color: kBorder),
                                    boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.06), blurRadius: 8)],
                                  ),
                                  child: const Icon(Icons.location_on_rounded, color: kPrimaryMid, size: 18),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Find Your Hub',
                                style: GoogleFonts.roboto(fontSize: 22, fontWeight: FontWeight.w700, color: kText, letterSpacing: -0.3),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Select the F2H hub near you',
                                style: GoogleFonts.roboto(fontSize: 13, color: kTextSub),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Search bar
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Container(
                      decoration: BoxDecoration(
                        color: kSurface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: kBorder),
                        boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
                      ),
                      child: TextField(
                        controller: _searchController,
                        onChanged: _filterBranches,
                        style: GoogleFonts.roboto(color: kText, fontSize: 15, fontWeight: FontWeight.w500),
                        decoration: InputDecoration(
                          prefixIcon: const Icon(Icons.search_rounded, color: kMuted, size: 20),
                          hintText: 'Search city or hub name...',
                          hintStyle: GoogleFonts.roboto(color: kMuted, fontSize: 14),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Branch list
                  Expanded(
                    child: _isLoading
                        ? _buildLoadingState()
                        : _errorMessage.isNotEmpty
                            ? _buildErrorState()
                            : _filteredBranches.isEmpty
                                ? _buildEmptyState()
                                : ListView.builder(
                                    padding: const EdgeInsets.symmetric(horizontal: 24),
                                    itemCount: _filteredBranches.length,
                                    itemBuilder: (context, index) =>
                                        _BranchCard(
                                          branch: _filteredBranches[index],
                                          index: index,
                                          onTap: _isSelecting
                                              ? null
                                              : () => _onBranchSelected(_filteredBranches[index]),
                                        ),
                                  ),
                  ),
                ],
              ),
            ),
          ),

          // Full-screen selecting overlay
          if (_isSelecting)
            Container(
              color: Colors.black.withValues(alpha: 0.35),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: kBorder),
                    boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.1), blurRadius: 32)],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AnimatedBuilder(
                        animation: _radarAnim,
                        builder: (_, _) => Stack(
                          alignment: Alignment.center,
                          children: [
                            ...List.generate(3, (i) {
                              final progress = (_radarAnim.value - i * 0.25) % 1.0;
                              final vp = progress < 0 ? progress + 1 : progress;
                              return Container(
                                width: 20 + vp * 60,
                                height: 20 + vp * 60,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: kPrimaryLt.withValues(alpha: (1 - vp) * 0.5),
                                    width: 2,
                                  ),
                                ),
                              );
                            }),
                            const Icon(Icons.my_location_rounded, color: kPrimaryMid, size: 28),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text('Verifying location...', style: GoogleFonts.roboto(color: kText, fontWeight: FontWeight.w600, fontSize: 15)),
                      const SizedBox(height: 4),
                      Text('Checking service area', style: GoogleFonts.roboto(color: kTextSub, fontSize: 13)),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildLoadingState() {
    return Center(
      child: AnimatedBuilder(
        animation: _radarAnim,
        builder: (_, _) => Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                ...List.generate(3, (i) {
                  final progress = (_radarAnim.value - i * 0.28) % 1.0;
                  final vp = progress < 0 ? progress + 1 : progress;
                  return Container(
                    width: 24 + vp * 80,
                    height: 24 + vp * 80,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: kPrimaryLt.withValues(alpha: (1 - vp) * 0.4), width: 2),
                    ),
                  );
                }),
                const Icon(Icons.location_searching_rounded, color: kPrimaryMid, size: 32),
              ],
            ),
            const SizedBox(height: 20),
            Text('Loading hubs...', style: GoogleFonts.roboto(color: kTextSub, fontSize: 14)),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80, height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle, color: kSurface,
                border: Border.all(color: kBorder),
                boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.06), blurRadius: 12)],
              ),
              child: const Icon(Icons.cloud_off_rounded, size: 36, color: kMuted),
            ),
            const SizedBox(height: 20),
            Text(_errorMessage, textAlign: TextAlign.center, style: GoogleFonts.roboto(color: kTextSub, fontSize: 14, height: 1.5)),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: _fetchBranches,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [kPrimaryMid, kPrimary]),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.2), blurRadius: 12, offset: const Offset(0, 4))],
                ),
                child: Text('Try Again', style: GoogleFonts.roboto(color: Colors.white, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Text('No hubs found', style: GoogleFonts.roboto(color: kTextSub, fontSize: 14)),
    );
  }
}

// ─── Branch Card ──────────────────────────────────────────────────────────────
class _BranchCard extends StatefulWidget {
  final dynamic branch;
  final int index;
  final VoidCallback? onTap;
  const _BranchCard({required this.branch, required this.index, this.onTap});

  @override
  State<_BranchCard> createState() => _BranchCardState();
}

class _BranchCardState extends State<_BranchCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final b = widget.branch;
    final name = b['branch_name'] ?? 'Hub';
    final code = b['branch_code'] ?? '—';
    final city = (b['city'] == null || b['city'].toString().trim().isEmpty) ? 'Tirupati' : b['city'];
    final radius = b['delivery_radius_km']?.toString() ?? '15';

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) { setState(() => _pressed = false); widget.onTap?.call(); },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 120),
        child: Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: kBorder),
            boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.05), blurRadius: 16, offset: const Offset(0, 4))],
          ),
          child: Row(
            children: [
              // Hub icon
              Container(
                width: 50, height: 50,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    colors: [kPrimaryMid, kPrimary],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [BoxShadow(color: kPrimary.withValues(alpha: 0.2), blurRadius: 12)],
                ),
                child: const Icon(Icons.storefront_rounded, color: Colors.white, size: 24),
              ),
              const SizedBox(width: 16),
              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: GoogleFonts.roboto(color: kText, fontWeight: FontWeight.w600, fontSize: 15)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.location_city_rounded, color: kTextSub, size: 13),
                        const SizedBox(width: 4),
                        Text(city, style: GoogleFonts.roboto(color: kTextSub, fontSize: 13)),
                        const SizedBox(width: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: kPrimaryPl,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '${radius}km radius',
                            style: GoogleFonts.roboto(color: kPrimaryMid, fontSize: 11, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: kMuted),
            ],
          ),
        ),
      ),
    );
  }
}
