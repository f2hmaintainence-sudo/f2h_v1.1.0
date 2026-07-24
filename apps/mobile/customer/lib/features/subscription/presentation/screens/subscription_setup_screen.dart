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
  State<SubscriptionSetupScreen> createState() => _SubscriptionSetupScreenState();
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

  @override
  void initState() {
    super.initState();
    final vars = widget.product.allVariants;
    _variant = widget.initialVariant ??
        vars.firstWhere(
          (v) => v.subscriptionPrice != null && v.subscriptionPrice! > 0,
          orElse: () => vars.isNotEmpty ? vars.first : ProductVariant(
            id: widget.product.id,
            label: widget.product.unit,
            price: widget.product.price,
            originalPrice: widget.product.originalPrice,
            subscriptionPrice: widget.product.subscriptionPrice,
          ),
        );

    _startDate = DateTime.now().add(const Duration(days: 1));

    // Init weekly schedule defaults: 1 morning, 0 evening per day
    _weeklySchedule = {for (final d in _kDays) d: {'morning': 1, 'evening': 0}};

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
  }) get _currentMonthEstimate {
    final endOfMonth = DateTime(_startDate.year, _startDate.month + 1, 0);
    const dayMap = {'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7};

    int totalDays = 0;
    int totalQty = 0;

    if (_frequency == 'daily') {
      // All 7 days, same qty each
      for (final day in _kDays) {
        final wd = dayMap[day] ?? 1;
        final cnt = calculateEstimatedDeliveryDays(_startDate, endOfMonth, [wd]);
        totalDays += cnt;
        totalQty += cnt * (_morningQty + _eveningQty);
      }
    } else {
      // Weekly: per-day qty
      for (final day in _kDays) {
        final wd = dayMap[day] ?? 1;
        final cnt = calculateEstimatedDeliveryDays(_startDate, endOfMonth, [wd]);
        final dayQty = (_weeklySchedule[day]?['morning'] ?? 0) + (_weeklySchedule[day]?['evening'] ?? 0);
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
  }) get _fullMonthEstimate {
    final start = DateTime(_startDate.year, _startDate.month, 1);
    final endOfMonth = DateTime(_startDate.year, _startDate.month + 1, 0);
    const dayMap = {'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7};

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
        final dayQty = (_weeklySchedule[day]?['morning'] ?? 0) + (_weeklySchedule[day]?['evening'] ?? 0);
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
    if (picked != null) setState(() => _selectedAddress = picked);
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
      profile: context.read<CustomerSessionCubit>().state.profile,
      existingPostpaidCommitted: _calculateExistingPostpaidCommitted(),
      onConfirm: ({required String paymentType, required String paymentMethod}) {
        _executeCheckout(paymentType: paymentType, paymentMethod: paymentMethod);
      },
      onSwitchToPrepaid: () {
        setState(() => _paymentType = 'prepaid');
        _confirmSubscription();
      },
    );
  }

  void _executeCheckout({required String paymentType, required String paymentMethod}) {
    final session = context.read<CustomerSessionCubit>().state;
    final customerId = session.profile?.customerId ?? '';
    final addressId = _selectedAddress?.addressId ?? '';
    final branchId = (_selectedAddress?.branchId != null && _selectedAddress!.branchId.isNotEmpty)
        ? _selectedAddress!.branchId
        : (session.branches.isNotEmpty
            ? (session.branches.first['branch_id']?.toString() ?? session.branches.first['id']?.toString() ?? '')
            : '');

    final int morningQty;
    final int eveningQty;
    if (_frequency == 'daily') {
      morningQty = _morningQty;
      eveningQty = _eveningQty;
    } else {
      morningQty = _weeklySchedule.values.fold(0, (s, d) => s + (d['morning'] ?? 0));
      eveningQty = _weeklySchedule.values.fold(0, (s, d) => s + (d['evening'] ?? 0));
    }

    final deliverySlot = morningQty > 0 && eveningQty > 0
        ? 'Both'
        : morningQty > 0
            ? 'Morning'
            : 'Evening';

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
            customDays: _kDays,
            morningQty: morningQty,
            eveningQty: eveningQty,
            weeklySchedule: _frequency == 'weekly' ? Map.from(_weeklySchedule) : {},
            paymentType: paymentType,
            paymentMethod: paymentMethod,
            autoRenew: _autoRenew,
            estimatedTotal: _currentMonthEstimate.total,
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
        } else if (state is SubscriptionActionSuccess && state.subscriptionId != null) {
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
          if (state.errorCode == 'insufficient_wallet') {
            F2HToast.error(context, '${state.message}. Please top up your wallet.');
          } else if (state.errorCode == 'credit_limit_exceeded') {
            F2HToast.error(context, '${state.message}. Switched to Prepaid option.');
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
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: kText),
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

                  // ── Start Date & Auto Renewal ─────────────────
                  _buildScheduleOptions(),
                  const SizedBox(height: 16),

                  // ── Payment Type ──────────────────────────────
                  _buildPaymentTypeSection(),
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
    final vars = p.allVariants.where((v) => v.subscriptionPrice != null && v.subscriptionPrice! > 0).toList();
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
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE8F5E9),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.autorenew_rounded, size: 9, color: Color(0xFF1B4332)),
                              SizedBox(width: 3),
                              Text(
                                'Subscription',
                                style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, color: Color(0xFF1B4332)),
                              ),
                            ],
                          ),
                        ),
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
              style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: kTextSub, letterSpacing: 0.8),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: vars.map((v) {
                final isSel = v.id == _variant.id;
                final subPrice = v.subscriptionPrice ?? v.price;
                return GestureDetector(
                  onTap: () => setState(() => _variant = v),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: isSel ? const Color(0xFF1B4332) : Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isSel ? const Color(0xFF1B4332) : const Color(0xFFE0E0E0),
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
                            color: isSel ? Colors.white : kText,
                          ),
                        ),
                        Text(
                          '₹${subPrice.toStringAsFixed(0)}/unit',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: isSel ? Colors.white70 : const Color(0xFF1B4332),
                          ),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(icon: Icons.location_on_outlined, label: 'Delivery Address'),
          const SizedBox(height: 10),
          if (_selectedAddress != null)
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _selectedAddress!.addressType.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          color: kPrimary,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${_selectedAddress!.name}, ${_selectedAddress!.detail}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: kText),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _changeAddress,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: kPrimaryPl,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: kPrimary.withOpacity(0.3)),
                    ),
                    child: const Text(
                      'Change',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: kPrimary),
                    ),
                  ),
                ),
              ],
            )
          else
            GestureDetector(
              onTap: _changeAddress,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: kPrimaryPl,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: kPrimary.withOpacity(0.3)),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.add_location_alt_outlined, size: 16, color: kPrimary),
                    SizedBox(width: 6),
                    Text(
                      'Add Delivery Address',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kPrimary),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ── Frequency Section ─────────────────────────────────

  Widget _buildFrequencySection() {
    return _SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(icon: Icons.repeat_rounded, label: 'Frequency'),
          const SizedBox(height: 10),

          // ── Daily / Weekly tabs ────────────────────────
          Row(
            children: [
              _FreqChip(label: 'Daily', value: 'daily', selected: _frequency, onTap: (v) {
                setState(() => _frequency = v);
              }),
              const SizedBox(width: 8),
              _FreqChip(label: 'Weekly', value: 'weekly', selected: _frequency, onTap: (v) {
                setState(() => _frequency = v);
              }),
            ],
          ),

          const SizedBox(height: 14),
          const Divider(color: Color(0xFFE5E7EB), height: 1),
          const SizedBox(height: 14),

          // ── DAILY: single shared morning + evening qty ─
          if (_frequency == 'daily') ...[
            // Header
            Row(
              children: [
                const SizedBox(width: 80),
                Expanded(
                  child: Center(
                    child: Text('MORNING', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Colors.amber.shade700, letterSpacing: 0.6)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Center(
                    child: Text('EVENING', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Colors.indigo.shade400, letterSpacing: 0.6)),
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
                  child: Text('Every Day', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kText)),
                ),
                Expanded(
                  child: _MiniQtyControl(
                    qty: _morningQty,
                    accentColor: Colors.amber.shade700,
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
                    accentColor: Colors.indigo.shade400,
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
                style: TextStyle(fontSize: 10, color: Colors.red.shade400, fontWeight: FontWeight.w600),
              )
            else
              Text(
                'Daily: ${_morningQty + _eveningQty} items/day · ₹${((_morningQty + _eveningQty) * _subscriptionUnitPrice).toStringAsFixed(0)}/day',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText),
              ),
          ],

          // ── WEEKLY: individual per-day qty controls ────
          if (_frequency == 'weekly') ...[
            // Header
            Row(
              children: [
                const SizedBox(width: 80),
                Expanded(
                  child: Center(
                    child: Text('MORNING', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Colors.amber.shade700, letterSpacing: 0.6)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Center(
                    child: Text('EVENING', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: Colors.indigo.shade400, letterSpacing: 0.6)),
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
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kText),
                      ),
                    ),
                    Expanded(
                      child: _MiniQtyControl(
                        qty: morQty,
                        accentColor: Colors.amber.shade700,
                        onDecrement: () => setState(() {
                          if (morQty > 0) _weeklySchedule[day]!['morning'] = morQty - 1;
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
                        accentColor: Colors.indigo.shade400,
                        onDecrement: () => setState(() {
                          if (eveQty > 0) _weeklySchedule[day]!['evening'] = eveQty - 1;
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
            Builder(builder: (_) {
              final weekTotal = _weeklySchedule.values.fold(0, (s, d) => s + (d['morning'] ?? 0) + (d['evening'] ?? 0));
              return weekTotal == 0
                  ? Text(
                      'Set at least 1 unit for any day in the week',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 10, color: Colors.red.shade400, fontWeight: FontWeight.w600),
                    )
                  : Text(
                      'Weekly: $weekTotal items · ₹${(_weeklySchedule.values.fold(0.0, (s, d) => s + ((d['morning'] ?? 0) + (d['evening'] ?? 0)) * _subscriptionUnitPrice)).toStringAsFixed(0)}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: kText),
                    );
            }),
          ],
        ],
      ),
    );
  }

  // helper: day abbreviation to full name
  String _dayFull(String abbr) {
    const map = {'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday'};
    return map[abbr] ?? abbr;
  }

  // ── Schedule Options (Start Date + Auto Renewal) ──────

  Widget _buildScheduleOptions() {
    final monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return _SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Start From
          Row(
            children: [
              const Icon(Icons.play_circle_outline_rounded, size: 16, color: kPrimary),
              const SizedBox(width: 6),
              const Text(
                'Start From',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: kText),
              ),
              const Spacer(),
              GestureDetector(
                onTap: _pickStartDate,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: kPrimaryPl,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: kPrimary.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today_rounded, size: 13, color: kPrimary),
                      const SizedBox(width: 4),
                      Text(
                        '${_startDate.day} ${monthNames[_startDate.month - 1]} ${_startDate.year}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: kPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(color: Color(0xFFE5E7EB), height: 1),
          const SizedBox(height: 14),

          // Auto Renewal
          Row(
            children: [
              const Icon(Icons.autorenew_rounded, size: 16, color: kPrimary),
              const SizedBox(width: 6),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Auto Renewal',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: kText),
                    ),
                    Text(
                      'Subscription renews automatically each month',
                      style: TextStyle(fontSize: 10, color: kTextSub),
                    ),
                  ],
                ),
              ),
              Switch(
                value: _autoRenew,
                onChanged: (v) => setState(() => _autoRenew = v),
                activeColor: kPrimary,
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Payment Type Section ──────────────────────────────

  Widget _buildPaymentTypeSection() {
    final profile = context.read<CustomerSessionCubit>().state.profile;
    final isPostpaidEnabled = profile?.isPostpaidEnabled ?? false;
    final creditLimit = profile?.postpaidCreditLimit ?? 0.0;

    // Auto-revert payment type if postpaid is not enabled
    if (!isPostpaidEnabled && _paymentType == 'postpaid') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _paymentType = 'prepaid');
      });
    }

    return _SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(icon: Icons.payments_outlined, label: 'Payment Type'),
          const SizedBox(height: 4),
          // No COD for subscriptions
          const Text(
            'COD is not available for subscriptions',
            style: TextStyle(fontSize: 10, color: kTextSub),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _PaymentTypeCard(
                  label: 'Prepaid',
                  icon: Icons.payment_rounded,
                  description: 'Pay upfront from wallet. Ensures uninterrupted delivery.',
                  selected: _paymentType == 'prepaid',
                  isEnabled: true,
                  onTap: () => setState(() => _paymentType = 'prepaid'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _PaymentTypeCard(
                  label: 'Postpaid',
                  icon: Icons.schedule_outlined,
                  description: isPostpaidEnabled
                      ? (creditLimit > 0
                          ? 'Pay at end of billing cycle. Limit: ₹${creditLimit.toStringAsFixed(0)}.'
                          : 'Pay at end of billing cycle (approved accounts only).')
                      : 'Postpaid facility is not activated for your account.',
                  selected: isPostpaidEnabled && _paymentType == 'postpaid',
                  isEnabled: isPostpaidEnabled,
                  isVip: isPostpaidEnabled,
                  creditLimit: creditLimit,
                  onTap: isPostpaidEnabled
                      ? () => setState(() => _paymentType = 'postpaid')
                      : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Bottom Confirm Bar ────────────────────────────────

  Widget _buildBottomBar(({int days, int qty, double total, double normalTotal, double savings, double savingsPercent}) estimate) {
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
                  style: TextStyle(fontSize: 10, color: kTextSub),
                ),
                Text(
                  '₹${total.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: kText,
                  ),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: (_isLoading || total <= 0) ? null : _confirmSubscription,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1B4332),
              foregroundColor: Colors.white,
              disabledBackgroundColor: const Color(0xFFE5E7EB),
              disabledForegroundColor: const Color(0xFF9CA3AF),
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : Text(
                    total <= 0 ? 'Set Quantity to Continue' : 'Confirm Subscription',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900),
                  ),
          ),
        ],
      ),
    );
  }

  // ── Collapsible Estimation Section ───────────────────

  Widget _buildEstimationSection(
    ({int days, int qty, double total, double normalTotal, double savings, double savingsPercent}) estimate,
    ({int days, int qty, double total, double normalTotal, double savings, double savingsPercent}) fullEst,
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
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: kText),
                ),
                const Spacer(),
                // Summary when collapsed
                if (!_estimateExpanded)
                  Text(
                    '~₹${estimate.total.toStringAsFixed(0)} this month',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: kPrimary),
                  ),
                const SizedBox(width: 6),
                AnimatedRotation(
                  turns: _estimateExpanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: const Icon(Icons.keyboard_arrow_down_rounded, size: 20, color: kTextSub),
                ),
              ],
            ),
          ),

          // Expandable content
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 280),
            crossFadeState: _estimateExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            firstChild: const SizedBox.shrink(),
            secondChild: Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Column(
                children: [
                  const Divider(color: Color(0xFFE5E7EB)),
                  const SizedBox(height: 12),
                  const _SectionLabel(label: 'CURRENT MONTH ESTIMATE'),
                  const SizedBox(height: 8),
                  MonthlyEstimationCard(
                    title: 'This Month Estimate',
                    subtitle: 'From ${_formatDate(_startDate)} to end of month',
                    headerIcon: Icons.calendar_view_month_rounded,
                    headerColor: const Color(0xFF1B5E20),
                    estimatedDays: estimate.days,
                    estimatedQty: estimate.qty,
                    morningQty: _frequency == 'daily' ? _morningQty : _totalMorningQty,
                    eveningQty: _frequency == 'daily' ? _eveningQty : _totalEveningQty,
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
                    morningQty: _frequency == 'daily' ? _morningQty : _totalMorningQty,
                    eveningQty: _frequency == 'daily' ? _eveningQty : _totalEveningQty,
                    normalPrice: _normalUnitPrice,
                    subscriptionPrice: _subscriptionUnitPrice,
                    estimatedTotal: fullEst.total,
                    savings: fullEst.savings,
                    savingsPercent: fullEst.savingsPercent,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────

  String _formatDate(DateTime d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${d.day} ${months[d.month - 1]}';
  }
}

// ══════════════════════════════════════════════════════════
//  HELPER WIDGETS
// ══════════════════════════════════════════════════════════

class _SectionCard extends StatelessWidget {
  final Widget child;
  const _SectionCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
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
        Icon(icon, size: 15, color: kPrimary),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
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
  const _FreqChip({required this.label, required this.value, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isSel = value == selected;
    return Expanded(
      child: GestureDetector(
        onTap: () => onTap(value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: isSel ? const Color(0xFF1B4332) : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSel ? const Color(0xFF1B4332) : const Color(0xFFDDE1E6),
            ),
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

class _PaymentTypeCard extends StatelessWidget {
  final String label;
  final IconData icon;
  final String description;
  final bool selected;
  final bool isEnabled;
  final bool isVip;
  final double creditLimit;
  final VoidCallback? onTap;

  const _PaymentTypeCard({
    required this.label,
    required this.icon,
    required this.description,
    required this.selected,
    this.isEnabled = true,
    this.isVip = false,
    this.creditLimit = 0.0,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final activeColor = selected ? const Color(0xFF1B4332) : kText;
    final bg = !isEnabled
        ? const Color(0xFFF1F5F9)
        : (selected ? const Color(0xFFE8F5E9) : Colors.white);
    final borderColor = !isEnabled
        ? const Color(0xFFCBD5E1)
        : (selected ? const Color(0xFF1B4332) : const Color(0xFFDDE1E6));

    return GestureDetector(
      onTap: isEnabled ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: borderColor,
            width: selected ? 1.5 : 1.0,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  icon,
                  size: 14,
                  color: !isEnabled ? const Color(0xFF94A3B8) : (selected ? const Color(0xFF1B4332) : kTextSub),
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: !isEnabled ? const Color(0xFF94A3B8) : activeColor,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (!isEnabled) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'Not Activated',
                      style: TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ),
                ] else if (isVip) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: const Color(0xFFF59E0B), width: 0.6),
                    ),
                    child: const Text(
                      '👑 VIP',
                      style: TextStyle(
                        fontSize: 8.5,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFB45309),
                      ),
                    ),
                  ),
                  if (selected) const SizedBox(width: 4),
                ],
                if (selected && isEnabled)
                  const Icon(Icons.check_circle_rounded, size: 14, color: Color(0xFF1B4332)),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              description,
              style: TextStyle(
                fontSize: 9,
                color: !isEnabled ? const Color(0xFF94A3B8) : kTextSub,
                height: 1.3,
              ),
            ),
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
