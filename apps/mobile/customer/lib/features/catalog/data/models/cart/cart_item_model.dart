import 'package:f2h_customer/features/catalog/domain/entities/cart/cart_calculations_entity.dart';

class CartCalculationsModel extends CartCalculationsEntity {
  CartCalculationsModel({
    required super.subtotal,
    required super.deliveryFee,
    required super.taxes,
    required super.grandTotal,
  });

  factory CartCalculationsModel.fromJson(Map<String, dynamic> json) {
    final subtotalVal = (json['itemsSubtotal'] as num).toDouble();
    return CartCalculationsModel(
      subtotal: subtotalVal,
      deliveryFee: 0.0,
      taxes: 0.0,
      grandTotal: subtotalVal,
    );
  }
}
