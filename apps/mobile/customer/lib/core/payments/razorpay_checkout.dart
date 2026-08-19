// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : razorpay_checkout.dart
// Description : Platform-neutral entry point for the Razorpay checkout sheet.
//               The customer app ships as a PWA *and* as native Android/iOS
//               builds, so the implementation is chosen at compile time:
//                 • web    → Razorpay's checkout.js via dart:js_interop
//                 • mobile → the razorpay_flutter plugin
//
// ============================================================================

import 'payment_models.dart';
import 'razorpay_checkout_stub.dart'
    if (dart.library.io) 'razorpay_checkout_mobile.dart'
    if (dart.library.js_interop) 'razorpay_checkout_web.dart';

/// Opens the Razorpay checkout sheet and resolves once the customer pays,
/// fails or dismisses it. Never throws — failures come back as a
/// [CheckoutOutcome] so callers can render them inline.
Future<CheckoutOutcome> openRazorpayCheckout(PaymentOrder order) =>
    openCheckout(order);
