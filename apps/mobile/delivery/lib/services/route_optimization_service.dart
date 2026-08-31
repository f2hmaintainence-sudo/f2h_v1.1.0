// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : route_optimization_service.dart
// Description : Builds the delivery run's driving route from Google's road
//               routing engine, via the API's /map/directions proxy.
// ============================================================================

import 'package:dio/dio.dart';
import 'package:latlong2/latlong.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/utils/dev_log.dart';
import 'package:f2h_delivery/core/utils/google_polyline.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';

/// The outcome of a routing attempt.
///
/// `unavailable` is a real, displayable state rather than a silent zero: when
/// Google cannot be reached there is no honest driving route to draw, and a
/// straight line between stops would show the rider a road that does not exist.
enum RouteStatus { ok, unavailable }

class OptimizedRouteResult {
  final List<GroupedStop> orderedStops;

  /// Road geometry from the rider to the next stop.
  final List<LatLng> activeLegPoints;

  /// Road geometry from the next stop through the rest of the run.
  final List<LatLng> remainingRoutePoints;

  /// Road geometry for the whole run, used for camera fitting.
  final List<LatLng> fullRoutePoints;

  final double totalDistanceKm;
  final double totalDurationMinutes;
  final double activeLegDistanceKm;
  final double activeLegDurationMinutes;

  /// True only when the points above came back from Google as road geometry.
  final bool isRoadGeometry;

  final RouteStatus status;

  /// Why routing failed, shown to the rider so a blank map is explainable.
  final String? unavailableReason;

  /// Which Google engine answered — useful when diagnosing ETA quality.
  final String? provider;

  const OptimizedRouteResult({
    required this.orderedStops,
    required this.activeLegPoints,
    required this.remainingRoutePoints,
    required this.fullRoutePoints,
    required this.totalDistanceKm,
    required this.totalDurationMinutes,
    required this.activeLegDistanceKm,
    required this.activeLegDurationMinutes,
    this.isRoadGeometry = false,
    this.status = RouteStatus.ok,
    this.unavailableReason,
    this.provider,
  });

  /// A result carrying the stop list but no drawable route.
  factory OptimizedRouteResult.unavailable({
    required List<GroupedStop> orderedStops,
    String? reason,
  }) {
    return OptimizedRouteResult(
      orderedStops: orderedStops,
      activeLegPoints: const [],
      remainingRoutePoints: const [],
      fullRoutePoints: const [],
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      activeLegDistanceKm: 0,
      activeLegDurationMinutes: 0,
      isRoadGeometry: false,
      status: reason == null ? RouteStatus.ok : RouteStatus.unavailable,
      unavailableReason: reason,
    );
  }

  bool get hasRoute => isRoadGeometry && fullRoutePoints.length >= 2;
}

/// Deliveries run on two-wheelers, which Google routes differently from cars —
/// it allows narrow links a car cannot use and applies two-wheeler speeds.
const String _kTravelMode = 'TWO_WHEELER';

/// Guards against re-billing the same route when the map screen rebuilds or the
/// session reloads without anything actually moving.
const Duration _kResultCacheTtl = Duration(seconds: 45);

/// ~11 m. Below this the rider has not moved enough to change the road route.
const int _kOriginKeyPrecision = 4;

/// Tolerance on the geometry-versus-distance check, absorbing rounding and the
/// simplification Google applies to an overview polyline.
const double _kGeometrySlackKm = 1.0;

class RouteOptimizationService {
  final LocationService _locationService;
  final Dio _dio;

  String? _cacheKey;
  OptimizedRouteResult? _cachedResult;
  DateTime? _cachedAt;

  RouteOptimizationService({
    required LocationService locationService,
    required Dio dio,
  })  : _locationService = locationService,
        _dio = dio;

  /// Orders stops by straight-line proximity.
  ///
  /// This is a *list* ordering used only while a real route is unavailable, so
  /// the rider still sees a sensible next stop. It never produces the drawn
  /// route or the displayed distance and ETA — those come from Google.
  List<GroupedStop> computeShortestStopSequence({
    required LatLng? currentPosition,
    required List<GroupedStop> stops,
  }) {
    if (stops.length <= 1) return List.from(stops);

    final pending = stops.where(_isPending).toList();
    final completed = stops.where((s) => !_isPending(s)).toList();
    if (pending.isEmpty) return List.from(stops);

    final List<GroupedStop> ordered = [];
    final List<GroupedStop> unvisited = List.from(pending);

    LatLng current = currentPosition ??
        LatLng(unvisited.first.addressLat, unvisited.first.addressLng);

    while (unvisited.isNotEmpty) {
      int bestIdx = 0;
      double minDistance = double.infinity;

      for (int i = 0; i < unvisited.length; i++) {
        final s = unvisited[i];
        if (!_hasValidCoords(s)) continue;
        final d = _locationService.haversineDistanceKm(
          current.latitude,
          current.longitude,
          s.addressLat,
          s.addressLng,
        );
        if (d < minDistance) {
          minDistance = d;
          bestIdx = i;
        }
      }

      final nearest = unvisited.removeAt(bestIdx);
      ordered.add(nearest);
      if (_hasValidCoords(nearest)) {
        current = LatLng(nearest.addressLat, nearest.addressLng);
      }
    }

    ordered.addAll(completed);
    return ordered;
  }

  /// Fetches the drivable route for the run from Google.
  ///
  /// Google both draws the roads and decides the visiting order: the request
  /// asks it to optimise the intermediate stops for travel time under live
  /// traffic. The final stop stays where the run plan put it, because Google
  /// optimises between a fixed origin and destination.
  ///
  /// When routing fails the result carries the stop list with no geometry and
  /// [RouteStatus.unavailable] — the caller shows a retry instead of a fake road.
  Future<OptimizedRouteResult> fetchShortestPathRoute({
    required LatLng? currentPosition,
    required List<GroupedStop> stops,
    bool forceRefresh = false,
  }) async {
    final pending = stops.where((s) => _isPending(s) && _hasValidCoords(s)).toList();
    final completed = stops.where((s) => !_isPending(s)).toList();

    if (pending.isEmpty) {
      return OptimizedRouteResult.unavailable(orderedStops: List.from(stops));
    }

    final LatLng? origin = _isValidPosition(currentPosition)
        ? currentPosition
        : LatLng(pending.first.addressLat, pending.first.addressLng);

    final initialOrdered = computeShortestStopSequence(
      currentPosition: origin,
      stops: pending,
    );

    // Without a fix the rider's own position cannot start the route, so the
    // first stop stands in as the origin and is not itself routed to.
    final bool originIsRider = _isValidPosition(currentPosition);
    final List<GroupedStop> routable =
        originIsRider ? initialOrdered : initialOrdered.sublist(1);

    if (routable.isEmpty) {
      return OptimizedRouteResult.unavailable(
        orderedStops: [...initialOrdered, ...completed],
        reason: 'Waiting for your location to draw the route',
      );
    }

    final cacheKey = _buildCacheKey(origin!, routable);
    if (!forceRefresh && _isCacheFresh(cacheKey)) return _cachedResult!;

    final destination = routable.last;
    final intermediates = routable.sublist(0, routable.length - 1);

    Map<String, dynamic>? data;
    try {
      final response = await _dio.post(
        ApiEndpoints.mapDirections,
        data: {
          'origin': {'lat': origin.latitude, 'lng': origin.longitude},
          'destination': {
            'lat': destination.addressLat,
            'lng': destination.addressLng,
          },
          'intermediates': intermediates
              .map((s) => {'lat': s.addressLat, 'lng': s.addressLng})
              .toList(),
          'optimizeWaypointOrder': intermediates.isNotEmpty,
          'travelMode': _kTravelMode,
        },
      );
      final body = response.data;
      if (body is Map) data = Map<String, dynamic>.from(body);
    } on DioException catch (e) {
      return _unavailable(
        currentPosition: currentPosition,
        stops: stops,
        reason: e.type == DioExceptionType.connectionError
            ? 'No connection — route will load when you are back online'
            : 'Could not reach the routing service',
      );
    } catch (_) {
      return _unavailable(
        currentPosition: currentPosition,
        stops: stops,
        reason: 'Could not reach the routing service',
      );
    }

    if (data == null || data['status'] != 'OK') {
      return _unavailable(
        currentPosition: currentPosition,
        stops: stops,
        reason: (data?['message'] as String?) ?? 'Route is unavailable right now',
      );
    }

    final result = _buildResult(
      data: data,
      leadingStop: originIsRider ? null : initialOrdered.first,
      intermediates: intermediates,
      destination: destination,
      completed: completed,
    );


    if (result.hasRoute) {
      _cacheKey = cacheKey;
      _cachedResult = result;
      _cachedAt = DateTime.now();
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Response mapping
  // ---------------------------------------------------------------------------

  OptimizedRouteResult _buildResult({
    required Map<String, dynamic> data,
    // The stop standing in as the origin when the rider has no GPS fix: it
    // heads the list but is not itself a destination in the request.
    required GroupedStop? leadingStop,
    required List<GroupedStop> intermediates,
    required GroupedStop destination,
    required List<GroupedStop> completed,
  }) {
    final orderedIntermediates =
        _applyOptimizedOrder(intermediates, data['optimizedOrder']);

    final orderedStops = <GroupedStop>[
      ?leadingStop,
      ...orderedIntermediates,
      destination,
      ...completed,
    ];

    final fullPoints =
        decodeGooglePolylineSegments((data['polyline'] as String?) ?? '');
    if (fullPoints.length < 2) {
      return OptimizedRouteResult.unavailable(
        orderedStops: orderedStops,
        reason: 'Routing service returned no road geometry',
      );
    }

    final legs = _parseLegs(data['legs']);

    final totalDistanceKmRaw =
        ((data['distanceMeters'] as num?)?.toDouble() ?? 0) / 1000.0;
    final geometrySpanKm =
        _geometrySpanKm([fullPoints, for (final leg in legs) leg.points]);
    final ceilingKm = totalDistanceKmRaw > 0
        ? (totalDistanceKmRaw * 3.0).clamp(50.0, double.infinity)
        : 50.0;

    if (geometrySpanKm > ceilingKm) {
      // Rider-facing text stays generic; the numbers that identify the bad
      // payload go to the debug log.
      devLog('[route] rejected geometry: spans '
          '${geometrySpanKm.toStringAsFixed(1)} km (ceiling ${ceilingKm.toStringAsFixed(1)} km) but provider '
          '${data['provider']} reported '
          '${totalDistanceKmRaw.toStringAsFixed(3)} km '
          '(${fullPoints.length} route points, ${legs.length} legs)');
      return OptimizedRouteResult.unavailable(
        orderedStops: orderedStops,
        reason: 'Routing service returned inconsistent road geometry',
      );
    }


    // Leg 0 is origin → next stop; the rest is what the rider still has to do
    // after that. Both come from Google, so the split lands on a real junction.
    List<LatLng> activeLeg = [];
    if (legs.isNotEmpty && legs.first.points.isNotEmpty) {
      activeLeg = List<LatLng>.from(legs.first.points);
    }

    List<LatLng> remaining = [];
    if (legs.length > 1) {
      for (int i = 1; i < legs.length; i++) {
        final legPts = legs[i].points;
        if (legPts.isEmpty) continue;
        if (remaining.isNotEmpty &&
            (remaining.last.latitude - legPts.first.latitude).abs() < 1e-5 &&
            (remaining.last.longitude - legPts.first.longitude).abs() < 1e-5) {
          remaining.addAll(legPts.skip(1));
        } else {
          remaining.addAll(legPts);
        }
      }
    }

    if (activeLeg.length < 2) {
      // Some responses carry route geometry without per-leg geometry; split the
      // route itself at the point closest to the first stop rather than
      // inventing a line to it.
      final nextStop = orderedStops.firstWhere(
        (s) => _isPending(s) && _hasValidCoords(s),
        orElse: () => destination,
      );
      final splitIndex = _closestPointIndex(
        fullPoints,
        LatLng(nextStop.addressLat, nextStop.addressLng),
      );
      activeLeg = fullPoints.sublist(0, splitIndex + 1);
      remaining = fullPoints.sublist(splitIndex);
    }


    final totalDistanceKm = totalDistanceKmRaw;
    final totalDurationMin =
        ((data['durationSeconds'] as num?)?.toDouble() ?? 0) / 60.0;

    final activeDistanceKm =
        legs.isNotEmpty ? legs.first.distanceMeters / 1000.0 : totalDistanceKm;
    final activeDurationMin =
        legs.isNotEmpty ? legs.first.durationSeconds / 60.0 : totalDurationMin;

    return OptimizedRouteResult(
      orderedStops: orderedStops,
      activeLegPoints: activeLeg,
      remainingRoutePoints: remaining,
      fullRoutePoints: fullPoints,
      totalDistanceKm: totalDistanceKm,
      totalDurationMinutes: totalDurationMin,
      activeLegDistanceKm: activeDistanceKm,
      activeLegDurationMinutes: activeDurationMin,
      isRoadGeometry: true,
      status: RouteStatus.ok,
      provider: data['provider'] as String?,
    );
  }

  /// Reorders stops to Google's optimised sequence.
  ///
  /// The API returns original indices in visiting order, already validated as a
  /// complete permutation server-side; an empty list means "keep as sent".
  List<GroupedStop> _applyOptimizedOrder(
    List<GroupedStop> intermediates,
    dynamic rawOrder,
  ) {
    if (rawOrder is! List || rawOrder.length != intermediates.length) {
      return intermediates;
    }
    final ordered = <GroupedStop>[];
    for (final value in rawOrder) {
      final index = value is num ? value.toInt() : -1;
      if (index < 0 || index >= intermediates.length) return intermediates;
      ordered.add(intermediates[index]);
    }
    return ordered;
  }

  List<_RouteLeg> _parseLegs(dynamic rawLegs) {
    if (rawLegs is! List) return const [];
    return rawLegs.whereType<Map>().map((leg) {
      return _RouteLeg(
        points: decodeGooglePolylineSegments((leg['polyline'] as String?) ?? ''),
        distanceMeters: (leg['distanceMeters'] as num?)?.toDouble() ?? 0,
        durationSeconds: (leg['durationSeconds'] as num?)?.toDouble() ?? 0,
      );
    }).toList();
  }

  /// The diagonal of the decoded geometry's bounding box.
  ///
  /// The straight line across a path is never longer than the path itself, so
  /// this can never exceed the road distance Google reported. When it does the
  /// payload is corrupt — and drawing it would paint a road across a continent
  /// on the rider's map, which is worse than drawing nothing.
  double _geometrySpanKm(List<List<LatLng>> pointSets) {
    double minLat = double.infinity;
    double maxLat = double.negativeInfinity;
    double minLng = double.infinity;
    double maxLng = double.negativeInfinity;
    var seen = 0;

    for (final points in pointSets) {
      for (final p in points) {
        if (!p.latitude.isFinite || !p.longitude.isFinite) continue;
        if (p.latitude.abs() < 0.001 && p.longitude.abs() < 0.001) continue;
        seen++;
        if (p.latitude < minLat) minLat = p.latitude;
        if (p.latitude > maxLat) maxLat = p.latitude;
        if (p.longitude < minLng) minLng = p.longitude;
        if (p.longitude > maxLng) maxLng = p.longitude;
      }
    }
    if (seen == 0) return 0.0;

    return _locationService.haversineDistanceKm(minLat, minLng, maxLat, maxLng);
  }

  int _closestPointIndex(List<LatLng> points, LatLng target) {
    int bestIndex = 0;
    double best = double.infinity;
    for (int i = 0; i < points.length; i++) {
      final d = _locationService.haversineDistanceKm(
        points[i].latitude,
        points[i].longitude,
        target.latitude,
        target.longitude,
      );
      if (d < best) {
        best = d;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  OptimizedRouteResult _unavailable({
    required LatLng? currentPosition,
    required List<GroupedStop> stops,
    required String reason,
  }) {
    return OptimizedRouteResult.unavailable(
      orderedStops: computeShortestStopSequence(
        currentPosition: currentPosition,
        stops: stops,
      ),
      reason: reason,
    );
  }

  bool _isPending(GroupedStop s) =>
      s.status != 'delivered' && s.status != 'completed' && s.status != 'failed';

  /// The orders query COALESCEs a missing address latitude to `0.0`, so an
  /// un-geocoded stop arrives as Null Island rather than as null. Sending it to
  /// Google poisons the whole run's route, so it is excluded here.
  bool _hasValidCoords(GroupedStop s) =>
      s.addressLat.isFinite &&
      !s.addressLat.isNaN &&
      s.addressLng.isFinite &&
      !s.addressLng.isNaN &&
      s.addressLat.abs() <= 90 &&
      s.addressLng.abs() <= 180 &&
      !(s.addressLat == 0 && s.addressLng == 0);

  bool _isValidPosition(LatLng? p) =>
      p != null && p.latitude.isFinite && p.longitude.isFinite;

  String _buildCacheKey(LatLng origin, List<GroupedStop> routable) {
    final originKey =
        '${origin.latitude.toStringAsFixed(_kOriginKeyPrecision)},'
        '${origin.longitude.toStringAsFixed(_kOriginKeyPrecision)}';
    final stopKeys = routable.map((s) => '${s.addressId}:${s.status}').join('|');
    return '$originKey#$stopKeys';
  }

  bool _isCacheFresh(String key) {
    final cachedAt = _cachedAt;
    return _cacheKey == key &&
        _cachedResult != null &&
        cachedAt != null &&
        DateTime.now().difference(cachedAt) < _kResultCacheTtl;
  }
}

class _RouteLeg {
  final List<LatLng> points;
  final double distanceMeters;
  final double durationSeconds;

  const _RouteLeg({
    required this.points,
    required this.distanceMeters,
    required this.durationSeconds,
  });
}
