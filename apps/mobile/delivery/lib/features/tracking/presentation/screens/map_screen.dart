import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/services/route_optimization_service.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/delivery_confirmation_sheet.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/features/tracking/presentation/widgets/map_delivery_sheet.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/pickup_required_dialog.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/delivery_result_dialog.dart';

enum MapLayerType {
  googleRoadmap,
  googleSatellite,
  googleTerrain,
}

class MapScreen extends StatefulWidget {
  final GroupedStop? focusedStop;
  final bool isStandalonePage;

  const MapScreen({
    super.key,
    this.focusedStop,
    this.isStandalonePage = false,
  });

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> with TickerProviderStateMixin {
  bool _voiceNavEnabled = true;
  bool _isRefreshing = false;
  MapLayerType _currentLayer = MapLayerType.googleRoadmap;

  late AnimationController _pulsateController;
  late Animation<double> _pulsateAnimation;
  late AnimationController _refreshController;
  late Animation<double> _refreshAnimation;

  final MapController _mapController = MapController();
  LatLng? _currentPosition;
  GroupedStop? _selectedStop;

  /// Set once the rider taps a pin or a stop row. Until then the destination is
  /// re-picked as "nearest to me" on every route refresh.
  bool _userPickedStop = false;
  final bool _hideAllClearedCard = false;

  // Shortest Path Route Optimization State
  OptimizedRouteResult? _optimizedRoute;
  bool _isCalculatingRoute = false;
  bool _hasInitialCameraFitted = false;
  Timer? _routeRetryTimer;
  int _routeRetryCount = 0;
  static const int _kMaxRouteRetries = 5;
  static const Duration _kRouteRetryDelay = Duration(seconds: 6);
  String? _routeNotice;

  void _scheduleRouteRetry() {
    if (_routeRetryCount >= _kMaxRouteRetries) return;
    _routeRetryCount++;
    _routeRetryTimer?.cancel();
    _routeRetryTimer = Timer(_kRouteRetryDelay, () {
      if (!mounted) return;
      final state = context.read<DeliverySessionBloc>().state;
      if (state is! DeliverySessionLoaded) return;
      _calculateShortestPath(_visibleStops(state.groupedStops), force: true);
    });
  }

  // Live GPS tracking
  StreamSubscription<Position>? _positionSub;
  DateTime? _lastRouteFetchAt;
  LatLng? _lastRoutedFrom;

  /// True when the screen was opened by tapping Navigate on one stop.
  ///
  /// In this mode the map is about that stop alone: one pin, one route, and a
  /// distance that counts down as the rider rides. Every other stop is hidden,
  /// because showing the rest of the run is what the map tab is for.
  bool get _isFocusedNavigation => widget.focusedStop != null;

  /// Re-routing cadence while moving. Google is billed per call, so a fix that
  /// arrives sooner than this only updates the live straight-line readout.
  static const Duration _kRouteRefreshInterval = Duration(seconds: 12);

  /// Metres of movement that justify a new route regardless of the interval.
  static const double _kRouteRefreshDistanceKm = 0.06;

  /// Straight-line distance from the rider to [stop], recomputed on every GPS
  /// fix. This is what makes the readout feel live between Google refreshes.
  double? _liveDistanceKmTo(GroupedStop? stop) {
    if (stop == null || _currentPosition == null) return null;
    if (!stop.addressLat.isFinite || !stop.addressLng.isFinite) return null;
    return sl<LocationService>().haversineDistanceKm(
      _currentPosition!.latitude,
      _currentPosition!.longitude,
      stop.addressLat,
      stop.addressLng,
    );
  }

  // Search
  bool _showSearch = false;
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  List<GroupedStop> _searchResults = [];
  String _searchQuery = '';

  String get _currentTileUrl {
    switch (_currentLayer) {
      case MapLayerType.googleSatellite:
        return 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      case MapLayerType.googleTerrain:
        return 'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      case MapLayerType.googleRoadmap:
        return 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    }
  }

  /// Picks the stop the route should lead to.
  ///
  /// Navigating from a stop card fixes the destination to that stop. Opening
  /// the map tab instead points at whichever pending stop is nearest right now,
  /// unless the rider has since tapped a different pin.
  GroupedStop? _resolveDestination(List<GroupedStop> stops) {
    if (_isFocusedNavigation) return widget.focusedStop;
    if (_userPickedStop && _selectedStop != null) return _selectedStop;
    return sl<RouteOptimizationService>().findNearestPendingStop(
          currentPosition: _currentPosition,
          stops: stops,
        ) ??
        _selectedStop;
  }

  /// Marks the destination as the rider's own choice, so the auto "nearest to
  /// me" pick stops overriding it on the next GPS fix.
  void _selectStop(GroupedStop stop, List<GroupedStop> stops) {
    setState(() {
      _selectedStop = stop;
      _userPickedStop = true;
    });
    _calculateShortestPath(stops, targetedStop: stop, force: true);
    _mapController.move(LatLng(stop.addressLat, stop.addressLng), 16.5);
  }

  bool _isStopPending(GroupedStop s) =>
      s.status != 'delivered' && s.status != 'completed' && s.status != 'failed';

  Future<void> _calculateShortestPath(List<GroupedStop> stops, {GroupedStop? targetedStop, bool force = false}) async {
    if (stops.isEmpty) return;
    if (_isCalculatingRoute && !force) return;

    final destination = targetedStop ?? _resolveDestination(stops);
    if (destination == null) return;

    _isCalculatingRoute = true;
    try {
      final service = sl<RouteOptimizationService>();

      // Navigating from a stop card is about that stop alone → one leg.
      // The map tab is about the run → the whole remaining route.
      final result = _isFocusedNavigation
          ? await service.fetchDirectRoute(
              currentPosition: _currentPosition,
              stops: stops,
              destinationStop: destination,
              forceRefresh: force,
            )
          : await service.fetchShortestPathRoute(
              currentPosition: _currentPosition,
              stops: stops,
              targetedStop: _userPickedStop ? destination : null,
              forceRefresh: force,
            );

      if (!mounted) return;

      // A straight-line fallback has isRoadGeometry == false, so that flag alone
      // distinguishes it from a real route. No minimum point count needed beyond 2.
      final bool drawable = result.isRoadGeometry && result.fullRoutePoints.length >= 2;

      debugPrint('[MapRoute] status=${result.status} isRoad=${result.isRoadGeometry} '
          'fullPts=${result.fullRoutePoints.length} activePts=${result.activeLegPoints.length} '
          'drawable=$drawable reason=${result.unavailableReason}');

      setState(() {
        // Replacing a drawn road route with a fallback blanks a map that was working.
        if (drawable || _optimizedRoute == null) _optimizedRoute = result;
        _routeNotice = result.isRoadGeometry ? null : result.unavailableReason;
        _selectedStop = result.orderedStops
            .where(_isStopPending)
            .firstOrNull ?? destination;
      });

      _lastRouteFetchAt = DateTime.now();
      _lastRoutedFrom = _currentPosition;

      if (drawable && !_hasInitialCameraFitted) {
        _hasInitialCameraFitted = true;
        _fitRouteBounds();
      }

      if (!drawable) {
        _scheduleRouteRetry();
      } else {
        _routeRetryCount = 0;
      }
    } catch (e) {
      debugPrint('Error calculating route: $e');
    } finally {
      _isCalculatingRoute = false;
    }
  }

  /// Starts the live GPS feed that keeps the distance and the drawn path
  /// current as the rider moves.
  void _startLiveTracking() {
    _positionSub?.cancel();
    _positionSub = sl<LocationService>()
        .positionStream()
        .listen(_onPositionUpdate, onError: (_) {});
  }

  void _onPositionUpdate(Position position) {
    if (!mounted) return;
    final next = LatLng(position.latitude, position.longitude);

    // Redraws the rider marker and the straight-line distance immediately —
    // this is free, so it happens on every fix.
    setState(() => _currentPosition = next);

    if (_shouldRefetchRoute(next)) {
      final state = context.read<DeliverySessionBloc>().state;
      if (state is DeliverySessionLoaded && state.groupedStops.isNotEmpty) {
        _calculateShortestPath(_visibleStops(state.groupedStops), force: true);
      }
    }
  }

  /// Google is only re-asked once the rider has actually made progress, or once
  /// the route is old enough that traffic could have changed it.
  bool _shouldRefetchRoute(LatLng next) {
    if (_isCalculatingRoute) return false;
    if (_lastRouteFetchAt == null || _lastRoutedFrom == null) return true;

    final movedKm = sl<LocationService>().haversineDistanceKm(
      _lastRoutedFrom!.latitude,
      _lastRoutedFrom!.longitude,
      next.latitude,
      next.longitude,
    );
    if (movedKm >= _kRouteRefreshDistanceKm) return true;

    return DateTime.now().difference(_lastRouteFetchAt!) >= _kRouteRefreshInterval;
  }

  void _fitRouteBounds() {
    final List<LatLng> points = [];
    if (_currentPosition != null) points.add(_currentPosition!);
    if (_optimizedRoute != null && _optimizedRoute!.fullRoutePoints.isNotEmpty) {
      points.addAll(_optimizedRoute!.fullRoutePoints);
    }

    if (points.length >= 2) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        try {
          _mapController.fitCamera(
            CameraFit.bounds(
              bounds: LatLngBounds.fromPoints(points),
              padding: const EdgeInsets.fromLTRB(40, 100, 40, 240),
            ),
          );
        } catch (_) {}
      });
    } else if (points.length == 1) {
      _mapController.move(points.first, 15.5);
    }
  }

  Future<void> _goToCurrentLocation() async {
    try {
      final locationService = sl<LocationService>();
      final isAllowed = await locationService.ensureLocationPermission(context);
      if (!isAllowed) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('GPS Location access is needed to show your current location.'),
            backgroundColor: kDanger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            action: SnackBarAction(
              label: 'SETTINGS',
              textColor: Colors.white,
              onPressed: () async {
                bool serviceEnabled = await locationService.isLocationServiceEnabled();
                if (!serviceEnabled) {
                  await locationService.openLocationSettings();
                } else {
                  await locationService.openAppSettings();
                }
              },
            ),
          ),
        );
        return;
      }

      final position = await locationService.getCurrentPosition();
      if (position != null) {
        final newPos = LatLng(position.latitude, position.longitude);
        setState(() {
          _currentPosition = newPos;
        });
        _mapController.move(newPos, 16.0);

        // Recovers live tracking if the stream had failed for want of a
        // permission the rider has since granted.
        _startLiveTracking();

        final sessionState = context.read<DeliverySessionBloc>().state;
        if (sessionState is DeliverySessionLoaded) {
          _calculateShortestPath(_visibleStops(sessionState.groupedStops), force: true);
        }
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Failed to get current GPS location. Please check settings.'),
            backgroundColor: kDanger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            action: SnackBarAction(
              label: 'SETTINGS',
              textColor: Colors.white,
              onPressed: () => locationService.openLocationSettings(),
            ),
          ),
        );
      }
    } catch (e) {
      print('Error getting current location: $e');
    }
  }

  Future<void> _openGoogleMapsNavigation(double lat, double lng) async {
    final nativeUri = Uri.parse('google.navigation:q=$lat,$lng&mode=d');
    final webUri = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');
    try {
      if (await canLaunchUrl(nativeUri)) {
        await launchUrl(nativeUri, mode: LaunchMode.externalApplication);
      } else if (await canLaunchUrl(webUri)) {
        await launchUrl(webUri, mode: LaunchMode.externalApplication);
      }
    } catch (_) {
      try {
        await launchUrl(webUri, mode: LaunchMode.externalApplication);
      } catch (_) {}
    }
  }

  IconData _getVehicleIcon(String? type) {
    final t = (type ?? '').toLowerCase().trim();
    if (t.contains('scoot') || t.contains('moped') || t == 'scooty') {
      return Icons.moped_rounded;
    } else if (t.contains('electric') || t.contains('ev')) {
      return Icons.electric_moped_rounded;
    } else if (t.contains('cycle') || t.contains('bicycle')) {
      return Icons.directions_bike_rounded;
    } else if (t.contains('car') || t.contains('van') || t.contains('auto')) {
      return Icons.directions_car_rounded;
    }
    return Icons.two_wheeler_rounded;
  }

  List<Marker> _buildMarkers(List<GroupedStop> groupedStops, {String? vehicleType}) {
    final List<Marker> markers = [];

    // 1. Add client stop markers
    for (int i = 0; i < groupedStops.length; i++) {
      final stop = groupedStops[i];
      if (!stop.addressLat.isFinite || stop.addressLat.isNaN || !stop.addressLng.isFinite || stop.addressLng.isNaN) {
        continue;
      }

      final isDelivered = stop.status == 'delivered' || stop.status == 'completed';
      final isFailed = stop.status == 'failed';
      final isOutForDelivery = stop.status == 'out_for_delivery';

      Color pinColor;
      if (isDelivered) {
        pinColor = const Color(0xFF16A34A);
      } else if (isFailed) {
        pinColor = const Color(0xFFEF4444);
      } else if (isOutForDelivery) {
        pinColor = const Color(0xFFD97706);
      } else {
        pinColor = const Color(0xFF1A73E8);
      }

      final isCurrentSelected = _selectedStop?.stop == stop.stop;
      final isNextActive = isOutForDelivery ||
          (stop.status == 'pending' && i == groupedStops.indexWhere((s) => s.status == 'pending'));

      markers.add(
        Marker(
          point: LatLng(stop.addressLat, stop.addressLng),
          width: isCurrentSelected ? 120 : 50,
          height: isCurrentSelected ? 72 : 50,
          alignment: Alignment.center,
          child: GestureDetector(
            onTap: () => _selectStop(stop, groupedStops),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Floating Customer Name Badge for Selected / Active Stop
                if (isCurrentSelected) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x33000000),
                          blurRadius: 6,
                          offset: Offset(0, 2),
                        )
                      ],
                    ),
                    child: Text(
                      'Stop #${stop.stop} · ${stop.customerName}',
                      style: GoogleFonts.roboto(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(height: 2),
                ],
                Stack(
                  alignment: Alignment.center,
                  children: [
                    if (isNextActive || isCurrentSelected)
                      AnimatedBuilder(
                        animation: _pulsateAnimation,
                        builder: (context, child) {
                          return Container(
                            width: 32 + 16 * _pulsateAnimation.value,
                            height: 32 + 16 * _pulsateAnimation.value,
                            decoration: BoxDecoration(
                              color: pinColor.withValues(alpha: 0.35 * (1 - _pulsateAnimation.value)),
                              shape: BoxShape.circle,
                            ),
                          );
                        },
                      ),
                    // Google Maps Pin Body
                    Container(
                      width: isCurrentSelected ? 34 : 28,
                      height: isCurrentSelected ? 34 : 28,
                      decoration: BoxDecoration(
                        color: pinColor,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: isCurrentSelected ? 3.0 : 2.2),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x3D000000),
                            blurRadius: 8,
                            offset: Offset(0, 3),
                          )
                        ],
                      ),
                      child: Center(
                        child: isDelivered
                            ? const Icon(Icons.check_rounded, color: Colors.white, size: 16)
                            : Text(
                                '${stop.stop}',
                                style: GoogleFonts.roboto(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  fontSize: isCurrentSelected ? 12 : 10.5,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    }

    // 2. Add current position Partner Vehicle Marker (replaces blue dot)
    if (_currentPosition != null) {
      final vehicleIcon = _getVehicleIcon(vehicleType);
      markers.add(
        Marker(
          point: _currentPosition!,
          width: 52,
          height: 52,
          alignment: Alignment.center,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Radar Pulse Ripple
              AnimatedBuilder(
                animation: _pulsateAnimation,
                builder: (context, child) {
                  return Container(
                    width: 28 + 22 * _pulsateAnimation.value,
                    height: 28 + 22 * _pulsateAnimation.value,
                    decoration: BoxDecoration(
                      color: const Color(0xFF059669).withValues(alpha: 0.32 * (1 - _pulsateAnimation.value)),
                      shape: BoxShape.circle,
                    ),
                  );
                },
              ),
              // Outer White Ring with drop shadow
              Container(
                width: 38,
                height: 38,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x33059669),
                      blurRadius: 8,
                      spreadRadius: 2,
                    )
                  ],
                ),
              ),
              // Solid Emerald Vehicle Core
              Container(
                width: 30,
                height: 30,
                decoration: const BoxDecoration(
                  color: Color(0xFF059669),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Icon(
                    vehicleIcon,
                    color: Colors.white,
                    size: 18,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }
    return markers;
  }

  @override
  void initState() {
    super.initState();

    if (widget.focusedStop != null) {
      _selectedStop = widget.focusedStop;
    }

    _pulsateController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
    _pulsateAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(_pulsateController);

    _refreshController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _refreshAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _refreshController, curve: Curves.easeInOut),
    );

    // The stream is opened only after the permission prompt has resolved —
    // started earlier it just errors out and the map never tracks.
    _goToCurrentLocation().then((_) {
      if (mounted) _startLiveTracking();
    });

    if (widget.focusedStop != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (widget.focusedStop!.addressLat.isFinite && widget.focusedStop!.addressLng.isFinite) {
          _mapController.move(
            LatLng(widget.focusedStop!.addressLat, widget.focusedStop!.addressLng),
            16.5,
          );
        }
      });
    }
  }

  @override
  void dispose() {
    _positionSub?.cancel();
    _routeRetryTimer?.cancel();
    _pulsateController.dispose();
    _refreshController.dispose();
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  
  List<GroupedStop> _visibleStops(List<GroupedStop> sessionStops) {
    if (!_isFocusedNavigation) return sessionStops;
    final focused = widget.focusedStop!;
    final match = sessionStops.where((s) => s.stop == focused.stop);
    return [match.isNotEmpty ? match.first : focused];
  }

  Future<void> _refreshMap() async {
    if (_isRefreshing) return;
    setState(() => _isRefreshing = true);
    _refreshController.repeat();
    try {
      context.read<DeliverySessionBloc>().add(ReloadSessionEvent());
      await _goToCurrentLocation();
      await Future.delayed(const Duration(milliseconds: 600));
    } finally {
      _refreshController.stop();
      _refreshController.reset();
      if (mounted) setState(() => _isRefreshing = false);
    }
  }

  void _showLayerSelector() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Map View Style',
                style: GoogleFonts.roboto(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  _buildLayerOption(
                    title: 'Google Default',
                    icon: Icons.map_outlined,
                    type: MapLayerType.googleRoadmap,
                  ),
                  const SizedBox(width: 12),
                  _buildLayerOption(
                    title: 'Satellite Hybrid',
                    icon: Icons.satellite_alt_outlined,
                    type: MapLayerType.googleSatellite,
                  ),
                  const SizedBox(width: 12),
                  _buildLayerOption(
                    title: 'Terrain',
                    icon: Icons.terrain_outlined,
                    type: MapLayerType.googleTerrain,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLayerOption({
    required String title,
    required IconData icon,
    required MapLayerType type,
  }) {
    final isSelected = _currentLayer == type;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() => _currentLayer = type);
          Navigator.pop(context);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFDCFCE7) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isSelected ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                color: isSelected ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                size: 26,
              ),
              const SizedBox(height: 8),
              Text(
                title,
                style: GoogleFonts.roboto(
                  fontSize: 11,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                  color: isSelected ? const Color(0xFF15803D) : const Color(0xFF475569),
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showConfirmation(BuildContext context, GroupedStop stop) async {
    final sessionState = context.read<DeliverySessionBloc>().state is DeliverySessionLoaded
        ? context.read<DeliverySessionBloc>().state as DeliverySessionLoaded
        : null;
    if (sessionState != null && !sessionState.isPickupConfirmed) {
      showPickupRequiredDialog(
        context,
        orders: sessionState.orders,
        groupedStops: sessionState.groupedStops,
        currentRun: sessionState.currentRun,
      );
      return;
    }

    if (!context.mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => DeliveryConfirmationSheet(
        stop: stop,
        onConfirm: (
          status,
          emptyBottles,
          returnedContainers,
          damagedContainers,
          lostContainers,
          notes,
          paymentMode,
          paymentStatus,
          deliveryImage,
          containerReturns,
          containerDeliveries,
        ) {
          showDialog(
            context: context,
            barrierDismissible: false,
            builder: (ctx) => const Center(child: CircularProgressIndicator(color: kPrimary)),
          );

          final orderId = stop.orders.isNotEmpty ? stop.orders.first.orderId : stop.stop.toString();
          context.read<DeliverySessionBloc>().add(UpdateStopStatusEvent(
            orderId: orderId,
            newStatus: status,
            emptyBottles: emptyBottles,
            returnedContainers: returnedContainers,
            damagedContainers: damagedContainers,
            lostContainers: lostContainers,
            notes: notes,
            paymentMode: paymentMode,
            paymentStatus: paymentStatus,
            deliveryImage: deliveryImage,
            containerReturns: containerReturns,
            containerDeliveries: containerDeliveries,
            onSuccess: () {
              if (mounted) {
                Navigator.pop(context); // pop loading dialog
                DeliveryResultDialog.show(
                  context,
                  stop: stop,
                  status: status,
                  emptyBottlesCollected: emptyBottles,
                  paymentMode: paymentMode,
                );
              }
            },
            onError: (errorMsg) {
              if (mounted) {
                Navigator.pop(context); // pop loading dialog
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(errorMsg),
                    backgroundColor: kDanger,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                );
              }
            },
          ));
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<DeliverySessionBloc, DeliverySessionState>(
      listenWhen: (previous, current) {
        if (current is! DeliverySessionLoaded) return false;
        if (previous is! DeliverySessionLoaded) return true;
        if (previous.orders.length != current.orders.length) return true;
        for (int i = 0; i < previous.orders.length; i++) {
          if (previous.orders[i].status != current.orders[i].status) {
            return true;
          }
        }
        return false;
      },
      listener: (context, state) {
        if (state is DeliverySessionLoaded) {
          _calculateShortestPath(_visibleStops(state.groupedStops), force: true);
        }
      },
      child: BlocBuilder<DeliverySessionBloc, DeliverySessionState>(
        builder: (context, state) {
          if (state is! DeliverySessionLoaded) {
            return const Scaffold(
              body: Center(
                child: CircularProgressIndicator(color: kPrimary),
              ),
            );
          }

          final effectiveStops = _visibleStops(state.groupedStops);
          final pendingStops = effectiveStops.where(
            (s) => s.status != 'delivered' && s.status != 'completed' && s.status != 'failed',
          ).toList();

          if (_optimizedRoute == null && effectiveStops.isNotEmpty && !_isCalculatingRoute) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _calculateShortestPath(effectiveStops, force: true);
            });
          }

          final List<Polyline> polylines = [];

          if (pendingStops.isNotEmpty && _optimizedRoute != null) {
            final route = _optimizedRoute!;
            final activePts = route.activeLegPoints;
            final remainingPts = route.remainingRoutePoints;
            final fullPts = route.fullRoutePoints;

            if (!route.isRoadGeometry) {
              // A straight line is not a road — drawing it in the road styling tells the
              // rider to ride through buildings.
              final approx = fullPts.length >= 2 ? fullPts : activePts;
              if (approx.length >= 2) {
                polylines.add(
                  Polyline(
                    points: approx,
                    strokeWidth: 4.0,
                    color: const Color(0xFF94A3B8),
                    pattern: StrokePattern.dashed(segments: const [12, 10]),
                    strokeCap: StrokeCap.round,
                    strokeJoin: StrokeJoin.round,
                  ),
                );
              }
            } else {
              // 1. Remaining / Subsequent Delivery Path (Google Maps Secondary Route Style)
              if (remainingPts.length >= 2) {
                // Casing outline for remaining path
                polylines.add(
                  Polyline(
                    points: remainingPts,
                    strokeWidth: 7.0,
                    color: const Color(0xFF1E3A8A).withValues(alpha: 0.35),
                    strokeCap: StrokeCap.round,
                    strokeJoin: StrokeJoin.round,
                  ),
                );
                // Light blue core for remaining path
                polylines.add(
                  Polyline(
                    points: remainingPts,
                    strokeWidth: 4.5,
                    color: const Color(0xFF60A5FA),
                    strokeCap: StrokeCap.round,
                    strokeJoin: StrokeJoin.round,
                  ),
                );
              } else if (fullPts.length >= 2 && activePts.length < 2) {
                polylines.add(
                  Polyline(
                    points: fullPts,
                    strokeWidth: 7.0,
                    color: const Color(0xFF1E3A8A).withValues(alpha: 0.35),
                    strokeCap: StrokeCap.round,
                    strokeJoin: StrokeJoin.round,
                  ),
                );
                polylines.add(
                  Polyline(
                    points: fullPts,
                    strokeWidth: 4.5,
                    color: const Color(0xFF60A5FA),
                    strokeCap: StrokeCap.round,
                    strokeJoin: StrokeJoin.round,
                  ),
                );
              }

              // 2. Active Navigation Leg (Google Maps Active Route Style: Aura + Navy Casing + High-contrast Vibrant Blue)
              if (activePts.length >= 2) {
                // Outer glow aura
                polylines.add(
                  Polyline(
                    points: activePts,
                    strokeWidth: 13.0,
                    color: const Color(0xFF2563EB).withValues(alpha: 0.22),
                    strokeCap: StrokeCap.round,
                    strokeJoin: StrokeJoin.round,
                  ),
                );
                // Deep navy casing border
                polylines.add(
                  Polyline(
                    points: activePts,
                    strokeWidth: 8.5,
                    color: const Color(0xFF1557B0),
                    strokeCap: StrokeCap.round,
                    strokeJoin: StrokeJoin.round,
                  ),
                );
                // Solid high-contrast Google Blue core (#1A73E8)
                polylines.add(
                  Polyline(
                    points: activePts,
                    strokeWidth: 5.5,
                    color: const Color(0xFF1A73E8),
                    strokeCap: StrokeCap.round,
                    strokeJoin: StrokeJoin.round,
                  ),
                );
              }
            }
          }

          LatLng mapCenter = _currentPosition ?? const LatLng(12.9125, 77.6430);
          final validStops = effectiveStops.where((s) => s.addressLat.isFinite && !s.addressLat.isNaN && s.addressLng.isFinite && !s.addressLng.isNaN).toList();
          if (_currentPosition == null && validStops.isNotEmpty) {
            double totalLat = 0;
            double totalLng = 0;
            for (var stop in validStops) {
              totalLat += stop.addressLat;
              totalLng += stop.addressLng;
            }
            mapCenter = LatLng(totalLat / validStops.length, totalLng / validStops.length);
          }

          return Scaffold(
            body: Stack(
              children: [
                // 1. Google Maps raster tile layer with route polylines and markers
                Positioned.fill(
                  child: FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: mapCenter,
                      initialZoom: 14.0,
                      maxZoom: 19.0,
                      minZoom: 4.0,
                    ),
                    children: [
                      TileLayer(
                        urlTemplate: _currentTileUrl,
                        userAgentPackageName: 'com.f2h.delivery',
                        subdomains: const ['mt0', 'mt1', 'mt2', 'mt3'],
                      ),
                      if (polylines.isNotEmpty)
                        PolylineLayer(
                          polylines: polylines,
                        ),
                      MarkerLayer(
                        markers: _buildMarkers(effectiveStops, vehicleType: state.vehicleType),
                      ),
                    ],
                  ),
                ),

                // 2. Google Maps Attribution / Watermark pill
                Positioned(
                  bottom: 230,
                  left: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(6),
                      boxShadow: const [
                        BoxShadow(color: Color(0x14000000), blurRadius: 4, offset: Offset(0, 1)),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Google Maps',
                          style: GoogleFonts.roboto(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF475569),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // 3. Floating Search Bar & Back Button
                // 3. Floating Search Bar & Back Button
                Positioned(
                  top: MediaQuery.of(context).padding.top + 12,
                  left: 16,
                  right: 72,
                  child: Row(
                    children: [
                      if (widget.isStandalonePage || Navigator.canPop(context)) ...[
                        GestureDetector(
                          onTap: () => Navigator.maybePop(context),
                          child: Container(
                            width: 44,
                            height: 44,
                            margin: const EdgeInsets.only(right: 10),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x14000000),
                                  blurRadius: 8,
                                  offset: Offset(0, 3),
                                )
                              ],
                            ),
                            child: const Center(
                              child: Icon(
                                Icons.arrow_back_rounded,
                                color: Color(0xFF0F172A),
                                size: 22,
                              ),
                            ),
                          ),
                        ),
                      ],
                      Expanded(
                        child: _buildSearchBar(effectiveStops),
                      ),
                    ],
                  ),
                ),

                // 4. Floating Shortest Route Summary Card & Route Notice Banner
                if (!_showSearch)
                  Positioned(
                    top: MediaQuery.of(context).padding.top + 70,
                    left: 16,
                    right: 72,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _buildShortestRouteCard(vehicleType: state.vehicleType),
                        if (_routeNotice != null) ...[
                          const SizedBox(height: 6),
                          _buildRouteNoticeBanner(effectiveStops),
                        ],
                      ],
                    ),
                  ),

                // 5. Floating Side Map Options
                Positioned(
                  right: 16,
                  top: MediaQuery.of(context).padding.top + 12,
                  child: Column(
                    children: [
                      _buildMapOptionCircle(
                        icon: _showSearch ? Icons.search_off_rounded : Icons.search_rounded,
                        color: _showSearch ? const Color(0xFF16A34A) : const Color(0xFF475569),
                        onTap: () {
                          setState(() {
                            _showSearch = !_showSearch;
                            if (!_showSearch) {
                              _searchController.clear();
                              _searchQuery = '';
                              _searchResults = [];
                              _searchFocusNode.unfocus();
                            } else {
                              Future.delayed(const Duration(milliseconds: 100), () {
                                _searchFocusNode.requestFocus();
                              });
                            }
                          });
                        },
                        tooltip: _showSearch ? 'Close Search' : 'Search Stops',
                      ),
                      const SizedBox(height: 10),
                      _buildMapOptionCircle(
                        icon: Icons.layers_outlined,
                        color: const Color(0xFF16A34A),
                        onTap: _showLayerSelector,
                        tooltip: 'Map Layer Style',
                      ),
                      const SizedBox(height: 10),
                      _buildMapOptionCircle(
                        icon: _voiceNavEnabled ? Icons.volume_up_rounded : Icons.volume_off_rounded,
                        color: _voiceNavEnabled ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                        onTap: () => setState(() => _voiceNavEnabled = !_voiceNavEnabled),
                        tooltip: 'Voice Navigation',
                      ),
                      const SizedBox(height: 10),
                      _buildMapOptionCircle(
                        icon: Icons.my_location_rounded,
                        color: const Color(0xFF2563EB),
                        onTap: _goToCurrentLocation,
                        tooltip: 'Current GPS Location',
                      ),
                      const SizedBox(height: 10),
                      _buildRefreshCircle(),
                    ],
                  ),
                ),

                // 6. Bottom Active Delivery Details HUD (Kept in comment)
                // _buildBottomHUD(state, effectiveStops),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildMapOptionCircle({
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
    required String tooltip,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 8,
            offset: Offset(0, 3),
          )
        ],
      ),
      child: IconButton(
        icon: Icon(icon, color: color, size: 20),
        onPressed: onTap,
        tooltip: tooltip,
      ),
    );
  }

  Widget _buildRefreshCircle() {
    return Tooltip(
      message: 'Refresh Map',
      child: GestureDetector(
        onTap: _isRefreshing ? null : _refreshMap,
        child: Container(
          decoration: BoxDecoration(
            color: _isRefreshing ? const Color(0xFFDCFCE7) : Colors.white,
            shape: BoxShape.circle,
            border: Border.all(color: _isRefreshing ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x14000000),
                blurRadius: 8,
                offset: Offset(0, 3),
              )
            ],
          ),
          width: 44,
          height: 44,
          child: Center(
            child: RotationTransition(
              turns: _refreshAnimation,
              child: Icon(
                Icons.refresh_rounded,
                color: _isRefreshing ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                size: 20,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchBar(List<GroupedStop> groupedStops) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 250),
      child: _showSearch
          ? Column(
              key: const ValueKey('search_open'),
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF16A34A)),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x1A000000),
                        blurRadius: 12,
                        offset: Offset(0, 4),
                      )
                    ],
                  ),
                  child: TextField(
                    controller: _searchController,
                    focusNode: _searchFocusNode,
                    onChanged: (q) {
                      final query = q.trim().toLowerCase();
                      setState(() {
                        _searchQuery = query;
                        if (query.isEmpty) {
                          _searchResults = [];
                        } else {
                          _searchResults = groupedStops
                              .where((s) {
                                return s.customerName.toLowerCase().contains(query) ||
                                    s.address.toLowerCase().contains(query) ||
                                    s.stop.toString().contains(query) ||
                                    s.customerPhone.contains(query);
                              })
                              .toList();
                        }
                      });
                    },
                    style: GoogleFonts.roboto(
                      fontSize: 13.5,
                      color: const Color(0xFF0F172A),
                      fontWeight: FontWeight.w600,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Search customer name, stop #...',
                      hintStyle: GoogleFonts.roboto(color: const Color(0xFF94A3B8), fontSize: 13),
                      prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF16A34A), size: 20),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? GestureDetector(
                              onTap: () {
                                _searchController.clear();
                                setState(() {
                                  _searchQuery = '';
                                  _searchResults = [];
                                });
                              },
                              child: const Icon(Icons.close_rounded, color: Color(0xFF94A3B8), size: 18),
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
                    ),
                  ),
                ),
                if (_searchResults.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Container(
                    constraints: const BoxConstraints(maxHeight: 240),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x14000000),
                          blurRadius: 10,
                          offset: Offset(0, 4),
                        )
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: ListView.separated(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        shrinkWrap: true,
                        itemCount: _searchResults.length,
                        separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                        itemBuilder: (context, index) {
                          final stop = _searchResults[index];
                          return InkWell(
                            onTap: () {
                              setState(() {
                                _selectedStop = stop;
                                _userPickedStop = true;
                                _showSearch = false;
                                _searchController.clear();
                                _searchQuery = '';
                                _searchResults = [];
                                _searchFocusNode.unfocus();
                              });
                              _mapController.move(
                                LatLng(stop.addressLat, stop.addressLng),
                                17.0,
                              );
                            },
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              child: Row(
                                children: [
                                  Container(
                                    width: 28,
                                    height: 28,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFDCFCE7),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: const Color(0xFF16A34A)),
                                    ),
                                    child: Center(
                                      child: Text(
                                        '${stop.stop}',
                                        style: GoogleFonts.roboto(
                                          color: const Color(0xFF15803D),
                                          fontWeight: FontWeight.w800,
                                          fontSize: 10,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          stop.customerName,
                                          style: GoogleFonts.roboto(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 13,
                                            color: const Color(0xFF0F172A),
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        Text(
                                          stop.address,
                                          style: GoogleFonts.roboto(
                                            color: const Color(0xFF64748B),
                                            fontSize: 11,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ],
              ],
            )
          : const SizedBox.shrink(key: ValueKey('search_closed')),
    );
  }

  Widget _buildRouteNoticeBanner(List<GroupedStop> effectiveStops) {
    if (_routeNotice == null) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFDE68A)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline_rounded, color: Color(0xFFD97706), size: 14),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              _routeNotice!,
              style: GoogleFonts.roboto(
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF92400E),
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: () {
              _routeRetryCount = 0;
              _calculateShortestPath(effectiveStops, force: true);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
              decoration: BoxDecoration(
                color: const Color(0xFFD97706),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                'Retry',
                style: GoogleFonts.roboto(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildShortestRouteCard({String? vehicleType}) {
    final route = _optimizedRoute;
    if (route == null) return const SizedBox.shrink();

    final pendingStops = route.orderedStops.where(
      (s) => s.status != 'delivered' && s.status != 'completed' && s.status != 'failed',
    ).toList();

    if (pendingStops.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.96),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFDCFCE7), width: 1.5),
          boxShadow: const [
            BoxShadow(
              color: Color(0x1F000000),
              blurRadius: 14,
              offset: Offset(0, 4),
            )
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFFDCFCE7),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'All Deliveries Completed! 🎉',
                    style: GoogleFonts.roboto(
                      color: const Color(0xFF0F172A),
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    'All route stops finished. Return to hub for return ledger.',
                    style: GoogleFonts.roboto(
                      color: const Color(0xFF64748B),
                      fontWeight: FontWeight.w500,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final activeStop = _selectedStop ?? pendingStops.first;

    // The road distance is only as fresh as the last Google call, which is
    // throttled. The straight-line distance moves with every GPS fix, so it is
    // what the rider sees ticking down between refreshes.
    final liveKm = _liveDistanceKmTo(activeStop);
    final shownKm = liveKm ?? route.activeLegDistanceKm;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1F000000),
            blurRadius: 14,
            offset: Offset(0, 4),
          )
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1A73E8), Color(0xFF2563EB)],
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.navigation_rounded, color: Colors.white, size: 12),
                    const SizedBox(width: 4),
                    Text(
                      'STOP #${activeStop.stop}',
                      style: GoogleFonts.roboto(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 10,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  activeStop.customerName,
                  style: GoogleFonts.roboto(
                    color: const Color(0xFF0F172A),
                    fontWeight: FontWeight.w800,
                    fontSize: 12.5,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              GestureDetector(
                onTap: _fitRouteBounds,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.fit_screen_rounded, size: 12, color: Color(0xFF475569)),
                      const SizedBox(width: 4),
                      Text(
                        'Fit Route',
                        style: GoogleFonts.roboto(
                          color: const Color(0xFF475569),
                          fontWeight: FontWeight.w700,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              // Distance & ETA to Next Stop
              Expanded(
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(_getVehicleIcon(vehicleType), color: const Color(0xFF1A73E8), size: 16),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${shownKm.toStringAsFixed(1)} km · ~${route.activeLegDurationMinutes.round()}m',
                          style: GoogleFonts.roboto(
                            fontWeight: FontWeight.w900,
                            fontSize: 13,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        Text(
                          'To Stop #${activeStop.stop}',
                          style: GoogleFonts.roboto(fontSize: 9.5, color: const Color(0xFF64748B), fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Container(width: 1, height: 26, color: const Color(0xFFE2E8F0)),
              const SizedBox(width: 10),
              // Total Run Remaining
              Expanded(
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.alt_route_rounded, color: Color(0xFF16A34A), size: 16),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _isFocusedNavigation
                              ? '${route.totalDistanceKm.toStringAsFixed(1)} km by road'
                              : '${pendingStops.length} stops · ${route.totalDistanceKm.toStringAsFixed(1)} km',
                          style: GoogleFonts.roboto(
                            fontWeight: FontWeight.w900,
                            fontSize: 13,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        Text(
                          _isFocusedNavigation
                              ? 'To this stop (~${route.totalDurationMinutes.round()} mins)'
                              : 'Total Run (~${route.totalDurationMinutes.round()} mins)',
                          style: GoogleFonts.roboto(fontSize: 9.5, color: const Color(0xFF64748B), fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Google Maps External Turn-by-Turn Button
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => _openGoogleMapsNavigation(activeStop.addressLat, activeStop.addressLng),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6.5),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1A73E8),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.navigation_outlined, color: Colors.white, size: 14),
                        const SizedBox(width: 6),
                        Text(
                          'Start Google Maps Turn-by-Turn',
                          style: GoogleFonts.roboto(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottomHUD(DeliverySessionLoaded state, List<GroupedStop> effectiveStops) {
    final pendingStops = effectiveStops.where((s) => s.status != 'delivered' && s.status != 'completed' && s.status != 'failed').toList();
    final defaultNext = pendingStops.isNotEmpty ? pendingStops.first : (effectiveStops.isNotEmpty ? effectiveStops.first : null);
    final nextStop = _selectedStop ?? defaultNext;

    if (nextStop == null) {
      if (_hideAllClearedCard) {
        return const Positioned(
          bottom: 0,
          left: 0,
          child: SizedBox.shrink(),
        );
      }
      return Positioned(
        bottom: 96,
        left: 16,
        right: 16,
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFBBF7D0)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x1A000000),
                blurRadius: 16,
                offset: Offset(0, 4),
              )
            ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 44),
              const SizedBox(height: 12),
              Text(
                'All Deliveries Cleared!',
                style: GoogleFonts.roboto(fontWeight: FontWeight.w800, fontSize: 17, color: const Color(0xFF0F172A)),
              ),
              const SizedBox(height: 4),
              Text(
                'No pending orders remaining on your route sheet.',
                style: GoogleFonts.roboto(color: const Color(0xFF64748B), fontSize: 12.5),
              ),
            ],
          ),
        ),
      );
    }

    return MapDeliverySheet(
      groupedStops: effectiveStops,
      nextStop: nextStop,
      onStopSelected: (stop) => _selectStop(stop, effectiveStops),
      onShowConfirmation: (stop) => _showConfirmation(context, stop),
    );
  }
}
