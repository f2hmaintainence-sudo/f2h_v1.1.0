// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : razorpay_checkout_mobile.dart
// Description : Razorpay Checkout for native Android / iOS via the
//               razorpay_flutter plugin. Compiled only for dart:io targets —
//               the web build never sees this file.
//
// ============================================================================

import 'dart:async';

import 'package:razorpay_flutter/razorpay_flutter.dart';

import 'payment_models.dart';

Future<CheckoutOutcome> openCheckout(PaymentOrder order) async {
  final razorpay = Razorpay();
  final completer = Completer<CheckoutOutcome>();

  void finish(CheckoutOutcome outcome) {
    if (!completer.isCompleted) completer.complete(outcome);
  }

  razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse r) {
    finish(
      CheckoutOutcome(
        success: true,
        razorpayOrderId: r.orderId ?? order.razorpayOrderId,
        razorpayPaymentId: r.paymentId,
        razorpaySignature: r.signature,
      ),
    );
  });

  razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse r) {
    // Code 2 is the SDK's "user cancelled" signal; everything else is a real
    // failure worth surfacing to the customer.
    if (r.code == Razorpay.PAYMENT_CANCELLED) {
      finish(CheckoutOutcome.cancelled());
      return;
    }
    final message = (r.message ?? '').trim();
    finish(
      CheckoutOutcome.failure(
        message.isEmpty ? 'Payment failed. Please try again.' : message,
      ),
    );
  });

  razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, (ExternalWalletResponse r) {
    // The customer left for an external wallet app; the webhook settles it, so
    // report back as pending-cancel rather than a hard failure.
    finish(
      CheckoutOutcome.cancelled(
        'Completing payment in ${r.walletName ?? 'your wallet app'}…',
      ),
    );
  });

  try {
    razorpay.open({
      'key': order.keyId,
      'amount': order.amountInPaise,
      'currency': order.currency,
      'name': order.name,
      'description': order.description,
      'order_id': order.razorpayOrderId,
      'retry': {'enabled': false},
      'prefill': {
        'name': order.prefillName,
        'email': order.prefillEmail,
        'contact': order.prefillContact,
      },
      'theme': {'color': order.themeColor},
    });
  } catch (e) {
    finish(CheckoutOutcome.failure('Could not open the payment sheet: $e'));
  }

  final outcome = await completer.future;
  // clear() must run after the callbacks have fired or the plugin leaks the
  // event handlers between payments.
  Future.delayed(const Duration(seconds: 2), razorpay.clear);
  return outcome;
}
