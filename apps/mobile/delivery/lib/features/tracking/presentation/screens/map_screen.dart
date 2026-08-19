import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/delivery_confirmation_sheet.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/features/tracking/presentation/widgets/map_delivery_sheet.dart';
import 'package:f2h_delivery/core/config/app_config.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> with TickerProviderStateMixin {
  
  bool _voiceNavEnabled = true;
  bool _showTraffic = true;
  bool _isRefreshing = false;
  late AnimationController _pulsateController;
  late Animation<double> _pulsateAnimation;
  late AnimationController _refreshController;
  late Animation<double> _refreshAnimation;
  
  final MapController _mapController = MapController();
  LatLng? _currentPosition;
  GroupedStop? _selectedStop;
  bool _hideAllClearedCard = false;

  // Search
  bool _showSearch = false;
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  List<GroupedStop> _searchResults = [];
  String _searchQuery = '';

  Future<void> _goToCurrentLocation() async {
    try {
      final locationService = sl<LocationService>();
      final position = await locationService.getCurrentPosition();
      if (position != null) {
        final newPos = LatLng(position.latitude, position.longitude);
        setState(() {
          _currentPosition = newPos;
        });
        _mapController.move(newPos, 15.0);
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Failed to get current location. Please check GPS permissions.'),
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
        pinColor = kSuccess;
      } else if (stop.status == 'failed') {
        pinColor = kDanger;
      } else if (stop.status == 'out_for_delivery') {
        pinColor = kAccent;
      } else {
        pinColor = kMuted;
      }
      
      final isActive = stop.status == 'out_for_delivery' || 
          (stop.status == 'pending' && i == groupedStops.indexWhere((s) => s.status == 'pending'));
      
      markers.add(
        Marker(
          point: LatLng(stop.addressLat, stop.addressLng),
          width: 50,
          height: 50,
          child: GestureDetector(
            onTap: () {
              setState(() {
                _selectedStop = stop;
              });
              _mapController.move(LatLng(stop.addressLat, stop.addressLng), 16.0);
            },
            child: Stack(
               alignment: Alignment.center,
              children: [
                if (isActive)
                  AnimatedBuilder(
                    animation: _pulsateAnimation,
                    builder: (context, child) {
                      return Container(
                        width: 22 + 12 * _pulsateAnimation.value,
                        height: 22 + 12 * _pulsateAnimation.value,
                        decoration: BoxDecoration(
                          color: pinColor.withValues(alpha: 0.25 * (1 - _pulsateAnimation.value)),
                          shape: BoxShape.circle,
                        ),
                      );
                    },
                  ),
                // Shadow
                Positioned(
                  bottom: 6,
                  child: Container(
                    width: 16,
                    height: 4,
                    decoration: BoxDecoration(
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.2),
                          blurRadius: 4,
                          spreadRadius: 1,
                        )
                      ],
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                // Pin body
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: pinColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.15),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      )
                    ],
                  ),
                  child: Center(
                    child: Text(
                      '${stop.stop}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 10,
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
          width: 30,
          height: 30,
          child: Container(
            decoration: BoxDecoration(
              color: Colors.blue,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2.5),
              boxShadow: [
                BoxShadow(
                  color: Colors.blue.withValues(alpha: 0.4),
                  blurRadius: 8,
                  spreadRadius: 2,
                )
              ],
            ),
          ),
        ),
      );
    }
    return markers;
  }

  @override
  void initState() {
    super.initState();
    
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



  void _showConfirmation(BuildContext context, GroupedStop stop) async {
    final locationService = sl<LocationService>();
    final position = await locationService.getCurrentPosition();
    if (position != null) {
      final dist = locationService.haversineDistanceKm(
        position.latitude,
        position.longitude,
        stop.addressLat,
        stop.addressLng,
      );
      print('[DEBUG] Rider is $dist km away from stop.');
      // Bypassed 300 meters check to allow testing locally
      /*
      if (dist > 0.3) { // 300 meters threshold
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Please reach the location to mark as delivered.'),
              backgroundColor: kDanger,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        }
        return;
      }
      */
    }

    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DeliveryConfirmationSheet(
        stop: stop,
        onConfirm: (status, emptyBottles, returnedContainers, damagedContainers, lostContainers, notes, paymentMode, paymentStatus, deliveryImage, containerReturns) {
          if (stop.orders.isEmpty) return;
          final orderId = stop.orders.first.orderId;

          // Show loading dialog
          showDialog(
            context: context,
            barrierDismissible: false,
            builder: (_) => const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(kPrimary),
              ),
            ),
          );

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
          final groupedStops = state.groupedStops;
          if (groupedStops.isNotEmpty) {
            final points = groupedStops
                .where((s) => s.addressLat.isFinite && !s.addressLat.isNaN && s.addressLng.isFinite && !s.addressLng.isNaN)
                .map((s) => LatLng(s.addressLat, s.addressLng))
                .toList();
            if (points.isNotEmpty) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                try {
                  _mapController.fitCamera(
                    CameraFit.bounds(
                      bounds: LatLngBounds.fromPoints(points),
                      padding: const EdgeInsets.all(50.0),
                    ),
                  );
                } catch (e) {
                  print('Error fitting camera bounds: $e');
                }
              });
            }
          }
        }
      },
      child: BlocBuilder<DeliverySessionBloc, DeliverySessionState>(
        builder: (context, state) {
          if (state is! DeliverySessionLoaded) {
            return const Scaffold(
              body: Center(
                child: CircularProgressIndicator(),
              ),
            );
          }

          final groupedStops = state.groupedStops;
          final pendingCount = state.pendingGroupedStopsCount;
          final distanceRemaining = (pendingCount * 0.7).toStringAsFixed(1);
          
          final now = DateTime.now();
          final finishTime = now.add(Duration(minutes: pendingCount * 6));
          final finishStr = "${finishTime.hour.toString().padLeft(2, '0')}:${finishTime.minute.toString().padLeft(2, '0')} ${finishTime.hour >= 12 ? 'PM' : 'AM'}";

          final List<LatLng> routePoints = [];
          if (groupedStops.isNotEmpty) {
            for (var stop in groupedStops) {
              if (stop.addressLat.isFinite && !stop.addressLat.isNaN && stop.addressLng.isFinite && !stop.addressLng.isNaN) {
                routePoints.add(LatLng(stop.addressLat, stop.addressLng));
              }
            }
          }
          if (routePoints.isEmpty) {
            routePoints.addAll([
              const LatLng(12.9085, 77.6390),
              const LatLng(12.9105, 77.6420),
              const LatLng(12.9135, 77.6465),
              const LatLng(12.9158, 77.6398),
              const LatLng(12.9180, 77.6432),
              const LatLng(12.9120, 77.6495),
              const LatLng(12.9145, 77.6415),
              const LatLng(12.9160, 77.6480),
            ]);
          }

          LatLng mapCenter = const LatLng(12.9125, 77.6430);
          final validStops = groupedStops.where((s) => s.addressLat.isFinite && !s.addressLat.isNaN && s.addressLng.isFinite && !s.addressLng.isNaN).toList();
          if (validStops.isNotEmpty) {
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
                // 1. Full-screen Vector Route Painter Map
                Positioned.fill(
                  child: FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: mapCenter,
                      initialCameraFit: CameraFit.bounds(
                        bounds: LatLngBounds.fromPoints(routePoints),
                        padding: const EdgeInsets.all(50.0),
                      ),
                      maxZoom: 18.0,
                      minZoom: 4.0,
                    ),
                    children: [
                      TileLayer(
                        urlTemplate: AppConfig.mapTileUrlTemplate,
                        userAgentPackageName: 'com.f2h.delivery',
                      ),
                      MarkerLayer(
                        markers: _buildMarkers(groupedStops),
                      ),
                    ],
                  ),
                ),

                // 2. Floating Search Bar
                Positioned(
                  top: MediaQuery.of(context).padding.top + 12,
                  left: 16,
                  right: 72,
                  child: _buildSearchBar(groupedStops),
                ),

                // 3. Floating Side Map Options
                Positioned(
                  right: 16,
                  top: MediaQuery.of(context).padding.top + 12,
                  child: Column(
                    children: [
                      _buildMapOptionCircle(
                        icon: _showSearch ? Icons.search_off_rounded : Icons.search_rounded,
                        color: _showSearch ? kPrimary : kTextSub,
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
                        icon: _showTraffic ? Icons.traffic_rounded : Icons.traffic_outlined,
                        color: _showTraffic ? kPrimary : kTextSub,
                        onTap: () => setState(() => _showTraffic = !_showTraffic),
                        tooltip: 'Traffic Density',
                      ),
                      const SizedBox(height: 10),
                       _buildMapOptionCircle(
                        icon: _voiceNavEnabled ? Icons.volume_up_rounded : Icons.volume_off_rounded,
                        color: _voiceNavEnabled ? kPrimary : kTextSub,
                        onTap: () => setState(() => _voiceNavEnabled = !_voiceNavEnabled),
                        tooltip: 'Voice Navigation',
                      ),
                      const SizedBox(height: 10),
                      _buildMapOptionCircle(
                        icon: Icons.my_location_rounded,
                        color: kPrimary,
                        onTap: _goToCurrentLocation,
                        tooltip: 'Get Current Location',
                      ),
                      const SizedBox(height: 10),
                      _buildRefreshCircle(),
                    ],
                  ),
                ),

                // 4. Bottom Active Delivery Details HUD (if any pending)
                _buildBottomHUD(state),
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
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, 3),
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
            color: _isRefreshing ? kPrimary.withValues(alpha: 0.12) : Colors.white,
            shape: BoxShape.circle,
            border: Border.all(color: _isRefreshing ? kPrimary : kBorder),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 8,
                offset: const Offset(0, 3),
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
                color: _isRefreshing ? kPrimary : kTextSub,
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
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, -0.3),
            end: Offset.zero,
          ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOut)),
          child: child,
        ),
      ),
      child: _showSearch
          ? Column(
              key: const ValueKey('search_open'),
              mainAxisSize: MainAxisSize.min,
              children: [
                // Search input
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: kPrimary.withValues(alpha: 0.3)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
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
                    style: const TextStyle(
                      fontSize: 14,
                      color: kText,
                      fontWeight: FontWeight.w600,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Search by name, address, stop #...',
                      hintStyle: const TextStyle(color: kTextSub, fontSize: 13),
                      prefixIcon: const Icon(Icons.search_rounded, color: kPrimary, size: 20),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? GestureDetector(
                              onTap: () {
                                _searchController.clear();
                                setState(() {
                                  _searchQuery = '';
                                  _searchResults = [];
                                });
                              },
                              child: const Icon(Icons.close_rounded, color: kTextSub, size: 18),
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
                    ),
                  ),
                ),
                // Results dropdown
                if (_searchResults.isNotEmpty) ...
                  [
                    const SizedBox(height: 6),
                    Container(
                      constraints: const BoxConstraints(maxHeight: 240),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: kBorder),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.08),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          )
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: ListView.separated(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          shrinkWrap: true,
                          itemCount: _searchResults.length,
                          separatorBuilder: (_, _) => const Divider(height: 1, indent: 16, endIndent: 16),
                          itemBuilder: (context, index) {
                            final stop = _searchResults[index];
                            Color statusColor;
                            IconData statusIcon;
                            switch (stop.status) {
                              case 'delivered':
                                statusColor = kSuccess;
                                statusIcon = Icons.check_circle_rounded;
                                break;
                              case 'failed':
                                statusColor = kDanger;
                                statusIcon = Icons.cancel_rounded;
                                break;
                              case 'out_for_delivery':
                                statusColor = kAccent;
                                statusIcon = Icons.local_shipping_rounded;
                                break;
                              default:
                                statusColor = kMuted;
                                statusIcon = Icons.circle_outlined;
                            }
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
                              borderRadius: BorderRadius.circular(8),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                child: Row(
                                  children: [
                                    // Stop number badge
                                    Container(
                                      width: 28,
                                      height: 28,
                                      decoration: BoxDecoration(
                                        color: statusColor.withValues(alpha: 0.12),
                                        shape: BoxShape.circle,
                                        border: Border.all(color: statusColor.withValues(alpha: 0.5)),
                                      ),
                                      child: Center(
                                        child: Text(
                                          '${stop.stop}',
                                          style: TextStyle(
                                            color: statusColor,
                                            fontWeight: FontWeight.w900,
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
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                              fontSize: 13,
                                              color: kText,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            stop.address,
                                            style: const TextStyle(
                                              color: kTextSub,
                                              fontSize: 11,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Icon(statusIcon, color: statusColor, size: 16),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                  ]
                else if (_searchQuery.isNotEmpty) ...
                  [
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: kBorder),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.06),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          )
                        ],
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.search_off_rounded, color: kTextSub, size: 16),
                          SizedBox(width: 8),
                          Text(
                            'No stops found',
                            style: TextStyle(color: kTextSub, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ],
              ],
            )
          : const SizedBox.shrink(key: ValueKey('search_closed')),
    );
  }

  Widget _buildBottomHUD(DeliverySessionLoaded state) {
    final groupedStops = state.groupedStops;
    final nextStop = _selectedStop ?? state.nextGroupedDelivery;
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
        child: Stack(
          children: [
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: kBorder),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  )
                ],
              ),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_rounded, color: kSuccess, size: 40),
                  SizedBox(height: 12),
                  Text(
                    'All Deliveries Cleared!',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: kText),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'No pending orders in your route sheet.',
                    style: TextStyle(color: kTextSub, fontSize: 12),
                  ),
                ],
              ),
            ),
            Positioned(
              top: 12,
              right: 12,
              child: GestureDetector(
                onTap: () {
                  setState(() {
                    _hideAllClearedCard = true;
                  });
                },
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: kBorder.withValues(alpha: 0.3),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.close_rounded,
                    size: 16,
                    color: kTextSub,
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return MapDeliverySheet(
      groupedStops: groupedStops,
      nextStop: nextStop,
      onStopSelected: (stop) {
        setState(() {
          _selectedStop = stop;
        });
        _mapController.move(LatLng(stop.addressLat, stop.addressLng), 16.0);
      },
      onShowConfirmation: (stop) => _showConfirmation(context, stop),
    );
  }
}

