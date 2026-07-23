import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_calculations_entity.dart';
import 'package:f2h_customer/features/catalog/domain/repositories/cart/cart_repository.dart';

class SyncCartUseCase {
  final CartRepository repository;

  SyncCartUseCase(this.repository);
  Future<CartCalculationsEntity> call(List<CartItemEntity> items, {String? customerId}) {
    return repository.syncCart(items, customerId: customerId);
  }
}
