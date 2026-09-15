// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : payment_recovery_service.dart
// Description : Bulletproof lifecycle recovery service for customer payments.
//               Automatically intercepts app resume from UPI Intent apps
//               (PhonePe, GPay, Paytm) and re-synchronizes any in-flight
//               payment with the backend and gateway.
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'payment_service.dart';
import 'pending_payment_store.dart';

class PaymentRecoveryService {
  PaymentRecoveryService._();
  static final PaymentRecoveryService instance = PaymentRecoveryService._();

  bool _isChecking = false;
  int _lastCheckTimestamp = 0;
  static const int _debounceIntervalMs = 4000; // 4 seconds debounce

  /// Checks if an in-flight payment was interrupted (e.g. UPI Intent backgrounding)
  /// and queries the backend to recover the payment and update wallet/order status.
  Future<bool> checkAndRecoverPendingPayment(
    BuildContext context, {
    bool showToast = true,
  }) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    if (_isChecking || (now - _lastCheckTimestamp < _debounceIntervalMs)) {
      return false;
    }

    final pending = await PendingPaymentStore.get();
    if (pending == null) return false;

    _isChecking = true;
    _lastCheckTimestamp = now;

    try {
      debugPrint(
        '[PaymentRecoveryService] Checking status for pending order: ${pending.razorpayOrderId} (${pending.purpose}, ₹${pending.amount})',
      );

      final result = await PaymentService.instance.checkOrderStatus(
        pending.razorpayOrderId,
      );

      final status = result['status'] == true;
      final paymentStatus = (result['payment_status'] ?? '').toString().toLowerCase();
      final isRecovered = result['recovered'] == true;
      final serverMessage = result['message']?.toString() ?? '';

      if (paymentStatus == 'fulfilled' ||
          (paymentStatus == 'paid' && (pending.purpose == 'wallet_topup' || pending.purpose == 'bill'))) {
        // Payment captured and credited/settled successfully
        await PendingPaymentStore.clear();

        if (context.mounted) {
          try {
            await context.read<CustomerSessionCubit>().refresh();
          } catch (_) {}

          if (showToast) {
            final toastMsg = serverMessage.isNotEmpty
                ? serverMessage
                : (pending.purpose == 'wallet_topup'
                    ? 'Payment of ₹${pending.amount.toStringAsFixed(0)} recovered and credited to wallet.'
                    : 'Payment recovered and credited successfully.');
            F2HToast.success(context, toastMsg);
          }
        }
        return true;
      }

      if (paymentStatus == 'failed') {
        // Payment definitively failed at the gateway
        await PendingPaymentStore.clear();
        if (context.mounted && showToast) {
          F2HToast.error(
            context,
            serverMessage.isNotEmpty
                ? serverMessage
                : 'Previous payment was not completed or failed.',
          );
        }
        return false;
      }

      if (paymentStatus == 'paid' && pending.purpose == 'order') {
        // Captured at gateway, awaiting order checkout consumption
        if (context.mounted && showToast) {
          F2HToast.show(
            context,
            'Online payment verified. Please complete your checkout.',
            type: ToastType.info,
          );
        }
        return true;
      }

      // If still 'created', customer might still be completing payment in UPI app.
      debugPrint(
        '[PaymentRecoveryService] Payment still pending at gateway (status: $paymentStatus). Keeping pending state.',
      );
      return false;
    } catch (e) {
      debugPrint('[PaymentRecoveryService] Error during recovery check: $e');
      return false;
    } finally {
      _isChecking = false;
    }
  }
}
