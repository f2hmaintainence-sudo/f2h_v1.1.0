import 'package:f2h_customer/features/catalog/domain/entities/checkout/checkout_request_entity.dart';
import 'package:f2h_customer/features/catalog/domain/repositories/checkout/checkout_repository.dart';

class PlaceCheckoutUseCase {
  final CheckoutRepository repository;

  PlaceCheckoutUseCase(this.repository);

  Future<Map<String, dynamic>> call(CheckoutRequestEntity request) {
    return repository.placeCheckout(request);
  }
}
