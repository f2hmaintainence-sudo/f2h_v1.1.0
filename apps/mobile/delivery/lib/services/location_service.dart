import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_delivery/theme/app_colors.dart';

class LocationService {
  // ─── Location Service & Settings Helpers ──────────────────────
  Future<bool> isLocationServiceEnabled() async {
    try {
      return await Geolocator.isLocationServiceEnabled();
    } catch (_) {
      return false;
    }
  }

  Future<LocationPermission> checkPermission() async {
    try {
      return await Geolocator.checkPermission();
    } catch (_) {
      return LocationPermission.denied;
    }
  }

  Future<LocationPermission> requestPermission() async {
    try {
      return await Geolocator.requestPermission();
    } catch (_) {
      return LocationPermission.denied;
    }
  }

  Future<bool> openLocationSettings() async {
    if (kIsWeb) return false;
    try {
      return await Geolocator.openLocationSettings();
    } catch (_) {
      return false;
    }
  }

  Future<bool> openAppSettings() async {
    if (kIsWeb) return false;
    try {
      return await Geolocator.openAppSettings();
    } catch (_) {
      return false;
    }
  }

  /// Ensures GPS location service and permissions are active.
  /// Shows appropriate UI dialogs with direct links to device Settings when required.
  Future<bool> ensureLocationPermission(BuildContext context) async {
    // 1. Check if GPS / location service is enabled
    bool serviceEnabled = await isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (!context.mounted) return false;
      final wantsToOpen = await showLocationServiceDialog(context);
      if (wantsToOpen == true) {
        await openLocationSettings();
      }
      return false;
    }

    // 2. Check permission state
    LocationPermission permission = await checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await requestPermission();
    }

    if (permission == LocationPermission.deniedForever || permission == LocationPermission.denied) {
      if (!context.mounted) return false;
      final wantsToOpen = await showLocationPermissionDialog(
        context,
        isPermanentlyDenied: permission == LocationPermission.deniedForever,
      );
      if (wantsToOpen == true) {
        await openAppSettings();
      }
      return false;
    }

    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  // ─── UI Bottom Sheet Dialogs for Location & Settings ─────────
  static Future<bool?> showLocationServiceDialog(BuildContext context) {
    return showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        decoration: const BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: kBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: kPrimaryPl,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.location_off_rounded,
                color: kPrimaryMid,
                size: 36,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Location Services Disabled',
              style: GoogleFonts.roboto(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: kText,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              kIsWeb
                  ? 'Please enable GPS / Location in your browser settings to track live delivery location.'
                  : 'Your device GPS is currently switched off. Please enable GPS Location Services in Settings so you can go online and track live delivery routes.',
              textAlign: TextAlign.center,
              style: GoogleFonts.roboto(
                fontSize: 13.5,
                color: kTextSub,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: kTextSub,
                      side: const BorderSide(color: kBorder),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text('Cancel', style: GoogleFonts.roboto(fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => Navigator.pop(ctx, true),
                    icon: const Icon(Icons.settings_outlined, size: 18),
                    label: Text(
                      kIsWeb ? 'Enable GPS' : 'Open Settings',
                      style: GoogleFonts.roboto(fontWeight: FontWeight.w800),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPrimary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static Future<bool?> showLocationPermissionDialog(
    BuildContext context, {
    required bool isPermanentlyDenied,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
        decoration: const BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: kBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.my_location_rounded,
                color: Colors.amber.shade800,
                size: 36,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Location Permission Needed',
              style: GoogleFonts.roboto(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: kText,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              kIsWeb
                  ? 'Please allow browser location permissions to track your active delivery status.'
                  : (isPermanentlyDenied
                      ? 'Location permission is permanently denied for F2H Delivery. Please open App Settings and grant "Allow while using app" or "Allow all the time" to go online.'
                      : 'Delivery partners require precise location access for real-time delivery routing and daily distance payout calculations.'),
              textAlign: TextAlign.center,
              style: GoogleFonts.roboto(
                fontSize: 13.5,
                color: kTextSub,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: kTextSub,
                      side: const BorderSide(color: kBorder),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text('Cancel', style: GoogleFonts.roboto(fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => Navigator.pop(ctx, true),
                    icon: const Icon(Icons.settings_outlined, size: 18),
                    label: Text(
                      'Open Settings',
                      style: GoogleFonts.roboto(fontWeight: FontWeight.w800),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPrimary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ─── Get current GPS position ─────────────────────────────────
  Future<Position?> getCurrentPosition() async {
    bool serviceEnabled = await isLocationServiceEnabled();
    if (!serviceEnabled) return null;

    LocationPermission permission = await checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await requestPermission();
      if (permission == LocationPermission.denied) return null;
    }
    if (permission == LocationPermission.deniedForever) return null;

    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
    } catch (_) {
      return null;
    }
  }

  // ─── Live GPS stream — drives real-time distance and re-routing ─
  /// Emits a new fix once the rider has moved [distanceFilterMeters].
  ///
  /// The filter is what keeps this cheap: without it Android emits a fix per
  /// second and every one of them would invalidate the route cache, so the map
  /// would re-bill Google for a rider standing still at a traffic light.
  Stream<Position> positionStream({int distanceFilterMeters = 15}) {
    return Geolocator.getPositionStream(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: distanceFilterMeters,
      ),
    );
  }

  // ─── Haversine distance (km) — zero API cost ──────────────────
  double haversineDistanceKm(
      double lat1, double lng1, double lat2, double lng2) {
    const R = 6371.0; // Earth radius km
    final dLat = _toRad(lat2 - lat1);
    final dLng = _toRad(lng2 - lng1);
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRad(lat1)) *
            cos(_toRad(lat2)) *
            sin(dLng / 2) *
            sin(dLng / 2);
    return R * 2 * atan2(sqrt(a), sqrt(1 - a));
  }

  double _toRad(double deg) => deg * pi / 180;

  // ─── Open Google Maps navigation (deep link — zero API cost) ──
  // Uses native Maps app intent → no Maps SDK, no Directions API
  Future<void> openNavigation(double destLat, double destLng) async {
    // Android: opens Google Maps turn-by-turn navigation
    final googleMapsUri =
        Uri.parse('google.navigation:q=$destLat,$destLng&mode=d');

    // Web fallback (works on iOS without Google Maps installed too)
    final webFallback = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=$destLat,$destLng&travelmode=driving');

    if (await canLaunchUrl(googleMapsUri)) {
      await launchUrl(googleMapsUri);
    } else {
      await launchUrl(webFallback, mode: LaunchMode.externalApplication);
    }
  }

  // ─── Open phone dialer ────────────────────────────────────────
  Future<void> callPhone(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }
}
