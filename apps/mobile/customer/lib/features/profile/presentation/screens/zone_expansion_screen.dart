import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/di/injection.dart';

// ══════════════════════════════════════════════════════════════════
//  ZONE EXPANSION REQUESTS SCREEN — Customer Profile Screen Option
// ══════════════════════════════════════════════════════════════════

class ZoneExpansionScreen extends StatefulWidget {
  const ZoneExpansionScreen({super.key});

  @override
  State<ZoneExpansionScreen> createState() => _ZoneExpansionScreenState();
}

class _ZoneExpansionScreenState extends State<ZoneExpansionScreen> {
  final DioClient _dioClient = DioClient();
  bool _isLoading = true;
  List<dynamic> _requests = [];

  @override
  void initState() {
    super.initState();
    _fetchRequests();
  }

  Future<void> _fetchRequests() async {
    setState(() => _isLoading = true);
    try {
      final response = await _dioClient.dio.get(ApiEndpoints.zoneExpansionMyRequests);
      if (response.data != null && response.data['status'] == true) {
        setState(() {
          _requests = response.data['data'] ?? [];
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _openMapPicker() async {
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => const ZoneRequestMapPickerScreen(),
      ),
    );

    if (result == true && mounted) {
      _fetchRequests();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: kText, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Zone Expansion Requests',
          style: TextStyle(
            color: kText,
            fontSize: 17,
            fontWeight: FontWeight.w900,
          ),
        ),
        centerTitle: true,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openMapPicker,
        backgroundColor: kPrimary,
        icon: const Icon(Icons.map_rounded, color: Colors.white, size: 20),
        label: const Text(
          'Pin Location on Map',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 13,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : RefreshIndicator(
              onRefresh: _fetchRequests,
              color: kPrimary,
              child: _requests.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                      itemCount: _requests.length,
                      itemBuilder: (context, index) {
                        final req = _requests[index];
                        return _buildRequestCard(req);
                      },
                    ),
            ),
    );
  }

  Widget _buildEmptyState() {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      child: Container(
        padding: const EdgeInsets.all(32),
        alignment: Alignment.center,
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFFDE68A), width: 2),
              ),
              child: const Icon(
                Icons.radar_rounded,
                size: 48,
                color: Color(0xFFD97706),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'No Zone Requests Yet',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: kText,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Looking for delivery in an area outside our current delivery radius?\nPin your location on the map and our team will evaluate expansion to your area!',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: kTextSub,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _openMapPicker,
              icon: const Icon(Icons.pin_drop_rounded, size: 18),
              label: const Text(
                'Pin Location on Map',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 0,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRequestCard(dynamic req) {
    final status = (req['status'] ?? 'pending').toString().toLowerCase();
    final branchName = req['branch_name'] ?? 'Nearest Hub';
    final distKm = req['distance_km'];
    final address = req['address_label'] ?? 'Coordinates (${req['latitude']}, ${req['longitude']})';
    final desc = req['description'];
    final createdAt = req['created_at'] != null ? req['created_at'].toString().split('T').first : '';

    Color statusBg;
    Color statusFg;
    IconData statusIcon;
    String statusLabel;

    switch (status) {
      case 'noted':
        statusBg = const Color(0xFFDCFCE7);
        statusFg = const Color(0xFF15803D);
        statusIcon = Icons.check_circle_rounded;
        statusLabel = 'Noted for Expansion';
        break;
      case 'rejected':
        statusBg = const Color(0xFFFEE2E2);
        statusFg = const Color(0xFFDC2626);
        statusIcon = Icons.cancel_rounded;
        statusLabel = 'Currently Outside Feasibility';
        break;
      default:
        statusBg = const Color(0xFFFEF3C7);
        statusFg = const Color(0xFFB45309);
        statusIcon = Icons.hourglass_top_rounded;
        statusLabel = 'Under Review';
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorderLt, width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(statusIcon, size: 13, color: statusFg),
                    const SizedBox(width: 5),
                    Text(
                      statusLabel,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: statusFg,
                      ),
                    ),
                  ],
                ),
              ),
              if (createdAt.isNotEmpty)
                Text(
                  createdAt,
                  style: const TextStyle(fontSize: 11, color: kTextSub),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on_rounded, size: 16, color: kPrimary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  address,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: kText,
                  ),
                ),
              ),
            ],
          ),
          if (distKm != null || branchName != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: kBgDeep,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.storefront_rounded, size: 13, color: kTextSub),
                  const SizedBox(width: 5),
                  Text(
                    branchName,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: kTextMid),
                  ),
                  if (distKm != null) ...[
                    const SizedBox(width: 8),
                    Text(
                      '• ${(double.tryParse(distKm.toString()) ?? 0).toStringAsFixed(1)} km from hub',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF2563EB)),
                    ),
                  ],
                ],
              ),
            ),
          ],
          if (desc != null && desc.toString().trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Remarks: "${desc.toString().trim()}"',
              style: const TextStyle(
                fontSize: 12,
                fontStyle: FontStyle.italic,
                color: kTextSub,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════
//  INTERACTIVE MAP PIN PICKER SCREEN — Replaces Lat/Long input
// ══════════════════════════════════════════════════════════════════

class ZoneRequestMapPickerScreen extends StatefulWidget {
  const ZoneRequestMapPickerScreen({super.key});

  @override
  State<ZoneRequestMapPickerScreen> createState() => _ZoneRequestMapPickerScreenState();
}

class _ZoneRequestMapPickerScreenState extends State<ZoneRequestMapPickerScreen> {
  final MapController _mapController = MapController();
  final TextEditingController _descController = TextEditingController();

  LatLng _currentLocation = const LatLng(12.9716, 77.5946); // Bangalore fallback
  String _addressLabel = 'Moving map pin...';
  bool _isGeocoding = false;
  bool _isSubmitting = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _initCurrentLocation();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _initCurrentLocation() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
        final pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
        );
        final newPoint = LatLng(pos.latitude, pos.longitude);
        if (mounted) {
          setState(() {
            _currentLocation = newPoint;
          });
          _mapController.move(newPoint, 16.5);
          _reverseGeocode(newPoint.latitude, newPoint.longitude);
        }
        return;
      }
    } catch (_) {}
    _reverseGeocode(_currentLocation.latitude, _currentLocation.longitude);
  }

  Future<void> _moveToCurrentGPS() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        if (mounted) {
          F2HToast.error(context, 'Location permission is required to detect GPS');
        }
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      final pt = LatLng(pos.latitude, pos.longitude);
      _mapController.move(pt, 16.5);
      setState(() => _currentLocation = pt);
      _reverseGeocode(pt.latitude, pt.longitude);
    } catch (e) {
      if (mounted) {
        F2HToast.error(context, 'Could not fetch current GPS location');
      }
    }
  }

  Future<void> _reverseGeocode(double lat, double lng) async {
    if (!mounted) return;
    setState(() => _isGeocoding = true);

    try {
      final dio = sl<DioClient>().dio;
      final response = await dio.get(
        '/map/geocode',
        queryParameters: {'lat': lat, 'lng': lng},
      );
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['status'] == 'OK' && data['results'] != null && (data['results'] as List).isNotEmpty) {
          final formatted = data['results'][0]['formatted_address']?.toString();
          if (formatted != null && mounted) {
            setState(() {
              _addressLabel = formatted;
              _isGeocoding = false;
            });
            return;
          }
        }
      }
    } catch (_) {}

    if (mounted) {
      setState(() {
        _addressLabel = 'Location near ${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
        _isGeocoding = false;
      });
    }
  }

  Future<void> _submitRequest() async {
    setState(() => _isSubmitting = true);
    try {
      final payload = {
        'latitude': _currentLocation.latitude,
        'longitude': _currentLocation.longitude,
        'address_label': _addressLabel.isNotEmpty ? _addressLabel : null,
        'description': _descController.text.trim().isNotEmpty ? _descController.text.trim() : null,
      };

      final dio = sl<DioClient>().dio;
      final res = await dio.post(
        ApiEndpoints.zoneExpansionRequest,
        data: payload,
      );

      if (mounted) {
        Navigator.pop(context, true);
        F2HToast.success(
          context,
          res.data?['message'] ?? 'Zone expansion request submitted! Our team will evaluate coverage for this area.',
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        F2HToast.error(context, extractErrorMessage(e));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: kText, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Pin Location on Map',
          style: TextStyle(
            color: kText,
            fontSize: 17,
            fontWeight: FontWeight.w900,
          ),
        ),
        centerTitle: true,
      ),
      body: Stack(
        children: [
          // ── FlutterMap ──
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _currentLocation,
              initialZoom: 16.5,
              minZoom: 4.0,
              maxZoom: 19.5,
              onPositionChanged: (position, hasGesture) {
                if (hasGesture) {
                  _currentLocation = position.center;
                  _debounce?.cancel();
                  _debounce = Timer(const Duration(milliseconds: 500), () {
                    _reverseGeocode(_currentLocation.latitude, _currentLocation.longitude);
                  });
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
                subdomains: const ['mt0', 'mt1', 'mt2', 'mt3'],
                userAgentPackageName: 'com.f2h.customer',
                maxZoom: 20,
              ),
            ],
          ),

          // ── Center Pin Marker (Fixed in center) ──
          Center(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 38),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD97706),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.25),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.pin_drop_rounded,
                      color: Colors.white,
                      size: 26,
                    ),
                  ),
                  Container(
                    width: 4,
                    height: 8,
                    color: const Color(0xFFB45309),
                  ),
                  Container(
                    width: 10,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Floating GPS Button ──
          Positioned(
            top: 16,
            right: 16,
            child: FloatingActionButton.small(
              heroTag: 'gps_locate_btn',
              onPressed: _moveToCurrentGPS,
              backgroundColor: Colors.white,
              foregroundColor: kPrimary,
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.my_location_rounded, size: 20),
            ),
          ),

          // ── Hint pill ──
          Positioned(
            top: 16,
            left: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.75),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.pan_tool_alt_rounded, color: Colors.white, size: 14),
                  SizedBox(width: 6),
                  Text(
                    'Drag map to position pin',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Bottom Confirmation Card ──
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 20,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.radar_rounded, color: Color(0xFFD97706), size: 20),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Request Zone Coverage',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w900,
                                  color: kText,
                                ),
                              ),
                              Text(
                                'Pin location where you want delivery',
                                style: TextStyle(fontSize: 11, color: kTextSub),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Address Display
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: kBgDeep,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: kBorder),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.location_on_rounded, color: kPrimary, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _isGeocoding
                                ? const Row(
                                    children: [
                                      SizedBox(
                                        width: 14,
                                        height: 14,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary),
                                      ),
                                      SizedBox(width: 8),
                                      Text(
                                        'Resolving address...',
                                        style: TextStyle(fontSize: 12, color: kTextSub),
                                      ),
                                    ],
                                  )
                                : Text(
                                    _addressLabel,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: kText,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Remarks field
                    Container(
                      decoration: BoxDecoration(
                        color: kSurface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: kBorder),
                      ),
                      child: TextField(
                        controller: _descController,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kText),
                        decoration: const InputDecoration(
                          hintText: 'Remarks / Society Name (e.g. 50+ flats in community)',
                          hintStyle: TextStyle(color: kMuted, fontSize: 11),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Submit Button
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _isSubmitting ? null : _submitRequest,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: kPrimary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          elevation: 0,
                        ),
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text(
                                'SUBMIT ZONE REQUEST',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5,
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
    );
  }
}
