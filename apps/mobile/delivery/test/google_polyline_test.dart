import 'package:flutter_test/flutter_test.dart';
import 'package:f2h_delivery/core/utils/google_polyline.dart';

void main() {
  group('decodeGooglePolyline', () {
    test('decodes the reference polyline from Google\'s specification', () {
      // `_p~iF~ps|U_ulLnnqC_mqNvxq`@` is the worked example in the Encoded
      // Polyline Algorithm Format docs.
      final points = decodeGooglePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');

      expect(points.length, 3);
      expect(points[0].latitude, closeTo(38.5, 1e-5));
      expect(points[0].longitude, closeTo(-120.2, 1e-5));
      expect(points[1].latitude, closeTo(40.7, 1e-5));
      expect(points[1].longitude, closeTo(-120.95, 1e-5));
      expect(points[2].latitude, closeTo(43.252, 1e-5));
      expect(points[2].longitude, closeTo(-126.453, 1e-5));
    });

    test('returns nothing for an empty payload', () {
      expect(decodeGooglePolyline(''), isEmpty);
    });

    test('keeps the points decoded before a truncated payload ends', () {
      final full = decodeGooglePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
      // Cut mid-value: the last coordinate pair can no longer be completed.
      final truncated = decodeGooglePolyline('_p~iF~ps|U_ulLnnqC_mqN');

      expect(truncated.length, 2);
      expect(truncated[1].latitude, closeTo(full[1].latitude, 1e-9));
    });
  });

  group('decodeGooglePolylineSegments', () {
    // Two consecutive legs of the same path: segment B starts exactly where
    // segment A ends, which is how the legacy Directions API emits steps.
    const segmentA = '_p~iF~ps|U_ulLnnqC';
    const segmentB = '_flwFn`faV_mqNvxq`@';

    test('joins segments and drops the point they share', () {
      final joined = decodeGooglePolylineSegments('$segmentA;$segmentB');

      expect(decodeGooglePolyline(segmentA).length, 2);
      expect(decodeGooglePolyline(segmentB).length, 2);
      // 2 + 2 with the shared junction counted once.
      expect(joined.length, 3);
      expect(joined[2].latitude, closeTo(43.252, 1e-5));
      expect(joined[2].longitude, closeTo(-126.453, 1e-5));
    });

    test('decodes a lone segment whose payload contains a pipe character', () {
      // `|` is ASCII 124 and appears inside real encoded geometry, so it must
      // never be treated as a separator.
      expect(segmentA.contains('|'), isTrue);
      expect(decodeGooglePolylineSegments(segmentA).length, 2);
    });

    test('falls back to a plain decode when there is no separator', () {
      final points =
          decodeGooglePolylineSegments('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
      expect(points.length, 3);
    });

    test('skips empty segments', () {
      expect(decodeGooglePolylineSegments(';;').length, 0);
      expect(decodeGooglePolylineSegments('$segmentA;;$segmentB').length, 3);
    });
  });
}
