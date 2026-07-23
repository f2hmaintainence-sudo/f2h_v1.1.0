import 'package:f2h_customer/features/subscription/data/models/subscription_model.dart';
import 'package:f2h_customer/features/orders/data/models/order_model.dart';

abstract class SubscriptionRepository {
  Future<List<Subscription>> getSubscriptions();
  Future<bool> createSubscription({
    required String customerId,
    required String branchId,
    required String variantId,
    required int quantity,
    required String scheduleType,
    required String deliverySlot,
    required String startDate,
    required double unitPrice,
    required List<String> customDays,
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
