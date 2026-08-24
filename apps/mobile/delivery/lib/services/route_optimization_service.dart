import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:latlong2/latlong.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';

class OptimizedRouteResult {
  final List<GroupedStop> orderedStops;
  final List<LatLng> activeLegPoints;
  final List<LatLng> remainingRoutePoints;
  final List<LatLng> fullRoutePoints;
  final double totalDistanceKm;
  final double totalDurationMinutes;
  final double activeLegDistanceKm;
  final double activeLegDurationMinutes;
  final bool isRoadGeometry;

  OptimizedRouteResult({
    required this.orderedStops,
    required this.activeLegPoints,
    required this.remainingRoutePoints,
    required this.fullRoutePoints,
    required this.totalDistanceKm,
    required this.totalDurationMinutes,
    required this.activeLegDistanceKm,
    required this.activeLegDurationMinutes,
    this.isRoadGeometry = false,
  });
}

class RouteOptimizationService {
  final LocationService _locationService;
  final Dio _dio;

  RouteOptimizationService({
    required LocationService locationService,
    Dio? dio,
  })  : _locationService = locationService,
        _dio = dio ??
            Dio(BaseOptions(
              connectTimeout: const Duration(seconds: 6),
              receiveTimeout: const Duration(seconds: 6),
            ));

  /// Computes the optimal shortest sequence of stops using a greedy Nearest-Neighbor
  /// Traveling Salesperson algorithm starting from the delivery partner's current GPS position.
  List<GroupedStop> computeShortestStopSequence({
    required LatLng? currentPosition,
    required List<GroupedStop> stops,
  }) {
    if (stops.length <= 1) return List.from(stops);

    final pending = stops
        .where((s) =>
            s.status != 'delivered' &&
            s.status != 'completed' &&
            s.status != 'failed')
        .toList();
    final completed = stops
        .where((s) =>
            s.status == 'delivered' ||
            s.status == 'completed' ||
            s.status == 'failed')
        .toList();

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
        if (!s.addressLat.isFinite ||
            s.addressLat.isNaN ||
            !s.addressLng.isFinite ||
            s.addressLng.isNaN) {
          continue;
        }
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
      if (nearest.addressLat.isFinite &&
          !nearest.addressLat.isNaN &&
          nearest.addressLng.isFinite &&
          !nearest.addressLng.isNaN) {
        current = LatLng(nearest.addressLat, nearest.addressLng);
      }
    }

    ordered.addAll(completed);
    return ordered;
  }

  /// Calculates the shortest path and fetches turn-by-turn road polyline coordinates
  /// from OSRM, with instant fallback to sequenced Haversine routing.
  Future<OptimizedRouteResult> fetchShortestPathRoute({
    required LatLng? currentPosition,
    required List<GroupedStop> stops,
  }) async {
    final orderedStops = computeShortestStopSequence(
      currentPosition: currentPosition,
      stops: stops,
    );

    final validPendingStops = orderedStops
        .where((s) =>
            s.status != 'delivered' &&
            s.status != 'completed' &&
            s.status != 'failed' &&
            s.addressLat.isFinite &&
            !s.addressLat.isNaN &&
            s.addressLng.isFinite &&
            !s.addressLng.isNaN)
        .toList();

    if (validPendingStops.isEmpty && orderedStops.isNotEmpty) {
      validPendingStops.addAll(orderedStops.where((s) =>
          s.addressLat.isFinite &&
          !s.addressLat.isNaN &&
          s.addressLng.isFinite &&
          !s.addressLng.isNaN));
    }

    final List<LatLng> waypoints = [];
    if (currentPosition != null &&
        currentPosition.latitude.isFinite &&
        currentPosition.longitude.isFinite) {
      waypoints.add(currentPosition);
    }
    for (final s in validPendingStops) {
      waypoints.add(LatLng(s.addressLat, s.addressLng));
    }

    if (waypoints.length < 2) {
      return OptimizedRouteResult(
        orderedStops: orderedStops,
        activeLegPoints: waypoints,
        remainingRoutePoints: [],
        fullRoutePoints: waypoints,
        totalDistanceKm: 0,
        totalDurationMinutes: 0,
        activeLegDistanceKm: 0,
        activeLegDurationMinutes: 0,
        isRoadGeometry: false,
      );
    }

    // Attempt OSRM driving turn-by-turn road route
    try {
      final coordsParam = waypoints
          .map((p) =>
              '${p.longitude.toStringAsFixed(6)},${p.latitude.toStringAsFixed(6)}')
          .join(';');
      final url =
          'https://router.project-osrm.org/route/v1/driving/$coordsParam?overview=full&geometries=geojson&steps=false';

      final response = await _dio.get(url);

      if (response.statusCode == 200 && response.data != null) {
        final dynamic resData = response.data;
        final data = resData is Map<String, dynamic>
            ? resData
            : (resData is Map
                ? Map<String, dynamic>.from(resData)
                : jsonDecode(resData.toString()) as Map<String, dynamic>);

        final routes = data['routes'] as List<dynamic>?;
        if (routes != null && routes.isNotEmpty) {
          final firstRoute = routes[0] as Map<dynamic, dynamic>;
          final geometry = firstRoute['geometry'] as Map<dynamic, dynamic>?;
          final rawCoords = (geometry?['coordinates'] as List<dynamic>?) ?? [];
          final totalDistanceMeters =
              (firstRoute['distance'] as num?)?.toDouble() ?? 0.0;
          final totalDurationSec =
              (firstRoute['duration'] as num?)?.toDouble() ?? 0.0;

          final List<LatLng> roadPoints = [];
          for (final c in rawCoords) {
            if (c is List && c.length >= 2) {
              final lng = (c[0] as num).toDouble();
              final lat = (c[1] as num).toDouble();
              roadPoints.add(LatLng(lat, lng));
            }
          }

          if (roadPoints.isNotEmpty) {
            final firstStopPoint = LatLng(
                validPendingStops.first.addressLat,
                validPendingStops.first.addressLng);

            int splitIndex = 0;
            double minDiff = double.infinity;
            for (int i = 0; i < roadPoints.length; i++) {
              final d = _locationService.haversineDistanceKm(
                roadPoints[i].latitude,
                roadPoints[i].longitude,
                firstStopPoint.latitude,
                firstStopPoint.longitude,
              );
              if (d < minDiff) {
                minDiff = d;
                splitIndex = i;
              }
            }

            final activeLeg = roadPoints.sublist(0, splitIndex + 1);
            final remainingLeg = roadPoints.sublist(splitIndex);

            final activeDistKm = currentPosition != null
                ? _locationService.haversineDistanceKm(
                    currentPosition.latitude,
                    currentPosition.longitude,
                    firstStopPoint.latitude,
                    firstStopPoint.longitude,
                  )
                : (totalDistanceMeters / 1000.0);

            return OptimizedRouteResult(
              orderedStops: orderedStops,
              activeLegPoints: activeLeg.isNotEmpty
                  ? activeLeg
                  : (waypoints.length >= 2 ? waypoints.sublist(0, 2) : waypoints),
              remainingRoutePoints: remainingLeg,
              fullRoutePoints: roadPoints,
              totalDistanceKm: totalDistanceMeters / 1000.0,
              totalDurationMinutes: totalDurationSec / 60.0,
              activeLegDistanceKm: activeDistKm,
              activeLegDurationMinutes: (activeDistKm / 25.0) * 60.0,
              isRoadGeometry: true,
            );
          }
        }
      }
    } catch (_) {
      // Fallback below
    }

    // Straight-line fallback
    double totalDist = 0.0;
    for (int i = 0; i < waypoints.length - 1; i++) {
      totalDist += _locationService.haversineDistanceKm(
        waypoints[i].latitude,
        waypoints[i].longitude,
        waypoints[i + 1].latitude,
        waypoints[i + 1].longitude,
      );
    }

    final activeDist = waypoints.length >= 2
        ? _locationService.haversineDistanceKm(
            waypoints[0].latitude,
            waypoints[0].longitude,
            waypoints[1].latitude,
            waypoints[1].longitude,
          )
        : 0.0;

    return OptimizedRouteResult(
      orderedStops: orderedStops,
      activeLegPoints:
          waypoints.length >= 2 ? [waypoints[0], waypoints[1]] : waypoints,
      remainingRoutePoints: waypoints.length > 2 ? waypoints.sublist(1) : [],
      fullRoutePoints: waypoints,
      totalDistanceKm: totalDist,
      totalDurationMinutes: (totalDist / 25.0) * 60.0,
      activeLegDistanceKm: activeDist,
      activeLegDurationMinutes: (activeDist / 25.0) * 60.0,
      isRoadGeometry: false,
    );
  }
}
