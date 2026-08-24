import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:f2h_delivery/core/utils/app_snackbar.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/di/injection.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/core/widgets/f2h_app_bar.dart';

class ProductInventorySummary {
  final String productName;
  final String unit;
  final String? productImage;
  final int totalOrdered; // planned_qty
  final int loaded; // loaded_qty
  final int deliveredCount; // delivered_qty
  final int returnedCount; // returned_qty
  final int damagedCount; // damaged_qty
  final int remainingToDeliver; // current_basket
  final int extraBuffer; // extra_sold_qty
  final bool isPickupConfirmed;
  final List<StopDeliveryItem> stops;

  ProductInventorySummary({
    required this.productName,
    required this.unit,
    this.productImage,
    required this.totalOrdered,
    this.loaded = 0,
    required this.deliveredCount,
    this.returnedCount = 0,
    this.damagedCount = 0,
    required this.remainingToDeliver,
    required this.extraBuffer,
    required this.isPickupConfirmed,
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
  bool _isConfirmingPickup = false;

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
        final data = Map<String, dynamic>.from(response.data as Map);
        final breakdownRaw = (data['product_breakdown'] as List<dynamic>? ?? []);
        final isConfirmed = data['pickup_confirmed'] == true;

        final List<ProductInventorySummary> parsedBreakdown = [];
        for (final item in breakdownRaw) {
          final m = Map<String, dynamic>.from(item as Map);
          final loaded = _parseNum(m['loaded']);
          final plannedVal = _parseNum(m['planned']);
          final emergency = _parseNum(m['emergency']);
          final planned = plannedVal > 0 ? plannedVal : math.max(0, loaded - emergency);
          final delivered = _parseNum(m['delivered']);
          final returned = _parseNum(m['returned']);
          final damaged = _parseNum(m['damaged']);
          final currentBasket = _parseNum(m['current_basket']);
          final unit = m['unit']?.toString() ?? '';
          final name = m['name']?.toString() ?? 'Product Item';

          parsedBreakdown.add(
            ProductInventorySummary(
              productName: name,
              unit: unit,
              totalOrdered: planned,
              loaded: loaded,
              deliveredCount: delivered,
              returnedCount: returned,
              damagedCount: damaged,
              remainingToDeliver: currentBasket > 0 ? currentBasket : math.max(0, loaded - delivered - returned - damaged),
              extraBuffer: emergency,
              isPickupConfirmed: isConfirmed,
              stops: [],
            ),
          );
        }

        if (mounted) {
          setState(() {
            _apiPickupConfirmed = isConfirmed;
            _apiProductBreakdown = parsedBreakdown;
          });
        }
      }
    } catch (_) {}
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
        if (mounted) {
          AppSnackBar.success(context, '✅ Dispatch confirmed! Orders are now Out for Delivery.');
          setState(() {
            _apiPickupConfirmed = true;
          });
          await _fetchLiveBasketSummary();
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
      if (mounted) {
        AppSnackBar.error(context, 'Error confirming pickup: $e');
      }
    } finally {
      if (mounted) setState(() => _isConfirmingPickup = false);
    }
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
    final status = (widget.currentRun?.status ?? '').toLowerCase();
    return status == 'in_progress' ||
        status == 'in_transit' ||
        status == 'out_for_delivery' ||
        status == 'completed' ||
        status == 'handed_over' ||
        (allOrders.isNotEmpty && allOrders.every((o) => o.status == 'out_for_delivery' || o.status == 'delivered' || o.status == 'completed'));
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
    final list = _apiProductBreakdown ?? _inventorySummaries;
    return list.where((inv) => !_isReturnContainer(inv.productName)).toList();
  }

  int get _totalInBagNow =>
      effectiveSummaries.fold(0, (sum, i) => sum + i.currentlyInBag);

  int get _totalDeliveredUnits =>
      effectiveSummaries.fold(0, (sum, i) => sum + i.deliveredCount);

  int get _totalExtraBuffer =>
      effectiveSummaries.fold(0, (sum, i) => sum + i.extraBuffer);

  int get _totalInitialStock =>
      effectiveSummaries.fold(0, (sum, i) => sum + i.initialStock);

  @override
  Widget build(BuildContext context) {
    final summaries = effectiveSummaries;

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: F2hAppBar(title: 'Delivery Basket Ledger'),
      body: Column(
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
                  _buildHeaderStatCol('TAKEN', '$_totalInitialStock', 'Loaded', const Color(0xFF334155)),
                  _buildHeaderDivider(),
                  _buildHeaderStatCol('DELIVERED', '$_totalDeliveredUnits', 'Fulfilled', const Color(0xFF1D4ED8)),
                  _buildHeaderDivider(),
                  _buildHeaderStatCol('IN BAG', '$_totalInBagNow', 'Currently have', const Color(0xFF047857), isHighlight: true),
                  _buildHeaderDivider(),
                  _buildHeaderStatCol('EXTRA', '+$_totalExtraBuffer', 'Emergency', const Color(0xFF6D28D9)),
                ],
              ),
            ),
          ),

          // Main Inventory Section
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (!isPickupConfirmed) ...[
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFF86EFAC), width: 1.2),
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
                              decoration: const BoxDecoration(
                                color: Color(0xFFDCFCE7),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.inventory_2_rounded, color: Color(0xFF16A34A), size: 20),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Dispatch Handover Pending',
                                    style: GoogleFonts.poppins(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 14,
                                      color: const Color(0xFF0F172A),
                                    ),
                                  ),
                                  Text(
                                    'Verify physical bag stock against dispatch items below',
                                    style: GoogleFonts.poppins(
                                      fontSize: 11.5,
                                      color: const Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          height: 44,
                          child: ElevatedButton.icon(
                            onPressed: _isConfirmingPickup ? null : _confirmPickupFromBasket,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF16A34A),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: _isConfirmingPickup
                                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Icon(Icons.check_circle_outline_rounded, size: 18),
                            label: Text(
                              _isConfirmingPickup ? 'CONFIRMING DISPATCH...' : 'CONFIRM DISPATCH & START DELIVERY',
                              style: GoogleFonts.poppins(
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
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

                if (summaries.isEmpty || _totalInBagNow == 0 || summaries.every((s) => (s.totalOrdered + s.extraBuffer - s.deliveredCount) <= 0))
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
                        const Text(
                          'Your Delivery Bag is Empty',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'All assigned items delivered!\nWaiting for upcoming orders.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
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
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.hourglass_top_rounded, size: 14, color: Color(0xFF059669)),
                              SizedBox(width: 6),
                              Text(
                                'Ready for next dispatch',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF334155),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  _buildUnifiedProductCard(
                    summaries.where((inv) => (inv.totalOrdered + inv.extraBuffer - inv.deliveredCount) > 0).toList(),
                  ),

                const SizedBox(height: 24),
              ],
            ),
          ),

          // Bottom Action Button: Return Remaining Products to Hub (Shows only when all deliveries completed & _totalInBagNow > 0)
          if (allOrders.isNotEmpty && allOrders.every((o) => o.status == 'delivered' || o.status == 'completed' || o.status == 'failed' || o.status == 'cancelled') && _totalInBagNow > 0)
            Container(
              padding: EdgeInsets.fromLTRB(14, 10, 14, MediaQuery.of(context).padding.bottom + 10),
              decoration: const BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(color: Color(0x0F0F172A), blurRadius: 12, offset: Offset(0, -3)),
                ],
              ),
              child: Container(
                height: 48,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(26),
                  boxShadow: const [
                    BoxShadow(color: Color(0x3316A34A), blurRadius: 10, offset: Offset(0, 4)),
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
                                Icon(Icons.inventory_rounded, size: 20, color: Colors.white),
                                SizedBox(width: 8),
                                Text(
                                  'Return Remaining Products to Hub',
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
                    // Top Header: Name + Equal Width Unit Badge + Equal Width In Bag Capsule Badge
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            inv.productName,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F172A),
                              letterSpacing: -0.2,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
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
                          _buildStatCol('LOADED', '${inv.initialStock}', const Color(0xFF047857)),
                          _buildVerticalDivider(),
                          _buildStatCol('DELIVERED', '${inv.deliveredCount}', const Color(0xFF1D4ED8)),
                          _buildVerticalDivider(),
                          _buildStatCol('RETURNED', '${inv.returnedCount}', const Color(0xFFB45309)),
                          _buildVerticalDivider(),
                          _buildStatCol('DAMAGED', '${inv.damagedCount}', const Color(0xFFBE123C)),
                          if (inv.extraBuffer > 0) ...[
                            _buildVerticalDivider(),
                            _buildStatCol('EXTRA', '+${inv.extraBuffer}', const Color(0xFF6D28D9)),
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





}
