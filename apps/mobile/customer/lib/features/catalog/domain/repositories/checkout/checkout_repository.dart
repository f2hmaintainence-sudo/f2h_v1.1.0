import 'package:f2h_customer/features/catalog/domain/entities/checkout/checkout_request_entity.dart';

abstract class CheckoutRepository {
  Future<Map<String, dynamic>> placeCheckout(CheckoutRequestEntity request);
}
