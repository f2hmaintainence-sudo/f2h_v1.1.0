import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';
import 'package:f2h_customer/features/orders/domain/repositories/orders_repository.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/catalog_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/catalog_state.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/catalog_event.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_state.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_event.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/features/catalog/presentation/helpers/cart_helpers.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/cart_screen.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_view_screen.dart';
import 'package:f2h_customer/features/orders/presentation/screens/order_details_screen.dart';
import 'package:f2h_customer/features/orders/presentation/screens/order_tracking_screen.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';

class CalendarDateOrdersScreen extends StatefulWidget {
  final DateTime date;
  final List<Order>? initialOrders;

  const CalendarDateOrdersScreen({
    super.key,
    required this.date,
    this.initialOrders,
  });

  @override
  State<CalendarDateOrdersScreen> createState() =>
      _CalendarDateOrdersScreenState();
}

class _CalendarDateOrdersScreenState extends State<CalendarDateOrdersScreen> {
  late List<Order> _orders;
  bool _isLoading = false;

  String get _dateStr =>
      '${widget.date.year.toString().padLeft(4, '0')}-'
      '${widget.date.month.toString().padLeft(2, '0')}-'
      '${widget.date.day.toString().padLeft(2, '0')}';

  @override
  void initState() {
    super.initState();
    _orders = widget.initialOrders ?? [];
    if (_orders.isEmpty) {
      _fetchOrdersForDate();
    }
  }

  Future<void> _fetchOrdersForDate() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final repo = sl<OrdersRepository>();
      final data = await repo.getOrdersByDate(_dateStr);
      final rawOrders = (data['orders'] as List<dynamic>? ?? []);
      final parsed = rawOrders
          .map((j) => Order.fromJson(j as Map<String, dynamic>))
          .toList();

      if (mounted) {
        setState(() {
          _orders = parsed;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  bool _isEligibleForOrdering(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final target =
        DateTime(widget.date.year, widget.date.month, widget.date.day);

    if (target.isBefore(today)) {
      return false; // Past date
    }

    if (target.isAtSameMomentAs(today)) {
      final slotTimings = slotTimingsOf(context);
      final eveningCutoffMinutes = parseTimeToMinutes(
        slotTimings?['evening_slot']?['customer_cutoff_time'] ??
            slotTimings?['evening_cutoff_time'],
        16 * 60, // 4:00 PM cutoff
      );
      final nowMinutes = now.hour * 60 + now.minute;
      return nowMinutes < eveningCutoffMinutes;
    }

    // Future dates
    return true;
  }

  bool _isToday() {
    final now = DateTime.now();
    return widget.date.year == now.year &&
        widget.date.month == now.month &&
        widget.date.day == now.day;
  }

  String _getCutoffTimeFormatted(BuildContext context) {
    final slotTimings = slotTimingsOf(context);
    final cutoffMin = parseTimeToMinutes(
      slotTimings?['evening_slot']?['customer_cutoff_time'] ??
          slotTimings?['evening_cutoff_time'],
      16 * 60,
    );
    return formatMinutesTo12Hour(cutoffMin);
  }

  String _formatFormattedDate(DateTime d) {
    const weekdays = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ];
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    final weekday = weekdays[d.weekday - 1];
    final month = months[d.month - 1];
    return '$weekday, ${d.day} $month ${d.year}';
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase().trim()) {
      case 'delivered':
      case 'completed':
        return const Color(0xFF10B981); // Emerald green
      case 'out_for_delivery':
      case 'dispatched':
        return const Color(0xFF0284C7); // Vivid sky blue
      case 'confirmed':
      case 'placed':
      case 'pending':
      case 'processing':
        return const Color(0xFF38BDF8); // Soft cyan blue
      case 'cancelled':
      case 'failed':
      case 'on_hold':
        return const Color(0xFFEF4444); // Red
      default:
        return const Color(0xFF64748B);
    }
  }

  String _statusLabel(String status) {
    switch (status.toLowerCase().trim()) {
      case 'delivered':
      case 'completed':
        return 'Delivered';
      case 'out_for_delivery':
        return 'Out for Delivery';
      case 'confirmed':
        return 'Order Confirmed';
      case 'placed':
        return 'Order Placed';
      case 'processing':
        return 'Processing';
      case 'cancelled':
        return 'Cancelled';
      case 'on_hold':
        return 'On Hold';
      default:
        return status.replaceAll('_', ' ').toUpperCase();
    }
  }

  void _navigateToProduct(BuildContext context, OrderItem item) {
    final catState = context.read<CatalogBloc>().state;
    Product? liveProduct;

    if (catState is CatalogLoaded) {
      for (final cp in catState.products) {
        if ((item.productId.isNotEmpty && cp.id == item.productId) ||
            cp.id == item.variantId ||
            cp.variants.any((v) => v.id == item.variantId)) {
          liveProduct = cp;
          break;
        }
      }
    }

    if (liveProduct != null) {
      Navigator.push(
        context,
        PageRouteBuilder(
          pageBuilder: (_, a, _) =>
              ProductDetailViewScreen(product: liveProduct!),
          transitionsBuilder: (_, a, _, child) =>
              FadeTransition(opacity: a, child: child),
          transitionDuration: const Duration(milliseconds: 200),
        ),
      );
    } else {
      F2HToast.show(
        context,
        '${item.productName} is currently unavailable in the live catalog',
        isError: false,
      );
    }
  }

  void _openAddProductSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddProductDateBottomSheet(
        date: widget.date,
        dateStr: _dateStr,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final formattedDate = _formatFormattedDate(widget.date);
    final totalProducts = _orders.fold<int>(
      0,
      (sum, order) => sum + order.items.length,
    );
    final isEligible = _isEligibleForOrdering(context);
    final isToday = _isToday();
    final cutoffFormatted = _getCutoffTimeFormatted(context);

    String subtitleText;
    if (_isLoading) {
      subtitleText = 'Checking orders...';
    } else if (_orders.isNotEmpty) {
      subtitleText =
          '${_orders.length} order${_orders.length > 1 ? "s" : ""} • $totalProducts product${totalProducts > 1 ? "s" : ""}';
    } else if (isEligible) {
      subtitleText = isToday
          ? 'Same-day order open until $cutoffFormatted'
          : 'Available for scheduled delivery';
    } else if (isToday) {
      subtitleText = 'Cutoff passed ($cutoffFormatted) • Orders closed';
    } else {
      subtitleText = 'Past date • Delivery closed';
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              size: 20, color: Color(0xFF1E293B)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              formattedDate,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
                letterSpacing: -0.2,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitleText,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w500,
                color: _orders.isNotEmpty
                    ? const Color(0xFF0284C7)
                    : (isEligible
                        ? const Color(0xFF059669)
                        : const Color(0xFF64748B)),
              ),
            ),
          ],
        ),
        actions: [
          if (isEligible)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: TextButton.icon(
                onPressed: () => _openAddProductSheet(context),
                style: TextButton.styleFrom(
                  backgroundColor: const Color(0xFFE0F2FE),
                  foregroundColor: const Color(0xFF0284C7),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                icon: const Icon(Icons.add_shopping_cart_rounded, size: 15),
                label: const Text(
                  'Add Product',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded,
                color: Color(0xFF64748B), size: 22),
            tooltip: 'Refresh orders',
            onPressed: _fetchOrdersForDate,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                color: Color(0xFF0284C7),
                strokeWidth: 2.5,
              ),
            )
          : _orders.isEmpty
              ? _buildEmptyState(
                  context, formattedDate, isEligible, isToday, cutoffFormatted)
              : _buildOrdersList(context, isEligible),
    );
  }

  Widget _buildEmptyState(
    BuildContext context,
    String formattedDate,
    bool isEligible,
    bool isToday,
    String cutoffFormatted,
  ) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: isEligible
                    ? const Color(0xFFEFF6FF)
                    : const Color(0xFFF1F5F9),
                shape: BoxShape.circle,
                border: Border.all(
                  color: isEligible
                      ? const Color(0xFFDBEAFE)
                      : const Color(0xFFE2E8F0),
                  width: 1.5,
                ),
              ),
              child: Icon(
                isEligible
                    ? Icons.calendar_today_rounded
                    : Icons.event_busy_rounded,
                size: 36,
                color: isEligible
                    ? const Color(0xFF0284C7)
                    : const Color(0xFF94A3B8),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              isEligible ? 'No Orders Scheduled' : 'No Orders for this Date',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              isEligible
                  ? (isToday
                      ? 'You have no deliveries scheduled for today yet. You can order fresh products until $cutoffFormatted.'
                      : 'You have no deliveries scheduled for $formattedDate yet. You can schedule items for delivery on this day.')
                  : (isToday
                      ? 'Orders for today closed at $cutoffFormatted (Customer Cutoff Time). You can schedule deliveries for tomorrow or upcoming dates.'
                      : 'There were no orders or deliveries scheduled on $formattedDate.'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13.5,
                color: Color(0xFF64748B),
                height: 1.45,
              ),
            ),
            const SizedBox(height: 20),
            if (isEligible) ...[
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.check_circle_outline_rounded,
                        size: 15, color: Color(0xFF059669)),
                    const SizedBox(width: 6),
                    Text(
                      isToday
                          ? 'Orders open until $cutoffFormatted today'
                          : 'Available for scheduled delivery',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF059669),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () => _openAddProductSheet(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0284C7),
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                icon: const Icon(Icons.add_shopping_cart_rounded, size: 18),
                label: const Text(
                  'Add Products for this Date',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                ),
              ),
            ] else ...[
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.access_time_filled_rounded,
                        size: 15, color: Color(0xFFDC2626)),
                    const SizedBox(width: 6),
                    Text(
                      isToday
                          ? 'Cutoff Passed ($cutoffFormatted)'
                          : 'Past Date',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFDC2626),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF475569),
                  side: const BorderSide(color: Color(0xFFCBD5E1)),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                icon: const Icon(Icons.arrow_back_rounded, size: 16),
                label: const Text(
                  'Back to Calendar',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildOrdersList(BuildContext context, bool isEligible) {
    return RefreshIndicator(
      onRefresh: _fetchOrdersForDate,
      color: const Color(0xFF0284C7),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          if (isEligible) ...[
            _buildAddMoreBanner(context),
            const SizedBox(height: 16),
          ],
          ...List.generate(_orders.length, (index) {
            final order = _orders[index];
            return Padding(
              padding:
                  EdgeInsets.only(bottom: index < _orders.length - 1 ? 16 : 0),
              child: _buildOrderCard(context, order),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildAddMoreBanner(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F9FF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFBAE6FD)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF0284C7),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.add_shopping_cart_rounded,
                color: Colors.white, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  'Want to add more products?',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0369A1),
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Schedule extra items for this delivery date',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF0284C7),
                  ),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: () => _openAddProductSheet(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              elevation: 0,
            ),
            child: const Text('Add',
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderCard(BuildContext context, Order order) {
    final statusColor = _statusColor(order.status);
    final statusText = _statusLabel(order.status);
    final isOutForDelivery =
        order.status.toLowerCase() == 'out_for_delivery';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Order Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          order.id.isNotEmpty
                              ? (order.id.startsWith('#')
                                  ? order.id
                                  : '#F2H-${order.id}')
                              : '#F2H-Order',
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF334155),
                          ),
                        ),
                      ),
                      if (order.deliverySlot.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            order.deliverySlot.toLowerCase().contains('slot')
                                ? order.deliverySlot
                                : '${order.deliverySlot} Slot',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF64748B),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: statusColor.withValues(alpha: 0.3),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        statusText,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: statusColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1, color: Color(0xFFF1F5F9)),

          // Products Section Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                const Icon(Icons.shopping_bag_outlined,
                    size: 16, color: Color(0xFF64748B)),
                const SizedBox(width: 6),
                Text(
                  'Products in Order (${order.items.length})',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF334155),
                  ),
                ),
              ],
            ),
          ),

          // Items List
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            itemCount: order.items.length,
            separatorBuilder: (_, index) =>
                const Divider(height: 16, color: Color(0xFFF1F5F9)),
            itemBuilder: (context, idx) {
              final item = order.items[idx];
              return _buildProductRow(context, item);
            },
          ),

          const Divider(height: 1, color: Color(0xFFF1F5F9)),

          // Order Footer Actions & Total
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Order Total',
                      style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      '₹${order.amount.toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isOutForDelivery) ...[
                      OutlinedButton.icon(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => OrderTrackingScreen(
                                orderId: order.id,
                              ),
                            ),
                          );
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF0284C7),
                          side: const BorderSide(color: Color(0xFF0284C7)),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        icon: const Icon(Icons.local_shipping_outlined,
                            size: 16),
                        label: const Text('Track',
                            style: TextStyle(fontSize: 12.5)),
                      ),
                      const SizedBox(width: 8),
                    ],
                    ElevatedButton(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => OrderDetailsScreen(order: order),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0284C7),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        'View Details',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductRow(BuildContext context, OrderItem item) {
    final effectivePrice =
        item.finalPrice > 0 ? item.finalPrice : item.unitPrice * item.quantity;

    return InkWell(
      onTap: () => _navigateToProduct(context, item),
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            // Thumbnail
            Container(
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Padding(
                  padding: const EdgeInsets.all(3),
                  child: buildProductImage(
                    item.productName,
                    imageAsset: item.imagePath,
                    width: 58,
                    height: 58,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),

            // Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.productName,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1E293B),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      if (item.variantName.isNotEmpty &&
                          item.variantName.toLowerCase() != 'standard') ...[
                        Text(
                          item.variantName,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF64748B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Text('•',
                            style: TextStyle(color: Color(0xFFCBD5E1))),
                        const SizedBox(width: 6),
                      ],
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'Qty: ${item.quantity}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF475569),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Price and View Button
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '₹${effectivePrice.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Text(
                      'View',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0284C7),
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 15,
                      color: Color(0xFF0284C7),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════
//  ADD PRODUCT FOR SPECIFIC DATE BOTTOM SHEET
// ══════════════════════════════════════════════════════════

class _AddProductDateBottomSheet extends StatefulWidget {
  final DateTime date;
  final String dateStr;

  const _AddProductDateBottomSheet({
    required this.date,
    required this.dateStr,
  });

  @override
  State<_AddProductDateBottomSheet> createState() =>
      _AddProductDateBottomSheetState();
}

class _AddProductDateBottomSheetState
    extends State<_AddProductDateBottomSheet> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedCategory = 'All';
  String _selectedSlot = 'Morning';
  bool _initializedSlot = false;

  @override
  void initState() {
    super.initState();
    // Ensure catalog is loaded
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final catState = context.read<CatalogBloc>().state;
        if (catState is! CatalogLoaded) {
          context.read<CatalogBloc>().add(const LoadCatalog());
        }
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _initSlotIfNeeded(List<String> availableSlots) {
    if (!_initializedSlot && availableSlots.isNotEmpty) {
      _selectedSlot = availableSlots.first;
      _initializedSlot = true;
    }
  }

  String _formatSheetDate(DateTime d) {
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    return '${weekdays[d.weekday - 1]}, ${d.day} ${months[d.month - 1]} ${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final slotTimings = slotTimingsOf(context);
    final availableSlots =
        getAvailableSlots(widget.date, DateTime.now(), slotTimings);
    _initSlotIfNeeded(availableSlots);

    final catState = context.watch<CatalogBloc>().state;
    final cartState = context.watch<CartBloc>().state;
    final List<CartItemEntity> cartItems =
        (cartState is CartLoadedState) ? cartState.items : [];

    // Filter items scheduled for this date
    final dateCartItems =
        cartItems.where((i) => i.deliveryDate == widget.dateStr).toList();
    final totalDateItems = dateCartItems.fold<int>(
        0, (sum, i) => sum + (i.quantity ?? 1));
    final totalDateAmount = dateCartItems.fold<double>(
        0.0, (sum, i) => sum + (i.unitPrice * (i.quantity ?? 1)));

    List<Product> allProducts = [];
    List<String> categories = ['All'];

    if (catState is CatalogLoaded) {
      allProducts = catState.products.where((p) => p.isOneTime).toList();
      for (final p in allProducts) {
        final cat = p.category.trim();
        if (cat.isNotEmpty && !categories.contains(cat)) {
          categories.add(cat);
        }
      }
    }

    final filteredProducts = allProducts.where((p) {
      final matchesSearch = _searchQuery.isEmpty ||
          p.name.toLowerCase().contains(_searchQuery) ||
          p.category.toLowerCase().contains(_searchQuery);
      final matchesCategory = _selectedCategory == 'All' ||
          p.category.toLowerCase() == _selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    }).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              width: 38,
              height: 4.5,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 4, 12, 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.add_shopping_cart_rounded,
                              size: 18, color: Color(0xFF0284C7)),
                          const SizedBox(width: 8),
                          const Text(
                            'Add Products for Delivery',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Scheduled: ${_formatSheetDate(widget.date)}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded,
                      color: Color(0xFF64748B), size: 22),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),

          const Divider(height: 1, color: Color(0xFFF1F5F9)),

          // Slot Selector Bar (if slots available)
          if (availableSlots.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: const Color(0xFFF8FAFC),
              child: Row(
                children: [
                  const Icon(Icons.access_time_rounded,
                      size: 15, color: Color(0xFF64748B)),
                  const SizedBox(width: 6),
                  const Text(
                    'Delivery Slot:',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF475569),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ...availableSlots.map((slot) {
                    final isSelected = _selectedSlot.toLowerCase() ==
                        slot.toLowerCase();
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: GestureDetector(
                        onTap: () {
                          setState(() => _selectedSlot = slot);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? const Color(0xFF0284C7)
                                : Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: isSelected
                                  ? const Color(0xFF0284C7)
                                  : const Color(0xFFCBD5E1),
                            ),
                          ),
                          child: Text(
                            slot,
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: isSelected
                                  ? Colors.white
                                  : const Color(0xFF334155),
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),

          // Search Field
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (val) =>
                    setState(() => _searchQuery = val.trim().toLowerCase()),
                decoration: InputDecoration(
                  hintText: 'Search products by name...',
                  hintStyle: const TextStyle(
                      fontSize: 13, color: Color(0xFF94A3B8)),
                  prefixIcon: const Icon(Icons.search_rounded,
                      size: 19, color: Color(0xFF64748B)),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded,
                              size: 16, color: Color(0xFF64748B)),
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _searchQuery = '');
                          },
                        )
                      : null,
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ),

          // Category Pills
          if (categories.length > 1)
            Container(
              height: 36,
              margin: const EdgeInsets.symmetric(vertical: 4),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: categories.length,
                separatorBuilder: (_, index) => const SizedBox(width: 6),
                itemBuilder: (context, idx) {
                  final cat = categories[idx];
                  final isSelected = _selectedCategory == cat;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedCategory = cat),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? const Color(0xFF0284C7)
                            : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Text(
                        cat,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isSelected
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color: isSelected
                              ? Colors.white
                              : const Color(0xFF475569),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

          const SizedBox(height: 4),

          // Products List
          Expanded(
            child: catState is! CatalogLoaded
                ? const Center(
                    child: CircularProgressIndicator(
                      color: Color(0xFF0284C7),
                      strokeWidth: 2.5,
                    ),
                  )
                : filteredProducts.isEmpty
                    ? Center(
                        child: Text(
                          _searchQuery.isNotEmpty
                              ? 'No products match "$_searchQuery"'
                              : 'No products available for this category',
                          style: const TextStyle(
                              fontSize: 13, color: Color(0xFF94A3B8)),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                        itemCount: filteredProducts.length,
                        separatorBuilder: (_, index) => const Divider(
                            height: 12, color: Color(0xFFF1F5F9)),
                        itemBuilder: (context, index) {
                          final product = filteredProducts[index];
                          return _buildCatalogProductRow(
                            context,
                            product,
                            cartItems,
                          );
                        },
                      ),
          ),

          // Bottom Bar for Checkout
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 10,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        totalDateItems > 0
                            ? '$totalDateItems item${totalDateItems > 1 ? "s" : ""} scheduled'
                            : '0 items scheduled',
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF475569),
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        '₹${totalDateAmount.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                ),
                ElevatedButton.icon(
                  onPressed: totalDateItems > 0
                      ? () {
                          Navigator.of(context).pop();
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const CartScreen(),
                            ),
                          );
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: const Color(0xFFCBD5E1),
                    disabledForegroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 18, vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  icon: const Icon(Icons.shopping_cart_checkout_rounded,
                      size: 18),
                  label: const Text(
                    'View Cart & Checkout',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCatalogProductRow(
    BuildContext context,
    Product product,
    List<CartItemEntity> cartItems,
  ) {
    final v = product.variants.isNotEmpty ? product.variants.first : null;
    final variantId = v?.id ?? product.id;
    final price = v?.price ?? product.price;
    final variantLabel = v?.label ?? (product.variantName ?? '');

    // Check quantity in cart for this delivery date
    CartItemEntity? matchedItem;
    for (final item in cartItems) {
      if ((item.productId == product.id || item.variantId == variantId) &&
          item.deliveryDate == widget.dateStr &&
          item.purchaseType == 'onetime') {
        matchedItem = item;
        break;
      }
    }
    final quantity = matchedItem?.quantity ?? 0;

    void onAdd() {
      final cartItem = CartItemEntity(
        productId: product.id,
        variantId: variantId,
        productName: product.name,
        variantName: variantLabel,
        unitPrice: price,
        purchaseType: 'onetime',
        quantity: 1,
        deliveryDate: widget.dateStr,
        deliverySlot: _selectedSlot,
        imageAsset: product.imageAsset,
        isSubscribable: product.isSubscribable,
        isOneTime: product.isOneTime,
        subscriptionPrice: v?.subscriptionPrice,
      );
      context.read<CartBloc>().add(AddToCartEvent(cartItem));
    }

    void onRemove() {
      if (matchedItem != null) {
        context.read<CartBloc>().add(RemoveFromCartEvent(matchedItem));
      }
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          // Product Thumbnail
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Padding(
                padding: const EdgeInsets.all(2),
                child: buildProductImage(
                  product.name,
                  imageAsset: product.imageAsset,
                  width: 52,
                  height: 52,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Name and Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1E293B),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (variantLabel.isNotEmpty &&
                        variantLabel.toLowerCase() != 'standard') ...[
                      Text(
                        variantLabel,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF64748B),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text('•',
                          style: TextStyle(color: Color(0xFFCBD5E1))),
                      const SizedBox(width: 6),
                    ],
                    Text(
                      '₹${price.toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Add / Stepper controls
          quantity == 0
              ? OutlinedButton(
                  onPressed: onAdd,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF0284C7),
                    side: const BorderSide(color: Color(0xFF0284C7), width: 1.2),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 6),
                    minimumSize: const Size(64, 32),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text(
                    '+ ADD',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                )
              : Container(
                  height: 32,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0284C7),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.remove_rounded,
                            size: 16, color: Colors.white),
                        onPressed: onRemove,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 28),
                      ),
                      Text(
                        '$quantity',
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.add_rounded,
                            size: 16, color: Colors.white),
                        onPressed: onAdd,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 28),
                      ),
                    ],
                  ),
                ),
        ],
      ),
    );
  }
}
