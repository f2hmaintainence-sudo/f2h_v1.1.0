import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/services/mock_data_service.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/order_detail_screen.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/delivery_confirmation_sheet.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/warehouse_handover_screen.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/containers_tracker_modal.dart';
import 'package:f2h_delivery/features/tracking/presentation/screens/map_screen.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/pickup_required_dialog.dart';
import 'package:f2h_delivery/features/orders/presentation/widgets/delivery_result_dialog.dart';
import 'package:f2h_delivery/features/profile/presentation/screens/profile_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> with SingleTickerProviderStateMixin {
  final LocationService _locationService = LocationService();
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  List<GroupedStop> _getPendingStops(List<GroupedStop> allStops) {
    List<GroupedStop> list = allStops.where((stop) {
      return stop.orders.any((o) {
        final statusLower = o.status.toLowerCase().trim();
        return statusLower == 'out_for_delivery' ||
            statusLower == 'confirmed' ||
            statusLower == 'assigned' ||
            statusLower == 'packed' ||
            statusLower == 'pending' ||
            statusLower == 'placed';
      });
    }).toList();
    if (_searchQuery.isNotEmpty) {
      list = list.where((s) =>
          s.customerName.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          s.address.toLowerCase().contains(_searchQuery.toLowerCase())).toList();
    }
    return list;
  }

  List<GroupedStop> _getCompletedStops(List<GroupedStop> allStops) {
    List<GroupedStop> list = allStops.where((stop) {
      return stop.orders.every((o) {
        final statusLower = o.status.toLowerCase().trim();
        return statusLower == 'delivered' || statusLower == 'completed';
      });
    }).toList();
    if (_searchQuery.isNotEmpty) {
      list = list.where((s) =>
          s.customerName.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          s.address.toLowerCase().contains(_searchQuery.toLowerCase())).toList();
    }
    return list;
  }

  List<GroupedStop> _getFailedStops(List<GroupedStop> allStops) {
    List<GroupedStop> list = allStops.where((stop) {
      return stop.orders.every((o) {
        final statusLower = o.status.toLowerCase().trim();
        return statusLower == 'failed' || statusLower == 'cancelled';
      });
    }).toList();
    if (_searchQuery.isNotEmpty) {
      list = list.where((s) =>
          s.customerName.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          s.address.toLowerCase().contains(_searchQuery.toLowerCase())).toList();
    }
    return list;
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

    final position = await _locationService.getCurrentPosition();
    if (position != null) {
      final dist = _locationService.haversineDistanceKm(
        position.latitude,
        position.longitude,
        stop.addressLat,
        stop.addressLng,
      );
      print('[DEBUG] Rider is $dist km away from stop.');
    }

    if (!mounted) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DeliveryConfirmationSheet(
        stop: stop,
        onConfirm: (status, emptyBottles, returnedContainers, damagedContainers, lostContainers, notes, paymentMode, paymentStatus, deliveryImage, containerReturns, containerDeliveries) {
          if (stop.orders.isEmpty) return;
          final orderId = stop.orders.first.orderId;

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
            onError: (errorMsg) {
              if (mounted) {
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

  void _callPhone(String phone) async {
    final url = Uri.parse('tel:$phone');
    if (await launchUrl(url)) {
      // success
    }
  }

  void _openNav(GroupedStop stop) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MapScreen(
          focusedStop: stop,
          isStandalonePage: true,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<DeliverySessionBloc, DeliverySessionState>(
      builder: (context, sessionState) {
        final allStops = sessionState is DeliverySessionLoaded
            ? sessionState.groupedStops
            : <GroupedStop>[];
        final pending = _getPendingStops(allStops);
        final completed = _getCompletedStops(allStops);
        final failed = _getFailedStops(allStops);

        return Scaffold(
      backgroundColor: kBg,
      appBar: F2hAppBar(
        title: 'Stops Ledger',
        actions: const [],
        bottom: TabBar(
          controller: _tabController,
          labelColor: kPrimary,
          unselectedLabelColor: kTextSub,
          indicatorColor: kPrimary,
          indicatorWeight: 3.5,
          indicatorSize: TabBarIndicatorSize.label,
          labelStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: [
            Tab(text: 'Pending (${pending.length})'),
            Tab(text: 'Completed (${completed.length})'),
            Tab(text: 'Failed (${failed.length})'),
          ],
        ),
      ),
      body: Column(
        children: [
          _buildHandoverStatusCard(context),
          _buildBottleManagementCard(),
          // Search box
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              controller: _searchController,
              onChanged: (val) => setState(() => _searchQuery = val),
              decoration: InputDecoration(
                hintText: 'Search by customer, route, or address...',
                hintStyle: const TextStyle(color: kMuted, fontSize: 13, fontWeight: FontWeight.w500),
                prefixIcon: const Icon(Icons.search_rounded, color: kTextSub, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, color: kTextSub, size: 20),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                fillColor: kSurface,
                filled: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: kBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: kBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: kPrimary, width: 1.5),
                ),
              ),
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: kText),
            ),
          ),

          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildStopsList(pending),
                _buildStopsList(completed),
                _buildStopsList(failed),
              ],
            ),
          ),
        ],
      ),
        );
      },
    );
  }

  Widget _buildStopsList(List<GroupedStop> filtered) {
    return RefreshIndicator(
      onRefresh: () async => context.read<DeliverySessionBloc>().add(ReloadSessionEvent()),
      child: filtered.isEmpty
          ? SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Container(
                height: MediaQuery.of(context).size.height * 0.5,
                alignment: Alignment.center,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.inventory_2_outlined, size: 48, color: kMuted.withValues(alpha: 0.5)),
                    const SizedBox(height: 12),
                    const Text(
                      'No matching stops found',
                      style: TextStyle(fontWeight: FontWeight.w800, color: kTextSub, fontSize: 14),
                    ),
                  ],
                ),
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 80),
              itemCount: filtered.length,
              itemBuilder: (ctx, idx) {
                final stop = filtered[idx];
                return _buildOrderCard(context, stop);
              },
            ),
    );
  }

  Widget _buildOrderCard(BuildContext context, GroupedStop stop) {
    final statusLower = stop.status.toLowerCase();
    final isDone = statusLower == 'delivered' || 
                   statusLower == 'failed' || 
                   statusLower == 'completed' || 
                   statusLower == 'cancelled';
    const primaryColor = kPrimary;

    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => OrderDetailScreen(stop: stop)),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: stop.status == 'delivered'
                ? kSuccess.withValues(alpha: 0.3)
                : (stop.status == 'failed' ? kDanger.withValues(alpha: 0.3) : const Color(0xFFE2E8F0)),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: kText.withValues(alpha: 0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            )
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Customer Details & Quick Action Icons (Phone + Navigate)
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  CircleAvatar(
                    backgroundColor: primaryColor.withValues(alpha: 0.12),
                    radius: 22,
                    child: Text(
                      stop.customerName.isNotEmpty ? stop.customerName[0].toUpperCase() : '?',
                      style: const TextStyle(fontWeight: FontWeight.w900, color: primaryColor, fontSize: 17),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          stop.customerName,
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15.5, color: kText),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          stop.customerPhone,
                          style: const TextStyle(fontSize: 13, color: kTextSub, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                  // Quick Action Icons: Call & Navigate
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      GestureDetector(
                        onTap: () => _callPhone(stop.customerPhone),
                        child: Container(
                          padding: const EdgeInsets.all(9),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFFDBEAFE)),
                          ),
                          child: const Icon(Icons.phone_rounded, color: Color(0xFF2563EB), size: 18),
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () => _openNav(stop),
                        child: Container(
                          padding: const EdgeInsets.all(9),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFFDCFCE7)),
                          ),
                          child: const Icon(Icons.navigation_rounded, color: Color(0xFF16A34A), size: 18),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Address Row
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.location_on_outlined, color: kMuted, size: 16),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      stop.address,
                      style: const TextStyle(fontSize: 12.5, color: kTextSub, height: 1.35),
                    ),
                  ),
                ],
              ),

              // Deliver Button or Delivered Status
              if (!isDone) ...[
                const SizedBox(height: 14),
                Builder(
                  builder: (ctx) {
                    final session = ctx.watch<DeliverySessionBloc>().state is DeliverySessionLoaded
                        ? ctx.watch<DeliverySessionBloc>().state as DeliverySessionLoaded
                        : null;
                    final isPickupConfirmed = session?.isPickupConfirmed ?? true;
                    final btnColor = isPickupConfirmed ? primaryColor : const Color(0xFFD97706);

                    return GestureDetector(
                      onTap: () {
                        if (!isPickupConfirmed && session != null) {
                          showPickupRequiredDialog(
                            context,
                            orders: session.orders,
                            groupedStops: session.groupedStops,
                            currentRun: session.currentRun,
                          );
                        } else {
                          _showConfirmation(context, stop);
                        }
                      },
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: btnColor,
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: btnColor.withValues(alpha: 0.2),
                              blurRadius: 8,
                              offset: const Offset(0, 3),
                            )
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              isPickupConfirmed ? Icons.check_circle_rounded : Icons.warehouse_rounded,
                              color: Colors.white,
                              size: 17,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              isPickupConfirmed ? 'Deliver' : 'Pickup Required from Warehouse',
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ] else ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: stop.status == 'delivered'
                        ? kSuccess.withValues(alpha: 0.08)
                        : kDanger.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: stop.status == 'delivered'
                          ? kSuccess.withValues(alpha: 0.2)
                          : kDanger.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        stop.status == 'delivered' ? Icons.check_circle_rounded : Icons.cancel_rounded,
                        color: stop.status == 'delivered' ? kSuccess : kDanger,
                        size: 16,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        stop.status == 'delivered' ? 'Delivered' : 'Delivery Failed / Cancelled',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: stop.status == 'delivered' ? kSuccess : kDanger,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg;
    Color fg;
    String text;

    switch (status.toLowerCase().trim()) {
      case 'delivered':
        bg = kSuccess.withValues(alpha: 0.12);
        fg = kSuccess;
        text = 'Delivered';
        break;
      case 'failed':
        bg = kDanger.withValues(alpha: 0.12);
        fg = kDanger;
        text = 'Failed';
        break;
      case 'out_for_delivery':
        bg = kAccent.withValues(alpha: 0.12);
        fg = kAccent;
        text = 'Out For Delivery';
        break;
      case 'confirmed':
      case 'placed':
        bg = kPrimary.withValues(alpha: 0.12);
        fg = kPrimary;
        text = 'Confirmed';
        break;
      case 'packed':
        bg = Colors.orange.withValues(alpha: 0.12);
        fg = Colors.orange.shade800;
        text = 'Packed';
        break;
      case 'assigned':
        bg = Colors.blue.withValues(alpha: 0.12);
        fg = Colors.blue;
        text = 'Assigned';
        break;
      default:
        bg = kBorder;
        fg = kTextSub;
        text = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: fg, letterSpacing: 0.3),
      ),
    );
  }

  Widget _buildActionBtn(IconData icon, String label, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2), width: 1.2),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 15),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottleManagementCard() {
    final sessionState = context.read<DeliverySessionBloc>().state;
    final session = sessionState is DeliverySessionLoaded ? sessionState : null;
    final expected = session?.expectedBottlesCount ?? 0;
    final collected = session?.collectedBottlesCount ?? 0;
    final outstanding = session?.bottlesStillOutstanding ?? 0;
    final toReturn = session?.collectedBottlesCount ?? 0;

    if (expected == 0 && collected == 0 && outstanding == 0) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: kText.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.opacity_rounded, color: Colors.teal, size: 20),
              const SizedBox(width: 8),
              const Text(
                'Bottle Tracker Today',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 14,
                  color: kText,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildBottleMetricTile('Dispatched', expected.toString(), Colors.blue),
              const SizedBox(width: 8),
              _buildBottleMetricTile('Collected', collected.toString(), kSuccess),
              const SizedBox(width: 8),
              _buildBottleMetricTile('Outstanding', outstanding.toString(), Colors.orange),
              const SizedBox(width: 8),
              _buildBottleMetricTile('To Return', toReturn.toString(), Colors.teal),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottleMetricTile(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.15), width: 1),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w800,
                color: kTextSub,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHandoverStatusCard(BuildContext context) {
    final sessionState = context.read<DeliverySessionBloc>().state;
    final session = sessionState is DeliverySessionLoaded ? sessionState : null;
    final currentRun = session?.currentRun;
    if (session == null || currentRun == null) return const SizedBox.shrink();

    final allOrdersDone = session.orders.isNotEmpty &&
        session.orders.every((o) =>
            o.status == 'delivered' ||
            o.status == 'failed' ||
            o.status == 'completed' ||
            o.status == 'cancelled');

    final isCompleted = currentRun.status == 'completed' ||
        (allOrdersDone && currentRun.status != 'handed_over');

    if (isCompleted) {
      return Container(
        margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kDanger.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kDanger.withValues(alpha: 0.2), width: 1.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: const BoxDecoration(
                    color: Colors.redAccent,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.warehouse_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Delivery Run Completed!',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                          color: kText,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Proceed to container reconciliation to return empty bottles and containers.',
                        style: TextStyle(
                          fontSize: 12,
                          color: kTextSub,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ElevatedButton(
              onPressed: () {
                final sessionState = context.read<DeliverySessionBloc>().state;
                final stops = sessionState is DeliverySessionLoaded ? sessionState.groupedStops : <GroupedStop>[];
                ContainersTrackerModal.show(
                  context,
                  stops,
                  currentRun: currentRun,
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.inventory_2_outlined, size: 16),
                  SizedBox(width: 6),
                  Text(
                    'CONTAINER RECONCILIATION',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (currentRun.status == 'handed_over') {
      return Container(
        margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: kSuccess.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kSuccess.withValues(alpha: 0.2), width: 1.5),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: const BoxDecoration(
                color: kSuccess,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_outline_rounded,
                color: Colors.white,
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Shift Completed!',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                      color: kText,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Warehouse handover checked and closed successfully. Have a great day!',
                    style: TextStyle(
                      fontSize: 12,
                      color: kTextSub,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }
}
