import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/features/catalog/data/models/checkout/checkout_request_model.dart';

abstract class CheckoutRemoteDataSource {
  Future<Map<String, dynamic>> placeCheckout(CheckoutRequestModel requestModel);
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
}
