import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/theme/app_typography.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/core/payments/payment_service.dart';
import 'package:f2h_customer/core/payments/payment_models.dart';
import 'package:f2h_customer/core/payments/payment_recovery_service.dart';

class TopupSuccessResult {
  final double amount;
  final double? newBalance;
  final String? transactionId;
  final String? paymentId;

  const TopupSuccessResult({
    required this.amount,
    this.newBalance,
    this.transactionId,
    this.paymentId,
  });
}

class TopupDrawer extends StatefulWidget {
  final void Function(TopupSuccessResult result)? onTopupSuccess;

  const TopupDrawer({
    super.key,
    this.onTopupSuccess,
  });

  @override
  State<TopupDrawer> createState() => _TopupDrawerState();
}

class _TopupDrawerState extends State<TopupDrawer> {
  static const List<double> _presets = [200, 500, 1000];
  static const double _walletCap = 5000;

  final _amountController = TextEditingController(text: '500');
  bool _isSubmitting = false;

  double _maxAllowed(BuildContext context) {
    final balance =
        context.read<CustomerSessionCubit>().state.profile?.walletBalance ?? 0;
    return (_walletCap - balance).clamp(0, _walletCap);
  }

  double get _enteredAmount => double.tryParse(_amountController.text) ?? 0;

  String? _validationError(double maxAllowed) {
    final amt = _enteredAmount;
    if (amt <= 0) return 'Enter an amount';
    if (maxAllowed <= 0) {
      return 'Wallet is full (₹${_walletCap.toStringAsFixed(0)} limit reached)';
    }
    if (amt > maxAllowed) {
      return 'Max you can add: ₹${maxAllowed.toStringAsFixed(0)}';
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        PaymentRecoveryService.instance.checkAndRecoverPendingPayment(context);
      }
    });
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _submitTopup(double maxAllowed) async {
    final error = _validationError(maxAllowed);
    if (error != null || _isSubmitting) {
      if (error != null) F2HToast.error(context, error);
      return;
    }

    setState(() => _isSubmitting = true);

    final amount = _enteredAmount;
    final sessionCubit = context.read<CustomerSessionCubit>();

    try {
      final result = await PaymentService.instance.pay(
        purpose: PaymentPurpose.walletTopup,
        amount: amount,
      );

      if (!mounted) return;

      if (result.cancelled) {
        setState(() => _isSubmitting = false);
        return;
      }

      if (!result.success) {
        F2HToast.error(
          context,
          result.message.isNotEmpty
              ? result.message
              : 'Payment failed. Please try again.',
        );
        setState(() => _isSubmitting = false);
        return;
      }

      final newBalance = result.walletBalance;
      if (newBalance != null) {
        final currentBalance = sessionCubit.state.profile?.walletBalance ?? 0;
        sessionCubit.rechargeWallet(newBalance - currentBalance);
      } else {
        sessionCubit.rechargeWallet(amount);
      }

      final successResult = TopupSuccessResult(
        amount: amount,
        newBalance: newBalance ?? (sessionCubit.state.profile?.walletBalance),
        transactionId: result.transactionId,
        paymentId: result.razorpayPaymentId,
      );

      widget.onTopupSuccess?.call(successResult);
      await sessionCubit.refresh();

      if (!mounted) return;
      F2HToast.success(context, '₹${amount.toStringAsFixed(0)} added successfully');
      Navigator.pop(context, successResult);
    } catch (e) {
      if (!mounted) return;
      F2HToast.error(context, 'Payment failed. Please try again.');
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final maxAllowed = _maxAllowed(context);
    final currentBalance =
        context.read<CustomerSessionCubit>().state.profile?.walletBalance ?? 0;
    final validationErr =
        _amountController.text.isNotEmpty ? _validationError(maxAllowed) : null;
    final isValid = validationErr == null && _enteredAmount > 0;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── Handle ──
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),

              // ── Gradient Header ──
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 16,
                  ),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF064E3B), Color(0xFF16A34A)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.18),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.account_balance_wallet_rounded,
                          color: Colors.white,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Add Money to Wallet',
                            style: AppTypography.titleMedium.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                              letterSpacing: -0.1,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'Current Balance: ₹${currentBalance.toStringAsFixed(0)}',
                            style: AppTypography.labelSmall.copyWith(
                              color: Colors.white.withValues(alpha: 0.78),
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // ── Amount Input ──
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: TextField(
                  controller: _amountController,
                  enabled: !_isSubmitting,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(4),
                  ],
                  onChanged: (_) => setState(() {}),
                  style: AppTypography.displayMedium.copyWith(
                    fontSize: 30,
                    fontWeight: FontWeight.w900,
                    color: kPrimary,
                    letterSpacing: -0.5,
                  ),
                  decoration: InputDecoration(
                    prefixText: '₹ ',
                    prefixStyle: AppTypography.displayMedium.copyWith(
                      fontSize: 30,
                      fontWeight: FontWeight.w900,
                      color: kPrimary,
                      letterSpacing: -0.5,
                    ),
                    hintText: '0',
                    hintStyle: AppTypography.displayMedium.copyWith(
                      fontSize: 30,
                      fontWeight: FontWeight.w900,
                      color: kPrimary.withValues(alpha: 0.2),
                      letterSpacing: -0.5,
                    ),
                    helperText: maxAllowed <= 0
                        ? 'Wallet full (₹${_walletCap.toStringAsFixed(0)} limit)'
                        : 'Max: ₹${maxAllowed.toStringAsFixed(0)}  •  Cap: ₹${_walletCap.toStringAsFixed(0)}',
                    helperStyle: AppTypography.bodySmall.copyWith(
                      fontSize: 11,
                      color: maxAllowed <= 0 ? kRed : kTextSub,
                      letterSpacing: 0.1,
                    ),
                    errorText: validationErr,
                    errorStyle: AppTypography.bodySmall.copyWith(
                      fontSize: 11,
                      color: kRed,
                    ),
                    filled: true,
                    fillColor: const Color(0xFFF0FDF4),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 16,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: kPrimary, width: 1.8),
                    ),
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: kRed, width: 1),
                    ),
                    focusedErrorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: kRed, width: 1.8),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // ── Preset Chips ──
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: _presets.map((amt) {
                    final isSelected = _enteredAmount == amt;
                    return Expanded(
                      child: GestureDetector(
                        onTap: _isSubmitting
                            ? null
                            : () {
                                HapticFeedback.selectionClick();
                                _amountController.text =
                                    amt.toStringAsFixed(0);
                                setState(() {});
                              },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? kPrimary
                                : const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isSelected
                                  ? kPrimary
                                  : const Color(0xFFBBF7D0),
                              width: isSelected ? 1.5 : 1,
                            ),
                            boxShadow: isSelected
                                ? [
                                    BoxShadow(
                                      color: kPrimary.withValues(alpha: 0.28),
                                      blurRadius: 10,
                                      offset: const Offset(0, 4),
                                    ),
                                  ]
                                : [],
                          ),
                          child: Text(
                            '+ ₹${amt.toStringAsFixed(0)}',
                            textAlign: TextAlign.center,
                            style: AppTypography.labelLarge.copyWith(
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                              color: isSelected
                                  ? Colors.white
                                  : const Color(0xFF15803D),
                              letterSpacing: 0.1,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),

              const SizedBox(height: 16),

              // ── Payment Methods Badge ──
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 11,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: const BoxDecoration(
                          color: Color(0xFFDCFCE7),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.verified_user_rounded,
                          color: Color(0xFF16A34A),
                          size: 17,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Instant UPI & Cards via Razorpay',
                              style: AppTypography.labelLarge.copyWith(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: kText,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'GPay · PhonePe · Paytm · BHIM · NetBanking · Cards',
                              style: AppTypography.bodySmall.copyWith(
                                fontSize: 10.5,
                                color: kTextSub,
                                letterSpacing: 0.1,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.lock_rounded,
                        size: 14,
                        color: Color(0xFF94A3B8),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // ── CTA Button ──
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: GestureDetector(
                  onTap: (_isSubmitting || !isValid)
                      ? null
                      : () {
                          final authState = context.read<AuthBloc>().state;
                          final sessionState =
                              context.read<CustomerSessionCubit>().state;
                          final isLoggedIn = authState is Authenticated ||
                              sessionState.profile != null;

                          if (!isLoggedIn) {
                            F2HToast.info(
                              context,
                              'Please sign in to add money to wallet.',
                              title: 'Sign In Required',
                              actionText: 'Sign In',
                              onAction: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) =>
                                        const LoginScreen(popOnSuccess: true),
                                  ),
                                );
                              },
                            );
                            return;
                          }
                          _submitTopup(maxAllowed);
                        },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      gradient: (_isSubmitting || !isValid)
                          ? null
                          : const LinearGradient(
                              colors: [Color(0xFF15803D), Color(0xFF22C55E)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                      color: (_isSubmitting || !isValid)
                          ? const Color(0xFFBBF7D0)
                          : null,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: (_isSubmitting || !isValid)
                          ? []
                          : [
                              BoxShadow(
                                color: kPrimary.withValues(alpha: 0.35),
                                blurRadius: 16,
                                offset: const Offset(0, 6),
                              ),
                            ],
                    ),
                    child: Center(
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Colors.white,
                                ),
                              ),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
                                  Icons.bolt_rounded,
                                  color: Colors.white,
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'PROCEED TO PAY  ₹${_enteredAmount > 0 ? _enteredAmount.toStringAsFixed(0) : '—'}',
                                  style: AppTypography.labelLarge.copyWith(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15,
                                    letterSpacing: 0.3,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
