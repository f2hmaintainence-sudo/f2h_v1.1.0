import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';

abstract class CatalogRemoteDataSource {
  Future<List<dynamic>> getProductVariants();
  Future<List<dynamic>> getProductsByCategoryId(String categoryId);
  Future<List<dynamic>> getCategories();
  // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  Future<List<dynamic>> getProductReviews(String productId);
}

class CatalogRemoteDataSourceImpl implements CatalogRemoteDataSource {
  final DioClient dioClient;
  CatalogRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<List<dynamic>> getProductVariants() async {
    try {
      final response = await dioClient.dio.get(ApiEndpoints.products);
      if (response.data != null && response.data['data'] != null) {
        return response.data['data'] as List<dynamic>;
      }
      return [];
    } catch (e) {
      print('=== [Products API Debug] Error fetching products: $e');
      rethrow;
    }
  }

  @override
  Future<List<dynamic>> getProductsByCategoryId(String categoryId) async {
    try {
      final response = await dioClient.dio.get(
        '${ApiEndpoints.customerCategory}/$categoryId',
      );
      if (response.data != null && response.data['data'] != null) {
        return response.data['data'] as List<dynamic>;
      }
      return [];
    } catch (e) {
      print('Error fetching category products: $e');
      rethrow;
    }
  }

  @override
  Future<List<dynamic>> getCategories() async {
    try {
      final response = await dioClient.dio.get(ApiEndpoints.categories);
      print('=== [Categories API Debug] Response Status: ${response.statusCode}');
      if (response.data != null && response.data['data'] != null) {
        return response.data['data'] as List<dynamic>;
      }
      return [];
    } catch (e) {
      print('=== [Categories API Debug] Error fetching categories: $e');
      rethrow;
    }
  }

  @override
  Future<List<dynamic>> getProductReviews(String productId) async {
    try {
      final response = await dioClient.dio.get(
        '${ApiEndpoints.products}/$productId/reviews',
      );
      if (response.data != null && response.data['data'] != null) {
        return response.data['data'] as List<dynamic>;
      }
      return [];
    } catch (e) {
      print('Error fetching product reviews in remote datasource: $e');
      return [];
    }
  }
}
