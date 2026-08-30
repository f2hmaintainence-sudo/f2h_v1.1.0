import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/session/customer_session_state.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_event.dart';
import 'package:f2h_customer/features/catalog/presentation/screens/cart_screen.dart';
import 'package:f2h_customer/features/subscription/data/models/subscription_model.dart';
import 'package:f2h_customer/features/address/data/models/profile_address.dart';
import 'package:f2h_customer/core/widgets/custom_date_picker.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_bloc.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_event.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_state.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';
import 'package:f2h_customer/features/subscription/presentation/screens/subscription_calendar_screen.dart';
import 'package:f2h_customer/features/wallet/presentation/screens/wallet_screen.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/features/subscription/domain/repositories/subscription_repository.dart';
import 'package:f2h_customer/features/profile/presentation/screens/customer_bills_screen.dart';

class SubscriptionDetailScreen extends StatefulWidget {
  final Subscription subscription;
  final VoidCallback onPauseResume;
  final VoidCallback onModify;
  final VoidCallback onSkip;
  final VoidCallback onDelete;

  const SubscriptionDetailScreen({
    required this.subscription,
    required this.onPauseResume,
    required this.onModify,
    required this.onSkip,
    required this.onDelete,
    super.key,
  });

  @override
  State<SubscriptionDetailScreen> createState() =>
      _SubscriptionDetailScreenState();
}

class _SubscriptionDetailScreenState extends State<SubscriptionDetailScreen> {
  List<SubscriptionPauseModel> _pauseHistory = [];
  bool _loadingPauseHistory = false;

  // Subscription orders
  List<Order> _subscriptionOrders = [];

  // Detail info (wallet balance, bills, alerts)
  SubscriptionDetailInfo? _detailInfo;
  bool _loadingDetail = true;

  // Bills list
  List<SubscriptionBillModel> _bills = [];
  bool _loadingBills = true;

  /// Collapsed/expanded state of the Subscription Details panel.
  bool _subscriptionDetailsExpanded = false;

  String _getMonthName(int month) {
    const names = [
      '',
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
      'Dec',
    ];
    return month >= 1 && month <= 12 ? names[month] : '';
  }

  @override
  void initState() {
    super.initState();
    _loadPauseHistory();
    _loadSubscriptionOrders();
    _loadDetailInfo();
    _loadBills();
  }

  Future<void> _loadDetailInfo() async {
    try {
      final info = await sl<SubscriptionRepository>().getSubscriptionDetail(
        widget.subscription.id,
      );
      if (mounted)
        setState(() {
          _detailInfo = info;
          _loadingDetail = false;
        });
    } catch (_) {
      if (mounted) setState(() => _loadingDetail = false);
    }
  }

  Future<void> _loadBills() async {
    try {
      final bills = await sl<SubscriptionRepository>().getSubscriptionBills(
        widget.subscription.id,
      );
      if (mounted)
        setState(() {
          _bills = bills;
          _loadingBills = false;
        });
    } catch (_) {
      if (mounted) setState(() => _loadingBills = false);
    }
  }

  void _loadPauseHistory() {
    setState(() => _loadingPauseHistory = true);
    context.read<SubscriptionBloc>().add(
      LoadPauseHistoryRequested(subscriptionId: widget.subscription.id),
    );
  }

  void _loadSubscriptionOrders() {
    final state = context.read<SubscriptionBloc>().state;
    if (state is SubscriptionLoaded) {
      setState(() {
        _subscriptionOrders = state.orders
            .where((o) => o.subscriptionId == widget.subscription.id)
            .toList();
      });
    }
  }

  void _handlePause() async {
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    final picked = await showCustomDateRangePicker(
      context: context,
      firstDate: tomorrow,
      lastDate: DateTime.now().add(const Duration(days: 60)),
      title: 'Select Pause Dates',
    );
    if (picked != null && mounted) {
      final startDate =
          '${picked.start.year}-${picked.start.month.toString().padLeft(2, '0')}-${picked.start.day.toString().padLeft(2, '0')}';
      final endDate =
          '${picked.end.year}-${picked.end.month.toString().padLeft(2, '0')}-${picked.end.day.toString().padLeft(2, '0')}';
      context.read<SubscriptionBloc>().add(
        PauseSubscriptionRequested(
          subscriptionId: widget.subscription.id,
          startDate: startDate,
          endDate: endDate,
        ),
      );
      widget.onPauseResume();
      if (mounted) Navigator.pop(context);
    }
  }

  void _showResumeDialog() {
    final s = widget.subscription;
    final pauseFromDate = s.pauseFromDate;
    final pauseToDate = s.pauseToDate;

    if (pauseFromDate == null || pauseToDate == null) return;

    final today = DateTime.now();
    final todayStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    if (todayStr.compareTo(pauseFromDate) < 0) {
      // ── SCENARIO 1: Pause hasn't started yet — simple confirm ──
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: const Text(
            'Cancel Upcoming Pause?',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w900,
              color: kText,
            ),
          ),
          content: Text(
            'Your pause is scheduled to start on $pauseFromDate. '
            'Cancelling it will restore normal deliveries immediately.',
            style: const TextStyle(
              fontSize: 13,
              color: kTextSub,
              fontWeight: FontWeight.w500,
              height: 1.5,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text(
                'Keep Pause',
                style: TextStyle(color: kTextSub, fontWeight: FontWeight.w700),
              ),
            ),
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                context.read<SubscriptionBloc>().add(
                  ResumeSubscriptionRequested(subscriptionId: s.id),
                );
                widget.onPauseResume();
                if (mounted) Navigator.pop(context);
              },
              child: const Text(
                'Resume Now',
                style: TextStyle(
                  color: Color(0xFF15803D),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      );
    } else {
      // ── SCENARIO 2 / 3: Pause is active — date picker ──
      final tomorrow = today.add(const Duration(days: 1));
      final pauseEndDay =
          DateTime.tryParse(pauseToDate) ?? today.add(const Duration(days: 30));

      showDialog(
        context: context,
        barrierDismissible: true,
        builder: (ctx) {
          DateTime? selectedDate;
          return StatefulBuilder(
            builder: (ctx, setS) {
              return AlertDialog(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
                title: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.play_circle_outline_rounded,
                        size: 20,
                        color: Color(0xFF15803D),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Resume Subscription',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: kText,
                      ),
                    ),
                  ],
                ),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Resume Date',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: kTextSub,
                      ),
                    ),
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          initialDate: tomorrow,
                          firstDate: tomorrow,
                          lastDate: pauseEndDay,
                          helpText: 'Select resume date',
                        );
                        if (picked != null) {
                          setS(() => selectedDate = picked);
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF9FAFB),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: selectedDate != null
                                ? const Color(0xFF15803D)
                                : kBorderLt,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.calendar_today_rounded,
                              size: 16,
                              color: selectedDate != null
                                  ? const Color(0xFF15803D)
                                  : kMuted,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              selectedDate != null
                                  ? '${selectedDate!.day} ${_getMonthName(selectedDate!.month)} ${selectedDate!.year}'
                                  : 'Tap to select date',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: selectedDate != null ? kText : kMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Deliveries will resume from the selected date.\n'
                      'Allowed: Tomorrow → ${_formatDate(pauseToDate)}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: kMuted,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
                actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                actions: [
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(ctx),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            side: const BorderSide(color: kBorderLt),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Cancel',
                            style: TextStyle(
                              color: kTextSub,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: selectedDate == null
                              ? null
                              : () {
                                  final resumeStr =
                                      '${selectedDate!.year}-${selectedDate!.month.toString().padLeft(2, '0')}-${selectedDate!.day.toString().padLeft(2, '0')}';
                                  Navigator.pop(ctx);
                                  context.read<SubscriptionBloc>().add(
                                    ResumeSubscriptionRequested(
                                      subscriptionId: s.id,
                                      resumeDate: resumeStr,
                                    ),
                                  );
                                  widget.onPauseResume();
                                  if (mounted) Navigator.pop(context);
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF15803D),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            disabledBackgroundColor: kBorderLt,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Resume',
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              );
            },
          );
        },
      );
    }
  }

  void _handleRenew() {
    final sub = widget.subscription;
    final firstItem = sub.items.isNotEmpty ? sub.items.first : null;
    final variantId = firstItem?.productVariantId ?? sub.id;
    final productName = firstItem?.productName ?? sub.productName;
    final variantName = (firstItem?.variantName.isNotEmpty ?? false)
        ? firstItem!.variantName
        : 'Standard';
    final price = (firstItem != null && firstItem.finalPrice > 0)
        ? firstItem.finalPrice
        : (firstItem?.unitPrice ?? sub.pricePerDay);

    final cartItem = CartItemEntity(
      productId: variantId,
      variantId: variantId,
      productName: productName,
      variantName: variantName,
      unitPrice: price,
      purchaseType: 'subscription',
      schedules: [
        SubscriptionSchedule(
          day: 0,
          mQuantity: sub.qty > 0 ? sub.qty : 1,
          eQuantity: 0,
        ),
      ],
      isSubscribable: true,
      isOneTime: true,
      subscriptionPrice: price,
    );

    context.read<CartBloc>().add(AddToCartEvent(cartItem));
    F2HToast.success(context, 'Subscription added to cart for renewal!');

    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const CartScreen()),
    );
  }

  void _handleCancel() {
    final reasonController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Cancel Subscription',
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w900,
            color: kText,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Are you sure you want to cancel this subscription? This action cannot be undone.',
              style: TextStyle(
                fontSize: 13,
                color: kTextSub,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: reasonController,
              decoration: InputDecoration(
                labelText: 'Reason for cancellation',
                labelStyle: const TextStyle(fontSize: 13, color: kTextSub),
                hintText: 'e.g. No longer needed',
                hintStyle: const TextStyle(fontSize: 12, color: kMuted),
                filled: true,
                fillColor: const Color(0xFFF9FAFB),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: kBorderLt),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: kBorderLt),
                ),
              ),
              maxLines: 2,
              style: const TextStyle(fontSize: 13, color: kText),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Keep Subscription',
              style: TextStyle(color: kTextSub, fontWeight: FontWeight.w700),
            ),
          ),
          TextButton(
            onPressed: () {
              final reason = reasonController.text.trim();
              Navigator.pop(ctx);
              final today = DateTime.now();
              final endDate =
                  '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
              context.read<SubscriptionBloc>().add(
                CancelSubscriptionRequested(
                  subscriptionId: widget.subscription.id,
                  cancelReason: reason.isNotEmpty
                      ? reason
                      : 'Cancelled by customer',
                  endDate: endDate,
                ),
              );
              widget.onDelete();
              if (mounted) Navigator.pop(context);
            },
            child: const Text(
              'Cancel Subscription',
              style: TextStyle(color: kRed, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }

  void _showPauseHistorySheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PauseHistorySheet(
        pauses: _pauseHistory,
        isLoading: _loadingPauseHistory,
        formatDate: _formatDate,
        onResume: _showResumeDialog,
      ),
    );
  }

  void _showOrdersHistorySheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _OrdersHistorySheet(orders: _subscriptionOrders),
    );
  }

  void _showBillsSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _BillsSheet(
        bills: _bills,
        isLoading: _loadingBills,
        formatDate: _formatDate,
      ),
    );
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null || dateStr.isEmpty) return '—';
    try {
      final d = DateTime.parse(dateStr);
      return '${d.day} ${_getMonthName(d.month)} ${d.year}';
    } catch (_) {
      return dateStr;
    }
  }

  // ─── Delivery address (own card) ────────────────────────────

  Widget _buildDeliveryAddressCard(AddressModel address, String addressString) {
    final contactName = address.contactName.isNotEmpty
        ? address.contactName
        : (address.customerId.isNotEmpty ? address.customerId : 'Recipient');
    final contactMobile = address.contactMobile;
    final addressType = address.addressType.isNotEmpty
        ? address.addressType.toUpperCase()
        : 'HOME';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderLt, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: kPrimaryPl,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.location_on_rounded,
                  size: 16,
                  color: kPrimary,
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'DELIVERY ADDRESS',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  color: kTextSub,
                  letterSpacing: 0.6,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: kPrimary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  addressType,
                  style: const TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    color: kPrimary,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (contactName.isNotEmpty || contactMobile.isNotEmpty) ...[
            Row(
              children: [
                Text(
                  contactName,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w900,
                    color: kText,
                  ),
                ),
                if (contactMobile.isNotEmpty) ...[
                  const Text(' · ', style: TextStyle(color: kTextSub, fontWeight: FontWeight.bold)),
                  Text(
                    contactMobile,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: kTextSub,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 4),
          ],
          Text(
            addressString,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: kTextSub,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  // ─── Postpaid Summary Card ───────────────────────────────────

  Widget _buildPostpaidSummaryCard(CustomerSessionState sessionState) {
    final profile = sessionState.profile;
    final creditLimit = profile?.postpaidCreditLimit ?? 0.0;

    final outstandingFromInfo = _detailInfo?.outstandingAmount ?? 0.0;
    final isPostpaidSub = widget.subscription.paymentType.toLowerCase() == 'postpaid';

    final thisSubCost = (widget.subscription.totalMonthlyCost > 0
        ? widget.subscription.totalMonthlyCost
        : (widget.subscription.monthlyEstimate ?? (widget.subscription.pricePerDay * 30)));

    double usedCredit = outstandingFromInfo;

    if (usedCredit <= 0 && isPostpaidSub) {
      usedCredit = thisSubCost;
    }

    final remainingLimit = (creditLimit - usedCredit).clamp(0.0, double.infinity);
    final usagePercent = creditLimit > 0 ? (usedCredit / creditLimit).clamp(0.0, 1.0) : 0.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBBF7D0), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: kPrimary.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.verified_user_rounded,
                  size: 16,
                  color: Color(0xFF15803D),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Postpaid Credit Facility',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF14532D),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'ACTIVE',
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF15803D),
                    letterSpacing: 0.4,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // 3 Metric columns
          Row(
            children: [
              Expanded(
                child: _buildPostpaidStatPill(
                  label: 'Credit Limit',
                  value: '₹${creditLimit.toStringAsFixed(0)}',
                  color: const Color(0xFF1E293B),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildPostpaidStatPill(
                  label: 'Usage / Due',
                  value: '₹${usedCredit.toStringAsFixed(0)}',
                  color: usedCredit > 0 ? const Color(0xFFD97706) : const Color(0xFF64748B),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildPostpaidStatPill(
                  label: 'Remaining',
                  value: '₹${remainingLimit.toStringAsFixed(0)}',
                  color: const Color(0xFF15803D),
                  isBold: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Progress Bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: usagePercent,
              backgroundColor: const Color(0xFFDCFCE7),
              color: usagePercent > 0.85 ? Colors.red : const Color(0xFF15803D),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${(usagePercent * 100).toStringAsFixed(0)}% utilized',
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF166534),
                ),
              ),
              Text(
                '₹${remainingLimit.toStringAsFixed(0)} available',
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF15803D),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPostpaidStatPill({
    required String label,
    required String value,
    required Color color,
    bool isBold = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFBBF7D0)),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Color(0xFF166534),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: isBold ? FontWeight.w900 : FontWeight.w800,
              color: color,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  // ─── Subscription details (collapsible) ─────────────────────

  Widget _buildSubscriptionDetailsSection(Subscription s) {
    final unitPrice = (s.items.isNotEmpty && (s.items.first.finalPrice > 0 ? s.items.first.finalPrice : s.items.first.unitPrice) > 0)
        ? (s.items.first.finalPrice > 0 ? s.items.first.finalPrice : s.items.first.unitPrice)
        : (s.pricePerDay > 0 ? s.pricePerDay : 0.0);
    final isCancelled = s.status == 'cancelled';
    final isPostpaid = s.paymentType == 'postpaid';
    final slot = s.slot.isNotEmpty ? s.slot : 'Morning';
    final frequency = s.frequency.isNotEmpty ? s.frequency : 'Daily';
    final hasEndDate = s.endDate != null && s.endDate!.isNotEmpty;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderLt, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _subscriptionDetailsExpanded = !_subscriptionDetailsExpanded);
            },
            behavior: HitTestBehavior.opaque,
            child: Row(
              children: [
                const Icon(
                  Icons.receipt_outlined,
                  size: 16,
                  color: kPrimary,
                ),
                const SizedBox(width: 8),
                const Text(
                  'Subscription Details',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: kText,
                  ),
                ),
                const Spacer(),
                if (!_subscriptionDetailsExpanded)
                  Flexible(
                    child: Text(
                      '#${s.id}',
                      textAlign: TextAlign.end,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: kPrimary,
                      ),
                    ),
                  ),
                const SizedBox(width: 6),
                AnimatedRotation(
                  turns: _subscriptionDetailsExpanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 20,
                    color: kTextSub,
                  ),
                ),
              ],
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 250),
            curve: Curves.fastOutSlowIn,
            alignment: Alignment.topCenter,
            child: _subscriptionDetailsExpanded
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 10),
                      _buildDetailRow('Subscription ID', '#${s.id}'),
                      _buildDetailRow(
                        'Product Price',
                        '₹${unitPrice.toStringAsFixed(2)} / unit',
                      ),
                      _buildDetailRow('Start Date', _formatDate(s.startDate)),
                      if (hasEndDate)
                        _buildDetailRow('End Date', _formatDate(s.endDate)),
                      _buildDetailRow(
                        'Payment Method',
                        isPostpaid ? 'Postpaid' : 'Wallet',
                      ),
                      if (isCancelled)
                        _buildDetailRow('Status', 'Cancelled', valueColor: kRed),
                      if (!isPostpaid && _detailInfo != null && !_loadingDetail) ...[
                        _buildDetailRow(
                          'Wallet Balance',
                          '₹${_detailInfo!.walletBalance.toStringAsFixed(2)}',
                          valueColor: _detailInfo!.alertLowBalance ? kRed : kPrimary,
                        ),
                      ],
                      if (_detailInfo != null && !_loadingDetail && _detailInfo!.nextRenewalEstimate > 0)
                        _buildDetailRow(
                          'Est. Renewal',
                          '₹${_detailInfo!.nextRenewalEstimate.toStringAsFixed(0)} / month',
                        ),
                    ],
                  )
                : const SizedBox(width: double.infinity),
          ),
        ],
      ),
    );
  }

  // ─── Sub Card Days & Frequency Widget ───────────────────────

  Widget _buildSubCardDaysWidget(Subscription s) {
    final dayQtys = s.getSelectedDayQuantities();
    if (dayQtys.isEmpty) return const SizedBox.shrink();

    const morningColor = Color(0xFF14532D); // Dark green
    const eveningColor = Color(0xFF16A34A); // Light green

    final isSevenDays = dayQtys.length == 7;
    final first = dayQtys.first;
    final isAllSameSlots = isSevenDays &&
        dayQtys.every((dq) =>
            dq.morningQty == first.morningQty &&
            dq.eveningQty == first.eveningQty &&
            dq.quantity == first.quantity);

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.calendar_today_rounded,
                size: 11.5,
                color: kPrimary,
              ),
              const SizedBox(width: 5),
              const Text(
                'Schedule & Quantity:',
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  color: kTextSub,
                ),
              ),
              const Spacer(),
              Text(
                s.frequency.isNotEmpty ? s.frequency : 'Daily',
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  color: kPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          if (isAllSameSlots)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Daily  ',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      color: kText,
                    ),
                  ),
                  if (first.morningQty > 0) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'Morning: ${first.morningQty}',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: morningColor,
                        ),
                      ),
                    ),
                    const SizedBox(width: 5),
                  ],
                  if (first.eveningQty > 0) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: eveningColor.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        'Evening: ${first.eveningQty}',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: eveningColor,
                        ),
                      ),
                    ),
                  ],
                  if (first.morningQty == 0 && first.eveningQty == 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'Qty: ${first.quantity}',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          color: morningColor,
                        ),
                      ),
                    ),
                ],
              ),
            )
          else
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: dayQtys.map((dq) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${dq.dayName} ',
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                          color: kTextSub,
                        ),
                      ),
                      if (dq.morningQty > 0) ...[
                        Text(
                          'M:${dq.morningQty} ',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: morningColor,
                          ),
                        ),
                      ],
                      if (dq.eveningQty > 0) ...[
                        Text(
                          'E:${dq.eveningQty}',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: eveningColor,
                          ),
                        ),
                      ],
                      if (dq.morningQty == 0 && dq.eveningQty == 0)
                        Text(
                          '${dq.quantity}',
                          style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w900,
                            color: kPrimary,
                          ),
                        ),
                    ],
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }

  // ─── Alert banners ──────────────────────────────────────────

  Widget _buildAlertBanners() {
    final info = _detailInfo;
    if (_loadingDetail || info == null) return const SizedBox.shrink();
    if (!info.alertOutstandingBills) return const SizedBox.shrink();

    return Column(
      children: [
        if (info.alertOutstandingBills) ...[
          _AlertBanner(
            icon: Icons.receipt_long_outlined,
            message:
                '${info.outstandingBillCount} outstanding bill${info.outstandingBillCount > 1 ? 's' : ''} found (₹${info.outstandingAmount.toStringAsFixed(0)}). Please pay to avoid interruption.',
            color: kRed,
            bgColor: kRed.withValues(alpha: 0.05),
            borderColor: kRed.withValues(alpha: 0.2),
            onTap: _showBillsSheet,
            actionLabel: 'View Bills',
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }

  // ─── Bills section ──────────────────────────────────────────

  Widget _buildBillsSection() {
    if (_loadingBills) {
      return Container(
        margin: const EdgeInsets.only(top: 4),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: kBorderLt),
        ),
        child: const Center(
          child: Padding(
            padding: EdgeInsets.all(8.0),
            child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary),
          ),
        ),
      );
    }

    if (_bills.isEmpty) {
      return Container(
        margin: const EdgeInsets.only(top: 4),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: kBorderLt),
        ),
        child: Row(
          children: [
            Icon(
              Icons.receipt_long_rounded,
              size: 28,
              color: kMuted.withValues(alpha: 0.5),
            ),
            const SizedBox(width: 14),
            const Text(
              'No bills found for this subscription.',
              style: TextStyle(
                fontSize: 13,
                color: kTextSub,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      );
    }

    // Show first 3 bills inline, with "View All" button
    final displayBills = _bills.take(3).toList();
    return Column(
      children: [
        ...displayBills.map(
          (bill) => _BillCard(bill: bill, formatDate: _formatDate),
        ),
        if (_bills.length > 3) ...[
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _showBillsSheet,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 11),
              decoration: BoxDecoration(
                color: kPrimaryPl,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: kPrimary.withValues(alpha: 0.15)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'View all ${_bills.length} bills',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: kPrimary,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 16,
                    color: kPrimary,
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.subscription;
    final isActive = s.isActive;
    final isPaused = s.isPaused;
    final isCancelled = s.status == 'cancelled';
    final isExpired = s.status == 'expaired' || s.status == 'expired';
    final isCompleted = s.status == 'completed';
    final isTerminal = isCancelled || isExpired || isCompleted;
    final monthlyPrice = s.totalMonthlyCost;

    final Color statusColor = isActive
        ? kPrimary
        : isPaused
        ? kAccent
        : isExpired
        ? kRed
        : isCompleted
        ? Colors.grey
        : kRed;
    final Color statusBg = isActive
        ? kPrimaryPl
        : isPaused
        ? kAccentLt.withValues(alpha: 0.4)
        : isExpired
        ? kRed.withValues(alpha: 0.08)
        : isCompleted
        ? Colors.grey.withValues(alpha: 0.12)
        : kRed.withValues(alpha: 0.08);

    return BlocListener<SubscriptionBloc, SubscriptionState>(
      listener: (context, state) {
        if (state is PauseHistoryLoaded) {
          setState(() {
            _pauseHistory = state.pauses;
            _loadingPauseHistory = false;
          });
        }
        if (state is SubscriptionLoaded) {
          setState(() {
            _subscriptionOrders = state.orders
                .where((o) => o.subscriptionId == widget.subscription.id)
                .toList();
          });
        }
        if (state is SubscriptionActionSuccess) {
          F2HToast.success(context, state.message);
        }
        if (state is SubscriptionError) {
          F2HToast.error(context, state.message);
        }
      },
      child: Scaffold(
        backgroundColor: kBg,
        appBar: AppBar(
          backgroundColor: kSurface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          leading: Padding(
            padding: const EdgeInsets.all(8.0),
            child: Container(
              decoration: BoxDecoration(
                color: kSurface,
                shape: BoxShape.circle,
                border: Border.all(color: kBorderLt),
              ),
              child: IconButton(
                icon: const Icon(
                  Icons.arrow_back_ios_new_rounded,
                  size: 16,
                  color: kText,
                ),
                onPressed: () => Navigator.pop(context),
              ),
            ),
          ),
          title: const Text(
            'Subscription Details',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: kText,
            ),
          ),
          centerTitle: true,
        ),
        body: BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
          builder: (context, sessionState) {
            final profile = sessionState.profile;
            final list = sessionState.addresses;
            final defaultAddress = list.firstWhere(
              (a) => a.isDefault,
              orElse: () => list.isNotEmpty
                  ? list.first
                  : AddressModel(
                      customerId: '',
                      addressType: '',
                      contactName: '',
                      contactMobile: '',
                      flatNo: '',
                      floorNo: '',
                      buildingName: '',
                      landmark: '',
                      street: '',
                      area: '',
                      city: '',
                      state: '',
                      pincode: '',
                      latitude: 0.0,
                      longitude: 0.0,
                      deliveryNote: '',
                      isDefault: false,
                      zoneId: '',
                      routeId: '',
                      branchId: '',
                      status: '',
                    ),
            );

            final contactInfo = [
              if (defaultAddress.contactName.isNotEmpty)
                defaultAddress.contactName,
              if (defaultAddress.contactMobile.isNotEmpty)
                defaultAddress.contactMobile,
            ].join(' · ');

            final addressString = defaultAddress.id == null
                ? 'No saved address'
                : [
                    if (contactInfo.isNotEmpty) contactInfo,
                    if (defaultAddress.flatNo.isNotEmpty) defaultAddress.flatNo,
                    if (defaultAddress.buildingName.isNotEmpty)
                      defaultAddress.buildingName,
                    if (defaultAddress.street.isNotEmpty) defaultAddress.street,
                    if (defaultAddress.area.isNotEmpty) defaultAddress.area,
                    '${defaultAddress.city} - ${defaultAddress.pincode}',
                  ].join(', ');

            final firstItem = s.items.isNotEmpty ? s.items.first : null;
            final unitPrice = (firstItem != null && (firstItem.finalPrice > 0 ? firstItem.finalPrice : firstItem.unitPrice) > 0)
                ? (firstItem.finalPrice > 0 ? firstItem.finalPrice : firstItem.unitPrice)
                : (s.pricePerDay > 0 ? s.pricePerDay : 0.0);
            final originalPrice = (firstItem != null && firstItem.originalPrice > 0)
                ? firstItem.originalPrice
                : (firstItem != null && firstItem.unitPrice > unitPrice ? firstItem.unitPrice : 0.0);
            final discount = (firstItem != null && firstItem.discount > 0)
                ? firstItem.discount
                : (originalPrice > unitPrice && originalPrice > 0
                    ? (((originalPrice - unitPrice) / originalPrice) * 100).round()
                    : 0);

            return SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Alert Banners ──────────────────────────────
                  _buildAlertBanners(),

                  // ── 1. Subscription Product Card ───────────────
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isCancelled
                            ? kRed.withValues(alpha: 0.15)
                            : kBorderLt,
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: kPrimary.withValues(alpha: 0.03),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            // Product image
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                color: isActive
                                    ? const Color(0xFFFAFBF9)
                                    : const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: kBorderLt, width: 1),
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: buildProductImage(
                                  s.productName,
                                  imageAsset: s.imageUrl,
                                  fit: BoxFit.cover,
                                  fallbackColor: isActive ? kPrimary : kTextSub,
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _prettifyName(s.productName),
                                    style: const TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w900,
                                      color: kText,
                                      letterSpacing: -0.3,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    '${s.qty > 1 ? '${s.qty} Units' : (firstItem?.variantName.isNotEmpty == true ? firstItem!.variantName : '1 Unit')} • ${s.frequency}',
                                    style: const TextStyle(
                                      fontSize: 12.5,
                                      color: kTextSub,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Wrap(
                                    crossAxisAlignment: WrapCrossAlignment.center,
                                    spacing: 6,
                                    runSpacing: 4,
                                    children: [
                                      if (unitPrice > 0)
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 7,
                                            vertical: 2.5,
                                          ),
                                          decoration: BoxDecoration(
                                            color: kPrimaryPl,
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            '₹${unitPrice.toStringAsFixed(2)} / unit',
                                            style: const TextStyle(
                                              fontSize: 11.5,
                                              fontWeight: FontWeight.w900,
                                              color: kPrimary,
                                            ),
                                          ),
                                        ),
                                      if (originalPrice > unitPrice) ...[
                                        Text(
                                          'MRP ₹${originalPrice.toStringAsFixed(0)}',
                                          style: const TextStyle(
                                            fontSize: 11.5,
                                            fontWeight: FontWeight.w600,
                                            color: kMuted,
                                            decoration: TextDecoration.lineThrough,
                                          ),
                                        ),
                                        if (discount > 0)
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 5.5,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFDCFCE7),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              '$discount% OFF',
                                              style: const TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w800,
                                                color: Color(0xFF166534),
                                              ),
                                            ),
                                          ),
                                      ],
                                      Text(
                                        '₹${monthlyPrice.toStringAsFixed(0)} / Month',
                                        style: TextStyle(
                                          fontSize: 13.5,
                                          fontWeight: FontWeight.w900,
                                          color: isCancelled ? kTextSub : kText,
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (s.pauseFromDate != null &&
                                      s.pauseToDate != null) ...[
                                    const SizedBox(height: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: kAccentLt.withValues(alpha: 0.5),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        s.pauseFromDate == s.pauseToDate
                                            ? 'Paused: ${s.pauseFromDate}'
                                            : 'Paused: ${s.pauseFromDate} → ${s.pauseToDate}',
                                        style: const TextStyle(
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w800,
                                          color: kAccent,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            // Status badge
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: statusBg,
                                borderRadius: BorderRadius.circular(100),
                              ),
                              child: Text(
                                isActive
                                    ? 'Active'
                                    : isPaused
                                    ? 'Paused'
                                    : isExpired
                                    ? 'Expired'
                                    : isCompleted
                                    ? 'Completed'
                                    : 'Cancelled',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  color: statusColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                        // Frequency & Day Quantities at bottom of Product Card
                        _buildSubCardDaysWidget(s),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // ── 2. Quick action buttons (All Green Theme) ──
                  Row(
                    children: [
                      Expanded(
                        child: _QuickActionButton(
                          icon: Icons.calendar_month_rounded,
                          label: 'Calendar',
                          color: kPrimary,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  SubscriptionCalendarScreen(subscription: s),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _QuickActionButton(
                          icon: Icons.receipt_long_rounded,
                          label: 'Bills',
                          color: kPrimary,
                          onTap: _showBillsSheet,
                          badge: (_detailInfo?.outstandingBillCount ?? 0) > 0
                              ? '${_detailInfo!.outstandingBillCount}'
                              : null,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _QuickActionButton(
                          icon: Icons.history_rounded,
                          label: 'Pauses',
                          color: kPrimary,
                          onTap: _showPauseHistorySheet,
                          badge: _pauseHistory.isNotEmpty
                              ? '${_pauseHistory.length}'
                              : null,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _QuickActionButton(
                          icon: Icons.local_shipping_rounded,
                          label: 'Orders',
                          color: kPrimary,
                          onTap: _showOrdersHistorySheet,
                          badge: _subscriptionOrders.isNotEmpty
                              ? '${_subscriptionOrders.length}'
                              : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // ── 3. Delivery Address ────────────────────────
                  _buildDeliveryAddressCard(defaultAddress, addressString),
                  const SizedBox(height: 12),

                  // ── 4. Postpaid Summary Card (if Postpaid or Postpaid Enabled) ─────
                  if (s.paymentType.toLowerCase() == 'postpaid' || (profile != null && profile.isPostpaidEnabled && profile.postpaidCreditLimit > 0))
                    _buildPostpaidSummaryCard(sessionState),

                  // ── 5. Subscription Details (collapsible, includes Delivery Details) ──
                  _buildSubscriptionDetailsSection(s),
                  const SizedBox(height: 20),

                  // ── 7. Bills section ────────────────────────────
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Bills',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: kText,
                        ),
                      ),
                      if (_bills.isNotEmpty)
                        GestureDetector(
                          onTap: _showBillsSheet,
                          child: const Text(
                            'View All',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: kPrimary,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _buildBillsSection(),
                  const SizedBox(height: 16),
                ],
              ),
            );
          },
        ),
        bottomSheet: _buildBottomSheet(
          isActive: isActive,
          isPaused: isPaused,
          isCancelled: isCancelled,
          isTerminal: isTerminal,
        ),
      ),
    );
  }

  Widget _buildBottomSheet({
    required bool isActive,
    required bool isPaused,
    required bool isCancelled,
    required bool isTerminal,
  }) {
    final s = widget.subscription;
    final isExpired = s.status == 'expaired' || s.status == 'expired';
    final isCompleted = s.status == 'completed';

    if (isCompleted) {
      return Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        decoration: BoxDecoration(
          color: kSurface,
          border: const Border(top: BorderSide(color: kBorderLt)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 12,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 48,
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _handleRenew,
              icon: const Icon(
                Icons.replay_rounded,
                size: 18,
                color: Colors.white,
              ),
              label: const Text(
                'RENEW SUBSCRIPTION',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
        ),
      );
    }

    if (isExpired) {
      return Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        decoration: BoxDecoration(
          color: kSurface,
          border: const Border(top: BorderSide(color: kBorderLt)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 12,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 48,
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const WalletScreen()),
                );
              },
              icon: const Icon(
                Icons.account_balance_wallet_rounded,
                size: 18,
                color: Colors.white,
              ),
              label: const Text(
                'PAY OUTSTANDING BILLS',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: kRed,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
        ),
      );
    }

    // Determine if pause is current/future (disable Pause, show Resume)
    final today = DateTime.now();
    final todayStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    final pTo = s.pauseToDate;
    final isCurrentlyPaused = pTo != null && pTo.compareTo(todayStr) >= 0;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      decoration: BoxDecoration(
        color: kSurface,
        border: const Border(top: BorderSide(color: kBorderLt)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Auto Renew toggle row ───────────────────────────
            if (!isTerminal) ...[
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: kBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: kBorderLt),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: s.autoRenew
                            ? const Color(0xFFDCFCE7)
                            : kBorderLt,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        Icons.autorenew_rounded,
                        size: 15,
                        color: s.autoRenew ? const Color(0xFF15803D) : kMuted,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Auto Renew',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: kText,
                            ),
                          ),
                          Text(
                            s.autoRenew
                                ? 'Subscription renews automatically'
                                : 'Ends on current end date',
                            style: const TextStyle(
                              fontSize: 10.5,
                              color: kTextSub,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Switch.adaptive(
                      value: s.autoRenew,
                      onChanged: (val) {
                        context.read<SubscriptionBloc>().add(
                          UpdateAutoRenewRequested(
                            subscriptionId: s.id,
                            autoRenew: val,
                          ),
                        );
                      },
                      activeColor: const Color(0xFF15803D),
                    ),
                  ],
                ),
              ),
            ],
            // ── Pause disabled / Resume / Cancel row ───────────
            Row(
              children: [
                // Pause button — disabled when currently paused
                Expanded(
                  flex: 3,
                  child: SizedBox(
                    height: 46,
                    child: isCurrentlyPaused
                        ? Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                height: 46,
                                child: ElevatedButton.icon(
                                  onPressed: null,
                                  icon: const Icon(
                                    Icons.pause_circle_outline_rounded,
                                    size: 17,
                                  ),
                                  label: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    child: Text(
                                      'Paused until ${_formatDate(pTo!)}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                      ),
                                      maxLines: 1,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    disabledBackgroundColor: kBorderLt,
                                    disabledForegroundColor: kMuted,
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                    ),
                                    elevation: 0,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          )
                        : ElevatedButton.icon(
                            onPressed: isTerminal ? null : _handlePause,
                            icon: const Icon(
                              Icons.pause_circle_outline_rounded,
                              size: 17,
                              color: Colors.white,
                            ),
                            label: const FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                'Pause Subscription',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                ),
                                maxLines: 1,
                              ),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: isTerminal ? kMuted : kPrimary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                              ),
                              disabledBackgroundColor: kBorderLt,
                              disabledForegroundColor: kMuted,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                  ),
                ),
                if (!isTerminal) ...[
                  const SizedBox(width: 8),
                  // Resume button — only when paused
                  if (isCurrentlyPaused)
                    Expanded(
                      flex: 2,
                      child: SizedBox(
                        height: 46,
                        child: ElevatedButton.icon(
                          onPressed: _showResumeDialog,
                          icon: const Icon(
                            Icons.play_circle_outline_rounded,
                            size: 17,
                            color: Colors.white,
                          ),
                          label: const FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              'Resume',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                              ),
                              maxLines: 1,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF15803D),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                    ),
                  // Cancel button
                  Expanded(
                    flex: 2,
                    child: SizedBox(
                      height: 46,
                      child: OutlinedButton(
                        onPressed: _handleCancel,
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          side: BorderSide(
                            color: kRed.withValues(alpha: 0.5),
                            width: 1.2,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          backgroundColor: kRed.withValues(alpha: 0.04),
                        ),
                        child: const FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            'Cancel',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              color: kRed,
                            ),
                            maxLines: 1,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(
    String label,
    String value, {
    bool showChevron = false,
    Color? valueColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 3,
                child: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 13,
                    color: kTextSub,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Expanded(
                flex: 5,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerRight,
                        child: Text(
                          value,
                          textAlign: TextAlign.end,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: valueColor ?? kText,
                          ),
                        ),
                      ),
                    ),
                    if (showChevron) ...[
                      const SizedBox(width: 4),
                      const Icon(
                        Icons.chevron_right_rounded,
                        size: 15,
                        color: kTextSub,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, thickness: 1, color: kBorderLt),
        ],
      ),
    );
  }
}

// ─── Info Pill ────────────────────────────────────────────────────────────────

class _InfoPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _InfoPill({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────

class _AlertBanner extends StatelessWidget {
  final IconData icon;
  final String message;
  final Color color;
  final Color bgColor;
  final Color borderColor;
  final VoidCallback onTap;
  final String actionLabel;

  const _AlertBanner({
    required this.icon,
    required this.message,
    required this.color,
    required this.bgColor,
    required this.borderColor,
    required this.onTap,
    required this.actionLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontSize: 12,
                color: color,
                fontWeight: FontWeight.w600,
                height: 1.4,
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                actionLabel,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Bill Card ────────────────────────────────────────────────────────────────

class _BillCard extends StatelessWidget {
  final SubscriptionBillModel bill;
  final String Function(String?) formatDate;

  const _BillCard({required this.bill, required this.formatDate});

  Color get _statusColor {
    switch (bill.status.toLowerCase()) {
      case 'paid':
        return kPrimary;
      case 'unpaid':
        return kRed;
      case 'cancelled':
        return kMuted;
      default:
        return kAccent;
    }
  }

  String get _statusLabel {
    switch (bill.status.toLowerCase()) {
      case 'paid':
        return 'Paid';
      case 'unpaid':
        return 'Unpaid';
      case 'cancelled':
        return 'Cancelled';
      default:
        return bill.status.toUpperCase();
    }
  }

  @override
  Widget build(BuildContext context) {
    final billMap = {
      'bill_id': bill.billId,
      'bill_type': bill.billType,
      'reference_id': bill.referenceId,
      'payment_type': bill.paymentType,
      'payment_method': 'wallet',
      'billing_from': bill.billingFrom,
      'billing_to': bill.billingTo,
      'due_date': bill.dueDate,
      'subtotal': bill.subtotal,
      'discount_amount': bill.discountAmount,
      'tax_amount': bill.taxAmount,
      'total_amount': bill.totalAmount,
      'paid_amount': bill.paidAmount,
      'due_amount': bill.dueAmount,
      'status': bill.status,
      'remarks': bill.remarks,
      'created_at': bill.dueDate,
      'items': bill.items
          .map(
            (i) => {
              'product_name': i.productVariantId,
              'unit_price': i.unitPrice,
              'final_price': i.totalAmount,
              'quantity': i.quantity,
            },
          )
          .toList(),
    };

    return GestureDetector(
      onTap: () => showBillDetailSheet(context, billMap),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: bill.dueAmount > 0
                ? kRed.withValues(alpha: 0.15)
                : kBorderLt,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: _statusColor.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.receipt_long_rounded,
                    size: 18,
                    color: _statusColor,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        bill.billId,
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                          color: kText,
                        ),
                      ),
                      const SizedBox(height: 2),
                      if (bill.billingFrom != null && bill.billingTo != null)
                        Text(
                          '${formatDate(bill.billingFrom)} → ${formatDate(bill.billingTo)}',
                          style: const TextStyle(
                            fontSize: 10.5,
                            color: kTextSub,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: _statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    _statusLabel,
                    style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w900,
                      color: _statusColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            const Divider(height: 1, color: kBorderLt),
            const SizedBox(height: 10),
            Row(
              children: [
                _BillStat(
                  label: 'Total',
                  value: '₹${bill.totalAmount.toStringAsFixed(0)}',
                ),
                _BillStat(
                  label: 'Paid',
                  value: '₹${bill.paidAmount.toStringAsFixed(0)}',
                  color: kPrimary,
                ),
                if (bill.dueAmount > 0)
                  _BillStat(
                    label: 'Due',
                    value: '₹${bill.dueAmount.toStringAsFixed(0)}',
                    color: kRed,
                  ),
                if (bill.dueDate != null && bill.dueDate!.isNotEmpty)
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text(
                          'Due Date',
                          style: TextStyle(
                            fontSize: 9.5,
                            color: kMuted,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          formatDate(bill.dueDate),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: bill.dueAmount > 0 ? kRed : kTextSub,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _BillStat extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;

  const _BillStat({required this.label, required this.value, this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 9.5,
              color: kMuted,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w900,
              color: color ?? kText,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  final String? badge;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Column(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon, color: color, size: 20),
                if (badge != null)
                  Positioned(
                    top: -4,
                    right: -8,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: color,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        badge!,
                        style: const TextStyle(
                          fontSize: 8,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w800,
                  color: color,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Pause History Bottom Sheet ───────────────────────────────────────────────

class _PauseHistorySheet extends StatelessWidget {
  final List<SubscriptionPauseModel> pauses;
  final bool isLoading;
  final String Function(String?) formatDate;
  final VoidCallback onResume;

  const _PauseHistorySheet({
    required this.pauses,
    required this.isLoading,
    required this.formatDate,
    required this.onResume,
  });

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final todayStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    // Find the one latest active pause (status=paused AND endDate not passed)
    final latestActivePauseId = pauses.isNotEmpty
        ? pauses
              .firstWhere(
                (p) =>
                    (p.status == 'paused' || p.status == null) &&
                    (p.endDate == null ||
                        p.endDate == '2099-12-31' ||
                        (p.endDate?.compareTo(todayStr) ?? -1) >= 0),
                orElse: () => const SubscriptionPauseModel(
                  id: '__none__',
                  subscriptionId: '',
                ),
              )
              .id
        : '__none__';

    return Container(
      decoration: const BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.72,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: kBorderLt,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: kAccentLt.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.history_rounded,
                  color: kAccent,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Pause History',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: kText,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 20, color: kTextSub),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Divider(color: kBorderLt),
          const SizedBox(height: 8),
          if (isLoading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: kAccent,
                ),
              ),
            )
          else if (pauses.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.pause_circle_outline_rounded,
                      size: 40,
                      color: kMuted.withValues(alpha: 0.5),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'No pause history yet.',
                      style: TextStyle(
                        fontSize: 13,
                        color: kTextSub,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: pauses.length,
                itemBuilder: (_, i) {
                  final pause = pauses[i];
                  final isLatestActive =
                      pause.id == latestActivePauseId && pause.id != '__none__';
                  final isResumed = pause.status == 'resumed';
                  final statusColor = isResumed
                      ? const Color(0xFF15803D)
                      : isLatestActive
                      ? kAccent
                      : kMuted;
                  final statusBg = isResumed
                      ? const Color(0xFFDCFCE7)
                      : isLatestActive
                      ? kAccentLt.withValues(alpha: 0.4)
                      : const Color(0xFFF0F0F0);
                  final statusLabel = isResumed
                      ? 'Resumed'
                      : isLatestActive
                      ? 'Active'
                      : 'Ended';
                  final iconData = isResumed
                      ? Icons.play_circle_outline_rounded
                      : Icons.pause_circle_outline_rounded;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isLatestActive
                          ? kAccentLt.withValues(alpha: 0.15)
                          : kBg,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isLatestActive
                            ? kAccentLt.withValues(alpha: 0.5)
                            : kBorderLt,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(7),
                              decoration: BoxDecoration(
                                color: statusBg,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                iconData,
                                size: 13,
                                color: statusColor,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${formatDate(pause.startDate)} → ${formatDate(pause.endDate)}',
                                    style: const TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w800,
                                      color: kText,
                                    ),
                                  ),
                                  if (pause.reason != null &&
                                      pause.reason!.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      pause.reason!,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: kTextSub,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: statusBg,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                statusLabel,
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  color: statusColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                        // Resume button — only on latest active pause record
                        if (isLatestActive) ...[
                          const SizedBox(height: 10),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: () {
                                Navigator.pop(context);
                                onResume();
                              },
                              icon: const Icon(
                                Icons.play_circle_outline_rounded,
                                size: 15,
                                color: Colors.white,
                              ),
                              label: const Text(
                                'Resume Subscription',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF15803D),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 10,
                                ),
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

// ─── Bills Bottom Sheet ───────────────────────────────────────────────────────

class _BillsSheet extends StatelessWidget {
  final List<SubscriptionBillModel> bills;
  final bool isLoading;
  final String Function(String?) formatDate;

  const _BillsSheet({
    required this.bills,
    required this.isLoading,
    required this.formatDate,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: kBorderLt,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF7C3AED).withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.receipt_long_rounded,
                  color: Color(0xFF7C3AED),
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Bills',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        color: kText,
                      ),
                    ),
                    Text(
                      '${bills.length} bill${bills.length != 1 ? 's' : ''} for this subscription',
                      style: const TextStyle(
                        fontSize: 11,
                        color: kTextSub,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 20, color: kTextSub),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Divider(color: kBorderLt),
          const SizedBox(height: 8),
          if (isLoading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: kPrimary,
                ),
              ),
            )
          else if (bills.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.receipt_long_outlined,
                      size: 40,
                      color: kMuted.withValues(alpha: 0.5),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'No bills found yet.',
                      style: TextStyle(
                        fontSize: 13,
                        color: kTextSub,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                padding: const EdgeInsets.only(bottom: 16),
                itemCount: bills.length,
                itemBuilder: (_, i) =>
                    _BillCard(bill: bills[i], formatDate: formatDate),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Orders History Bottom Sheet ──────────────────────────────────────────────

class _OrdersHistorySheet extends StatelessWidget {
  final List<Order> orders;
  const _OrdersHistorySheet({required this.orders});

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'delivered':
        return kPrimary;
      case 'pending':
        return kAccent;
      case 'cancelled':
        return kRed;
      default:
        return kTextSub;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: kBorderLt,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF0077B6).withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.receipt_long_rounded,
                  color: Color(0xFF0077B6),
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Delivery Orders',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        color: kText,
                      ),
                    ),
                    Text(
                      '${orders.length} order${orders.length != 1 ? 's' : ''} for this subscription',
                      style: const TextStyle(
                        fontSize: 11,
                        color: kTextSub,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 20, color: kTextSub),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Divider(color: kBorderLt),
          const SizedBox(height: 8),
          if (orders.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.inbox_outlined,
                      size: 40,
                      color: kMuted.withValues(alpha: 0.5),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'No delivery orders yet.',
                      style: TextStyle(
                        fontSize: 13,
                        color: kTextSub,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: orders.length,
                itemBuilder: (_, i) {
                  final order = orders[i];
                  final color = _statusColor(order.status);
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: kBg,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: kBorderLt),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Center(
                            child: Text(
                              order.emoji,
                              style: const TextStyle(fontSize: 18),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                order.productName,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w800,
                                  color: kText,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                order.scheduledDate.isNotEmpty
                                    ? order.scheduledDate
                                    : order.date,
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  color: kTextSub,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '₹${order.amount.toStringAsFixed(0)}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                                color: kText,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                order.status.toUpperCase(),
                                style: TextStyle(
                                  fontSize: 8.5,
                                  fontWeight: FontWeight.w900,
                                  color: color,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

String _prettifyName(String name) {
  return name
      .replaceAll('_', ' ')
      .split(' ')
      .map((word) {
        if (word.isEmpty) return '';
        return word[0].toUpperCase() + word.substring(1);
      })
      .join(' ');
}
