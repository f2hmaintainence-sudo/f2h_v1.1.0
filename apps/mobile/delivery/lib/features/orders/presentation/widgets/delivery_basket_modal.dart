import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/core/utils/app_snackbar.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:dio/dio.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

/// One product line of the dispatch ledger: what `order_items` demand, what
/// `delivery_dispatch_items` physically hold, and the gap between the two.
class ProductInventorySummary {
  final String productName;
  final String unit;
  final String? productImage;

  /// Demand from the partner's assigned `order_items`.
  final int totalOrdered;

  /// `delivery_dispatch_items.planned_qty` — what the warehouse was told to load.
  final int plannedQty;

  /// `delivery_dispatch_items.loaded_qty` — what it actually loaded, EXTRA included.
  final int loaded;

  final int deliveredCount; // delivered_qty
  final int returnedCount; // returned_qty
  final int damagedCount; // damaged_qty

  /// Physically still in the bag: loaded - delivered - returned - damaged.
  final int remainingToDeliver;

  /// Still owed to customers: ordered - delivered.
  final int remainingQty;

  /// Loaded beyond order demand.
  final int extraBuffer;

  /// Order demand the dispatch does not cover.
  final int shortageQty;

  final bool isPickupConfirmed;
  final bool isSufficient;
  final bool isExtraOnly;
  final List<StopDeliveryItem> stops;

  ProductInventorySummary({
    required this.productName,
    required this.unit,
    this.productImage,
    required this.totalOrdered,
    this.plannedQty = 0,
    this.loaded = 0,
    required this.deliveredCount,
    this.returnedCount = 0,
    this.damagedCount = 0,
    required this.remainingToDeliver,
    this.remainingQty = 0,
    required this.extraBuffer,
    this.shortageQty = 0,
    required this.isPickupConfirmed,
    this.isSufficient = true,
    this.isExtraOnly = false,
    required this.stops,
  });

  int get currentlyInBag => remainingToDeliver;
  int get initialStock => loaded > 0 ? loaded : (totalOrdered + extraBuffer);
}

class StopDeliveryItem {
  final String orderId;
  final String customerName;
  final String address;
  final int quantity;
  final String status;
  final bool isPickupConfirmed;

  StopDeliveryItem({
    required this.orderId,
    required this.customerName,
    required this.address,
    required this.quantity,
    required this.status,
    required this.isPickupConfirmed,
  });

  bool get isDelivered => status == 'delivered' || status == 'completed';
  bool get isInBag => !isDelivered;
}

class _TempProductAcc {
  final String productName;
  final String unit;
  String? productImage;
  int totalOrdered = 0;
  int deliveredCount = 0;
  int remainingToDeliver = 0;
  final List<StopDeliveryItem> stops = [];

  _TempProductAcc({required this.productName, required this.unit, this.productImage});
}

class DeliveryBasketModal extends StatefulWidget {
  final List<DeliveryOrderModel> orders;
  final List<GroupedStop> groupedStops;
  final DeliveryRun? currentRun;

  const DeliveryBasketModal({
    super.key,
    required this.orders,
    this.groupedStops = const [],
    this.currentRun,
  });

  static void show(
    BuildContext context,
    List<DeliveryOrderModel> orders, {
    List<GroupedStop> groupedStops = const [],
    DeliveryRun? currentRun,
  }) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (ctx) => DeliveryBasketModal(
          orders: orders,
          groupedStops: groupedStops,
          currentRun: currentRun,
        ),
      ),
    );
  }

  @override
  State<DeliveryBasketModal> createState() => _DeliveryBasketModalState();
}

class _DeliveryBasketModalState extends State<DeliveryBasketModal> {
  final Map<String, int> _extraBufferMap = {};

  List<ProductInventorySummary>? _apiProductBreakdown;
  bool _isReturningProducts = false;
  bool? _apiPickupConfirmed;
  bool _isSufficientForOrders = true;
  bool _isConfirmingPickup = false;
  bool _isLoadingSummary = true;

  /// Live `delivery_dispatch.status` — the single source of truth for which
  /// pickup action to offer. Never inferred from the run status.
  String _dispatchStatus = 'draft';

  /// Server-decided action: confirm | blocked | confirmed | unavailable.
  String _pickupAction = 'unavailable';
  List<Map<String, dynamic>> _insufficientItems = const [];

  @override
  void initState() {
    super.initState();
    _fetchLiveBasketSummary();
  }

  int _parseNum(dynamic val) {
    if (val == null) return 0;
    if (val is num) return val.toInt();
    if (val is String) return double.tryParse(val)?.toInt() ?? 0;
    return 0;
  }

  Future<void> _fetchLiveBasketSummary() async {
    try {
      final dioClient = sl<DioClient>();
      final runIdParam = widget.currentRun?.runId;
      final response = await dioClient.dio.get(
        ApiEndpoints.basketSummary,
        queryParameters: runIdParam != null && runIdParam.isNotEmpty ? {'run_id': runIdParam} : null,
      );

      if (response.statusCode == 200 && response.data != null) {
        final rawMap = response.data is Map ? Map<String, dynamic>.from(response.data as Map) : <String, dynamic>{};
        final data = rawMap['data'] is Map ? Map<String, dynamic>.from(rawMap['data'] as Map) : rawMap;
        final breakdownRaw = (data['product_breakdown'] as List<dynamic>? ?? []);
        final isConfirmed = data['pickup_confirmed'] == true;
        final isSufficientOverall = data['is_sufficient_for_orders'] != false;
        final dispatchStatus = data['dispatch_status']?.toString() ?? 'draft';
        final hasDispatch = data['has_dispatch'] == true || data['dispatch_id'] != null;
        final pickupAction = data['pickup_action']?.toString() ??
            (isConfirmed
                ? 'confirmed'
                : hasDispatch
                    ? (isSufficientOverall ? 'confirm' : 'blocked')
                    : 'unavailable');
        final insufficient = (data['insufficient_items'] as List<dynamic>? ?? [])
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();

        final List<ProductInventorySummary> parsedBreakdown = [];
        for (final item in breakdownRaw) {
          final m = Map<String, dynamic>.from(item as Map);
          // Prefer the explicit ledger keys; fall back to the legacy ones so an
          // older API build still renders.
          final ordered = _parseNum(m['ordered_qty'] ?? m['planned']);
          final plannedQty = _parseNum(m['planned_qty']);
          final loaded = _parseNum(m['loaded_qty'] ?? m['loaded']);
          final extra = _parseNum(m['extra_qty'] ?? m['emergency'] ?? m['extra_load']);
          final delivered = _parseNum(m['delivered_qty'] ?? m['delivered']);
          final returned = _parseNum(m['returned_qty'] ?? m['returned']);
          final damaged = _parseNum(m['damaged_qty'] ?? m['damaged']);
          final inBasket = _parseNum(m['in_basket_qty'] ?? m['current_basket']);
          final remaining = _parseNum(m['remaining_qty'] ?? m['pending']);
          final shortage = _parseNum(m['shortage_qty']);
          final unit = m['unit']?.toString() ?? '';
          final name = m['name']?.toString() ?? 'Product Item';
          final isSufficient = m['is_sufficient'] != false && loaded >= ordered;
          final isExtraOnly = m['is_extra_only'] == true || (ordered == 0 && loaded > 0);

          parsedBreakdown.add(
            ProductInventorySummary(
              productName: name,
              unit: unit,
              totalOrdered: ordered,
              plannedQty: plannedQty,
              loaded: loaded,
              deliveredCount: delivered,
              returnedCount: returned,
              damagedCount: damaged,
              remainingToDeliver:
                  inBasket > 0 ? inBasket : math.max(0, loaded - delivered - returned - damaged),
              remainingQty: remaining > 0 ? remaining : math.max(0, ordered - delivered),
              extraBuffer: extra > 0 ? extra : math.max(0, loaded - ordered),
              shortageQty: shortage > 0 ? shortage : math.max(0, ordered - loaded),
              isPickupConfirmed: isConfirmed,
              isSufficient: isSufficient,
              isExtraOnly: isExtraOnly,
              stops: [],
            ),
          );
        }

        if (mounted) {
          setState(() {
            _apiPickupConfirmed = isConfirmed;
            _dispatchStatus = dispatchStatus;
            _pickupAction = pickupAction;
            _insufficientItems = insufficient;
            // EXTRA-only lines carry no order demand, so they must never count
            // against sufficiency — that is what used to disable the button
            // once the warehouse loaded extra stock.
            _isSufficientForOrders = isSufficientOverall;
            _apiProductBreakdown = parsedBreakdown;
          });
        }
      }
    } catch (_) {
      // Keep whatever the last successful refresh produced.
    } finally {
      if (mounted) setState(() => _isLoadingSummary = false);
    }
  }

  Future<void> _confirmPickupFromBasket() async {
    setState(() => _isConfirmingPickup = true);
    try {
      final dioClient = sl<DioClient>();
      final runIdParam = widget.currentRun?.runId;
      final response = await dioClient.dio.post(
        ApiEndpoints.confirmPickup,
        data: runIdParam != null && runIdParam.isNotEmpty ? {'run_id': runIdParam} : {},
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        // Re-read the dispatch instead of assuming success flipped it. The refresh
        // also brings the EXTRA loaded quantities back, so the ledger keeps showing
        // what is physically in the bag rather than only what was planned.
        await _fetchLiveBasketSummary();
        if (mounted) {
          if (_apiPickupConfirmed == true) {
            AppSnackBar.success(context, '✅ Dispatch confirmed! Orders are now Out for Delivery.');
          } else {
            AppSnackBar.error(context, 'Dispatch was not confirmed. Please try again.');
          }
          try {
            context.read<DeliverySessionBloc>().add(ReloadSessionEvent());
          } catch (_) {}
        }
      } else {
        if (mounted) {
          AppSnackBar.error(context, response.data?['message'] ?? 'Failed to confirm pickup');
        }
      }
    } catch (e) {
      // A rejected confirmation (insufficient stock) must leave the button live,
      // so resync from the server rather than freezing the last local guess.
      await _fetchLiveBasketSummary();
      if (mounted) {
        AppSnackBar.error(context, _confirmErrorMessage(e));
      }
    } finally {
      if (mounted) setState(() => _isConfirmingPickup = false);
    }
  }

  String _confirmErrorMessage(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['message'] != null) return data['message'].toString();
    }
    return 'Error confirming pickup: $error';
  }

  Future<void> _returnProductsToHub() async {
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Return Products to Hub?',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
        ),
        content: Text(
          'You have $_totalInBagNow remaining product unit(s) & extra items in your bag. Do you want to submit all remaining products back to the hub?',
          style: const TextStyle(fontSize: 13.5, color: Color(0xFF475569)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w700)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Confirm Return', style: TextStyle(fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() {
      _isReturningProducts = true;
    });

    try {
      final dioClient = sl<DioClient>();
      final runIdParam = widget.currentRun?.runId;
      final response = await dioClient.dio.post(
        ApiEndpoints.basketSummary.replaceAll('/summary', '/products/return-hub'),
        data: runIdParam != null && runIdParam.isNotEmpty ? {'run_id': runIdParam} : {},
      );

      if (response.statusCode == 200) {
        await _fetchLiveBasketSummary();
        if (mounted) {
          await showDialog(
            context: context,
            builder: (ctx) => Dialog(
              backgroundColor: Colors.white,
              surfaceTintColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFFA7F3D0), width: 2),
                        boxShadow: const [
                          BoxShadow(color: Color(0x20059669), blurRadius: 12, offset: Offset(0, 4)),
                        ],
                      ),
                      child: const Icon(
                        Icons.check_circle_rounded,
                        size: 36,
                        color: Color(0xFF059669),
                      ),
                    ),
                    const SizedBox(height: 18),
                    const Text(
                      'Products Returned!',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0F172A),
                        letterSpacing: -0.3,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'All remaining physical products & extra emergency items have been successfully returned back to the hub.',
                      style: TextStyle(
                        fontSize: 13.5,
                        color: Color(0xFF475569),
                        height: 1.45,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 22),
                    SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF059669),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text(
                          'Got It',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
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
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to return products to hub. Please try again.'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isReturningProducts = false;
        });
      }
    }
  }

  List<DeliveryOrderModel> get orders => widget.orders;

  List<DeliveryOrderModel> get allOrders {
    final Map<String, DeliveryOrderModel> orderMap = {};
    for (final o in widget.orders) {
      orderMap[o.orderId] = o;
    }
    for (final stop in widget.groupedStops) {
      for (final o in stop.orders) {
        orderMap[o.orderId] = o;
      }
    }
    return orderMap.values.toList();
  }

  bool get isPickupConfirmed {
    if (_apiPickupConfirmed != null) return _apiPickupConfirmed!;
    return false;
  }

  List<ProductInventorySummary> get _inventorySummaries {
    final Map<String, _TempProductAcc> map = {};
    final bool confirmed = isPickupConfirmed;

    for (final order in allOrders) {
      final isDelivered = order.status == 'delivered' || order.status == 'completed';
      final isCancelled = order.status == 'cancelled' || order.status == 'failed';
      if (isCancelled) continue;

      for (final item in order.products) {
        final key = '${item.productName}_${item.unit}';
        if (!map.containsKey(key)) {
          map[key] = _TempProductAcc(
            productName: item.productName,
            unit: item.unit,
            productImage: item.productImage,
          );
        }

        final acc = map[key]!;
        if (acc.productImage == null || acc.productImage!.isEmpty) {
          acc.productImage = item.productImage;
        }
        acc.totalOrdered += item.quantity;
        if (isDelivered) {
          acc.deliveredCount += item.quantity;
        } else {
          acc.remainingToDeliver += item.quantity;
        }

        acc.stops.add(StopDeliveryItem(
          orderId: order.orderId,
          customerName: order.customerName,
          address: order.address,
          quantity: item.quantity,
          status: order.status,
          isPickupConfirmed: confirmed,
        ));
      }
    }

    return map.values.map<ProductInventorySummary>((acc) {
      final extra = _extraBufferMap[acc.productName] ?? 0;
      return ProductInventorySummary(
        productName: acc.productName,
        unit: acc.unit,
        productImage: acc.productImage,
        totalOrdered: acc.totalOrdered,
        loaded: acc.totalOrdered + extra,
        deliveredCount: acc.deliveredCount,
        remainingToDeliver: acc.remainingToDeliver,
        extraBuffer: extra,
        isPickupConfirmed: confirmed,
        stops: acc.stops,
      );
    }).toList();
  }

  bool _isReturnContainer(String name) {
    final lower = name.toLowerCase();
    return lower.contains('empty bottle') ||
           lower.contains('glass bottle') ||
           lower.contains('container return') ||
           lower.contains('milk bottel') ||
           lower == 'bottle' ||
           lower == 'bottles';
  }

  List<ProductInventorySummary> get effectiveSummaries {
    if (_dispatchStatus == 'return_pending' || _dispatchStatus == 'completed') {
      return const [];
    }
    final list = _apiProductBreakdown ?? _inventorySummaries;
    return list.where((inv) => !_isReturnContainer(inv.productName)).toList();
  }

  int get _totalInBagNow =>
      (_dispatchStatus == 'return_pending' || _dispatchStatus == 'completed')
          ? 0
          : effectiveSummaries.fold(0, (sum, i) => sum + i.currentlyInBag);

  int get _totalDeliveredUnits =>
      (_dispatchStatus == 'return_pending' || _dispatchStatus == 'completed')
          ? 0
          : effectiveSummaries.fold(0, (sum, i) => sum + i.deliveredCount);

  int get _totalExtraBuffer =>
      (_dispatchStatus == 'return_pending' || _dispatchStatus == 'completed')
          ? 0
          : effectiveSummaries.fold(0, (sum, i) => sum + i.extraBuffer);

  int get _totalInitialStock =>
      (_dispatchStatus == 'return_pending' || _dispatchStatus == 'completed')
          ? 0
          : effectiveSummaries.fold(0, (sum, i) => sum + i.initialStock);

  /// Units the assigned orders demand, from `order_items`.
  int get _totalOrderedUnits =>
      (_dispatchStatus == 'return_pending' || _dispatchStatus == 'completed')
          ? 0
          : effectiveSummaries.fold(0, (sum, i) => sum + i.totalOrdered);

  /// All products on the run remain visible on the ledger even when fully delivered.
  List<ProductInventorySummary> get _activeSummaries => effectiveSummaries;

  @override
  Widget build(BuildContext context) {
    final summaries = effectiveSummaries;

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: F2hAppBar(
        title: 'Delivery Basket Ledger',
        actions: [
          if (_dispatchStatus != 'completed')
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: InkWell(
                  onTap: _isReturningProducts ? null : _returnProductsToHub,
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: _dispatchStatus == 'return_pending' ? const Color(0xFFCCFBF1) : const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _dispatchStatus == 'return_pending' ? const Color(0xFF5EEAD4) : const Color(0xFFA7F3D0),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.assignment_return_rounded,
                          size: 15,
                          color: _dispatchStatus == 'return_pending' ? const Color(0xFF0D9488) : const Color(0xFF059669),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _dispatchStatus == 'return_pending' ? 'Return Pending' : 'Return',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: _dispatchStatus == 'return_pending' ? const Color(0xFF0F766E) : const Color(0xFF059669),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: _isLoadingSummary && _apiProductBreakdown == null
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: Color(0xFF059669), strokeWidth: 3),
                  SizedBox(height: 16),
                  Text(
                    'Loading Delivery Basket Ledger…',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            )
          : Column(
              children: [
                // White Elevation Dashboard Banner with Light Gradient Cards
          Container(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
            decoration: const BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Color(0x0A000000),
                  blurRadius: 10,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFF8FAFC), Color(0xFFF1F5F9)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
              ),
              child: Row(
                children: [
                  _buildHeaderStatCol('ORDERED', '$_totalOrderedUnits', 'Planned', const Color(0xFF475569)),
                  _buildHeaderDivider(),
                  _buildHeaderStatCol('TAKEN', '$_totalInitialStock', 'Loaded', const Color(0xFF334155)),
                  _buildHeaderDivider(),
                  _buildHeaderStatCol('DELIVERED', '$_totalDeliveredUnits', 'Fulfilled', const Color(0xFF1D4ED8)),
                  _buildHeaderDivider(),
                  _buildHeaderStatCol('IN BAG', '$_totalInBagNow', 'Currently have', const Color(0xFF047857), isHighlight: true),
                  _buildHeaderDivider(),
                  _buildHeaderStatCol('EXTRA', '+$_totalExtraBuffer', 'Loaded extra', const Color(0xFF6D28D9)),
                ],
              ),
            ),
          ),

          // Main Inventory Section
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildDispatchActionCard(),

                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.inventory_2_rounded, color: Color(0xFF0F172A), size: 19),
                        SizedBox(width: 8),
                        Text(
                          'Live Physical Bag Inventory',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                            letterSpacing: -0.2,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${summaries.length} Products',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF334155),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                if (_activeSummaries.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x06000000),
                          blurRadius: 8,
                          offset: Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 56,
                          height: 56,
                          decoration: const BoxDecoration(
                            color: Color(0xFFECFDF5),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.shopping_bag_outlined,
                            size: 28,
                            color: Color(0xFF059669),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          _dispatchStatus == 'return_pending'
                              ? 'Shift Return Submitted'
                              : (_dispatchStatus == 'completed'
                                  ? 'Dispatch & Returns Completed'
                                  : 'Your Delivery Bag is Empty'),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _dispatchStatus == 'return_pending'
                              ? 'All items & empty containers submitted for return.\nWaiting for warehouse verification.'
                              : (_dispatchStatus == 'completed'
                                  ? 'All returns verified cleanly by warehouse.\nReady for next dispatch!'
                                  : 'All assigned items delivered!\nWaiting for upcoming orders.'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF64748B),
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: _dispatchStatus == 'return_pending' ? const Color(0xFFCCFBF1) : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: _dispatchStatus == 'return_pending' ? const Color(0xFF5EEAD4) : const Color(0xFFE2E8F0),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                _dispatchStatus == 'return_pending' ? Icons.assignment_return_rounded : Icons.hourglass_top_rounded,
                                size: 14,
                                color: _dispatchStatus == 'return_pending' ? const Color(0xFF0D9488) : const Color(0xFF059669),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                _dispatchStatus == 'return_pending' ? 'Awaiting Warehouse Verification' : 'Ready for next dispatch',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: _dispatchStatus == 'return_pending' ? const Color(0xFF0F766E) : const Color(0xFF334155),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  _buildUnifiedProductCard(_activeSummaries),

                const SizedBox(height: 24),
              ],
            ),
          ),

          // Bottom Action Button: Return Items to Warehouse (Available whenever dispatch is active / not completed)
          if (_dispatchStatus != 'completed')
            Container(
              padding: EdgeInsets.fromLTRB(14, 10, 14, MediaQuery.of(context).padding.bottom + 10),
              decoration: const BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(color: Color(0x0F0F172A), blurRadius: 12, offset: Offset(0, -3)),
                ],
              ),
              child: _dispatchStatus == 'return_pending'
                  ? Container(
                      height: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFFCCFBF1),
                        borderRadius: BorderRadius.circular(26),
                        border: Border.all(color: const Color(0xFF5EEAD4), width: 1.2),
                      ),
                      child: const Center(
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.assignment_return_rounded, size: 19, color: Color(0xFF0D9488)),
                            SizedBox(width: 8),
                            Text(
                              'Return Pending at Warehouse',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F766E),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : Container(
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF059669), Color(0xFF047857)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(26),
                        boxShadow: const [
                          BoxShadow(color: Color(0x33059669), blurRadius: 10, offset: Offset(0, 4)),
                        ],
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: _isReturningProducts ? null : _returnProductsToHub,
                          borderRadius: BorderRadius.circular(26),
                          child: Center(
                            child: _isReturningProducts
                                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                                : const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.assignment_return_rounded, size: 19, color: Colors.white),
                                      SizedBox(width: 8),
                                      Text(
                                        'Return Items to Warehouse',
                                        style: TextStyle(
                                          fontSize: 14.5,
                                          fontWeight: FontWeight.w900,
                                          color: Colors.white,
                                          letterSpacing: 0.2,
                                        ),
                                      ),
                                    ],
                                  ),
                          ),
                        ),
                      ),
                    ),
            ),
        ],
      ),
    );
  }

  /// Always rendered. Which action it offers comes from the live
  /// `delivery_dispatch.status`, never from whether extra items were loaded —
  /// hiding the button once the warehouse added extras left the dispatch stuck.
  Widget _buildDispatchActionCard() {
    if (_isLoadingSummary && _apiProductBreakdown == null) {
      return Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.symmetric(vertical: 22),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
        ),
        child: const Center(
          child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4)),
        ),
      );
    }

    if (_dispatchStatus == 'return_pending') {
      return _buildDispatchStateCard(
        accent: const Color(0xFF0D9488),
        background: const Color(0xFFCCFBF1),
        border: const Color(0xFF5EEAD4),
        icon: Icons.assignment_return_rounded,
        title: 'Deliveries Complete — Return Pending',
        subtitle: 'All deliveries are complete. Please return remaining items and empty containers to the hub.',
      );
    }

    if (_dispatchStatus == 'completed' || _pickupAction == 'completed') {
      return _buildDispatchStateCard(
        accent: const Color(0xFF059669),
        background: const Color(0xFFDCFCE7),
        border: const Color(0xFF86EFAC),
        icon: Icons.task_alt_rounded,
        title: 'Dispatch & Returns Completed',
        subtitle: 'Warehouse has verified and processed all returns for this shift.',
      );
    }

    switch (_pickupAction) {
      case 'confirmed':
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFDCFCE7),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF86EFAC)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.verified_rounded, color: Color(0xFF16A34A), size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Dispatch Confirmed — Orders Out for Delivery',
                                style: GoogleFonts.roboto(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF16A34A),
                                ),
                              ),
                            ),
                            _buildDispatchStatusChip(const Color(0xFF16A34A)),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          _totalExtraBuffer > 0
                              ? 'You are carrying $_totalInitialStock unit(s), including $_totalExtraBuffer extra loaded at the warehouse.'
                              : 'You are carrying $_totalInitialStock unit(s) for your assigned orders.',
                          style: GoogleFonts.roboto(fontSize: 11.5, color: const Color(0xFF475569)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 40,
                child: ElevatedButton.icon(
                  onPressed: _isReturningProducts ? null : _returnProductsToHub,
                  icon: _isReturningProducts
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.assignment_return_rounded, size: 16, color: Colors.white),
                  label: Text(
                    _isReturningProducts ? 'Submitting Return…' : 'Initiate Shift Return to Hub',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
        );

      case 'unavailable':
        return _buildDispatchStateCard(
          accent: const Color(0xFFB45309),
          background: const Color(0xFFFEF3C7),
          border: const Color(0xFFFCD34D),
          icon: Icons.hourglass_top_rounded,
          title: 'Waiting for Warehouse Dispatch',
          subtitle: 'No dispatch has been loaded for your run yet. The pickup action opens as soon as the warehouse loads your items.',
        );

      case 'blocked':
      case 'confirm':
      default:
        final canConfirm = _pickupAction == 'confirm' && _isSufficientForOrders;
        return _buildConfirmDispatchCard(canConfirm: canConfirm);
    }
  }

  Widget _buildDispatchStateCard({
    required Color accent,
    required Color background,
    required Color border,
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: accent, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: GoogleFonts.roboto(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                          color: accent,
                        ),
                      ),
                    ),
                    _buildDispatchStatusChip(accent),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: GoogleFonts.roboto(fontSize: 11.5, color: const Color(0xFF475569)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// The raw `delivery_dispatch.status` behind the action currently offered.
  Widget _buildDispatchStatusChip(Color accent) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: accent.withValues(alpha: 0.35)),
      ),
      child: Text(
        _dispatchStatus.replaceAll('_', ' ').toUpperCase(),
        style: GoogleFonts.roboto(
          fontSize: 9.5,
          fontWeight: FontWeight.w900,
          color: accent,
          letterSpacing: 0.4,
        ),
      ),
    );
  }

  Widget _buildConfirmDispatchCard({required bool canConfirm}) {
    final shortageLines = _insufficientItems
        .map((e) =>
            '${e['name'] ?? e['variant_id']}: loaded ${_parseNum(e['loaded_qty'])} of ${_parseNum(e['ordered_qty'])}')
        .toList();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: canConfirm ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5),
          width: 1.2,
        ),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: canConfirm ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  canConfirm ? Icons.inventory_2_rounded : Icons.warning_amber_rounded,
                  color: canConfirm ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            canConfirm ? 'Dispatch Handover Ready' : 'Dispatched Quantities Insufficient',
                            style: GoogleFonts.roboto(
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                              color: const Color(0xFF0F172A),
                            ),
                          ),
                        ),
                        _buildDispatchStatusChip(
                          canConfirm ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                        ),
                      ],
                    ),
                    Text(
                      canConfirm
                          ? 'Loaded $_totalInitialStock unit(s) for $_totalOrderedUnits ordered'
                              '${_totalExtraBuffer > 0 ? ' (+$_totalExtraBuffer extra)' : ''}.'
                              ' Confirm pickup to set orders Out for Delivery.'
                          : 'The warehouse has loaded less than your assigned orders need. Ask for the missing quantities before confirming.',
                      style: GoogleFonts.roboto(
                        fontSize: 11.5,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (!canConfirm && shortageLines.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: shortageLines
                    .map(
                      (line) => Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Text(
                          '• $line',
                          style: GoogleFonts.roboto(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFFB91C1C),
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: ElevatedButton.icon(
              onPressed: (!canConfirm || _isConfirmingPickup) ? null : _confirmPickupFromBasket,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                disabledBackgroundColor: const Color(0xFFE2E8F0),
                disabledForegroundColor: const Color(0xFF94A3B8),
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: _isConfirmingPickup
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Icon(
                      canConfirm ? Icons.check_circle_outline_rounded : Icons.lock_outline_rounded,
                      size: 18,
                    ),
              label: Text(
                _isConfirmingPickup
                    ? 'CONFIRMING DISPATCH...'
                    : (canConfirm ? 'CONFIRM DISPATCH & START DELIVERY' : 'INSUFFICIENT DISPATCH STOCK'),
                style: GoogleFonts.roboto(
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderStatCol(String label, String value, String subtitle, Color color, {bool isHighlight = false}) {
    final colContent = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 8.5,
            fontWeight: FontWeight.w900,
            color: isHighlight ? const Color(0xFF15803D) : const Color(0xFF64748B),
            letterSpacing: 0.4,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: isHighlight ? const Color(0xFF16A34A) : color,
            height: 1.1,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: TextStyle(
            fontSize: 8.5,
            fontWeight: FontWeight.w700,
            color: isHighlight ? const Color(0xFF15803D) : const Color(0xFF64748B),
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );

    if (isHighlight) {
      return Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
          decoration: BoxDecoration(
            color: const Color(0xFFDCFCE7),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFF16A34A), width: 1.2),
            boxShadow: const [
              BoxShadow(color: Color(0x1816A34A), blurRadius: 4, offset: Offset(0, 2)),
            ],
          ),
          child: colContent,
        ),
      );
    }

    return Expanded(child: colContent);
  }

  Widget _buildHeaderDivider() {
    return Container(
      width: 1,
      height: 28,
      color: const Color(0xFFCBD5E1),
    );
  }

  Widget _buildUnifiedProductCard(List<ProductInventorySummary> items) {
    if (items.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Colors.white, Color(0xFFF0FDF4)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFA7F3D0), width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0C059669),
            blurRadius: 16,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: items.asMap().entries.map((entry) {
          final idx = entry.key;
          final inv = entry.value;
          final isLast = idx == items.length - 1;

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top Header: Image + Name + Extra / Short Badges + Equal Width Unit Badge + In Bag Badge
                    Row(
                      children: [
                        _buildProductImage(inv.productImage, size: 36),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Wrap(
                            crossAxisAlignment: WrapCrossAlignment.center,
                            spacing: 6,
                            runSpacing: 4,
                            children: [
                              Text(
                                inv.productName,
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF0F172A),
                                  letterSpacing: -0.2,
                                ),
                              ),
                              if (inv.extraBuffer > 0 || inv.isExtraOnly)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: const Color(0xFFF59E0B), width: 1),
                                  ),
                                  child: Text(
                                    inv.isExtraOnly ? 'EXTRA ONLY' : 'EXTRA (+${inv.extraBuffer})',
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFFB45309),
                                      letterSpacing: 0.2,
                                    ),
                                  ),
                                ),
                              if (!inv.isSufficient)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFEE2E2),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: const Color(0xFFEF4444), width: 1),
                                  ),
                                  child: Text(
                                    'SHORT (-${inv.shortageQty})',
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFFB91C1C),
                                      letterSpacing: 0.2,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),

                        // Fixed Equal-Width Highlighted Unit Badge in Royal Blue (1ltr, 500ml)
                        if (inv.unit.isNotEmpty) ...[
                          Container(
                            width: 68,
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFF2563EB), width: 1.5),
                              boxShadow: const [
                                BoxShadow(color: Color(0x182563EB), blurRadius: 4, offset: Offset(0, 2)),
                              ],
                            ),
                            child: Text(
                              inv.unit,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF1D4ED8),
                                letterSpacing: 0.3,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],

                        // Highlighted Solid Emerald Green In-Bag Badge (In Bag: X)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF059669), Color(0xFF047857)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(10),
                            boxShadow: const [
                              BoxShadow(color: Color(0x25059669), blurRadius: 6, offset: Offset(0, 2)),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text(
                                'In Bag:',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(width: 3),
                              Text(
                                '${inv.currentlyInBag}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Structured Executive Metric Strip with White-to-Green Gradient
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Colors.white, Color(0xFFECFDF5)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x06000000),
                            blurRadius: 6,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          _buildStatCol('PLANNED', '${inv.totalOrdered}', const Color(0xFF475569)),
                          _buildVerticalDivider(),
                          _buildStatCol('LOADED', '${inv.loaded}', const Color(0xFF047857)),
                          _buildVerticalDivider(),
                          _buildStatCol('EXTRA', '+${inv.extraBuffer}', const Color(0xFF6D28D9)),
                          _buildVerticalDivider(),
                          _buildStatCol('DELIVERED', '${inv.deliveredCount}', const Color(0xFF1D4ED8)),
                          _buildVerticalDivider(),
                          _buildStatCol('REMAINING', '${inv.remainingQty}', const Color(0xFF0F766E)),
                          if (inv.returnedCount > 0) ...[
                            _buildVerticalDivider(),
                            _buildStatCol('RETURNED', '${inv.returnedCount}', const Color(0xFFB45309)),
                          ],
                          if (inv.damagedCount > 0) ...[
                            _buildVerticalDivider(),
                            _buildStatCol('DAMAGED', '${inv.damagedCount}', const Color(0xFFBE123C)),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (!isLast)
                const Divider(height: 1, thickness: 1, color: Color(0xFFE2E8F0)),
            ],
          );
        }).toList(),
      ),
    );
  }

  Widget _buildStatCol(String label, String value, Color color) {
    return Expanded(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 8.5,
              fontWeight: FontWeight.w800,
              color: color.withValues(alpha: 0.8),
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerticalDivider() {
    return Container(
      width: 1,
      height: 22,
      color: const Color(0xFFE2E8F0),
    );
  }

  String _resolveImageUrl(String? rawUrl) {
    if (rawUrl == null || rawUrl.trim().isEmpty) return '';
    final trimmed = rawUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    final cleanPath = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    return '${ApiEndpoints.host}$cleanPath';
  }

  Widget _buildProductImage(String? imageUrl, {double size = 36}) {
    final fullUrl = _resolveImageUrl(imageUrl);
    if (fullUrl.isEmpty) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Center(
          child: Icon(Icons.inventory_2_outlined, size: 18, color: Color(0xFF94A3B8)),
        ),
      );
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(7),
        child: Image.network(
          fullUrl,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) {
            return Container(
              color: const Color(0xFFF8FAFC),
              child: const Center(
                child: Icon(Icons.inventory_2_outlined, size: 18, color: Color(0xFF94A3B8)),
              ),
            );
          },
          loadingBuilder: (context, child, loadingProgress) {
            if (loadingProgress == null) return child;
            return Container(
              color: const Color(0xFFF8FAFC),
              child: const Center(
                child: SizedBox(
                  width: 12,
                  height: 12,
                  child: CircularProgressIndicator(strokeWidth: 1.8, color: Color(0xFF16A34A)),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
