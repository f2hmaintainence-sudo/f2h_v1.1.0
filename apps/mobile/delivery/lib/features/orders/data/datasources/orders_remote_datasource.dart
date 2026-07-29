import 'package:dio/dio.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/features/orders/data/models/pickup_item_model.dart';

class OrdersRemoteDataSource {
  final DioClient dioClient;

  OrdersRemoteDataSource({required this.dioClient});

  Future<PickupResponse> getPickupItems({String? date}) async {
    try {
      final response = await dioClient.dio.get(
        ApiEndpoints.pickupItems,
        queryParameters: date != null ? {'date': date} : null,
      );
      // Log the raw API response so you can diagnose structure mismatches
      print('[PickupItems] HTTP ${response.statusCode}');
      print('[PickupItems] Body: ${response.data}');
      return PickupResponse.fromJson(response.data);
    } on DioException catch (e) {
      print('[PickupItems] DioError: ${e.type} | ${e.response?.statusCode} | ${e.response?.data}');
      throw _handleDioError(e);
    } catch (e, st) {
      // JSON parse / type cast errors show up here
      print('[PickupItems] Parse error: $e\n$st');
      throw Exception('Pickup parse error: $e');
    }
  }

  Future<Map<String, dynamic>> confirmPickup({
    required String runId,
    required List<Map<String, dynamic>> items,
    double? latitude,
    double? longitude,
  }) async {
    try {
      final response = await dioClient.dio.post(
        ApiEndpoints.confirmPickup,
        data: {
          'run_id': runId,
          'items': items,
          'latitude': ?latitude,
          'longitude': ?longitude,
        },
      );
      final data = response.data;
      if (data is Map) {
        return Map<String, dynamic>.from(data);
      }
      throw Exception('Invalid response format from server');
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Exception _handleDioError(DioException error) {
    String message = 'An error occurred';
    
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
        message = 'Connection timeout. Please check your internet.';
        break;
      case DioExceptionType.sendTimeout:
        message = 'Send timeout. Please try again.';
        break;
      case DioExceptionType.receiveTimeout:
        message = 'Receive timeout. Please try again.';
        break;
      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        if (statusCode == 401) {
          message = 'Unauthorized. Please login again.';
        } else if (statusCode == 404) {
          message = 'Resource not found.';
        } else if (statusCode == 500) {
          message = 'Server error. Please try again later.';
        } else {
          message = error.response?.data['message'] ?? 'Request failed.';
        }
        break;
      case DioExceptionType.cancel:
        message = 'Request was cancelled.';
        break;
      case DioExceptionType.connectionError:
        message = 'Connection error. Please check your internet.';
        break;
      default:
        message = 'An unexpected error occurred.';
    }
    
    return Exception(message);
  }
}
