import 'package:f2h_customer/features/catalog/domain/repositories/cart/cart_repository.dart';

class GetCartUseCase {
  final CartRepository repository;

  GetCartUseCase(this.repository);

  Future<CartLoadResultEntity> call(String userId) {
    return repository.getCart(userId);
  }
}
