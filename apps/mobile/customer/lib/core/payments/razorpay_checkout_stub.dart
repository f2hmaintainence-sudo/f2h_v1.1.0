// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : razorpay_checkout_stub.dart
// Description : Fallback used only on platforms with neither dart:io nor
//               dart:js_interop. Kept so the conditional import always
//               resolves and analysis stays clean.
//
// ============================================================================

import 'payment_models.dart';

Future<CheckoutOutcome> openCheckout(PaymentOrder order) async {
  return CheckoutOutcome.failure(
    'Online payment is not supported on this platform.',
  );
}
