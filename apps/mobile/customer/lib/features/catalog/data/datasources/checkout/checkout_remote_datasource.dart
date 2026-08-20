import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/features/catalog/data/models/checkout/checkout_request_model.dart';

abstract class CheckoutRemoteDataSource {
  Future<Map<String, dynamic>> placeCheckout(CheckoutRequestModel requestModel);

  Future<Map<String, dynamic>> validateCoupon({
    required String couponCode,
    required double subtotal,
  });

  Future<List<Map<String, dynamic>>> getAvailableCoupons(double subtotal);

  Future<Map<String, dynamic>> previewDiscounts(CheckoutRequestModel requestModel);
}

class CheckoutRemoteDataSourceImpl implements CheckoutRemoteDataSource {
  final DioClient dioClient;

  CheckoutRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<Map<String, dynamic>> placeCheckout(CheckoutRequestModel requestModel) async {
    print('=== [Checkout API Debug] Sending POST to ${ApiEndpoints.checkOut} with payload: ${requestModel.toJson()}');
    try {
      final response = await dioClient.dio.post(
        ApiEndpoints.checkOut,
        data: requestModel.toJson(),
      );

      print('=== [Checkout API Debug] Received response: ${response.statusCode} - ${response.data}');

      if (response.data != null) {
        return response.data as Map<String, dynamic>;
      }
      
      throw Exception('Empty response from checkout API');
    } catch (e) {
      print('=== [Checkout API Debug] Error placing checkout: $e');
      rethrow;
    }
  }

  @override
  Future<Map<String, dynamic>> validateCoupon({
    required String couponCode,
    required double subtotal,
  }) async {
    final response = await dioClient.dio.post(
      ApiEndpoints.validateCoupon,
      data: {'coupon_code': couponCode, 'subtotal': subtotal},
    );

    final data = response.data;
    if (data is Map<String, dynamic>) return data;
    throw Exception('Empty response from coupon validation API');
  }

  @override
  Future<Map<String, dynamic>> previewDiscounts(
    CheckoutRequestModel requestModel,
  ) async {
    final response = await dioClient.dio.post(
      ApiEndpoints.previewDiscounts,
      data: requestModel.toJson(),
    );

    final data = response.data;
    if (data is Map<String, dynamic>) return data;
    throw Exception('Empty response from discount preview API');
  }

  @override
  Future<List<Map<String, dynamic>>> getAvailableCoupons(double subtotal) async {
    final response = await dioClient.dio.get(
      ApiEndpoints.availableCoupons,
      queryParameters: {'subtotal': subtotal},
    );

    final data = response.data;
    if (data is Map && data['data'] is List) {
      return (data['data'] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    }
    return const [];
  }
}
