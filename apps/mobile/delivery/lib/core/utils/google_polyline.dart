// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : google_polyline.dart
// Description : Decodes Google Encoded Polylines (5-decimal precision) into
//               latlong2 LatLng coordinates for road rendering.
// ============================================================================

import 'package:latlong2/latlong.dart';

int _pow2(int shift) {
  switch (shift) {
    case 0:
      return 1;
    case 5:
      return 32;
    case 10:
      return 1024;
    case 15:
      return 32768;
    case 20:
      return 1048576;
    case 25:
      return 33554432;
    case 30:
      return 1073741824;
    default:
      return 1 << (shift % 30);
  }
}

int _unZigZag(int result) {
  return (result % 2 != 0) ? -((result + 1) ~/ 2) : (result ~/ 2);
}

/// Decodes a standard Google Encoded Polyline string (precision 1e5).
/// Returns a list of [LatLng] points along the road path.
List<LatLng> decodeGooglePolyline(String encoded) {
  final clean = encoded.trim();
  if (clean.isEmpty) return const [];

  final List<LatLng> points = [];
  int index = 0;
  int lat = 0;
  int lng = 0;

  final codeUnits = clean.codeUnits;
  final length = codeUnits.length;

  while (index < length) {
    int b = 0;
    int shift = 0;
    int result = 0;
    do {
      if (index >= length) break;
      b = codeUnits[index++] - 63;
      result += (b & 0x1f) * _pow2(shift);
      shift += 5;
    } while (b >= 0x20);

    final int dlat = _unZigZag(result);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      if (index >= length) break;
      b = codeUnits[index++] - 63;
      result += (b & 0x1f) * _pow2(shift);
      shift += 5;
    } while (b >= 0x20);

    final int dlng = _unZigZag(result);
    lng += dlng;

    final double latitude = lat / 1e5;
    final double longitude = lng / 1e5;

    if (latitude.isFinite &&
        longitude.isFinite &&
        latitude >= -90.0 &&
        latitude <= 90.0 &&
        longitude >= -180.0 &&
        longitude <= 180.0) {
      points.add(LatLng(latitude, longitude));
    }
  }

  return points;
}

/// Decodes polyline string into a continuous road path.
List<LatLng> decodeGooglePolylineSegments(
  String encodedJoined, {
  String separator = ';',
}) {
  final cleanStr = encodedJoined.trim();
  if (cleanStr.isEmpty) return const [];

  // If there are no segment separators, decode directly as a single continuous polyline
  if (!cleanStr.contains(separator)) {
    return decodeGooglePolyline(cleanStr);
  }

  final segments = cleanStr.split(separator);
  final List<LatLng> allPoints = [];

  for (final seg in segments) {
    final clean = seg.trim();
    if (clean.isEmpty) continue;

    final pts = decodeGooglePolyline(clean);
    if (pts.isEmpty) continue;

    if (allPoints.isNotEmpty) {
      final last = allPoints.last;
      final first = pts.first;
      if ((last.latitude - first.latitude).abs() < 1e-6 &&
          (last.longitude - first.longitude).abs() < 1e-6) {
        allPoints.addAll(pts.skip(1));
      } else {
        allPoints.addAll(pts);
      }
    } else {
      allPoints.addAll(pts);
    }
  }

  return allPoints;
}
