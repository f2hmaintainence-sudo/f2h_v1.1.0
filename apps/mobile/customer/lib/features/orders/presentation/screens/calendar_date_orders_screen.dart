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
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/features/catalog/presentation/helpers/cart_helpers.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/cart_screen.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/home_screen.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_screen.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_view_screen.dart';
import 'package:f2h_customer/features/catalog/presentation/widgets/product_grid_card.dart';
import 'package:f2h_customer/features/orders/presentation/screens/order_details_screen.dart';
import 'package:f2h_customer/features/orders/presentation/screens/order_tracking_screen.dart';
import 'package:f2h_customer/app.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/theme/app_colors.dart';

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
    _fetchOrdersForDate(showLoading: _orders.isEmpty);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final catState = context.read<CatalogBloc>().state;
        if (catState is! CatalogLoaded) {
          context.read<CatalogBloc>().add(const LoadCatalog());
        }
      }
    });
  }

  void _openCartForDate(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CartScreen(initialDeliveryDate: widget.date),
      ),
    );
  }

  Future<void> _fetchOrdersForDate({bool showLoading = true}) async {
    if (showLoading) {
      setState(() {
        _isLoading = true;
      });
    }

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
      case 'in_transit':
        return const Color(0xFF0284C7); // Vivid sky blue
      case 'dispatched':
        return const Color(0xFF0284C7); // Sky blue
      case 'assigned':
        return const Color(0xFF6366F1); // Indigo
      case 'confirmed':
        return const Color(0xFF0EA5E9); // Ocean blue
      case 'placed':
        return const Color(0xFF38BDF8); // Soft cyan blue
      case 'pending':
        return const Color(0xFFD97706); // Amber
      case 'processing':
        return const Color(0xFFF59E0B); // Warm amber
      case 'cancelled':
        return const Color(0xFFEF4444); // Red
      case 'failed':
        return const Color(0xFFDC2626); // Crimson
      case 'on_hold':
        return const Color(0xFFF43F5E); // Rose
      case 'refunded':
      case 'returned':
        return const Color(0xFF8B5CF6); // Violet
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
      case 'in_transit':
        return 'In Transit';
      case 'dispatched':
        return 'Dispatched';
      case 'assigned':
        return 'Partner Assigned';
      case 'confirmed':
        return 'Order Confirmed';
      case 'placed':
        return 'Order Placed';
      case 'processing':
        return 'Processing';
      case 'pending':
        return 'Pending';
      case 'cancelled':
        return 'Cancelled';
      case 'failed':
        return 'Failed';
      case 'on_hold':
        return 'On Hold';
      case 'refunded':
        return 'Refunded';
      case 'returned':
        return 'Returned';
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

  void _navigateToShop(BuildContext context) {
    final shell = AppShell.of(context);
    if (shell != null) {
      Navigator.of(context).popUntil((route) => route.isFirst);
      shell.setTab(AppShell.tabShop);
    } else {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const BrowseScreen()),
      );
    }
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
            onPressed: () => _fetchOrdersForDate(showLoading: true),
          ),
          BlocBuilder<CartBloc, CartState>(
            builder: (context, cartState) {
              final items = (cartState is CartLoadedState)
                  ? cartState.items
                  : <CartItemEntity>[];
              final totalCount = items.fold<int>(
                0,
                (sum, i) =>
                    sum +
                    (i.purchaseType == 'subscription'
                        ? 1
                        : (i.quantity ?? 1)),
              );
              return Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.shopping_cart_outlined,
                        color: Color(0xFF1E293B), size: 22),
                    tooltip: 'Cart for this date',
                    onPressed: () => _openCartForDate(context),
                  ),
                  if (totalCount > 0)
                    Positioned(
                      right: 6,
                      top: 6,
                      child: Container(
                        padding: const EdgeInsets.all(3.5),
                        decoration: const BoxDecoration(
                          color: kPrimary,
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 17,
                          minHeight: 17,
                        ),
                        child: Text(
                          totalCount > 99 ? '99+' : '$totalCount',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            height: 1,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                color: kPrimary,
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
          if (cartItems.isEmpty) return const SizedBox.shrink();

          final dateCartItems =
              cartItems.where((i) => i.deliveryDate == _dateStr).toList();
          final isSameDate = dateCartItems.isNotEmpty;

          final displayItems = isSameDate ? dateCartItems : cartItems;
          final totalDisplayItems = displayItems.fold<int>(
              0, (sum, i) => sum + (i.purchaseType == 'subscription' ? 1 : (i.quantity ?? 1)));
          final totalDisplayAmount = displayItems.fold<double>(
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
                          isSameDate
                              ? '$totalDisplayItems item${totalDisplayItems > 1 ? "s" : ""} scheduled'
                              : '$totalDisplayItems item${totalDisplayItems > 1 ? "s" : ""} in cart',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '₹${totalDisplayAmount.toStringAsFixed(0)}',
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
                    onPressed: () => _openCartForDate(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPrimary,
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
    return RefreshIndicator(
      onRefresh: () => _fetchOrdersForDate(showLoading: true),
      color: kPrimary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
        children: [
          // Empty State Information Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
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
              children: [
                Container(
                  width: 58,
                  height: 58,
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
                    size: 28,
                    color: isEligible
                        ? kPrimary
                        : const Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  isEligible ? 'No Orders Scheduled' : 'No Orders for this Date',
                  style: const TextStyle(
                    fontSize: 16.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  isEligible
                      ? (isToday
                          ? 'You have no deliveries scheduled for today yet. You can order fresh products until $cutoffFormatted.'
                          : 'You have no deliveries scheduled for $formattedDate yet. You can schedule items for delivery on this day.')
                      : (isToday
                          ? 'Orders for today closed at $cutoffFormatted (Customer Cutoff Time).'
                          : 'There were no orders or deliveries scheduled on $formattedDate.'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF64748B),
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: isEligible
                        ? const Color(0xFFECFDF5)
                        : const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isEligible
                          ? const Color(0xFFA7F3D0)
                          : const Color(0xFFFECACA),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isEligible
                            ? Icons.check_circle_outline_rounded
                            : Icons.access_time_filled_rounded,
                        size: 14,
                        color: isEligible
                            ? const Color(0xFF059669)
                            : const Color(0xFFDC2626),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        isEligible
                            ? (isToday
                                ? 'Orders open until $cutoffFormatted today'
                                : 'Available for scheduled delivery')
                            : (isToday
                                ? 'Cutoff Passed ($cutoffFormatted)'
                                : 'Past Date • Orders Closed'),
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: isEligible
                              ? const Color(0xFF059669)
                              : const Color(0xFFDC2626),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Show the two product add sections: "Add Products for this Date" card + "Quick Add Essentials" shelf
          _buildAddProductsBelowCard(context, isEligible, 'Morning'),
        ],
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
      color: kPrimary,
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
    final cartVariantIds = (cartState is CartLoadedState)
        ? cartState.items.map((i) => i.variantId).toSet()
        : <String>{};

    List<Product> quickProducts = [];
    if (catState is CatalogLoaded) {
      quickProducts = catState.products
          .where((p) =>
              !p.isSubscribable &&
              !cartVariantIds.contains(p.id) &&
              !p.isOutOfStock)
          .toList();
      if (quickProducts.isEmpty) {
        quickProducts = catState.products
            .where((p) => !p.isOutOfStock)
            .take(10)
            .toList();
      }
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
            border: Border.all(color: const Color(0xFFBBF7D0), width: 1.2),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFFF0FDF4),
                Colors.white,
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: kPrimary.withValues(alpha: 0.06),
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
                      color: kPrimary.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.add_shopping_cart_rounded,
                      color: kPrimary,
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
                  onPressed: () => _navigateToShop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    elevation: 0,
                  ),
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text(
                    'Browse & Add Products',
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
                      color: kPrimary,
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
                  onTap: () => _navigateToShop(context),
                  child: const Text(
                    'View All >',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: kPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          InfiniteAutoScrollList(
            height: 285,
            itemWidth: 165,
            autoScrollInterval: const Duration(milliseconds: 10000),
            scrollDuration: const Duration(milliseconds: 1000),
            animateClockwise: false,
            items: quickProducts
                .map(
                  (p) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: SizedBox(
                      width: 165,
                      child: ProductGridCard(p),
                    ),
                  ),
                )
                .toList(),
          ),
        ],
      ],
    );
  }
}


