import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_bloc.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_event.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_state.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/product_detail_view_screen.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/orders/presentation/screens/order_tracking_screen.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
// import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
// import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_event.dart';
// import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_state.dart';

class OrderDetailsScreen extends StatefulWidget {
  final Order order;
  const OrderDetailsScreen({super.key, required this.order});

  @override
  State<OrderDetailsScreen> createState() => _OrderDetailsScreenState();
}

class _OrderDetailsScreenState extends State<OrderDetailsScreen> {
  late Order _currentOrder; // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  int _selectedRating = 0;
  final TextEditingController _feedbackController = TextEditingController();
  bool _isSubmittingRating = false;
  

  @override
  void initState() {
    super.initState();
    _currentOrder = widget.order; // [ADDED BY ANTIGRAVITY]
    _selectedRating = widget.order.rating ?? 0;
    _feedbackController.text = widget.order.ratingFeedback ?? '';
  }

  @override
  void dispose() {
    _feedbackController.dispose();
    super.dispose();
  }

  bool _canCancelOrder(Order order) {
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
      
      DateTime freezeTime;

      if (order.deliverySlot.toLowerCase() == 'evening') {
        // Same day 11:55 AM
        freezeTime = DateTime(
          deliveryDate.year,
          deliveryDate.month,
          deliveryDate.day,
          11,
          55,
        );
      } else {
        // Previous day 11:55 PM
        freezeTime = DateTime(
          deliveryDate.year,
          deliveryDate.month,
          deliveryDate.day,
        ).subtract(const Duration(minutes: 5));
      }

      return now.isBefore(freezeTime);
    } catch (_) {
      return false;
    }
  }

  String _getFreezeTimeMessage(Order order) {
    if (order.deliverySlot.toLowerCase() == 'evening') {
      return 'Evening deliveries freeze at 11:55 AM on delivery day.';
    } else {
      return 'Morning deliveries freeze at 11:55 PM on the night before delivery.';
    }
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
        orderId: widget.order.id,
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
                CancelOrderRequested(orderId: widget.order.id),
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
    // Resolve user address
    final sessionState = context.read<CustomerSessionCubit>().state;
    final addresses = sessionState.addresses;
    String addressDetails = 'Flat/House Details Not Found';
    String contactName = sessionState.profile?.name ?? 'Customer';
    String contactMobile = sessionState.profile?.mobile ?? '';

    if (addresses.isNotEmpty) {
      final matchedAddress = addresses.firstWhere(
        (a) => a.addressId?.toString() == _currentOrder.addressId, // [ADDED BY ANTIGRAVITY]
        orElse: () => addresses.firstWhere(
          (a) => a.isDefault,
          orElse: () => addresses.first,
        ),
      );
      addressDetails = matchedAddress.detail;
      contactName = matchedAddress.name;
      contactMobile = matchedAddress.mobileNumber;
    }

    final order = _currentOrder; // [ADDED BY ANTIGRAVITY]
    final bool cancelPossible = _canCancelOrder(order);

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
          // [ADDED BY ANTIGRAVITY]
          // Find the updated order in the loaded state and update our local state!
          try {
            final updatedOrder = state.oneTimeOrders.firstWhere(
              (o) => o.id == widget.order.id,
              orElse: () => state.subscriptionOrders.firstWhere(
                (o) => o.id == widget.order.id,
                orElse: () => _currentOrder,
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
          title: Text(
            'Order #${order.id.toUpperCase().substring(0, Math.min(order.id.length, 20))}',
            style: const TextStyle(
              color: kText,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          centerTitle: true,
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Order status card
              _buildStatusCard(order),

              // Items card
              _buildItemsCard(order),

              // Address card
              _buildAddressCard(contactName, contactMobile, addressDetails),

              // Payment and Billing card
              _buildBillingCard(order),

              // Cancel button section
              if (order.status.toLowerCase() == 'placed')
                _buildCancelSection(order, cancelPossible),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusCard(Order order) {
    Color statusColor = kPrimary;
    IconData statusIcon = Icons.info_outline;
    String statusText = order.status.toUpperCase();

    if (order.status.toLowerCase() == 'delivered') {
      statusColor = kPrimary;
      statusIcon = Icons.check_circle;
    } else if (order.status.toLowerCase() == 'cancelled') {
      statusColor = kRed;
      statusIcon = Icons.cancel;
    } else if (order.status.toLowerCase() == 'placed') {
      statusColor = Colors.orange;
      statusIcon = Icons.hourglass_empty;
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(statusIcon, color: statusColor, size: 26),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  statusText,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: statusColor,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Scheduled: ${order.scheduledDate} · ${order.deliverySlot.toUpperCase()} slot',
                  style: const TextStyle(fontSize: 12, color: kTextSub, fontWeight: FontWeight.w600),
                ),
                if (['out_for_delivery', 'assigned', 'confirmed'].contains(order.status.toLowerCase())) ...[
                  const SizedBox(height: 10),
                  ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => OrderTrackingScreen(orderId: order.id)),
                      );
                    },
                    icon: const Icon(Icons.location_on, size: 16),
                    label: const Text('Live Track Delivery'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPrimary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: order.orderSource == 'subscription' ? const Color(0xFFE0F2FE) : const Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        order.orderSource == 'subscription' ? Icons.autorenew_rounded : Icons.shopping_bag_outlined,
                        size: 9,
                        color: order.orderSource == 'subscription' ? const Color(0xFF0369A1) : const Color(0xFF2E7D32),
                      ),
                      const SizedBox(width: 3),
                      Text(
                        order.orderSource == 'subscription' ? 'Subscription Order' : 'One-Time Order',
                        style: TextStyle(
                          fontSize: 8.5,
                          fontWeight: FontWeight.w800,
                          color: order.orderSource == 'subscription' ? const Color(0xFF0369A1) : const Color(0xFF2E7D32),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }



  Widget _buildItemsCard(Order order) {
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
                      final product = getProductById(
                        item.variantId,
                        name: item.productName,
                        variantName: item.variantName,
                        price: item.unitPrice,
                      );
                      Navigator.push(
                        context,
                        PageRouteBuilder(
                          pageBuilder: (_, a, _) =>
                              ProductDetailViewScreen(product: product),
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

  Widget _buildAddressCard(String name, String mobile, String addressStr) {
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
            'DELIVERY ADDRESS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: kTextSub,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.location_on_outlined, color: kPrimary, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: kText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      mobile,
                      style: const TextStyle(fontSize: 11, color: kTextSub),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      addressStr,
                      style: const TextStyle(
                        fontSize: 12,
                        color: kTextSub,
                        height: 1.4,
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

  Widget _buildBillingCard(Order order) {
    final subtotal = order.amount; // total amount
    const deliveryFee = 0.0;
    final total = subtotal + deliveryFee;

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
          const SizedBox(height: 8),
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Delivery Fee', style: TextStyle(color: kTextSub, fontSize: 13)),
              Text('FREE', style: TextStyle(color: kPrimary, fontSize: 13, fontWeight: FontWeight.w800)),
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
                    'Paid via ${order.paymentMode.toUpperCase()} (${order.paymentStatus.toUpperCase()})',
                    style: const TextStyle(fontSize: 12, color: kTextMid, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
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
                    'This order cannot be cancelled as it is past the freeze time.\n${_getFreezeTimeMessage(order)}',
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
