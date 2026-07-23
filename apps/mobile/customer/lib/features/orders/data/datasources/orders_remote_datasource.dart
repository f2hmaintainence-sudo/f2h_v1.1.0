import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';

abstract class OrdersRemoteDataSource {
  /// Returns combined {orders: [...], subscriptions: [...]} from a single API call
  Future<Map<String, dynamic>> getOrdersAndSubscriptions();
  Future<Map<String, dynamic>> cancelOrder(String orderId);
  Future<Map<String, dynamic>> rateOrder(String orderId, int rating, String feedback, {String? productId});
}

class OrdersRemoteDataSourceImpl implements OrdersRemoteDataSource {
  final DioClient dioClient;
  OrdersRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<Map<String, dynamic>> getOrdersAndSubscriptions() async {
    final response = await dioClient.dio.get(ApiEndpoints.orders);
    if (response.data != null) {
      return Map<String, dynamic>.from(response.data as Map);
    }
    return {'orders': [], 'subscriptions': []};
  }

  @override
  Future<Map<String, dynamic>> cancelOrder(String orderId) async {
    await dioClient.fetchCsrfToken();
    final response = await dioClient.dio.post('${ApiEndpoints.orders}/$orderId/cancel');
    return response.data as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> rateOrder(String orderId, int rating, String feedback, {String? productId}) async {
    await dioClient.fetchCsrfToken();
    final response = await dioClient.dio.post(
      '${ApiEndpoints.orders}/$orderId/rate',
      data: {
        'rating': rating,
        'feedback': feedback,
        if (productId != null) 'product_id': productId, // [ADDED BY ANTIGRAVITY]
      },
    );
    return response.data as Map<String, dynamic>;
  }
}
