// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : google_polyline.dart
// Description : Decoder for Google's Encoded Polyline Algorithm Format, the
//               wire format the Routes and Directions APIs return road
//               geometry in.
// ============================================================================

import 'package:latlong2/latlong.dart';

/// Separator the API layer uses to concatenate a leg's per-step polylines.
const String kPolylineSegmentSeparator = '|';

/// Decodes one encoded polyline into its road-following coordinate list.
///
/// Coordinates are deltas encoded at precision 5 (1e-5 degrees), each split
/// into 5-bit chunks, so a value is accumulated until a chunk without the
/// continuation bit arrives.
List<LatLng> decodeGooglePolyline(String encoded) {
  if (encoded.isEmpty) return const [];

  final List<LatLng> points = [];
  int index = 0;
  int lat = 0;
  int lng = 0;

  while (index < encoded.length) {
    final latDelta = _decodeValue(encoded, index);
    if (latDelta == null) break;
    index = latDelta.nextIndex;
    lat += latDelta.value;

    final lngDelta = _decodeValue(encoded, index);
    if (lngDelta == null) break;
    index = lngDelta.nextIndex;
    lng += lngDelta.value;

    points.add(LatLng(lat / 1e5, lng / 1e5));
  }

  return points;
}

/// Decodes a `|`-joined run of encoded polylines into one continuous path.
///
/// The legacy Directions API carries geometry per step rather than per leg, so
/// a leg arrives as its steps joined by [kPolylineSegmentSeparator]. Each step
/// starts where the previous ended, so the shared point is dropped on the join.
List<LatLng> decodeGooglePolylineSegments(String encoded) {
  if (encoded.isEmpty) return const [];
  if (!encoded.contains(kPolylineSegmentSeparator)) {
    return decodeGooglePolyline(encoded);
  }

  final List<LatLng> points = [];
  for (final segment in encoded.split(kPolylineSegmentSeparator)) {
    final decoded = decodeGooglePolyline(segment);
    if (decoded.isEmpty) continue;
    if (points.isNotEmpty && _isSamePoint(points.last, decoded.first)) {
      points.addAll(decoded.skip(1));
    } else {
      points.addAll(decoded);
    }
  }
  return points;
}

bool _isSamePoint(LatLng a, LatLng b) {
  return (a.latitude - b.latitude).abs() < 1e-6 &&
      (a.longitude - b.longitude).abs() < 1e-6;
}

class _DecodedValue {
  final int value;
  final int nextIndex;

  const _DecodedValue(this.value, this.nextIndex);
}

/// Returns null when the string ends mid-value, which means the payload was
/// truncated and the points decoded so far are all that can be trusted.
_DecodedValue? _decodeValue(String encoded, int startIndex) {
  int index = startIndex;
  int shift = 0;
  int result = 0;
  int chunk;

  do {
    if (index >= encoded.length) return null;
    chunk = encoded.codeUnitAt(index++) - 63;
    result |= (chunk & 0x1F) << shift;
    shift += 5;
  } while (chunk >= 0x20);

  // The low bit is the sign flag; the rest is the magnitude.
  final value = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
  return _DecodedValue(value, index);
}
