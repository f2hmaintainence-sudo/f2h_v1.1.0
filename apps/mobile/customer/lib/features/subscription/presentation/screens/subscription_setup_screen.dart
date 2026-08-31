// ══════════════════════════════════════════════════════════
//  SUBSCRIPTION SETUP SCREEN
//
//  Dedicated screen for configuring and confirming a new
//  subscription. Completely independent of Cart/Checkout.
//
//  BUSINESS RULES:
//    • Uses only variant.subscription_price (never .price)
//    • Payment: Prepaid or Postpaid only (no COD)
//    • Creates subscription via SubscriptionBloc directly
//    • On success → navigates to SubscriptionSuccessScreen
// ══════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import '../../../../core/widgets/hot_toast.dart';
import '../../../../core/widgets/custom_date_picker.dart';
import '../../../../core/session/customer_session_cubit.dart';
import '../../../catalog/data/models/product_model.dart';
import '../../../address/presentation/widgets/address_selector_drawer.dart';
import '../../../address/data/models/profile_address.dart';
import '../bloc/subscription_bloc.dart';
import '../bloc/subscription_event.dart';
import '../bloc/subscription_state.dart';
import '../../../catalog/presentation/helpers/cart_helpers.dart';
import '../widgets/monthly_estimation_card.dart';
import '../widgets/subscription_payment_sheet.dart';
import 'subscription_success_screen.dart';
import '../../../wallet/presentation/screens/wallet_screen.dart';
import '../../../../core/payments/payment_service.dart';

// ── Day abbreviations ─────────────────────────────────────
const _kDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

class SubscriptionSetupScreen extends StatefulWidget {
  final Product product;
  final ProductVariant? initialVariant;

  const SubscriptionSetupScreen({
    super.key,
    required this.product,
    this.initialVariant,
  });

  @override
  State<SubscriptionSetupScreen> createState() =>
      _SubscriptionSetupScreenState();
}

class _SubscriptionSetupScreenState extends State<SubscriptionSetupScreen> {
  // ── Selected variant ─────────────────────────────────
  late ProductVariant _variant;

  // ── Frequency ────────────────────────────────────────
  /// 'daily' | 'weekly'
  String _frequency = 'daily';

  // ── Daily mode quantities ─────────────────────────────
  int _morningQty = 1;
  int _eveningQty = 0;

  // ── Weekly mode per-day schedule ─────────────────────
  // Map: dayAbbr → {'morning': qty, 'evening': qty}
  late Map<String, Map<String, int>> _weeklySchedule;

  // ── Subscription dates ────────────────────────────────
  late DateTime _startDate;

  // ── Options ──────────────────────────────────────────
  bool _autoRenew = true;

  /// 'prepaid' | 'postpaid'
  String _paymentType = 'prepaid';

  // ── Address ──────────────────────────────────────────
  AddressModel? _selectedAddress;

  // ── Loading ──────────────────────────────────────────
  bool _isLoading = false;

  // ── Estimation collapse state ─────────────────────────
  bool _estimateExpanded = false;

  /// Whether the pack currently selected can be subscribed to. Stock is a
  /// per-variant fact, so this reads the selection rather than the product the
  /// screen was opened with.
  bool get _variantOutOfStock =>
      _variant.isOutOfStock ||
      (_variant.id == widget.product.id && widget.product.isOutOfStock);

  @override
  void initState() {
    super.initState();
    final vars = widget.product.allVariants;
    _variant =
        widget.initialVariant ??
        vars.firstWhere(
          (v) =>
              v.subscriptionPrice != null &&
              v.subscriptionPrice! > 0 &&
              !v.isOutOfStock,
          // Fall back to a subscribable pack even if sold out, so the screen
          // still explains itself rather than silently showing another pack.
          orElse: () => vars.firstWhere(
            (v) => v.subscriptionPrice != null && v.subscriptionPrice! > 0,
            orElse: () => vars.isNotEmpty
              ? vars.first
                : ProductVariant(
                    id: widget.product.id,
                    label: widget.product.unit,
                    price: widget.product.price,
                    originalPrice: widget.product.originalPrice,
                    subscriptionPrice: widget.product.subscriptionPrice,
                    isOutOfStock: widget.product.isOutOfStock,
                  ),
          ),
        );

    _startDate = DateTime.now().add(const Duration(days: 1));

    // Init weekly schedule defaults: 0 morning, 0 evening per day
    // User must explicitly set quantities for each day they want delivery
    _weeklySchedule = {
      for (final d in _kDays) d: {'morning': 0, 'evening': 0},
    };

    // Load default address from session
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = context.read<CustomerSessionCubit>().state;
      if (session.addresses.isNotEmpty) {
        setState(() {
          _selectedAddress = session.addresses.firstWhere(
            (a) => a.isDefault,
            orElse: () => session.addresses.first,
          );
        });
      }

      // Ensure subscriptions are loaded so existing postpaid committed
      // is calculated correctly in _calculateExistingPostpaidCommitted()
      final subState = context.read<SubscriptionBloc>().state;
      if (subState is! SubscriptionLoaded) {
        context.read<SubscriptionBloc>().add(LoadSubscriptions());
      }
    });
  }

  // ── Subscription price ────────────────────────────────

  /// Always uses variant.subscription_price. Falls back to variant.price
  /// if subscription_price is null (though this should not happen in production).
  double get _subscriptionUnitPrice =>
      (_variant.subscriptionPrice != null && _variant.subscriptionPrice! > 0)
      ? _variant.subscriptionPrice!
      : _variant.price;

  double get _normalUnitPrice => _variant.price;

  /// Total morning qty for estimations
  int get _totalMorningQty {
    if (_frequency == 'daily') return _morningQty;
    return _weeklySchedule.values.fold(0, (s, d) => s + (d['morning'] ?? 0));
  }

  /// Total evening qty for estimations
  int get _totalEveningQty {
    if (_frequency == 'daily') return _eveningQty;
    return _weeklySchedule.values.fold(0, (s, d) => s + (d['evening'] ?? 0));
  }

  // ── Current month estimation ──────────────────────────

  ({
    int days,
    int qty,
    double total,
    double normalTotal,
    double savings,
    double savingsPercent,
  })
  get _currentMonthEstimate {
    final endOfMonth = DateTime(_startDate.year, _startDate.month + 1, 0);
    const dayMap = {
      'Mon': 1,
      'Tue': 2,
      'Wed': 3,
      'Thu': 4,
      'Fri': 5,
      'Sat': 6,
      'Sun': 7,
    };

    int totalDays = 0;
    int totalQty = 0;

    if (_frequency == 'daily') {
      // All 7 days, same qty each
      for (final day in _kDays) {
        final wd = dayMap[day] ?? 1;
        final cnt = calculateEstimatedDeliveryDays(_startDate, endOfMonth, [
          wd,
        ]);
        totalDays += cnt;
        totalQty += cnt * (_morningQty + _eveningQty);
      }
    } else {
      // Weekly: per-day qty
      for (final day in _kDays) {
        final wd = dayMap[day] ?? 1;
        final cnt = calculateEstimatedDeliveryDays(_startDate, endOfMonth, [
          wd,
        ]);
        final dayQty =
            (_weeklySchedule[day]?['morning'] ?? 0) +
            (_weeklySchedule[day]?['evening'] ?? 0);
        if (cnt > 0 && dayQty > 0) {
          totalDays += cnt;
          totalQty += cnt * dayQty;
        }
      }
    }

    final subTotal = totalQty * _subscriptionUnitPrice;
    final normTotal = totalQty * _normalUnitPrice;
    final savings = normTotal - subTotal;
    final savingsPct = normTotal > 0 ? (savings / normTotal) * 100 : 0.0;

    return (
      days: totalDays,
      qty: totalQty,
      total: subTotal,
      normalTotal: normTotal,
      savings: savings,
      savingsPercent: savingsPct,
    );
  }

  // ── Full month estimation (30-day window) ─────────────

  ({
    int days,
    int qty,
    double total,
    double normalTotal,
    double savings,
    double savingsPercent,
  })
  get _fullMonthEstimate {
    final start = DateTime(_startDate.year, _startDate.month, 1);
    final endOfMonth = DateTime(_startDate.year, _startDate.month + 1, 0);
    const dayMap = {
      'Mon': 1,
      'Tue': 2,
      'Wed': 3,
      'Thu': 4,
      'Fri': 5,
      'Sat': 6,
      'Sun': 7,
    };

    int totalDays = 0;
    int totalQty = 0;

    if (_frequency == 'daily') {
      for (final day in _kDays) {
        final wd = dayMap[day] ?? 1;
        final cnt = calculateEstimatedDeliveryDays(start, endOfMonth, [wd]);
        totalDays += cnt;
        totalQty += cnt * (_morningQty + _eveningQty);
      }
    } else {
      for (final day in _kDays) {
        final wd = dayMap[day] ?? 1;
        final cnt = calculateEstimatedDeliveryDays(start, endOfMonth, [wd]);
        final dayQty =
            (_weeklySchedule[day]?['morning'] ?? 0) +
            (_weeklySchedule[day]?['evening'] ?? 0);
        if (cnt > 0 && dayQty > 0) {
          totalDays += cnt;
          totalQty += cnt * dayQty;
        }
      }
    }

    final subTotal = totalQty * _subscriptionUnitPrice;
    final normTotal = totalQty * _normalUnitPrice;
    final savings = normTotal - subTotal;
    final savingsPct = normTotal > 0 ? (savings / normTotal) * 100 : 0.0;

    return (
      days: totalDays,
      qty: totalQty,
      total: subTotal,
      normalTotal: normTotal,
      savings: savings,
      savingsPercent: savingsPct,
    );
  }

  // ── Date picker ───────────────────────────────────────

  Future<void> _pickStartDate() async {
    final first = DateTime.now().add(const Duration(days: 1));
    final last = DateTime(first.year, first.month + 2, 0);
    final picked = await showCustomDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: first,
      lastDate: last,
      title: 'Select Start Date',
    );
    if (picked != null) setState(() => _startDate = picked);
  }

  // ── Address picker ────────────────────────────────────

  Future<void> _changeAddress() async {
    final picked = await AddressSelectorDrawer.show(context);
    if (picked != null && mounted) {
      setState(() => _selectedAddress = picked);
      // Sync with session so the address widget always reflects the new default
      final addrId = (picked.addressId != null && picked.addressId!.isNotEmpty)
          ? picked.addressId!
          : ((picked.id != null && picked.id!.isNotEmpty) ? picked.id! : picked.uniqueId);
      await context.read<CustomerSessionCubit>().updateDefaultAddress(addrId);
    }
  }

  double _calculateExistingPostpaidCommitted() {
    final subState = context.read<SubscriptionBloc>().state;
    if (subState is! SubscriptionLoaded) return 0.0;
    double total = 0.0;
    for (final sub in subState.subscriptions) {
      final pType = sub.paymentType.toLowerCase();
      final sStatus = sub.status.toLowerCase();
      if (pType == 'postpaid' && (sStatus == 'active' || sStatus == 'paused')) {
        total += sub.pricePerDay * 30;
      }
    }
    return total;
  }

  // ── Confirm subscription ──────────────────────────────

  void _confirmSubscription() {
    if (_selectedAddress == null) {
      F2HToast.error(context, 'Please select a delivery address');
      return;
    }

    final estimate = _currentMonthEstimate;
    if (estimate.total <= 0 || estimate.qty <= 0) {
      F2HToast.error(context, 'Please set delivery quantity to continue');
      return;
    }

    HapticFeedback.mediumImpact();

    SubscriptionPaymentSheet.show(
      context: context,
      paymentType: _paymentType,
      estimatedTotal: estimate.total,
      // Use full-month estimate for postpaid credit limit check (not partial-month)
      monthlyEstimateForCreditCheck: _fullMonthEstimate.total,
      profile: context.read<CustomerSessionCubit>().state.profile,
      existingPostpaidCommitted: _calculateExistingPostpaidCommitted(),
      onConfirm:
          ({required String paymentType, required String paymentMethod}) {
            _executeCheckout(
              paymentType: paymentType,
              paymentMethod: paymentMethod,
            );
          },
      onSwitchToPrepaid: () {
        setState(() => _paymentType = 'prepaid');
        _confirmSubscription();
      },
    );
  }

  Future<void> _executeCheckout({
    required String paymentType,
    required String paymentMethod,
  }) async {
    final session = context.read<CustomerSessionCubit>().state;
    final customerId = session.profile?.customerId ?? '';
    final addressId = _selectedAddress?.addressId ?? '';
    final branchId =
        (_selectedAddress?.branchId != null &&
            _selectedAddress!.branchId.isNotEmpty)
        ? _selectedAddress!.branchId
        : (session.branches.isNotEmpty
              ? (session.branches.first['branch_id']?.toString() ??
                    session.branches.first['id']?.toString() ??
                    '')
              : '');

    final int morningQty;
    final int eveningQty;
    if (_frequency == 'daily') {
      morningQty = _morningQty;
      eveningQty = _eveningQty;
    } else {
      morningQty = _weeklySchedule.values.fold(
        0,
        (s, d) => s + (d['morning'] ?? 0),
      );
      eveningQty = _weeklySchedule.values.fold(
        0,
        (s, d) => s + (d['evening'] ?? 0),
      );
    }

    final deliverySlot = morningQty > 0 && eveningQty > 0
        ? 'Both'
        : morningQty > 0
        ? 'Morning'
        : 'Evening';

    // For weekly mode: only pass days that actually have qty > 0
    final activeDays = _frequency == 'weekly'
        ? _kDays.where((d) {
            final m = _weeklySchedule[d]?['morning'] ?? 0;
            final e = _weeklySchedule[d]?['evening'] ?? 0;
            return m > 0 || e > 0;
          }).toList()
        : _kDays;

    final double effectiveEstimatedTotal = paymentType == 'postpaid'
        ? _fullMonthEstimate.total
        : _currentMonthEstimate.total;

    String? razorpayOrderId;
    String? razorpayPaymentId;
    String? razorpaySignature;

    if (paymentType == 'prepaid' &&
        (paymentMethod == 'upi' || paymentMethod == 'online' || paymentMethod == 'razorpay')) {
      final payResult = await PaymentService.instance.payForOrder(
        amount: effectiveEstimatedTotal,
        notes: {
          'customer_id': customerId,
          'purpose': 'subscription',
          'variant_id': _variant.id,
        },
      );

      if (!mounted) return;

      if (payResult.cancelled) {
        F2HToast.show(context, 'Payment cancelled');
        return;
      }

      if (!payResult.success) {
        F2HToast.error(
          context,
          payResult.message.isNotEmpty
              ? payResult.message
              : 'Payment failed. Please try again.',
        );
        return;
      }

      razorpayOrderId = payResult.razorpayOrderId;
      razorpayPaymentId = payResult.razorpayPaymentId;
      razorpaySignature = payResult.razorpaySignature;
    }

    if (!mounted) return;

    context.read<SubscriptionBloc>().add(
      SubscriptionCheckoutRequested(
        customerId: customerId,
        branchId: branchId,
        addressId: addressId,
        variantId: _variant.id,
        scheduleType: _frequency,
        deliverySlot: deliverySlot,
        startDate: _startDate.toString().split(' ')[0],
        unitPrice: _subscriptionUnitPrice,
        customDays: activeDays,
        morningQty: morningQty,
        eveningQty: eveningQty,
        weeklySchedule: _frequency == 'weekly' ? Map.from(_weeklySchedule) : {},
        paymentType: paymentType,
        paymentMethod: paymentMethod,
        autoRenew: _autoRenew,
        // For postpaid: send full-month estimate so backend credit limit
        // check uses monthly commitment, not the partial-month charge.
        // For prepaid: send partial-month amount for correct wallet deduction.
        estimatedTotal: effectiveEstimatedTotal,
        monthlyEstimate: _fullMonthEstimate.total,
        razorpayOrderId: razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId,
        razorpaySignature: razorpaySignature,
      ),
    );
  }

  void _showInsufficientWalletDialog(
    BuildContext context, {
    required double requiredAmt,
    required double availableAmt,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: const [
            Icon(
              Icons.account_balance_wallet_outlined,
              color: Color(0xFFDC2626),
            ),
            SizedBox(width: 8),
            Text(
              'Insufficient Wallet',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Your wallet balance is ₹${availableAmt.toStringAsFixed(2)}. You need ₹${requiredAmt.toStringAsFixed(2)} for this subscription.',
              style: const TextStyle(fontSize: 14, color: Color(0xFF4B5563)),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Shortfall: ₹${(requiredAmt - availableAmt).toStringAsFixed(2)}',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFDC2626),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.push(
                ctx,
                MaterialPageRoute(builder: (_) => const WalletScreen()),
              );
            },
            child: const Text(
              'Add Money',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ══════════════════════════════════════════════════════
  //  BUILD
  // ══════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final estimate = _currentMonthEstimate;
    final fullEst = _fullMonthEstimate;

    return BlocListener<SubscriptionBloc, SubscriptionState>(
      listener: (context, state) {
        if (state is SubscriptionLoading) {
          setState(() => _isLoading = true);
        } else if (state is SubscriptionActionSuccess &&
            state.subscriptionId != null) {
          setState(() => _isLoading = false);
          // Navigate to success screen
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => SubscriptionSuccessScreen(
                subscriptionId: state.subscriptionId!,
                paymentType: state.paymentType ?? _paymentType,
                autoRenew: state.autoRenew ?? _autoRenew,
                address: _selectedAddress != null
                    ? '${_selectedAddress!.addressType.toUpperCase()} · ${_selectedAddress!.name}, ${_selectedAddress!.detail}'
                    : 'Default Address',
                startDate: _startDate.toString().split(' ')[0],
                estimatedMonthlyAmount: estimate.total,
                productName: p.name,
                variantLabel: _variant.label,
              ),
            ),
          );
        } else if (state is SubscriptionActionSuccess) {
          // Success but no ID (e.g. pause/resume actions) — just pop
          setState(() => _isLoading = false);
          F2HToast.success(context, state.message);
          Navigator.pop(context);
        } else if (state is SubscriptionCheckoutError) {
          setState(() => _isLoading = false);
          if (state.errorCode == 'insufficient_wallet' ||
              state.errorCode == 'insufficient wallet') {
            _showInsufficientWalletDialog(
              context,
              requiredAmt: state.required_ ?? estimate.total,
              availableAmt: state.walletBalance ?? 0.0,
            );
          } else if (state.errorCode == 'credit_limit_exceeded' ||
              state.errorCode == 'credit limit exceeded') {
            F2HToast.error(
              context,
              '${state.message}. Switched to Prepaid option.',
            );
            setState(() => _paymentType = 'prepaid');
          } else {
            F2HToast.error(context, state.message);
          }
        } else if (state is SubscriptionError) {
          setState(() => _isLoading = false);
          F2HToast.error(context, state.message);
        } else {
          setState(() => _isLoading = false);
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF6F7F9),
        appBar: AppBar(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          title: const Text(
            'Subscribe',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: kText,
            ),
          ),
          centerTitle: true,
          leading: IconButton(
            icon: const Icon(
              Icons.arrow_back_ios_new_rounded,
              size: 18,
              color: kText,
            ),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        body: Stack(
          children: [
            SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Product Card ──────────────────────────────
                  _buildProductCard(p),
                  const SizedBox(height: 16),

                  // ── Delivery Address ──────────────────────────
                  _buildAddressSection(),
                  const SizedBox(height: 16),

                  // ── Frequency (includes day grid for both modes) ───
                  _buildFrequencySection(),
                  const SizedBox(height: 16),

                  // ── Start Date + Auto Renewal + Payment Type ──
                  _buildPlanOptionsCard(),
                  const SizedBox(height: 24),

                  // ── Collapsible Estimation Section ────────────
                  _buildEstimationSection(estimate, fullEst),
                ],
              ),
            ),

            // ── Loading overlay ───────────────────────────
            if (_isLoading)
              Positioned.fill(
                child: Container(
                  color: Colors.black26,
                  child: const Center(
                    child: CircularProgressIndicator(color: kPrimary),
                  ),
                ),
              ),

            // ── Bottom confirm bar ────────────────────────
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: _buildBottomBar(estimate),
            ),
          ],
        ),
      ),
    );
  }

  // ══════════════════════════════════════════════════════
  //  SECTION BUILDERS
  // ══════════════════════════════════════════════════════

  // ── Product Card ─────────────────────────────────────

  Widget _buildProductCard(Product p) {
    final vars = p.allVariants
        .where((v) => v.subscriptionPrice != null && v.subscriptionPrice! > 0)
        .toList();
    if (vars.isEmpty) vars.addAll(p.allVariants);

    return _SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: buildProductImage(
                  p.name,
                  imageAsset: p.imageAsset,
                  width: 60,
                  height: 60,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.name,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: kText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      p.vendor,
                      style: const TextStyle(fontSize: 11, color: kTextSub),
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 6,
                      children: [
                        Text(
                          '₹${_subscriptionUnitPrice.toStringAsFixed(0)}/unit',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                            color: kPrimary,
                          ),
                        ),
                        if (_variant.originalPrice > _subscriptionUnitPrice) ...[
                          Text(
                            'MRP ₹${_variant.originalPrice.toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: kMuted,
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                          if (_variant.discountPercent > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 5,
                                vertical: 1.5,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                '${_variant.discountPercent}% OFF',
                                style: const TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF166534),
                                ),
                              ),
                            ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          if (vars.length > 1) ...[
            const SizedBox(height: 12),
            const Text(
              'SELECT VARIANT',
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w900,
                color: kTextSub,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: vars.map((v) {
                final isSel = v.id == _variant.id;
                final subPrice = v.subscriptionPrice ?? v.price;
                final isGone = v.isOutOfStock;
                return GestureDetector(
                  onTap: () => setState(() => _variant = v),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: isSel ? (isGone ? kMuted : kPrimary) : Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isSel
                            ? (isGone ? kMuted : kPrimary)
                            : const Color(0xFFE0E0E0),
                        width: isSel ? 1.5 : 1.0,
                      ),
                    ),
                    child: Column(
                      children: [
                        Text(
                          v.label,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: isSel
                                ? Colors.white
                                : (isGone ? kTextSub : kText),
                          ),
                        ),
                        if (isGone)
                          Text(
                            'OUT OF STOCK',
                            style: TextStyle(
                              fontSize: 8,
                              fontWeight: FontWeight.w900,
                              color: isSel
                                  ? Colors.white
                                  : const Color(0xFFD32F2F),
                            ),
                          ),
                        const SizedBox(height: 2),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '₹${subPrice.toStringAsFixed(0)}/unit',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                color: isSel ? Colors.white : kPrimary,
                              ),
                            ),
                            if (v.originalPrice > subPrice) ...[
                              const SizedBox(width: 4),
                              Text(
                                '₹${v.originalPrice.toStringAsFixed(0)}',
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w500,
                                  color: isSel ? Colors.white60 : kMuted,
                                  decoration: TextDecoration.lineThrough,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }

  // ── Address Section ───────────────────────────────────

  Widget _buildAddressSection() {
    return _SectionCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      child: InkWell(
        onTap: _changeAddress,
        borderRadius: BorderRadius.circular(10),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
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
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                _selectedAddress != null
                    ? '${_selectedAddress!.addressType.toUpperCase()} · ${_selectedAddress!.detail.isNotEmpty ? _selectedAddress!.detail : _selectedAddress!.name}'
                    : 'Select Delivery Address',
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: kText,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right_rounded, size: 20, color: kTextSub),
          ],
        ),
      ),
    );
  }

  // ── Frequency Section ─────────────────────────────────

  Widget _buildFrequencySection() {
    const morningColor = Color(0xFF14532D); // Dark green
    const eveningColor = Color(0xFF16A34A); // Light green

    return _SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Frequency title and Daily/Weekly buttons in a single row ──
          Row(
            children: [
              const _SectionTitle(
                icon: Icons.repeat_rounded,
                label: 'Frequency',
              ),
              const Spacer(),
              _FreqChip(
                label: 'Daily',
                value: 'daily',
                selected: _frequency,
                onTap: (v) {
                  setState(() => _frequency = v);
                },
              ),
              const SizedBox(width: 8),
              _FreqChip(
                label: 'Weekly',
                value: 'weekly',
                selected: _frequency,
                onTap: (v) {
                  setState(() => _frequency = v);
                },
              ),
            ],
          ),

          const SizedBox(height: 14),
          const Divider(color: Color(0xFFE5E7EB), height: 1),
          const SizedBox(height: 14),

          // ── DAILY: single shared morning + evening qty ─
          if (_frequency == 'daily') ...[
            // Header
            const Row(
              children: [
                SizedBox(width: 80),
                Expanded(
                  child: Center(
                    child: Text(
                      'MORNING',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w900,
                        color: morningColor,
                        letterSpacing: 0.6,
                      ),
                    ),
                  ),
                ),
                SizedBox(width: 8),
                Expanded(
                  child: Center(
                    child: Text(
                      'EVENING',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w900,
                        color: eveningColor,
                        letterSpacing: 0.6,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Single qty row (applies to every day)
            Row(
              children: [
                const SizedBox(
                  width: 80,
                  child: Text(
                    'Every Day',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: kText,
                    ),
                  ),
                ),
                Expanded(
                  child: _MiniQtyControl(
                    qty: _morningQty,
                    accentColor: morningColor,
                    onDecrement: () => setState(() {
                      if (_morningQty > 0) _morningQty--;
                    }),
                    onIncrement: () => setState(() => _morningQty++),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _MiniQtyControl(
                    qty: _eveningQty,
                    accentColor: eveningColor,
                    onDecrement: () => setState(() {
                      if (_eveningQty > 0) _eveningQty--;
                    }),
                    onIncrement: () => setState(() => _eveningQty++),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Validation hint
            if (_morningQty + _eveningQty == 0)
              Text(
                'Set at least 1 unit (morning or evening)',
                style: TextStyle(
                  fontSize: 10,
                  color: Colors.red.shade400,
                  fontWeight: FontWeight.w600,
                ),
              )
            else
              Text(
                'Daily: ${_morningQty + _eveningQty} items/day · ₹${((_morningQty + _eveningQty) * _subscriptionUnitPrice).toStringAsFixed(0)}/day',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: kText,
                ),
              ),
          ],

          // ── WEEKLY: individual per-day qty controls ────
          if (_frequency == 'weekly') ...[
            // Header
            const Row(
              children: [
                SizedBox(width: 80),
                Expanded(
                  child: Center(
                    child: Text(
                      'MORNING',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w900,
                        color: morningColor,
                        letterSpacing: 0.6,
                      ),
                    ),
                  ),
                ),
                SizedBox(width: 8),
                Expanded(
                  child: Center(
                    child: Text(
                      'EVENING',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w900,
                        color: eveningColor,
                        letterSpacing: 0.6,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ..._kDays.map((day) {
              final morQty = _weeklySchedule[day]?['morning'] ?? 0;
              final eveQty = _weeklySchedule[day]?['evening'] ?? 0;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    SizedBox(
                      width: 80,
                      child: Text(
                        _dayFull(day),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: kText,
                        ),
                      ),
                    ),
                    Expanded(
                      child: _MiniQtyControl(
                        qty: morQty,
                        accentColor: morningColor,
                        onDecrement: () => setState(() {
                          if (morQty > 0)
                            _weeklySchedule[day]!['morning'] = morQty - 1;
                        }),
                        onIncrement: () => setState(() {
                          _weeklySchedule[day]!['morning'] = morQty + 1;
                        }),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MiniQtyControl(
                        qty: eveQty,
                        accentColor: eveningColor,
                        onDecrement: () => setState(() {
                          if (eveQty > 0)
                            _weeklySchedule[day]!['evening'] = eveQty - 1;
                        }),
                        onIncrement: () => setState(() {
                          _weeklySchedule[day]!['evening'] = eveQty + 1;
                        }),
                      ),
                    ),
                  ],
                ),
              );
            }),
            const SizedBox(height: 4),
            const Divider(color: Color(0xFFE5E7EB)),
            // Weekly total summary or validation
            Builder(
              builder: (_) {
                final weekTotal = _weeklySchedule.values.fold(
                  0,
                  (s, d) => s + (d['morning'] ?? 0) + (d['evening'] ?? 0),
                );
                return weekTotal == 0
                    ? Text(
                        'Set at least 1 unit for any day in the week',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.red.shade400,
                          fontWeight: FontWeight.w600,
                        ),
                      )
                    : Text(
                        'Weekly: $weekTotal items · ₹${(_weeklySchedule.values.fold(0.0, (s, d) => s + ((d['morning'] ?? 0) + (d['evening'] ?? 0)) * _subscriptionUnitPrice)).toStringAsFixed(0)}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: kText,
                        ),
                      );
              },
            ),
          ],
        ],
      ),
    );
  }

  // helper: day abbreviation to full name
  String _dayFull(String abbr) {
    const map = {
      'Mon': 'Monday',
      'Tue': 'Tuesday',
      'Wed': 'Wednesday',
      'Thu': 'Thursday',
      'Fri': 'Friday',
      'Sat': 'Saturday',
      'Sun': 'Sunday',
    };
    return map[abbr] ?? abbr;
  }

  // ── Plan Options: start date + auto renewal + payment type ─

  Widget _buildPlanOptionsCard() {
    return _SectionCard(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(
            icon: Icons.tune_rounded,
            label: 'Plan & Payment',
          ),
          const SizedBox(height: 12),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _buildStartDateRow()),
                const SizedBox(width: 10),
                Expanded(child: _buildAutoRenewalRow()),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const Divider(color: Color(0xFFE5E7EB), height: 1),
          const SizedBox(height: 14),
          _buildPaymentTypeContent(),
        ],
      ),
    );
  }

  // ── Start Date row (inside the plan options card) ─────────

  Widget _buildStartDateRow() {
    const monthNames = [
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
    final dateStr = '${_startDate.day} ${monthNames[_startDate.month - 1]} ${_startDate.year}';

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFBFCFB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEFF2F0)),
      ),
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          _pickStartDate();
        },
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(11),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 26,
                    height: 26,
                    decoration: BoxDecoration(
                      color: kPrimaryPl,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.play_circle_fill_rounded, size: 14, color: kPrimary),
                  ),
                  const SizedBox(width: 7),
                  const Expanded(
                    child: Text(
                      'Start From',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: kText,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
                decoration: BoxDecoration(
                  color: kPrimaryPl,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: kPrimary.withValues(alpha: 0.3),
                    width: 1,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.calendar_today_rounded, size: 11, color: kPrimary),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        dateStr,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: kPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Auto Renewal row (inside the plan options card) ───────

  Widget _buildAutoRenewalRow() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFBFCFB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEFF2F0)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(11),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: kPrimaryPl,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.autorenew_rounded, size: 14, color: kPrimary),
                ),
                const SizedBox(width: 6),
                const Expanded(
                  child: Text(
                    'Auto Renew',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: kText,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Transform.scale(
                  scale: 0.75,
                  alignment: Alignment.centerRight,
                  child: Switch(
                    value: _autoRenew,
                    onChanged: (v) {
                      HapticFeedback.lightImpact();
                      setState(() => _autoRenew = v);
                    },
                    activeThumbColor: Colors.white,
                    activeTrackColor: kPrimary,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              _autoRenew ? 'Renews automatically' : 'Single month only',
              style: const TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w600,
                color: kTextSub,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  // ── Payment Type block (inside the plan options card) ─────

  Widget _buildPaymentTypeContent() {
    final profile = context.read<CustomerSessionCubit>().state.profile;
    final isPostpaidEnabled = profile?.isPostpaidEnabled ?? false;
    final creditLimit = profile?.postpaidCreditLimit ?? 0.0;

    // Auto-revert payment type if postpaid is not enabled
    if (!isPostpaidEnabled && _paymentType == 'postpaid') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _paymentType = 'prepaid');
      });
    }

    final isPostpaid = isPostpaidEnabled && _paymentType == 'postpaid';

    final String helper;
    if (isPostpaid) {
      helper = creditLimit > 0
          ? 'Pay at the end of the billing cycle. Credit limit ₹${creditLimit.toStringAsFixed(0)}.'
          : 'Pay at the end of the billing cycle.';
    } else if (!isPostpaidEnabled) {
      helper =
          'Paid upfront from your wallet. Postpaid is for approved accounts only.';
    } else {
      helper =
          'Paid upfront from your wallet — deliveries never pause for billing.';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const _SectionTitle(
              icon: Icons.payments_outlined,
              label: 'Payment Type',
            ),
            const Spacer(),
            Text(
              'No COD',
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w800,
                color: kTextSub.withValues(alpha: 0.8),
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        // Segmented selector — keeps both labels readable at any width.
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Expanded(
                child: _PaymentSegment(
                  label: 'Prepaid',
                  icon: Icons.account_balance_wallet_rounded,
                  selected: !isPostpaid,
                  onTap: () => setState(() => _paymentType = 'prepaid'),
                ),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: _PaymentSegment(
                  label: 'Postpaid',
                  icon: isPostpaidEnabled
                      ? Icons.schedule_rounded
                      : Icons.lock_outline_rounded,
                  selected: isPostpaid,
                  isEnabled: isPostpaidEnabled,
                  showVipBadge: isPostpaidEnabled,
                  onTap: isPostpaidEnabled
                      ? () => setState(() => _paymentType = 'postpaid')
                      : null,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Text(
          helper,
          style: const TextStyle(fontSize: 10.5, color: kTextSub, height: 1.35),
        ),
      ],
    );
  }

  // ── Bottom Confirm Bar ────────────────────────────────

  Widget _buildBottomBar(
    ({
      int days,
      int qty,
      double total,
      double normalTotal,
      double savings,
      double savingsPercent,
    })
    estimate,
  ) {
    final total = estimate.total;
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Est. this month',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: kTextSub,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '₹${total.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: kText,
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: (_isLoading || total <= 0 || _variantOutOfStock)
                ? null
                : _confirmSubscription,
            style: ElevatedButton.styleFrom(
              backgroundColor: kPrimary,
              foregroundColor: Colors.white,
              disabledBackgroundColor: const Color(0xFFE5E7EB),
              disabledForegroundColor: const Color(0xFF9CA3AF),
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              elevation: 0,
            ),
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                : Text(
                    _variantOutOfStock
                        ? 'Out of Stock'
                        : total <= 0
                        ? 'Set Quantity to Continue'
                        : 'Confirm Subscription',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  // ── Collapsible Estimation Section ───────────────────

  Widget _buildEstimationSection(
    ({
      int days,
      int qty,
      double total,
      double normalTotal,
      double savings,
      double savingsPercent,
    })
    estimate,
    ({
      int days,
      int qty,
      double total,
      double normalTotal,
      double savings,
      double savingsPercent,
    })
    fullEst,
  ) {
    return _SectionCard(
      child: Column(
        children: [
          // Collapsible header tap target
          GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _estimateExpanded = !_estimateExpanded);
            },
            behavior: HitTestBehavior.opaque,
            child: Row(
              children: [
                const Icon(Icons.bar_chart_rounded, size: 16, color: kPrimary),
                const SizedBox(width: 6),
                const Text(
                  'Delivery Estimations',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: kText,
                  ),
                ),
                const Spacer(),
                // Summary when collapsed
                if (!_estimateExpanded)
                  Text(
                    '~₹${estimate.total.toStringAsFixed(0)} this month',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: kPrimary,
                    ),
                  ),
                const SizedBox(width: 6),
                AnimatedRotation(
                  turns: _estimateExpanded ? 0.5 : 0,
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

          // Expandable content
          AnimatedSize(
            duration: const Duration(milliseconds: 250),
            curve: Curves.fastOutSlowIn,
            alignment: Alignment.topCenter,
            child: _estimateExpanded
                ? Padding(
                    padding: const EdgeInsets.only(top: 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        const Divider(color: Color(0xFFE5E7EB)),
                        const SizedBox(height: 12),
                        const _SectionLabel(label: 'CURRENT MONTH ESTIMATE'),
                        const SizedBox(height: 8),
                        MonthlyEstimationCard(
                          title: 'This Month Estimate',
                          subtitle:
                              'From ${_formatDate(_startDate)} to end of month',
                          headerIcon: Icons.calendar_view_month_rounded,
                          headerColor: const Color(0xFF1B5E20),
                          estimatedDays: estimate.days,
                          estimatedQty: estimate.qty,
                          morningQty: _frequency == 'daily'
                              ? _morningQty
                              : _totalMorningQty,
                          eveningQty: _frequency == 'daily'
                              ? _eveningQty
                              : _totalEveningQty,
                          isWeekly: _frequency == 'weekly',
                          normalPrice: _normalUnitPrice,
                          subscriptionPrice: _subscriptionUnitPrice,
                          estimatedTotal: estimate.total,
                          savings: estimate.savings,
                          savingsPercent: estimate.savingsPercent,
                        ),
                        const SizedBox(height: 12),
                        const _SectionLabel(label: 'FULL MONTH ESTIMATE'),
                        const SizedBox(height: 8),
                        MonthlyEstimationCard(
                          title: 'Full Month Estimate',
                          subtitle: 'Complete month with selected schedule',
                          headerIcon: Icons.calendar_month_rounded,
                          headerColor: const Color(0xFF1565C0),
                          estimatedDays: fullEst.days,
                          estimatedQty: fullEst.qty,
                          morningQty: _frequency == 'daily'
                              ? _morningQty
                              : _totalMorningQty,
                          eveningQty: _frequency == 'daily'
                              ? _eveningQty
                              : _totalEveningQty,
                          isWeekly: _frequency == 'weekly',
                          normalPrice: _normalUnitPrice,
                          subscriptionPrice: _subscriptionUnitPrice,
                          estimatedTotal: fullEst.total,
                          savings: fullEst.savings,
                          savingsPercent: fullEst.savingsPercent,
                        ),
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────

  String _formatDate(DateTime d) {
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
      'Dec',
    ];
    return '${d.day} ${months[d.month - 1]}';
  }
}

// ══════════════════════════════════════════════════════════
//  HELPER WIDGETS
// ══════════════════════════════════════════════════════════

class _SectionCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final Color? backgroundColor;
  final Border? border;
  const _SectionCard({
    required this.child,
    this.padding,
    this.backgroundColor,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: backgroundColor ?? Colors.white,
        borderRadius: BorderRadius.circular(16),
        border:
            border ?? Border.all(color: const Color(0xFFE5E7EB), width: 1.0),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final IconData icon;
  final String label;
  const _SectionTitle({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: kPrimary),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w900,
            color: kText,
          ),
        ),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: const TextStyle(
        fontSize: 9.5,
        fontWeight: FontWeight.w900,
        color: kTextSub,
        letterSpacing: 0.8,
      ),
    );
  }
}

class _FreqChip extends StatelessWidget {
  final String label;
  final String value;
  final String selected;
  final void Function(String) onTap;
  const _FreqChip({
    required this.label,
    required this.value,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isSel = value == selected;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap(value);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: isSel ? kPrimary : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSel ? kPrimary : const Color(0xFFDDE1E6),
              width: isSel ? 1.5 : 1.0,
            ),
            boxShadow: isSel
                ? [
                    BoxShadow(
                      color: kPrimary.withValues(alpha: 0.2),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: isSel ? Colors.white : kTextSub,
            ),
          ),
        ),
      ),
    );
  }
}

class _PaymentSegment extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final bool isEnabled;
  final bool showVipBadge;
  final VoidCallback? onTap;

  const _PaymentSegment({
    required this.label,
    required this.icon,
    required this.selected,
    this.isEnabled = true,
    this.showVipBadge = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final Color contentColor = !isEnabled
        ? const Color(0xFF94A3B8)
        : (selected ? kPrimary : kTextSub);

    return GestureDetector(
      onTap: isEnabled
          ? () {
              HapticFeedback.selectionClick();
              onTap?.call();
            }
          : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(11),
          border: Border.all(
            color: selected ? kPrimary : Colors.transparent,
            width: 1.4,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: kPrimary.withValues(alpha: 0.12),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 15, color: contentColor),
            const SizedBox(width: 7),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w900,
                  color: contentColor,
                ),
              ),
            ),
            if (showVipBadge) ...[
              const SizedBox(width: 5),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'VIP',
                  style: TextStyle(
                    fontSize: 8,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFFB45309),
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ],
            if (selected) ...[
              const SizedBox(width: 5),
              const Icon(Icons.check_circle_rounded, size: 14, color: kPrimary),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Compact quantity stepper for weekly grid rows ─────────────────────────────

class _MiniQtyControl extends StatelessWidget {
  final int qty;
  final Color accentColor;
  final VoidCallback onDecrement;
  final VoidCallback onIncrement;
  const _MiniQtyControl({
    required this.qty,
    required this.accentColor,
    required this.onDecrement,
    required this.onIncrement,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFFF6F7F9),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: accentColor.withOpacity(0.35)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          GestureDetector(
            onTap: onDecrement,
            child: Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(7),
                border: Border.all(color: const Color(0xFFE0E0E0)),
              ),
              child: Icon(Icons.remove, size: 14, color: accentColor),
            ),
          ),
          Text(
            '$qty',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: accentColor,
            ),
          ),
          GestureDetector(
            onTap: onIncrement,
            child: Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: accentColor,
                borderRadius: BorderRadius.circular(7),
              ),
              child: const Icon(Icons.add, size: 14, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
