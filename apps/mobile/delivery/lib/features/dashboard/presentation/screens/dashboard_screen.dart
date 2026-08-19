import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/core/utils/app_snackbar.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/delivery_confirmation_sheet.dart';
import 'package:f2h_delivery/features/orders/domain/repositories/orders_repository.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/services/mock_data_service.dart';
import 'package:geolocator/geolocator.dart';
import 'package:f2h_delivery/features/dashboard/presentation/widgets/next_delivery_card.dart';
import 'package:f2h_delivery/features/dashboard/presentation/widgets/queue_item_tile.dart';
import 'package:f2h_delivery/features/dashboard/presentation/widgets/verification_pending_view.dart';
import 'package:f2h_delivery/features/dashboard/presentation/widgets/handover_status_card.dart';
import 'package:f2h_delivery/features/dashboard/presentation/widgets/collect_queue_item.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/pickup_selection_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/notifications_screen.dart';
import 'package:f2h_delivery/core/widgets/f2h_hero_header.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final LocationService _locationService = LocationService();
  int _selectedTab = 0;
  bool _isReloading = false;
  Position? _currentPosition;
  Timer? _locationUpdateTimer;

  Future<void> _reloadDashboardOrders() async {
    if (_isReloading) return;
    setState(() => _isReloading = true);
    AppSnackBar.info(context, 'Reloading orders and shift status...');
    try {
      _getCurrentLocation();
      context.read<DeliverySessionBloc>().add(ReloadSessionEvent());
    } catch (e) {
      if (mounted) AppSnackBar.error(context, 'Failed to reload: $e');
    } finally {
      if (mounted) setState(() => _isReloading = false);
    }
  }

  Future<void> _getCurrentLocation() async {
    try {
      final pos = await _locationService.getCurrentPosition();
      if (mounted) setState(() => _currentPosition = pos);
    } catch (_) {}
  }

  String _calculateDistanceStr(GroupedStop stop) {
    if (_currentPosition == null) return "${(stop.stop * 400)}m Away";
    final distKm = _locationService.haversineDistanceKm(
      _currentPosition!.latitude,
      _currentPosition!.longitude,
      stop.addressLat,
      stop.addressLng,
    );
    return distKm < 1 ? "${(distKm * 1000).round()}m Away" : "${distKm.toStringAsFixed(1)}km Away";
  }

  @override
  void initState() {
    super.initState();
    _getCurrentLocation();
    _locationUpdateTimer = Timer.periodic(const Duration(seconds: 30), (_) => _getCurrentLocation());
  }

  @override
  void dispose() {
    _locationUpdateTimer?.cancel();
    super.dispose();
  }

  void _showItemsToCollectDialog(BuildContext context) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(kPrimary),
        ),
      ),
    );

    try {
      final ordersRepo = sl<OrdersRepository>();
      final response = await ordersRepo.getPickupItems();
      if (!mounted) return;
      Navigator.pop(context);
      if (response.status) {
        if (response.items.isEmpty) {
          _showNoItemsAlert(context);
          return;
        }
        final success = await Navigator.push<bool>(
          context,
          MaterialPageRoute(
            builder: (_) => PickupSelectionScreen(response: response),
          ),
        );
        if (success == true && mounted) {
          AppSnackBar.success(context, '✅ Pickup confirmed. Starting deliveries!');
          setState(() => _selectedTab = 1);
        }
      } else {
        AppSnackBar.error(context, response.message ?? 'Failed to fetch items to collect');
      }
    } catch (err) {
      if (!mounted) return;
      Navigator.pop(context);
      AppSnackBar.error(context, 'Error fetching items: $err');
    }
  }

  void _showNoItemsAlert(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Items to Collect', style: TextStyle(fontWeight: FontWeight.w900, color: kText)),
          content: const Text('No items assigned to collect for today.', style: TextStyle(color: kTextSub)),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Close', style: TextStyle(fontWeight: FontWeight.bold, color: kPrimary)),
            ),
          ],
        );
      },
    );
  }

  void _showPickupSummaryDialog(BuildContext context) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(kPrimary),
        ),
      ),
    );

    try {
      final ordersRepo = sl<OrdersRepository>();
      final response = await ordersRepo.getPickupItems();
      if (!mounted) return;
      Navigator.pop(context);
      if (response.status && response.items.isNotEmpty && !response.pickupConfirmed) {
        final success = await Navigator.push<bool>(
          context,
          MaterialPageRoute(
            builder: (_) => PickupSelectionScreen(response: response),
          ),
        );
        if (success == true && mounted) {
          AppSnackBar.success(context, '✅ Pickup confirmed. Starting deliveries!');
          setState(() => _selectedTab = 1);
        }
      } else {
        AppSnackBar.info(context, response.message ?? 'No items to pick up for today.', color: kPrimary);
      }
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context);
      AppSnackBar.error(context, 'Failed to load pickup items: $e');
    }
  }

  void _showConfirmation(BuildContext context, GroupedStop stop) async {
    final position = await _locationService.getCurrentPosition();
    if (position != null) {
      final dist = _locationService.haversineDistanceKm(
        position.latitude,
        position.longitude,
        stop.addressLat,
        stop.addressLng,
      );
      print('[DEBUG] Rider is $dist km away from stop.');
      // Bypassed 300 meters check to allow testing locally
      /*
      if (dist > 0.3) {
        if (mounted) AppSnackBar.error(context, 'Please reach the location to mark as delivered.');
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

          // Show a loading dialog during status update
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
                AppSnackBar.show(
                  context,
                  'Stop #${stop.stop} marked as $status!',
                  backgroundColor: status == 'delivered' ? kSuccess : kDanger,
                );
                if (status == 'delivered') {
                  MockDataService().tabNavigationNotifier.value = 2;
                }
              }
            },
            onError: (errorMsg) {
              if (mounted) {
                Navigator.pop(context); // pop loading dialog
                AppSnackBar.error(context, errorMsg);
              }
            },
          ));
        },
      ),
    );
  }


  /// Availability toggle.
  ///
  /// Lifted out of the old AppBar's inline `Switch.onChanged` so the hero header
  /// can drive it. The GPS and permission gate below is load-bearing: going
  /// online starts live location tracking, so refusing here is what stops a
  /// partner appearing available with no position.
  Future<void> _handleOnlineToggle(bool val) async {
                          if (val) {
                            bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
                            if (!serviceEnabled) {
                              if (mounted) AppSnackBar.error(context, 'GPS/Location services are disabled. Please enable them to go online.');
                              return;
                            }
                            LocationPermission permission = await Geolocator.checkPermission();
                            if (permission == LocationPermission.denied) {
                              permission = await Geolocator.requestPermission();
                              if (permission == LocationPermission.denied) {
                                if (mounted) AppSnackBar.error(context, 'Location permission is required to track live location while online.');
                                return;
                              }
                            }
                            if (permission == LocationPermission.deniedForever) {
                              if (mounted) AppSnackBar.error(context, 'Location permissions are permanently denied. Please enable them in settings.');
                              return;
                            }
                          }
                          context.read<DeliverySessionBloc>().add(ToggleOnlineEvent(
                            val,
                            callback: (error) {
                              if (!mounted) return;
                              if (error != null) {
                                AppSnackBar.error(context, error);
                              } else {
                                AppSnackBar.show(
                                  context,
                                  val ? 'You are now Online.' : 'You are now Offline.',
                                  backgroundColor: val ? kSuccess : kDanger,
                                );
                                if (val) _showPickupSummaryDialog(context);
                              }
                            },
                          ));
                        }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<DeliverySessionBloc, DeliverySessionState>(
      builder: (context, sessionState) {
        if (sessionState is DeliverySessionLoading || sessionState is DeliverySessionInitial) {
          return const Scaffold(
            backgroundColor: kBg,
            body: Center(child: CircularProgressIndicator(color: kPrimary)),
          );
        }

        if (sessionState is DeliverySessionError) {
          return Scaffold(
            backgroundColor: kBg,
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline_rounded, color: kDanger, size: 48),
                  const SizedBox(height: 12),
                  Text(sessionState.message, style: const TextStyle(color: kTextSub)),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => context.read<DeliverySessionBloc>().add(LoadSessionEvent()),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          );
        }

        final session = sessionState as DeliverySessionLoaded;
        final isVerified = session.isVerified;
        final isAccountActive = session.isAccountActive;

        if (!isVerified || !isAccountActive) {
          return Scaffold(
            backgroundColor: kBg,
            body: VerificationPendingView(
              isUnverified: !isVerified,
              onRedirectToProfile: () {
                MockDataService().shouldOpenKycOnProfile = true;
                MockDataService().tabNavigationNotifier.value = 3;
              },
            ),
          );
        }

        final listQueue = session.groupedStops;
        final currentRun = session.currentRun;
        final isShiftCompleted = currentRun?.status == 'handed_over';
        final pickupConfirmed = currentRun != null &&
            (currentRun.status == 'in_progress' ||
                currentRun.status == 'completed' ||
                currentRun.status == 'handed_over');

        final collectQueue = pickupConfirmed
            ? <GroupedStop>[]
            : listQueue.where((stop) => stop.orders.any((o) {
                final s = o.status.toLowerCase().trim();
                return s == 'confirmed' || s == 'assigned' || s == 'packed' || s == 'placed' || s == 'pending';
              })).toList();

        final activeQueue = pickupConfirmed
            ? listQueue
            : listQueue.where((stop) => stop.orders.any((o) {
                final s = o.status.toLowerCase().trim();
                return s == 'out_for_delivery' || s == 'delivered' || s == 'failed';
              })).toList();

        final totalActiveStops = activeQueue.length;
        final completedActiveStops = activeQueue.where((s) => s.status == 'delivered').length;

        final GroupedStop? nextStop = (() {
          for (final s in activeQueue) {
            if (s.status == 'out_for_delivery' || s.status == 'pending') return s;
          }
          return null;
        })();

        return Scaffold(
          backgroundColor: kBg,
          appBar: AppBar(
            backgroundColor: kSurface,
            elevation: 0,
            titleSpacing: 16,
            centerTitle: false,
            automaticallyImplyLeading: false,
            title: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: !session.isOnline
                            ? kDanger
                            : (isShiftCompleted ? kPrimary : kSuccess),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: (!session.isOnline
                                    ? kDanger
                                    : (isShiftCompleted ? kPrimary : kSuccess))
                                .withOpacity(0.35),
                            blurRadius: 6,
                            spreadRadius: 1,
                          )
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      !session.isOnline
                          ? 'SHIFT INACTIVE · OFFLINE'
                          : (isShiftCompleted ? 'SHIFT COMPLETED' : 'SHIFT ACTIVE · ONLINE'),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: !session.isOnline
                            ? kDanger
                            : kPrimary,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    GestureDetector(
                      onTap: _isReloading ? null : _reloadDashboardOrders,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: kPrimaryMid,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(color: kPrimaryMid.withOpacity(0.2), blurRadius: 4, offset: const Offset(0, 2)),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (_isReloading)
                              const SizedBox(
                                width: 12,
                                height: 12,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5),
                              )
                            else
                              const Icon(Icons.refresh_rounded, size: 14, color: Colors.white),
                            const SizedBox(width: 4),
                            const Text('REFRESH', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 11)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Transform.scale(
                      scale: 0.8,
                      alignment: Alignment.centerRight,
                      child: Switch(
                        value: session.isOnline,
                        activeColor: kPrimary,
                        inactiveThumbColor: kTextSub,
                        onChanged: (val) async {
                          if (val) {
                            bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
                            if (!serviceEnabled) {
                              if (mounted) AppSnackBar.error(context, 'GPS/Location services are disabled. Please enable them to go online.');
                              return;
                            }
                            LocationPermission permission = await Geolocator.checkPermission();
                            if (permission == LocationPermission.denied) {
                              permission = await Geolocator.requestPermission();
                              if (permission == LocationPermission.denied) {
                                if (mounted) AppSnackBar.error(context, 'Location permission is required to track live location while online.');
                                return;
                              }
                            }
                            if (permission == LocationPermission.deniedForever) {
                              if (mounted) AppSnackBar.error(context, 'Location permissions are permanently denied. Please enable them in settings.');
                              return;
                            }
                          }
                          context.read<DeliverySessionBloc>().add(ToggleOnlineEvent(
                            val,
                            callback: (error) {
                              if (!mounted) return;
                              if (error != null) {
                                AppSnackBar.error(context, error);
                              } else {
                                AppSnackBar.show(
                                  context,
                                  val ? 'You are now Online.' : 'You are now Offline.',
                                  backgroundColor: val ? kSuccess : kDanger,
                                );
                                if (val) _showPickupSummaryDialog(context);
                              }
                            },
                          ));
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          body: Column(
            children: [
              F2hHeroHeader(
                driverName: session.driverName,
                isOnline: session.isOnline,
                onToggleOnline: _handleOnlineToggle,
                onNotifications: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                ),
              ),
              Expanded(
                child: RefreshIndicator(
            onRefresh: () async => context.read<DeliverySessionBloc>().add(ReloadSessionEvent()),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
              children: [
                if (!session.isOnline) ...[
                  Container(
                    margin: const EdgeInsets.symmetric(vertical: 16),
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: kDanger.withOpacity(0.3)),
                      boxShadow: [
                        BoxShadow(
                          color: kDanger.withOpacity(0.06),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: kDanger.withOpacity(0.1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.power_settings_new_rounded,
                            color: kDanger,
                            size: 36,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'You are Currently Offline',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: kText,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Turn on the SHIFT ACTIVE switch at the top right to go online and view your assigned orders for today.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            color: kTextSub,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ] else if (isShiftCompleted) ...[
                  HandoverStatusCard(currentRun: session.currentRun),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: kBorder),
                      boxShadow: [
                        BoxShadow(
                          color: kPrimary.withOpacity(0.02),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: kSuccess.withOpacity(0.1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.done_all_rounded,
                            color: kSuccess,
                            size: 36,
                          ),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          "You're All Done!",
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: kText,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          "Your deliveries, empty bottles, and returns have been processed and confirmed. Rest up and have a great day!",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            color: kTextSub,
                            height: 1.4,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ] else ...[
                  HandoverStatusCard(currentRun: session.currentRun),
                  const SizedBox(height: 12),
                  // Tab Selector
                  Container(
                    height: 48,
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(color: kBgDeep, borderRadius: BorderRadius.circular(16)),
                    child: Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _selectedTab = 0),
                            child: Container(
                              decoration: BoxDecoration(
                                color: _selectedTab == 0 ? kSurface : Colors.transparent,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Center(
                                child: Text(
                                  'To Collect (${collectQueue.length})',
                                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: _selectedTab == 0 ? kPrimary : kTextSub),
                                ),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _selectedTab = 1),
                            child: Container(
                              decoration: BoxDecoration(
                                color: _selectedTab == 1 ? kSurface : Colors.transparent,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Center(
                                child: Text(
                                  'Active Queue (${activeQueue.length})',
                                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: _selectedTab == 1 ? kPrimary : kTextSub),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  if (_selectedTab == 0) ...[
                    if (collectQueue.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(20), border: Border.all(color: kBorder)),
                        child: const Center(child: Text('No items to collect for today.', style: TextStyle(color: kTextSub, fontWeight: FontWeight.bold))),
                      )
                    else ...[
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [kPrimary, kPrimary.withOpacity(0.8)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [BoxShadow(color: kPrimary.withOpacity(0.2), blurRadius: 10, offset: const Offset(0, 4))],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(12)),
                                  child: const Icon(Icons.inventory_2_rounded, color: Colors.white, size: 24),
                                ),
                                const SizedBox(width: 14),
                                const Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('Collect from Warehouse', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Colors.white)),
                                      SizedBox(height: 2),
                                      Text('Verify and load items before starting', style: TextStyle(fontSize: 12, color: Colors.white70, fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 20),
                            SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white,
                                  foregroundColor: kPrimary,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                onPressed: () => _showItemsToCollectDialog(context),
                                child: const Text('Select & Collect Items', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Text('Orders waiting to be collected', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: kText)),
                      const SizedBox(height: 12),
                      ...collectQueue.map((stop) => CollectQueueItem(stop: stop)),
                    ],
                  ] else ...[
                    if (nextStop != null) ...[
                      NextDeliveryCard(
                        stop: nextStop,
                        distanceStr: _calculateDistanceStr(nextStop),
                        onDeliverTap: () => _showConfirmation(context, nextStop),
                      ),
                      const SizedBox(height: 20),
                    ],
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Delivery Queue Route', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: kText)),
                        Text('$completedActiveStops/$totalActiveStops Done', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: kTextSub)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (activeQueue.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(20), border: Border.all(color: kBorder)),
                        child: const Center(child: Text('No active deliveries. Complete collection first.', style: TextStyle(color: kTextSub, fontWeight: FontWeight.bold))),
                      )
                    else
                      ...List.generate(activeQueue.length, (index) {
                        final stop = activeQueue[index];
                        final isNext = nextStop?.customerId == stop.customerId;
                        return Column(
                          children: [
                            QueueItemTile(
                              stop: stop,
                              isNext: isNext,
                              distanceStr: _calculateDistanceStr(stop),
                              onDeliverTap: () => _showConfirmation(context, stop),
                            ),
                            if (index < activeQueue.length - 1)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                child: Row(
                                  children: [
                                    const SizedBox(width: 38),
                                    Icon(Icons.arrow_downward_rounded, size: 18, color: kMuted.withOpacity(0.5)),
                                  ],
                                ),
                              ),
                          ],
                        );
                      }),
                  ],
                ],
              ],
            ),
          )),
            ],
          ),
        );
      },
    );
  }
}
