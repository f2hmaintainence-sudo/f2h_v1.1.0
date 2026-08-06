import 'dart:math';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

class LocationService {
  // ─── Get current GPS position ─────────────────────────────────
  Future<Position?> getCurrentPosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return null;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return null;
    }
    if (permission == LocationPermission.deniedForever) return null;

    try {
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
    } catch (_) {
      return null;
    }
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
