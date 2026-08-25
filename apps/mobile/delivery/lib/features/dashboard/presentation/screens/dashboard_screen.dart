import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/core/utils/app_snackbar.dart';
import 'package:f2h_delivery/core/utils/stop_status_helper.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/orders_screen.dart';
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
import 'package:f2h_delivery/features/profile/presentation/screens/profile_screen.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/support_screen.dart';
import 'package:f2h_delivery/core/widgets/f2h_hero_header.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/delivery_basket_modal.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/containers_tracker_modal.dart';
import 'package:f2h_delivery/features/notifications/services/notification_api_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final LocationService _locationService = LocationService();
  final NotificationApiService _notificationService = NotificationApiService();
  int _selectedTab = 0;
  bool _isReloading = false;
  int _unreadNotificationsCount = 0;
  Position? _currentPosition;
  Timer? _locationUpdateTimer;
  bool _isFabMenuOpen = false;
  String _selectedStatusFilter = 'all'; // 'all', 'pending', 'delivered', 'failed'

  Future<void> _reloadDashboardOrders() async {
    if (_isReloading) return;
    setState(() => _isReloading = true);
    AppSnackBar.info(context, 'Reloading orders and shift status...');
    try {
      _getCurrentLocation();
      _loadUnreadNotifications();
      context.read<DeliverySessionBloc>().add(ReloadSessionEvent());
    } catch (e) {
      if (mounted) AppSnackBar.error(context, 'Failed to reload: $e');
    } finally {
      if (mounted) setState(() => _isReloading = false);
    }
  }

  Future<void> _loadUnreadNotifications() async {
    try {
      final res = await _notificationService.getNotificationsWithCount();
      if (mounted) {
        setState(() => _unreadNotificationsCount = res['unreadCount'] as int? ?? 0);
      }
    } catch (_) {}
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
    _loadUnreadNotifications();
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
                            Text('${item.quantity.toInt()} ${item.unit}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: kPrimary)),
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
        onConfirm: (status, emptyBottles, returnedContainers, damagedContainers, lostContainers, notes, paymentMode, paymentStatus, deliveryImage, containerReturns) {
          if (stop.orders.isEmpty) return;
          final orderId = stop.orders.first.orderId;

          showDialog(
            context: context,
            barrierDismissible: false,
            builder: (ctx) => const Center(
              child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(kPrimary)),
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
                AppSnackBar.success(context, 'Stop #${stop.stop} marked as $status!');
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
          for (final s in listQueue) {
            if (!StopStatusHelper.isDelivered(s.status) && !StopStatusHelper.isFailed(s.status)) {
              return s;
            }
          }
          return null;
        })();

        final displayedStops = listQueue.where((stop) {
          if (_selectedStatusFilter == 'all') return true;
          if (_selectedStatusFilter == 'delivered') {
            return stop.status == 'delivered' || stop.status == 'completed';
          }
          if (_selectedStatusFilter == 'failed') {
            return stop.status == 'failed' || stop.status == 'cancelled';
          }
          if (_selectedStatusFilter == 'pending') {
            return stop.status != 'delivered' &&
                stop.status != 'completed' &&
                stop.status != 'failed' &&
                stop.status != 'cancelled';
          }
          return true;
        }).toList();

        final pendingCount = listQueue.where((s) =>
            s.status != 'delivered' &&
            s.status != 'completed' &&
            s.status != 'failed' &&
            s.status != 'cancelled').length;
        final deliveredCount = listQueue.where((s) => s.status == 'delivered' || s.status == 'completed').length;
        final failedCount = listQueue.where((s) => s.status == 'failed' || s.status == 'cancelled').length;

        return Scaffold(
          backgroundColor: const Color(0xFFF8FAFC),
          floatingActionButton: _buildExpandableFab(session, currentRun),
          body: Column(
            children: [
              // ── HERO GREETING HEADER ───────────────────────────────
              F2hHeroHeader(
                driverName: session.driverName,
                isOnline: session.isOnline,
                unreadCount: _unreadNotificationsCount,
                address: nextStop != null
                    ? nextStop.address
                    : (session.currentRun?.runId != null
                        ? 'Run #${session.currentRun!.runId} (${session.currentRun!.slot})'
                        : 'Active and online for assigned runs'),
                addressLabel: nextStop != null ? 'NEXT DELIVERY ADDRESS' : 'CURRENT LOCATION',
                onToggleOnline: _handleOnlineToggle,
                onNotifications: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                  );
                  _loadUnreadNotifications();
                },
                onProfile: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ProfileScreen()),
                  );
                },
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
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF0F172A),
                                letterSpacing: -0.2,
                              ),
                            ),
                            GestureDetector(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => const OrdersScreen()),
                                );
                              },
                              child: Text(
                                'View Details',
                                style: GoogleFonts.poppins(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF16A34A),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // 4 Progress Counter Cards with colorful icons
                        Container(
                          padding: const EdgeInsets.all(12),
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
                              _buildProgressCard(
                                icon: Icons.shopping_bag_outlined,
                                iconColor: const Color(0xFF16A34A),
                                iconBgColor: const Color(0xFFDCFCE7),
                                count: completedActiveStops,
                                label: 'Completed',
                                labelColor: const Color(0xFF16A34A),
                              ),
                              _buildProgressCard(
                                icon: Icons.access_time_rounded,
                                iconColor: const Color(0xFFD97706),
                                iconBgColor: const Color(0xFFFEF3C7),
                                count: ongoingActiveStops,
                                label: 'Ongoing',
                                labelColor: const Color(0xFFD97706),
                              ),
                              _buildProgressCard(
                                icon: Icons.sync_rounded,
                                iconColor: const Color(0xFF2563EB),
                                iconBgColor: const Color(0xFFDBEAFE),
                                count: acceptedActiveStops,
                                label: 'Accepted',
                                labelColor: const Color(0xFF2563EB),
                              ),
                              _buildProgressCard(
                                icon: Icons.cancel_outlined,
                                iconColor: const Color(0xFF64748B),
                                iconBgColor: const Color(0xFFF1F5F9),
                                count: cancelledActiveStops,
                                label: 'Cancelled',
                                labelColor: const Color(0xFF64748B),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 24),

                        // ── SECTION: STOPS LIST ────────────────────────────
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Stops (${displayedStops.length})',
                              style: GoogleFonts.poppins(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF0F172A),
                                letterSpacing: -0.2,
                              ),
                            ),

                            // Filter Dropdown Button
                            PopupMenuButton<String>(
                              initialValue: _selectedStatusFilter,
                              tooltip: 'Filter stops by status',
                              onSelected: (String val) {
                                setState(() => _selectedStatusFilter = val);
                              },
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: _selectedStatusFilter == 'all' ? const Color(0xFFF1F5F9) : const Color(0xFFDCFCE7),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: _selectedStatusFilter == 'all' ? const Color(0xFFCBD5E1) : const Color(0xFF86EFAC),
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.filter_list_rounded,
                                      size: 15,
                                      color: _selectedStatusFilter == 'all' ? const Color(0xFF64748B) : const Color(0xFF15803D),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      _selectedStatusFilter == 'all'
                                          ? 'All'
                                          : (_selectedStatusFilter == 'pending'
                                              ? 'Pending ($pendingCount)'
                                              : (_selectedStatusFilter == 'delivered'
                                                  ? 'Delivered ($deliveredCount)'
                                                  : 'Failed ($failedCount)')),
                                      style: GoogleFonts.poppins(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w700,
                                        color: _selectedStatusFilter == 'all' ? const Color(0xFF64748B) : const Color(0xFF15803D),
                                      ),
                                    ),
                                    const SizedBox(width: 2),
                                    Icon(
                                      Icons.arrow_drop_down_rounded,
                                      size: 18,
                                      color: _selectedStatusFilter == 'all' ? const Color(0xFF64748B) : const Color(0xFF15803D),
                                    ),
                                  ],
                                ),
                              ),
                              itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
                                PopupMenuItem<String>(
                                  value: 'all',
                                  child: Row(
                                    children: [
                                      Icon(Icons.list_alt_rounded, size: 18, color: _selectedStatusFilter == 'all' ? kPrimary : kTextSub),
                                      const SizedBox(width: 8),
                                      Text(
                                        'All Stops (${listQueue.length})',
                                        style: TextStyle(
                                          fontWeight: _selectedStatusFilter == 'all' ? FontWeight.bold : FontWeight.normal,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                PopupMenuItem<String>(
                                  value: 'pending',
                                  child: Row(
                                    children: [
                                      const Icon(Icons.access_time_rounded, size: 18, color: Color(0xFFD97706)),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Pending ($pendingCount)',
                                        style: TextStyle(
                                          fontWeight: _selectedStatusFilter == 'pending' ? FontWeight.bold : FontWeight.normal,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                PopupMenuItem<String>(
                                  value: 'delivered',
                                  child: Row(
                                    children: [
                                      const Icon(Icons.check_circle_rounded, size: 18, color: Color(0xFF16A34A)),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Delivered ($deliveredCount)',
                                        style: TextStyle(
                                          fontWeight: _selectedStatusFilter == 'delivered' ? FontWeight.bold : FontWeight.normal,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                PopupMenuItem<String>(
                                  value: 'failed',
                                  child: Row(
                                    children: [
                                      const Icon(Icons.cancel_rounded, size: 18, color: Color(0xFFDC2626)),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Failed ($failedCount)',
                                        style: TextStyle(
                                          fontWeight: _selectedStatusFilter == 'failed' ? FontWeight.bold : FontWeight.normal,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        if (displayedStops.isEmpty)
                          Container(
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Center(
                              child: Text(
                                _selectedStatusFilter == 'all'
                                    ? 'No stops assigned for today.'
                                    : 'No $_selectedStatusFilter stops found.',
                                style: GoogleFonts.poppins(
                                  color: const Color(0xFF64748B),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          )
                        else
                          ...List.generate(displayedStops.length, (index) {
                            final stop = displayedStops[index];
                            final isNext = nextStop != null &&
                                ((nextStop.addressId.isNotEmpty && nextStop.addressId == stop.addressId) ||
                                    (nextStop.addressId.isEmpty && nextStop.customerId == stop.customerId));
                            return Column(
                              children: [
                                QueueItemTile(
                                  stop: stop,
                                  isNext: isNext,
                                  distanceStr: _calculateDistanceStr(stop),
                                  onDeliverTap: () => _showConfirmation(context, stop),
                                ),
                                if (index < displayedStops.length - 1)
                                  const SizedBox(height: 10),
                              ],
                            );
                          }),
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

  Widget _buildProgressCard({
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required int count,
    required String label,
    required Color labelColor,
  }) {
    return Expanded(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: iconBgColor,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(height: 8),
          Text(
            '$count',
            style: GoogleFonts.poppins(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF0F172A),
              height: 1.1,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 10.5,
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

  Widget _buildExpandableFab(DeliverySessionLoaded session, dynamic currentRun) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (_isFabMenuOpen) ...[
          _buildFabOption(
            label: 'Basket',
            icon: Icons.shopping_basket_outlined,
            iconColor: const Color(0xFF16A34A),
            bgColor: const Color(0xFFDCFCE7),
            onTap: () {
              setState(() => _isFabMenuOpen = false);
              DeliveryBasketModal.show(
                context,
                session.orders,
                groupedStops: session.groupedStops,
                currentRun: currentRun,
              );
            },
          ),
          const SizedBox(height: 12),
          _buildFabOption(
            label: 'Help Center',
            icon: Icons.help_outline_rounded,
            iconColor: const Color(0xFF9333EA),
            bgColor: const Color(0xFFFAF5FF),
            onTap: () {
              setState(() => _isFabMenuOpen = false);
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const SupportScreen(initialTabIndex: 1),
                ),
              );
            },
          ),
          const SizedBox(height: 12),
          _buildFabOption(
            label: 'Containers',
            icon: Icons.all_inbox_outlined,
            iconColor: const Color(0xFF2563EB),
            bgColor: const Color(0xFFEFF6FF),
            onTap: () {
              setState(() => _isFabMenuOpen = false);
              ContainersTrackerModal.show(
                context,
                session.groupedStops,
                currentRun: currentRun,
              );
            },
          ),
          const SizedBox(height: 16),
        ],
        FloatingActionButton(
          heroTag: 'dashboard_fab_actions',
          onPressed: () {
            setState(() {
              _isFabMenuOpen = !_isFabMenuOpen;
            });
          },
          backgroundColor: const Color(0xFF16A34A),
          elevation: 4,
          shape: const CircleBorder(),
          child: AnimatedRotation(
            turns: _isFabMenuOpen ? 0.125 : 0.0,
            duration: const Duration(milliseconds: 200),
            child: const Icon(
              Icons.add_rounded,
              color: Colors.white,
              size: 28,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFabOption({
    required String label,
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Text(
              label,
              style: GoogleFonts.poppins(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF0F172A),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.12),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Center(
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: bgColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: iconColor, size: 18),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
