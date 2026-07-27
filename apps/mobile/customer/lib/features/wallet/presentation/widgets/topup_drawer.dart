import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/auth/presentation/screens/login_screen.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_state.dart';

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
    final dioClient = sl<DioClient>();
    final sessionCubit = context.read<CustomerSessionCubit>();

    try {
      await dioClient.fetchCsrfToken();
      final response = await dioClient.dio.post(
        ApiEndpoints.customerWalletTopup,
        data: {
          'amount': amount,
          'transaction_type': 'credit',
          'direction': 'credit',
          'reference_type': 'wallet_topup',
          'remarks': 'Wallet top-up',
          'reason': 'Wallet top-up',
          'initiated_by': 'customer',
        },
      );

      final data = response.data;
      if (data is Map && data['status'] == false) {
        throw Exception(data['message'] ?? 'Failed to add money');
      }

      await sessionCubit.refreshSilently();

      if (!mounted) return;
      F2HToast.success(
        context,
        '\u{20B9}${amount.toStringAsFixed(0)} added successfully',
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      F2HToast.error(context, extractErrorMessage(e, fallback: 'Failed to add money'));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
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
                          '+ \u{20B9}${amt.toStringAsFixed(0)}',
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
              const SizedBox(height: 24),

              ElevatedButton(
                onPressed: (_isSubmitting || _validationError != null)
                    ? null
                    : () {
                        final authState = context.read<AuthBloc>().state;

                        if (authState is! Authenticated) {
                          F2HToast.error(
                              context, 'Please login to add money to wallet');
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const LoginScreen(),
                            ),
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
