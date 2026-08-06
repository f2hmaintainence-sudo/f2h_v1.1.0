import 'package:flutter/material.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/features/wallet/data/models/transaction_model.dart';

// For fetching order details
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_bloc.dart';
import 'package:f2h_customer/features/orders/presentation/screens/order_details_screen.dart';

// For fetching subscription details
import 'package:f2h_customer/features/subscription/domain/repositories/subscription_repository.dart';
import 'package:f2h_customer/features/subscription/data/models/subscription_model.dart';
import 'package:f2h_customer/features/subscription/presentation/screens/subscription_detail_screen.dart';

// ══════════════════════════════════════════════════════════
//  TRANSACTION DETAILS SCREEN
// ══════════════════════════════════════════════════════════

class TransactionDetaildScreen extends StatefulWidget {
  final CustomerWalletTransaction transaction;

  const TransactionDetaildScreen({required this.transaction, super.key});

  @override
  State<TransactionDetaildScreen> createState() => _TransactionDetaildScreenState();
}

class _TransactionDetaildScreenState extends State<TransactionDetaildScreen> {
  Order? _loadedOrder;
  bool _isLoadingOrder = false;
  String? _orderError;

  Subscription? _loadedSubscription;
  bool _isLoadingSubscription = false;
  String? _subscriptionError;

  @override
  void initState() {
    super.initState();
    _fetchRelatedData();
  }

  void _fetchRelatedData() {
    final refType = widget.transaction.referenceType?.toLowerCase().trim() ?? '';
    final refId = widget.transaction.referenceId?.trim() ?? '';
    final remarks = widget.transaction.remarks?.trim() ?? '';

    // Parse order ID from reference ID or remarks
    String? orderId;
    if (refId.startsWith('Ord')) {
      orderId = refId;
    } else {
      final match = RegExp(r'\b(Ord[A-Z0-9]+)\b', caseSensitive: true).firstMatch(remarks);
      if (match != null) {
        orderId = match.group(1);
      } else if (refId.isNotEmpty) {
        orderId = refId;
      }
    }

    if (refType == 'order' || refType == 'refund' || refType == 'checkout' || refType == 'order_payment') {
      if (orderId != null && orderId.isNotEmpty) {
        _fetchOrderDetails(orderId);
      }
    } else if (refType == 'subscription') {
      if (refId.isNotEmpty) {
        _fetchSubscriptionDetails(refId);
      }
    }
  }

  Future<void> _fetchOrderDetails(String orderId) async {
    setState(() {
      _isLoadingOrder = true;
      _orderError = null;
    });

    try {
      final response = await sl<DioClient>().dio.get('${ApiEndpoints.orders}/$orderId');
      final raw = response.data;
      if (raw is Map && raw['order'] != null) {
        final orderMap = Map<String, dynamic>.from(raw['order'] as Map);
        if (raw['items'] != null) {
          orderMap['items'] = raw['items'];
        }
        if (raw['feedback'] != null) {
          orderMap['rating'] = raw['feedback']['rating'];
          orderMap['rating_feedback'] = raw['feedback']['feedback'];
        }
        final order = Order.fromJson(orderMap);
        if (mounted) {
          setState(() {
            _loadedOrder = order;
            _isLoadingOrder = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _orderError = 'Order not found in response';
            _isLoadingOrder = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _orderError = 'Could not load order details';
          _isLoadingOrder = false;
        });
      }
    }
  }

  Future<void> _fetchSubscriptionDetails(String subscriptionId) async {
    setState(() {
      _isLoadingSubscription = true;
      _subscriptionError = null;
    });

    try {
      final repository = sl<SubscriptionRepository>();
      final subscriptions = await repository.getSubscriptions();
      final matching = subscriptions.firstWhere(
        (sub) => sub.id == subscriptionId || sub.subscriptionNumber == subscriptionId,
      );
      if (mounted) {
        setState(() {
          _loadedSubscription = matching;
          _isLoadingSubscription = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _subscriptionError = 'Could not load subscription details';
          _isLoadingSubscription = false;
        });
      }
    }
  }

  bool _isCredit(String type) {
    final normalized = type.toLowerCase().trim();
    return normalized == 'credit' ||
        normalized == 'refund' ||
        normalized == 'cashback';
  }

  String _formatDateTime(DateTime? dateTime) {
    if (dateTime == null) return 'N/A';
    final local = dateTime.toLocal();
    final day = local.day.toString().padLeft(2, '0');
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final month = months[local.month - 1];
    final year = local.year;
    
    final hourVal = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final hour = hourVal.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    
    return '$day $month $year, $hour:$minute $period';
  }

  @override
  Widget build(BuildContext context) {
    final isCredit = _isCredit(widget.transaction.transactionType);
    final amountText = '${isCredit ? '+' : '-'}\u{20B9}${widget.transaction.amount.toStringAsFixed(0)}';
    final amountColor = isCredit ? kPrimary : kRed;
    final iconBg = isCredit ? kPrimaryPl : kRedLt;
    final iconColor = isCredit ? kPrimary : kRed;

    final refType = widget.transaction.referenceType?.toLowerCase().trim() ?? '';

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: kText),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Transaction Receipt',
          style: TextStyle(
            color: kText,
            fontSize: 18,
            fontWeight: FontWeight.w900,
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        child: Column(
          children: [
            // Receipt Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.circular(28),
                border: Border.all(color: kBorderLt, width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: kPrimary.withValues(alpha: 0.03),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  )
                ],
              ),
              child: Column(
                children: [
                  // Direction Icon
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: iconBg,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      isCredit ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
                      color: iconColor,
                      size: 32,
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Amount
                  Text(
                    amountText,
                    style: TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.w900,
                      color: amountColor,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Success Badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8F5E9),
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.check_circle_rounded,
                          color: Color(0xFF2E7D32),
                          size: 14,
                        ),
                        SizedBox(width: 6),
                        Text(
                          'Payment Successful',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF2E7D32),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),

                  const Divider(color: kBorderLt, thickness: 1.2),
                  const SizedBox(height: 24),

                  // Receipt details
                  _buildDetailRow(
                    label: 'Transaction Type',
                    value: widget.transaction.transactionType.toUpperCase(),
                    valueColor: kText,
                    isBold: true,
                  ),
                  _buildDetailRow(
                    label: 'Date & Time',
                    value: _formatDateTime(widget.transaction.createdAt),
                  ),
                  _buildDetailRow(
                    label: 'Transaction ID',
                    value: '#TXN${widget.transaction.id}',
                  ),
                  if (widget.transaction.referenceType != null && widget.transaction.referenceType!.isNotEmpty)
                    _buildDetailRow(
                      label: 'Reference Type',
                      value: widget.transaction.referenceType!.toUpperCase(),
                    ),
                  if (widget.transaction.referenceId != null && widget.transaction.referenceId!.isNotEmpty)
                    _buildDetailRow(
                      label: 'Reference ID',
                      value: widget.transaction.referenceId!,
                      valueColor: kPrimary,
                      isBold: true,
                    ),
                  _buildDetailRow(
                    label: 'Post-Transaction Balance',
                    value: '₹${widget.transaction.balanceAfter.toStringAsFixed(0)}',
                  ),
                  if (widget.transaction.remarks != null && widget.transaction.remarks!.trim().isNotEmpty) ...[
                    const SizedBox(height: 12),
                    const Divider(color: kBorderLt, thickness: 1),
                    const SizedBox(height: 16),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Remarks / Description',
                            style: TextStyle(
                              fontSize: 11,
                              color: kTextSub,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            widget.transaction.remarks!,
                            style: const TextStyle(
                              fontSize: 13,
                              height: 1.4,
                              color: kText,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Dynamic Related Information Section
            if (refType == 'order' || refType == 'refund' || refType == 'checkout' || refType == 'order_payment')
              _buildOrderSection(),
            if (refType == 'subscription')
              _buildSubscriptionSection(),

            const SizedBox(height: 16),

            // Back Button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'BACK TO WALLET',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderSection() {
    if (_isLoadingOrder) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: kBorderLt),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: kPrimary),
        ),
      );
    }

    if (_orderError != null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: kBorderLt),
        ),
        child: Center(
          child: Text(
            _orderError!,
            style: const TextStyle(color: kTextSub, fontSize: 13, fontWeight: FontWeight.w600),
          ),
        ),
      );
    }

    if (_loadedOrder == null) {
      return const SizedBox.shrink();
    }

    final order = _loadedOrder!;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: kBorderLt, width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Order Details',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              color: kText,
            ),
          ),
          const SizedBox(height: 16),
          _buildSummaryRow('Order ID', order.id),
          _buildSummaryRow('Status', order.status.toUpperCase(), isStatus: true, status: order.status),
          _buildSummaryRow('Total Amount', '₹${order.amount.toStringAsFixed(0)}'),
          const SizedBox(height: 16),
          const Divider(color: kBorderLt, thickness: 1),
          const SizedBox(height: 12),
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
            separatorBuilder: (_, _) => const Divider(color: kBorderLt, height: 16),
            itemBuilder: (context, idx) {
              final item = order.items[idx];
              return Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: kBorderLt, width: 1),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.all(2),
                        child: buildProductImage(
                          item.productName,
                          imageAsset: item.imagePath,
                          width: 50,
                          height: 50,
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
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: kText,
                          ),
                        ),
                        if (item.variantName.isNotEmpty && item.variantName.toLowerCase() != 'standard')
                          Text(
                            item.variantName,
                            style: const TextStyle(fontSize: 10, color: kTextSub),
                          ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '₹${item.finalPrice.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: kText,
                        ),
                      ),
                      Text(
                        '₹${item.unitPrice.toStringAsFixed(0)} × ${item.quantity}',
                        style: const TextStyle(fontSize: 9, color: kTextSub),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => BlocProvider<OrderHistoryBloc>(
                      create: (_) => sl<OrderHistoryBloc>(),
                      child: OrderDetailsScreen(order: order),
                    ),
                  ),
                );
              },
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12),
                side: const BorderSide(color: kPrimary, width: 1.5),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'VIEW ORDER DETAILS',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  color: kPrimary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubscriptionSection() {
    if (_isLoadingSubscription) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: kBorderLt),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: kPrimary),
        ),
      );
    }

    if (_subscriptionError != null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: kBorderLt),
        ),
        child: Center(
          child: Text(
            _subscriptionError!,
            style: const TextStyle(color: kTextSub, fontSize: 13, fontWeight: FontWeight.w600),
          ),
        ),
      );
    }

    if (_loadedSubscription == null) {
      return const SizedBox.shrink();
    }

    final sub = _loadedSubscription!;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: kBorderLt, width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Subscription Details',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              color: kText,
            ),
          ),
          const SizedBox(height: 16),
          _buildSummaryRow('Subscription ID', sub.displayLabel),
          _buildSummaryRow('Product Name', sub.productName),
          _buildSummaryRow('Frequency', sub.frequency),
          _buildSummaryRow('Status', sub.status.toUpperCase(), isStatus: true, status: sub.status),
          _buildSummaryRow('Cost Per Day', '₹${sub.pricePerDay.toStringAsFixed(0)}'),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => SubscriptionDetailScreen(
                      subscription: sub,
                      onPauseResume: () {},
                      onModify: () {},
                      onSkip: () {},
                      onDelete: () {},
                    ),
                  ),
                );
              },
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12),
                side: const BorderSide(color: kPrimary, width: 1.5),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'VIEW SUBSCRIPTION DETAILS',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  color: kPrimary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isStatus = false, String status = ''}) {
    Color valColor = kText;
    if (isStatus) {
      final s = status.toLowerCase();
      if (s == 'delivered' || s == 'active') {
        valColor = const Color(0xFF2E7D32);
      } else if (s == 'cancelled' || s == 'paused') {
        valColor = kRed;
      } else {
        valColor = const Color(0xFFEF6C00);
      }
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: kTextSub,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 16),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontSize: 12,
                color: valColor,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow({
    required String label,
    required String value,
    Color valueColor = kText,
    bool isBold = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: kTextSub,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 16),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontSize: 13,
                color: valueColor,
                fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
