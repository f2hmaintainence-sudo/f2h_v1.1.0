import 'package:f2h_customer/core/api/api_endpoints.dart';
import 'package:f2h_customer/core/api/dio_client.dart';

abstract class CartRemoteDataSource {
  // Sends the list of serialized cart items to the server
  // and returns the raw JSON response containing the calculations
  Future<Map<String, dynamic>> syncCart(List<Map<String, dynamic>> itemsJson, {String? customerId});
  
  // Fetches the cart items and bill summary for the given userId
  Future<Map<String, dynamic>> getCart(String userId);
}

class CartRemoteDataSourceImpl implements CartRemoteDataSource {
  final DioClient dioClient;

  CartRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<Map<String, dynamic>> syncCart(List<Map<String, dynamic>> itemsJson, {String? customerId}) async {
    print('=== [Cart Sync API Debug] Sending POST to ${ApiEndpoints.cartSync} with payload: $itemsJson, customer_id: $customerId');
    try {
      // Makes the POST request to the NestJS endpoint we saw in your backend
      final response = await dioClient.dio.post(
        ApiEndpoints.cartSync,
        data: {
          'items': itemsJson,
          'customer_id': ?customerId,
        },
      );

      print('=== [Cart Sync API Debug] Received response: ${response.statusCode} - ${response.data}');

      if (response.data != null) {
        // Return the body (which contains the billSummary and item pricing details)
        return response.data as Map<String, dynamic>;
      }
      
      throw Exception('Empty response from cart sync API');
    } catch (e) {
      print('=== [Cart Sync API Debug] Error syncing cart: $e');
      rethrow;
    }
  }

  @override
  Future<Map<String, dynamic>> getCart(String userId) async {
    final path = ApiEndpoints.cartData.replaceAll(':user_id', userId);
    final fullUrl = '${ApiEndpoints.baseUrl}$path';
    
    print('=== [Cart Backend Fetch Log] ===');
    print('Static Endpoint: ${ApiEndpoints.cartData}');
    print('Resolved Path: $path');
    print('Full API URL: $fullUrl');
    print('Method: GET');
    
    try {
      final response = await dioClient.dio.get(path);
      print('=== [Cart Backend Fetch Response] ===');
      print('Status Code: ${response.statusCode}');
      print('Response Body: ${response.data}');
      print('======================================');

      if (response.data != null) {
        return response.data as Map<String, dynamic>;
      }
      throw Exception('Empty response from get cart API');
    } catch (e) {
      print('=== [Cart Backend Fetch Error] ===');
      print('Endpoint URL: $fullUrl');
      print('Error: $e');
      print('==================================');
      rethrow;
    }
  }
}
