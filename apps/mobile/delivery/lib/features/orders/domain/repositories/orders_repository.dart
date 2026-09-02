import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/data/models/pickup_item_model.dart';
import 'package:f2h_delivery/features/orders/data/models/handover_model.dart';
abstract class OrdersRepository {
  Future<List<DeliveryOrderModel>> fetchTodayOrders({String? status});
  Future<bool> updateOrderStatus(
    String orderId,
    String status, {
    String? notes,
    int? emptyBottlesCollected,
    int? returnedContainers,
    int? damagedContainers,
    int? lostContainers,
    String? paymentMode,
    String? paymentStatus,
    String? deliveryImage,
    List<Map<String, dynamic>>? containerReturns,
    List<Map<String, dynamic>>? containerDeliveries,
  });
  Future<DeliveryRun?> fetchTodayRun({String? status});
  Future<bool> startRun(String runId);
  Future<bool> markStopDelivered({
    required String runId,
    required String addressId,
    required String status,
    String? orderId,
    String? remarks,
    int? emptyBottlesCollected,
    int? returnedContainers,
    int? damagedContainers,
    int? lostContainers,
    String? paymentMode,
    String? paymentStatus,
    String? deliveryImage,
    double? latitude,
    double? longitude,
    List<Map<String, dynamic>>? containerReturns,
    List<Map<String, dynamic>>? containerDeliveries,
  });
  Future<PickupResponse> getPickupItems({String? date});
  Future<bool> confirmPickup({
    required String runId,
    required List<PickupItem> items,
    double? latitude,
    double? longitude,
  });
  Future<HandoverResult> handoverRun(String runId);
  Future<Map<String, dynamic>?> getPaymentQr({
    required String runId,
    required String addressId,
  });
}
