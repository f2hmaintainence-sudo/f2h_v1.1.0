// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : payment_flow.dart
// Description : Themed UI wrapper around PaymentService — a blocking progress
//               veil while the gateway order is created, then a success or
//               failure sheet in the F2H palette.
//
// ============================================================================

import 'package:flutter/material.dart';

import 'package:f2h_customer/theme/app_colors.dart';

import 'payment_models.dart';
import 'payment_service.dart';

class F2HPaymentFlow {
  const F2HPaymentFlow._();

  /// Runs a wallet top-up / bill payment end to end and returns the result.
  ///
  /// Shows a progress veil while the order is being created, hides it before
  /// the Razorpay sheet opens (the gateway renders its own UI), then presents
  /// the outcome. Pass `showResultSheet: false` when the caller renders its
  /// own confirmation.
  static Future<PaymentResult> pay(
    BuildContext context, {
    required PaymentPurpose purpose,
    double? amount,
    String? billId,
    Map<String, dynamic>? notes,
    bool showResultSheet = true,
  }) async {
    final result = await _withProgressVeil(
      context,
      label: 'Contacting payment gateway…',
      task: () => PaymentService.instance.pay(
        purpose: purpose,
        amount: amount,
        billId: billId,
        notes: notes,
      ),
    );

    if (showResultSheet && context.mounted && !result.cancelled) {
      await showResult(context, result, purpose: purpose, amount: amount);
    }
    return result;
  }

  /// Order checkout variant — the caller still has to place the order with the
  /// returned payment handles, so no result sheet is shown on success.
  static Future<PaymentResult> payForOrder(
    BuildContext context, {
    required double amount,
    Map<String, dynamic>? notes,
  }) {
    return _withProgressVeil(
      context,
      label: 'Contacting payment gateway…',
      task: () => PaymentService.instance.payForOrder(
        amount: amount,
        notes: notes,
      ),
    );
  }

  // ── Progress veil ─────────────────────────────────────────────────────────

  static Future<T> _withProgressVeil<T>(
    BuildContext context, {
    required String label,
    required Future<T> Function() task,
  }) async {
    final navigator = Navigator.of(context, rootNavigator: true);
    var veilVisible = false;

    // The veil covers order creation only; Razorpay's own sheet takes over
    // immediately afterwards, so it is dismissed on the next frame.
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black.withValues(alpha: 0.35),
      builder: (_) => _ProgressVeil(label: label),
    );
    veilVisible = true;

    try {
      final future = task();
      // Give the gateway sheet a moment to take over the screen.
      Future.delayed(const Duration(milliseconds: 900), () {
        if (veilVisible && navigator.canPop()) {
          veilVisible = false;
          navigator.pop();
        }
      });
      return await future;
    } finally {
      if (veilVisible && navigator.canPop()) {
        veilVisible = false;
        navigator.pop();
      }
    }
  }

  // ── Result sheet ──────────────────────────────────────────────────────────

  static Future<void> showResult(
    BuildContext context,
    PaymentResult result, {
    PaymentPurpose? purpose,
    double? amount,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PaymentResultSheet(
        result: result,
        purpose: purpose,
        amount: amount,
      ),
    );
  }
}

class _ProgressVeil extends StatelessWidget {
  const _ProgressVeil({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 26),
          margin: const EdgeInsets.symmetric(horizontal: 48),
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.10),
                blurRadius: 28,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: kPrimaryPl,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Center(
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.6,
                      valueColor: AlwaysStoppedAnimation<Color>(kPrimary),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: kText,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Please do not close the app',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: kTextSub),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PaymentResultSheet extends StatelessWidget {
  const _PaymentResultSheet({
    required this.result,
    this.purpose,
    this.amount,
  });

  final PaymentResult result;
  final PaymentPurpose? purpose;
  final double? amount;

  @override
  Widget build(BuildContext context) {
    final success = result.success;
    final accent = success ? kPrimary : kRed;
    final accentSoft = success ? kPrimaryPl : kRedLt;

    return SafeArea(
      top: false,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
        decoration: const BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: kBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 22),
            Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                color: accentSoft,
                shape: BoxShape.circle,
              ),
              child: Icon(
                success ? Icons.check_rounded : Icons.close_rounded,
                color: accent,
                size: 36,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              success ? 'Payment Successful' : 'Payment Failed',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: kText,
              ),
            ),
            if (amount != null) ...[
              const SizedBox(height: 6),
              Text(
                '\u{20B9}${amount!.toStringAsFixed(2)}',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: accent,
                ),
              ),
            ],
            const SizedBox(height: 10),
            Text(
              result.message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: kTextSub,
                height: 1.45,
              ),
            ),
            if (result.walletBalance != null) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: kBgDeep,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Wallet Balance',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: kTextMid,
                      ),
                    ),
                    Text(
                      '\u{20B9}${result.walletBalance!.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: kPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (result.razorpayPaymentId != null) ...[
              const SizedBox(height: 12),
              Text(
                'Ref: ${result.razorpayPaymentId}',
                style: const TextStyle(
                  fontSize: 10,
                  color: kMuted,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
            ],
            const SizedBox(height: 22),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: accent,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 50),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  success ? 'Done' : 'Close',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
