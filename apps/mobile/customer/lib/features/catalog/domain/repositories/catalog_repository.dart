import 'package:f2h_customer/features/catalog/data/models/product_model.dart';

abstract class CatalogRepository {
  Future<List<Product>> getProducts();
  Future<List<Product>> getProductsByCategoryId(String categoryId);
  Future<List<Map<String, dynamic>>> getCategories();
  // [ADDED BY ANTIGRAVITY FOR SUBSCRIPTION & PRODUCT UI UPDATE]
  Future<List<Map<String, dynamic>>> getProductReviews(String productId);
}
