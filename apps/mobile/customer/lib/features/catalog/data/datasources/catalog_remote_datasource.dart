import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/api/api_endpoints.dart';

abstract class CatalogRemoteDataSource {
  Future<List<dynamic>> getProductVariants({String? branchId});
  Future<List<dynamic>> getProductsByCategoryId(String categoryId, {String? branchId});
  Future<List<dynamic>> getCategories();
  // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  Future<List<dynamic>> getProductReviews(String productId);
  Future<Map<String, dynamic>> checkProductAvailability(String productId, {String? branchId});
}

class CatalogRemoteDataSourceImpl implements CatalogRemoteDataSource {
  final DioClient dioClient;
  CatalogRemoteDataSourceImpl({required this.dioClient});

  @override
  Future<List<dynamic>> getProductVariants({String? branchId}) async {
    try {
      final url = (branchId != null && branchId.isNotEmpty)
          ? '${ApiEndpoints.products}?branch_id=${Uri.encodeComponent(branchId)}'
          : ApiEndpoints.products;
      final response = await dioClient.dio.get(url);
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
  Future<List<dynamic>> getProductsByCategoryId(String categoryId, {String? branchId}) async {
    try {
      final base = '${ApiEndpoints.customerCategory}/$categoryId';
      final url = (branchId != null && branchId.isNotEmpty)
          ? '$base?branch_id=${Uri.encodeComponent(branchId)}'
          : base;
      final response = await dioClient.dio.get(url);
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

  @override
  Future<Map<String, dynamic>> checkProductAvailability(String productId, {String? branchId}) async {
    try {
      final base = '${ApiEndpoints.products}/$productId/availability';
      final url = (branchId != null && branchId.isNotEmpty)
          ? '$base?branch_id=${Uri.encodeComponent(branchId)}'
          : base;
      final response = await dioClient.dio.get(url);
      if (response.data != null && response.data is Map<String, dynamic>) {
        return response.data as Map<String, dynamic>;
      }
      return {'available': false};
    } catch (e) {
      print('Error checking product availability in remote datasource: $e');
      return {'available': false};
    }
  }
}
