import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:google_fonts/google_fonts.dart';
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
import 'package:f2h_delivery/core/config/app_config.dart';

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
  bool _showTraffic = true;
  bool _isRefreshing = false;
  MapLayerType _currentLayer = MapLayerType.googleRoadmap;

  late AnimationController _pulsateController;
  late Animation<double> _pulsateAnimation;
  late AnimationController _refreshController;
  late Animation<double> _refreshAnimation;

  final MapController _mapController = MapController();
  LatLng? _currentPosition;
  GroupedStop? _selectedStop;
  bool _hideAllClearedCard = false;

  // Shortest Path Route Optimization State
  OptimizedRouteResult? _optimizedRoute;
  bool _isCalculatingRoute = false;
  bool _hasInitialCameraFitted = false;

  // Search
  bool _showSearch = false;
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  List<GroupedStop> _searchResults = [];
  String _searchQuery = '';

  String get _currentTileUrl {
    switch (_currentLayer) {
      case MapLayerType.googleSatellite:
        return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      case MapLayerType.googleTerrain:
        return 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      case MapLayerType.googleRoadmap:
      default:
        return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    }
  }

  Future<void> _calculateShortestPath(List<GroupedStop> stops) async {
    if (stops.isEmpty || _isCalculatingRoute) return;
    _isCalculatingRoute = true;
    try {
      final routeService = sl<RouteOptimizationService>();
      final result = await routeService.fetchShortestPathRoute(
        currentPosition: _currentPosition,
        stops: stops,
      );

      if (mounted) {
        setState(() {
          _optimizedRoute = result;
        });

        if (!_hasInitialCameraFitted) {
          _hasInitialCameraFitted = true;
          _fitRouteBounds();
        }
      }
    } catch (e) {
      print('Error calculating shortest path: $e');
    } finally {
      _isCalculatingRoute = false;
    }
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
      final position = await locationService.getCurrentPosition();
      if (position != null) {
        final newPos = LatLng(position.latitude, position.longitude);
        setState(() {
          _currentPosition = newPos;
        });
        _mapController.move(newPos, 16.0);

        final sessionState = context.read<DeliverySessionBloc>().state;
        if (sessionState is DeliverySessionLoaded) {
          _calculateShortestPath(sessionState.groupedStops);
        }
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Failed to get current GPS location.'),
            backgroundColor: kDanger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      print('Error getting current location: $e');
    }
  }

  List<Marker> _buildMarkers(List<GroupedStop> groupedStops) {
    final List<Marker> markers = [];

    // Add client stop markers
    for (int i = 0; i < groupedStops.length; i++) {
      final stop = groupedStops[i];
      if (!stop.addressLat.isFinite || stop.addressLat.isNaN || !stop.addressLng.isFinite || stop.addressLng.isNaN) {
        continue;
      }

      Color pinColor;
      if (stop.status == 'delivered') {
        pinColor = const Color(0xFF16A34A);
      } else if (stop.status == 'failed') {
        pinColor = const Color(0xFFEF4444);
      } else if (stop.status == 'out_for_delivery') {
        pinColor = const Color(0xFFD97706);
      } else {
        pinColor = const Color(0xFF2563EB);
      }

      final isCurrentSelected = _selectedStop?.stop == stop.stop;
      final isActive = stop.status == 'out_for_delivery' ||
          (stop.status == 'pending' && i == groupedStops.indexWhere((s) => s.status == 'pending'));

      markers.add(
        Marker(
          point: LatLng(stop.addressLat, stop.addressLng),
          width: isCurrentSelected ? 56 : 46,
          height: isCurrentSelected ? 56 : 46,
          child: GestureDetector(
            onTap: () {
              setState(() {
                _selectedStop = stop;
              });
              _mapController.move(LatLng(stop.addressLat, stop.addressLng), 16.5);
            },
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (isActive || isCurrentSelected)
                  AnimatedBuilder(
                    animation: _pulsateAnimation,
                    builder: (context, child) {
                      return Container(
                        width: 24 + 14 * _pulsateAnimation.value,
                        height: 24 + 14 * _pulsateAnimation.value,
                        decoration: BoxDecoration(
                          color: pinColor.withOpacity(0.3 * (1 - _pulsateAnimation.value)),
                          shape: BoxShape.circle,
                        ),
                      );
                    },
                  ),
                // Pin body
                Container(
                  width: isCurrentSelected ? 30 : 26,
                  height: isCurrentSelected ? 30 : 26,
                  decoration: BoxDecoration(
                    color: pinColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2.5),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x33000000),
                        blurRadius: 6,
                        offset: Offset(0, 3),
                      )
                    ],
                  ),
                  child: Center(
                    child: Text(
                      '${stop.stop}',
                      style: GoogleFonts.poppins(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: isCurrentSelected ? 12 : 10,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // Add current position marker if available
    if (_currentPosition != null) {
      markers.add(
        Marker(
          point: _currentPosition!,
          width: 36,
          height: 36,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFF2563EB).withOpacity(0.25),
                  shape: BoxShape.circle,
                ),
              ),
              Container(
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  color: const Color(0xFF2563EB),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x402563EB),
                      blurRadius: 8,
                      spreadRadius: 2,
                    )
                  ],
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

    _goToCurrentLocation();

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
    _pulsateController.dispose();
    _refreshController.dispose();
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
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
                style: GoogleFonts.poppins(
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
                style: GoogleFonts.poppins(
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

    final locationService = sl<LocationService>();
    final position = await locationService.getCurrentPosition();

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
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Stop #${stop.stop} marked as $status!'),
                    backgroundColor: status == 'delivered' ? kSuccess : kDanger,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
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
          _calculateShortestPath(state.groupedStops);
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

          final effectiveStops = _optimizedRoute?.orderedStops ?? state.groupedStops;
          if (_optimizedRoute == null && effectiveStops.isNotEmpty && !_isCalculatingRoute) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _calculateShortestPath(effectiveStops);
            });
          }

          final List<Polyline> polylines = [];
          if (_optimizedRoute != null && _optimizedRoute!.fullRoutePoints.length >= 2) {
            if (_optimizedRoute!.remainingRoutePoints.length >= 2) {
              polylines.add(
                Polyline(
                  points: _optimizedRoute!.remainingRoutePoints,
                  strokeWidth: 4.0,
                  color: const Color(0xFF2563EB),
                  borderStrokeWidth: 1.5,
                  borderColor: Colors.white.withOpacity(0.8),
                ),
              );
            }
            if (_optimizedRoute!.activeLegPoints.length >= 2) {
              polylines.add(
                Polyline(
                  points: _optimizedRoute!.activeLegPoints,
                  strokeWidth: 5.5,
                  color: const Color(0xFF10B981),
                  borderStrokeWidth: 2.5,
                  borderColor: Colors.white,
                ),
              );
            }
          } else if (effectiveStops.length > 1) {
            final List<LatLng> fallbackPoints = [];
            if (_currentPosition != null) fallbackPoints.add(_currentPosition!);
            for (var stop in effectiveStops) {
              if (stop.addressLat.isFinite && !stop.addressLat.isNaN && stop.addressLng.isFinite && !stop.addressLng.isNaN) {
                fallbackPoints.add(LatLng(stop.addressLat, stop.addressLng));
              }
            }
            if (fallbackPoints.length >= 2) {
              polylines.add(
                Polyline(
                  points: fallbackPoints,
                  strokeWidth: 4.5,
                  color: const Color(0xFF16A34A),
                  borderStrokeWidth: 2.0,
                  borderColor: Colors.white,
                ),
              );
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
                        markers: _buildMarkers(effectiveStops),
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
                      color: Colors.white.withOpacity(0.85),
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
                          style: GoogleFonts.poppins(
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
                Positioned(
                  top: MediaQuery.of(context).padding.top + 12,
                  left: (widget.isStandalonePage || Navigator.canPop(context)) ? 16 : 16,
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

                // 4. Floating Shortest Route Summary Card
                if (!_showSearch)
                  Positioned(
                    top: MediaQuery.of(context).padding.top + 70,
                    left: 16,
                    right: 72,
                    child: _buildShortestRouteCard(),
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

                // 6. Bottom Active Delivery Details HUD
                _buildBottomHUD(state, effectiveStops),
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
                    style: GoogleFonts.poppins(
                      fontSize: 13.5,
                      color: const Color(0xFF0F172A),
                      fontWeight: FontWeight.w600,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Search customer name, stop #...',
                      hintStyle: GoogleFonts.poppins(color: const Color(0xFF94A3B8), fontSize: 13),
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
                                        style: GoogleFonts.poppins(
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
                                          style: GoogleFonts.poppins(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 13,
                                            color: const Color(0xFF0F172A),
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        Text(
                                          stop.address,
                                          style: GoogleFonts.poppins(
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

  Widget _buildShortestRouteCard() {
    if (_optimizedRoute == null || _optimizedRoute!.fullRoutePoints.length < 2) {
      return const SizedBox.shrink();
    }

    final route = _optimizedRoute!;
    final pendingStops = route.orderedStops.where(
      (s) => s.status != 'delivered' && s.status != 'completed' && s.status != 'failed',
    ).toList();
    final nextPending = pendingStops.isNotEmpty ? pendingStops.first : route.orderedStops.first;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.96),
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF16A34A),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.bolt_rounded, color: Colors.white, size: 13),
                    const SizedBox(width: 4),
                    Text(
                      'SHORTEST ROUTE',
                      style: GoogleFonts.poppins(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 10,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: _fitRouteBounds,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
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
                        style: GoogleFonts.poppins(
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
              Expanded(
                child: Row(
                  children: [
                    const Icon(Icons.near_me_rounded, color: Color(0xFF2563EB), size: 16),
                    const SizedBox(width: 6),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${route.totalDistanceKm.toStringAsFixed(1)} km',
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        Text(
                          'Total Distance',
                          style: GoogleFonts.poppins(fontSize: 9.5, color: const Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Container(width: 1, height: 26, color: const Color(0xFFE2E8F0)),
              const SizedBox(width: 12),
              Expanded(
                child: Row(
                  children: [
                    const Icon(Icons.schedule_rounded, color: Color(0xFF16A34A), size: 16),
                    const SizedBox(width: 6),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '~${route.totalDurationMinutes.round()} mins',
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        Text(
                          'Est. Travel Time',
                          style: GoogleFonts.poppins(fontSize: 9.5, color: const Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                const Icon(Icons.flag_circle_rounded, color: Color(0xFF16A34A), size: 14),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Next Stop: Stop #${nextPending.stop} (${nextPending.customerName}) · ${route.activeLegDistanceKm.toStringAsFixed(1)} km',
                    style: GoogleFonts.poppins(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF334155),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
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
                style: GoogleFonts.poppins(fontWeight: FontWeight.w800, fontSize: 17, color: const Color(0xFF0F172A)),
              ),
              const SizedBox(height: 4),
              Text(
                'No pending orders remaining on your route sheet.',
                style: GoogleFonts.poppins(color: const Color(0xFF64748B), fontSize: 12.5),
              ),
            ],
          ),
        ),
      );
    }

    return MapDeliverySheet(
      groupedStops: effectiveStops,
      nextStop: nextStop,
      onStopSelected: (stop) {
        setState(() {
          _selectedStop = stop;
        });
        _mapController.move(LatLng(stop.addressLat, stop.addressLng), 16.5);
      },
      onShowConfirmation: (stop) => _showConfirmation(context, stop),
    );
  }
}
