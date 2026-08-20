import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
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
import 'package:f2h_delivery/features/dashboard/presentation/widgets/pickup_status_card.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/pickup_selection_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/notifications_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/support_screen.dart';
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
      if (response.status && response.items.isNotEmpty) {
        showDialog(
          context: context,
          builder: (dialogContext) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: kPrimary.withOpacity(0.1), shape: BoxShape.circle),
                    child: const Icon(Icons.inventory_2_rounded, color: kPrimary, size: 22),
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text('Morning Pickup Ready', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: kText)),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'You have ${response.items.length} items ready for warehouse collection today.',
                    style: const TextStyle(color: kTextSub, fontSize: 13, height: 1.4),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: kBgDeep, borderRadius: BorderRadius.circular(12)),
                    child: Column(
                      children: response.items.take(3).map((item) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(item.productName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: kText), maxLines: 1, overflow: TextOverflow.ellipsis),
                            ),
                            Text('${item.totalQuantity} Units', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: kPrimary)),
                          ],
                        ),
                      )).toList(),
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Later', style: TextStyle(color: kTextSub, fontWeight: FontWeight.bold)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: kPrimary, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                  onPressed: () {
                    Navigator.pop(dialogContext);
                    _showItemsToCollectDialog(context);
                  },
                  child: const Text('Start Pickup', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      }
    } catch (_) {
      if (mounted) Navigator.pop(context);
    }
  }

  void _showConfirmation(BuildContext context, GroupedStop stop) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => DeliveryConfirmationSheet(
        stop: stop,
        onDelivered: (deliveredOrders, returnedOrders, returnReason, emptyBottles, customerUnavailable) {
          showDialog(
            context: context,
            barrierDismissible: false,
            builder: (ctx) => const Center(child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(kPrimary))),
          );

          context.read<DeliverySessionBloc>().add(MarkDeliveredEvent(
            orderIds: deliveredOrders.map((o) => o.orderId).toList(),
            emptyBottles: emptyBottles,
            returnedOrders: returnedOrders.map((o) => o.orderId).toList(),
            returnReason: returnReason,
            customerUnavailable: customerUnavailable,
            onSuccess: (isLastDelivery) {
              if (mounted) {
                Navigator.pop(context); // pop loading dialog
                AppSnackBar.success(context, 'Delivery marked successfully!');
                if (isLastDelivery) {
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
    if (!mounted) return;
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
            backgroundColor: Color(0xFFF8FAFC),
            body: Center(child: CircularProgressIndicator(color: kPrimary)),
          );
        }

        if (sessionState is DeliverySessionError) {
          return Scaffold(
            backgroundColor: const Color(0xFFF8FAFC),
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
            backgroundColor: const Color(0xFFF8FAFC),
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

        final completedActiveStops = activeQueue.where((s) => s.status == 'delivered').length;
        final ongoingActiveStops = activeQueue.where((s) => s.status == 'out_for_delivery' || s.status == 'pending').length;
        final acceptedActiveStops = listQueue.length;
        final cancelledActiveStops = activeQueue.where((s) => s.status == 'failed' || s.status == 'cancelled').length;

        final GroupedStop? nextStop = (() {
          for (final s in activeQueue) {
            if (s.status == 'out_for_delivery' || s.status == 'pending') return s;
          }
          return null;
        })();

        return Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          body: Column(
            children: [
              // ── HERO GREETING HEADER ───────────────────────────────
              F2hHeroHeader(
                driverName: session.driverName,
                isOnline: session.isOnline,
                onToggleOnline: _handleOnlineToggle,
                onNotifications: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                ),
              ),

              // ── SCROLLABLE DASHBOARD BODY ───────────────────────────
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async => context.read<DeliverySessionBloc>().add(ReloadSessionEvent()),
                  color: kPrimary,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                    children: [
                      if (!session.isOnline) ...[
                        Container(
                          margin: const EdgeInsets.symmetric(vertical: 16),
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(24),
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
                                style: GoogleFonts.poppins(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Turn on the Online switch in the header to go online and receive your assigned delivery batches.',
                                textAlign: TextAlign.center,
                                style: GoogleFonts.poppins(
                                  fontSize: 12.5,
                                  color: const Color(0xFF64748B),
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
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x06000000),
                                blurRadius: 10,
                                offset: Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: const BoxDecoration(
                                  color: Color(0xFFDCFCE7),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.done_all_rounded,
                                  color: Color(0xFF16A34A),
                                  size: 36,
                                ),
                              ),
                              const SizedBox(height: 16),
                              Text(
                                "You're All Done!",
                                style: GoogleFonts.poppins(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                "Your deliveries, empty containers, and returns have been processed and confirmed. Rest up and have a great day!",
                                textAlign: TextAlign.center,
                                style: GoogleFonts.poppins(
                                  fontSize: 12.5,
                                  color: const Color(0xFF64748B),
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ] else ...[
                        // ── SECTION 1: TODAY'S PROGRESS ─────────────────────
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              "Today's Progress",
                              style: GoogleFonts.poppins(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF0F172A),
                                letterSpacing: -0.2,
                              ),
                            ),
                            GestureDetector(
                              onTap: () {
                                MockDataService().tabNavigationNotifier.value = 1;
                              },
                              child: Text(
                                'View Details',
                                style: GoogleFonts.poppins(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF16A34A),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),

                        // 4 Progress Counter Cards
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x04000000),
                                blurRadius: 8,
                                offset: Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              _buildProgressItem(
                                count: completedActiveStops,
                                label: 'Completed',
                                icon: Icons.shopping_bag_outlined,
                                iconBg: const Color(0xFFDCFCE7),
                                iconColor: const Color(0xFF16A34A),
                                labelColor: const Color(0xFF15803D),
                              ),
                              _buildProgressItem(
                                count: ongoingActiveStops,
                                label: 'Ongoing',
                                icon: Icons.access_time_rounded,
                                iconBg: const Color(0xFFFEF3C7),
                                iconColor: const Color(0xFFD97706),
                                labelColor: const Color(0xFFB45309),
                              ),
                              _buildProgressItem(
                                count: acceptedActiveStops,
                                label: 'Accepted',
                                icon: Icons.sync_rounded,
                                iconBg: const Color(0xFFDBEAFE),
                                iconColor: const Color(0xFF2563EB),
                                labelColor: const Color(0xFF1D4ED8),
                              ),
                              _buildProgressItem(
                                count: cancelledActiveStops,
                                label: 'Cancelled',
                                icon: Icons.cancel_outlined,
                                iconBg: const Color(0xFFF1F5F9),
                                iconColor: const Color(0xFF64748B),
                                labelColor: const Color(0xFF475569),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 20),

                        // ── SECTION 2: NEXT DELIVERY ─────────────────────────
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Next Delivery',
                              style: GoogleFonts.poppins(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF0F172A),
                                letterSpacing: -0.2,
                              ),
                            ),
                            GestureDetector(
                              onTap: () {
                                MockDataService().tabNavigationNotifier.value = 1;
                              },
                              child: Text(
                                'View All',
                                style: GoogleFonts.poppins(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF16A34A),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),

                        if (nextStop != null) ...[
                          NextDeliveryCard(
                            stop: nextStop,
                            distanceStr: _calculateDistanceStr(nextStop),
                            onDeliverTap: () => _showConfirmation(context, nextStop),
                          ),
                        ] else ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Center(
                              child: Text(
                                'No active next delivery. Check orders queue below.',
                                style: GoogleFonts.poppins(
                                  color: const Color(0xFF64748B),
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ),
                        ],

                        const SizedBox(height: 20),

                        // ── SECTION 3: QUICK ACTIONS ────────────────────────
                        Text(
                          'Quick Actions',
                          style: GoogleFonts.poppins(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF0F172A),
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 10),

                        Row(
                          children: [
                            _buildQuickActionCard(
                              label: 'My Routes',
                              icon: Icons.map_outlined,
                              cardBg: const Color(0xFFECFDF5),
                              borderColor: const Color(0xFFA7F3D0),
                              iconColor: const Color(0xFF16A34A),
                              onTap: () {
                                MockDataService().tabNavigationNotifier.value = 2;
                              },
                            ),
                            const SizedBox(width: 10),
                            _buildQuickActionCard(
                              label: 'Help Center',
                              icon: Icons.help_outline_rounded,
                              cardBg: const Color(0xFFFAF5FF),
                              borderColor: const Color(0xFFE9D5FF),
                              iconColor: const Color(0xFF9333EA),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const SupportScreen(initialTabIndex: 1),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            _buildQuickActionCard(
                              label: 'Support',
                              icon: Icons.headset_mic_outlined,
                              cardBg: const Color(0xFFFFFBEB),
                              borderColor: const Color(0xFFFDE68A),
                              iconColor: const Color(0xFFEA580C),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const SupportScreen(initialTabIndex: 0),
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 18),

                        // ── SECTION 4: STEP 1 OF SHIFT / PICKUP CARD ────────
                        if (currentRun != null) ...[
                          PickupStatusCard(currentRun: currentRun),
                          const SizedBox(height: 12),
                        ],

                        // ── SECTION 5: QUEUE TABS & ORDER ITEMS ─────────────
                        Container(
                          height: 48,
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(16)),
                          child: Row(
                            children: [
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => setState(() => _selectedTab = 0),
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: _selectedTab == 0 ? Colors.white : Colors.transparent,
                                      borderRadius: BorderRadius.circular(12),
                                      boxShadow: _selectedTab == 0
                                          ? const [BoxShadow(color: Color(0x08000000), blurRadius: 4, offset: Offset(0, 2))]
                                          : null,
                                    ),
                                    child: Center(
                                      child: Text(
                                        'To Collect (${collectQueue.length})',
                                        style: GoogleFonts.poppins(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 12.5,
                                          color: _selectedTab == 0 ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                                        ),
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
                                      color: _selectedTab == 1 ? Colors.white : Colors.transparent,
                                      borderRadius: BorderRadius.circular(12),
                                      boxShadow: _selectedTab == 1
                                          ? const [BoxShadow(color: Color(0x08000000), blurRadius: 4, offset: Offset(0, 2))]
                                          : null,
                                    ),
                                    child: Center(
                                      child: Text(
                                        'Active Queue (${activeQueue.length})',
                                        style: GoogleFonts.poppins(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 12.5,
                                          color: _selectedTab == 1 ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        if (_selectedTab == 0) ...[
                          if (collectQueue.isEmpty)
                            Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE2E8F0))),
                              child: Center(child: Text('No items to collect for today.', style: GoogleFonts.poppins(color: const Color(0xFF64748B), fontWeight: FontWeight.w600))),
                            )
                          else ...[
                            ...collectQueue.map((stop) => CollectQueueItem(stop: stop)),
                          ],
                        ] else ...[
                          if (activeQueue.isEmpty)
                            Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE2E8F0))),
                              child: Center(child: Text('No active deliveries. Complete collection first.', style: GoogleFonts.poppins(color: const Color(0xFF64748B), fontWeight: FontWeight.w600))),
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
                                    const SizedBox(height: 10),
                                ],
                              );
                            }),
                        ],
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildProgressItem({
    required int count,
    required String label,
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required Color labelColor,
  }) {
    return Expanded(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBg,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 18),
          ),
          const SizedBox(height: 6),
          Text(
            '$count',
            style: GoogleFonts.poppins(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 1),
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: labelColor,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionCard({
    required String label,
    required IconData icon,
    required Color cardBg,
    required Color borderColor,
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: Container(
        height: 72,
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: borderColor),
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, color: iconColor, size: 22),
                  const SizedBox(height: 5),
                  Text(
                    label,
                    style: GoogleFonts.poppins(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF0F172A),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
