// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : payment_service.dart
// Description : Orchestrates the three-step online payment handshake:
//                 1. ask the API to create a Razorpay order
//                 2. open the Razorpay checkout sheet
//                 3. hand the signed response back for server-side verification
//
//               The signature is *always* verified on the server — the client
//               result is treated as a claim, never as proof of payment.
//
// ============================================================================

import 'package:dio/dio.dart';

import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';

import 'payment_models.dart';
import 'razorpay_checkout.dart';

class PaymentService {
  PaymentService._();
  static final PaymentService instance = PaymentService._();

  Dio get _dio => DioClient().dio;

  /// Step 1 — create the gateway order server-side.
  ///
  /// For bills the server recomputes the amount from the bill itself, so
  /// [amount] is only meaningful for top-ups and order checkouts.
  Future<PaymentOrder> createOrder({
    required PaymentPurpose purpose,
    double? amount,
    String? billId,
    String? referenceId,
    Map<String, dynamic>? notes,
  }) async {
    await DioClient().fetchCsrfToken();

    final response = await _dio.post(
      ApiEndpoints.paymentCreateOrder,
      data: {
        'purpose': purpose.apiValue,
        'amount': ?amount,
        'bill_id': ?billId,
        'reference_id': ?referenceId,
        'notes': ?notes,
      },
    );

    final body = response.data;
    if (body is! Map || body['status'] != true || body['data'] == null) {
      throw Exception(
        (body is Map ? body['message']?.toString() : null) ??
            'Could not start the payment',
      );
    }

    return PaymentOrder.fromJson(
      (body['data'] as Map).cast<String, dynamic>(),
    );
  }

  /// Step 3 — server-side signature verification and fulfilment.
  Future<PaymentResult> verify(CheckoutOutcome outcome) async {
    await DioClient().fetchCsrfToken();

    final response = await _dio.post(
      ApiEndpoints.paymentVerify,
      data: {
        'razorpay_order_id': outcome.razorpayOrderId,
        'razorpay_payment_id': outcome.razorpayPaymentId,
        'razorpay_signature': outcome.razorpaySignature,
      },
    );

    final body = response.data;
    if (body is! Map || body['status'] != true) {
      return PaymentResult.failure(
        (body is Map ? body['message']?.toString() : null) ??
            'Payment verification failed',
      );
    }

    final data = (body['data'] as Map?)?.cast<String, dynamic>() ?? {};
    return PaymentResult(
      success: true,
      message: body['message']?.toString() ?? 'Payment successful',
      transactionId: data['transaction_id']?.toString(),
      razorpayOrderId: outcome.razorpayOrderId,
      razorpayPaymentId: outcome.razorpayPaymentId,
      razorpaySignature: outcome.razorpaySignature,
      walletBalance: (data['wallet_balance'] as num?)?.toDouble(),
    );
  }

  /// Full round trip for wallet top-ups and bill payments, where the server
  /// settles the money as soon as the signature checks out.
  Future<PaymentResult> pay({
    required PaymentPurpose purpose,
    double? amount,
    String? billId,
    Map<String, dynamic>? notes,
  }) async {
    final CheckoutOutcome outcome;
    try {
      final order = await createOrder(
        purpose: purpose,
        amount: amount,
        billId: billId,
        notes: notes,
      );
      outcome = await openRazorpayCheckout(order);
    } catch (e) {
      return PaymentResult.failure(
        extractErrorMessage(e, fallback: 'Could not start the payment'),
      );
    }

    if (outcome.cancelled) return PaymentResult.cancelled();
    if (!outcome.success) {
      return PaymentResult.failure(
        outcome.errorMessage ?? 'Payment failed. Please try again.',
      );
    }

    try {
      return await verify(outcome);
    } catch (e) {
      // The money is captured but we could not confirm it. The gateway webhook
      // settles this server-side, so tell the customer to expect it shortly
      // rather than implying the payment was lost.
      return PaymentResult.failure(
        'Payment received, but confirmation is pending. It will reflect in a few minutes.',
      );
    }
  }

  /// Checkout variant: the payment is captured but *not* settled here — the
  /// order-placement call consumes it, so the returned handles must be passed
  /// through to `/customer/checkout/payment`.
  Future<PaymentResult> payForOrder({
    required double amount,
    Map<String, dynamic>? notes,
  }) async {
    final CheckoutOutcome outcome;
    try {
      final order = await createOrder(
        purpose: PaymentPurpose.order,
        amount: amount,
        notes: notes,
      );
      outcome = await openRazorpayCheckout(order);
    } catch (e) {
      return PaymentResult.failure(
        extractErrorMessage(e, fallback: 'Could not start the payment'),
      );
    }

    if (outcome.cancelled) return PaymentResult.cancelled();
    if (!outcome.success) {
      return PaymentResult.failure(
        outcome.errorMessage ?? 'Payment failed. Please try again.',
      );
    }

    return PaymentResult(
      success: true,
      message: 'Payment successful',
      razorpayOrderId: outcome.razorpayOrderId,
      razorpayPaymentId: outcome.razorpayPaymentId,
      razorpaySignature: outcome.razorpaySignature,
    );
  }
}
