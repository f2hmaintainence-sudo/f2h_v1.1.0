import 'package:f2h_customer/features/catalog/domain/entities/checkout/checkout_request_entity.dart';

abstract class CheckoutEvent {}

class PlaceCheckoutEvent extends CheckoutEvent {
  final CheckoutRequestEntity request;

  PlaceCheckoutEvent(this.request);
}
