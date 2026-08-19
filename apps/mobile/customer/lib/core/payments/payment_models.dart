// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : payment_models.dart
// Description : Value types shared by the Razorpay checkout implementations.
//
// ============================================================================

/// What a payment is for. Mirrors the API's `purpose` enum.
enum PaymentPurpose { walletTopup, bill, order }

extension PaymentPurposeApi on PaymentPurpose {
  String get apiValue {
    switch (this) {
      case PaymentPurpose.walletTopup:
        return 'wallet_topup';
      case PaymentPurpose.bill:
        return 'bill';
      case PaymentPurpose.order:
        return 'order';
    }
  }

  String get label {
    switch (this) {
      case PaymentPurpose.walletTopup:
        return 'Wallet Top-up';
      case PaymentPurpose.bill:
        return 'Bill Payment';
      case PaymentPurpose.order:
        return 'Order Payment';
    }
  }
}

/// A Razorpay order created by the API, ready to be handed to the checkout SDK.
class PaymentOrder {
  final String transactionId;
  final String razorpayOrderId;
  final String keyId;
  final double amount;
  final int amountInPaise;
  final String currency;
  final String name;
  final String description;
  final String themeColor;
  final String? referenceId;
  final String prefillName;
  final String prefillEmail;
  final String prefillContact;

  const PaymentOrder({
    required this.transactionId,
    required this.razorpayOrderId,
    required this.keyId,
    required this.amount,
    required this.amountInPaise,
    required this.currency,
    required this.name,
    required this.description,
    required this.themeColor,
    this.referenceId,
    this.prefillName = '',
    this.prefillEmail = '',
    this.prefillContact = '',
  });

  factory PaymentOrder.fromJson(Map<String, dynamic> json) {
    final prefill = (json['prefill'] as Map?)?.cast<String, dynamic>() ?? {};
    return PaymentOrder(
      transactionId: json['transaction_id']?.toString() ?? '',
      razorpayOrderId: json['razorpay_order_id']?.toString() ?? '',
      keyId: json['key_id']?.toString() ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      amountInPaise: (json['amount_in_paise'] as num?)?.toInt() ??
          (((json['amount'] as num?)?.toDouble() ?? 0) * 100).round(),
      currency: json['currency']?.toString() ?? 'INR',
      name: json['name']?.toString() ?? 'F2H Fresh',
      description: json['description']?.toString() ?? 'Payment',
      themeColor: json['theme_color']?.toString() ?? '#16A34A',
      referenceId: json['reference_id']?.toString(),
      prefillName: prefill['name']?.toString() ?? '',
      prefillEmail: prefill['email']?.toString() ?? '',
      prefillContact: prefill['contact']?.toString() ?? '',
    );
  }
}

/// Raw outcome handed back by the Razorpay checkout sheet.
class CheckoutOutcome {
  final bool success;

  /// True when the customer dismissed the sheet rather than failing a payment.
  final bool cancelled;
  final String? razorpayOrderId;
  final String? razorpayPaymentId;
  final String? razorpaySignature;
  final String? errorMessage;

  const CheckoutOutcome({
    required this.success,
    this.cancelled = false,
    this.razorpayOrderId,
    this.razorpayPaymentId,
    this.razorpaySignature,
    this.errorMessage,
  });

  factory CheckoutOutcome.cancelled([String? message]) => CheckoutOutcome(
        success: false,
        cancelled: true,
        errorMessage: message ?? 'Payment cancelled',
      );

  factory CheckoutOutcome.failure(String message) =>
      CheckoutOutcome(success: false, errorMessage: message);
}

/// Final result after the server has verified the signature and fulfilled.
class PaymentResult {
  final bool success;
  final bool cancelled;
  final String message;
  final String? transactionId;
  final String? razorpayOrderId;
  final String? razorpayPaymentId;
  final String? razorpaySignature;
  final double? walletBalance;

  const PaymentResult({
    required this.success,
    required this.message,
    this.cancelled = false,
    this.transactionId,
    this.razorpayOrderId,
    this.razorpayPaymentId,
    this.razorpaySignature,
    this.walletBalance,
  });

  factory PaymentResult.cancelled() => const PaymentResult(
        success: false,
        cancelled: true,
        message: 'Payment cancelled',
      );

  factory PaymentResult.failure(String message) =>
      PaymentResult(success: false, message: message);
}
