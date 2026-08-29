import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';
import 'package:f2h_customer/core/payments/payment_service.dart';
import 'package:f2h_customer/core/payments/payment_models.dart';

class TopupDrawer extends StatefulWidget {
  const TopupDrawer({super.key});

  @override
  State<TopupDrawer> createState() => _TopupDrawerState();
}

class _TopupDrawerState extends State<TopupDrawer> {
  static const List<double> _presets = [200, 500, 1000];
  static const double _maxAmount = 5000;

  final _amountController = TextEditingController(text: '500');
  bool _isSubmitting = false;

  double get _enteredAmount =>
      double.tryParse(_amountController.text) ?? 0;

  String? get _validationError {
    final amt = _enteredAmount;
    if (amt <= 0) return 'Enter an amount';
    if (amt > _maxAmount) return 'Maximum ₹${_maxAmount.toStringAsFixed(0)}';
    return null;
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _submitTopup() async {
    final error = _validationError;
    if (error != null || _isSubmitting) {
      if (error != null) F2HToast.error(context, error);
      return;
    }

    setState(() => _isSubmitting = true);

    final amount = _enteredAmount;
    final sessionCubit = context.read<CustomerSessionCubit>();

    try {
      // Step 1 → create a Razorpay order, open the payment sheet, and verify
      // the signature server-side — all in one call.
      final result = await PaymentService.instance.pay(
        purpose: PaymentPurpose.walletTopup,
        amount: amount,
      );

      if (!mounted) return;

      if (result.cancelled) {
        // User dismissed the sheet — no money moved, nothing to show.
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

      // Payment verified server-side — refresh the session so the new balance
      // appears immediately without the customer having to pull-to-refresh.
      final newBalance = result.walletBalance;
      if (newBalance != null) {
        final currentBalance = sessionCubit.state.profile?.walletBalance ?? 0;
        sessionCubit.rechargeWallet(newBalance - currentBalance);
      } else {
        sessionCubit.rechargeWallet(amount);
      }
      await sessionCubit.refresh();

      if (!mounted) return;
      F2HToast.success(
        context,
        '₹${amount.toStringAsFixed(0)} added successfully',
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      F2HToast.error(context, 'Payment failed. Please try again.');
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Add Money to Wallet',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: kText,
                ),
              ),
              const SizedBox(height: 20),

              // ── Manual amount input ──
              TextField(
                controller: _amountController,
                enabled: !_isSubmitting,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(4), // max 4 digits (5000)
                ],
                onChanged: (_) => setState(() {}),
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: kPrimary,
                ),
                decoration: InputDecoration(
                  prefixText: '₹ ',
                  prefixStyle: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: kPrimary,
                  ),
                  hintText: '0',
                  hintStyle: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: kPrimary.withValues(alpha: 0.25),
                  ),
                  helperText: 'Max ₹${_maxAmount.toStringAsFixed(0)}',
                  helperStyle: const TextStyle(
                    fontSize: 11,
                    color: kTextSub,
                  ),
                  errorText: _amountController.text.isNotEmpty
                      ? _validationError
                      : null,
                  filled: true,
                  fillColor: const Color(0xFFF5F5F5),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: kPrimary, width: 1.5),
                  ),
                  errorBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Colors.red, width: 1),
                  ),
                  focusedErrorBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Colors.red, width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // ── Preset chips ──
              Row(
                children: _presets.map((amt) {
                  final isSelected = _enteredAmount == amt;

                  return Expanded(
                    child: GestureDetector(
                      onTap: _isSubmitting
                          ? null
                          : () {
                              _amountController.text = amt.toStringAsFixed(0);
                              setState(() {});
                            },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: isSelected ? kPrimary : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isSelected ? kPrimary : kBorder,
                          ),
                        ),
                        child: Text(
                          '+ ₹${amt.toStringAsFixed(0)}',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: isSelected ? Colors.white : kTextMid,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),

              // ── Payment methods badge ──
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF9FAFB),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.verified_user_outlined,
                      color: Color(0xFF16A34A),
                      size: 18,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Instant UPI & Cards via Razorpay',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: kText,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Google Pay, PhonePe, Paytm, BHIM, NetBanking & Cards',
                            style: TextStyle(
                              fontSize: 10,
                              color: kTextSub,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              ElevatedButton(
                onPressed: (_isSubmitting || _validationError != null)
                    ? null
                    : () {
                        final authState = context.read<AuthBloc>().state;
                        final sessionState = context.read<CustomerSessionCubit>().state;
                        final isLoggedIn = authState is Authenticated || sessionState.profile != null;

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

                        _submitTopup();
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  disabledBackgroundColor: kPrimary.withValues(alpha: 0.55),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  elevation: 0,
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            Colors.white,
                          ),
                        ),
                      )
                    : const Text(
                        'PROCEED TO PAY',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
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
