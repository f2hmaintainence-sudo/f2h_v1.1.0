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

  /// The pending stop closest to the rider in a straight line.
  ///
  /// Straight-line is the right measure here because this only *picks* which
  /// stop to route to — the road distance that decides the pick would cost one
  /// Google call per candidate stop, and the nearest by air is the nearest by
  /// road often enough that paying for that is not worth it.
  GroupedStop? findNearestPendingStop({
    required LatLng? currentPosition,
    required List<GroupedStop> stops,
  }) {
    final candidates = stops.where((s) => _isPending(s) && _hasValidCoords(s));
    if (candidates.isEmpty) return null;
    if (!_isValidPosition(currentPosition)) return candidates.first;

    GroupedStop? nearest;
    double best = double.infinity;
    for (final s in candidates) {
      final d = _locationService.haversineDistanceKm(
        currentPosition!.latitude,
        currentPosition.longitude,
        s.addressLat,
        s.addressLng,
      );
      if (d < best) {
        best = d;
        nearest = s;
      }
    }
    return nearest;
  }

  /// Fetches the road route from the rider to **one** stop and nothing beyond it.
  ///
  /// This is the routing both map modes want. Navigating to a stop should draw
  /// the way to that stop, not the whole run threaded through it; and opening
  /// the map tab should point at the nearest stop while leaving the run's own
  /// stop order alone. [stops] is therefore returned untouched in
  /// [OptimizedRouteResult.orderedStops] — this call never re-sequences a run.
  ///
  /// [remainingRoutePoints] is empty by design: there is no onward leg to draw.
  Future<OptimizedRouteResult> fetchDirectRoute({
    required LatLng? currentPosition,
    required List<GroupedStop> stops,
    required GroupedStop destinationStop,
    bool forceRefresh = false,
  }) async {
    if (!_hasValidCoords(destinationStop)) {
      return OptimizedRouteResult.unavailable(
        orderedStops: List.from(stops),
        reason: 'This stop has no map location saved',
      );
    }

    final destination = LatLng(destinationStop.addressLat, destinationStop.addressLng);

    if (!_isValidPosition(currentPosition)) {
      return OptimizedRouteResult.unavailable(
        orderedStops: List.from(stops),
        reason: 'Waiting for GPS location fix',
      );
    }
    final origin = currentPosition!;

    final cacheKey = '${_buildCacheKey(origin, [destinationStop])}#direct';
    if (!forceRefresh && _isCacheFresh(cacheKey)) return _cachedResult!;

    Map<String, dynamic>? data;
    try {
      final response = await _dio.post(
        ApiEndpoints.mapDirections,
        data: {
          'origin': {'lat': origin.latitude, 'lng': origin.longitude},
          'destination': {'lat': destination.latitude, 'lng': destination.longitude},
          'intermediates': const [],
          'optimizeWaypointOrder': false,
          'travelMode': _kTravelMode,
        },
      );
      final body = response.data;
      if (body is Map) data = Map<String, dynamic>.from(body);
    } on DioException catch (e) {
      return _buildDirectStraightLineFallback(
        origin: origin,
        stops: stops,
        destinationStop: destinationStop,
        reason: e.type == DioExceptionType.connectionError
            ? 'Offline — showing straight line path'
            : 'Routing service temporarily unavailable',
      );
    } catch (_) {
      return _buildDirectStraightLineFallback(
        origin: origin,
        stops: stops,
        destinationStop: destinationStop,
        reason: 'Routing service temporarily unavailable',
      );
    }

    if (data == null || data['status'] != 'OK') {
      return _buildDirectStraightLineFallback(
        origin: origin,
        stops: stops,
        destinationStop: destinationStop,
        reason: (data?['message'] as String?) ?? 'Routing service unavailable',
      );
    }

    final legs = _parseLegs(data['legs']);
    final fullPoints = decodeGooglePolylineSegments((data['polyline'] as String?) ?? '');
    final points = fullPoints.isNotEmpty ? fullPoints : legs.expand((l) => l.points).toList();

    if (points.length < 2) {
      return _buildDirectStraightLineFallback(
        origin: origin,
        stops: stops,
        destinationStop: destinationStop,
        reason: 'Routing service returned no road geometry',
      );
    }

    final distanceKm = ((data['distanceMeters'] as num?)?.toDouble() ??
            (legs.isNotEmpty ? legs.first.distanceMeters : 0)) /
        1000.0;
    final durationMin = ((data['durationSeconds'] as num?)?.toDouble() ??
            (legs.isNotEmpty ? legs.first.durationSeconds : 0)) /
        60.0;

    final result = OptimizedRouteResult(
      orderedStops: List.from(stops),
      activeLegPoints: points,
      remainingRoutePoints: const [],
      fullRoutePoints: points,
      totalDistanceKm: distanceKm,
      totalDurationMinutes: durationMin,
      activeLegDistanceKm: distanceKm,
      activeLegDurationMinutes: durationMin,
      isRoadGeometry: true,
      status: RouteStatus.ok,
      provider: data['provider'] as String?,
    );

    _cacheKey = cacheKey;
    _cachedResult = result;
    _cachedAt = DateTime.now();
    return result;
  }

  OptimizedRouteResult _buildDirectStraightLineFallback({
    required LatLng origin,
    required List<GroupedStop> stops,
    required GroupedStop destinationStop,
    String? reason,
  }) {
    final destination = LatLng(destinationStop.addressLat, destinationStop.addressLng);
    final points = [origin, destination];
    final distanceKm = _locationService.haversineDistanceKm(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude,
    );

    return OptimizedRouteResult(
      orderedStops: List.from(stops),
      activeLegPoints: points,
      remainingRoutePoints: const [],
      fullRoutePoints: points,
      totalDistanceKm: distanceKm,
      totalDurationMinutes: (distanceKm / 25.0) * 60.0,
      activeLegDistanceKm: distanceKm,
      activeLegDurationMinutes: (distanceKm / 25.0) * 60.0,
      isRoadGeometry: false,
      status: RouteStatus.ok,
      unavailableReason: reason,
      provider: 'fallback-straight-line',
    );
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
    GroupedStop? targetedStop,
    bool forceRefresh = false,
  }) async {
    final pending = stops.where((s) => _isPending(s) && _hasValidCoords(s)).toList();
    final completed = stops.where((s) => !_isPending(s)).toList();

    if (pending.isEmpty) {
      return OptimizedRouteResult.unavailable(orderedStops: List.from(stops));
    }

    final bool originIsRider = _isValidPosition(currentPosition);
    final LatLng origin = originIsRider
        ? currentPosition!
        : LatLng(pending.first.addressLat, pending.first.addressLng);

    // Compute the sequence of pending stops to visit
    List<GroupedStop> orderedPending;
    if (targetedStop != null && _hasValidCoords(targetedStop) && _isPending(targetedStop)) {
      // User selected a target stop: place target stop first, then order remaining stops
      final others = pending.where((s) => s.stop != targetedStop.stop).toList();
      final orderedOthers = computeShortestStopSequence(
        currentPosition: LatLng(targetedStop.addressLat, targetedStop.addressLng),
        stops: others,
      );
      orderedPending = [targetedStop, ...orderedOthers.where(_isPending)];
    } else {
      orderedPending = computeShortestStopSequence(
        currentPosition: origin,
        stops: pending,
      );
    }

    final GroupedStop destination;
    final List<GroupedStop> intermediates;

    if (originIsRider) {
      if (orderedPending.length == 1) {
        destination = orderedPending.first;
        intermediates = const [];
      } else {
        destination = orderedPending.last;
        intermediates = orderedPending.sublist(0, orderedPending.length - 1);
      }
    } else {
      // GPS not available: first pending stop acts as origin
      if (orderedPending.length <= 1) {
        return _buildStraightLineFallback(
          currentPosition: origin,
          orderedPending: orderedPending,
          completed: completed,
          reason: 'Waiting for GPS location fix',
        );
      } else if (orderedPending.length == 2) {
        destination = orderedPending[1];
        intermediates = const [];
      } else {
        destination = orderedPending.last;
        intermediates = orderedPending.sublist(1, orderedPending.length - 1);
      }
    }

    final safeIntermediates = intermediates.length > 23
        ? intermediates.sublist(0, 23)
        : intermediates;

    final cacheKey =
        '${_buildCacheKey(origin, [destination, ...safeIntermediates])}#tgt:${targetedStop?.stop}';
    if (!forceRefresh && _isCacheFresh(cacheKey)) return _cachedResult!;

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
          'intermediates': safeIntermediates
              .map((s) => {'lat': s.addressLat, 'lng': s.addressLng})
              .toList(),
          'optimizeWaypointOrder': targetedStop == null && safeIntermediates.isNotEmpty,
          'travelMode': _kTravelMode,
        },
      );

      final body = response.data;
      if (body is Map) data = Map<String, dynamic>.from(body);
    } on DioException catch (e) {
      return _buildStraightLineFallback(
        currentPosition: origin,
        orderedPending: orderedPending,
        completed: completed,
        reason: e.type == DioExceptionType.connectionError
            ? 'Offline — showing straight line path'
            : 'Routing service temporarily unavailable',
      );
    } catch (_) {
      return _buildStraightLineFallback(
        currentPosition: origin,
        orderedPending: orderedPending,
        completed: completed,
        reason: 'Routing service temporarily unavailable',
      );
    }

    if (data == null || data['status'] != 'OK') {
      return _buildStraightLineFallback(
        currentPosition: origin,
        orderedPending: orderedPending,
        completed: completed,
        reason: (data?['message'] as String?) ?? 'Routing service unavailable',
      );
    }

    final result = _buildResult(
      data: data,
      origin: origin,
      leadingStop: originIsRider ? null : orderedPending.first,
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
    required LatLng origin,
    required GroupedStop? leadingStop,
    required List<GroupedStop> intermediates,
    required GroupedStop destination,
    required List<GroupedStop> completed,
  }) {
    final orderedIntermediates =
        _applyOptimizedOrder(intermediates, data['optimizedOrder']);

    final orderedStops = <GroupedStop>[
      if (leadingStop != null) leadingStop,
      ...orderedIntermediates,
      destination,
      ...completed,
    ];

    final fullPoints =
        decodeGooglePolylineSegments((data['polyline'] as String?) ?? '');
    final legs = _parseLegs(data['legs']);

    final List<LatLng> allRoutePoints = fullPoints.isNotEmpty
        ? fullPoints
        : legs.expand((l) => l.points).toList();

    if (allRoutePoints.length < 2) {
      final pendingStops = orderedStops.where(_isPending).toList();
      return _buildStraightLineFallback(
        currentPosition: origin,
        orderedPending: pendingStops,
        completed: completed,
        reason: 'Routing service returned no road geometry',
      );
    }

    // Leg 0 is origin → first stop; subsequent legs connect remaining stops
    List<LatLng> activeLeg = [];
    if (legs.isNotEmpty && legs.first.points.length >= 2) {
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
      final nextStop = orderedStops.firstWhere(
        (s) => _isPending(s) && _hasValidCoords(s),
        orElse: () => destination,
      );
      final splitIndex = _closestPointIndex(
        allRoutePoints,
        LatLng(nextStop.addressLat, nextStop.addressLng),
      );
      activeLeg = allRoutePoints.sublist(0, (splitIndex + 1).clamp(1, allRoutePoints.length));
      remaining = allRoutePoints.sublist(splitIndex.clamp(0, allRoutePoints.length - 1));
    }

    final totalDistanceKm =
        ((data['distanceMeters'] as num?)?.toDouble() ?? 0) / 1000.0;
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
      fullRoutePoints: allRoutePoints,
      totalDistanceKm: totalDistanceKm > 0 ? totalDistanceKm : activeDistanceKm,
      totalDurationMinutes: totalDurationMin > 0 ? totalDurationMin : activeDurationMin,
      activeLegDistanceKm: activeDistanceKm,
      activeLegDurationMinutes: activeDurationMin,
      isRoadGeometry: true,
      status: RouteStatus.ok,
      provider: data['provider'] as String?,
    );
  }

  /// Builds a straight-line connected fallback path between stops when online routing is unavailable.
  OptimizedRouteResult _buildStraightLineFallback({
    required LatLng currentPosition,
    required List<GroupedStop> orderedPending,
    required List<GroupedStop> completed,
    String? reason,
  }) {
    final orderedStops = [...orderedPending, ...completed];
    if (orderedPending.isEmpty) {
      return OptimizedRouteResult.unavailable(
        orderedStops: orderedStops,
        reason: reason,
      );
    }

    final List<LatLng> activeLeg = [
      currentPosition,
      LatLng(orderedPending.first.addressLat, orderedPending.first.addressLng),
    ];

    final List<LatLng> remaining = [];
    for (int i = 0; i < orderedPending.length; i++) {
      remaining.add(LatLng(orderedPending[i].addressLat, orderedPending[i].addressLng));
    }

    final List<LatLng> fullPoints = [
      currentPosition,
      ...remaining,
    ];

    double totalDistKm = 0.0;
    for (int i = 0; i < fullPoints.length - 1; i++) {
      totalDistKm += _locationService.haversineDistanceKm(
        fullPoints[i].latitude,
        fullPoints[i].longitude,
        fullPoints[i + 1].latitude,
        fullPoints[i + 1].longitude,
      );
    }

    final activeDistKm = _locationService.haversineDistanceKm(
      activeLeg[0].latitude,
      activeLeg[0].longitude,
      activeLeg[1].latitude,
      activeLeg[1].longitude,
    );

    // Approximate two-wheeler speed ~ 25 km/h
    final totalDurationMin = (totalDistKm / 25.0) * 60.0;
    final activeDurationMin = (activeDistKm / 25.0) * 60.0;

    return OptimizedRouteResult(
      orderedStops: orderedStops,
      activeLegPoints: activeLeg,
      remainingRoutePoints: remaining,
      fullRoutePoints: fullPoints,
      totalDistanceKm: totalDistKm,
      totalDurationMinutes: totalDurationMin,
      activeLegDistanceKm: activeDistKm,
      activeLegDurationMinutes: activeDurationMin,
      isRoadGeometry: false,
      status: RouteStatus.ok,
      unavailableReason: reason,
      provider: 'fallback-straight-line',
    );
  }

  /// Reorders stops to Google's optimised sequence.
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

  bool _isPending(GroupedStop s) =>
      s.status != 'delivered' && s.status != 'completed' && s.status != 'failed';

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
