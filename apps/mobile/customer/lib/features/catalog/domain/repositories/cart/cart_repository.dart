import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_calculations_entity.dart';

class CartLoadResultEntity {
  final List<CartItemEntity> items;
  final CartCalculationsEntity calculations;

  CartLoadResultEntity({
    required this.items,
    required this.calculations,
  });
}

abstract class CartRepository {
  Future<CartCalculationsEntity> syncCart(List<CartItemEntity> items, {String? customerId});
  
  // Fetches the saved cart items and calculation summaries from the backend
  Future<CartLoadResultEntity> getCart(String userId);
}
