// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : razorpay_checkout_web.dart
// Description : Razorpay Checkout for Flutter Web, driven through
//               dart:js_interop against Razorpay's checkout.js. The script is
//               loaded lazily so a customer who never pays never downloads it.
//
// ============================================================================

import 'dart:async';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'payment_models.dart';

const String _checkoutScriptUrl = 'https://checkout.razorpay.com/v1/checkout.js';

@JS('document')
external JSObject get _document;

@JS('Razorpay')
extension type _Razorpay._(JSObject _) implements JSObject {
  external factory _Razorpay(JSObject options);
  external void open();
  external void on(String event, JSFunction handler);
}

Completer<void>? _scriptLoader;

/// Injects checkout.js once and resolves when it is ready to use.
Future<void> _ensureCheckoutScript() {
  if (globalContext.has('Razorpay')) return Future<void>.value();

  final existing = _scriptLoader;
  if (existing != null) return existing.future;

  final completer = Completer<void>();
  _scriptLoader = completer;

  final script = _document.callMethod<JSObject>(
    'createElement'.toJS,
    'script'.toJS,
  );
  script.setProperty('src'.toJS, _checkoutScriptUrl.toJS);
  script.setProperty('async'.toJS, true.toJS);

  script.setProperty(
    'onload'.toJS,
    (() {
      if (!completer.isCompleted) completer.complete();
    }).toJS,
  );
  script.setProperty(
    'onerror'.toJS,
    (() {
      _scriptLoader = null;
      if (!completer.isCompleted) {
        completer.completeError(
          StateError('Could not load the Razorpay checkout script'),
        );
      }
    }).toJS,
  );

  final head = _document.getProperty<JSObject>('head'.toJS);
  head.callMethod<JSAny?>('appendChild'.toJS, script);

  return completer.future.timeout(
    const Duration(seconds: 20),
    onTimeout: () {
      _scriptLoader = null;
      throw TimeoutException('Razorpay checkout took too long to load');
    },
  );
}

JSObject _jsObjectWith(Map<String, JSAny?> entries) {
  final obj = JSObject();
  entries.forEach((key, value) => obj.setProperty(key.toJS, value));
  return obj;
}

Future<CheckoutOutcome> openCheckout(PaymentOrder order) async {
  try {
    await _ensureCheckoutScript();
  } catch (e) {
    return CheckoutOutcome.failure(
      'Unable to start the payment gateway. Check your connection and try again.',
    );
  }

  final completer = Completer<CheckoutOutcome>();
  void finish(CheckoutOutcome outcome) {
    if (!completer.isCompleted) completer.complete(outcome);
  }

  try {
    final options = _jsObjectWith({
      'key': order.keyId.toJS,
      'amount': order.amountInPaise.toJS,
      'currency': order.currency.toJS,
      'name': order.name.toJS,
      'description': order.description.toJS,
      'order_id': order.razorpayOrderId.toJS,
      'retry': _jsObjectWith({'enabled': false.toJS}),
      'prefill': _jsObjectWith({
        'name': order.prefillName.toJS,
        'email': order.prefillEmail.toJS,
        'contact': order.prefillContact.toJS,
      }),
      'theme': _jsObjectWith({'color': order.themeColor.toJS}),
      'handler': ((JSObject response) {
        finish(
          CheckoutOutcome(
            success: true,
            razorpayOrderId:
                response.getProperty<JSString?>('razorpay_order_id'.toJS)?.toDart ??
                    order.razorpayOrderId,
            razorpayPaymentId: response
                .getProperty<JSString?>('razorpay_payment_id'.toJS)
                ?.toDart,
            razorpaySignature: response
                .getProperty<JSString?>('razorpay_signature'.toJS)
                ?.toDart,
          ),
        );
      }).toJS,
      'modal': _jsObjectWith({
        'escape': true.toJS,
        // Fires when the customer closes the sheet without paying. Razorpay
        // also calls this after a failure, so the completer guard keeps the
        // first (more specific) outcome.
        'ondismiss': (() => finish(CheckoutOutcome.cancelled())).toJS,
      }),
    });

    final razorpay = _Razorpay(options);

    razorpay.on(
      'payment.failed',
      ((JSObject response) {
        final error = response.getProperty<JSObject?>('error'.toJS);
        final description =
            error?.getProperty<JSString?>('description'.toJS)?.toDart;
        finish(
          CheckoutOutcome.failure(
            description?.isNotEmpty == true
                ? description!
                : 'Payment failed. Please try again.',
          ),
        );
      }).toJS,
    );

    razorpay.open();
  } catch (e) {
    return CheckoutOutcome.failure('Could not open the payment sheet: $e');
  }

  return completer.future;
}
