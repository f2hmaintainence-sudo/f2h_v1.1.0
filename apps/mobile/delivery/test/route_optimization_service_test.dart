import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/services/route_optimization_service.dart';

/// Captured from a live Google Directions response for a 302 m run in
/// Bengaluru — the same shape the API's legacy fallback returns.
const _overviewPolyline =
    'qodnAwdrxMw@KICWbAMh@KNKIJKNk@ZgAHId@qAWIQM]K';
const _leg0Polyline =
    'qodnAwdrxMMAYEIAEAIC;sqdnAgerxMWbAMh@;yrdnAyarxMKNKIJKLg@@CX_A@GBCDEBGPg@JWBI;'
    'ipdnAohrxMQGCAA?A@;cqdnAwhrxMOO]K';

class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this.payload);

  final Map<String, dynamic> payload;
  Map<String, dynamic>? lastRequestBody;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final raw = options.data;
    lastRequestBody = jsonDecode(raw is String ? raw : jsonEncode(raw))
        as Map<String, dynamic>;
    return ResponseBody.fromString(
      jsonEncode(payload),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

GroupedStop _stop({
  required String id,
  required double lat,
  required double lng,
  required int number,
  String status = 'pending',
}) {
  return GroupedStop(
    customerId: 'cust-$id',
    addressId: id,
    customerName: 'Customer $id',
    customerPhone: '9000000000',
    address: 'Address $id',
    addressLat: lat,
    addressLng: lng,
    stop: number,
    deliverySlot: 'morning',
    orders: [
      DeliveryOrderModel.fromJson({'order_id': 'ord-$id', 'status': status}),
    ],
  );
}

({RouteOptimizationService service, _StubAdapter adapter}) build(
  Map<String, dynamic> payload,
) {
  final adapter = _StubAdapter(payload);
  final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'))
    ..httpClientAdapter = adapter;
  return (
    service: RouteOptimizationService(
      locationService: LocationService(),
      dio: dio,
    ),
    adapter: adapter,
  );
}

Map<String, dynamic> okPayload({
  String polyline = _overviewPolyline,
  String legPolyline = _leg0Polyline,
  int distanceMeters = 302,
  List<int> optimizedOrder = const [],
}) {
  return {
    'status': 'OK',
    'provider': 'google-directions',
    'distanceMeters': distanceMeters,
    'durationSeconds': 159,
    'polyline': polyline,
    'optimizedOrder': optimizedOrder,
    'legs': [
      {
        'distanceMeters': distanceMeters,
        'durationSeconds': 159,
        'polyline': legPolyline,
      },
    ],
  };
}

void main() {
  final rider = LatLng(12.9716, 77.5946);

  group('fetchShortestPathRoute', () {
    test('maps a real Google payload into road geometry that stays local', () async {
      final built = build(okPayload());

      final result = await built.service.fetchShortestPathRoute(
        currentPosition: rider,
        stops: [_stop(id: 'a', lat: 12.9724, lng: 77.5951, number: 1)],
      );

      expect(result.status, RouteStatus.ok);
      expect(result.hasRoute, isTrue);
      expect(result.totalDistanceKm, closeTo(0.302, 1e-9));
      expect(result.provider, 'google-directions');

      // Every drawn point must sit on the same city block as the rider.
      for (final p in [
        ...result.fullRoutePoints,
        ...result.activeLegPoints,
      ]) {
        expect(p.latitude, closeTo(12.972, 0.01));
        expect(p.longitude, closeTo(77.595, 0.01));
      }
      expect(result.activeLegPoints.length, greaterThan(2));
    });

    test('sends the rider as origin and the stop as destination', () async {
      final built = build(okPayload());

      await built.service.fetchShortestPathRoute(
        currentPosition: rider,
        stops: [_stop(id: 'a', lat: 12.9724, lng: 77.5951, number: 1)],
      );

      final body = built.adapter.lastRequestBody!;
      expect(body['origin'], {'lat': 12.9716, 'lng': 77.5946});
      expect(body['destination'], {'lat': 12.9724, 'lng': 77.5951});
      expect(body['intermediates'], isEmpty);
      expect(body['travelMode'], 'TWO_WHEELER');
    });

    test('refuses geometry that spans further than the reported distance', () async {
      // Same 302 m route, but the geometry reaches Siberia. Drawing this is
      // what put a straight line up the map instead of a road.
      const corrupt = 'qodnAwdrxM_ibE?';
      final built = build(okPayload(polyline: corrupt, legPolyline: corrupt));

      final result = await built.service.fetchShortestPathRoute(
        currentPosition: rider,
        stops: [_stop(id: 'a', lat: 12.9724, lng: 77.5951, number: 1)],
      );

      expect(result.status, RouteStatus.unavailable);
      expect(result.hasRoute, isFalse);
      expect(result.fullRoutePoints, isEmpty);
      expect(result.unavailableReason, contains('inconsistent'));
    });

    test('never routes to an un-geocoded (0,0) stop', () async {
      final built = build(okPayload());

      final result = await built.service.fetchShortestPathRoute(
        currentPosition: rider,
        stops: [
          _stop(id: 'a', lat: 0, lng: 0, number: 1),
          _stop(id: 'b', lat: 12.9724, lng: 77.5951, number: 2),
        ],
      );

      final body = built.adapter.lastRequestBody!;
      expect(body['destination'], {'lat': 12.9724, 'lng': 77.5951});
      expect(body['intermediates'], isEmpty);
      expect(result.hasRoute, isTrue);
    });

    test('reports unavailable instead of drawing a line when Google fails', () async {
      final built = build({'status': 'ZERO_RESULTS', 'message': 'No drivable route'});

      final result = await built.service.fetchShortestPathRoute(
        currentPosition: rider,
        stops: [_stop(id: 'a', lat: 12.9724, lng: 77.5951, number: 1)],
      );

      expect(result.status, RouteStatus.unavailable);
      expect(result.activeLegPoints, isEmpty);
      expect(result.remainingRoutePoints, isEmpty);
      expect(result.unavailableReason, 'No drivable route');
    });
  });
}
