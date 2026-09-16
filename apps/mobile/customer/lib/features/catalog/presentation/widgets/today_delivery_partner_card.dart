import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/features/catalog/data/models/today_delivery_partner_model.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/core/api/dio_client.dart';

class TodayDeliveryPartnerCard extends StatefulWidget {
  final TodayDeliveryPartner partner;
  final EdgeInsetsGeometry? margin;

  const TodayDeliveryPartnerCard({
    required this.partner,
    this.margin,
    super.key,
  });

  @override
  State<TodayDeliveryPartnerCard> createState() => _TodayDeliveryPartnerCardState();
}

class _TodayDeliveryPartnerCardState extends State<TodayDeliveryPartnerCard> {
  late TodayDeliveryPartner _partner;
  late final MapController _mapController;
  Timer? _pollingTimer;
  double? _currentLat;
  double? _currentLng;
  String? _lastUpdatedTime;
  bool _isLocating = false;

  // Default fallback center (Bengaluru)
  static const LatLng _defaultCenter = LatLng(12.9716, 77.5946);

  @override
  void initState() {
    super.initState();
    _partner = widget.partner;
    _mapController = MapController();
    _currentLat = widget.partner.latitude;
    _currentLng = widget.partner.longitude;
    _lastUpdatedTime = widget.partner.lastLocationAt;

    _startLocationPolling();
  }

  @override
  void didUpdateWidget(TodayDeliveryPartnerCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.partner.partnerId != oldWidget.partner.partnerId ||
        widget.partner.latitude != oldWidget.partner.latitude ||
        widget.partner.longitude != oldWidget.partner.longitude) {
      _partner = widget.partner;
      if (widget.partner.latitude != null && widget.partner.longitude != null) {
        _currentLat = widget.partner.latitude;
        _currentLng = widget.partner.longitude;
        _lastUpdatedTime = widget.partner.lastLocationAt;
        _animateToCurrentLocation();
      }
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _mapController.dispose();
    super.dispose();
  }

  void _startLocationPolling() {
    // Initial fetch if coordinates not loaded yet
    if (_currentLat == null || _currentLng == null) {
      _fetchLiveLocation();
    }

    // Periodic live telemetry refresh every 12 seconds
    _pollingTimer = Timer.periodic(const Duration(seconds: 12), (_) {
      _fetchLiveLocation();
    });
  }

  Future<void> _fetchLiveLocation() async {
    final partnerId = _partner.partnerId.trim();
    if (partnerId.isEmpty || _isLocating) return;

    try {
      _isLocating = true;
      final dio = sl<DioClient>().dio;
      final response = await dio.get(
        '/customer/today-delivery-partners/$partnerId/location',
      );

      if (response.statusCode == 200 && response.data != null) {
        final body = response.data;
        if (body['status'] == true && body['data'] != null) {
          final data = body['data'];
          final lat = double.tryParse(data['latitude']?.toString() ?? '');
          final lng = double.tryParse(data['longitude']?.toString() ?? '');

          if (lat != null && lng != null && mounted) {
            final hasChanged = lat != _currentLat || lng != _currentLng;
            setState(() {
              _currentLat = lat;
              _currentLng = lng;
              _lastUpdatedTime = data['last_location_at']?.toString();
            });

            if (hasChanged) {
              _animateToCurrentLocation();
            }
          }
        }
      }
    } catch (_) {
      // Deliberately tolerated: Network polling failure falls back to cached location
    } finally {
      _isLocating = false;
    }
  }

  void _animateToCurrentLocation() {
    if (_currentLat != null && _currentLng != null) {
      try {
        _mapController.move(LatLng(_currentLat!, _currentLng!), 15.5);
      } catch (_) {}
    }
  }

  Future<void> _callPartner(String phone) async {
    final cleanPhone = phone.replaceAll(RegExp(r'[^\d+]'), '');
    if (cleanPhone.isEmpty) return;
    final uri = Uri.parse('tel:$cleanPhone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  String _formatPhone(String phone) {
    final clean = phone.trim();
    if (clean.length == 10) {
      return '+91 ${clean.substring(0, 5)} ${clean.substring(5)}';
    }
    return clean;
  }

  LatLng get _effectiveCoordinates {
    if (_currentLat != null &&
        _currentLng != null &&
        _currentLat != 0 &&
        _currentLng != 0) {
      return LatLng(_currentLat!, _currentLng!);
    }
    return _defaultCenter;
  }

  bool get _hasLiveCoordinates =>
      _currentLat != null &&
      _currentLng != null &&
      _currentLat != 0 &&
      _currentLng != 0;

  void _openLiveTrackingSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _PartnerLiveTrackingSheet(
        partner: _partner,
        currentLat: _currentLat,
        currentLng: _currentLng,
        lastUpdatedTime: _lastUpdatedTime,
        onCallPartner: _callPartner,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // After stop is delivered, don't show partner details
    if (_partner.deliveryStatus.toLowerCase() == 'delivered' ||
        (_partner.addresses.isNotEmpty &&
            _partner.addresses.every((a) => a.deliveryStatus.toLowerCase() == 'delivered'))) {
      return const SizedBox.shrink();
    }

    final hasPhone = _partner.phone.trim().isNotEmpty;
    final targetPoint = _effectiveCoordinates;
    final hasLive = _hasLiveCoordinates;

    return Container(
      margin: widget.margin ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF16A34A).withValues(alpha: 0.22),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF16A34A).withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Partner Profile Header (Avatar, Name, Phone & Call Button) ──
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Partner Avatar / Icon
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF15803D), Color(0xFF16A34A)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF16A34A).withValues(alpha: 0.28),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Center(
                      child: _partner.profilePhoto != null &&
                              _partner.profilePhoto!.trim().isNotEmpty &&
                              _partner.profilePhoto != 'null' &&
                              !_partner.profilePhoto!.endsWith('/null')
                          ? ClipOval(
                              child: Image.network(
                                _partner.profilePhoto!,
                                width: 46,
                                height: 46,
                                fit: BoxFit.cover,
                                errorBuilder: (ctx, err, stack) => Text(
                                  _partner.partnerName.trim().isNotEmpty
                                      ? _partner.partnerName.trim()[0].toUpperCase()
                                      : 'P',
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            )
                          : Text(
                              _partner.partnerName.trim().isNotEmpty
                                  ? _partner.partnerName.trim()[0].toUpperCase()
                                  : 'P',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Partner Info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _partner.partnerName,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            color: kText,
                            letterSpacing: -0.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        if (hasPhone)
                          Row(
                            children: [
                              const Icon(
                                Icons.phone_android_rounded,
                                size: 12.5,
                                color: Color(0xFF16653A),
                              ),
                              const SizedBox(width: 3),
                              Text(
                                _formatPhone(_partner.phone),
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF16653A),
                                ),
                              ),
                            ],
                          )
                        else
                          const Text(
                            'Delivery Partner Assigned',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: kTextSub,
                            ),
                          ),
                      ],
                    ),
                  ),

                  // Call Action Button
                  if (hasPhone) ...[
                    const SizedBox(width: 8),
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => _callPartner(_partner.phone),
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 8.5,
                          ),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF15803D), Color(0xFF16A34A)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF16A34A).withValues(alpha: 0.35),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.phone_rounded,
                                size: 14,
                                color: Colors.white,
                              ),
                              SizedBox(width: 5),
                              Text(
                                'Call',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // ── Partner Real-Time Location Map ──
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 2, 12, 12),
              child: Container(
                height: 155,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFFE2E8F0),
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Stack(
                    children: [
                      // Embedded FlutterMap
                      FlutterMap(
                        mapController: _mapController,
                        options: MapOptions(
                          initialCenter: targetPoint,
                          initialZoom: 15.5,
                          interactionOptions: const InteractionOptions(
                            flags: InteractiveFlag.none,
                          ),
                        ),
                        children: [
                          TileLayer(
                            urlTemplate: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
                            subdomains: const ['mt0', 'mt1', 'mt2', 'mt3'],
                            userAgentPackageName: 'com.f2h.customer',
                            maxZoom: 20,
                          ),
                          MarkerLayer(
                            markers: [
                              Marker(
                                point: targetPoint,
                                width: 50,
                                height: 50,
                                child: _DeliveryPartnerMarker(isLive: hasLive),
                              ),
                            ],
                          ),
                        ],
                      ),

                      // Transparent Tap Area to open full interactive sheet
                      Positioned.fill(
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () => _openLiveTrackingSheet(context),
                          ),
                        ),
                      ),

                      // Floating Live Status Badge (Top-Left)
                      Positioned(
                        top: 8,
                        left: 8,
                        child: IgnorePointer(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 9,
                              vertical: 4.5,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.94),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: hasLive
                                    ? const Color(0xFF16A34A).withValues(alpha: 0.3)
                                    : const Color(0xFFD97706).withValues(alpha: 0.3),
                                width: 0.8,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: hasLive
                                        ? const Color(0xFF16A34A)
                                        : const Color(0xFFD97706),
                                    boxShadow: hasLive
                                        ? [
                                            BoxShadow(
                                              color: const Color(0xFF16A34A).withValues(alpha: 0.6),
                                              blurRadius: 4,
                                              spreadRadius: 1,
                                            ),
                                          ]
                                        : null,
                                  ),
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  hasLive ? 'Live Partner Location' : 'Locating Partner...',
                                  style: TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w800,
                                    color: hasLive
                                        ? const Color(0xFF15803D)
                                        : const Color(0xFFB45309),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),

                      // Floating Expand Fullscreen Button (Bottom-Right)
                      Positioned(
                        bottom: 8,
                        right: 8,
                        child: Material(
                          color: Colors.white.withValues(alpha: 0.94),
                          shape: const CircleBorder(),
                          elevation: 2,
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: () => _openLiveTrackingSheet(context),
                            child: const Padding(
                              padding: EdgeInsets.all(7.5),
                              child: Icon(
                                Icons.fullscreen_rounded,
                                size: 18,
                                color: Color(0xFF0F172A),
                              ),
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
}

// ── Custom Styled Animated Partner Marker ──
class _DeliveryPartnerMarker extends StatelessWidget {
  final bool isLive;

  const _DeliveryPartnerMarker({required this.isLive});

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Pulsing radar ripple ring
        if (isLive)
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFF16A34A).withValues(alpha: 0.20),
            ),
          ),

        // Pin body
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF15803D), Color(0xFF16A34A)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.2),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF16A34A).withValues(alpha: 0.45),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: const Center(
            child: Icon(
              Icons.two_wheeler_rounded,
              size: 20,
              color: Colors.white,
            ),
          ),
        ),
      ],
    );
  }
}

// ── Full-Screen Interactive Live Tracking Sheet ──
class _PartnerLiveTrackingSheet extends StatefulWidget {
  final TodayDeliveryPartner partner;
  final double? currentLat;
  final double? currentLng;
  final String? lastUpdatedTime;
  final Function(String phone) onCallPartner;

  const _PartnerLiveTrackingSheet({
    required this.partner,
    required this.currentLat,
    required this.currentLng,
    required this.lastUpdatedTime,
    required this.onCallPartner,
  });

  @override
  State<_PartnerLiveTrackingSheet> createState() => _PartnerLiveTrackingSheetState();
}

class _PartnerLiveTrackingSheetState extends State<_PartnerLiveTrackingSheet> {
  late final MapController _sheetMapController;
  double? _liveLat;
  double? _liveLng;
  Timer? _pollingTimer;

  static const LatLng _defaultCenter = LatLng(12.9716, 77.5946);

  @override
  void initState() {
    super.initState();
    _sheetMapController = MapController();
    _liveLat = widget.currentLat;
    _liveLng = widget.currentLng;

    // Refresh every 8 seconds while sheet is open
    _pollingTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      _pollLocation();
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _sheetMapController.dispose();
    super.dispose();
  }

  Future<void> _pollLocation() async {
    final partnerId = widget.partner.partnerId.trim();
    if (partnerId.isEmpty) return;

    try {
      final dio = sl<DioClient>().dio;
      final res = await dio.get('/customer/today-delivery-partners/$partnerId/location');
      if (res.statusCode == 200 && res.data != null && res.data['status'] == true) {
        final loc = res.data['data'];
        final lat = double.tryParse(loc['latitude']?.toString() ?? '');
        final lng = double.tryParse(loc['longitude']?.toString() ?? '');
        if (lat != null && lng != null && mounted) {
          setState(() {
            _liveLat = lat;
            _liveLng = lng;
          });
        }
      }
    } catch (_) {}
  }

  void _recenterMap() {
    if (_liveLat != null && _liveLng != null) {
      _sheetMapController.move(LatLng(_liveLat!, _liveLng!), 16.5);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasPhone = widget.partner.phone.trim().isNotEmpty;
    final hasCoords = _liveLat != null && _liveLng != null && _liveLat != 0 && _liveLng != 0;
    final point = hasCoords ? LatLng(_liveLat!, _liveLng!) : _defaultCenter;

    return Container(
      height: MediaQuery.of(context).size.height * 0.78,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag Handle
          const SizedBox(height: 10),
          Center(
            child: Container(
              width: 44,
              height: 4.5,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Row(
              children: [
                // Partner Avatar
                Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF15803D), Color(0xFF16A34A)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      widget.partner.partnerName.trim().isNotEmpty
                          ? widget.partner.partnerName.trim()[0].toUpperCase()
                          : 'P',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),

                // Name & Status
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.partner.partnerName,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: kText,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Container(
                            width: 6.5,
                            height: 6.5,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Color(0xFF16A34A),
                            ),
                          ),
                          const SizedBox(width: 5),
                          const Text(
                            'Real-Time Partner Tracking',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF16A34A),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Call Partner
                if (hasPhone)
                  IconButton.filled(
                    onPressed: () => widget.onCallPartner(widget.partner.phone),
                    icon: const Icon(Icons.phone_rounded, color: Colors.white, size: 18),
                    style: IconButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      padding: const EdgeInsets.all(10),
                    ),
                  ),

                IconButton(
                  icon: const Icon(Icons.close_rounded, color: kTextSub, size: 22),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Map Area
          Expanded(
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _sheetMapController,
                  options: MapOptions(
                    initialCenter: point,
                    initialZoom: 16.0,
                    minZoom: 4.0,
                    maxZoom: 19.5,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
                      subdomains: const ['mt0', 'mt1', 'mt2', 'mt3'],
                      userAgentPackageName: 'com.f2h.customer',
                      maxZoom: 20,
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: point,
                          width: 54,
                          height: 54,
                          child: _DeliveryPartnerMarker(isLive: hasCoords),
                        ),
                      ],
                    ),
                  ],
                ),

                // Floating Re-Center Button
                Positioned(
                  bottom: 20,
                  right: 18,
                  child: FloatingActionButton.small(
                    onPressed: _recenterMap,
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF0F172A),
                    elevation: 3,
                    child: const Icon(Icons.my_location_rounded, size: 20),
                  ),
                ),

                // Top Info Bar
                Positioned(
                  top: 12,
                  left: 14,
                  right: 14,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.08),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.radar_rounded,
                          size: 16,
                          color: Color(0xFF16A34A),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            hasCoords
                                ? 'Live GPS telemetry active · Updates continuously'
                                : 'Partner GPS signal locating...',
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF334155),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Today Delivery Partners Section (Parent Container) ──
class TodayDeliveryPartnersSection extends StatelessWidget {
  final List<TodayDeliveryPartner> partners;

  const TodayDeliveryPartnersSection({
    required this.partners,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    if (partners.isEmpty) return const SizedBox.shrink();

    // After stop is delivered, don't show partner details
    final undeliveredPartners = partners.where((p) {
      if (p.deliveryStatus.toLowerCase() == 'delivered') return false;
      if (p.addresses.isNotEmpty &&
          p.addresses.every((a) => a.deliveryStatus.toLowerCase() == 'delivered')) {
        return false;
      }
      return true;
    }).toList();

    if (undeliveredPartners.isEmpty) return const SizedBox.shrink();

    // Sort partners so that active or current slot partner is placed first
    final sortedPartners = List<TodayDeliveryPartner>.from(undeliveredPartners);
    sortedPartners.sort((a, b) {
      if (a.isCurrentSlot && !b.isCurrentSlot) return -1;
      if (!a.isCurrentSlot && b.isCurrentSlot) return 1;
      return 0;
    });

    if (sortedPartners.length == 1) {
      return TodayDeliveryPartnerCard(partner: sortedPartners.first);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: sortedPartners
          .map((partner) => TodayDeliveryPartnerCard(partner: partner))
          .toList(),
    );
  }
}
