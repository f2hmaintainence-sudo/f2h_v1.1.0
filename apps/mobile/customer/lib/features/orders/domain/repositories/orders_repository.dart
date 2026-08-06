abstract class OrdersRepository {
  Future<Map<String, dynamic>> getOrdersAndSubscriptions();
  Future<Map<String, dynamic>> cancelOrder(String orderId);
  Future<Map<String, dynamic>> rateOrder(String orderId, int rating, String feedback, {String? productId});
}
