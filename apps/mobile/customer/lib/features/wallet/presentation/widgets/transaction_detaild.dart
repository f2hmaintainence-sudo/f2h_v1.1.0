import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/theme/app_typography.dart';
import 'package:f2h_customer/features/wallet/data/models/transaction_model.dart';
import 'package:f2h_customer/core/widgets/cow_loading_widget.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_bloc.dart';
import 'package:f2h_customer/features/orders/presentation/screens/order_details_screen.dart';
import 'package:f2h_customer/features/subscription/domain/repositories/subscription_repository.dart';
import 'package:f2h_customer/features/subscription/data/models/subscription_model.dart';
import 'package:f2h_customer/features/subscription/presentation/screens/subscription_detail_screen.dart';

// ══════════════════════════════════════════════════════════
//  TRANSACTION RECEIPT SCREEN  —  Premium Redesign
// ══════════════════════════════════════════════════════════

class TransactionDetaildScreen extends StatefulWidget {
  final CustomerWalletTransaction transaction;

  const TransactionDetaildScreen({required this.transaction, super.key});

  @override
  State<TransactionDetaildScreen> createState() =>
      _TransactionDetaildScreenState();
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
    final refType =
        widget.transaction.referenceType?.toLowerCase().trim() ?? '';
    final refId = widget.transaction.referenceId?.trim() ?? '';
    final remarks = widget.transaction.remarks?.trim() ?? '';

    String? orderId;
    if (refId.startsWith('Ord')) {
      orderId = refId;
    } else {
      final match =
          RegExp(r'\b(Ord[A-Z0-9]+)\b', caseSensitive: true).firstMatch(remarks);
      if (match != null) {
        orderId = match.group(1);
      } else if (refId.isNotEmpty) {
        orderId = refId;
      }
    }

    if (refType == 'order' ||
        refType == 'refund' ||
        refType == 'checkout' ||
        refType == 'order_payment') {
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
      final response =
          await sl<DioClient>().dio.get('${ApiEndpoints.orders}/$orderId');
      final raw = response.data;
      if (raw is Map && raw['order'] != null) {
        final orderMap = Map<String, dynamic>.from(raw['order'] as Map);
        if (raw['items'] != null) orderMap['items'] = raw['items'];
        if (raw['feedback'] != null) {
          orderMap['rating'] = raw['feedback']['rating'];
          orderMap['rating_feedback'] = raw['feedback']['feedback'];
        }
        final order = Order.fromJson(orderMap);
        if (mounted) setState(() { _loadedOrder = order; _isLoadingOrder = false; });
      } else {
        if (mounted) setState(() { _orderError = 'Order not found'; _isLoadingOrder = false; });
      }
    } catch (_) {
      if (mounted) setState(() { _orderError = 'Could not load order details'; _isLoadingOrder = false; });
    }
  }

  Future<void> _fetchSubscriptionDetails(String subscriptionId) async {
    setState(() { _isLoadingSubscription = true; _subscriptionError = null; });
    try {
      final repository = sl<SubscriptionRepository>();
      final subscriptions = await repository.getSubscriptions();
      final matching = subscriptions.firstWhere(
        (sub) => sub.id == subscriptionId || sub.subscriptionNumber == subscriptionId,
      );
      if (mounted) setState(() { _loadedSubscription = matching; _isLoadingSubscription = false; });
    } catch (_) {
      if (mounted) setState(() { _subscriptionError = 'Could not load subscription details'; _isLoadingSubscription = false; });
    }
  }

  bool _isCredit(String type) {
    final n = type.toLowerCase().trim();
    return n == 'credit' || n == 'refund' || n == 'cashback';
  }

  String _formatDateTime(DateTime? dt) {
    if (dt == null) return 'N/A';
    final l = dt.toLocal();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
    final ampm = l.hour >= 12 ? 'PM' : 'AM';
    return '${l.day.toString().padLeft(2,'0')} ${months[l.month-1]} ${l.year}, '
        '${h.toString().padLeft(2,'0')}:${l.minute.toString().padLeft(2,'0')} $ampm';
  }

  @override
  Widget build(BuildContext context) {
    final isCredit = _isCredit(widget.transaction.transactionType);
    final accentColor  = isCredit ? const Color(0xFF16A34A) : const Color(0xFFDC2626);
    final heroGradient = isCredit
        ? const [Color(0xFF064E3B), Color(0xFF15803D), Color(0xFF16A34A)]
        : const [Color(0xFF7F1D1D), Color(0xFFB91C1C), Color(0xFFDC2626)];

    final refType = widget.transaction.referenceType?.toLowerCase().trim() ?? '';
    final typeLabel = widget.transaction.transactionType.toUpperCase();

    final txnId = (widget.transaction.transactionId != null &&
            widget.transaction.transactionId!.trim().isNotEmpty)
        ? widget.transaction.transactionId!
        : '#TXN${widget.transaction.id}';

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFFF3F4F6),
        body: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            // ── Gradient Hero AppBar ──────────────────────────────
            SliverAppBar(
              expandedHeight: 260,
              pinned: true,
              backgroundColor: heroGradient[0],
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                onPressed: () => Navigator.pop(context),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.copy_rounded, color: Colors.white, size: 20),
                  tooltip: 'Copy TXN ID',
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: txnId));
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: const Text('Transaction ID copied'),
                        duration: const Duration(seconds: 2),
                        backgroundColor: accentColor,
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    );
                  },
                ),
              ],
              title: Text(
                'Transaction Receipt',
                style: AppTypography.titleMedium.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
              centerTitle: true,
              flexibleSpace: FlexibleSpaceBar(
                collapseMode: CollapseMode.parallax,
                background: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: heroGradient,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: SafeArea(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 32),
                        // Icon circle
                        Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.4),
                              width: 1.5,
                            ),
                          ),
                          child: Icon(
                            isCredit ? Icons.south_rounded : Icons.north_rounded,
                            color: Colors.white,
                            size: 32,
                          ),
                        ),
                        const SizedBox(height: 14),
                        // Amount
                        Text(
                          '${isCredit ? '+' : '-'}₹${widget.transaction.amount.toStringAsFixed(2)}',
                          style: AppTypography.displayLarge.copyWith(
                            fontSize: 38,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: -1.0,
                            height: 1.0,
                          ),
                        ),
                        const SizedBox(height: 10),
                        // Type badge + success indicator
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(20),
                              child: BackdropFilter(
                                filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.2),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: Colors.white.withValues(alpha: 0.3),
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(
                                        Icons.check_circle_rounded,
                                        color: Colors.white,
                                        size: 13,
                                      ),
                                      const SizedBox(width: 5),
                                      Text(
                                        '$typeLabel  ·  Successful',
                                        style: AppTypography.labelSmall.copyWith(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 11.5,
                                          letterSpacing: 0.2,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                child: Column(
                  children: [
                    // ── RECEIPT CARD ─────────────────────────────
                    _ReceiptCard(
                      transaction: widget.transaction,
                      txnId: txnId,
                      isCredit: isCredit,
                      accentColor: accentColor,
                      formatDateTime: _formatDateTime,
                    ),

                    const SizedBox(height: 16),

                    // ── ORDER / SUBSCRIPTION SECTION ─────────────
                    if (refType == 'order' ||
                        refType == 'refund' ||
                        refType == 'checkout' ||
                        refType == 'order_payment')
                      _buildOrderSection(),
                    if (refType == 'subscription')
                      _buildSubscriptionSection(),

                    const SizedBox(height: 16),

                    // ── BACK TO WALLET BUTTON ─────────────────────
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 17),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [heroGradient[0], heroGradient[2]],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(18),
                          boxShadow: [
                            BoxShadow(
                              color: accentColor.withValues(alpha: 0.3),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.account_balance_wallet_rounded,
                              color: Colors.white,
                              size: 18,
                            ),
                            const SizedBox(width: 10),
                            Text(
                              'BACK TO WALLET',
                              style: AppTypography.labelLarge.copyWith(
                                fontWeight: FontWeight.w800,
                                fontSize: 14,
                                letterSpacing: 0.5,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── ORDER SECTION ─────────────────────────────────────────
  Widget _buildOrderSection() {
    if (_isLoadingOrder) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(32),
        margin: const EdgeInsets.only(bottom: 16),
        decoration: _cardDecoration(),
        child: const Center(child: CowLoadingWidget(size: 90)),
      );
    }

    if (_orderError != null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        margin: const EdgeInsets.only(bottom: 16),
        decoration: _cardDecoration(),
        child: Center(
          child: Text(
            _orderError!,
            style: AppTypography.bodySmall
                .copyWith(color: kTextSub, fontWeight: FontWeight.w600),
          ),
        ),
      );
    }

    if (_loadedOrder == null) return const SizedBox.shrink();
    final order = _loadedOrder!;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Card header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    color: kPrimaryPl,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.receipt_long_rounded,
                    color: kPrimary,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  'Order Details',
                  style: AppTypography.titleMedium.copyWith(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: kText,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),
          const Divider(height: 1, thickness: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 14),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              children: [
                _SummaryRow(label: 'Order ID', value: order.id),
                _SummaryRow(
                    label: 'Status',
                    value: order.status.toUpperCase(),
                    isStatus: true,
                    status: order.status),
                _SummaryRow(
                    label: 'Total Amount',
                    value: '₹${order.amount.toStringAsFixed(2)}'),
              ],
            ),
          ),

          // Ordered items
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Row(
              children: [
                Text(
                  'ORDERED ITEMS',
                  style: AppTypography.labelSmall.copyWith(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: kTextSub,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: kPrimaryPl,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${order.items.length}',
                    style: AppTypography.labelSmall.copyWith(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: kPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          ...order.items.asMap().entries.map((entry) {
            final idx = entry.key;
            final item = entry.value;
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 20, vertical: 10),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: kPrimaryPl,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: const Color(0xFFBBF7D0), width: 1),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(11),
                          child: Padding(
                            padding: const EdgeInsets.all(4),
                            child: buildProductImage(
                              item.productName,
                              imageAsset: item.imagePath,
                              width: 48,
                              height: 48,
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
                              style: AppTypography.labelLarge.copyWith(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: kText,
                              ),
                            ),
                            if (item.variantName.isNotEmpty &&
                                item.variantName.toLowerCase() != 'standard') ...[
                              const SizedBox(height: 2),
                              Text(
                                item.variantName,
                                style: AppTypography.labelSmall.copyWith(
                                  fontSize: 10.5,
                                  color: kTextSub,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '₹${item.finalPrice.toStringAsFixed(2)}',
                            style: AppTypography.labelLarge.copyWith(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: kText,
                            ),
                          ),
                          Text(
                            '₹${item.unitPrice.toStringAsFixed(0)} × ${item.quantity}',
                            style: AppTypography.labelSmall.copyWith(
                              fontSize: 10,
                              color: kTextSub,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (idx < order.items.length - 1)
                  const Divider(
                      height: 1, thickness: 1, color: Color(0xFFF1F5F9),
                      indent: 20, endIndent: 20),
              ],
            );
          }),

          const SizedBox(height: 4),
          const Divider(height: 1, thickness: 1, color: Color(0xFFF1F5F9)),

          // View order button
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 18),
            child: GestureDetector(
              onTap: () {
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
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 13),
                decoration: BoxDecoration(
                  color: kPrimaryPl,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: const Color(0xFFBBF7D0),
                    width: 1.5,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.open_in_new_rounded,
                        color: kPrimary, size: 16),
                    const SizedBox(width: 8),
                    Text(
                      'VIEW ORDER DETAILS',
                      style: AppTypography.labelLarge.copyWith(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                        color: kPrimary,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── SUBSCRIPTION SECTION ──────────────────────────────────
  Widget _buildSubscriptionSection() {
    if (_isLoadingSubscription) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(32),
        margin: const EdgeInsets.only(bottom: 16),
        decoration: _cardDecoration(),
        child: const Center(child: CowLoadingWidget(size: 90)),
      );
    }
    if (_subscriptionError != null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        margin: const EdgeInsets.only(bottom: 16),
        decoration: _cardDecoration(),
        child: Center(
          child: Text(_subscriptionError!,
              style: AppTypography.bodySmall
                  .copyWith(color: kTextSub, fontWeight: FontWeight.w600)),
        ),
      );
    }
    if (_loadedSubscription == null) return const SizedBox.shrink();
    final sub = _loadedSubscription!;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      decoration: _cardDecoration(),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                      color: kPrimaryPl, shape: BoxShape.circle),
                  child: const Icon(Icons.autorenew_rounded,
                      color: kPrimary, size: 18),
                ),
                const SizedBox(width: 12),
                Text(
                  'Subscription Details',
                  style: AppTypography.titleMedium.copyWith(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: kText,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(height: 1, thickness: 1, color: Color(0xFFF1F5F9)),
            const SizedBox(height: 14),
            _SummaryRow(label: 'Subscription ID', value: sub.displayLabel),
            _SummaryRow(label: 'Product', value: sub.productName),
            _SummaryRow(label: 'Frequency', value: sub.frequency),
            _SummaryRow(label: 'Status', value: sub.status.toUpperCase(),
                isStatus: true, status: sub.status),
            _SummaryRow(label: 'Cost / Day',
                value: '₹${sub.pricePerDay.toStringAsFixed(0)}'),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () {
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
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 13),
                decoration: BoxDecoration(
                  color: kPrimaryPl,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                      color: const Color(0xFFBBF7D0), width: 1.5),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.open_in_new_rounded,
                        color: kPrimary, size: 16),
                    const SizedBox(width: 8),
                    Text(
                      'VIEW SUBSCRIPTION DETAILS',
                      style: AppTypography.labelLarge.copyWith(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                        color: kPrimary,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  BoxDecoration _cardDecoration() => BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      );
}

// ═══════════════════════════════════════════════════════════════
//  RECEIPT CARD — Notched / Ticket design
// ═══════════════════════════════════════════════════════════════
class _ReceiptCard extends StatelessWidget {
  final CustomerWalletTransaction transaction;
  final String txnId;
  final bool isCredit;
  final Color accentColor;
  final String Function(DateTime?) formatDateTime;

  const _ReceiptCard({
    required this.transaction,
    required this.txnId,
    required this.isCredit,
    required this.accentColor,
    required this.formatDateTime,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // ── Details ─────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 22, 22, 0),
            child: Column(
              children: [
                _DetailRow(
                  label: 'Transaction Type',
                  child: _TypePill(
                    label: transaction.transactionType.toUpperCase(),
                    isCredit: isCredit,
                  ),
                ),
                _DetailRow(
                  label: 'Date & Time',
                  value: formatDateTime(transaction.createdAt),
                ),
                _DetailRow(
                  label: 'Transaction ID',
                  value: txnId,
                  valueMono: true,
                ),
                if (transaction.referenceType != null &&
                    transaction.referenceType!.isNotEmpty)
                  _DetailRow(
                    label: 'Reference Type',
                    value: transaction.referenceType!.toUpperCase(),
                  ),
                if (transaction.referenceId != null &&
                    transaction.referenceId!.isNotEmpty)
                  _DetailRow(
                    label: 'Reference ID',
                    value: transaction.referenceId!,
                    valueColor: accentColor,
                    isBold: true,
                    valueMono: true,
                  ),
              ],
            ),
          ),

          // ── Notch Divider ────────────────────────────────────
          const SizedBox(height: 16),
          _NotchDivider(),
          const SizedBox(height: 16),

          // ── Balance after ────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 18, vertical: 14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: isCredit ? kPrimaryPl : kRedLt,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.account_balance_wallet_rounded,
                      size: 17,
                      color: accentColor,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Post-Transaction Balance',
                        style: AppTypography.labelSmall.copyWith(
                          fontSize: 10.5,
                          color: kTextSub,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.1,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '₹${transaction.balanceAfter.toStringAsFixed(2)}',
                        style: AppTypography.titleMedium.copyWith(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: kText,
                          letterSpacing: -0.4,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // ── Remarks ──────────────────────────────────────────
          if (transaction.remarks != null &&
              transaction.remarks!.trim().isNotEmpty) ...[
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 0, 22, 0),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'REMARKS',
                      style: AppTypography.labelSmall.copyWith(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: kTextSub,
                        letterSpacing: 1.0,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      transaction.remarks!,
                      style: AppTypography.bodyMedium.copyWith(
                        fontSize: 13,
                        height: 1.45,
                        color: kText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],

          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

// ── Detail Row ──────────────────────────────────────────────────
class _DetailRow extends StatelessWidget {
  final String label;
  final String? value;
  final Widget? child;
  final Color valueColor;
  final bool isBold;
  final bool valueMono;

  const _DetailRow({
    required this.label,
    this.value,
    this.child,
    this.valueColor = kText,
    this.isBold = false,
    this.valueMono = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          Expanded(
            flex: 4,
            child: Text(
              label,
              style: AppTypography.bodySmall.copyWith(
                fontSize: 12.5,
                color: kTextSub,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 5,
            child: child ??
                Text(
                  value ?? '',
                  textAlign: TextAlign.end,
                  style: AppTypography.labelLarge.copyWith(
                    fontSize: 12.5,
                    color: valueColor,
                    fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
                    fontFamily: valueMono ? 'monospace' : null,
                    letterSpacing: valueMono ? 0.3 : 0,
                  ),
                ),
          ),
        ],
      ),
    );
  }
}

// ── Type Pill ──────────────────────────────────────────────────
class _TypePill extends StatelessWidget {
  final String label;
  final bool isCredit;

  const _TypePill({required this.label, required this.isCredit});

  @override
  Widget build(BuildContext context) {
    final bg = isCredit ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2);
    final fg = isCredit ? const Color(0xFF16A34A) : const Color(0xFFDC2626);

    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: AppTypography.labelSmall.copyWith(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: fg,
            letterSpacing: 0.3,
          ),
        ),
      ),
    );
  }
}

// ── Notch Divider (receipt tear line) ────────────────────────────
class _NotchDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: const BoxDecoration(
            color: Color(0xFFF3F4F6),
            shape: BoxShape.circle,
          ),
        ),
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              const dashWidth = 6.0;
              const dashSpace = 5.0;
              final count = (constraints.maxWidth / (dashWidth + dashSpace)).floor();
              return Row(
                children: List.generate(count, (_) => Padding(
                  padding: const EdgeInsets.only(right: dashSpace),
                  child: Container(
                    width: dashWidth,
                    height: 1.5,
                    color: const Color(0xFFE2E8F0),
                  ),
                )),
              );
            },
          ),
        ),
        Container(
          width: 20,
          height: 20,
          decoration: const BoxDecoration(
            color: Color(0xFFF3F4F6),
            shape: BoxShape.circle,
          ),
        ),
      ],
    );
  }
}

// ── Summary Row ────────────────────────────────────────────────
class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isStatus;
  final String status;

  const _SummaryRow({
    required this.label,
    required this.value,
    this.isStatus = false,
    this.status = '',
  });

  @override
  Widget build(BuildContext context) {
    Color valColor = kText;
    if (isStatus) {
      final s = status.toLowerCase();
      if (s == 'delivered' || s == 'active') {
        valColor = const Color(0xFF16A34A);
      } else if (s == 'cancelled' || s == 'paused') {
        valColor = kRed;
      } else {
        valColor = const Color(0xFFEA580C);
      }
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 11),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppTypography.bodySmall.copyWith(
              fontSize: 12,
              color: kTextSub,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(width: 16),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: AppTypography.labelLarge.copyWith(
                fontSize: 12.5,
                color: valColor,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
