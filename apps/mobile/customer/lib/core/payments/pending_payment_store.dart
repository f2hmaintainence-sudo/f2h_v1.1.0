// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : pending_payment_store.dart
// Description : Persistent local store for in-flight online payments.
//               Guarantees that if the OS backgrounds, kills, or reloads the app
//               while the customer is in an external UPI app (PhonePe, GPay, Paytm),
//               the pending payment state survives and can be verified/recovered
//               on resume.
// ============================================================================

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PendingPayment {
  final String razorpayOrderId;
  final String internalTxnId;
  final String purpose;
  final double amount;
  final int timestamp;
  final String? billId;
  final Map<String, dynamic>? notes;

  const PendingPayment({
    required this.razorpayOrderId,
    required this.internalTxnId,
    required this.purpose,
    required this.amount,
    required this.timestamp,
    this.billId,
    this.notes,
  });

  Map<String, dynamic> toJson() => {
        'razorpay_order_id': razorpayOrderId,
        'internal_txn_id': internalTxnId,
        'purpose': purpose,
        'amount': amount,
        'timestamp': timestamp,
        if (billId != null) 'bill_id': billId,
        if (notes != null) 'notes': notes,
      };

  factory PendingPayment.fromJson(Map<String, dynamic> json) => PendingPayment(
        razorpayOrderId: json['razorpay_order_id']?.toString() ?? '',
        internalTxnId: json['internal_txn_id']?.toString() ?? '',
        purpose: json['purpose']?.toString() ?? 'wallet_topup',
        amount: double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
        timestamp: int.tryParse(json['timestamp']?.toString() ?? '0') ?? 0,
        billId: json['bill_id']?.toString(),
        notes: json['notes'] is Map
            ? (json['notes'] as Map).cast<String, dynamic>()
            : null,
      );
}

class PendingPaymentStore {
  static const String _key = 'f2h_pending_payment_state';
  static const int _maxAgeMs = 30 * 60 * 1000; // 30 minutes

  /// Saves the pending payment to persistent local storage immediately after order creation.
  static Future<void> save(PendingPayment payment) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_key, jsonEncode(payment.toJson()));
      debugPrint(
        '[PendingPaymentStore] Saved pending payment: order_id=${payment.razorpayOrderId}, purpose=${payment.purpose}, amount=₹${payment.amount}',
      );
    } catch (e) {
      debugPrint('[PendingPaymentStore] Failed to save pending payment: $e');
    }
  }

  /// Retrieves the pending payment if it exists and is less than 30 minutes old.
  static Future<PendingPayment?> get() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw == null || raw.isEmpty) return null;

      final map = jsonDecode(raw) as Map<String, dynamic>;
      final payment = PendingPayment.fromJson(map);

      final age = DateTime.now().millisecondsSinceEpoch - payment.timestamp;
      if (age > _maxAgeMs || age < 0) {
        debugPrint(
          '[PendingPaymentStore] Pending payment expired (${(age / 60000).toStringAsFixed(1)} min old), clearing.',
        );
        await clear();
        return null;
      }
      return payment;
    } catch (e) {
      debugPrint('[PendingPaymentStore] Failed to read pending payment: $e');
      await clear();
      return null;
    }
  }

  /// Clears the pending payment after successful verification, order placement, or explicit cancellation.
  static Future<void> clear() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_key);
      debugPrint('[PendingPaymentStore] Pending payment cleared.');
    } catch (e) {
      debugPrint('[PendingPaymentStore] Failed to clear pending payment: $e');
    }
  }
}
