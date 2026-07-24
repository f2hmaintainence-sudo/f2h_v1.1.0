import 'package:f2h_customer/features/subscription/data/models/subscription_model.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';

abstract class SubscriptionRepository {
  Future<List<Subscription>> getSubscriptions();

  // ══════════════════════════════════════════════════════════
  //  CREATE SUBSCRIPTION
  //
  //  Now accepts morningQty, eveningQty, paymentType, autoRenew
  //  for the dedicated SubscriptionSetupScreen flow.
  //  unitPrice MUST always be variant.subscription_price.
  // ══════════════════════════════════════════════════════════
  Future<Map<String, dynamic>> createSubscription({
    required String customerId,
    required String branchId,
    required String variantId,
    required int quantity,
    required int morningQty,
    required int eveningQty,
    required String scheduleType,
    required String deliverySlot,
    required String startDate,
    required double unitPrice,
    required List<String> customDays,
    required String paymentType,
    required bool autoRenew,
  });

  /// Checkout a subscription with payment validation.
  /// Handles wallet deduction (prepaid/wallet) and credit limit check (postpaid).
  Future<Map<String, dynamic>> checkoutSubscription({
    required String customerId,
    required String branchId,
    String? addressId,
    required String variantId,
    required int quantity,
    required int morningQty,
    required int eveningQty,
    required String scheduleType,
    required String deliverySlot,
    required String startDate,
    required double unitPrice,
    required List<String> customDays,
    required String paymentType,
    required String paymentMethod, // 'wallet' | 'upi' | 'postpaid'
    required bool autoRenew,
    required double estimatedTotal,
  });

  Future<bool> placeOrder({
    required String variantId,
    required int quantity,
    required double unitPrice,
    required String deliverySlot,
    required String scheduledDate,
  });

  Future<List<Order>> getOrders();
  Future<bool> pauseSubscription(String subscriptionId, {String? startDate, String? endDate});
  Future<bool> resumeSubscription(String subscriptionId);
  Future<List<dynamic>> getSubscriptionCalendar(String subscriptionId);
  Future<bool> cancelSubscriptionItem(String subscriptionItemId);
  Future<bool> cancelSubscription(String subscriptionId, {String? cancelReason, String? endDate});
  Future<List<SubscriptionPauseModel>> getPauseHistory(String subscriptionId);
}
