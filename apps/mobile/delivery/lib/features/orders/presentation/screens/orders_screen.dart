import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_delivery/theme/app_colors.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/services/mock_data_service.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/order_detail_screen.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/delivery_confirmation_sheet.dart';
import 'package:f2h_delivery/features/orders/presentation/screens/warehouse_handover_screen.dart';
import 'package:f2h_delivery/features/tracking/presentation/screens/map_screen.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_event.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

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
                if (status == 'delivered') {
                  MockDataService().tabNavigationNotifier.value = 2;
                }
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

  void _callPhone(String phone) async {
    final url = Uri.parse('tel:$phone');
    if (await launchUrl(url)) {
      // success
    }
  }

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.logout_rounded, color: kDanger),
            SizedBox(width: 10),
            Text('Logout', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text(
          'Are you sure you want to log out of your account?',
          style: TextStyle(fontSize: 13, color: kTextSub),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: kTextSub, fontWeight: FontWeight.bold)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<AuthBloc>().add(LogoutRequested());
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: kDanger,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Logout', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
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
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: kDanger, size: 20),
            tooltip: 'Logout',
            onPressed: () => _showLogoutDialog(context),
          ),
          const SizedBox(width: 4),
        ],
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
          : (() {
              // Group stops by route name
              final Map<String, List<GroupedStop>> routeStops = {};
              for (var stop in filtered) {
                var name = stop.orders.first.routeName ?? stop.orders.first.routeId ?? stop.orders.first.runId ?? 'Unassigned Route';
                if (name == stop.orders.first.runId) {
                  name = 'Run: $name';
                }
                routeStops.putIfAbsent(name, () => []).add(stop);
              }
              
              final routeNames = routeStops.keys.toList();

              return ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 80),
                itemCount: routeNames.length,
                itemBuilder: (ctx, idx) {
                  final routeName = routeNames[idx];
                  final stops = routeStops[routeName]!;
                  final totalStops = stops.length;
                  final deliveredCount = stops.where((s) => s.status == 'delivered').length;
                  final pendingCount = totalStops - deliveredCount;

                  return Theme(
                    data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 14),
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
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: ExpansionTile(
                          backgroundColor: Colors.transparent,
                          collapsedBackgroundColor: Colors.transparent,
                          iconColor: kPrimary,
                          collapsedIconColor: kTextSub,
                          title: Text(
                            routeName,
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 15,
                              color: kText,
                            ),
                          ),
                          subtitle: Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Row(
                              children: [
                                Text(
                                  '$totalStops Stops',
                                  style: const TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  width: 4,
                                  height: 4,
                                  decoration: const BoxDecoration(color: kBorder, shape: BoxShape.circle),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  '$deliveredCount Done',
                                  style: const TextStyle(fontSize: 11, color: kSuccess, fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  width: 4,
                                  height: 4,
                                  decoration: const BoxDecoration(color: kBorder, shape: BoxShape.circle),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  '$pendingCount Wait',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: pendingCount > 0 ? kAccent : kTextSub,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          childrenPadding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
                          children: stops.map((stop) => _buildOrderCard(context, stop)).toList(),
                        ),
                      ),
                    ),
                  );
                },
              );
            })(),
    );
  }

  Widget _buildOrderCard(BuildContext context, GroupedStop stop) {
    final statusLower = stop.status.toLowerCase();
    final isDone = statusLower == 'delivered' || 
                   statusLower == 'failed' || 
                   statusLower == 'completed' || 
                   statusLower == 'cancelled';
    final hasSubscription = stop.orders.any((o) => o.orderType == 'subscription');
    final hasOneTime = stop.orders.any((o) => o.orderType == 'one-time' || o.orderType == 'single');
    
    // Choose primary theme color (subscription gets primary kPrimary, else kAccent)
    final primaryColor = hasSubscription ? kPrimary : kAccent;
    final primaryPlColor = hasSubscription ? kPrimaryPl : kAccentLt;

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
                : (stop.status == 'failed' ? kDanger.withValues(alpha: 0.3) : primaryColor.withValues(alpha: 0.15)),
            width: 1.5,
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
              // Card Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: primaryPlColor,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            'Stop #${stop.stop}',
                            style: TextStyle(color: primaryColor, fontWeight: FontWeight.w900, fontSize: 11),
                          ),
                        ),
                        if (hasSubscription && hasOneTime)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEEF2FF), // Indigo background
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Icon(Icons.all_inclusive_rounded, color: Colors.indigo, size: 12),
                                SizedBox(width: 2),
                                Text(
                                  'Subscription & One-Time',
                                  style: TextStyle(color: Colors.indigo, fontWeight: FontWeight.w900, fontSize: 11),
                                ),
                              ],
                            ),
                          )
                        else if (hasSubscription)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE0F2FE),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.cached_rounded, color: Colors.blue, size: 12),
                                const SizedBox(width: 2),
                                Text(
                                  'Subscription · ${stop.orders.firstWhere((o) => o.orderType == 'subscription').frequency ?? 'Daily'}',
                                  style: const TextStyle(color: Colors.blue, fontWeight: FontWeight.w900, fontSize: 11),
                                ),
                              ],
                            ),
                          )
                        else if (hasOneTime)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.purple.shade50,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.shopping_bag_rounded, color: Colors.purple.shade400, size: 12),
                                const SizedBox(width: 2),
                                const Text(
                                  'One-Time',
                                  style: TextStyle(color: Colors.purple, fontWeight: FontWeight.w900, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: stop.deliverySlot.toLowerCase() == 'morning'
                                ? Colors.green.shade50
                                : Colors.orange.shade50,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                stop.deliverySlot.toLowerCase() == 'morning'
                                    ? Icons.wb_sunny_rounded
                                    : Icons.wb_twilight_rounded,
                                color: stop.deliverySlot.toLowerCase() == 'morning'
                                    ? Colors.green.shade700
                                    : Colors.orange.shade700,
                                size: 12,
                              ),
                              const SizedBox(width: 2),
                              Text(
                                stop.deliverySlot.toLowerCase() == 'morning' ? 'Morning' : 'Evening',
                                style: TextStyle(
                                  color: stop.deliverySlot.toLowerCase() == 'morning'
                                      ? Colors.green.shade800
                                      : Colors.orange.shade800,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  _buildStatusBadge(stop.status),
                ],
              ),
              const SizedBox(height: 14),

              // Customer Details
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    backgroundColor: primaryColor.withValues(alpha: 0.08),
                    radius: 20,
                    child: Text(
                      stop.customerName.isNotEmpty ? stop.customerName[0].toUpperCase() : '?',
                      style: TextStyle(fontWeight: FontWeight.w900, color: primaryColor),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          stop.customerName,
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: kText),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          stop.address,
                          style: const TextStyle(fontSize: 12, color: kTextSub, height: 1.3),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const Divider(height: 24, color: kBorder),

              // Items and Total Value
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'ORDER TYPE',
                          style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          stop.orderType == 'subscription & one-time'
                              ? 'Subscription & One-Time'
                              : (stop.orderType == 'subscription' ? 'Subscription' : 'One-Time'),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: kText),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          stop.itemCountLabel,
                          style: const TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        'VALUE',
                        style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '₹${stop.totalAmount.round()}',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: kText),
                      ),
                      if (stop.isCod)
                        Text(
                          'Collect ₹${stop.codAmount.round()}',
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: kDanger),
                        )
                      else
                        Text(
                          'Prepaid',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.green.shade600),
                        ),
                    ],
                  ),
                ],
              ),

              const Divider(height: 24, color: kBorder),
                         // Bottle Outstanding & Collection Status (Aligned with Map screen style)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'OUTSTANDING BOTTLES',
                    style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                  ),
                  Text(
                    '${stop.bottlesWithCustomer > 0 ? -stop.bottlesWithCustomer : 0} empty bottles',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Colors.teal),
                  ),
                ],
              ),
              if (isDone) ...[
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'COLLECTED BOTTLES',
                      style: TextStyle(fontSize: 10, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                    ),
                    Text(
                      '${stop.emptyBottlesCollected} bottles',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: kSuccess),
                    ),
                  ],
                ),
              ],

              // Actions
              if (!isDone) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _buildActionBtn(Icons.call_rounded, 'Call', Colors.blue, () => _callPhone(stop.customerPhone)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _buildActionBtn(Icons.navigation_rounded, 'Navigate', kPrimary, () => _openNav(stop)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => _showConfirmation(context, stop),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          decoration: BoxDecoration(
                            color: primaryColor,
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(
                                color: primaryColor.withValues(alpha: 0.15),
                                blurRadius: 6,
                                offset: const Offset(0, 3),
                              )
                            ],
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.check_circle_rounded, color: Colors.white, size: 15),
                              SizedBox(width: 6),
                              Text(
                                'Deliver',
                                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ] else ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: stop.status == 'delivered'
                        ? kSuccess.withValues(alpha: 0.05)
                        : kDanger.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: stop.status == 'delivered'
                          ? kSuccess.withValues(alpha: 0.15)
                          : kDanger.withValues(alpha: 0.15),
                      width: 1,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            stop.status == 'delivered'
                                ? Icons.check_circle_rounded
                                : Icons.cancel_rounded,
                            color: stop.status == 'delivered' ? kSuccess : kDanger,
                            size: 16,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            stop.status == 'delivered'
                                ? 'DELIVERED SUCCESSFULLY'
                                : 'DELIVERY FAILED',
                            style: TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 12,
                              color: stop.status == 'delivered' ? kSuccess : kDanger,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      
                      // Grid of delivery metrics
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Payment Method
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'PAYMENT METHOD',
                                  style: TextStyle(fontSize: 9, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Icon(
                                      stop.orders.first.paymentMode == 'prepaid'
                                          ? Icons.payment_rounded
                                          : (stop.orders.first.paymentMode == 'upi' ? Icons.qr_code_rounded : Icons.money_rounded),
                                      size: 14,
                                      color: kText,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      stop.orders.first.paymentMode == 'prepaid'
                                          ? 'Prepaid Online'
                                          : (stop.orders.first.paymentMode == 'upi' ? 'UPI' : (stop.orders.first.paymentMode == 'cash' ? 'Cash' : 'COD')),
                                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          
                          // Empty Bottles
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'BOTTLES COLLECTED',
                                  style: TextStyle(fontSize: 9, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(Icons.opacity_rounded, size: 14, color: kText),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${stop.emptyBottlesCollected} bottles',
                                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      
                      // Proof photo and Notes
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Proof Photo
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'PROOF PHOTO',
                                  style: TextStyle(fontSize: 9, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Icon(
                                      stop.orders.first.deliveryImage != null && stop.orders.first.deliveryImage!.isNotEmpty
                                          ? Icons.photo_camera_back_rounded
                                          : Icons.no_photography_rounded,
                                      size: 14,
                                      color: stop.orders.first.deliveryImage != null && stop.orders.first.deliveryImage!.isNotEmpty ? kSuccess : kTextSub,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      stop.orders.first.deliveryImage != null && stop.orders.first.deliveryImage!.isNotEmpty
                                          ? 'Uploaded ✅'
                                          : 'Not Uploaded',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        color: stop.orders.first.deliveryImage != null && stop.orders.first.deliveryImage!.isNotEmpty ? kSuccess : kTextSub,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          
                          // Handover Location/Notes
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'HANDOVER DETAILS',
                                  style: TextStyle(fontSize: 9, color: kTextSub, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  (stop.orders.first.deliveryNotes != null && stop.orders.first.deliveryNotes!.isNotEmpty)
                                      ? stop.orders.first.deliveryNotes!.split(' · ').first
                                      : 'No details available',
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _buildActionBtn(
                  Icons.info_outline_rounded,
                  'View Details',
                  primaryColor,
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => OrderDetailScreen(stop: stop)),
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
                        'Proceed to Warehouse to return empty bottles and undelivered items.',
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
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const WarehouseHandoverScreen()),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: kDanger,
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
                  Icon(Icons.directions_walk_rounded, size: 16),
                  SizedBox(width: 6),
                  Text(
                    'GO TO WAREHOUSE HANDOVER',
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
