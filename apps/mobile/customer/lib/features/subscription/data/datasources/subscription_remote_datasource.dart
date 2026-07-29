import 'dart:convert';
import '../../../../core/api/dio_client.dart';
import '../../../../core/api/api_endpoints.dart';
import '../../../orders/data/models/order_model.dart';

abstract class SubscriptionRemoteDataSource {
  Future<List<dynamic>> getSubscriptions();
  Future<Map<String, dynamic>> createSubscription(Map<String, dynamic> data);
  Future<Map<String, dynamic>> checkoutSubscription(Map<String, dynamic> data);
  Future<Map<String, dynamic>> placeOrder(Map<String, dynamic> data);
  Future<List<Order>> getOrders();
  Future<Map<String, dynamic>> pauseSubscription(String subscriptionId, {String? startDate, String? endDate});
  Future<Map<String, dynamic>> resumeSubscription(String subscriptionId);
  Future<List<dynamic>> getSubscriptionCalendar(String subscriptionId);
  Future<Map<String, dynamic>> cancelSubscriptionItem(String subscriptionItemId);
  Future<Map<String, dynamic>> cancelSubscription(String subscriptionId, {String? cancelReason, String? endDate});
  Future<List<dynamic>> getPauseHistory(String subscriptionId);
  Future<Map<String, dynamic>> getSubscriptionDetail(String subscriptionId);
  Future<List<dynamic>> getSubscriptionBills(String subscriptionId);
}

class SubscriptionRemoteDataSourceImpl implements SubscriptionRemoteDataSource {
  final DioClient dioClient;
  SubscriptionRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<List<dynamic>> getSubscriptions() async {
    final response = await dioClient.dio.get(ApiEndpoints.subscriptions);
    if (response.data is Map && response.data['status'] == false) {
      throw Exception(response.data['message'] ?? 'Failed to load subscriptions');
    }
    return _extractList(response.data, const ['data', 'subscriptions']);
  }

  @override
  Future<Map<String, dynamic>> createSubscription(Map<String, dynamic> data) async {
    await dioClient.fetchCsrfToken();
    final response = await dioClient.dio.post(ApiEndpoints.subscriptions, data: data);
    return response.data as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> checkoutSubscription(Map<String, dynamic> data) async {
    print('[SubscriptionDS] checkoutSubscription payload: $data');
    await dioClient.fetchCsrfToken();
    try {
      final response = await dioClient.dio.post(ApiEndpoints.subscriptionCheckout, data: data);
      print('[SubscriptionDS] checkoutSubscription response: ${response.statusCode} ${response.data}');
      return response.data as Map<String, dynamic>;
    } catch (e) {
      print('[SubscriptionDS] checkoutSubscription ERROR: $e');
      rethrow;
    }
  }

  @override
  Future<Map<String, dynamic>> placeOrder(Map<String, dynamic> data) async {
    await dioClient.fetchCsrfToken();
    final response = await dioClient.dio.post(ApiEndpoints.orders, data: data);
    return response.data as Map<String, dynamic>;
  }

  @override
  Future<List<Order>> getOrders() async {
    final response = await dioClient.dio.get(ApiEndpoints.orders);
    if (response.data is Map && response.data['status'] == false) {
      throw Exception(response.data['message'] ?? 'Failed to load orders');
    }
    final rawOrders = _extractList(response.data, const ['orders', 'data']);
    return rawOrders
        .whereType<Map>()
        .map((item) => Order.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  List<dynamic> _extractList(dynamic responseData, List<String> keys) {
    if (responseData is List) return responseData;
    if (responseData is Map) {
      for (final key in keys) {
        final value = responseData[key];
        if (value is List) return value;
      }
    }
    return [];
  }

  @override
  Future<Map<String, dynamic>> pauseSubscription(String subscriptionId, {String? startDate, String? endDate}) async {
    await dioClient.fetchCsrfToken();
    final response = await dioClient.dio.post(
      '${ApiEndpoints.subscriptions}/$subscriptionId/pause',
      data: {
        'startDate': startDate,
        'endDate': endDate,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> resumeSubscription(String subscriptionId) async {
    await dioClient.fetchCsrfToken();
    final response = await dioClient.dio.post(
      '${ApiEndpoints.subscriptions}/$subscriptionId/resume',
    );
    return response.data as Map<String, dynamic>;
  }

  @override
  Future<List<dynamic>> getSubscriptionCalendar(String subscriptionId) async {
    try {
      final response = await dioClient.dio.get('${ApiEndpoints.subscriptionCalendar}$subscriptionId');
      final rawData = response.data;
      if (rawData == null) return [];
      
      if (rawData is List) {
        return rawData;
      }
      
      if (rawData is Map) {
        if (rawData['data'] != null && rawData['data'] is List) {
          return rawData['data'] as List<dynamic>;
        }
        return [];
      }
      
      if (rawData is String) {
        final decoded = jsonDecode(rawData);
        if (decoded is List) {
          return decoded;
        } else if (decoded is Map && decoded['data'] != null && decoded['data'] is List) {
          return decoded['data'] as List<dynamic>;
        }
      }
    } catch (e) {
      print('Error in getSubscriptionCalendar: $e');
    }
    return [];
  }

  @override
  Future<Map<String, dynamic>> cancelSubscriptionItem(String subscriptionItemId) async {
    await dioClient.fetchCsrfToken();
    final response = await dioClient.dio.post(
      '${ApiEndpoints.subscriptions}$subscriptionItemId/cancel',
    );
    return response.data as Map<String, dynamic>;
  }

  @override
  Future<Map<String, dynamic>> cancelSubscription(String subscriptionId, {String? cancelReason, String? endDate}) async {
    await dioClient.fetchCsrfToken();
    final response = await dioClient.dio.post(
      '${ApiEndpoints.subscriptions}/$subscriptionId/cancel',
      data: {
        'cancelReason': ?cancelReason,
        'endDate': ?endDate,
      },
    );
    return response.data as Map<String, dynamic>;
  }

  @override
  Future<List<dynamic>> getPauseHistory(String subscriptionId) async {
    final response = await dioClient.dio.get(
      '${ApiEndpoints.subscriptions}/$subscriptionId/pause-history',
    );
    final raw = response.data;
    if (raw is Map && raw['data'] is List) return raw['data'] as List;
    if (raw is List) return raw;
    return [];
  }

  @override
  Future<Map<String, dynamic>> getSubscriptionDetail(String subscriptionId) async {
    try {
      final response = await dioClient.dio.get(
        '${ApiEndpoints.subscriptions}/$subscriptionId/detail',
      );
      final raw = response.data;
      if (raw is Map<String, dynamic>) return raw;
      return {};
    } catch (e) {
      return {};
    }
  }

  @override
  Future<List<dynamic>> getSubscriptionBills(String subscriptionId) async {
    try {
      final response = await dioClient.dio.get(
        '${ApiEndpoints.subscriptions}/$subscriptionId/bills',
      );
      final raw = response.data;
      if (raw is Map && raw['data'] is List) return raw['data'] as List;
      if (raw is List) return raw;
      return [];
    } catch (e) {
      return [];
    }
  }
}
