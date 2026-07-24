import 'package:flutter/material.dart';
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

  String _getMonthName(int month) {
    const names = [
      '',
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
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
      final info = await sl<SubscriptionRepository>()
          .getSubscriptionDetail(widget.subscription.id);
      if (mounted) setState(() { _detailInfo = info; _loadingDetail = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingDetail = false);
    }
  }

  Future<void> _loadBills() async {
    try {
      final bills = await sl<SubscriptionRepository>()
          .getSubscriptionBills(widget.subscription.id);
      if (mounted) setState(() { _bills = bills; _loadingBills = false; });
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
    final picked = await showCustomDateRangePicker(
      context: context,
      firstDate: DateTime.now(),
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

  void _handleResume() {
    context.read<SubscriptionBloc>().add(
      ResumeSubscriptionRequested(subscriptionId: widget.subscription.id),
    );
    widget.onPauseResume();
    Navigator.pop(context);
  }

  void _handleRenew() {
    final sub = widget.subscription;
    final firstItem = sub.items.isNotEmpty ? sub.items.first : null;
    final variantId = firstItem?.productVariantId ?? sub.id;
    final productName = firstItem?.productName ?? sub.productName;
    final variantName = (firstItem?.variantName.isNotEmpty ?? false) ? firstItem!.variantName : 'Standard';
    final price = (firstItem != null && firstItem.finalPrice > 0) ? firstItem.finalPrice : (firstItem?.unitPrice ?? sub.pricePerDay);

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
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: kText),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Are you sure you want to cancel this subscription? This action cannot be undone.',
              style: TextStyle(fontSize: 13, color: kTextSub, fontWeight: FontWeight.w500),
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
            child: const Text('Keep Subscription',
                style: TextStyle(color: kTextSub, fontWeight: FontWeight.w700)),
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
                  cancelReason: reason.isNotEmpty ? reason : 'Cancelled by customer',
                  endDate: endDate,
                ),
              );
              widget.onDelete();
              if (mounted) Navigator.pop(context);
            },
            child: const Text('Cancel Subscription',
                style: TextStyle(color: kRed, fontWeight: FontWeight.w800)),
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

  Widget _buildSelectedDaysWidget(Subscription s) {
    final dayQtys = s.getSelectedDayQuantities();
    if (dayQtys.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.calendar_today_rounded, size: 12, color: kPrimary),
              SizedBox(width: 6),
              Text(
                'Delivery Schedule:',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: kTextSub),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: dayQtys.map((dq) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 3,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                child: RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 11, color: kText),
                    children: [
                      TextSpan(
                        text: '${dq.dayName} ',
                        style: const TextStyle(fontWeight: FontWeight.w600, color: kTextSub),
                      ),
                      TextSpan(
                        text: '${dq.quantity}',
                        style: const TextStyle(fontWeight: FontWeight.w900, color: kPrimary),
                      ),
                    ],
                  ),
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
    if (!info.alertLowBalance && !info.alertOutstandingBills) return const SizedBox.shrink();

    return Column(
      children: [
        if (info.alertLowBalance) ...[
          _AlertBanner(
            icon: Icons.account_balance_wallet_outlined,
            message:
                'Low Wallet Balance (₹${info.walletBalance.toStringAsFixed(0)}). Please recharge to continue your subscription.',
            color: const Color(0xFFD97706),
            bgColor: const Color(0xFFFFFBEB),
            borderColor: const Color(0xFFFDE68A),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const WalletScreen()),
            ),
            actionLabel: 'Recharge',
          ),
          const SizedBox(height: 8),
        ],
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
            Icon(Icons.receipt_long_rounded, size: 28, color: kMuted.withValues(alpha: 0.5)),
            const SizedBox(width: 14),
            const Text(
              'No bills found for this subscription.',
              style: TextStyle(fontSize: 13, color: kTextSub, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      );
    }

    // Show first 3 bills inline, with "View All" button
    final displayBills = _bills.take(3).toList();
    return Column(
      children: [
        ...displayBills.map((bill) => _BillCard(bill: bill, formatDate: _formatDate)),
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
                  const Icon(Icons.chevron_right_rounded, size: 16, color: kPrimary),
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
    final firstItem = s.items.isNotEmpty ? s.items.first : null;
    final itemPrice = (firstItem != null && firstItem.finalPrice > 0)
        ? firstItem.finalPrice
        : ((firstItem != null && firstItem.unitPrice > 0)
            ? firstItem.unitPrice
            : s.pricePerDay);
    final dailyCost = s.totalDailyCost > 0
        ? s.totalDailyCost
        : ((s.pricePerDay > 0 ? s.pricePerDay : itemPrice) * (s.qty > 0 ? s.qty : 1));
    final monthlyPrice = dailyCost * 30;

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
                icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: kText),
                onPressed: () => Navigator.pop(context),
              ),
            ),
          ),
          title: const Text(
            'Subscription Details',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: kText),
          ),
          centerTitle: true,
        ),
        body: BlocBuilder<CustomerSessionCubit, CustomerSessionState>(
          builder: (context, sessionState) {
            final list = sessionState.addresses;
            final defaultAddress = list.firstWhere(
              (a) => a.isDefault,
              orElse: () => list.isNotEmpty
                  ? list.first
                  : AddressModel(
                      customerId: '', addressType: '', contactName: '',
                      contactMobile: '', flatNo: '', floorNo: '',
                      buildingName: '', landmark: '', street: '',
                      area: '', city: '', state: '', pincode: '',
                      latitude: 0.0, longitude: 0.0, deliveryNote: '',
                      isDefault: false, zoneId: '', routeId: '',
                      branchId: '', status: '',
                    ),
            );

            final addressString = defaultAddress.id == null
                ? 'No saved address'
                : [
                    if (defaultAddress.flatNo.isNotEmpty) defaultAddress.flatNo,
                    if (defaultAddress.buildingName.isNotEmpty) defaultAddress.buildingName,
                    if (defaultAddress.street.isNotEmpty) defaultAddress.street,
                    if (defaultAddress.area.isNotEmpty) defaultAddress.area,
                    '${defaultAddress.city} - ${defaultAddress.pincode}',
                  ].join(', ');

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
                        color: isCancelled ? kRed.withValues(alpha: 0.15) : kBorderLt,
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
                                    '${s.qty > 1 ? '${s.qty} Units' : '1 Litre'} • ${s.frequency}',
                                    style: const TextStyle(
                                      fontSize: 12.5,
                                      color: kTextSub,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '₹${monthlyPrice.toStringAsFixed(0)} / Month',
                                    style: TextStyle(
                                      fontSize: 14.5,
                                      fontWeight: FontWeight.w900,
                                      color: isCancelled ? kTextSub : kText,
                                    ),
                                  ),
                                  if (s.pauseFromDate != null && s.pauseToDate != null) ...[
                                    const SizedBox(height: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: kAccentLt.withValues(alpha: 0.5),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        'Paused: ${s.pauseFromDate} → ${s.pauseToDate}',
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
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
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
                        // Delivery schedule chips
                        _buildSelectedDaysWidget(s),
                        // Delivery slot & payment type pill row
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            _InfoPill(
                              icon: Icons.wb_sunny_rounded,
                              label: s.slot.isNotEmpty ? s.slot : 'Morning',
                              color: const Color(0xFFD97706),
                            ),
                            const SizedBox(width: 8),
                            _InfoPill(
                              icon: s.paymentType == 'postpaid'
                                  ? Icons.credit_card_rounded
                                  : Icons.account_balance_wallet_rounded,
                              label: s.paymentType == 'postpaid' ? 'Postpaid' : 'Prepaid',
                              color: s.paymentType == 'postpaid' ? const Color(0xFF7C3AED) : kPrimary,
                            ),
                            const SizedBox(width: 8),
                            if (s.autoRenew)
                              _InfoPill(
                                icon: Icons.autorenew_rounded,
                                label: 'Auto Renew',
                                color: const Color(0xFF0077B6),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // ── 2. Quick action buttons ────────────────────
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
                              builder: (_) => SubscriptionCalendarScreen(subscription: s),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _QuickActionButton(
                          icon: Icons.receipt_long_rounded,
                          label: 'Bills',
                          color: const Color(0xFF7C3AED),
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
                          color: kAccent,
                          onTap: _showPauseHistorySheet,
                          badge: _pauseHistory.isNotEmpty ? '${_pauseHistory.length}' : null,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _QuickActionButton(
                          icon: Icons.local_shipping_rounded,
                          label: 'Orders',
                          color: const Color(0xFF0077B6),
                          onTap: _showOrdersHistorySheet,
                          badge: _subscriptionOrders.isNotEmpty
                              ? '${_subscriptionOrders.length}'
                              : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // ── 3. Subscription Details ────────────────────
                  const Text(
                    'Subscription Details',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: kText),
                  ),
                  const SizedBox(height: 10),
                  _buildDetailRow('Sub Number', s.displayLabel),
                  _buildDetailRow('Start Date', _formatDate(s.startDate)),
                  _buildDetailRow(
                    'Delivery Address',
                    addressString,
                    showChevron: true,
                  ),
                  _buildDetailRow(
                    'Payment Method',
                    s.paymentType == 'postpaid' ? 'Postpaid' : 'Wallet',
                  ),
                  if (s.endDate != null && s.endDate!.isNotEmpty)
                    _buildDetailRow('End Date', _formatDate(s.endDate)),
                  if (isCancelled)
                    _buildDetailRow('Status', 'Cancelled', valueColor: kRed),
                  if (_detailInfo != null && !_loadingDetail) ...[
                    _buildDetailRow(
                      'Wallet Balance',
                      '₹${_detailInfo!.walletBalance.toStringAsFixed(2)}',
                      valueColor: _detailInfo!.alertLowBalance ? kRed : kPrimary,
                    ),
                    if (_detailInfo!.nextRenewalEstimate > 0)
                      _buildDetailRow(
                        'Est. Renewal',
                        '₹${_detailInfo!.nextRenewalEstimate.toStringAsFixed(0)} / month',
                      ),
                  ],
                  const SizedBox(height: 20),

                  // ── 4. Bills section ────────────────────────────
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Bills',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: kText),
                      ),
                      if (_bills.isNotEmpty)
                        GestureDetector(
                          onTap: _showBillsSheet,
                          child: const Text(
                            'View All',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kPrimary),
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
    final isExpired =
        widget.subscription.status == 'expaired' ||
        widget.subscription.status == 'expired';
    final isCompleted = widget.subscription.status == 'completed';

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
              icon: const Icon(Icons.replay_rounded, size: 18, color: Colors.white),
              label: const Text(
                'RENEW SUBSCRIPTION',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, letterSpacing: 0.5),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
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
              icon: const Icon(Icons.account_balance_wallet_rounded, size: 18, color: Colors.white),
              label: const Text(
                'PAY OUTSTANDING BILLS',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, letterSpacing: 0.5),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: kRed,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        ),
      );
    }

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
        child: Row(
          children: [
            Expanded(
              flex: 3,
              child: SizedBox(
                height: 46,
                child: ElevatedButton.icon(
                  onPressed: isTerminal
                      ? null
                      : isPaused
                      ? _handleResume
                      : _handlePause,
                  icon: Icon(
                    isPaused
                        ? Icons.play_circle_outline_rounded
                        : Icons.pause_circle_outline_rounded,
                    size: 17,
                    color: Colors.white,
                  ),
                  label: Text(
                    isTerminal
                        ? (isCompleted
                              ? 'Subscription Completed'
                              : isExpired
                              ? 'Subscription Expired'
                              : 'Subscription Ended')
                        : isPaused
                        ? 'Resume Subscription'
                        : 'Pause Subscription',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isTerminal
                        ? kMuted
                        : isPaused
                        ? const Color(0xFF15803D)
                        : kPrimary,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: kBorderLt,
                    disabledForegroundColor: kMuted,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ),
            if (!isTerminal) ...[
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: SizedBox(
                  height: 46,
                  child: OutlinedButton(
                    onPressed: _handleCancel,
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: kRed.withValues(alpha: 0.5), width: 1.2),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      backgroundColor: kRed.withValues(alpha: 0.04),
                    ),
                    child: const Text(
                      'Cancel',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: kRed),
                    ),
                  ),
                ),
              ),
            ],
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
                  style: const TextStyle(fontSize: 13, color: kTextSub, fontWeight: FontWeight.w600),
                ),
              ),
              Expanded(
                flex: 5,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
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
                    if (showChevron) ...[
                      const SizedBox(width: 4),
                      const Icon(Icons.chevron_right_rounded, size: 15, color: kTextSub),
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

  const _InfoPill({required this.icon, required this.label, required this.color});

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
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color),
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
              style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600, height: 1.4),
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
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white),
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
      case 'paid': return kPrimary;
      case 'unpaid': return kRed;
      case 'cancelled': return kMuted;
      default: return kAccent;
    }
  }

  String get _statusLabel {
    switch (bill.status.toLowerCase()) {
      case 'paid': return 'Paid';
      case 'unpaid': return 'Unpaid';
      case 'cancelled': return 'Cancelled';
      default: return bill.status.toUpperCase();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: bill.dueAmount > 0 ? kRed.withValues(alpha: 0.15) : kBorderLt,
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
                child: Icon(Icons.receipt_long_rounded, size: 18, color: _statusColor),
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
                        style: const TextStyle(fontSize: 10.5, color: kTextSub, fontWeight: FontWeight.w500),
                      ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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
              _BillStat(label: 'Total', value: '₹${bill.totalAmount.toStringAsFixed(0)}'),
              _BillStat(label: 'Paid', value: '₹${bill.paidAmount.toStringAsFixed(0)}', color: kPrimary),
              if (bill.dueAmount > 0)
                _BillStat(label: 'Due', value: '₹${bill.dueAmount.toStringAsFixed(0)}', color: kRed),
              if (bill.dueDate != null && bill.dueDate!.isNotEmpty)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text('Due Date', style: TextStyle(fontSize: 9.5, color: kMuted, fontWeight: FontWeight.w500)),
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
          Text(label, style: const TextStyle(fontSize: 9.5, color: kMuted, fontWeight: FontWeight.w500)),
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
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
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
                Icon(icon, color: color, size: 22),
                if (badge != null)
                  Positioned(
                    top: -4,
                    right: -8,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
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
            const SizedBox(height: 5),
            Text(
              label,
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color),
              textAlign: TextAlign.center,
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

  const _PauseHistorySheet({
    required this.pauses,
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
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.65),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(color: kBorderLt, borderRadius: BorderRadius.circular(2)),
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
                child: const Icon(Icons.history_rounded, color: kAccent, size: 18),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Pause History',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: kText),
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
            const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator(strokeWidth: 2, color: kAccent)))
          else if (pauses.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.pause_circle_outline_rounded, size: 40, color: kMuted.withValues(alpha: 0.5)),
                    const SizedBox(height: 10),
                    const Text('No pause history yet.',
                        style: TextStyle(fontSize: 13, color: kTextSub, fontWeight: FontWeight.w600)),
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
                  final isActive = pause.endDate == '2099-12-31';
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isActive ? kAccentLt.withValues(alpha: 0.2) : kBg,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isActive ? kAccentLt.withValues(alpha: 0.5) : kBorderLt,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: kAccentLt.withValues(alpha: 0.4),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.pause_rounded, size: 13, color: kAccent),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${formatDate(pause.startDate)} → ${isActive ? 'Ongoing' : formatDate(pause.endDate)}',
                                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: kText),
                              ),
                              if (pause.reason != null && pause.reason!.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(pause.reason!,
                                    style: const TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.w500)),
                              ],
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                          decoration: BoxDecoration(
                            color: isActive ? kAccentLt.withValues(alpha: 0.5) : const Color(0xFFF0F0F0),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            isActive ? 'Active' : 'Ended',
                            style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800,
                                color: isActive ? kAccent : kTextSub),
                          ),
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

// ─── Bills Bottom Sheet ───────────────────────────────────────────────────────

class _BillsSheet extends StatelessWidget {
  final List<SubscriptionBillModel> bills;
  final bool isLoading;
  final String Function(String?) formatDate;

  const _BillsSheet({required this.bills, required this.isLoading, required this.formatDate});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(color: kBorderLt, borderRadius: BorderRadius.circular(2)),
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
                child: const Icon(Icons.receipt_long_rounded, color: Color(0xFF7C3AED), size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Bills',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: kText)),
                    Text(
                      '${bills.length} bill${bills.length != 1 ? 's' : ''} for this subscription',
                      style: const TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.w500),
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
            const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary)))
          else if (bills.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.receipt_long_outlined, size: 40, color: kMuted.withValues(alpha: 0.5)),
                    const SizedBox(height: 10),
                    const Text('No bills found yet.',
                        style: TextStyle(fontSize: 13, color: kTextSub, fontWeight: FontWeight.w600)),
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
                itemBuilder: (_, i) => _BillCard(bill: bills[i], formatDate: formatDate),
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
      case 'delivered': return kPrimary;
      case 'pending': return kAccent;
      case 'cancelled': return kRed;
      default: return kTextSub;
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
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(color: kBorderLt, borderRadius: BorderRadius.circular(2)),
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
                child: const Icon(Icons.receipt_long_rounded, color: Color(0xFF0077B6), size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Delivery Orders',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: kText)),
                    Text(
                      '${orders.length} order${orders.length != 1 ? 's' : ''} for this subscription',
                      style: const TextStyle(fontSize: 11, color: kTextSub, fontWeight: FontWeight.w500),
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
                    Icon(Icons.inbox_outlined, size: 40, color: kMuted.withValues(alpha: 0.5)),
                    const SizedBox(height: 10),
                    const Text('No delivery orders yet.',
                        style: TextStyle(fontSize: 13, color: kTextSub, fontWeight: FontWeight.w600)),
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
                          width: 40, height: 40,
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Center(child: Text(order.emoji, style: const TextStyle(fontSize: 18))),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(order.productName,
                                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: kText),
                                  maxLines: 1, overflow: TextOverflow.ellipsis),
                              const SizedBox(height: 2),
                              Text(
                                order.scheduledDate.isNotEmpty ? order.scheduledDate : order.date,
                                style: const TextStyle(fontSize: 10.5, color: kTextSub, fontWeight: FontWeight.w500),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('₹${order.amount.toStringAsFixed(0)}',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: kText)),
                            const SizedBox(height: 3),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(order.status.toUpperCase(),
                                  style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: color)),
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
