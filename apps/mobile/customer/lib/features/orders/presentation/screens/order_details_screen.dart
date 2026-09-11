import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';
import 'package:f2h_customer/features/orders/domain/repositories/orders_repository.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_bloc.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_event.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_state.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_view_screen.dart';
import '../../../catalog/presentation/bloc/catalog_bloc.dart';
import '../../../catalog/presentation/bloc/catalog_state.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:f2h_customer/core/auth/token_storage.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';

class OrderDetailsScreen extends StatefulWidget {
  final Order? order;
  final String? orderId;
  const OrderDetailsScreen({super.key, this.order, this.orderId});

  @override
  State<OrderDetailsScreen> createState() => _OrderDetailsScreenState();
}

class _OrderDetailsScreenState extends State<OrderDetailsScreen> {
  Order? _currentOrder;
  bool _isLoading = false;
  int _selectedRating = 0;
  final TextEditingController _feedbackController = TextEditingController();
  bool _isSubmittingRating = false;

  String get _orderId => _currentOrder?.id ?? widget.order?.id ?? widget.orderId ?? '';

  String _formatSlot(String slot) {
    final s = slot.trim().toLowerCase();
    if (s == 'morning') return 'Morning slot';
    if (s == 'evening') return 'Evening slot';
    if (s.isEmpty) return '';
    return '${slot.trim()} slot';
  }

  String _formatDeliveryTimeOnly(Order order) {
    final raw = order.deliveredAt.isNotEmpty ? order.deliveredAt : order.updatedAt;
    if (raw.isNotEmpty) {
      try {
        final dt = DateTime.parse(raw).toLocal();
        final hour = dt.hour;
        final minute = dt.minute.toString().padLeft(2, '0');
        final period = hour >= 12 ? 'PM' : 'AM';
        final formattedHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
        return '${formattedHour.toString().padLeft(2, '0')}:$minute $period';
      } catch (_) {}
    }
    return '';
  }

  String _formatDisplayDate(Order order) {
    final raw = order.scheduledDate.isNotEmpty ? order.scheduledDate : order.date;
    if (raw.isNotEmpty) {
      try {
        final dt = DateTime.parse(raw);
        final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
      } catch (_) {
        return order.date.isNotEmpty ? order.date : raw;
      }
    }
    return 'Scheduled';
  }

  bool _isOneTimeOrder(Order order) {
    final src = order.orderSource.toLowerCase().trim();
    final type = order.orderType.toLowerCase().trim();
    if (src == 'subscription' || type == 'subscription' || order.subscriptionId.trim().isNotEmpty) {
      return false;
    }
    return true;
  }

  Future<void> _downloadInvoice(Order order) async {
    try {
      final token = await TokenStorage.getAccessToken();
      final basePdfUrl = ApiEndpoints.receiptPdf(order.id);
      final pdfUrl = token != null && token.isNotEmpty
          ? '$basePdfUrl?token=$token'
          : basePdfUrl;
      final uri = Uri.parse(pdfUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (e) {
      debugPrint('Error downloading invoice: $e');
      if (mounted) {
        F2HToast.show(context, 'Could not download invoice: $e', isError: true);
      }
    }
  }

  @override
  void initState() {
    super.initState();
    if (widget.order != null) {
      _currentOrder = widget.order;
      _selectedRating = widget.order!.rating ?? 0;
      _feedbackController.text = widget.order!.ratingFeedback ?? '';
    } else if (widget.orderId != null && widget.orderId!.isNotEmpty) {
      _fetchOrderById(widget.orderId!);
    }
  }

  Future<void> _fetchOrderById(String orderId) async {
    setState(() => _isLoading = true);
    try {
      final repository = sl<OrdersRepository>();
      final cleanId = orderId.replaceAll('#F2H-', '').replaceAll('F2H-', '').trim();

      // 1. First attempt direct single-order fetch from API
      try {
        final orderRes = await repository.getOrderById(cleanId);
        if (orderRes['status'] == true && orderRes['order'] != null) {
          final rawOrder = Map<String, dynamic>.from(orderRes['order'] as Map);
          if (orderRes['items'] != null) {
            rawOrder['items'] = orderRes['items'];
          }
          final parsed = Order.fromJson(rawOrder);
          if (mounted) {
            setState(() {
              _currentOrder = parsed;
              _selectedRating = parsed.rating ?? 0;
              _feedbackController.text = parsed.ratingFeedback ?? '';
              _isLoading = false;
            });
            return;
          }
        }
      } catch (_) {
        // Fallback to searching in all customer orders
      }

      // 2. Fallback: search across all customer orders and subscriptions
      final data = await repository.getOrdersAndSubscriptions();
      final rawOrders = (data['orders'] as List<dynamic>? ??
          data['one_time_orders'] as List<dynamic>? ??
          []);
      final rawSubOrders = (data['subscription_orders'] as List<dynamic>? ?? []);
      final all = [...rawOrders, ...rawSubOrders]
          .map((e) => Order.fromJson(e as Map<String, dynamic>))
          .toList();

      final found = all.firstWhere(
        (o) =>
            o.id.toLowerCase() == cleanId.toLowerCase() ||
            o.id.toLowerCase() == orderId.toLowerCase() ||
            (cleanId.isNotEmpty && o.id.toLowerCase().contains(cleanId.toLowerCase())) ||
            (o.id.isNotEmpty && cleanId.toLowerCase().contains(o.id.toLowerCase())),
        orElse: () => all.isNotEmpty ? all.first : throw Exception('Order not found'),
      );
      if (mounted) {
        setState(() {
          _currentOrder = found;
          _selectedRating = found.rating ?? 0;
          _feedbackController.text = found.ratingFeedback ?? '';
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _feedbackController.dispose();
    super.dispose();
  }

  bool _canCancelOrder(Order order) {
    // If backend API provided dynamic cancellation eligibility, use it directly
    if (order.isCancellable != null) {
      return order.isCancellable!;
    }

    // Only one-time orders
    if (order.orderSource.toLowerCase() == 'subscription') {
      return false;
    }
    // Only pending or placed orders
    final status = order.status.toLowerCase();
    if (status != 'pending' && status != 'placed') {
      return false;
    }

    try {
      final now = DateTime.now();
      final deliveryDate = DateTime.parse(order.scheduledDate);
      final isEvening = order.deliverySlot.toLowerCase() == 'evening';

      // Dynamically resolve Customer Order Cutoff Time from sessionState.slotTimings
      final sessionState = context.read<CustomerSessionCubit>().state;
      final slotTimings = sessionState.slotTimings;
      final slotConfig = (isEvening ? slotTimings['evening_slot'] : slotTimings['morning_slot']) as Map?;

      final cutoffTimeStr = slotConfig?['customer_cutoff_time']?.toString() ??
          (isEvening
              ? (slotTimings['evening_cutoff_time']?.toString() ?? '14:00')
              : (slotTimings['morning_cutoff_time']?.toString() ?? '20:00'));
      final dayOffset = int.tryParse(slotConfig?['customer_cutoff_day_offset']?.toString() ?? '') ??
          (isEvening ? 0 : -1);

      final parts = cutoffTimeStr.split(':');
      final cutoffHour = int.tryParse(parts[0]) ?? (isEvening ? 14 : 20);
      final cutoffMinute = parts.length > 1 ? (int.tryParse(parts[1]) ?? 0) : 0;

      final targetDate = deliveryDate.add(Duration(days: dayOffset));
      final cutoffTime = DateTime(
        targetDate.year,
        targetDate.month,
        targetDate.day,
        cutoffHour,
        cutoffMinute,
      );

      return now.isBefore(cutoffTime);
    } catch (_) {
      return false;
    }
  }

  String _getFreezeTimeMessage(Order order) {
    if (order.cancellationMessage != null && order.cancellationMessage!.isNotEmpty) {
      return order.cancellationMessage!;
    }

    final isEvening = order.deliverySlot.toLowerCase() == 'evening';
    final sessionState = context.read<CustomerSessionCubit>().state;
    final slotTimings = sessionState.slotTimings;
    final slotConfig = (isEvening ? slotTimings['evening_slot'] : slotTimings['morning_slot']) as Map?;
    final desc = slotConfig?['customer_cutoff_description']?.toString();

    if (desc != null && desc.isNotEmpty) {
      return '${isEvening ? "Evening" : "Morning"} deliveries cutoff at $desc.';
    }

    return isEvening
        ? 'Evening deliveries cutoff at 2:00 PM on delivery day.'
        : 'Morning deliveries cutoff at 8:00 PM on the night before delivery.';
  }

  void _submitRating() {
    if (_selectedRating == 0) {
      F2HToast.error(context, 'Please select at least 1 star.');
      return;
    }

    setState(() {
      _isSubmittingRating = true;
    });

    context.read<OrderHistoryBloc>().add(
      RateOrderRequested(
        orderId: _orderId,
        rating: _selectedRating,
        feedback: _feedbackController.text.trim(),
      ),
    );
  }

  void _cancelOrder() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Cancel Order',
          style: TextStyle(fontWeight: FontWeight.w800, color: kText),
        ),
        content: const Text('Are you sure you want to cancel this order? The amount will be refunded to your wallet.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('No, Keep It', style: TextStyle(color: kTextSub)),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<OrderHistoryBloc>().add(
                CancelOrderRequested(orderId: _orderId),
              );
            },
            child: const Text('Yes, Cancel', style: TextStyle(color: kRed, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: kBg,
        body: Center(child: CircularProgressIndicator(color: kPrimary)),
      );
    }

    if (_currentOrder == null) {
      return Scaffold(
        backgroundColor: kBg,
        appBar: AppBar(
          backgroundColor: kSurface,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: kText),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text('Order Details', style: TextStyle(color: kText, fontWeight: FontWeight.w700)),
        ),
        body: const Center(child: Text('Order not found')),
      );
    }

    final order = _currentOrder!;
    final bool cancelPossible = _canCancelOrder(order);

    // Resolve user address
    final sessionState = context.read<CustomerSessionCubit>().state;
    final addresses = sessionState.addresses;
    String addressDetails = 'Flat/House Details Not Found';
    String contactName = sessionState.profile?.name ?? 'Customer';
    String contactMobile = sessionState.profile?.mobile ?? '';

    if (addresses.isNotEmpty) {
      final matchedAddress = addresses.firstWhere(
        (a) => a.addressId?.toString() == order.addressId,
        orElse: () => addresses.firstWhere(
          (a) => a.isDefault,
          orElse: () => addresses.first,
        ),
      );
      addressDetails = matchedAddress.detail;
      contactName = matchedAddress.name;
      contactMobile = matchedAddress.mobileNumber;
    }

    return BlocListener<OrderHistoryBloc, OrderHistoryState>(
      listener: (context, state) {
        if (state is OrderActionSuccess) {
          setState(() {
            _isSubmittingRating = false;
          });
          F2HToast.success(context, state.message);
          // Only pop the screen if the order was cancelled, not when rating is updated!
          if (state.message.toLowerCase().contains('cancel')) {
            Navigator.pop(context);
          }
        } else if (state is OrderHistoryError) {
          setState(() {
            _isSubmittingRating = false;
          });
          F2HToast.error(context, state.message);
        } else if (state is OrderHistoryLoaded) {
          try {
            final updatedOrder = state.oneTimeOrders.firstWhere(
              (o) => o.id == _orderId,
              orElse: () => state.subscriptionOrders.firstWhere(
                (o) => o.id == _orderId,
                orElse: () => _currentOrder!,
              ),
            );
            setState(() {
              _currentOrder = updatedOrder;
            });
          } catch (_) {}
        }
      },
      child: Scaffold(
        backgroundColor: kBg,
        appBar: AppBar(
          backgroundColor: kSurface,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, color: kText, size: 20),
            onPressed: () => Navigator.pop(context),
          ),
          title: Builder(
            builder: (context) {
              final isDelivered = order.status.toLowerCase() == 'delivered';
              final deliveryTimeOnly = _formatDeliveryTimeOnly(order);
              final statusTitle = order.status.toUpperCase();

              Color statusColor = kPrimary;
              if (order.status.toLowerCase() == 'cancelled') {
                statusColor = kRed;
              } else if (order.status.toLowerCase() == 'placed') {
                statusColor = Colors.orange;
              }

              final dateStr = _formatDisplayDate(order);
              final slotStr = order.deliverySlot.trim().isNotEmpty ? ' · ${_formatSlot(order.deliverySlot)}' : '';
              final deliveryStr = (isDelivered && deliveryTimeOnly.isNotEmpty) ? ' · $deliveryTimeOnly' : '';
              final subtitleText = '$dateStr$slotStr$deliveryStr';

              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    statusTitle,
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitleText,
                    style: const TextStyle(
                      color: kTextSub,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              );
            },
          ),
          centerTitle: true,
          actions: [
            if (order.status.toLowerCase() == 'delivered' && _isOneTimeOrder(order))
              IconButton(
                icon: const Icon(Icons.download_rounded, color: kPrimary),
                tooltip: 'Download Invoice',
                onPressed: () => _downloadInvoice(order),
              ),
          ],
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Items card
              _buildItemsCard(order),

              // Payment, Billing and Address card
              _buildBillingCard(order, contactName, contactMobile, addressDetails),

              // Cancel button section
              if (order.status.toLowerCase() == 'placed')
                _buildCancelSection(order, cancelPossible),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildItemsCard(Order order) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'ORDERED ITEMS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: kTextSub,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: order.items.length,
            separatorBuilder: (_, _) => Divider(color: kBorder.withValues(alpha: 0.5)),
            itemBuilder: (context, idx) {
              final item = order.items[idx];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  GestureDetector(
                    onTap: () {
                      // Prefer the live catalog row. getProductById only
                      // synthesizes a Product from the order line and reports
                      // no stock, which left ADD TO CART enabled on the
                      // product page for a variant that has since sold out.
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
                      if (liveProduct == null) {
                        F2HToast.error(
                          context,
                          'This product is no longer available in the catalog',
                          title: 'Item Unavailable',
                        );
                        return;
                      }
                      Navigator.push(
                        context,
                        PageRouteBuilder(
                          pageBuilder: (_, a, _) =>
                              ProductDetailViewScreen(product: liveProduct!),
                          transitionsBuilder: (_, a, _, child) =>
                              FadeTransition(opacity: a, child: child),
                          transitionDuration: const Duration(milliseconds: 220),
                        ),
                      );
                    },
                    child: Row(
                      children: [
                        Container(
                          width: 70,
                          height: 70,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: kBorderLt, width: 1),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Padding(
                              padding: const EdgeInsets.all(4),
                              child: buildProductImage(
                                item.productName,
                                imageAsset: item.imagePath,
                                width: 70,
                                height: 70,
                                fit: BoxFit.contain,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.productName,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: kText,
                                ),
                              ),
                              if (item.variantName.isNotEmpty && item.variantName.toLowerCase() != 'standard')
                                Text(
                                  item.variantName,
                                  style: const TextStyle(fontSize: 11, color: kTextSub),
                                ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '₹${item.finalPrice.toStringAsFixed(2)}',
                              style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: kText,
                              ),
                            ),
                            Text(
                              '₹${item.unitPrice.toStringAsFixed(2)} × ${item.quantity}',
                              style: const TextStyle(fontSize: 10, color: kTextSub),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (order.status.toLowerCase() == 'delivered') ...[
                    const SizedBox(height: 12),
                    _ProductRatingWidget(orderId: order.id, item: item),
                    const SizedBox(height: 4),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildBillingCard(
    Order order,
    String contactName,
    String contactMobile,
    String addressDetails,
  ) {
    final subtotal = order.amount; // total amount
    final total = subtotal;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'BILLING DETAILS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: kTextSub,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Subtotal', style: TextStyle(color: kTextSub, fontSize: 13)),
              Text('₹${subtotal.toStringAsFixed(2)}', style: const TextStyle(color: kText, fontSize: 13, fontWeight: FontWeight.w600)),
            ],
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(color: kBorder),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total Bill', style: TextStyle(color: kText, fontSize: 14, fontWeight: FontWeight.w800)),
              Text(
                '₹${total.toStringAsFixed(2)}',
                style: const TextStyle(color: kPrimary, fontSize: 16, fontWeight: FontWeight.w900),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: kBgDeep,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.payment_outlined, color: kTextMid, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '${order.paymentMode.toUpperCase()} (${order.paymentStatus.toUpperCase()})',
                    style: const TextStyle(fontSize: 12, color: kTextMid, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          if (addressDetails.isNotEmpty || contactName.isNotEmpty || contactMobile.isNotEmpty) ...[
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.location_on_outlined, color: kPrimary, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (contactName.isNotEmpty)
                        Text(
                          contactName,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: kText,
                          ),
                        ),
                      if (contactMobile.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          contactMobile,
                          style: const TextStyle(fontSize: 11, color: kTextSub),
                        ),
                      ],
                      if (addressDetails.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          addressDetails,
                          style: const TextStyle(
                            fontSize: 12,
                            color: kTextSub,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ],

        ],
      ),
    );
  }

  Widget _buildCancelSection(Order order, bool cancelPossible) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        children: [
          if (!cancelPossible) ...[
            Row(
              children: [
                const Icon(Icons.info_outline, color: kRed, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _getFreezeTimeMessage(order),
                    style: const TextStyle(fontSize: 11, color: kRed, fontWeight: FontWeight.w600, height: 1.4),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: cancelPossible ? _cancelOrder : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: kRed,
                foregroundColor: Colors.white,
                disabledBackgroundColor: kBorder,
                disabledForegroundColor: kTextSub,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.symmetric(vertical: 14),
                elevation: 0,
              ),
              child: Text(
                cancelPossible ? 'CANCEL ORDER' : 'CANCELLATION CLOSED',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductRatingWidget extends StatefulWidget {
  final String orderId;
  final OrderItem item;
  const _ProductRatingWidget({
    super.key,
    required this.orderId,
    required this.item,
  });

  @override
  State<_ProductRatingWidget> createState() => _ProductRatingWidgetState();
}

class _ProductRatingWidgetState extends State<_ProductRatingWidget> {
  int _selectedRating = 0;
  final TextEditingController _feedbackController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _selectedRating = widget.item.rating ?? 0;
    _feedbackController.text = widget.item.ratingFeedback ?? '';
  }

  @override
  void didUpdateWidget(covariant _ProductRatingWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.item.rating != oldWidget.item.rating ||
        widget.item.ratingFeedback != oldWidget.item.ratingFeedback ||
        _isSubmitting) {
      _selectedRating = widget.item.rating ?? 0;
      _feedbackController.text = widget.item.ratingFeedback ?? '';
      _isSubmitting = false;
    }
  }

  @override
  void dispose() {
    _feedbackController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_selectedRating == 0) {
      F2HToast.error(context, 'Please select at least 1 star');
      return;
    }
    setState(() => _isSubmitting = true);
    context.read<OrderHistoryBloc>().add(
      RateOrderRequested(
        orderId: widget.orderId,
        productId: widget.item.productId,
        rating: _selectedRating,
        feedback: _feedbackController.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool alreadyRated = widget.item.rating != null;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: kBgDeep,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderLt),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                alreadyRated ? 'YOUR PRODUCT RATING' : 'RATE THIS PRODUCT',
                style: const TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  color: kTextMid,
                  letterSpacing: 1.0,
                ),
              ),
              const Spacer(),
              if (alreadyRated)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: kPrimary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'Submitted',
                    style: TextStyle(
                      fontSize: 8.5,
                      fontWeight: FontWeight.bold,
                      color: kPrimary,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.start,
            children: List.generate(5, (index) {
              final starValue = index + 1;
              return GestureDetector(
                onTap: () {
                  setState(() {
                    _selectedRating = starValue;
                  });
                },
                child: Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: Icon(
                    starValue <= _selectedRating ? Icons.star : Icons.star_border,
                    color: Colors.amber,
                    size: 26,
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 36,
                  child: TextField(
                    controller: _feedbackController,
                    decoration: InputDecoration(
                      hintText: 'Share your feedback...',
                      hintStyle: const TextStyle(fontSize: 11, color: kMuted),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: kBorder),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(color: kPrimary),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    ),
                    style: const TextStyle(fontSize: 12, color: kText),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 36,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    elevation: 0,
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 12,
                          width: 12,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5),
                        )
                      : Text(
                          alreadyRated ? 'Update' : 'Submit',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
                        ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class Math {
  static int min(int a, int b) => a < b ? a : b;
}
