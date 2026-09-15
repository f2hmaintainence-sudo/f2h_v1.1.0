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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final catState = context.read<CatalogBloc>().state;
        if (catState is! CatalogLoaded) {
          context.read<CatalogBloc>().add(const LoadCatalog());
        }
      }
    });
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

  void _openAddProductSheet(BuildContext context, {String? initialSlot}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddProductDateBottomSheet(
        date: widget.date,
        dateStr: _dateStr,
        initialSlot: initialSlot,
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
              size: 18, color: Color(0xFF1E293B)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              formattedDate,
              style: const TextStyle(
                fontSize: 15.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
                letterSpacing: -0.2,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              subtitleText,
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w500,
                color: Color(0xFF64748B),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded,
                color: Color(0xFF64748B), size: 22),
            tooltip: 'Refresh orders',
            onPressed: _fetchOrdersForDate,
          ),
          const SizedBox(width: 4),
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
      bottomNavigationBar: BlocBuilder<CartBloc, CartState>(
        builder: (context, cartState) {
          final cartItems = (cartState is CartLoadedState)
              ? cartState.items
              : <CartItemEntity>[];
          final dateCartItems =
              cartItems.where((i) => i.deliveryDate == _dateStr).toList();
          if (dateCartItems.isEmpty) return const SizedBox.shrink();

          final totalDateItems = dateCartItems.fold<int>(
              0, (sum, i) => sum + (i.quantity ?? 1));
          final totalDateAmount = dateCartItems.fold<double>(
              0.0, (sum, i) => sum + (i.unitPrice * (i.quantity ?? 1)));

          return Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 12,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '$totalDateItems item${totalDateItems > 1 ? "s" : ""} scheduled',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '₹${totalDateAmount.toStringAsFixed(0)}',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ],
                    ),
                  ),
                  ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const CartScreen(),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0284C7),
                      foregroundColor: Colors.white,
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
          );
        },
      ),
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
    final preferredSlot = _orders.isNotEmpty &&
            _orders.first.deliverySlot.isNotEmpty
        ? (_orders.first.deliverySlot.toLowerCase().contains('even')
            ? 'Evening'
            : 'Morning')
        : 'Morning';

    return RefreshIndicator(
      onRefresh: _fetchOrdersForDate,
      color: const Color(0xFF0284C7),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
        children: [
          ...List.generate(_orders.length, (index) {
            final order = _orders[index];
            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: _buildOrderCard(context, order),
            );
          }),
          // Product Add Option Below the Card
          _buildAddProductsBelowCard(context, isEligible, preferredSlot),
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        order.id.isNotEmpty
                            ? (order.id.startsWith('#')
                                ? order.id
                                : '#F2H-${order.id}')
                            : '#F2H-Order',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF334155),
                        ),
                      ),
                    ),
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: statusColor.withValues(alpha: 0.25),
                          width: 1,
                        ),
                      ),
                      child: Text(
                        statusText,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                // Delivery Slot in Order Card
                _buildOrderSlotBadge(context, order),
              ],
            ),
          ),

          const Divider(height: 1, color: Color(0xFFF1F5F9)),

          // Products Section Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.shopping_bag_outlined,
                        size: 16, color: Color(0xFF64748B)),
                    const SizedBox(width: 6),
                    Text(
                      'PRODUCTS IN ORDER (${order.items.length})',
                      style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.4,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'Farm Fresh',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF059669),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Items List
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
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
                      'ORDER TOTAL',
                      style: TextStyle(
                        fontSize: 10.5,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '₹${order.amount.toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontSize: 18,
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
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFF0284C7)),
                        ),
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => OrderTrackingScreen(
                                    orderId: order.id,
                                  ),
                                ),
                              );
                            },
                            borderRadius: BorderRadius.circular(10),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 7),
                              child: Row(
                                children: [
                                  Icon(Icons.local_shipping_outlined,
                                      size: 15, color: Color(0xFF0284C7)),
                                  SizedBox(width: 4),
                                  Text(
                                    'Track',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF0284C7),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.03),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    OrderDetailsScreen(order: order),
                              ),
                            );
                          },
                          borderRadius: BorderRadius.circular(10),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(
                                horizontal: 16, vertical: 7),
                            child: Text(
                              'View Details',
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF1E293B),
                              ),
                            ),
                          ),
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
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Thumbnail
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
                child: buildProductImage(
                  item.productName,
                  imageAsset: item.imagePath,
                  width: 52,
                  height: 52,
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
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      if (item.variantName.isNotEmpty &&
                          item.variantName.toLowerCase() != 'standard') ...[
                        Flexible(
                          child: Text(
                            item.variantName,
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.w500,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 5),
                        const Text('•',
                            style: TextStyle(color: Color(0xFFCBD5E1))),
                        const SizedBox(width: 5),
                      ],
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 1.5),
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
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 2),
                // Row(
                //   mainAxisSize: MainAxisSize.min,
                //   children: const [
                //     Text(
                //       'View',
                //       style: TextStyle(
                //         fontSize: 11.5,
                //         fontWeight: FontWeight.w600,
                //         color: Color(0xFF0F172A),
                //       ),
                //     ),
                //     Icon(
                //       Icons.chevron_right_rounded,
                //       size: 15,
                //       color: Color(0xFF0F172A),
                //     ),
                //   ],
                // ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderSlotBadge(BuildContext context, Order order) {
    final slotTimings = slotTimingsOf(context);
    final rawSlot = order.deliverySlot.trim();
    final isEvening = rawSlot.toLowerCase().contains('even');
    final slotTitle = isEvening ? 'Evening Slot' : 'Morning Slot';
    final window = isEvening
        ? getEveningSlotWindow(DateTime.now(), slotTimings)
        : getMorningSlotWindow(DateTime.now(), slotTimings);
    final timeWindow = window.timeRangeText;

    final bgColor =
        isEvening ? const Color(0xFFF5F3FF) : const Color(0xFFFFFBEB);
    final borderColor =
        isEvening ? const Color(0xFFDDD6FE) : const Color(0xFFFDE68A);
    final iconColor =
        isEvening ? const Color(0xFF7C3AED) : const Color(0xFFD97706);
    final textColor =
        isEvening ? const Color(0xFF6D28D9) : const Color(0xFFB45309);
    final subtextColor =
        isEvening ? const Color(0xFF8B5CF6) : const Color(0xFFD97706);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4.5),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: borderColor, width: 1),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isEvening
                    ? Icons.nights_stay_rounded
                    : Icons.wb_sunny_rounded,
                size: 13.5,
                color: iconColor,
              ),
              const SizedBox(width: 5),
              Text(
                slotTitle,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: textColor,
                ),
              ),
              if (timeWindow.isNotEmpty) ...[
                const SizedBox(width: 4),
                Text(
                  '• $timeWindow',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: subtextColor,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (order.orderSource.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Text(
              order.orderSource.toLowerCase() == 'subscription'
                  ? 'Subscription'
                  : 'One-Time Order',
              style: const TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF64748B),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildAddProductsBelowCard(
    BuildContext context,
    bool isEligible,
    String preferredSlot,
  ) {
    final formattedDate = _formatFormattedDate(widget.date);
    final cutoffFormatted = _getCutoffTimeFormatted(context);
    final isToday = _isToday();

    if (!isEligible) {
      return Container(
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: const BoxDecoration(
                color: Color(0xFFFEF2F2),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.access_time_filled_rounded,
                color: Color(0xFFDC2626),
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isToday ? 'Orders Closed for Today' : 'Deliveries Closed',
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    isToday
                        ? 'Cutoff passed at $cutoffFormatted. Order for tomorrow or upcoming dates.'
                        : 'This date has passed and cannot accept new orders.',
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFF64748B),
                      height: 1.3,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final catState = context.watch<CatalogBloc>().state;
    final cartState = context.watch<CartBloc>().state;
    final cartItems =
        (cartState is CartLoadedState) ? cartState.items : <CartItemEntity>[];

    List<Product> quickProducts = [];
    if (catState is CatalogLoaded) {
      quickProducts =
          catState.products.where((p) => p.isOneTime).take(8).toList();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Main Add Products Action Card
        Container(
          margin: const EdgeInsets.only(top: 8, bottom: 16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFBAE6FD), width: 1.2),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFFF0F9FF),
                Colors.white,
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0284C7).withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: const Color(0xFF0284C7).withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.add_shopping_cart_rounded,
                      color: Color(0xFF0284C7),
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Add Products for this Date',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'Schedule more fresh milk, dairy, or groceries for $formattedDate ($preferredSlot Slot).',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF64748B),
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _openAddProductSheet(
                    context,
                    initialSlot: preferredSlot,
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    elevation: 0,
                  ),
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text(
                    '+ Browse & Add Products',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),

        // Quick Add Essentials Shelf
        if (quickProducts.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: const [
                    Icon(
                      Icons.bolt_rounded,
                      size: 18,
                      color: Color(0xFF0284C7),
                    ),
                    SizedBox(width: 4),
                    Text(
                      'Quick Add Essentials',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                  ],
                ),
                GestureDetector(
                  onTap: () => _openAddProductSheet(
                    context,
                    initialSlot: preferredSlot,
                  ),
                  child: const Text(
                    'View All >',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0284C7),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 195,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: quickProducts.length,
              separatorBuilder: (_, index) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final prod = quickProducts[index];
                return _buildQuickProductCard(
                  context,
                  prod,
                  cartItems,
                  preferredSlot,
                );
              },
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildQuickProductCard(
    BuildContext context,
    Product product,
    List<CartItemEntity> cartItems,
    String preferredSlot,
  ) {
    final v = product.variants.isNotEmpty ? product.variants.first : null;
    final variantId = v?.id ?? product.id;
    final price = v?.price ?? product.price;
    final variantLabel = v?.label ?? (product.variantName ?? '');

    CartItemEntity? matchedItem;
    for (final item in cartItems) {
      if ((item.productId == product.id || item.variantId == variantId) &&
          item.deliveryDate == _dateStr &&
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
        deliveryDate: _dateStr,
        deliverySlot: preferredSlot,
        imageAsset: product.imageAsset,
        isSubscribable: product.isSubscribable,
        isOneTime: product.isOneTime,
        subscriptionPrice: v?.subscriptionPrice,
      );
      context.read<CartBloc>().add(AddToCartEvent(cartItem));
      F2HToast.show(
        context,
        'Added ${product.name} for $_dateStr ($preferredSlot)',
      );
    }

    void onRemove() {
      if (matchedItem != null) {
        context.read<CartBloc>().add(RemoveFromCartEvent(matchedItem));
      }
    }

    return Container(
      width: 136,
      padding: const EdgeInsets.all(9),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFF1F5F9)),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: buildProductImage(
                  product.name,
                  imageAsset: product.imageAsset,
                  width: 58,
                  height: 58,
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            product.name,
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
              height: 1.15,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            variantLabel.isNotEmpty && variantLabel.toLowerCase() != 'standard'
                ? variantLabel
                : (product.category.isNotEmpty ? product.category : 'Fresh'),
            style: const TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w500,
              color: Color(0xFF64748B),
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const Spacer(),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '₹${price.toStringAsFixed(0)}',
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              quantity == 0
                  ? InkWell(
                      onTap: onAdd,
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color:
                              const Color(0xFF0284C7).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: const Color(0xFF0284C7),
                            width: 1,
                          ),
                        ),
                        child: const Text(
                          '+ ADD',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0284C7),
                          ),
                        ),
                      ),
                    )
                  : Container(
                      height: 26,
                      decoration: BoxDecoration(
                        color: const Color(0xFF0284C7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          InkWell(
                            onTap: onRemove,
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 4),
                              child: Icon(Icons.remove_rounded,
                                  size: 13, color: Colors.white),
                            ),
                          ),
                          Text(
                            '$quantity',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                          InkWell(
                            onTap: onAdd,
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 4),
                              child: Icon(Icons.add_rounded,
                                  size: 13, color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                    ),
            ],
          ),
        ],
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
  final String? initialSlot;

  const _AddProductDateBottomSheet({
    required this.date,
    required this.dateStr,
    this.initialSlot,
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
      if (widget.initialSlot != null &&
          availableSlots.any((s) =>
              s.toLowerCase() == widget.initialSlot!.toLowerCase())) {
        _selectedSlot = availableSlots.firstWhere((s) =>
            s.toLowerCase() == widget.initialSlot!.toLowerCase());
      } else {
        _selectedSlot = availableSlots.first;
      }
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
