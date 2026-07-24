import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_item_entity.dart';
import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_calculations_entity.dart';

abstract class CartState {}

class CartInitialState extends CartState {}

class CartLoadingState extends CartState {}

class CartLoadedState extends CartState {
  final List<CartItemEntity> items;
  final CartCalculationsEntity calculations;

  CartLoadedState({
    required this.items,
    this.calculations = const CartCalculationsEntity(
      subtotal: 0,
      deliveryFee: 0,
      taxes: 0,
      grandTotal: 0,
    ),
  });
}

class CartErrorState extends CartState {
  final String message;
  CartErrorState(this.message);
}
