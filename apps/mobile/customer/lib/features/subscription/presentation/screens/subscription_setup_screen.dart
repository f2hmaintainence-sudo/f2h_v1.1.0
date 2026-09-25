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
import 'package:google_fonts/google_fonts.dart';
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
import 'subscription_success_screen.dart';
import '../../../wallet/presentation/screens/wallet_screen.dart';

// ── Day abbreviations ─────────────────────────────────────
const _kDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Custom Date Schedule Entry ─────────────────────────────
class CustomDateScheduleEntry {
  DateTime date;
  int morningQty;
  int eveningQty;

  CustomDateScheduleEntry({
    required DateTime date,
    this.morningQty = 1,
    this.eveningQty = 0,
  }) : date = DateTime(date.year, date.month, date.day);

  String get dateString =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  String get formattedDisplay =>
      '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year.toString().substring(2)}';

  String get weekdayShort {
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return names[date.weekday - 1];
  }
}

class SubscriptionSetupScreen extends StatefulWidget {
  final Product product;
  final ProductVariant? initialVariant;
  final String? initialFrequency;
  final int? initialMorningQty;
  final int? initialEveningQty;
  final Map<String, Map<String, int>>? initialWeeklySchedule;
  final List<CustomDateScheduleEntry>? initialCustomDates;
  final bool? initialAutoRenew;
  final String? initialPaymentType;

  const SubscriptionSetupScreen({
    super.key,
    required this.product,
    this.initialVariant,
    this.initialFrequency,
    this.initialMorningQty,
    this.initialEveningQty,
    this.initialWeeklySchedule,
    this.initialCustomDates,
    this.initialAutoRenew,
    this.initialPaymentType,
  });

  @override
  State<SubscriptionSetupScreen> createState() =>
      _SubscriptionSetupScreenState();
}

class _SubscriptionSetupScreenState extends State<SubscriptionSetupScreen> {
  // ── Selected variant ─────────────────────────────────
  late ProductVariant _variant;

  // ── Frequency ────────────────────────────────────────
  /// 'daily' | 'weekly' | 'custom'
  String _frequency = 'daily';

  // ── Daily mode quantities ─────────────────────────────
  int _morningQty = 1;
  int _eveningQty = 0;

  // ── Weekly mode per-day schedule ─────────────────────
  // Map: dayAbbr → {'morning': qty, 'evening': qty}
  late Map<String, Map<String, int>> _weeklySchedule;

  // ── Custom mode per-date schedule ────────────────────
  List<CustomDateScheduleEntry> _customDates = [];

  void _deduplicateCustomDates() {
    final now = DateTime.now();
    final earliestDate = DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
    final seen = <String>{};
    _customDates.retainWhere((entry) {
      if (entry.date.isBefore(earliestDate)) {
        return false;
      }
      return seen.add(entry.dateString);
    });
  }

  // ── Subscription dates ────────────────────────────────
  late DateTime _startDate;

  // ── Options ──────────────────────────────────────────
  bool _autoRenew = false;

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

  String get _currentDisplayName {
    if (_variant.label.trim().isNotEmpty && _variant.label.trim() != 'Standard') {
      if (_variant.label.toLowerCase().contains(widget.product.name.toLowerCase()) ||
          widget.product.name.toLowerCase().contains(_variant.label.toLowerCase())) {
        return _variant.label;
      }
      final cleanBaseName = widget.product.name.split(' - ').first.trim();
      final packUnit = _variant.formattedUnit.isNotEmpty ? _variant.formattedUnit : _variant.label;
      return '$cleanBaseName - $packUnit';
    }
    return widget.product.name;
  }

  @override
  void initState() {
    super.initState();
    final vars = widget.product.variants.isNotEmpty
        ? widget.product.variants
        : widget.product.allVariants;

    if (widget.initialVariant != null) {
      _variant = vars.firstWhere(
        (v) => v.id == widget.initialVariant!.id,
        orElse: () => widget.initialVariant!,
      );
    } else {
      _variant = vars.firstWhere(
        (v) => v.id == widget.product.id && v.subscriptionPrice != null && v.subscriptionPrice! > 0,
        orElse: () => vars.firstWhere(
          (v) => v.id == widget.product.id,
          orElse: () => vars.firstWhere(
            (v) => v.subscriptionPrice != null && v.subscriptionPrice! > 0 && !v.isOutOfStock,
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
          ),
        ),
      );
    }

    if (widget.initialFrequency != null && widget.initialFrequency!.isNotEmpty) {
      _frequency = widget.initialFrequency!;
    }
    if (widget.initialMorningQty != null) {
      _morningQty = widget.initialMorningQty!;
    }
    if (widget.initialEveningQty != null) {
      _eveningQty = widget.initialEveningQty!;
    }
    if (widget.initialAutoRenew != null) {
      _autoRenew = widget.initialAutoRenew!;
    }
    if (widget.initialPaymentType != null && widget.initialPaymentType!.isNotEmpty) {
      _paymentType = widget.initialPaymentType!;
    }

    _startDate = DateTime.now().add(const Duration(days: 1));

    // Init weekly schedule defaults
    if (widget.initialWeeklySchedule != null && widget.initialWeeklySchedule!.isNotEmpty) {
      _weeklySchedule = {
        for (final d in _kDays)
          d: {
            'morning': widget.initialWeeklySchedule![d]?['morning'] ?? 0,
            'evening': widget.initialWeeklySchedule![d]?['evening'] ?? 0,
          },
      };
    } else {
      _weeklySchedule = {
        for (final d in _kDays) d: {'morning': 0, 'evening': 0},
      };
    }

    // Init custom schedule defaults
    if (widget.initialCustomDates != null && widget.initialCustomDates!.isNotEmpty) {
      final now = DateTime.now();
      final earliestDate = DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
      final seen = <String>{};
      _customDates = [];
      for (final entry in widget.initialCustomDates!) {
        if (!entry.date.isBefore(earliestDate) && seen.add(entry.dateString)) {
          _customDates.add(entry);
        }
      }
      _deduplicateCustomDates();
      _customDates.sort((a, b) => a.date.compareTo(b.date));
    }

    // Load default address from session and initialize default quantities based on open slots
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

      // Initialize default quantities based on configured open slot windows
      final timings = session.slotTimings;
      final now = DateTime.now();
      final morningWin = getMorningSlotWindow(now, timings);
      final eveningWin = getEveningSlotWindow(now, timings);

      // Seed from which slots the admin has enabled if not passed via initial parameters
      if (widget.initialMorningQty == null && widget.initialEveningQty == null) {
        if (!eveningWin.isEnabled && morningWin.isEnabled) {
          setState(() {
            _morningQty = 1;
            _eveningQty = 0;
          });
        } else if (!morningWin.isEnabled && eveningWin.isEnabled) {
          setState(() {
            _morningQty = 0;
            _eveningQty = 1;
          });
        } else if (!morningWin.isEnabled && !eveningWin.isEnabled) {
          setState(() {
            _morningQty = 0;
            _eveningQty = 0;
          });
        }
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
    if (_frequency == 'custom') {
      return _customDates.fold(0, (s, d) => s + d.morningQty);
    }
    return _weeklySchedule.values.fold(0, (s, d) => s + (d['morning'] ?? 0));
  }

  /// Total evening qty for estimations
  int get _totalEveningQty {
    if (_frequency == 'daily') return _eveningQty;
    if (_frequency == 'custom') {
      return _customDates.fold(0, (s, d) => s + d.eveningQty);
    }
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
    } else if (_frequency == 'custom') {
      for (final entry in _customDates) {
        final dayQty = entry.morningQty + entry.eveningQty;
        if (dayQty > 0) {
          totalDays += 1;
          totalQty += dayQty;
        }
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
    } else if (_frequency == 'custom') {
      for (final entry in _customDates) {
        final dayQty = entry.morningQty + entry.eveningQty;
        if (dayQty > 0) {
          totalDays += 1;
          totalQty += dayQty;
        }
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

  // ── Date pickers ──────────────────────────────────────

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
    if (!mounted) return;
    if (picked != null) setState(() => _startDate = picked);
  }

  Future<void> _pickCustomDeliveryDate() async {
    final first = DateTime.now().add(const Duration(days: 1));
    final last = DateTime(first.year, first.month + 3, 0);
    final initial = _customDates.isNotEmpty
        ? (_customDates.last.date.add(const Duration(days: 1)).isBefore(last)
            ? _customDates.last.date.add(const Duration(days: 1))
            : first)
        : first;
    final picked = await showCustomDatePicker(
      context: context,
      initialDate: initial.isBefore(first) ? first : initial,
      firstDate: first,
      lastDate: last,
      title: 'Select Delivery Date',
    );
    if (!mounted) return;
    if (picked != null) {
      final dateOnly = DateTime(picked.year, picked.month, picked.day);
      final newKey =
          '${dateOnly.year}-${dateOnly.month.toString().padLeft(2, '0')}-${dateOnly.day.toString().padLeft(2, '0')}';
      _deduplicateCustomDates();
      final exists = _customDates.any((e) => e.dateString == newKey);
      if (exists) {
        F2HToast.show(context, 'This date is already added');
        return;
      }
      final slotTimings = slotTimingsOf(context);
      final now = DateTime.now();
      final morningWin = getMorningSlotWindow(now, slotTimings);
      final eveningWin = getEveningSlotWindow(now, slotTimings);
      final defaultMorning = morningWin.isEnabled ? 1 : 0;
      final defaultEvening = (!morningWin.isEnabled && eveningWin.isEnabled) ? 1 : 0;

      setState(() {
        _customDates.add(
          CustomDateScheduleEntry(
            date: dateOnly,
            morningQty: defaultMorning,
            eveningQty: defaultEvening,
          ),
        );
        _deduplicateCustomDates();
        _customDates.sort((a, b) => a.date.compareTo(b.date));
      });
    }
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

    if (!_selectedAddress!.isServiceable || !_selectedAddress!.branchIsActive) {
      final reason = _selectedAddress!.unserviceableReason ??
          'Delivery is currently unavailable at this address because the local branch is inactive.';
      F2HToast.error(
        context,
        reason,
        title: 'Delivery Unavailable',
      );
      return;
    }

    if (_frequency == 'custom' && _customDates.isEmpty) {
      F2HToast.error(context, 'Please add at least one delivery date');
      return;
    }

    final estimate = _currentMonthEstimate;
    if (estimate.total <= 0 || estimate.qty <= 0) {
      F2HToast.error(context, 'Please set delivery quantity to continue');
      return;
    }

    HapticFeedback.mediumImpact();

    _executeCheckout(
      paymentType: _paymentType,
      paymentMethod: 'wallet',
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
    } else if (_frequency == 'custom') {
      morningQty = _customDates.fold(0, (s, d) => s + d.morningQty);
      eveningQty = _customDates.fold(0, (s, d) => s + d.eveningQty);
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

    final slotTimings = slotTimingsOf(context);
    final now = DateTime.now();
    final morningWin = getMorningSlotWindow(now, slotTimings);
    final eveningWin = getEveningSlotWindow(now, slotTimings);

    // Deliveries start on a future date, so the time of day a subscription is
    // created is irrelevant — only a slot disabled in Configurations blocks it.
    if (morningQty > 0 && !morningWin.isEnabled) {
      F2HToast.error(
        context,
        'Morning delivery is not available right now. Please choose Evening.',
      );
      return;
    }

    if (eveningQty > 0 && !eveningWin.isEnabled) {
      F2HToast.error(
        context,
        'Evening delivery is not available right now. Please choose Morning.',
      );
      return;
    }

    if (morningQty == 0 && eveningQty == 0) {
      F2HToast.error(context, 'Set at least 1 unit to continue');
      return;
    }

    final deliverySlot = morningQty > 0 && eveningQty > 0
        ? 'Both'
        : morningQty > 0
        ? 'Morning'
        : 'Evening';

    final List<String> activeDays;
    final List<Map<String, dynamic>> customSchedulePayload;

    if (_frequency == 'weekly') {
      activeDays = _kDays.where((d) {
        final m = _weeklySchedule[d]?['morning'] ?? 0;
        final e = _weeklySchedule[d]?['evening'] ?? 0;
        return m > 0 || e > 0;
      }).toList();
      customSchedulePayload = const [];
    } else if (_frequency == 'custom') {
      activeDays = _customDates
          .where((d) => (d.morningQty + d.eveningQty) > 0)
          .map((d) => d.dateString)
          .toList();
      customSchedulePayload = _customDates
          .where((d) => (d.morningQty + d.eveningQty) > 0)
          .map((d) => {
                'delivery_date': d.dateString,
                'date': d.dateString,
                'm_quantity': d.morningQty,
                'morning_qty': d.morningQty,
                'e_quantity': d.eveningQty,
                'evening_qty': d.eveningQty,
              })
          .toList();
    } else {
      activeDays = _kDays;
      customSchedulePayload = const [];
    }

    final double effectiveEstimatedTotal = paymentType == 'postpaid'
        ? _fullMonthEstimate.total
        : _currentMonthEstimate.total;

    String? razorpayOrderId;
    String? razorpayPaymentId;
    String? razorpaySignature;

    if (!mounted) return;

    final checkoutStartDate = (_frequency == 'custom' && _customDates.isNotEmpty)
        ? _customDates.first.dateString
        : _startDate.toString().split(' ')[0];

    context.read<SubscriptionBloc>().add(
      SubscriptionCheckoutRequested(
        customerId: customerId,
        branchId: branchId,
        addressId: addressId,
        variantId: _variant.id,
        scheduleType: _frequency == 'custom' ? 'custom_dates' : _frequency,
        deliverySlot: deliverySlot,
        startDate: checkoutStartDate,
        unitPrice: _subscriptionUnitPrice,
        customDays: activeDays,
        morningQty: morningQty,
        eveningQty: eveningQty,
        weeklySchedule: _frequency == 'weekly' ? Map.from(_weeklySchedule) : {},
        customSchedule: customSchedulePayload,
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
    if (_frequency == 'custom') {
      _deduplicateCustomDates();
    }
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
                productName: _currentDisplayName,
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
    final rawVars = p.variants.isNotEmpty ? p.variants : p.allVariants;
    final vars = rawVars
        .where((v) => (v.subscriptionPrice != null && v.subscriptionPrice! > 0) || v.price > 0)
        .toList();
    if (vars.isEmpty) vars.addAll(rawVars);

    final currentVariantImage = (_variant.imagePath != null && _variant.imagePath!.trim().isNotEmpty)
        ? _variant.imagePath
        : (_variant.images.isNotEmpty
            ? _variant.images.first
            : p.imageAsset);

    return _SectionCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Product Info Header ──────────────────────────
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Product Image Container
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x08000000),
                      blurRadius: 6,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: buildProductImage(
                  _currentDisplayName,
                  imageAsset: currentVariantImage,
                  width: 76,
                  height: 76,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title
                    Text(
                      _currentDisplayName,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF0F172A),
                        letterSpacing: -0.2,
                        height: 1.25,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 5),

                    // Vendor & Quality Tag
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFE2E8F0), width: 0.8),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.verified_rounded,
                                size: 11,
                                color: Color(0xFF16A34A),
                              ),
                              const SizedBox(width: 3.5),
                              Text(
                                p.vendor.isNotEmpty ? p.vendor : 'F2H Direct',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF334155),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            'Daily Fresh',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFFB45309),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    // Pricing Row
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Subscription Price
                        RichText(
                          text: TextSpan(
                            children: [
                              TextSpan(
                                text: '₹${_subscriptionUnitPrice.toStringAsFixed(0)}',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                  color: const Color(0xFF15803D),
                                ),
                              ),
                              TextSpan(
                                text: ' /unit',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (_variant.originalPrice > _subscriptionUnitPrice) ...[
                          const SizedBox(width: 8),
                          Text(
                            'MRP ₹${_variant.originalPrice.toStringAsFixed(0)}',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF94A3B8),
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                          if (_variant.discountPercent > 0) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6.5,
                                vertical: 2.5,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFF86EFAC), width: 0.9),
                              ),
                              child: Text(
                                '${_variant.discountPercent}% OFF',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF15803D),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          if (vars.length > 1) ...[
            const SizedBox(height: 14),
            Container(height: 1, color: const Color(0xFFF1F5F9)),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'SELECT PACK SIZE / VARIANT',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF64748B),
                    letterSpacing: 0.8,
                  ),
                ),
                Text(
                  '${vars.length} options',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF94A3B8),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 60,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                itemCount: vars.length,
                separatorBuilder: (_, index) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final v = vars[index];
                  final isSel = v.id == _variant.id;
                  final subPrice = v.subscriptionPrice ?? v.price;
                  final isGone = v.isOutOfStock;
                  final variantTitle = (v.formattedUnit.isNotEmpty && v.formattedUnit != 'Standard')
                      ? v.formattedUnit
                      : v.label;

                  return GestureDetector(
                    onTap: isGone
                        ? null
                        : () {
                            HapticFeedback.selectionClick();
                            setState(() => _variant = v);
                          },
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: isSel
                            ? const Color(0xFFF0FDF4)
                            : (isGone ? const Color(0xFFF8FAFC) : Colors.white),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isSel
                              ? const Color(0xFF16A34A)
                              : (isGone ? const Color(0xFFE2E8F0) : const Color(0xFFCBD5E1)),
                          width: isSel ? 1.8 : 1.0,
                        ),
                        boxShadow: isSel
                            ? [
                                const BoxShadow(
                                  color: Color(0x1A16A34A),
                                  blurRadius: 4,
                                  offset: Offset(0, 1),
                                ),
                              ]
                            : null,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                variantTitle,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 12,
                                  fontWeight: isSel ? FontWeight.w900 : FontWeight.w700,
                                  color: isGone
                                      ? const Color(0xFF94A3B8)
                                      : (isSel ? const Color(0xFF14532D) : const Color(0xFF1E293B)),
                                ),
                              ),
                              if (isSel) ...[
                                const SizedBox(width: 5),
                                const Icon(
                                  Icons.check_circle_rounded,
                                  color: Color(0xFF16A34A),
                                  size: 13,
                                ),
                              ],
                            ],
                          ),
                          if (isGone) ...[
                            const SizedBox(height: 1),
                            Text(
                              'OUT OF STOCK',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 8,
                                fontWeight: FontWeight.w900,
                                color: const Color(0xFFDC2626),
                                letterSpacing: 0.2,
                              ),
                            ),
                          ],
                          const SizedBox(height: 2),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '₹${subPrice.toStringAsFixed(0)}/unit',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  color: isGone
                                      ? const Color(0xFF94A3B8)
                                      : (isSel ? const Color(0xFF15803D) : const Color(0xFF16A34A)),
                                ),
                              ),
                              if (v.originalPrice > subPrice) ...[
                                const SizedBox(width: 4),
                                Text(
                                  '₹${v.originalPrice.toStringAsFixed(0)}',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w600,
                                    color: const Color(0xFF94A3B8),
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
                },
              ),
            ),
            const SizedBox(height: 6),
          ],
        ],
      ),
    );
  }

  // ── Address Section ───────────────────────────────────

  Widget _buildAddressSection() {
    final isUnserviceable = _selectedAddress != null &&
        (!_selectedAddress!.isServiceable || !_selectedAddress!.branchIsActive);

    return _SectionCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: _changeAddress,
            borderRadius: BorderRadius.circular(10),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: isUnserviceable ? const Color(0xFFFEE2E2) : kPrimaryPl,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    isUnserviceable ? Icons.location_off_rounded : Icons.location_on_rounded,
                    size: 16,
                    color: isUnserviceable ? const Color(0xFFDC2626) : kPrimary,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _selectedAddress != null
                        ? '${_selectedAddress!.addressType.toUpperCase()} · ${_selectedAddress!.detail.isNotEmpty ? _selectedAddress!.detail : _selectedAddress!.name}'
                        : 'Select Delivery Address',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: isUnserviceable ? const Color(0xFF991B1B) : kText,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (isUnserviceable) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEE2E2),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: const Text(
                      'UNAVAILABLE',
                      style: TextStyle(
                        fontSize: 8.5,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFDC2626),
                      ),
                    ),
                  ),
                ],
                const SizedBox(width: 8),
                const Icon(Icons.chevron_right_rounded, size: 20, color: kTextSub),
              ],
            ),
          ),
          if (isUnserviceable) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFFFECACA), width: 0.8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline_rounded, size: 12, color: Color(0xFFDC2626)),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      _selectedAddress!.unserviceableReason ??
                          'Branch inactive · Delivery unavailable at this address',
                      style: const TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFDC2626),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── Frequency Section ─────────────────────────────────

  Widget _buildFrequencySection() {
    const morningColor = Color(0xFF14532D); // Dark green
    const eveningColor = Color(0xFF16A34A); // Light green

    final slotTimings = slotTimingsOf(context);
    final now = DateTime.now();
    final morningWin = getMorningSlotWindow(now, slotTimings);
    final eveningWin = getEveningSlotWindow(now, slotTimings);
    // A subscription schedules deliveries for FUTURE dates, so the delivery
    // window (when the driver is actually out) says nothing about whether it
    // may be created now. Only a slot the admin has switched off in
    // Configurations is genuinely unavailable. Same-day ordering cutoffs stay
    // where they belong — the one-time cart flow.
    final isMorningOpen = morningWin.isEnabled;
    final isEveningOpen = eveningWin.isEnabled;
    final bothClosed = !isMorningOpen && !isEveningOpen;

    return _SectionCard(
      border: Border.all(color: const Color(0xFF86EFAC), width: 1.5),
      boxShadow: [
        BoxShadow(
          color: const Color(0xFF16A34A).withValues(alpha: 0.12),
          blurRadius: 18,
          offset: const Offset(0, 6),
          spreadRadius: 1,
        ),
        const BoxShadow(
          color: Color(0x0F000000),
          blurRadius: 8,
          offset: Offset(0, 2),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Frequency title and Daily/Weekly/Custom buttons in a single row ──
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.repeat_rounded,
                  size: 16,
                  color: Color(0xFF15803D),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Frequency',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0F172A),
                ),
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
              const SizedBox(width: 6),
              _FreqChip(
                label: 'Weekly',
                value: 'weekly',
                selected: _frequency,
                onTap: (v) {
                  setState(() => _frequency = v);
                },
              ),
              const SizedBox(width: 6),
              _FreqChip(
                label: 'Custom',
                value: 'custom',
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

          if (bothClosed) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Column(
                children: [
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.schedule_rounded, size: 16, color: Color(0xFFDC2626)),
                      SizedBox(width: 6),
                      Text(
                        'Delivery Currently Unavailable',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF991B1B),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'No delivery slots are enabled at the moment. '
                    'Delivery windows are:\n'
                    '• Morning: ${morningWin.timeRangeText}\n'
                    '• Evening: ${eveningWin.timeRangeText}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF7F1D1D),
                      fontWeight: FontWeight.w600,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
          ] else ...[
            // ── DAILY: single shared morning + evening qty ─
            if (_frequency == 'daily') ...[
              // Header
              Row(
                children: [
                  const SizedBox(width: 80),
                  if (isMorningOpen)
                    Expanded(
                      child: Center(
                        child: Text(
                          'MORNING',
                          style: const TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w900,
                            color: morningColor,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ),
                    ),
                  if (isMorningOpen && isEveningOpen) const SizedBox(width: 8),
                  if (isEveningOpen)
                    Expanded(
                      child: Center(
                        child: Text(
                          'EVENING',
                          style: const TextStyle(
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
                  if (isMorningOpen)
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
                  if (isMorningOpen && isEveningOpen) const SizedBox(width: 8),
                  if (isEveningOpen)
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
                  'Set at least 1 unit in an active delivery window',
                  style: TextStyle(
                    fontSize: 10,
                    color: Colors.red.shade400,
                    fontWeight: FontWeight.w600,
                  ),
                )
              else
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFDCFCE7), width: 1.0),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Daily Schedule',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF15803D),
                        ),
                      ),
                      Text(
                        '${_morningQty + _eveningQty} items/day · ₹${((_morningQty + _eveningQty) * _subscriptionUnitPrice).toStringAsFixed(0)}/day',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF14532D),
                        ),
                      ),
                    ],
                  ),
                ),
            ],

            // ── WEEKLY: individual per-day qty controls ────
            if (_frequency == 'weekly') ...[
              // Header
              Row(
                children: [
                  const SizedBox(width: 80),
                  if (isMorningOpen)
                    Expanded(
                      child: Center(
                        child: Text(
                          'MORNING',
                          style: const TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w900,
                            color: morningColor,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ),
                    ),
                  if (isMorningOpen && isEveningOpen) const SizedBox(width: 8),
                  if (isEveningOpen)
                    Expanded(
                      child: Center(
                        child: Text(
                          'EVENING',
                          style: const TextStyle(
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
                      if (isMorningOpen)
                        Expanded(
                          child: _MiniQtyControl(
                            qty: morQty,
                            accentColor: morningColor,
                            onDecrement: () => setState(() {
                              if (morQty > 0) {
                                _weeklySchedule[day]!['morning'] = morQty - 1;
                              }
                            }),
                            onIncrement: () => setState(() {
                              _weeklySchedule[day]!['morning'] = morQty + 1;
                            }),
                          ),
                        ),
                      if (isMorningOpen && isEveningOpen) const SizedBox(width: 8),
                      if (isEveningOpen)
                        Expanded(
                          child: _MiniQtyControl(
                            qty: eveQty,
                            accentColor: eveningColor,
                            onDecrement: () => setState(() {
                              if (eveQty > 0) {
                                _weeklySchedule[day]!['evening'] = eveQty - 1;
                              }
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
                          'Set at least 1 unit for any day in an active window',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 10,
                            color: Colors.red.shade400,
                            fontWeight: FontWeight.w600,
                          ),
                        )
                      : Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFDCFCE7), width: 1.0),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Weekly Schedule',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF15803D),
                                ),
                              ),
                              Text(
                                '$weekTotal items/wk · ₹${(_weeklySchedule.values.fold(0.0, (s, d) => s + ((d['morning'] ?? 0) + (d['evening'] ?? 0)) * _subscriptionUnitPrice)).toStringAsFixed(0)}/wk',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF14532D),
                                ),
                              ),
                            ],
                          ),
                        );
                },
              ),
            ],

            // ── CUSTOM: specific date selection with slot quantities ────
            if (_frequency == 'custom') ...[
              if (_customDates.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: const BoxDecoration(
                          color: Color(0xFFDCFCE7),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.calendar_month_rounded,
                          size: 24,
                          color: Color(0xFF15803D),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'No Delivery Dates Added',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF1E293B),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Select dates and set morning / evening quantities for each.',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          color: const Color(0xFF64748B),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 12),
                      InkWell(
                        onTap: _pickCustomDeliveryDate,
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF16A34A),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.add_rounded, size: 16, color: Colors.white),
                              const SizedBox(width: 4),
                              Text(
                                'Add Delivery Date',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else ...[
                // Header
                Row(
                  children: [
                    const SizedBox(width: 80),
                    if (isMorningOpen)
                      Expanded(
                        child: Center(
                          child: Text(
                            'MORNING',
                            style: const TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w900,
                              color: morningColor,
                              letterSpacing: 0.6,
                            ),
                          ),
                        ),
                      ),
                    if (isMorningOpen && isEveningOpen) const SizedBox(width: 8),
                    if (isEveningOpen)
                      Expanded(
                        child: Center(
                          child: Text(
                            'EVENING',
                            style: const TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w900,
                              color: eveningColor,
                              letterSpacing: 0.6,
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(width: 30), // Space for delete icon
                  ],
                ),
                const SizedBox(height: 8),
                ..._customDates.map((entry) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 80,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                entry.formattedDisplay,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: kText,
                                ),
                              ),
                              Text(
                                entry.weekdayShort,
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: kTextSub,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (isMorningOpen)
                          Expanded(
                            child: _MiniQtyControl(
                              qty: entry.morningQty,
                              accentColor: morningColor,
                              onDecrement: () => setState(() {
                                if (entry.morningQty > 0) entry.morningQty--;
                              }),
                              onIncrement: () => setState(() => entry.morningQty++),
                            ),
                          ),
                        if (isMorningOpen && isEveningOpen) const SizedBox(width: 8),
                        if (isEveningOpen)
                          Expanded(
                            child: _MiniQtyControl(
                              qty: entry.eveningQty,
                              accentColor: eveningColor,
                              onDecrement: () => setState(() {
                                if (entry.eveningQty > 0) entry.eveningQty--;
                              }),
                              onIncrement: () => setState(() => entry.eveningQty++),
                            ),
                          ),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () {
                            HapticFeedback.lightImpact();
                            setState(() => _customDates.remove(entry));
                          },
                          child: Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEE2E2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Icon(
                              Icons.close_rounded,
                              size: 14,
                              color: Color(0xFFDC2626),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 4),
                // Add more date button
                InkWell(
                  onTap: _pickCustomDeliveryDate,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFF86EFAC), width: 1.2),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.calendar_today_rounded,
                          size: 14,
                          color: Color(0xFF15803D),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '+ Add Another Date',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF15803D),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                const Divider(color: Color(0xFFE5E7EB)),
                // Summary bar
                Builder(
                  builder: (_) {
                    final customTotal = _customDates.fold(
                      0,
                      (s, d) => s + d.morningQty + d.eveningQty,
                    );
                    return customTotal == 0
                        ? Text(
                            'Set at least 1 unit for added dates in an active window',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.red.shade400,
                              fontWeight: FontWeight.w600,
                            ),
                          )
                        : Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0FDF4),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFFDCFCE7), width: 1.0),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Custom Schedule',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFF15803D),
                                  ),
                                ),
                                Text(
                                  '$customTotal items (${_customDates.length} days) · ₹${(customTotal * _subscriptionUnitPrice).toStringAsFixed(0)}',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFF14532D),
                                  ),
                                ),
                              ],
                            ),
                          );
                  },
                ),
              ],
            ],
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

  // ── Plan Options: start date + payment type ───────────────

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
          _buildStartDateRow(),
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
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: kPrimaryPl,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.calendar_today_rounded, size: 15, color: kPrimary),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'START DATE',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        color: kTextSub,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      dateStr,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                        color: kText,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_drop_down_rounded, size: 20, color: Color(0xFF94A3B8)),
            ],
          ),
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
    final slotTimings = slotTimingsOf(context);
    final now = DateTime.now();
    final morningWin = getMorningSlotWindow(now, slotTimings);
    final eveningWin = getEveningSlotWindow(now, slotTimings);
    // Only an admin-disabled slot blocks a subscription; see _buildSlotSelector.
    final allSlotsClosed = !morningWin.isEnabled && !eveningWin.isEnabled;

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
            onPressed: (_isLoading || total <= 0 || _variantOutOfStock || allSlotsClosed)
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
                        : allSlotsClosed
                        ? 'Delivery Unavailable'
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
  final Border? border;
  final List<BoxShadow>? boxShadow;
  const _SectionCard({
    required this.child,
    this.padding,
    this.border,
    this.boxShadow,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border:
            border ?? Border.all(color: const Color(0xFFE5E7EB), width: 1.0),
        boxShadow: boxShadow ??
            const [
              BoxShadow(
                color: Color(0x0A000000),
                blurRadius: 10,
                offset: Offset(0, 3),
              ),
            ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(15),
        child: Padding(
          padding: padding ?? const EdgeInsets.all(16),
          child: child,
        ),
      ),
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
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap(value);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6.5),
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
        border: Border.all(color: accentColor.withValues(alpha: 0.35)),
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
